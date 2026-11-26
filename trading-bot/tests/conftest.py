import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot.config import Config  # noqa: E402


def hacer_velas(cierres, inicio="2024-01-01", freq="4h", rango=0.002):
    """Velas sintéticas: apertura = cierre anterior, máximo/mínimo un poco por encima/debajo."""
    cierres = np.asarray(cierres, dtype=float)
    aperturas = np.concatenate([[cierres[0]], cierres[:-1]])
    idx = pd.date_range(inicio, periods=len(cierres), freq=freq, tz="UTC", name="fecha")
    return pd.DataFrame({
        "apertura": aperturas,
        "maximo": np.maximum(aperturas, cierres) * (1 + rango),
        "minimo": np.minimum(aperturas, cierres) * (1 - rango),
        "cierre": cierres,
        "volumen": 1.0,
    }, index=idx)


@pytest.fixture
def cfg():
    c = Config()
    c.estrategia.ema_rapida, c.estrategia.ema_lenta, c.estrategia.ema_filtro = 3, 6, 0
    c.riesgo.capital_inicial = 1000
    c.riesgo.orden_minima_eur = 5
    return c
