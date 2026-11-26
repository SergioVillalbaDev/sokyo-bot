"""GESTIÓN DEL RIESGO: la parte más importante del bot.

Una estrategia decide CUÁNDO entrar. La gestión del riesgo decide CUÁNTO meter
y CUÁNDO PARAR. Los traders que sobreviven no son los que más aciertan, sino
los que pierden poco cuando fallan.

Reglas que aplica este módulo (todas configurables en config.yaml):
  1. Tamaño de posición por riesgo: si el stop-loss salta, pierdes como mucho
     `riesgo_por_operacion_pct` del capital.
  2. Stop-loss: venta automática si el precio cae `stop_loss_pct` desde la compra.
  3. Pérdida máxima diaria: si hoy ya has perdido demasiado, no se abre nada más.
  4. Racha perdedora: tras varias pérdidas seguidas, pausa obligatoria.
  5. Drawdown máximo: si el capital cae demasiado, el bot se apaga solo.
  6. Tu regla del x2: al duplicar, se apartan los euros iniciales.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from .config import Riesgo
from .cuenta import EstadoCuenta


def _fecha(iso: str) -> datetime:
    return datetime.fromisoformat(iso)


class GestorRiesgo:
    def __init__(self, cfg: Riesgo):
        self.cfg = cfg

    # ---------- ¿Cuánto comprar? ----------
    def tamano_compra_eur(self, estado: EstadoCuenta) -> float:
        """EUR a gastar en la próxima compra (0 si no llega al mínimo).

        Ejemplo con 20 €, riesgo 2 % y stop 5 %:
          riesgo máximo = 20 × 2 % = 0,40 €
          para que una caída del 5 % cueste 0,40 €, la posición debe ser 0,40 / 5 % = 8 €
        """
        capital = estado.eur
        por_riesgo = capital * (self.cfg.riesgo_por_operacion_pct / 100) / (self.cfg.stop_loss_pct / 100)
        por_tope = capital * self.cfg.max_posicion_pct / 100
        eur = min(por_riesgo, por_tope, capital)
        eur = int(eur * 100) / 100  # redondear hacia abajo al céntimo
        return eur if eur >= self.cfg.orden_minima_eur else 0.0

    def precio_stop(self, precio_entrada: float) -> float:
        return precio_entrada * (1 - self.cfg.stop_loss_pct / 100)

    def stop_alcanzado(self, estado: EstadoCuenta, precio_minimo: float) -> bool:
        return estado.en_posicion and estado.precio_stop is not None and precio_minimo <= estado.precio_stop

    # ---------- ¿Se puede abrir una operación nueva? ----------
    def nuevo_dia(self, estado: EstadoCuenta, ahora: datetime, precio: float) -> None:
        """Al cambiar de día se reinicia el contador de pérdida diaria."""
        hoy = ahora.date().isoformat()
        if estado.dia_actual != hoy:
            estado.dia_actual = hoy
            estado.capital_inicio_dia = estado.capital_operable(precio)
            estado.pnl_dia_eur = 0.0

    def puede_abrir(self, estado: EstadoCuenta, ahora: datetime) -> tuple[bool, str]:
        if estado.apagado:
            return False, f"bot apagado: {estado.motivo_apagado}"
        if estado.pausa_hasta and ahora < _fecha(estado.pausa_hasta):
            return False, f"en pausa por racha perdedora hasta {estado.pausa_hasta}"
        if estado.capital_inicio_dia:
            limite = estado.capital_inicio_dia * self.cfg.perdida_maxima_diaria_pct / 100
            if -estado.pnl_dia_eur >= limite:
                return False, f"pérdida máxima diaria alcanzada ({estado.pnl_dia_eur:.2f} €)"
        return True, ""

    # ---------- Después de cerrar una operación ----------
    def registrar_cierre(self, estado: EstadoCuenta, pnl_eur: float, ahora: datetime) -> list[str]:
        """Actualiza los frenos de emergencia. Devuelve avisos para mostrar."""
        avisos = []
        estado.pnl_dia_eur += pnl_eur
        if pnl_eur < 0:
            estado.racha_perdedora += 1
            if estado.racha_perdedora >= self.cfg.racha_perdedora_maxima:
                hasta = ahora + timedelta(hours=self.cfg.horas_de_pausa)
                estado.pausa_hasta = hasta.isoformat()
                estado.racha_perdedora = 0
                avisos.append(
                    f"{self.cfg.racha_perdedora_maxima} pérdidas seguidas: pausa de "
                    f"{self.cfg.horas_de_pausa:g} h (hasta {hasta:%Y-%m-%d %H:%M} UTC)"
                )
        else:
            estado.racha_perdedora = 0
        return avisos

    def revisar_drawdown(self, estado: EstadoCuenta, precio: float) -> str | None:
        """Apaga el bot si el capital total ha caído demasiado desde el inicio."""
        minimo = self.cfg.capital_inicial * (1 - self.cfg.drawdown_maximo_pct / 100)
        total = estado.capital_total(precio)
        if not estado.apagado and total <= minimo:
            estado.apagado = True
            estado.motivo_apagado = (
                f"el capital ({total:.2f} €) cayó un {self.cfg.drawdown_maximo_pct:g} % o más "
                f"desde el inicio ({self.cfg.capital_inicial:.2f} €)"
            )
            return estado.motivo_apagado
        return None

    def revisar_objetivo(self, estado: EstadoCuenta, precio: float) -> float:
        """Tu regla: al llegar a capital_inicial × objetivo, aparta el capital inicial.

        Solo aparta EUR que estén libres (sin posición abierta). Devuelve lo apartado.
        """
        if estado.objetivo_cumplido or estado.en_posicion:
            return 0.0
        objetivo = self.cfg.capital_inicial * self.cfg.objetivo_multiplicador
        if estado.capital_operable(precio) >= objetivo and estado.eur >= self.cfg.capital_inicial:
            estado.eur -= self.cfg.capital_inicial
            estado.apartado_eur += self.cfg.capital_inicial
            estado.objetivo_cumplido = True
            return self.cfg.capital_inicial
        return 0.0
