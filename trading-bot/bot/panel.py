"""PANEL WEB del bot. Se abre con:  python -m bot panel

Es una página en tu navegador (solo en tu ordenador, nadie más la ve) para:
  - ver en directo qué está haciendo y "pensando" el bot,
  - experimentar con la estrategia en el laboratorio de backtest,
  - cambiar la configuración sin tocar archivos,
  - leer la documentación.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # para que funcione con "streamlit run"

from bot import datos, graficos  # noqa: E402
from bot.analisis import diagnosticar  # noqa: E402
from bot.backtest import con_cambios, ejecutar_backtest, emparejar_operaciones, prueba_de_robustez  # noqa: E402
from bot.config import RAIZ, cargar_config, guardar_cambios  # noqa: E402
from bot.cuenta import EstadoCuenta, Operacion  # noqa: E402
from bot.estrategia import calcular_senales  # noqa: E402
from bot.informe import semaforo  # noqa: E402

st.set_page_config(page_title="Bot de trading", page_icon="📈", layout="wide")

MODOS = {"simular": "🧪 Simulación", "testnet": "🧪 Testnet", "real": "💶 Real"}

st.markdown("""
<style>
  div[data-testid="stMetric"] {border: 1px solid rgba(148,163,184,.35); border-radius: 12px; padding: 12px 16px;}
  div[data-testid="stMetricLabel"] p {font-size: .85rem; opacity: .8;}
  .bloque {border-radius: 12px; padding: 14px 18px; margin: 4px 0 12px 0; border: 1px solid rgba(148,163,184,.35);}
  .grande {font-size: 1.15rem; font-weight: 600;}
