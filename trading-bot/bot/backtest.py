"""BACKTEST: probar la estrategia con datos del pasado.

Es como una "máquina del tiempo": el bot recorre las velas antiguas una a una,
como si fueran llegando en directo, y decide igual que lo haría hoy. Al final
sabes cuánto habría ganado o perdido, cuántas veces acertó y lo peor que lo pasó.

Reglas para que el backtest sea HONESTO (y no te engañe):
  1. Sin mirar al futuro: la señal se calcula al CIERRE de una vela y la orden
     se ejecuta en la APERTURA de la siguiente. Nunca se usa un precio que el
     bot no habría podido conocer.
  2. Con costes: cada compra y venta paga comisión y slippage.
  3. Stop-loss realista: si el precio abre ya por debajo del stop (un "hueco"),
     se vende al precio de apertura, que es peor que el stop.
  4. Mismas reglas de riesgo que en directo (frenos, regla del x2...).

Aun así: que algo funcionara en el pasado NO garantiza que funcione en el futuro.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field, replace

import numpy as np
import pandas as pd

from .config import Config
from .cuenta import EstadoCuenta, Operacion, aplicar_compra, aplicar_venta, simular_compra, simular_venta
from .estrategia import COMPRAR, VENDER, calcular_senales
from .riesgo import GestorRiesgo


@dataclass
class ResultadoBacktest:
    operaciones: list[Operacion]
    curva: pd.Series            # valor total de la cuenta al cierre de cada vela
    curva_comprar_y_mantener: pd.Series
    velas: pd.DataFrame         # velas con indicadores y señales
    metricas: dict = field(default_factory=dict)
    eventos: list[str] = field(default_factory=list)  # pausas, apagados, regla x2...


def ejecutar_backtest(velas: pd.DataFrame, cfg: Config) -> ResultadoBacktest:
    if len(velas) < 10:
        raise ValueError("No hay suficientes velas para hacer un backtest")
    t = calcular_senales(velas, cfg.estrategia)
    gestor = GestorRiesgo(cfg.riesgo)
    estado = EstadoCuenta(eur=cfg.riesgo.capital_inicial)
    operaciones: list[Operacion] = []
    eventos: list[str] = []
    valores = np.empty(len(t))
    pendiente = ""

    fechas = t.index
    aperturas, minimos, cierres = t["apertura"].to_numpy(), t["minimo"].to_numpy(), t["cierre"].to_numpy()
    senales = t["senal"].to_numpy()

    for i in range(len(t)):
        ahora = fechas[i].to_pydatetime()
        iso = fechas[i].isoformat()
        apertura = aperturas[i]
        gestor.nuevo_dia(estado, ahora, apertura)

        # 1) Ejecutar en la APERTURA la orden decidida al cierre de la vela anterior
        if pendiente == COMPRAR and not estado.en_posicion:
            permitido, motivo = gestor.puede_abrir(estado, ahora)
            eur = gestor.tamano_compra_eur(estado)
            if permitido and eur > 0:
                op = simular_compra(eur, apertura, cfg.costes, iso, "cruce alcista de EMAs")
                aplicar_compra(estado, op, cfg.riesgo.stop_loss_pct)
                operaciones.append(op)
            else:
                eventos.append(f"{iso[:16]}  Compra NO realizada: {motivo or 'capital por debajo de la orden mínima'}")
        elif pendiente == VENDER and estado.en_posicion:
            op = simular_venta(estado.btc, apertura, cfg.costes, iso, "cruce bajista de EMAs")
            _cerrar(estado, op, gestor, ahora, operaciones, eventos)
        pendiente = ""

        # 2) Durante la vela: ¿tocó el precio el stop-loss?
        if gestor.stop_alcanzado(estado, minimos[i]):
            precio_salida = min(apertura, estado.precio_stop)  # si abre por debajo, vende a la apertura
            op = simular_venta(estado.btc, precio_salida, cfg.costes, iso, "stop-loss")
            _cerrar(estado, op, gestor, ahora, operaciones, eventos)

        # 3) Al cierre: regla del x2, freno de drawdown y valor de la cuenta
        apartado = gestor.revisar_objetivo(estado, cierres[i])
        if apartado:
            eventos.append(f"{iso[:16]}  ¡Objetivo x{cfg.riesgo.objetivo_multiplicador:g}! Se apartan {apartado:.2f} €")
        motivo_apagado = gestor.revisar_drawdown(estado, cierres[i])
        if motivo_apagado:
            eventos.append(f"{iso[:16]}  BOT APAGADO: {motivo_apagado}")
        valores[i] = estado.capital_total(cierres[i])

        # 4) Decidir con el cierre de esta vela (se ejecutará en la siguiente)
        if senales[i] == COMPRAR and not estado.en_posicion and not estado.apagado:
            pendiente = COMPRAR
        elif senales[i] == VENDER and estado.en_posicion:
            pendiente = VENDER

    curva = pd.Series(valores, index=t.index, name="bot")
    # Comparación: comprar BTC el primer día y no tocarlo ("comprar y mantener")
    coste = cfg.costes.comision_pct / 100 + cfg.costes.slippage_pct / 100
    cym = cfg.riesgo.capital_inicial * (1 - coste) * t["cierre"] / t["apertura"].iloc[0]
    resultado = ResultadoBacktest(operaciones, curva, cym.rename("comprar_y_mantener"), t, eventos=eventos)
    resultado.metricas = calcular_metricas(resultado, cfg, estado)
    return resultado


def _cerrar(estado, op, gestor, ahora, operaciones, eventos):
    pnl = aplicar_venta(estado, op)
    operaciones.append(op)
    for aviso in gestor.registrar_cierre(estado, pnl, ahora):
        eventos.append(f"{op.fecha[:16]}  {aviso}")


def maximo_drawdown_pct(curva: pd.Series) -> float:
    """La mayor caída desde un máximo hasta un mínimo posterior, en %.

    Mide "lo peor que lo habrías pasado". Un drawdown del 30 % significa que en algún
    momento tu cuenta valía un 30 % menos que en su mejor momento anterior.
    """
    if curva.empty:
        return 0.0
    picos = curva.cummax()
    return max(0.0, float(((curva - picos) / picos).min() * -100))


def emparejar_operaciones(operaciones: list[Operacion]) -> list[dict]:
    """Une cada compra con su venta para ver el resultado de cada operación completa."""
    pares, compra = [], None
    for op in operaciones:
        if op.tipo == "compra":
            compra = op
        elif compra is not None:
            pares.append({
                "entrada": compra.fecha, "salida": op.fecha,
                "precio_entrada": compra.precio, "precio_salida": op.precio,
                "invertido_eur": compra.eur, "recibido_eur": op.eur,
                "pnl_eur": op.pnl_eur, "pnl_pct": op.pnl_eur / compra.eur * 100,
                "motivo_salida": op.motivo,
                "duracion_dias": (pd.Timestamp(op.fecha) - pd.Timestamp(compra.fecha)).total_seconds() / 86400,
            })
            compra = None
    return pares


def calcular_metricas(r: ResultadoBacktest, cfg: Config, estado: EstadoCuenta) -> dict:
    inicial = cfg.riesgo.capital_inicial
    final = float(r.curva.iloc[-1])
    anos = max((r.curva.index[-1] - r.curva.index[0]).total_seconds() / (365.25 * 86400), 1e-9)
    pares = emparejar_operaciones(r.operaciones)
    ganadoras = [p for p in pares if p["pnl_eur"] > 0]
    perdedoras = [p for p in pares if p["pnl_eur"] <= 0]
    bruto_ganado = sum(p["pnl_eur"] for p in ganadoras)
    bruto_perdido = -sum(p["pnl_eur"] for p in perdedoras)

    en_mercado = 0.0
    for p in pares:
        en_mercado += (pd.Timestamp(p["salida"]) - pd.Timestamp(p["entrada"])).total_seconds()
    if estado.en_posicion and estado.fecha_entrada:
        en_mercado += (r.curva.index[-1] - pd.Timestamp(estado.fecha_entrada)).total_seconds()
    duracion_total = (r.curva.index[-1] - r.curva.index[0]).total_seconds() or 1

    cym_final = float(r.curva_comprar_y_mantener.iloc[-1])
    anual = r.curva.resample("YE").last()
    inicio_anual = pd.concat([pd.Series([inicial]), anual.iloc[:-1]]).to_numpy()
    rent_anual = {str(f.year): round((v / i - 1) * 100, 2) for f, v, i in zip(anual.index, anual.to_numpy(), inicio_anual)}

    return {
        "desde": r.curva.index[0].strftime("%Y-%m-%d"),
        "hasta": r.curva.index[-1].strftime("%Y-%m-%d"),
        "anos": round(anos, 2),
        "capital_inicial": inicial,
        "capital_final": round(final, 2),
        "apartado_eur": round(estado.apartado_eur, 2),
        "rentabilidad_total_pct": round((final / inicial - 1) * 100, 2),
        "rentabilidad_anual_pct": round(((final / inicial) ** (1 / anos) - 1) * 100, 2) if final > 0 else -100.0,
        "max_drawdown_pct": round(maximo_drawdown_pct(r.curva), 2),
        "operaciones": len(pares),
        "ganadoras": len(ganadoras),
        "perdedoras": len(perdedoras),
        "tasa_acierto_pct": round(len(ganadoras) / len(pares) * 100, 1) if pares else 0.0,
        "ganancia_media_pct": round(float(np.mean([p["pnl_pct"] for p in ganadoras])), 2) if ganadoras else 0.0,
        "perdida_media_pct": round(float(np.mean([p["pnl_pct"] for p in perdedoras])), 2) if perdedoras else 0.0,
        "esperanza_por_operacion_pct": round(float(np.mean([p["pnl_pct"] for p in pares])), 2) if pares else 0.0,
        "factor_beneficio": round(bruto_ganado / bruto_perdido, 2) if bruto_perdido > 0 else None,
        "mejor_operacion_pct": round(max((p["pnl_pct"] for p in pares), default=0.0), 2),
        "peor_operacion_pct": round(min((p["pnl_pct"] for p in pares), default=0.0), 2),
        "tiempo_en_mercado_pct": round(en_mercado / duracion_total * 100, 1),
        "comisiones_pagadas_eur": round(sum(o.comision_eur for o in r.operaciones), 2),
        "posicion_abierta_al_final": estado.en_posicion,
        "comprar_y_mantener_final": round(cym_final, 2),
        "comprar_y_mantener_pct": round((cym_final / inicial - 1) * 100, 2),
        "comprar_y_mantener_max_drawdown_pct": round(maximo_drawdown_pct(r.curva_comprar_y_mantener), 2),
        "rentabilidad_por_ano_pct": rent_anual,
    }


def con_cambios(cfg: Config, **secciones) -> Config:
    """Copia de la configuración cambiando algunos valores. Ej: con_cambios(cfg, estrategia={"ema_rapida": 10})"""
    nuevo = cfg
    for seccion, valores in secciones.items():
        nuevo = replace(nuevo, **{seccion: replace(getattr(nuevo, seccion), **valores)})
    nuevo.validar()
    return nuevo


def prueba_de_robustez(velas: pd.DataFrame, cfg: Config) -> dict:
    """Repite el backtest cambiando los parámetros para ver si el resultado es estable.

    Si solo funciona con unos números exactos (p. ej. EMA 20/50 sí, pero 18/50 o 22/50 no),
    es casi seguro casualidad: se llama SOBREAJUSTE (overfitting). Lo que buscamos es una
    "meseta": que funcione razonablemente bien con muchos valores parecidos.
    """
    rapidas = [10, 15, 20, 25, 30]
    lentas = [40, 50, 60, 80, 100]
    rejilla = {}
    for lenta in lentas:
        for rapida in rapidas:
            if rapida >= lenta:
                continue
            c = con_cambios(cfg, estrategia={"ema_rapida": rapida, "ema_lenta": lenta})
            m = ejecutar_backtest(velas, c).metricas
            rejilla[(rapida, lenta)] = m
    stops = {}
    for stop in [3, 5, 8, 12]:
        c = con_cambios(cfg, riesgo={"stop_loss_pct": stop})
        stops[stop] = ejecutar_backtest(velas, c).metricas
    sin_filtro = ejecutar_backtest(velas, con_cambios(cfg, estrategia={"ema_filtro": 0})).metricas
    costes_dobles = ejecutar_backtest(
        velas,
        con_cambios(cfg, costes={"comision_pct": cfg.costes.comision_pct * 2, "slippage_pct": cfg.costes.slippage_pct * 2}),
    ).metricas
    sin_costes = ejecutar_backtest(velas, con_cambios(cfg, costes={"comision_pct": 0, "slippage_pct": 0})).metricas
    return {"rejilla": rejilla, "rapidas": rapidas, "lentas": lentas, "stops": stops,
            "sin_filtro": sin_filtro, "costes_dobles": costes_dobles, "sin_costes": sin_costes}


def operaciones_a_tabla(operaciones: list[Operacion]) -> pd.DataFrame:
    return pd.DataFrame([asdict(o) for o in operaciones])
