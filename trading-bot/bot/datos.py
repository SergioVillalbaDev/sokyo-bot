"""Descarga y guarda el historial de precios (las "velas").

Una VELA resume el precio durante un periodo (por ejemplo, 4 horas) con 5 números:
  - apertura: precio al empezar el periodo
  - maximo:   precio más alto alcanzado
  - minimo:   precio más bajo alcanzado
  - cierre:   precio al terminar el periodo
  - volumen:  cuánto BTC se compró y vendió en ese periodo

Los datos vienen de la API pública de Binance (data-api.binance.vision). Es gratis,
no necesita cuenta ni claves, y solo sirve para LEER precios, no para operar.
"""
from __future__ import annotations

import time
from pathlib import Path

import pandas as pd
import requests

from .config import RAIZ

URL_VELAS = "https://data-api.binance.vision/api/v3/klines"
CARPETA_DATOS = RAIZ / "datos"
COLUMNAS = ["apertura", "maximo", "minimo", "cierre", "volumen"]

# Duración de cada temporalidad en milisegundos
DURACION_MS = {
    "15m": 15 * 60_000,
    "1h": 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    "1d": 24 * 60 * 60_000,
}


def duracion_ms(temporalidad: str) -> int:
    if temporalidad not in DURACION_MS:
        raise ValueError(f"Temporalidad no soportada: {temporalidad}. Usa una de {list(DURACION_MS)}")
    return DURACION_MS[temporalidad]


def _simbolo_binance(simbolo: str) -> str:
    """'BTC/EUR' -> 'BTCEUR' (Binance escribe los pares sin barra)."""
    return simbolo.replace("/", "").upper()


def _a_tabla(filas: list) -> pd.DataFrame:
    """Convierte la respuesta de Binance en una tabla con columnas en español."""
    if not filas:
        return pd.DataFrame(columns=COLUMNAS, index=pd.DatetimeIndex([], tz="UTC", name="fecha"))
    tabla = pd.DataFrame(
        [[f[0], f[1], f[2], f[3], f[4], f[5]] for f in filas],
        columns=["fecha"] + COLUMNAS,
    )
    tabla["fecha"] = pd.to_datetime(tabla["fecha"], unit="ms", utc=True)
    tabla = tabla.set_index("fecha").astype(float)
    return tabla[~tabla.index.duplicated(keep="last")].sort_index()


def descargar_velas(simbolo: str, temporalidad: str, desde_ms: int, hasta_ms: int | None = None) -> pd.DataFrame:
    """Descarga velas por tandas de 1000 (el máximo que da Binance por petición)."""
    paso = duracion_ms(temporalidad)
    hasta_ms = hasta_ms or int(time.time() * 1000)
    filas: list = []
    inicio = desde_ms
    while inicio < hasta_ms:
        params = {
            "symbol": _simbolo_binance(simbolo),
            "interval": temporalidad,
            "startTime": inicio,
            "endTime": hasta_ms,
            "limit": 1000,
        }
        for intento in range(4):
            try:
                r = requests.get(URL_VELAS, params=params, timeout=20)
                r.raise_for_status()
                lote = r.json()
                break
            except requests.RequestException:
                if intento == 3:
                    raise
                time.sleep(2 ** intento)
        if not lote:
            break
        filas.extend(lote)
        inicio = lote[-1][0] + paso
        time.sleep(0.2)  # no saturar la API
    return _a_tabla(filas)


def quitar_vela_abierta(tabla: pd.DataFrame, temporalidad: str, ahora_ms: int | None = None) -> pd.DataFrame:
    """Quita la última vela si todavía no ha cerrado.

    Muy importante: una vela abierta cambia hasta que cierra. Si el bot decidiera con
    ella, podría ver una señal que luego desaparece.
    """
    if tabla.empty:
        return tabla
    ahora_ms = ahora_ms or int(time.time() * 1000)
    inicio_ultima = int(tabla.index[-1].timestamp() * 1000)
    if inicio_ultima + duracion_ms(temporalidad) > ahora_ms:
        return tabla.iloc[:-1]
    return tabla


def ruta_cache(simbolo: str, temporalidad: str) -> Path:
    return CARPETA_DATOS / f"{_simbolo_binance(simbolo)}_{temporalidad}.csv"


def leer_cache(simbolo: str, temporalidad: str) -> pd.DataFrame | None:
    ruta = ruta_cache(simbolo, temporalidad)
    if not ruta.exists():
        return None
    tabla = pd.read_csv(ruta, index_col="fecha", parse_dates=["fecha"])
    if tabla.index.tz is None:
        tabla.index = tabla.index.tz_localize("UTC")
    return tabla


def obtener_historial(simbolo: str, temporalidad: str, desde: str, actualizar: bool = True) -> pd.DataFrame:
    """Devuelve el historial desde una fecha, usando la copia guardada en datos/ si existe.

    Solo descarga lo que falta, así la segunda vez es casi instantáneo.
    """
    desde_ms = int(pd.Timestamp(desde, tz="UTC").timestamp() * 1000)
    guardado = leer_cache(simbolo, temporalidad)
    if guardado is not None and not guardado.empty and guardado.index[0].timestamp() * 1000 <= desde_ms + duracion_ms("1d"):
        tabla = guardado
        if actualizar:
            siguiente = int(guardado.index[-1].timestamp() * 1000) + duracion_ms(temporalidad)
            nuevo = descargar_velas(simbolo, temporalidad, siguiente)
            if not nuevo.empty:
                tabla = pd.concat([guardado, nuevo])
                tabla = tabla[~tabla.index.duplicated(keep="last")].sort_index()
    else:
        tabla = descargar_velas(simbolo, temporalidad, desde_ms)

    tabla = quitar_vela_abierta(tabla, temporalidad)
    CARPETA_DATOS.mkdir(parents=True, exist_ok=True)
    tabla.to_csv(ruta_cache(simbolo, temporalidad), index_label="fecha")
    return tabla[tabla.index >= pd.Timestamp(desde, tz="UTC")]


def velas_recientes(simbolo: str, temporalidad: str, cantidad: int = 400) -> pd.DataFrame:
    """Las últimas velas CERRADAS. Lo usa el bot en directo para decidir."""
    ahora = int(time.time() * 1000)
    desde = ahora - (cantidad + 2) * duracion_ms(temporalidad)
    return quitar_vela_abierta(descargar_velas(simbolo, temporalidad, desde, ahora), temporalidad, ahora)


def precio_actual(simbolo: str) -> float:
    """Último precio negociado (público, sin cuenta)."""
    r = requests.get(
        "https://data-api.binance.vision/api/v3/ticker/price",
        params={"symbol": _simbolo_binance(simbolo)},
        timeout=10,
    )
    r.raise_for_status()
    return float(r.json()["price"])
