"""Salida bonita en la terminal (colores, tablas y paneles) usando la librería `rich`."""
from __future__ import annotations

from rich import box
from rich.columns import Columns
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .backtest import ResultadoBacktest
from .config import Config
from .informe import semaforo

consola = Console()


def _eur(x: float, signo: bool = False) -> str:
    s = f"{x:+,.2f}" if signo else f"{x:,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".") + " €"


def _pct(x: float | None, signo: bool = True) -> str:
    if x is None:
        return "—"
    return (f"{x:+.1f}" if signo else f"{x:.1f}").replace(".", ",") + " %"


def _color(x: float) -> str:
    return "green" if x > 0 else ("red" if x < 0 else "white")


def _tarjeta(titulo: str, valor: str, sub: str = "", color: str = "white") -> Panel:
    t = Text(valor, style=f"bold {color}", justify="center")
    if sub:
        t.append("\n" + sub, style="dim")
    return Panel(t, title=titulo, box=box.ROUNDED, padding=(0, 2))


def mostrar_backtest(r: ResultadoBacktest, cfg: Config) -> None:
    m, e = r.metricas, cfg.estrategia
    filtro = f" + filtro EMA {e.ema_filtro}" if e.ema_filtro else ""
    consola.print()
    consola.rule(f"[bold]Backtest {cfg.mercado.simbolo} {cfg.mercado.temporalidad}[/]  ·  EMA {e.ema_rapida}/{e.ema_lenta}{filtro}"
                 f"  ·  stop {cfg.riesgo.stop_loss_pct:g} %  ·  {m['desde']} → {m['hasta']} ({m['anos']:g} años)")
    consola.print(Columns([
        _tarjeta("Capital final", _eur(m["capital_final"]), f"{_pct(m['rentabilidad_total_pct'])} desde {_eur(m['capital_inicial'])}",
                 _color(m["rentabilidad_total_pct"])),
        _tarjeta("Comprar y mantener", _eur(m["comprar_y_mantener_final"]), _pct(m["comprar_y_mantener_pct"]),
                 _color(m["comprar_y_mantener_pct"])),
        _tarjeta("Peor caída", _pct(m["max_drawdown_pct"], False), f"mantener: {_pct(m['comprar_y_mantener_max_drawdown_pct'], False)}",
                 "yellow"),
        _tarjeta("Operaciones", str(m["operaciones"]), f"{m['tasa_acierto_pct']:.0f} % aciertos"),
        _tarjeta("Anual", _pct(m["rentabilidad_anual_pct"]), f"factor beneficio {m['factor_beneficio']}",
                 _color(m["rentabilidad_anual_pct"])),
    ], expand=True, equal=True))

    t = Table(box=box.SIMPLE_HEAD, show_edge=False, expand=True)
    t.add_column("Detalle")
    t.add_column("Valor", justify="right")
    t.add_row("Ganancia media / pérdida media",
              f"[green]{_pct(m['ganancia_media_pct'])}[/] / [red]{_pct(m['perdida_media_pct'])}[/]")
    t.add_row("Esperanza por operación", f"[{_color(m['esperanza_por_operacion_pct'])}]{_pct(m['esperanza_por_operacion_pct'])}[/]")
    t.add_row("Mejor / peor operación", f"{_pct(m['mejor_operacion_pct'])} / {_pct(m['peor_operacion_pct'])}")
    t.add_row("Tiempo con BTC comprado", _pct(m["tiempo_en_mercado_pct"], False))
    t.add_row("Comisiones pagadas", _eur(m["comisiones_pagadas_eur"]))
    t.add_row("Apartado por la regla x2", _eur(m["apartado_eur"]))

    anos = Table(title="Por año", box=box.SIMPLE_HEAD, show_edge=False)
    anos.add_column("Año")
    anos.add_column("Bot", justify="right")
    for a, v in m["rentabilidad_por_ano_pct"].items():
        barra = "█" * min(int(abs(v) / 3), 15)
        anos.add_row(a, f"[{_color(v)}]{_pct(v):>9} {barra}[/]")
    consola.print(Columns([t, anos], expand=True))

    s = Table(title="¿Es fiable este resultado?", box=box.SIMPLE_HEAD, show_edge=False, expand=True, title_justify="left")
    s.add_column("", width=2)
    s.add_column("Comprobación", style="bold")
    s.add_column("Qué significa", style="dim")
    for estado, titulo, explicacion in semaforo(m, cfg):
        s.add_row(estado, titulo, explicacion)
    consola.print(s)


def mostrar_estado(trader) -> None:
    from .analisis import diagnosticar
    from .estrategia import calcular_senales

    s, cfg = trader.estado, trader.cfg
    precio = trader.broker.precio()
    total = s.capital_total(precio)
    cambio = (total / cfg.riesgo.capital_inicial - 1) * 100
    consola.rule(f"[bold]Bot en modo {trader.modo.upper()}[/] · {trader.broker.simbolo} · precio {precio:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))
    consola.print(Columns([
        _tarjeta("Valor total", _eur(total), _pct(cambio), _color(cambio)),
        _tarjeta("Dinero libre", _eur(s.eur)),
        _tarjeta("BTC", f"{s.btc:.6f}", _eur(s.btc * precio) if s.btc else ""),
        _tarjeta("Apartado (x2)", _eur(s.apartado_eur)),
    ], expand=True, equal=True))
    try:
        t = calcular_senales(trader.broker.velas(1000), cfg.estrategia)
        d = diagnosticar(t, cfg, s, precio)
        color = {"bueno": "green", "malo": "red", "neutral": "cyan"}[d.tono]
        consola.print(Panel("\n".join(["• " + x for x in d.detalles]), title=f"🧠 {d.titular}", border_style=color,
                            title_align="left"))
    except Exception as e:  # sin internet
        consola.print(f"[yellow]No se pudo calcular el diagnóstico: {e}[/]")
    if s.apagado:
        consola.print(f"[bold red]🛑 APAGADO: {s.motivo_apagado}[/]")
    if s.historial:
        h = Table(title="Últimas operaciones", box=box.SIMPLE_HEAD, title_justify="left")
        h.add_column("Operación")
        for linea in s.historial[-10:]:
            h.add_row(f"[green]{linea}[/]" if "compra" in linea else linea)
        consola.print(h)
    consola.print(f"[dim]Última vela procesada: {s.ultima_vela_procesada or 'ninguna'}[/]")
