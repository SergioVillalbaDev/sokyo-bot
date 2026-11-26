"""La CUENTA: cuánto dinero y cuánto BTC tiene el bot, y qué posición tiene abierta.

Conceptos:
  - POSICIÓN ABIERTA: tienes BTC comprado y esperas a venderlo.
  - EN LIQUIDEZ (o "fuera del mercado"): todo está en EUR, sin BTC.
  - P&L (profit and loss): ganancia o pérdida de una operación, en EUR.
  - APARTADO: dinero que el bot ya no toca (tu regla de retirar lo invertido al x2).

El estado se guarda en un archivo JSON (carpeta estado/). Si apagas el ordenador
y vuelves a arrancar el bot, sigue exactamente donde lo dejó.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .config import Costes


@dataclass
class Operacion:
    """Una compra o una venta ya ejecutada."""
    tipo: str            # "compra" o "venta"
    fecha: str           # fecha y hora en formato ISO (UTC)
    precio: float        # precio al que se ejecutó (ya con slippage)
    cantidad_btc: float  # BTC comprados o vendidos
    eur: float           # EUR pagados (compra) o recibidos (venta), YA descontada la comisión
    comision_eur: float  # comisión pagada al exchange
    motivo: str = ""     # por qué se hizo (cruce, stop-loss...)
    pnl_eur: float | None = None  # solo en ventas: ganancia o pérdida de la operación completa


@dataclass
class EstadoCuenta:
    eur: float                       # EUR disponibles para operar
    btc: float = 0.0                 # BTC que se tienen ahora
    apartado_eur: float = 0.0        # EUR retirados por la regla del x2 (no se tocan)
    objetivo_cumplido: bool = False  # ¿ya se aplicó la regla del x2?

    # Datos de la posición abierta (vacíos si no hay)
    precio_entrada: float | None = None
    precio_stop: float | None = None
    fecha_entrada: str | None = None
    coste_entrada_eur: float | None = None  # EUR gastados en la compra (con comisión)

    # Frenos de emergencia
    dia_actual: str | None = None
    capital_inicio_dia: float | None = None
    pnl_dia_eur: float = 0.0
    racha_perdedora: int = 0
    pausa_hasta: str | None = None
    apagado: bool = False
    motivo_apagado: str = ""

    # Control del bot en directo
    ultima_vela_procesada: str | None = None
    historial: list = field(default_factory=list)  # últimas operaciones (resumen)

    @property
    def en_posicion(self) -> bool:
        return self.btc > 0

    def capital_operable(self, precio: float) -> float:
        """Lo que vale ahora la parte con la que opera el bot."""
        return self.eur + self.btc * precio

    def capital_total(self, precio: float) -> float:
        """Todo: lo operable más lo apartado."""
        return self.capital_operable(precio) + self.apartado_eur

    # ---- Guardar y cargar ----
    def guardar(self, ruta: Path) -> None:
        ruta.parent.mkdir(parents=True, exist_ok=True)
        temporal = ruta.with_suffix(".tmp")
        temporal.write_text(json.dumps(asdict(self), indent=2, ensure_ascii=False), encoding="utf-8")
        temporal.replace(ruta)  # escribir y renombrar: si se corta la luz, no se corrompe

    @classmethod
    def cargar(cls, ruta: Path) -> "EstadoCuenta | None":
        if not ruta.exists():
            return None
        return cls(**json.loads(ruta.read_text(encoding="utf-8")))


# ---- Simulación de órdenes con costes realistas ----

def simular_compra(eur: float, precio_mercado: float, costes: Costes, fecha: str, motivo: str = "") -> Operacion:
    """Compra de `eur` euros de BTC.

    - El SLIPPAGE hace que compres un poco más caro de lo que ves.
    - La COMISIÓN se descuenta de lo que gastas.
    """
    precio = precio_mercado * (1 + costes.slippage_pct / 100)
    comision = eur * costes.comision_pct / 100
    cantidad = (eur - comision) / precio
    return Operacion("compra", fecha, precio, cantidad, eur, comision, motivo)


def simular_venta(cantidad_btc: float, precio_mercado: float, costes: Costes, fecha: str, motivo: str = "") -> Operacion:
    """Venta de todo el BTC. El slippage hace que vendas un poco más barato."""
    precio = precio_mercado * (1 - costes.slippage_pct / 100)
    bruto = cantidad_btc * precio
    comision = bruto * costes.comision_pct / 100
    return Operacion("venta", fecha, precio, cantidad_btc, bruto - comision, comision, motivo)


def aplicar_compra(estado: EstadoCuenta, op: Operacion, stop_pct: float) -> None:
    """Actualiza la cuenta tras una compra y fija el stop-loss."""
    estado.eur -= op.eur
    estado.btc += op.cantidad_btc
    estado.precio_entrada = op.precio
    estado.precio_stop = op.precio * (1 - stop_pct / 100)
    estado.fecha_entrada = op.fecha
    estado.coste_entrada_eur = op.eur


def aplicar_venta(estado: EstadoCuenta, op: Operacion) -> float:
    """Actualiza la cuenta tras vender y devuelve el P&L de la operación completa."""
    pnl = op.eur - (estado.coste_entrada_eur or 0.0)
    op.pnl_eur = pnl
    estado.eur += op.eur
    estado.btc = max(0.0, estado.btc - op.cantidad_btc)
    if estado.btc < 1e-12:
        estado.btc = 0.0
    estado.precio_entrada = estado.precio_stop = estado.fecha_entrada = estado.coste_entrada_eur = None
    return pnl
