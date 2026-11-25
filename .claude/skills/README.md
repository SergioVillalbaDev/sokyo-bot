# Skills de trading para Claude

Skills copiadas de [tradermonty/claude-trading-skills](https://github.com/tradermonty/claude-trading-skills)
(licencia MIT, commit `4080042`, 2026-11-22). Solo usan la librería estándar de Python,
no necesitan claves de API y no se conectan a internet.

| Skill | Para qué sirve |
|---|---|
| `position-sizer` | Calcula cuánto comprar en una operación según el riesgo (regla del 1 %, ATR, Kelly). Admite fracciones (`--fractional`), útil para cripto o cuentas pequeñas. |
| `backtest-expert` | Metodología para validar estrategias y un script que puntúa un backtest y avisa de señales de alarma (pocas operaciones, sin comisiones, resultados "demasiado buenos"…). |

Los informes se guardan en `reports/` (ignorado por git).

> Herramientas educativas y de análisis. No son asesoramiento financiero ni ejecutan órdenes.
