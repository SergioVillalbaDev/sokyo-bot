"""Gráficos interactivos (Plotly) para el panel web: se puede hacer zoom, pasar el ratón, etc."""
from __future__ import annotations

import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from .config import Config
from .cuenta import EstadoCuenta, Operacion

VERDE, ROJO, NARANJA, AZUL, GRIS = "#16a34a", "#dc2626", "#f59e0b", "#2563eb", "#94a3b8"


def _base(fig: go.Figure, alto: int) -> go.Figure:
    titulo = fig.layout.title.text
    fig.update_layout(height=alto, margin=dict(l=10, r=10, t=90 if titulo else 50, b=10), hovermode="x unified",
                      legend=dict(orientation="h", yanchor="bottom", y=1.01, x=0),
                      title=dict(text=titulo, y=0.98, yanchor="top", x=0, font=dict(size=15)) if titulo else None)
    return fig


def velas(t: pd.DataFrame, cfg: Config, operaciones: list[Operacion] | None = None,
          estado: EstadoCuenta | None = None, titulo: str = "") -> go.Figure:
    """Velas japonesas con las medias, las compras/ventas y el stop-loss."""
    e = cfg.estrategia
    fig = go.Figure()
    fig.add_trace(go.Candlestick(x=t.index, open=t["apertura"], high=t["maximo"], low=t["minimo"], close=t["cierre"],
                                 name="Precio", increasing_line_color=VERDE, decreasing_line_color=ROJO, opacity=0.8))
    fig.add_trace(go.Scatter(x=t.index, y=t["ema_rapida"], name=f"EMA {e.ema_rapida} (rápida)", line=dict(color=AZUL, width=1.6)))
    fig.add_trace(go.Scatter(x=t.index, y=t["ema_lenta"], name=f"EMA {e.ema_lenta} (lenta)", line=dict(color=NARANJA, width=1.6)))
    if e.ema_filtro and "ema_filtro" in t:
        fig.add_trace(go.Scatter(x=t.index, y=t["ema_filtro"], name=f"EMA {e.ema_filtro} (filtro)",
                                 line=dict(color=GRIS, width=1.4, dash="dash")))
    if operaciones:
        desde = t.index[0]
        compras = [o for o in operaciones if o.tipo == "compra" and pd.Timestamp(o.fecha) >= desde]
        ventas = [o for o in operaciones if o.tipo == "venta" and pd.Timestamp(o.fecha) >= desde]
        fig.add_trace(go.Scatter(
            x=[pd.Timestamp(o.fecha) for o in compras], y=[o.precio for o in compras], mode="markers", name="Compra",
            marker=dict(symbol="triangle-up", size=13, color=VERDE, line=dict(width=1, color="white")),
            hovertext=[f"COMPRA {o.eur:.2f} € a {o.precio:,.0f}" for o in compras], hoverinfo="text"))
        fig.add_trace(go.Scatter(
            x=[pd.Timestamp(o.fecha) for o in ventas], y=[o.precio for o in ventas], mode="markers", name="Venta",
            marker=dict(symbol="triangle-down", size=13, color=[ROJO if "stop" in o.motivo else NARANJA for o in ventas],
                        line=dict(width=1, color="white")),
            hovertext=[f"VENTA ({o.motivo}) a {o.precio:,.0f} · {o.pnl_eur:+.2f} €" if o.pnl_eur is not None else "VENTA"
                       for o in ventas], hoverinfo="text"))
    if estado and estado.en_posicion and estado.precio_stop:
        fig.add_hline(y=estado.precio_stop, line=dict(color=ROJO, dash="dot"), annotation_text="stop-loss")
        fig.add_hline(y=estado.precio_entrada, line=dict(color=VERDE, dash="dot"), annotation_text="entrada")
    fig.update_layout(title=titulo, xaxis_rangeslider_visible=False, yaxis_title="Precio")
    return _base(fig, 520)