</style>""", unsafe_allow_html=True)


# ───────────────────────────── utilidades ─────────────────────────────
def eur(x: float, signo: bool = False) -> str:
    s = f"{x:+,.2f}" if signo else f"{x:,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".") + " €"


def pct(x: float | None, signo: bool = True) -> str:
    if x is None:
        return "—"
    return (f"{x:+.1f}" if signo else f"{x:.1f}").replace(".", ",") + " %"


def cfg_actual():
    return cargar_config()


@st.cache_data(ttl=3600, show_spinner="Descargando precios de Binance...")
def historial(simbolo: str, temporalidad: str, desde: str) -> pd.DataFrame:
    return datos.obtener_historial(simbolo, temporalidad, desde)


@st.cache_data(ttl=120, show_spinner=False)
def recientes(simbolo: str, temporalidad: str) -> pd.DataFrame:
    return datos.velas_recientes(simbolo, temporalidad, 1000)


@st.cache_data(ttl=30, show_spinner=False)
def precio(simbolo: str) -> float:
    return datos.precio_actual(simbolo)


def leer_estado(modo: str) -> EstadoCuenta | None:
    return EstadoCuenta.cargar(RAIZ / "estado" / f"{modo}.json")


def leer_operaciones(modo: str) -> pd.DataFrame:
    ruta = RAIZ / "resultados" / f"operaciones_{modo}.csv"
    if not ruta.exists():
        return pd.DataFrame()
    return pd.read_csv(ruta)


def tabla_a_operaciones(tabla: pd.DataFrame) -> list[Operacion]:
    campos = Operacion.__dataclass_fields__
    ops = []
    for fila in tabla.to_dict("records"):
        d = {k: fila.get(k) for k in campos}
        d["pnl_eur"] = None if pd.isna(d.get("pnl_eur")) else float(d["pnl_eur"])
        d["motivo"] = "" if pd.isna(d.get("motivo")) else str(d["motivo"])
        ops.append(Operacion(**d))
    return ops


def caja(texto: str, tono: str = "neutral") -> None:
    {"bueno": st.success, "malo": st.error, "neutral": st.info}[tono](texto)


# ───────────────────────────── páginas ─────────────────────────────
def pagina_inicio():
    cfg = cfg_actual()
    st.title("📈 Tu bot de trading")
    st.caption(f"{cfg.mercado.simbolo} · velas de {cfg.mercado.temporalidad} · EMA {cfg.estrategia.ema_rapida}/"
               f"{cfg.estrategia.ema_lenta}" + (f" + filtro {cfg.estrategia.ema_filtro}" if cfg.estrategia.ema_filtro else "")
               + f" · stop {cfg.riesgo.stop_loss_pct:g} % · riesgo {cfg.riesgo.riesgo_por_operacion_pct:g} % por operación")

    try:
        p = precio(cfg.mercado.simbolo)
        t = calcular_senales(recientes(cfg.mercado.simbolo, cfg.mercado.temporalidad), cfg.estrategia)
    except Exception as e:  # sin internet, por ejemplo
        st.error(f"No se pudieron descargar los precios: {e}")
        return

    estado = leer_estado("simular")
    d = diagnosticar(t, cfg, estado, p)
    c1, c2, c3, c4 = st.columns(4)
    c1.metric(f"Precio {cfg.mercado.simbolo}", f"{p:,.0f}".replace(",", "."),
              pct((p / t['cierre'].iloc[-7] - 1) * 100) + " en 24 h")
    c2.metric("Tendencia de las medias", "Alcista ↗" if d.rapida_sobre_lenta else "Bajista ↘")
    c3.metric("Mercado de fondo (EMA filtro)", "Alcista ↗" if d.sobre_filtro else "Bajista ↘")
    c4.metric(f"Última vela ({pd.Timestamp(d.fecha_vela):%d/%m} UTC)", pd.Timestamp(d.fecha_vela).strftime("%H:%M"))

    st.subheader("🧠 Qué está pensando el bot ahora mismo")
    caja(f"**{d.titular}**", d.tono)
    for linea in d.detalles:
        st.markdown(f"- {linea}")

    st.plotly_chart(graficos.velas(t.iloc[-180:], cfg, estado=estado, titulo="Últimos 30 días"), width="stretch")

    st.subheader("Tus bots")
    cols = st.columns(3)
    for col, (modo, nombre) in zip(cols, MODOS.items()):
        e = leer_estado(modo)
        with col:
            with st.container(border=True):
                st.markdown(f"**{nombre}**")
                if not e:
                    st.caption(f"Sin arrancar. Comando: `python -m bot {modo}`")
                    continue
                p_modo = precio(cfg.mercado.simbolo_testnet) if modo == "testnet" else p
                total = e.capital_total(p_modo)
                st.metric("Valor", eur(total), pct((total / cfg.riesgo.capital_inicial - 1) * 100))
                st.caption("Con BTC comprado" if e.en_posicion else ("APAGADO" if e.apagado else "Esperando señal"))

    st.subheader("🎓 Tu progreso")
    pagina_progreso_widget()


PASOS = [
    "He leído los conceptos básicos (docs 01)",
    "He hecho mi primer backtest",
    "Entiendo por qué el bot acierta solo ~1 de cada 4 veces y aun así gana",
    "He probado a cambiar parámetros en el laboratorio",
    "He visto la prueba de robustez y entiendo qué es el sobreajuste",
    "El bot lleva 4 semanas en simulación sin errores",
    "He visto una compra y una venta y sé explicar por qué ocurrieron",
    "He probado el testnet de Binance",
    "Acepto que puedo perder los 20 € y no me afectaría",
]


def pagina_progreso_widget():
    ruta = RAIZ / "estado" / "progreso.json"
    hechos = set(json.loads(ruta.read_text())) if ruta.exists() else set()
    nuevos = set()
    for paso in PASOS:
        if st.checkbox(paso, value=paso in hechos, key=f"p_{paso}"):
            nuevos.add(paso)
    if nuevos != hechos:
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_text(json.dumps(sorted(nuevos), ensure_ascii=False))
    st.progress(len(nuevos) / len(PASOS), text=f"{len(nuevos)} de {len(PASOS)} pasos")
    if len(nuevos) == len(PASOS):
        st.success("Has completado la ruta. Lee docs/07-dinero-real.md antes de usar dinero real.")


def pagina_laboratorio():
    base = cfg_actual()
    st.title("🧪 Laboratorio de backtest")
    st.caption("Cambia los ajustes y mira qué habría pasado en el pasado. Nada de esto toca el bot en directo "
               "hasta que pulses «Guardar en config.yaml».")

    with st.form("ajustes"):
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            st.markdown("**Periodo**")
            desde = st.date_input("Desde", pd.Timestamp(base.backtest.desde), min_value=pd.Timestamp("2020-01-01"))
            hasta = st.date_input("Hasta", datetime.now(timezone.utc).date())
        with c2:
            st.markdown("**Estrategia**")
            rapida = st.slider("EMA rápida", 3, 100, base.estrategia.ema_rapida, help="Media de pocas velas: reacciona rápido.")
            lenta = st.slider("EMA lenta", 5, 300, base.estrategia.ema_lenta, help="Media de muchas velas: marca la dirección.")
            filtro = st.select_slider("EMA filtro (0 = sin filtro)", [0, 100, 150, 200, 300], base.estrategia.ema_filtro,
                                      help="Solo compra si el precio está por encima de esta media.")
        with c3:
            st.markdown("**Riesgo**")
            stop = st.slider("Stop-loss %", 1.0, 20.0, float(base.riesgo.stop_loss_pct), 0.5)
            riesgo = st.slider("Riesgo por operación %", 0.5, 10.0, float(base.riesgo.riesgo_por_operacion_pct), 0.5,
                               help="Cuánto pierdes como máximo si salta el stop.")
            capital = st.number_input("Capital inicial €", 10.0, 1_000_000.0, float(base.riesgo.capital_inicial), 10.0)
        with c4:
            st.markdown("**Costes**")
            comision = st.slider("Comisión %", 0.0, 1.0, float(base.costes.comision_pct), 0.05)
            slippage = st.slider("Slippage %", 0.0, 0.5, float(base.costes.slippage_pct), 0.01)
            robustez = st.checkbox("Incluir prueba de robustez (más lento)")
        enviado = st.form_submit_button("▶️ Ejecutar backtest", type="primary", width="stretch")

    if rapida >= lenta:
        st.error("La EMA rápida tiene que ser menor que la lenta.")
        return
    cambios = {"estrategia": {"ema_rapida": rapida, "ema_lenta": lenta, "ema_filtro": filtro},
               "riesgo": {"stop_loss_pct": stop, "riesgo_por_operacion_pct": riesgo, "capital_inicial": capital},
               "costes": {"comision_pct": comision, "slippage_pct": slippage}}
    if enviado or "lab" not in st.session_state:
        try:
            cfg = con_cambios(base, **cambios)
            velas = historial(cfg.mercado.simbolo, cfg.mercado.temporalidad, "2020-01-01")
            velas = velas[(velas.index >= pd.Timestamp(desde, tz="UTC")) & (velas.index < pd.Timestamp(hasta, tz="UTC") + pd.Timedelta(days=1))]
            with st.spinner("Ejecutando backtest..."):
                r = ejecutar_backtest(velas, cfg)
                rob = prueba_de_robustez(velas, cfg) if robustez else None
            st.session_state.lab = (r, cfg, rob, cambios)
        except Exception as e:
            st.error(str(e))
            return
    r, cfg, rob, cambios_usados = st.session_state.lab
    m = r.metricas

    st.subheader(f"Resultado del {m['desde']} al {m['hasta']} ({m['anos']:g} años)")
    c = st.columns(5)
    c[0].metric("Capital final", eur(m["capital_final"]), pct(m["rentabilidad_total_pct"]))
    c[1].metric("Comprar y mantener", eur(m["comprar_y_mantener_final"]), pct(m["comprar_y_mantener_pct"]))
    c[2].metric("Peor caída", pct(m["max_drawdown_pct"], False), f"mantener: {pct(m['comprar_y_mantener_max_drawdown_pct'], False)}",
                delta_color="off", help="La mayor caída desde un máximo. Cuanto menor, mejor.")
    c[3].metric("Operaciones", m["operaciones"], f"{m['tasa_acierto_pct']:.0f} % aciertos", delta_color="off")
    c[4].metric("Rentabilidad anual", pct(m["rentabilidad_anual_pct"]),
                f"FB {m['factor_beneficio']}".replace(".", ",") if m["factor_beneficio"] else None, delta_color="off",
                help="Media por año. FB = factor de beneficio (euros ganados ÷ euros perdidos).")

    with st.expander("🚦 ¿Es fiable este resultado?", expanded=True):
        for estado_s, titulo, explicacion in semaforo(m, cfg):
            st.markdown(f"{estado_s} **{titulo}** — {explicacion}")

    pares = emparejar_operaciones(r.operaciones)
    tabs = st.tabs(["📊 Precio y operaciones", "💰 Cuenta y caídas", "📅 Por año", "📋 Operaciones", "🧭 Robustez", "⚠️ Eventos"])
    with tabs[0]:
        meses = st.select_slider("Ver los últimos...", ["3 meses", "6 meses", "1 año", "2 años", "Todo"], "6 meses")
        velas_por_mes = {"1h": 720, "4h": 180, "1d": 30, "15m": 2880}[cfg.mercado.temporalidad]
        n = {"3 meses": 3, "6 meses": 6, "1 año": 12, "2 años": 24, "Todo": 10_000}[meses] * velas_por_mes
        st.plotly_chart(graficos.velas(r.velas.iloc[-n:], cfg, r.operaciones), width="stretch")
        st.caption("▲ compra · ▼ venta (naranja = cruce de medias, roja = stop-loss). Usa la rueda del ratón para hacer zoom.")
    with tabs[1]:
        st.plotly_chart(graficos.curva(r.curva, r.curva_comprar_y_mantener, cfg.riesgo.capital_inicial), width="stretch")
        st.caption("La línea azul es tu cuenta con el bot; la gris, comprar BTC el primer día y no tocarlo. "
                   "Abajo: cuánto llegó a caer cada una desde su mejor momento.")
    with tabs[2]:
        st.plotly_chart(graficos.por_ano(r.curva, r.curva_comprar_y_mantener), width="stretch")
    with tabs[3]:
        if pares:
            st.plotly_chart(graficos.distribucion(pares), width="stretch")
            tabla = pd.DataFrame(pares)[["entrada", "salida", "precio_entrada", "precio_salida", "invertido_eur", "pnl_eur", "pnl_pct", "motivo_salida", "duracion_dias"]]
            tabla["entrada"] = tabla["entrada"].str[:16].str.replace("T", " ")
            tabla["salida"] = tabla["salida"].str[:16].str.replace("T", " ")
            st.dataframe(tabla.iloc[::-1], width="stretch", hide_index=True, column_config={
                "entrada": "Entrada (UTC)", "salida": "Salida (UTC)", "motivo_salida": "Motivo de salida",
                "precio_entrada": st.column_config.NumberColumn("Precio entrada", format="%.0f"),
                "precio_salida": st.column_config.NumberColumn("Precio salida", format="%.0f"),
                "invertido_eur": st.column_config.NumberColumn("Invertido €", format="%.2f"),
                "pnl_eur": st.column_config.NumberColumn("Resultado €", format="%+.2f"),
                "pnl_pct": st.column_config.NumberColumn("Resultado %", format="%+.2f"),
                "duracion_dias": st.column_config.NumberColumn("Días", format="%.1f"),
            })
        else:
            st.info("No hubo operaciones con estos ajustes.")
    with tabs[4]:
        if rob:
            st.plotly_chart(graficos.mapa_robustez(rob), width="stretch")
            filas = [{"Variante": f"Stop {s} %", "Rentabilidad": pct(x["rentabilidad_total_pct"]), "Peor caída": pct(x["max_drawdown_pct"], False),
                      "Operaciones": x["operaciones"]} for s, x in rob["stops"].items()]
            for nombre, clave in [("Sin filtro de tendencia", "sin_filtro"), ("Costes al doble", "costes_dobles"), ("Sin costes", "sin_costes")]:
                x = rob[clave]
                filas.append({"Variante": nombre, "Rentabilidad": pct(x["rentabilidad_total_pct"]),
                              "Peor caída": pct(x["max_drawdown_pct"], False), "Operaciones": x["operaciones"]})
            st.dataframe(pd.DataFrame(filas), hide_index=True, width="stretch")
            st.caption("Si un ajuste solo funciona con números exactos, probablemente es casualidad (sobreajuste). "
                       "Lee docs/05-backtesting.md.")
        else:
            st.info("Marca «Incluir prueba de robustez» y vuelve a ejecutar.")
    with tabs[5]:
        st.code("\n".join(r.eventos) or "Sin eventos.", language=None)

    st.divider()
    if st.button("💾 Guardar estos ajustes en config.yaml (los usará el bot en directo)"):
        try:
            guardar_cambios(cambios_usados)
            st.success("Guardado. Reinicia el bot en directo para que use los ajustes nuevos.")
        except ValueError as e:
            st.error(str(e))


def pagina_directo():
    cfg = cfg_actual()
    st.title("🤖 Bot en directo")
    modo = st.segmented_control("Modo", list(MODOS), format_func=MODOS.get, default="simular") or "simular"
    simbolo = cfg.mercado.simbolo_testnet if modo == "testnet" else cfg.mercado.simbolo

    @st.fragment(run_every=60)
    def contenido():
        estado = leer_estado(modo)
        if not estado:
            st.info(f"El bot en modo **{modo}** todavía no se ha arrancado. Abre una terminal en la carpeta "
                    f"`trading-bot` y escribe:")
            st.code(f"python -m bot {modo}", language="bash")
            if modo != "simular":
                st.caption("Antes necesitas las claves en el archivo .env (docs/06-paper-trading.md).")
            return
        try:
            p = precio(simbolo)
            t = calcular_senales(recientes(simbolo, cfg.mercado.temporalidad), cfg.estrategia)
        except Exception as e:
            st.error(f"No se pudieron descargar los precios: {e}")
            return

        total = estado.capital_total(p)
        c = st.columns(4)
        c[0].metric("Valor total", eur(total), pct((total / cfg.riesgo.capital_inicial - 1) * 100))
        c[1].metric("Dinero libre", eur(estado.eur))
        c[2].metric("BTC", f"{estado.btc:.6f}", eur(estado.btc * p) if estado.btc else None, delta_color="off")
        c[3].metric("Apartado (regla x2)", eur(estado.apartado_eur))
        if estado.apagado:
            st.error(f"🛑 Bot APAGADO: {estado.motivo_apagado}")
        elif estado.pausa_hasta and pd.Timestamp(estado.pausa_hasta) > pd.Timestamp.now(tz="UTC"):
            st.warning(f"⏸️ En pausa por racha perdedora hasta {estado.pausa_hasta[:16]} UTC")

        d = diagnosticar(t, cfg, estado, p)
        st.subheader("🧠 Qué está pensando")
        caja(f"**{d.titular}**", d.tono)
        for linea in d.detalles:
            st.markdown(f"- {linea}")

        ops_tabla = leer_operaciones(modo)
        ops = tabla_a_operaciones(ops_tabla) if not ops_tabla.empty else []
        st.plotly_chart(graficos.velas(t.iloc[-240:], cfg, ops, estado, titulo=f"{simbolo} · últimos 40 días"), width="stretch")

        izq, der = st.columns([3, 2])
        with izq:
            st.subheader("📒 Diario de operaciones")
            if ops_tabla.empty:
                st.caption("Todavía no ha operado. Es normal: puede tardar días o semanas en aparecer una señal.")
            else:
                vista = ops_tabla[["fecha", "tipo", "precio", "cantidad_btc", "eur", "comision_eur", "pnl_eur", "motivo"]].copy()
                vista["fecha"] = vista["fecha"].str[:16].str.replace("T", " ")
                st.dataframe(vista.iloc[::-1], hide_index=True, width="stretch", column_config={
                    "fecha": "Fecha (UTC)", "tipo": "Tipo", "motivo": "Motivo",
                    "precio": st.column_config.NumberColumn("Precio", format="%.2f"),
                    "cantidad_btc": st.column_config.NumberColumn("BTC", format="%.6f"),
                    "eur": st.column_config.NumberColumn("€", format="%.2f"),
                    "comision_eur": st.column_config.NumberColumn("Comisión €", format="%.3f"),
                    "pnl_eur": st.column_config.NumberColumn("Resultado €", format="%+.2f"),
                })
                st.download_button("⬇️ Descargar CSV (para Hacienda)", ops_tabla.to_csv(index=False), f"operaciones_{modo}.csv")
        with der:
            st.subheader("📜 Últimas líneas del log")
            ruta_log = RAIZ / "resultados" / f"bot_{modo}.log"
            texto = "\n".join(ruta_log.read_text(encoding="utf-8").splitlines()[-25:]) if ruta_log.exists() else "Sin log todavía."
            st.code(texto, language=None, wrap_lines=True)
        st.caption(f"Se actualiza solo cada minuto · última actualización {datetime.now():%H:%M:%S}")

    contenido()


AYUDA = {
    "simbolo": "Par que se opera. BTC/EUR = comprar bitcoin pagando con euros.",
    "temporalidad": "Duración de cada vela. Más corta = más operaciones y más comisiones.",
    "simbolo_testnet": "Par que se usa en el testnet (allí casi no hay pares en EUR).",
    "ema_rapida": "Media de pocas velas. Reacciona rápido.",
    "ema_lenta": "Media de muchas velas. Marca la dirección.",
    "ema_filtro": "Solo compra si el precio está por encima de esta media. 0 = sin filtro.",
    "capital_inicial": "Dinero con el que opera el bot. En real, nunca usará más que esto.",
    "riesgo_por_operacion_pct": "Lo máximo que pierdes en una operación si salta el stop (% del capital).",
    "stop_loss_pct": "Venta automática si el precio cae este % desde la compra.",
    "max_posicion_pct": "Tope del capital que puede ir en una sola compra.",
    "orden_minima_eur": "Mínimo que acepta Binance por orden.",
    "perdida_maxima_diaria_pct": "Si hoy se pierde este %, no abre nada más hasta mañana.",
    "racha_perdedora_maxima": "Tras estas pérdidas seguidas, el bot hace una pausa.",
    "horas_de_pausa": "Duración de la pausa tras la racha perdedora.",
    "drawdown_maximo_pct": "Si el capital cae este % desde el inicio, el bot se apaga.",
    "objetivo_multiplicador": "Al multiplicar el capital por esto, aparta lo invertido (tu regla del x2).",
    "comision_pct": "Comisión del exchange por operación.",
    "slippage_pct": "Diferencia entre el precio que ves y el que te dan.",
    "intervalo_revision_segundos": "Cada cuántos segundos vigila el precio en directo.",
    "desde": "Fecha de inicio por defecto para los backtests.",
}

ETIQUETAS = {
    "simbolo": "Par", "temporalidad": "Temporalidad (duración de vela)", "simbolo_testnet": "Par en el testnet",
    "ema_rapida": "EMA rápida", "ema_lenta": "EMA lenta", "ema_filtro": "EMA de filtro (0 = sin filtro)",
    "capital_inicial": "Capital inicial (€)", "riesgo_por_operacion_pct": "Riesgo por operación (%)",
    "stop_loss_pct": "Stop-loss (%)", "max_posicion_pct": "Máximo por posición (%)", "orden_minima_eur": "Orden mínima (€)",
    "perdida_maxima_diaria_pct": "Pérdida máxima diaria (%)", "racha_perdedora_maxima": "Pérdidas seguidas para pausar",
    "horas_de_pausa": "Horas de pausa", "drawdown_maximo_pct": "Caída máxima para apagar (%)",
    "objetivo_multiplicador": "Multiplicador para apartar (x2)", "comision_pct": "Comisión (%)", "slippage_pct": "Slippage (%)",
    "intervalo_revision_segundos": "Revisar precio cada (segundos)", "desde": "Backtest desde (AAAA-MM-DD)",
}

TITULOS = {"mercado": "🏦 Mercado", "estrategia": "📐 Estrategia", "riesgo": "🛡️ Riesgo",
           "costes": "💸 Costes", "ejecucion": "⏱️ Ejecución", "backtest": "🧪 Backtest"}


def pagina_configuracion():
    cfg = cfg_actual()
    st.title("⚙️ Configuración")
    st.caption("Cambia aquí los ajustes del bot. Se guardan en config.yaml (sin borrar sus comentarios). "
               "Si el bot está funcionando, reinícialo para que los use.")
    cambios: dict[str, dict] = {}
    with st.form("config"):
        cols = st.columns(3)
        for i, (seccion, titulo) in enumerate(TITULOS.items()):
            obj = getattr(cfg, seccion)
            with cols[i % 3]:
                with st.container(border=True):
                    st.markdown(f"**{titulo}**")
                    cambios[seccion] = {}
                    for clave, valor in vars(obj).items():
                        etiqueta = ETIQUETAS.get(clave, clave.replace("_", " ").capitalize())
                        if clave == "temporalidad":
                            nuevo = st.selectbox(etiqueta, ["15m", "1h", "4h", "1d"], ["15m", "1h", "4h", "1d"].index(valor), help=AYUDA.get(clave))
                        elif isinstance(valor, bool):
                            nuevo = st.checkbox(etiqueta, valor, help=AYUDA.get(clave))
                        elif isinstance(valor, int):
                            nuevo = st.number_input(etiqueta, value=valor, step=1, help=AYUDA.get(clave))
                        elif isinstance(valor, float):
                            nuevo = st.number_input(etiqueta, value=valor, step=0.1 if valor < 10 else 1.0, format="%g", help=AYUDA.get(clave))
                        else:
                            nuevo = st.text_input(etiqueta, valor, help=AYUDA.get(clave))
                        if nuevo != valor:
                            cambios[seccion][clave] = nuevo
        guardar = st.form_submit_button("💾 Guardar", type="primary")
    if guardar:
        cambios = {s: v for s, v in cambios.items() if v}
        if not cambios:
            st.info("No has cambiado nada.")
        else:
            try:
                guardar_cambios(cambios)
                st.success("Guardado: " + ", ".join(f"{k} = {v}" for s in cambios.values() for k, v in s.items()))
            except ValueError as e:
                st.error(str(e))


def pagina_aprender():
    st.title("📚 Aprender")
    docs = sorted((RAIZ / "docs").glob("*.md"))
    nombres = {d: d.stem[3:].replace("-", " ").capitalize() for d in docs}
    elegido = st.radio("Capítulo", docs, format_func=lambda d: f"{d.stem[:2]} · {nombres[d]}", horizontal=True,
                       label_visibility="collapsed")
    texto = elegido.read_text(encoding="utf-8")
    # Los enlaces a otros capítulos no funcionan dentro del panel: se muestran en negrita
    texto = re.sub(r"\[([^\]]+)\]\((?!http)[^)]*\.md\)", r"**\1**", texto)
    partes = texto.split("![")
    st.markdown(partes[0], unsafe_allow_html=False)
    for parte in partes[1:]:
        alt, resto = parte.split("](", 1)
        ruta, despues = resto.split(")", 1)
        imagen = (elegido.parent / ruta).resolve()
        if imagen.exists():
            st.image(str(imagen), caption=alt)
        st.markdown(despues)


navegacion = st.navigation([
    st.Page(pagina_inicio, title="Inicio", icon="🏠", default=True),
    st.Page(pagina_directo, title="Bot en directo", icon="🤖", url_path="directo"),
    st.Page(pagina_laboratorio, title="Laboratorio", icon="🧪", url_path="laboratorio"),
    st.Page(pagina_configuracion, title="Configuración", icon="⚙️", url_path="configuracion"),
    st.Page(pagina_aprender, title="Aprender", icon="📚", url_path="aprender"),
])
with st.sidebar:
    st.caption("Herramienta para aprender. No es asesoramiento financiero. Resultados pasados no garantizan resultados futuros.")
navegacion.run()
