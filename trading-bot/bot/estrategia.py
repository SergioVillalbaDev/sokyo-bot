"""La ESTRATEGIA: las reglas que dicen cuándo comprar y cuándo vender.

Regla de COMPRA (las dos a la vez, en una vela ya cerrada):
  1. La EMA rápida cruza POR ENCIMA de la EMA lenta  -> empieza a subir.
  2. (Si ema_filtro > 0) El precio está por encima de la EMA de filtro
     -> el mercado de fondo es alcista. Evita comprar en mitad de una caída larga.

Regla de VENTA:
  - La EMA rápida cruza POR DEBAJO de la EMA lenta -> la subida se ha acabado.
  - O salta el stop-loss (eso lo vigila el gestor de riesgo, no esta función).

Esta misma función la usan el backtest y el bot en directo. Así lo que pruebas
con datos antiguos es EXACTAMENTE lo que luego opera.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import Estrategia
from .indicadores import ema

COMPRAR = "comprar"
VENDER = "vender"
NADA = ""


def calcular_senales(velas: pd.DataFrame, cfg: Estrategia) -> pd.DataFrame:
    """Añade a la tabla de velas los indicadores y una columna `senal`.

    La señal de cada fila usa SOLO el cierre de esa vela y las anteriores
    (nunca datos del futuro). Se ejecuta en la vela siguiente.
    """
    t = velas.copy()
    t["ema_rapida"] = ema(t["cierre"], cfg.ema_rapida)
    t["ema_lenta"] = ema(t["cierre"], cfg.ema_lenta)

    por_encima = t["ema_rapida"] > t["ema_lenta"]
    antes_por_encima = por_encima.shift(1, fill_value=False)
    datos_listos = t["ema_lenta"].notna() & t["ema_lenta"].shift(1).notna()

    cruce_arriba = por_encima & ~antes_por_encima & datos_listos
    cruce_abajo = ~por_encima & antes_por_encima & datos_listos

    if cfg.ema_filtro > 0:
        t["ema_filtro"] = ema(t["cierre"], cfg.ema_filtro)
        tendencia_ok = t["cierre"] > t["ema_filtro"]
    else:
        t["ema_filtro"] = np.nan
        tendencia_ok = pd.Series(True, index=t.index)

    t["senal"] = np.where(cruce_arriba & tendencia_ok, COMPRAR, np.where(cruce_abajo, VENDER, NADA))
    # ¿Está la tendencia a favor ahora mismo? (útil para explicar decisiones)
    t["tendencia_alcista"] = por_encima & tendencia_ok
    return t


def velas_necesarias(cfg: Estrategia) -> int:
    """Cuántas velas hacen falta para que todos los indicadores estén listos."""
    return max(cfg.ema_lenta, cfg.ema_filtro) + 5
