import numpy as np
import pandas as pd

from bot.backtest import con_cambios, ejecutar_backtest, maximo_drawdown_pct
from conftest import hacer_velas


def test_compra_en_la_apertura_siguiente(cfg):
    precios = [100] * 10 + list(range(101, 131)) + list(range(129, 100, -1))
    v = hacer_velas(precios)
    r = ejecutar_backtest(v, cfg)
    compra = r.operaciones[0]
    vela_senal = r.velas.index[r.velas["senal"] == "comprar"][0]
    siguiente = r.velas.index[r.velas.index.get_loc(vela_senal) + 1]
    assert compra.tipo == "compra" and pd.Timestamp(compra.fecha) == siguiente
    assert compra.precio > v.loc[siguiente, "apertura"]  # slippage en contra


def test_stop_loss_con_hueco_vende_a_la_apertura(cfg):
    precios = [100] * 10 + [101, 102, 103, 104, 105, 106, 107] + [80, 80, 80]
    r = ejecutar_backtest(hacer_velas(precios), cfg)
    ventas = [o for o in r.operaciones if o.tipo == "venta"]
    assert ventas and ventas[0].motivo == "stop-loss"
    assert ventas[0].precio < 0.95 * r.operaciones[0].precio  # peor que el stop por el hueco


def test_los_costes_restan(cfg):
    rng = np.random.default_rng(7)
    v = hacer_velas(100 * np.exp(np.cumsum(rng.normal(0, 0.02, 1500))))
    con = ejecutar_backtest(v, cfg).metricas["capital_final"]
    sin = ejecutar_backtest(v, con_cambios(cfg, costes={"comision_pct": 0, "slippage_pct": 0})).metricas["capital_final"]
    assert sin > con


def test_resultado_no_depende_del_futuro(cfg):
    rng = np.random.default_rng(3)
    precios = 100 * np.exp(np.cumsum(rng.normal(0, 0.02, 1200)))
    completo = ejecutar_backtest(hacer_velas(precios), cfg)
    parcial = ejecutar_backtest(hacer_velas(precios[:700]), cfg)
    assert np.allclose(completo.curva.iloc[:699], parcial.curva.iloc[:699])


def test_drawdown():
    assert maximo_drawdown_pct(pd.Series([100, 120, 60, 130])) == 50.0
    assert maximo_drawdown_pct(pd.Series([1, 2, 3])) == 0.0
