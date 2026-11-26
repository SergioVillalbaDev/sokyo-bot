import numpy as np
import pandas as pd

from bot.estrategia import COMPRAR, VENDER, calcular_senales
from bot.indicadores import ema
from conftest import hacer_velas


def test_ema_formula():
    s = pd.Series([1, 2, 3, 4, 5], dtype=float)
    r = ema(s, 3)
    assert r.iloc[:2].isna().all()  # sin datos suficientes
    k = 2 / 4
    esperado = [1.0]
    for x in [2, 3, 4, 5]:
        esperado.append(x * k + esperado[-1] * (1 - k))
    assert np.allclose(r.iloc[2:], esperado[2:])


def test_cruce_alcista_y_bajista(cfg):
    precios = [100] * 10 + list(range(101, 121)) + list(range(119, 90, -1))
    t = calcular_senales(hacer_velas(precios), cfg.estrategia)
    senales = [s for s in t["senal"] if s]
    assert senales == [COMPRAR, VENDER]
    assert t.index[t["senal"] == COMPRAR][0] < t.index[t["senal"] == VENDER][0]


def test_filtro_de_tendencia_bloquea_compras_en_mercado_bajista(cfg):
    precios = list(np.linspace(200, 100, 80)) + [101, 103, 106, 110, 108, 104, 100, 97]
    cfg.estrategia.ema_filtro = 50
    t = calcular_senales(hacer_velas(precios), cfg.estrategia)
    assert COMPRAR not in set(t["senal"])


def test_sin_mirar_al_futuro(cfg):
    """La señal de una vela no puede cambiar al añadir velas posteriores."""
    rng = np.random.default_rng(1)
    precios = 100 * np.exp(np.cumsum(rng.normal(0, 0.02, 400)))
    completa = calcular_senales(hacer_velas(precios), cfg.estrategia)
    for corte in (100, 250, 399):
        parcial = calcular_senales(hacer_velas(precios[:corte]), cfg.estrategia)
        assert (parcial["senal"] == completa["senal"].iloc[:corte]).all()
