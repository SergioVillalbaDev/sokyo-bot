"""Indicadores técnicos: fórmulas que resumen el precio para tomar decisiones.

MEDIA MÓVIL EXPONENCIAL (EMA)
  Es el precio "medio" de las últimas N velas, pero dando más peso a las más
  recientes. Suaviza el ruido y deja ver hacia dónde va el precio.
    - EMA corta (p. ej. 20): reacciona rápido a los cambios.
    - EMA larga (p. ej. 50 o 200): se mueve despacio, marca la tendencia de fondo.
  Fórmula: EMA_hoy = precio_hoy × k + EMA_ayer × (1 − k),  con k = 2 / (N + 1)
"""
from __future__ import annotations

import pandas as pd


def ema(precios: pd.Series, periodo: int) -> pd.Series:
    """Media móvil exponencial de `periodo` velas.

    Las primeras `periodo - 1` velas quedan vacías (NaN): con menos datos la media
    no es fiable y la estrategia no debe usarla.
    """
    if periodo <= 0:
        raise ValueError("El periodo de la EMA debe ser positivo")
    return precios.ewm(span=periodo, adjust=False, min_periods=periodo).mean()
