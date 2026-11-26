"""¿Qué está pensando el bot? Traduce los números a frases para entender cada decisión.

Lo usan el panel web y el comando `estado`, para que en todo momento sepas:
  - si el mercado está en tendencia alcista o bajista,
  - qué tendría que pasar para que el bot compre (o venda),
  - a qué distancia está el stop-loss.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from .config import Config
from .cuenta import EstadoCuenta
from .estrategia import COMPRAR, VENDER


@dataclass
class Diagnostico:
    precio: float
    ema_rapida: float
    ema_lenta: float
    ema_filtro: float | None
    rapida_sobre_lenta: bool
    sobre_filtro: bool
    senal_ultima_vela: str
    fecha_vela: str
    titular: str                       # resumen en una frase
    detalles: list[str] = field(default_factory=list)
    tono: str = "neutral"              # "bueno", "malo", "neutral" (para colorear)


def _n(x: float) -> str:
    """55498.3 -> '55.498' (formato español)."""
    return f"{x:,.0f}".replace(",", ".")


def _p(x: float) -> str:
    return f"{x:.2f}".replace(".", ",")


def _pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def diagnosticar(t: pd.DataFrame, cfg: Config, estado: EstadoCuenta | None = None, precio: float | None = None) -> Diagnostico:
    """`t` son las velas con indicadores (salida de calcular_senales)."""
    e = cfg.estrategia
    u = t.iloc[-1]
    precio = precio or float(u["cierre"])
    filtro = float(u["ema_filtro"]) if e.ema_filtro and pd.notna(u["ema_filtro"]) else None
    rapida_sobre = bool(u["ema_rapida"] > u["ema_lenta"])
    sobre_filtro = filtro is None or precio > filtro
    distancia_medias = _pct(u["ema_rapida"], u["ema_lenta"])
    detalles = []

    detalles.append(
        f"EMA {e.ema_rapida} ({_n(u['ema_rapida'])}) está {'POR ENCIMA' if rapida_sobre else 'POR DEBAJO'} "
        f"de la EMA {e.ema_lenta} ({_n(u['ema_lenta'])}), a un {_p(abs(distancia_medias))} %."
    )
    if filtro is not None:
        detalles.append(
            f"El precio ({_n(precio)}) está {'por encima' if sobre_filtro else 'por debajo'} de la EMA {e.ema_filtro} "
            f"({_n(filtro)}): el mercado de fondo es {'ALCISTA' if sobre_filtro else 'BAJISTA'}."
        )

    en_posicion = bool(estado and estado.en_posicion)
    tono = "neutral"
    if en_posicion:
        stop = estado.precio_stop
        resultado = estado.btc * precio - (estado.coste_entrada_eur or 0)
        titular = f"Tiene BTC comprado. Resultado si vendiera ahora: {('' if resultado < 0 else '+') + _p(resultado)} €."
        tono = "bueno" if resultado >= 0 else "malo"
        if precio > stop:
            detalles.append(f"Compró a {_n(estado.precio_entrada)}. El stop-loss está en {_n(stop)}, "
                            f"un {_p(_pct(precio, stop))} % por debajo del precio actual.")
        else:
            detalles.append(f"Compró a {_n(estado.precio_entrada)}. ⚠️ El precio ya está por debajo del stop-loss "
                            f"({_n(stop)}): venderá en la próxima revisión (si el bot está encendido).")
        detalles.append(f"Venderá si la EMA {e.ema_rapida} cruza por debajo de la EMA {e.ema_lenta} "
                        f"(ahora están separadas un {'+' if distancia_medias >= 0 else '−'}{_p(abs(distancia_medias))} %) o si el precio toca el stop.")
    elif estado and estado.apagado:
        titular = "Bot APAGADO por el freno de drawdown."
        tono = "malo"
        detalles.append(estado.motivo_apagado)
    elif rapida_sobre and sobre_filtro:
        titular = "Tendencia alcista en marcha, pero el cruce ya pasó: espera al siguiente."
        detalles.append("El bot no compra a mitad de una subida; solo en el momento del cruce. "
                        "Así evita entrar tarde, cuando la subida puede estar acabando.")
    elif not sobre_filtro:
        titular = "Mercado de fondo bajista: el bot no comprará aunque haya cruces."
        tono = "malo"
        detalles.append(f"Primero el precio tiene que volver por encima de la EMA {e.ema_filtro}.")
    else:
        titular = "Esperando señal de compra."
        detalles.append(f"Comprará cuando la EMA {e.ema_rapida} cruce por encima de la EMA {e.ema_lenta} "
                        f"(ahora le falta un {_p(abs(distancia_medias))} %).")

    if estado and estado.pausa_hasta and not en_posicion:
        detalles.append(f"En pausa por racha perdedora hasta {estado.pausa_hasta[:16]} UTC.")

    senal = u["senal"]
    if senal == COMPRAR:
        titular = "¡Señal de COMPRA en la última vela cerrada!"
        tono = "bueno"
    elif senal == VENDER and en_posicion:
        titular = "¡Señal de VENTA en la última vela cerrada!"
        tono = "malo"

    return Diagnostico(precio, float(u["ema_rapida"]), float(u["ema_lenta"]), filtro, rapida_sobre, sobre_filtro,
                       senal, t.index[-1].isoformat(), titular, detalles, tono)