def curva(curva_bot: pd.Series, curva_cym: pd.Series, capital_inicial: float) -> go.Figure:
    """Valor de la cuenta (arriba) y drawdown (abajo)."""
    fig = make_subplots(rows=2, cols=1, shared_xaxes=True, row_heights=[0.68, 0.32], vertical_spacing=0.06,
                        subplot_titles=("Valor de la cuenta", "Caída desde el máximo (drawdown)"))
    fig.add_trace(go.Scatter(x=curva_bot.index, y=curva_bot, name="Bot", line=dict(color=AZUL, width=2)), 1, 1)
    fig.add_trace(go.Scatter(x=curva_cym.index, y=curva_cym, name="Comprar y mantener", line=dict(color=GRIS, width=1.3)), 1, 1)
    fig.add_hline(y=capital_inicial, line=dict(color=GRIS, dash="dot"), row=1, col=1)
    for serie, nombre, color in [(curva_bot, "Bot", AZUL), (curva_cym, "Comprar y mantener", GRIS)]:
        dd = (serie / serie.cummax() - 1) * 100
        fig.add_trace(go.Scatter(x=dd.index, y=dd, name=f"Drawdown {nombre.lower()}", fill="tozeroy",
                                 line=dict(color=color, width=1), showlegend=False), 2, 1)
    marcas = [v for v in (1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000)
              if v <= max(curva_bot.max(), curva_cym.max()) * 2 and v >= min(curva_bot.min(), curva_cym.min()) / 2]
    fig.update_yaxes(type="log", title="EUR (escala log)", tickvals=marcas, ticktext=[f"{v:,} €".replace(",", ".") for v in marcas],
                     row=1, col=1)
    fig.update_yaxes(title="%", row=2, col=1)
    return _base(fig, 560)


def por_ano(curva_bot: pd.Series, curva_cym: pd.Series) -> go.Figure:
    def anual(s):
        fin = s.resample("YE").last()
        ini = pd.concat([s.iloc[:1], fin.iloc[:-1]]).to_numpy()
        return pd.Series((fin.to_numpy() / ini - 1) * 100, index=fin.index.year.astype(str))
    b, c = anual(curva_bot), anual(curva_cym)
    fig = go.Figure([
        go.Bar(x=b.index, y=b, name="Bot", marker_color=[VERDE if v >= 0 else ROJO for v in b],
               text=[f"{v:+.0f} %" for v in b], textposition="outside"),
        go.Bar(x=c.index, y=c, name="Comprar y mantener", marker_color=GRIS, opacity=0.55),
    ])
    fig.update_layout(barmode="group", title="Rentabilidad por año", yaxis_title="%")
    return _base(fig, 380)


def distribucion(pares: list[dict]) -> go.Figure:
    pnl = [p["pnl_pct"] for p in pares]
    caja = dict(start=min(pnl + [0]) - 1, end=max(pnl + [0]) + 1, size=1)
    fig = go.Figure([
        go.Histogram(x=[v for v in pnl if v <= 0], xbins=caja, marker_color=ROJO, name="Perdedoras"),
        go.Histogram(x=[v for v in pnl if v > 0], xbins=caja, marker_color=VERDE, name="Ganadoras"),
    ])
    fig.update_layout(barmode="overlay")
    fig.add_vline(x=0, line=dict(color=GRIS))
    fig.update_layout(title="Resultado de cada operación (muchas pérdidas pequeñas, pocas ganancias grandes)",
                      xaxis_title="% ganado o perdido", yaxis_title="Nº de operaciones", bargap=0.05)
    return _base(fig, 360)


def mapa_robustez(rob: dict) -> go.Figure:
    z, texto = [], []
    for lenta in rob["lentas"]:
        fila, tfila = [], []
        for rapida in rob["rapidas"]:
            m = rob["rejilla"].get((rapida, lenta))
            fila.append(m["rentabilidad_total_pct"] if m else None)
            tfila.append(f"{m['rentabilidad_total_pct']:+.0f} %<br>caída {m['max_drawdown_pct']:.0f} %" if m else "")
        z.append(fila)
        texto.append(tfila)
    fig = go.Figure(go.Heatmap(z=z, x=[f"rápida {r}" for r in rob["rapidas"]], y=[f"lenta {l}" for l in rob["lentas"]],
                               text=texto, texttemplate="%{text}", colorscale="RdYlGn", zmid=0,
                               colorbar=dict(title="%")))
    fig.update_layout(title="Rentabilidad total con otras medias (buscamos zonas verdes amplias, no un punto aislado)")
    return _base(fig, 430)
