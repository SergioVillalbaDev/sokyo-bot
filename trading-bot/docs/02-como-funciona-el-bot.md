# 02 · Cómo funciona el bot por dentro

## Mapa del proyecto

```
trading-bot/
├── config.yaml          ← TODOS los ajustes del bot (empieza por aquí)
├── .env.example         ← plantilla para tus claves secretas (se copia a .env)
├── requirements.txt     ← librerías que hay que instalar
├── bot/                 ← el código
│   ├── __main__.py      ← los comandos: backtest, simular, testnet, real, estado...
│   ├── config.py        ← lee y valida config.yaml
│   ├── datos.py         ← descarga las velas de Binance
│   ├── indicadores.py   ← fórmulas (la media móvil exponencial, EMA)
│   ├── estrategia.py    ← reglas de compra y venta
│   ├── riesgo.py        ← cuánto comprar, stop-loss, frenos de emergencia, regla x2
│   ├── cuenta.py        ← saldo, posición abierta, comisiones
│   ├── backtest.py      ← simulación con datos del pasado
│   ├── informe.py       ← informe, gráfico y semáforo del backtest
│   ├── analisis.py      ← "qué está pensando el bot", traducido a frases
│   ├── panel.py         ← el panel web (python -m bot panel)
│   ├── graficos.py      ← gráficos interactivos del panel
│   ├── consola.py       ← colores y tablas en la terminal
│   ├── broker.py        ← ejecuta órdenes (simuladas o en Binance)
│   ├── trader.py        ← el bucle en directo
│   └── registro.py      ← log, diario de operaciones y Telegram
├── tests/               ← pruebas automáticas
├── docs/                ← esta documentación
├── datos/               ← (se crea solo) velas descargadas
├── resultados/          ← (se crea solo) informes, logs y diario de operaciones
└── estado/              ← (se crea solo) el estado del bot en directo
```

## Las piezas y cómo se conectan

```
                ┌────────────┐
                │ config.yaml│  ← tú decides los números
                └─────┬──────┘
                      ▼
 ┌──────────┐   ┌──────────────┐   ┌───────────────┐
 │ datos.py │──▶│ estrategia.py│──▶│   riesgo.py   │
 │ (velas)  │   │ (¿señal?)    │   │ (¿cuánto? ¿se │
 └──────────┘   └──────────────┘   │  puede ahora?)│
                                   └───────┬───────┘
                       ┌───────────────────┴───────────────────┐
                       ▼                                       ▼
               ┌──────────────┐                         ┌─────────────┐
               │ backtest.py  │  pasado                 │ trader.py   │  presente
               │ simula órdenes│                        │ + broker.py │
               └──────┬───────┘                         └──────┬──────┘
                      ▼                                        ▼
               informe.md + gráfico                 log + diario + Telegram
```

La clave del diseño: **el backtest y el bot en directo usan exactamente la misma estrategia y el mismo gestor de riesgo**. Lo que pruebas con datos antiguos es lo mismo que luego opera. Muchos bots fallan porque el código del backtest y el del bot real son distintos.

## Los 3 modos en directo

| Modo | Precios | Dinero | Necesitas |
|---|---|---|---|
| `simular` | Reales, de Binance | Ficticio, guardado en tu ordenador | Nada |
| `testnet` | Los del testnet (pueden ser raros) | Ficticio, en el testnet de Binance | Claves del testnet |
| `real` | Reales | **Real** | Cuenta de Binance, claves y `CONFIRMO_DINERO_REAL=si` |

Cada modo guarda su propio estado (`estado/simular.json`, `estado/testnet.json`, `estado/real.json`), así que no se mezclan.

## Qué hace el bot en directo, minuto a minuto

Cada 60 segundos (`intervalo_revision_segundos`):

1. **Mira el precio.**
2. **Vigila el stop-loss**: si tiene BTC y el precio ha caído por debajo del stop, vende.
3. **¿Ha cerrado una vela de 4 h nueva?** Si es así:
   - pide las últimas 1000 velas cerradas,
   - calcula las medias y la señal,
   - si hay **señal de compra**, no tiene BTC y los frenos lo permiten → **compra**,
   - si hay **señal de venta** y tiene BTC → **vende**.
4. Revisa la **regla del x2** y el **freno de drawdown**.
5. **Guarda el estado** en `estado/<modo>.json`.

Si apagas el ordenador con una posición abierta, el bot la recuerda al volver a arrancar. **Pero mientras está apagado no vigila el stop-loss.** Ver [10-siguientes-pasos.md](10-siguientes-pasos.md) para tenerlo encendido siempre.

## Lo que verás en pantalla

```
2026-11-26 20:00:05  INFO    Vela 2026-11-26T16:00 cerrada: precio 55279.01 | EMA20 54946.17 | EMA50 55919.33 | señal: ninguna
```

Significa: a las 20:00 cerró la vela que empezó a las 16:00 (hora UTC). El precio cerró en 55.279 €, la EMA rápida está por debajo de la lenta y no hay señal. El bot no hace nada y espera.

> **Ojo con la hora**: el bot trabaja en **UTC** (hora universal). En España es UTC+1 en invierno y UTC+2 en verano.

## Archivos que genera

- `resultados/bot_simular.log`: todo lo que ha pensado y hecho el bot.
- `resultados/operaciones_simular.csv`: cada compra y venta. Se abre con Excel o Google Sheets.
- `resultados/backtest_<fecha>/`: informe, gráfico y operaciones de cada backtest.

## Cómo leer el código

Si quieres entender el código, léelo en este orden: `indicadores.py` → `estrategia.py` → `riesgo.py` → `cuenta.py` → `backtest.py` → `trader.py`. Cada archivo empieza con un comentario largo que explica qué hace y por qué.
