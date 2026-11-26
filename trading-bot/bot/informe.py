"""Genera los informes del backtest: texto en consola, informe.md, gráfico y CSV."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # dibujar sin pantalla
import matplotlib.pyplot as plt  # noqa: E402

from .backtest import ResultadoBacktest, emparejar_operaciones, operaciones_a_tabla  # noqa: E402
from .config import RAIZ, Config  # noqa: E402

CARPETA_RESULTADOS = RAIZ / "resultados"


def _eur(x: float) -> str:
    return f"{x:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def _pct(x: float | None) -> str:
    return "—" if x is None else f"{x:+.2f} %".replace(".", ",")


def semaforo(m: dict, cfg: Config) -> list[tuple[str, str, str]]:
    """Comprobaciones para saber si el resultado es fiable. (estado, comprobación, explicación)

    Basado en la metodología de la skill backtest-expert.
    """
    filas = []

    def fila(ok, aviso, titulo, explicacion):
        filas.append(("🟢" if ok else ("🟡" if aviso else "🔴"), titulo, explicacion))

    n = m["operaciones"]
    fila(n >= 100, n >= 30, f"Número de operaciones: {n}",
         "Con menos de 30 el resultado puede ser pura suerte; a partir de 100 es más fiable.")
    fila(m["anos"] >= 5, m["anos"] >= 3, f"Años probados: {m['anos']:g}",
         "Hay que probar varios tipos de mercado (subidas, caídas, laterales). Mínimo recomendado: 5 años.")
    esp = m["esperanza_por_operacion_pct"]
    fila(esp > 0.3, esp > 0, f"Esperanza por operación: {_pct(esp)}",
         "Lo que se gana de media en cada operación, contando las perdedoras. Si es negativa, la estrategia pierde dinero.")
    fb = m["factor_beneficio"]
    fila(fb is not None and fb >= 1.5, fb is not None and fb > 1.0, f"Factor de beneficio: {fb if fb is not None else '—'}",
         "Euros ganados ÷ euros perdidos. Por encima de 1 gana; por encima de 1,5 es bastante sólido.")
    dd = m["max_drawdown_pct"]
    fila(dd < 20, dd < cfg.riesgo.drawdown_maximo_pct, f"Peor caída (drawdown): {dd:.1f} %",
         "La mayor caída desde un máximo. Pregúntate si aguantarías ver tu cuenta así sin apagar el bot.")
    anos_pos = sum(1 for v in m["rentabilidad_por_ano_pct"].values() if v > 0)
    total_anos = len(m["rentabilidad_por_ano_pct"])
    fila(anos_pos >= total_anos * 0.7, anos_pos >= total_anos / 2, f"Años en positivo: {anos_pos} de {total_anos}",
         "Si todo lo gana en uno o dos años buenos, depende demasiado de la suerte.")
    gana_cym = m["rentabilidad_total_pct"] >= m["comprar_y_mantener_pct"]
    fila(gana_cym, False, f"¿Mejor que comprar y mantener? {'Sí' if gana_cym else 'No'}",
         "Si simplemente comprar BTC y olvidarse rinde más, el bot tiene que justificarse por otra cosa "
         "(por ejemplo, caídas mucho menores).")
    return filas


def resumen_consola(r: ResultadoBacktest, cfg: Config) -> str:
    m = r.metricas
    e = cfg.estrategia
    filtro = f", filtro EMA {e.ema_filtro}" if e.ema_filtro else ""
    lineas = [
        "",
        "═" * 64,
        f" BACKTEST {cfg.mercado.simbolo} {cfg.mercado.temporalidad}  ·  EMA {e.ema_rapida}/{e.ema_lenta}{filtro}"
        f"  ·  stop {cfg.riesgo.stop_loss_pct:g} %",
        f" Del {m['desde']} al {m['hasta']} ({m['anos']:g} años)",
        "═" * 64,
        f" Capital inicial ............ {_eur(m['capital_inicial'])}",
        f" Capital final .............. {_eur(m['capital_final'])}   ({_pct(m['rentabilidad_total_pct'])})",
        f"   de ello, apartado (x2) ... {_eur(m['apartado_eur'])}",
        f" Rentabilidad media anual ... {_pct(m['rentabilidad_anual_pct'])}",
        f" Peor caída (drawdown) ...... {m['max_drawdown_pct']:.1f} %",
        f" Operaciones ................ {m['operaciones']}  ({m['ganadoras']} ganadoras, {m['perdedoras']} perdedoras,"
        f" acierto {m['tasa_acierto_pct']:.0f} %)",
        f" Ganancia media / pérdida media  {_pct(m['ganancia_media_pct'])} / {_pct(m['perdida_media_pct'])}",
        f" Tiempo con BTC comprado .... {m['tiempo_en_mercado_pct']:.0f} %",
        f" Comisiones pagadas ......... {_eur(m['comisiones_pagadas_eur'])}",
        "─" * 64,
        f" Comprar y mantener BTC ..... {_eur(m['comprar_y_mantener_final'])}   ({_pct(m['comprar_y_mantener_pct'])}),"
        f" peor caída {m['comprar_y_mantener_max_drawdown_pct']:.0f} %",
        "─" * 64,
        " Por año: " + "  ".join(f"{a}: {_pct(v)}" for a, v in m["rentabilidad_por_ano_pct"].items()),
        "─" * 64,
        " ¿Es fiable este resultado?",
    ]
    for estado, titulo, _ in semaforo(m, cfg):
        lineas.append(f"  {estado} {titulo}")
    lineas.append("═" * 64)
    return "\n".join(lineas)


def dibujar(r: ResultadoBacktest, cfg: Config, ruta: Path) -> None:
    t = r.velas
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 9), sharex=True, gridspec_kw={"height_ratios": [3, 2]})

    ax1.plot(t.index, t["cierre"], color="#9aa0a6", lw=0.8, label="Precio BTC")
    ax1.plot(t.index, t["ema_rapida"], color="#1a73e8", lw=0.9, label=f"EMA {cfg.estrategia.ema_rapida}")
    ax1.plot(t.index, t["ema_lenta"], color="#e8710a", lw=0.9, label=f"EMA {cfg.estrategia.ema_lenta}")
    if cfg.estrategia.ema_filtro:
        ax1.plot(t.index, t["ema_filtro"], color="#5f6368", lw=1, ls="--", label=f"EMA {cfg.estrategia.ema_filtro} (filtro)")
    compras = [o for o in r.operaciones if o.tipo == "compra"]
    ventas = [o for o in r.operaciones if o.tipo == "venta"]
    import pandas as pd
    ax1.scatter([pd.Timestamp(o.fecha) for o in compras], [o.precio for o in compras], marker="^", color="#188038", s=40, zorder=5, label="Compra")
    ax1.scatter([pd.Timestamp(o.fecha) for o in ventas], [o.precio for o in ventas], marker="v",
                color=["#d93025" if o.motivo == "stop-loss" else "#f29900" for o in ventas], s=40, zorder=5,
                label="Venta (rojo = stop-loss)")
    ax1.set_title(f"{cfg.mercado.simbolo} {cfg.mercado.temporalidad}: precio, medias y operaciones")
    ax1.set_ylabel("Precio (EUR)")
    ax1.legend(loc="upper left", fontsize=8)
    ax1.grid(alpha=0.3)

    ax2.plot(r.curva.index, r.curva, color="#1a73e8", lw=1.2, label="Bot")
    ax2.plot(r.curva_comprar_y_mantener.index, r.curva_comprar_y_mantener, color="#9aa0a6", lw=1, label="Comprar y mantener")
    ax2.axhline(cfg.riesgo.capital_inicial, color="#5f6368", lw=0.8, ls=":")
    ax2.set_yscale("log")
    ax2.set_title("Valor de la cuenta (escala logarítmica: la misma subida en % ocupa lo mismo)")
    ax2.set_ylabel("EUR")
    ax2.legend(loc="upper left", fontsize=8)
    ax2.grid(alpha=0.3)

    fig.tight_layout()
    fig.savefig(ruta, dpi=110)
    plt.close(fig)


def guardar_informe(r: ResultadoBacktest, cfg: Config, robustez: dict | None = None) -> Path:
    carpeta = CARPETA_RESULTADOS / f"backtest_{datetime.now():%Y-%m-%d_%H%M%S}"
    carpeta.mkdir(parents=True, exist_ok=True)
    dibujar(r, cfg, carpeta / "grafico.png")
    operaciones_a_tabla(r.operaciones).to_csv(carpeta / "operaciones.csv", index=False)
    m = r.metricas

    md = [f"# Informe de backtest: {cfg.mercado.simbolo} {cfg.mercado.temporalidad}", "",
          f"Del **{m['desde']}** al **{m['hasta']}** ({m['anos']:g} años). "
          f"Estrategia: cruce EMA {cfg.estrategia.ema_rapida}/{cfg.estrategia.ema_lenta}"
          + (f" con filtro EMA {cfg.estrategia.ema_filtro}" if cfg.estrategia.ema_filtro else "")
          + f", stop-loss {cfg.riesgo.stop_loss_pct:g} %, riesgo {cfg.riesgo.riesgo_por_operacion_pct:g} % por operación.",
          "", "![Gráfico](grafico.png)", "", "## Resultados", "",
          "| Métrica | Bot | Comprar y mantener |", "|---|---|---|",
          f"| Capital final | {_eur(m['capital_final'])} | {_eur(m['comprar_y_mantener_final'])} |",
          f"| Rentabilidad total | {_pct(m['rentabilidad_total_pct'])} | {_pct(m['comprar_y_mantener_pct'])} |",
          f"| Peor caída (drawdown) | {m['max_drawdown_pct']:.1f} % | {m['comprar_y_mantener_max_drawdown_pct']:.1f} % |",
          f"| Rentabilidad media anual | {_pct(m['rentabilidad_anual_pct'])} | |",
          f"| Operaciones | {m['operaciones']} | 1 |",
          f"| Tasa de acierto | {m['tasa_acierto_pct']:.1f} % | |",
          f"| Ganancia media / pérdida media | {_pct(m['ganancia_media_pct'])} / {_pct(m['perdida_media_pct'])} | |",
          f"| Factor de beneficio | {m['factor_beneficio']} | |",
          f"| Tiempo con BTC comprado | {m['tiempo_en_mercado_pct']:.0f} % | 100 % |",
          f"| Comisiones pagadas | {_eur(m['comisiones_pagadas_eur'])} | |",
          f"| Apartado por la regla x2 | {_eur(m['apartado_eur'])} | |",
          "", "### Por año", "", "| Año | Bot |", "|---|---|",
          *[f"| {a} | {_pct(v)} |" for a, v in m["rentabilidad_por_ano_pct"].items()],
          "", "## ¿Es fiable?", "", "| | Comprobación | Qué significa |", "|---|---|---|",
          *[f"| {e} | {t} | {x} |" for e, t, x in semaforo(m, cfg)]]

    if robustez:
        md += ["", "## Prueba de robustez", "",
               "Rentabilidad total cambiando las medias (filas: EMA lenta, columnas: EMA rápida). "
               "Buscamos una zona amplia de valores parecidos, no un único número bueno.", "",
               "| lenta \\ rápida | " + " | ".join(str(x) for x in robustez["rapidas"]) + " |",
               "|---|" + "---|" * len(robustez["rapidas"])]
        for lenta in robustez["lentas"]:
            celdas = []
            for rapida in robustez["rapidas"]:
                mm = robustez["rejilla"].get((rapida, lenta))
                celdas.append(_pct(mm["rentabilidad_total_pct"]) if mm else "—")
            md.append(f"| {lenta} | " + " | ".join(celdas) + " |")
        md += ["", "| Stop-loss | Rentabilidad | Peor caída | Operaciones |", "|---|---|---|---|"]
        for stop, mm in robustez["stops"].items():
            md.append(f"| {stop} % | {_pct(mm['rentabilidad_total_pct'])} | {mm['max_drawdown_pct']:.1f} % | {mm['operaciones']} |")
        md += ["", "> Si con un stop amplio salen muy pocas operaciones, no es la estrategia: con un riesgo del "
               f"{cfg.riesgo.riesgo_por_operacion_pct:g} % y un stop grande, la compra queda por debajo de la orden "
               f"mínima ({cfg.riesgo.orden_minima_eur:g} €) y el bot no puede operar. Es un límite real de las cuentas pequeñas."]
        md += ["", "| Variante | Rentabilidad | Peor caída |", "|---|---|---|"]
        for nombre, clave in [("Sin filtro de tendencia", "sin_filtro"), ("Costes al doble", "costes_dobles"), ("Sin costes", "sin_costes")]:
            mm = robustez[clave]
            md.append(f"| {nombre} | {_pct(mm['rentabilidad_total_pct'])} | {mm['max_drawdown_pct']:.1f} % |")

    if r.eventos:
        md += ["", "## Eventos (frenos de riesgo, regla x2...)", "", "```", *r.eventos[:200], "```"]
    pares = emparejar_operaciones(r.operaciones)
    if pares:
        md += ["", "## Operaciones", "", "| Entrada | Salida | Precio entrada | Precio salida | Resultado | Motivo de salida |",
               "|---|---|---|---|---|---|"]
        for p in pares:
            md.append(f"| {p['entrada'][:16]} | {p['salida'][:16]} | {p['precio_entrada']:,.0f} | {p['precio_salida']:,.0f} | "
                      f"{_eur(p['pnl_eur'])} ({_pct(p['pnl_pct'])}) | {p['motivo_salida']} |")
    md += ["", "> Resultados pasados no garantizan resultados futuros. Esto es una herramienta para aprender."]
    (carpeta / "informe.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    return carpeta
