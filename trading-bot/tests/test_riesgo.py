from datetime import datetime, timedelta, timezone

from bot.config import Costes, Riesgo
from bot.cuenta import EstadoCuenta, aplicar_compra, aplicar_venta, simular_compra, simular_venta
from bot.riesgo import GestorRiesgo

T0 = datetime(2025, 1, 1, tzinfo=timezone.utc)


def test_tamano_por_riesgo_con_20_euros():
    g = GestorRiesgo(Riesgo(capital_inicial=20, riesgo_por_operacion_pct=2, stop_loss_pct=5))
    assert g.tamano_compra_eur(EstadoCuenta(eur=20)) == 8.0  # 0,40 € de riesgo / 5 %


def test_orden_minima():
    g = GestorRiesgo(Riesgo(capital_inicial=20, riesgo_por_operacion_pct=1, stop_loss_pct=5, orden_minima_eur=5))
    assert g.tamano_compra_eur(EstadoCuenta(eur=20)) == 0.0  # 4 € < 5 € mínimo


def test_tope_de_posicion():
    g = GestorRiesgo(Riesgo(riesgo_por_operacion_pct=10, stop_loss_pct=2, max_posicion_pct=50))
    assert g.tamano_compra_eur(EstadoCuenta(eur=100)) == 50.0


def test_costes_y_pnl():
    costes = Costes(comision_pct=0.1, slippage_pct=0.0)
    e = EstadoCuenta(eur=100)
    compra = simular_compra(100, 1000, costes, T0.isoformat())
    aplicar_compra(e, compra, stop_pct=5)
    assert e.eur == 0 and abs(e.btc - 0.0999) < 1e-12 and e.precio_stop == 950
    venta = simular_venta(e.btc, 1000, costes, T0.isoformat())
    pnl = aplicar_venta(e, venta)
    assert not e.en_posicion
    assert -0.21 < pnl < -0.19  # mismo precio: solo se pierden las dos comisiones


def test_racha_perdedora_pone_pausa():
    g = GestorRiesgo(Riesgo(racha_perdedora_maxima=2, horas_de_pausa=24))
    e = EstadoCuenta(eur=100)
    g.registrar_cierre(e, -1, T0)
    assert g.puede_abrir(e, T0)[0]
    g.registrar_cierre(e, -1, T0)
    assert not g.puede_abrir(e, T0 + timedelta(hours=23))[0]
    assert g.puede_abrir(e, T0 + timedelta(hours=25))[0]


def test_una_ganancia_reinicia_la_racha():
    g = GestorRiesgo(Riesgo(racha_perdedora_maxima=2))
    e = EstadoCuenta(eur=100)
    g.registrar_cierre(e, -1, T0)
    g.registrar_cierre(e, +1, T0)
    g.registrar_cierre(e, -1, T0)
    assert e.pausa_hasta is None


def test_perdida_maxima_diaria():
    g = GestorRiesgo(Riesgo(perdida_maxima_diaria_pct=4, racha_perdedora_maxima=99))
    e = EstadoCuenta(eur=100)
    g.nuevo_dia(e, T0, 1)
    g.registrar_cierre(e, -4, T0)
    assert not g.puede_abrir(e, T0)[0]
    g.nuevo_dia(e, T0 + timedelta(days=1), 1)
    assert g.puede_abrir(e, T0 + timedelta(days=1))[0]


def test_drawdown_apaga_el_bot():
    g = GestorRiesgo(Riesgo(capital_inicial=20, drawdown_maximo_pct=30))
    e = EstadoCuenta(eur=14.5)
    assert g.revisar_drawdown(e, 1) is None
    e.eur = 14.0
    assert g.revisar_drawdown(e, 1)
    assert not g.puede_abrir(e, T0)[0]


def test_regla_x2_aparta_lo_invertido():
    g = GestorRiesgo(Riesgo(capital_inicial=20, objetivo_multiplicador=2))
    e = EstadoCuenta(eur=39.99)
    assert g.revisar_objetivo(e, 1) == 0
    e.eur = 41
    assert g.revisar_objetivo(e, 1) == 20
    assert e.eur == 21 and e.apartado_eur == 20 and e.capital_total(1) == 41
    assert g.revisar_objetivo(e, 1) == 0  # solo una vez


def test_regla_x2_espera_a_cerrar_posicion():
    g = GestorRiesgo(Riesgo(capital_inicial=20))
    e = EstadoCuenta(eur=10, btc=1)
    assert g.revisar_objetivo(e, 100) == 0
