"""Carga la configuración del bot desde config.yaml.

Todo el bot lee sus números de un único objeto `Config`. Así, para cambiar el
comportamiento solo hay que tocar config.yaml, nunca el código.
"""
from __future__ import annotations

from dataclasses import dataclass, field, fields
from pathlib import Path

import yaml

# Carpeta raíz del proyecto (la que contiene config.yaml)
RAIZ = Path(__file__).resolve().parent.parent


@dataclass
class Mercado:
    simbolo: str = "BTC/EUR"
    temporalidad: str = "4h"
    simbolo_testnet: str = "BTC/USDT"


@dataclass
class Estrategia:
    ema_rapida: int = 20
    ema_lenta: int = 50
    ema_filtro: int = 200


@dataclass
class Riesgo:
    capital_inicial: float = 20.0
    riesgo_por_operacion_pct: float = 2.0
    stop_loss_pct: float = 5.0
    max_posicion_pct: float = 100.0
    orden_minima_eur: float = 5.0
    perdida_maxima_diaria_pct: float = 4.0
    racha_perdedora_maxima: int = 3
    horas_de_pausa: float = 48.0
    drawdown_maximo_pct: float = 30.0
    objetivo_multiplicador: float = 2.0


@dataclass
class Costes:
    comision_pct: float = 0.1
    slippage_pct: float = 0.05


@dataclass
class Ejecucion:
    intervalo_revision_segundos: int = 60


@dataclass
class Backtest:
    desde: str = "2020-01-01"


@dataclass
class Config:
    mercado: Mercado = field(default_factory=Mercado)
    estrategia: Estrategia = field(default_factory=Estrategia)
    riesgo: Riesgo = field(default_factory=Riesgo)
    costes: Costes = field(default_factory=Costes)
    ejecucion: Ejecucion = field(default_factory=Ejecucion)
    backtest: Backtest = field(default_factory=Backtest)

    def validar(self) -> None:
        """Comprueba que los números tienen sentido antes de arrancar."""
        e, r = self.estrategia, self.riesgo
        errores = []
        if not 0 < e.ema_rapida < e.ema_lenta:
            errores.append("ema_rapida debe ser mayor que 0 y menor que ema_lenta")
        if e.ema_filtro < 0:
            errores.append("ema_filtro debe ser 0 (desactivado) o positivo")
        if r.capital_inicial <= 0:
            errores.append("capital_inicial debe ser positivo")
        if not 0 < r.riesgo_por_operacion_pct <= 10:
            errores.append("riesgo_por_operacion_pct debe estar entre 0 y 10")
        if not 0 < r.stop_loss_pct < 50:
            errores.append("stop_loss_pct debe estar entre 0 y 50")
        if not 0 < r.max_posicion_pct <= 100:
            errores.append("max_posicion_pct debe estar entre 0 y 100 (sin apalancamiento)")
        if r.objetivo_multiplicador <= 1:
            errores.append("objetivo_multiplicador debe ser mayor que 1")
        if errores:
            raise ValueError("Error en config.yaml:\n  - " + "\n  - ".join(errores))


def _rellenar(clase, datos: dict | None):
    """Crea una sección usando los valores del YAML y los de por defecto para lo que falte."""
    datos = datos or {}
    nombres = {f.name for f in fields(clase)}
    desconocidas = set(datos) - nombres
    if desconocidas:
        raise ValueError(f"Opciones desconocidas en config.yaml ({clase.__name__}): {sorted(desconocidas)}")
    return clase(**datos)


def cargar_config(ruta: str | Path | None = None) -> Config:
    ruta = Path(ruta) if ruta else RAIZ / "config.yaml"
    with open(ruta, encoding="utf-8") as f:
        crudo = yaml.safe_load(f) or {}
    cfg = Config(
        mercado=_rellenar(Mercado, crudo.get("mercado")),
        estrategia=_rellenar(Estrategia, crudo.get("estrategia")),
        riesgo=_rellenar(Riesgo, crudo.get("riesgo")),
        costes=_rellenar(Costes, crudo.get("costes")),
        ejecucion=_rellenar(Ejecucion, crudo.get("ejecucion")),
        backtest=_rellenar(Backtest, crudo.get("backtest")),
    )
    cfg.validar()
    return cfg


def guardar_cambios(cambios: dict[str, dict], ruta: str | Path | None = None) -> None:
    """Escribe valores nuevos en config.yaml SIN borrar los comentarios.

    `cambios` es {seccion: {clave: valor}}. Se valida antes de guardar.
    """
    ruta = Path(ruta) if ruta else RAIZ / "config.yaml"
    lineas = ruta.read_text(encoding="utf-8").splitlines()
    seccion = None
    pendientes = {s: dict(v) for s, v in cambios.items()}
    for i, linea in enumerate(lineas):
        limpia = linea.split("#", 1)[0].rstrip()
        if not limpia:
            continue
        if not linea.startswith(" ") and limpia.endswith(":"):
            seccion = limpia[:-1].strip()
            continue
        if seccion in pendientes and ":" in limpia:
            clave = limpia.split(":", 1)[0].strip()
            if clave in pendientes[seccion]:
                valor = pendientes[seccion].pop(clave)
                sangria = linea[: len(linea) - len(linea.lstrip())]
                texto = f'"{valor}"' if isinstance(valor, str) and clave == "desde" else valor
                lineas[i] = f"{sangria}{clave}: {texto}"
    nuevo = "\n".join(lineas) + "\n"
    # Validar cargando una copia temporal antes de sobrescribir
    temporal = ruta.with_suffix(".tmp.yaml")
    temporal.write_text(nuevo, encoding="utf-8")
    try:
        cargar_config(temporal)
    finally:
        temporal.unlink(missing_ok=True)
    faltan = {s: v for s, v in pendientes.items() if v}
    if faltan:
        raise ValueError(f"No se encontraron estas opciones en config.yaml: {faltan}")
    ruta.write_text(nuevo, encoding="utf-8")
