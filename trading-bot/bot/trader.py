"""El bot EN DIRECTO: el bucle que vigila el mercado y opera solo.

Qué hace en cada vuelta (cada `intervalo_revision_segundos`, por defecto 60 s):
  1. Mira el precio actual.
  2. Si tiene BTC y el precio ha caído hasta el stop-loss -> VENDE.
  3. Si acaba de cerrar una vela nueva (cada 4 h):
       - calcula las medias y la señal con las velas ya cerradas,
       - señal de compra + frenos de riesgo OK -> COMPRA,
       - señal de venta y tiene BTC -> VENDE.
  4. Revisa la regla del x2 y el freno de drawdown.
  5. Guarda el estado en estado/<modo>.json (por si se apaga el ordenador).

Detalle importante: al arrancar, el bot NO compra a mitad de una tendencia. Espera
al próximo cruce de medias. Puede pasar días sin operar: es normal.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone

from .config import RAIZ, Config
from .cuenta import EstadoCuenta, aplicar_compra, aplicar_venta
from .datos import duracion_ms
from .estrategia import COMPRAR, VENDER, calcular_senales
from .registro import Notificador, anotar_operacion, configurar_log
from .riesgo import GestorRiesgo

CARPETA_ESTADO = RAIZ / "estado"
VELAS_A_PEDIR = 1000  # muchas velas para que las medias salgan iguales que en el backtest


class Trader:
    def __init__(self, cfg: Config, broker, modo: str, notificador: Notificador | None = None):
        self.cfg, self.broker, self.modo = cfg, broker, modo
        self.gestor = GestorRiesgo(cfg.riesgo)
        self.log = configurar_log(modo)
        self.aviso = notificador or Notificador(modo)
        self.ruta_estado = CARPETA_ESTADO / f"{modo}.json"
        self.estado = EstadoCuenta.cargar(self.ruta_estado) or EstadoCuenta(eur=cfg.riesgo.capital_inicial)

    # ------------------------------------------------------------------
    def _avisar(self, texto: str, nivel: str = "info") -> None:
        getattr(self.log, nivel)(texto)
        self.aviso.enviar(texto)

    def _ultima_vela_cerrada(self, ahora: datetime) -> str:
        """Fecha de inicio de la última vela que ya ha cerrado."""
        paso = duracion_ms(self.cfg.mercado.temporalidad)
        ahora_ms = int(ahora.timestamp() * 1000)
        inicio = (ahora_ms // paso) * paso - paso
        return datetime.fromtimestamp(inicio / 1000, tz=timezone.utc).isoformat()

    def _comprar(self, motivo: str, ahora: datetime) -> None:
        permitido, por_que = self.gestor.puede_abrir(self.estado, ahora)
        if not permitido:
            self._avisar(f"Señal de compra IGNORADA: {por_que}", "warning")
            return
        eur = self.gestor.tamano_compra_eur(self.estado)
        if eur <= 0:
            self._avisar(f"Señal de compra ignorada: el tamaño queda por debajo de la orden mínima "
                         f"({self.cfg.riesgo.orden_minima_eur:g} €)", "warning")
            return
        op = self.broker.comprar(eur, motivo)
        aplicar_compra(self.estado, op, self.cfg.riesgo.stop_loss_pct)
        anotar_operacion(op, self.modo, self.broker.simbolo)
        self.estado.historial = (self.estado.historial + [f"{op.fecha[:16]} compra {op.eur:.2f} @ {op.precio:,.2f}"])[-50:]
        self._avisar(
            f"🟢 COMPRA {op.cantidad_btc:.6f} BTC a {op.precio:,.2f} ({op.eur:.2f} €). Motivo: {motivo}.\n"
            f"Stop-loss en {self.estado.precio_stop:,.2f} (−{self.cfg.riesgo.stop_loss_pct:g} %)."
        )

    def _vender(self, motivo: str, ahora: datetime) -> None:
        op = self.broker.vender(self.estado.btc, motivo)
        pnl = aplicar_venta(self.estado, op)
        anotar_operacion(op, self.modo, self.broker.simbolo)
        self.estado.historial = (self.estado.historial + [f"{op.fecha[:16]} venta {op.eur:.2f} pnl {pnl:+.2f}"])[-50:]
        icono = "🔴" if pnl < 0 else "🟢"
        self._avisar(f"{icono} VENTA a {op.precio:,.2f}. Resultado: {pnl:+.2f} €. Motivo: {motivo}.")
        for aviso in self.gestor.registrar_cierre(self.estado, pnl, ahora):
            self._avisar(f"⏸️ {aviso}", "warning")

    # ------------------------------------------------------------------
    def paso(self, ahora: datetime | None = None) -> None:
        """Una vuelta del bucle."""
        ahora = ahora or datetime.now(timezone.utc)
        precio = self.broker.precio()
        self.gestor.nuevo_dia(self.estado, ahora, precio)

        # 2) Stop-loss
        if self.gestor.stop_alcanzado(self.estado, precio):
            self._vender("stop-loss", ahora)

        # 3) ¿Vela nueva cerrada?
        esperada = self._ultima_vela_cerrada(ahora)
        if self.estado.ultima_vela_procesada != esperada:
            velas = self.broker.velas(VELAS_A_PEDIR)
            if not velas.empty and velas.index[-1].isoformat() == esperada:
                t = calcular_senales(velas, self.cfg.estrategia)
                ultima = t.iloc[-1]
                senal = ultima["senal"]
                self.log.info(
                    "Vela %s cerrada: precio %.2f | EMA%d %.2f | EMA%d %.2f | señal: %s",
                    esperada[:16], ultima["cierre"], self.cfg.estrategia.ema_rapida, ultima["ema_rapida"],
                    self.cfg.estrategia.ema_lenta, ultima["ema_lenta"], senal or "ninguna",
                )
                if senal == COMPRAR and not self.estado.en_posicion and not self.estado.apagado:
                    self._comprar("cruce alcista de EMAs", ahora)
                elif senal == VENDER and self.estado.en_posicion:
                    self._vender("cruce bajista de EMAs", ahora)
                self.estado.ultima_vela_procesada = esperada
            # Si la vela aún no aparece en los datos, se vuelve a intentar en la próxima vuelta.

        # 4) Regla del x2 y freno de drawdown
        precio = self.broker.precio() if self.estado.en_posicion else precio
        apartado = self.gestor.revisar_objetivo(self.estado, precio)
        if apartado:
            self._avisar(
                f"🎯 ¡Objetivo x{self.cfg.riesgo.objetivo_multiplicador:g} conseguido! Se apartan {apartado:.2f} € "
                "(el bot ya no los usará). En modo real, retíralos tú desde Binance si quieres."
            )
        motivo = self.gestor.revisar_drawdown(self.estado, precio)
        if motivo:
            self._avisar(f"🛑 BOT APAGADO: {motivo}. Revisa qué ha pasado antes de volver a encenderlo.", "error")

        # 5) Guardar
        self.estado.guardar(self.ruta_estado)

    def bucle(self) -> None:
        e = self.cfg.estrategia
        self._avisar(
            f"Bot arrancado en modo {self.modo.upper()} · {self.broker.simbolo} {self.cfg.mercado.temporalidad} · "
            f"EMA {e.ema_rapida}/{e.ema_lenta}" + (f" + filtro {e.ema_filtro}" if e.ema_filtro else "")
            + f" · capital del bot {self.estado.capital_total(self.broker.precio()):.2f}"
        )
        errores_seguidos = 0
        while True:
            try:
                self.paso()
                errores_seguidos = 0
            except KeyboardInterrupt:
                raise
            except Exception as e:  # un error de red no debe matar el bot
                errores_seguidos += 1
                self.log.exception("Error en la vuelta del bucle: %s", e)
                if errores_seguidos in (3, 30, 300):
                    self.aviso.enviar(f"⚠️ {errores_seguidos} errores seguidos. Último: {e}")
            time.sleep(self.cfg.ejecucion.intervalo_revision_segundos)

    def resumen(self) -> str:
        """Texto con el estado actual de la cuenta del bot."""
        s = self.estado
        precio = self.broker.precio()
        lineas = [f"Modo: {self.modo}  ·  Par: {self.broker.simbolo}  ·  Precio actual: {precio:,.2f}",
                  f"EUR libres: {s.eur:.2f}  ·  BTC: {s.btc:.8f}  ·  Apartado (x2): {s.apartado_eur:.2f}",
                  f"Valor total: {s.capital_total(precio):.2f}  (empezó con {self.cfg.riesgo.capital_inicial:.2f})"]
        if s.en_posicion:
            latente = s.btc * precio - (s.coste_entrada_eur or 0)
            lineas.append(f"Posición abierta desde {s.fecha_entrada[:16]} a {s.precio_entrada:,.2f} · stop {s.precio_stop:,.2f}"
                          f" · resultado si vendiera ahora: {latente:+.2f}")
        else:
            lineas.append("Sin posición abierta (esperando señal de compra).")
        if s.pausa_hasta:
            lineas.append(f"Pausa por racha perdedora hasta: {s.pausa_hasta[:16]}")
        if s.apagado:
            lineas.append(f"⚠️ APAGADO: {s.motivo_apagado}")
        lineas.append(f"Última vela procesada: {s.ultima_vela_procesada or 'ninguna'}")
        if s.historial:
            lineas.append("Últimas operaciones:\n  " + "\n  ".join(s.historial[-10:]))
        return "\n".join(lineas)
