from datetime import timedelta

import pandas as pd

import bot.registro as registro
import bot.trader as trader_mod
from bot.cuenta import simular_compra, simular_venta
from bot.registro import Notificador
from bot.trader import Trader
from conftest import hacer_velas


class BrokerFalso:
    """Broker de mentira: el test decide qué velas y qué precio ve el bot."""
    simbolo = "BTC/EUR"

    def __init__(self, cfg, velas):
        self.cfg, self.todas, self.n, self.precio_fijo = cfg, velas, 0, None

    def velas(self, cantidad):
        return self.todas.iloc[: self.n]

    def precio(self):
        return self.precio_fijo or float(self.todas["cierre"].iloc[self.n - 1])

    def comprar(self, eur, motivo):
        return simular_compra(eur, self.precio(), self.cfg.costes, "2024-01-01T00:00:00+00:00", motivo)

    def vender(self, btc, motivo):
        return simular_venta(btc, self.precio(), self.cfg.costes, "2024-01-01T00:00:00+00:00", motivo)


def preparar(tmp_path, monkeypatch, cfg, precios):
    monkeypatch.setattr(trader_mod, "CARPETA_ESTADO", tmp_path / "estado")
    monkeypatch.setattr(registro, "CARPETA", tmp_path / "resultados")
    broker = BrokerFalso(cfg, hacer_velas(precios))
    t = Trader(cfg, broker, "simular", Notificador("simular"))
    return t, broker


def avanzar(t, broker, n):
    """Simula que han cerrado n velas y el bot hace una revisión."""
    broker.n = n
    ahora = broker.todas.index[n - 1] + pd.Timedelta(hours=4, minutes=1)
    t.paso(ahora.to_pydatetime())


def test_compra_con_cruce_y_vende_con_stop(tmp_path, monkeypatch, cfg):
    precios = [100] * 10 + list(range(101, 125))
    t, broker = preparar(tmp_path, monkeypatch, cfg, precios)
    compro_en = None
    for n in range(8, len(precios) + 1):
        avanzar(t, broker, n)
        if t.estado.en_posicion:
            compro_en = n
            break
    assert compro_en is not None
    assert (tmp_path / "estado" / "simular.json").exists()
    assert (tmp_path / "resultados" / "operaciones_simular.csv").exists()

    # El precio se desploma por debajo del stop entre dos velas
    broker.precio_fijo = t.estado.precio_stop * 0.99
    ahora = broker.todas.index[compro_en - 1] + pd.Timedelta(hours=4, minutes=2)
    t.paso(ahora.to_pydatetime())
    assert not t.estado.en_posicion
    assert t.estado.racha_perdedora == 1


def test_no_procesa_dos_veces_la_misma_vela(tmp_path, monkeypatch, cfg):
    precios = [100] * 10 + list(range(101, 125))
    t, broker = preparar(tmp_path, monkeypatch, cfg, precios)
    for n in range(8, len(precios) + 1):
        avanzar(t, broker, n)
        if t.estado.en_posicion:
            break
    compras = sum(1 for h in t.estado.historial if "compra" in h)
    ahora = broker.todas.index[broker.n - 1] + pd.Timedelta(hours=4, minutes=30)
    t.paso(ahora.to_pydatetime())
    assert sum(1 for h in t.estado.historial if "compra" in h) == compras == 1


def test_el_estado_se_recupera_al_reiniciar(tmp_path, monkeypatch, cfg):
    precios = [100] * 10 + list(range(101, 125))
    t, broker = preparar(tmp_path, monkeypatch, cfg, precios)
    for n in range(8, len(precios) + 1):
        avanzar(t, broker, n)
    otro = Trader(cfg, broker, "simular", Notificador("simular"))
    assert otro.estado == t.estado


def test_espera_si_la_vela_aun_no_esta_en_los_datos(tmp_path, monkeypatch, cfg):
    precios = [100] * 20
    t, broker = preparar(tmp_path, monkeypatch, cfg, precios)
    broker.n = 10
    ahora = broker.todas.index[10] + pd.Timedelta(hours=4, minutes=1)  # espera la vela 11, solo hay 10
    t.paso(ahora.to_pydatetime())
    assert t.estado.ultima_vela_procesada is None
    _ = timedelta
