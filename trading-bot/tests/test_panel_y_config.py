import shutil

import numpy as np
import pytest

from bot.analisis import diagnosticar
from bot.config import RAIZ, cargar_config, guardar_cambios
from bot.cuenta import EstadoCuenta
from bot.estrategia import calcular_senales
from conftest import hacer_velas


def test_guardar_cambios_conserva_comentarios(tmp_path):
    ruta = tmp_path / "config.yaml"
    shutil.copy(RAIZ / "config.yaml", ruta)
    guardar_cambios({"estrategia": {"ema_rapida": 15}, "backtest": {"desde": "2021-01-01"}}, ruta)
    texto = ruta.read_text(encoding="utf-8")
    assert "# Cruce de medias móviles exponenciales" in texto
    cfg = cargar_config(ruta)
    assert cfg.estrategia.ema_rapida == 15 and cfg.backtest.desde == "2021-01-01"


def test_guardar_cambios_rechaza_valores_invalidos(tmp_path):
    ruta = tmp_path / "config.yaml"
    shutil.copy(RAIZ / "config.yaml", ruta)
    antes = ruta.read_text(encoding="utf-8")
    with pytest.raises(ValueError):
        guardar_cambios({"estrategia": {"ema_rapida": 500}}, ruta)
    assert ruta.read_text(encoding="utf-8") == antes  # no se toca el archivo


def test_diagnostico_esperando_y_en_posicion(cfg):
    precios = list(np.linspace(100, 80, 30))
    t = calcular_senales(hacer_velas(precios), cfg.estrategia)
    d = diagnosticar(t, cfg, EstadoCuenta(eur=1000))
    assert "Esperando" in d.titular and not d.rapida_sobre_lenta

    estado = EstadoCuenta(eur=900, btc=1, precio_entrada=85, precio_stop=80.75, coste_entrada_eur=85)
    d = diagnosticar(t, cfg, estado, precio=79)
    assert "Tiene BTC" in d.titular and d.tono == "malo"
    assert any("por debajo del stop-loss" in x for x in d.detalles)
