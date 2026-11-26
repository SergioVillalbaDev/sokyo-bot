"""BROKER: la pieza que de verdad compra y vende.

Hay dos tipos y el resto del bot no nota la diferencia:

  BrokerSimulado  -> modo "simular". Usa precios REALES de Binance en directo,
                     pero el dinero es ficticio y vive solo en tu ordenador.
                     No necesitas cuenta ni claves. Ideal para empezar.

  BrokerExchange  -> modos "testnet" y "real". Envía órdenes de verdad a Binance
                     a través de la librería ccxt.
                       - testnet: el entorno de pruebas de Binance (dinero falso,
                         pero órdenes reales en su sistema).
                       - real: tu cuenta de verdad. Dinero de verdad.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

import pandas as pd

from . import datos
from .config import Config
from .cuenta import Operacion, simular_compra, simular_venta


def ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class BrokerSimulado:
    nombre = "simular"

    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.simbolo = cfg.mercado.simbolo

    def velas(self, cantidad: int) -> pd.DataFrame:
        return datos.velas_recientes(self.simbolo, self.cfg.mercado.temporalidad, cantidad)

    def precio(self) -> float:
        return datos.precio_actual(self.simbolo)

    def comprar(self, eur: float, motivo: str) -> Operacion:
        return simular_compra(eur, self.precio(), self.cfg.costes, ahora_iso(), motivo)

    def vender(self, cantidad_btc: float, motivo: str) -> Operacion:
        return simular_venta(cantidad_btc, self.precio(), self.cfg.costes, ahora_iso(), motivo)


class BrokerExchange:
    """Conexión con Binance mediante ccxt (testnet o real)."""

    def __init__(self, cfg: Config, testnet: bool):
        import ccxt  # se importa aquí para que el modo simular no lo necesite

        self.cfg = cfg
        self.testnet = testnet
        self.nombre = "testnet" if testnet else "real"
        self.simbolo = cfg.mercado.simbolo_testnet if testnet else cfg.mercado.simbolo
        prefijo = "BINANCE_TESTNET_" if testnet else "BINANCE_"
        clave, secreto = os.getenv(prefijo + "API_KEY"), os.getenv(prefijo + "API_SECRET")
        if not clave or not secreto:
            raise RuntimeError(
                f"Faltan las claves {prefijo}API_KEY y {prefijo}API_SECRET en el archivo .env "
                "(mira docs/06-paper-trading.md)."
            )
        self.ex = ccxt.binance({"apiKey": clave, "secret": secreto, "enableRateLimit": True,
                                "options": {"defaultType": "spot"}})
        if testnet:
            self.ex.set_sandbox_mode(True)
        self.ex.load_markets()
        if self.simbolo not in self.ex.markets:
            raise RuntimeError(
                f"El par {self.simbolo} no existe en {'el testnet de ' if testnet else ''}Binance. "
                + ("En el testnet suele haber BTC/USDT: cambia mercado.simbolo_testnet en config.yaml." if testnet else "")
            )
        self.base, self.cotizada = self.simbolo.split("/")

    def velas(self, cantidad: int) -> pd.DataFrame:
        filas = self.ex.fetch_ohlcv(self.simbolo, self.cfg.mercado.temporalidad, limit=min(cantidad + 2, 1000))
        tabla = datos._a_tabla(filas)
        return datos.quitar_vela_abierta(tabla, self.cfg.mercado.temporalidad)

    def precio(self) -> float:
        return float(self.ex.fetch_ticker(self.simbolo)["last"])

    def saldo(self) -> tuple[float, float]:
        """Saldo libre en la cuenta del exchange: (moneda cotizada, BTC)."""
        b = self.ex.fetch_balance()
        return float(b["free"].get(self.cotizada, 0) or 0), float(b["free"].get(self.base, 0) or 0)

    def _comision(self, orden: dict) -> tuple[float, float]:
        """Devuelve (comisión cobrada en BTC, comisión cobrada en EUR) de una orden."""
        en_base = en_cotizada = 0.0
        comisiones = orden.get("fees") or ([orden["fee"]] if orden.get("fee") else [])
        for c in comisiones:
            if not c or c.get("cost") is None:
                continue
            if c.get("currency") == self.base:
                en_base += float(c["cost"])
            elif c.get("currency") == self.cotizada:
                en_cotizada += float(c["cost"])
            # Si se paga en BNB no afecta a nuestras cantidades
        return en_base, en_cotizada

    def comprar(self, eur: float, motivo: str) -> Operacion:
        libre, _ = self.saldo()
        if libre < eur:
            raise RuntimeError(f"Saldo insuficiente en el exchange: hay {libre:.2f} {self.cotizada}, hacen falta {eur:.2f}")
        orden = self.ex.create_market_buy_order_with_cost(self.simbolo, eur)
        orden = self._esperar(orden)
        lleno, coste = float(orden["filled"]), float(orden["cost"])
        com_base, com_cot = self._comision(orden)
        precio = coste / lleno if lleno else float(orden.get("average") or 0)
        return Operacion("compra", ahora_iso(), precio, lleno - com_base, coste + com_cot,
                         com_cot + com_base * precio, f"{motivo} (orden {orden.get('id')})")

    def vender(self, cantidad_btc: float, motivo: str) -> Operacion:
        _, libre_btc = self.saldo()
        cantidad = min(cantidad_btc, libre_btc)
        cantidad = float(self.ex.amount_to_precision(self.simbolo, cantidad))
        orden = self._esperar(self.ex.create_market_sell_order(self.simbolo, cantidad))
        lleno, coste = float(orden["filled"]), float(orden["cost"])
        com_base, com_cot = self._comision(orden)
        precio = coste / lleno if lleno else float(orden.get("average") or 0)
        # Si por redondeo quedan restos minúsculos de BTC ("polvo"), se ignoran.
        return Operacion("venta", ahora_iso(), precio, cantidad_btc, coste - com_cot,
                         com_cot + com_base * precio, f"{motivo} (orden {orden.get('id')})")

    def _esperar(self, orden: dict) -> dict:
        """Las órdenes a mercado se llenan casi al instante; si falta info, se vuelve a consultar."""
        if orden.get("filled") and orden.get("cost"):
            return orden
        return self.ex.fetch_order(orden["id"], self.simbolo)


def crear_broker(cfg: Config, modo: str):
    if modo == "simular":
        return BrokerSimulado(cfg)
    if modo == "testnet":
        return BrokerExchange(cfg, testnet=True)
    if modo == "real":
        if os.getenv("CONFIRMO_DINERO_REAL", "").strip().lower() != "si":
            raise RuntimeError(
                "Modo REAL bloqueado. Para activarlo pon CONFIRMO_DINERO_REAL=si en el archivo .env "
                "después de leer docs/07-dinero-real.md."
            )
        return BrokerExchange(cfg, testnet=False)
    raise ValueError(f"Modo desconocido: {modo}")
