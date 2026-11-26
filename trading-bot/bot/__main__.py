"""Punto de entrada: los comandos que escribes en la terminal.

  python -m bot backtest              Prueba la estrategia con datos desde 2020
  python -m bot backtest --robustez   ...y además comprueba si el resultado es estable
  python -m bot simular               Bot en directo con dinero ficticio (sin cuenta)
  python -m bot testnet               Bot en directo en el testnet de Binance
  python -m bot real                  Bot con dinero REAL (bloqueado por defecto)
  python -m bot estado simular        Muestra cómo va el bot de ese modo
  python -m bot reiniciar simular     Borra el estado de ese modo y empieza de cero
"""
from __future__ import annotations

import argparse
import sys

from dotenv import load_dotenv

from .config import RAIZ, cargar_config


def cmd_backtest(args, cfg):
    from .backtest import ejecutar_backtest, prueba_de_robustez
    from .datos import obtener_historial
    from .informe import guardar_informe, resumen_consola

    desde = args.desde or cfg.backtest.desde
    print(f"Descargando/actualizando velas de {cfg.mercado.simbolo} {cfg.mercado.temporalidad} desde {desde}...")
    velas = obtener_historial(cfg.mercado.simbolo, cfg.mercado.temporalidad, desde)
    if args.hasta:
        velas = velas[velas.index < args.hasta]
    print(f"{len(velas)} velas cargadas ({velas.index[0]:%Y-%m-%d} → {velas.index[-1]:%Y-%m-%d}).")
    resultado = ejecutar_backtest(velas, cfg)
    robustez = None
    if args.robustez:
        print("Ejecutando prueba de robustez (unos 30 backtests)...")
        robustez = prueba_de_robustez(velas, cfg)
    print(resumen_consola(resultado, cfg))
    carpeta = guardar_informe(resultado, cfg, robustez)
    print(f"\nInforme completo, gráfico y operaciones en: {carpeta.relative_to(RAIZ)}/")


def _trader(cfg, modo):
    from .broker import crear_broker
    from .trader import Trader
    return Trader(cfg, crear_broker(cfg, modo), modo)


def cmd_directo(args, cfg):
    modo = args.comando
    if modo == "real":
        print("⚠️  MODO REAL: el bot va a operar con DINERO DE VERDAD.")
        print(f"    Usará como máximo {cfg.riesgo.capital_inicial:g} € (riesgo.capital_inicial).")
    trader = _trader(cfg, modo)
    if args.una_vez:
        trader.paso()
        print(trader.resumen())
        return
    print("Bot en marcha. Pulsa Ctrl+C para pararlo (el estado se guarda solo).")
    try:
        trader.bucle()
    except KeyboardInterrupt:
        trader.estado.guardar(trader.ruta_estado)
        print("\nBot parado. Estado guardado.")


def cmd_estado(args, cfg):
    print(_trader(cfg, args.modo).resumen())


def cmd_reiniciar(args, cfg):
    from .trader import CARPETA_ESTADO
    ruta = CARPETA_ESTADO / f"{args.modo}.json"
    if args.modo == "real":
        print("Por seguridad, el estado del modo real se borra a mano: " + str(ruta))
        return
    if ruta.exists():
        ruta.unlink()
        print(f"Estado de '{args.modo}' borrado. La próxima vez empezará con {cfg.riesgo.capital_inicial:g} €.")
    else:
        print("No había estado guardado.")


def main(argv=None):
    load_dotenv(RAIZ / ".env")
    p = argparse.ArgumentParser(prog="python -m bot", description="Bot de trading para aprender (BTC, spot, sin apalancamiento)")
    p.add_argument("--config", help="Ruta a otro archivo de configuración (por defecto config.yaml)")
    sub = p.add_subparsers(dest="comando", required=True)

    b = sub.add_parser("backtest", help="Probar la estrategia con datos históricos")
    b.add_argument("--desde", help="Fecha inicial, p. ej. 2021-01-01")
    b.add_argument("--hasta", help="Fecha final (no incluida), p. ej. 2024-01-01")
    b.add_argument("--robustez", action="store_true", help="Probar también con otros parámetros")
    b.set_defaults(func=cmd_backtest)

    for modo, ayuda in [("simular", "En directo con dinero ficticio, sin cuenta"),
                        ("testnet", "En directo en el testnet de Binance"),
                        ("real", "En directo con dinero real (bloqueado por defecto)")]:
        s = sub.add_parser(modo, help=ayuda)
        s.add_argument("--una-vez", action="store_true", help="Hacer una sola revisión y salir (útil con cron)")
        s.set_defaults(func=cmd_directo)

    for nombre, func, ayuda in [("estado", cmd_estado, "Ver cómo va el bot"),
                                ("reiniciar", cmd_reiniciar, "Empezar de cero un modo")]:
        s = sub.add_parser(nombre, help=ayuda)
        s.add_argument("modo", choices=["simular", "testnet", "real"])
        s.set_defaults(func=func)

    args = p.parse_args(argv)
    try:
        cfg = cargar_config(args.config)
        args.func(args, cfg)
    except (ValueError, RuntimeError) as e:
        print(f"\n❌ {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
