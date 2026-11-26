# 05 · Backtesting: probar con el pasado sin engañarse

## Qué es

Un **backtest** es una "máquina del tiempo": el bot recorre los precios de los últimos años vela a vela, como si estuvieran ocurriendo en directo, y toma las mismas decisiones que tomaría hoy. Al final sabes:

- cuánto habría ganado o perdido,
- cuántas veces acertó,
- **lo peor que lo habrías pasado**.

```bash
python -m bot backtest              # backtest normal
python -m bot backtest --robustez   # + prueba de robustez (tarda un poco más)
```

## Las 4 trampas que este backtest evita

1. **Mirar al futuro** (*look-ahead bias*). Si el bot decidiera con el precio de cierre y comprara a ese mismo precio, estaría usando información que en la realidad aún no tendría. Aquí la señal se calcula al cierre de una vela y la compra se hace en la **apertura de la siguiente**. Hay un test automático (`test_resultado_no_depende_del_futuro`) que lo comprueba.
2. **Olvidar los costes.** Cada operación paga comisión (0,1 %) y slippage (0,05 %).
3. **Stops mágicos.** Si el precio abre ya por debajo del stop (un "hueco"), el backtest vende a la apertura, que es peor que el stop. En la vida real pasa.
4. **Reglas distintas en el backtest y en directo.** Aquí se usa el mismo código para los dos.

## Resultados con la configuración por defecto

BTC/EUR, velas de 4 h, del 3 de enero de 2020 al 26 de noviembre de 2026, empezando con 20 €:

| | Bot | Comprar BTC y no tocarlo |
|---|---|---|
| Capital final | 29,72 € | 176,79 € |
| Rentabilidad total | +48,6 % | +783,9 % |
| Rentabilidad media anual | +5,9 % | |
| **Peor caída** | **22 %** | **74 %** |
| Operaciones | 74 (26 % de acierto) | 1 |
| Tiempo con BTC comprado | 28 % | 100 % |

Por año: 2020 +24 %, 2021 +5 %, 2022 −8 %, 2023 +2 %, 2024 +30 %, 2025 −8 %, 2026 +3 %.

### Cómo interpretarlo (con honestidad)

- **El bot gana dinero, pero mucho menos que comprar y mantener.** BTC ha subido muchísimo desde 2020 y el bot solo estuvo dentro el 28 % del tiempo, con posiciones pequeñas por la regla del 2 %.
- **A cambio, sufre mucho menos.** Comprando y manteniendo, hubo un momento en que tus 20 € habrían pasado a valer un 74 % menos que en su máximo. Con el bot, la peor caída fue del 22 %.
- **No es una máquina de hacer dinero.** Es un sistema con reglas claras, ganancias modestas y riesgo controlado. Si alguien te enseña un bot que gana un 500 % al año con poco riesgo, desconfía.

> Que haya funcionado entre 2020 y 2026 **no garantiza** que funcione después. El mercado cambia.

## El informe

Cada backtest crea una carpeta `resultados/backtest_<fecha>/` con:

- `informe.md`: todas las métricas, el semáforo, la robustez y la lista de operaciones. Ábrelo con VS Code o cualquier visor de Markdown.
- `grafico.png`: arriba, el precio con las medias y las compras (▲ verde) y ventas (▼ naranja si fue por cruce, roja si saltó el stop). Abajo, el valor de tu cuenta frente a comprar y mantener.
- `operaciones.csv`: cada compra y venta, para abrirla en Excel.

## Qué significa cada métrica

| Métrica | Qué es | Qué buscar |
|---|---|---|
| Rentabilidad total | Cuánto ha crecido el dinero | Compárala siempre con comprar y mantener |
| Rentabilidad media anual | La rentabilidad repartida por año (CAGR) | Un fondo indexado global ha dado históricamente un 7-10 % anual |
| Peor caída (drawdown) | La mayor caída desde un máximo | ¿Aguantarías verla sin apagar el bot? |
| Tasa de acierto | % de operaciones ganadoras | En seguimiento de tendencia, un 25-40 % es normal |
| Ganancia media / pérdida media | Tamaño medio de las ganadoras y de las perdedoras | La ganancia media debe ser bastante mayor que la pérdida media |
| Esperanza por operación | Lo que se gana de media por operación, contando todas | Debe ser positiva |
| Factor de beneficio | Euros ganados ÷ euros perdidos | Más de 1 = gana. Más de 1,5 = sólido |
| Tiempo en mercado | % del tiempo con BTC comprado | Menos tiempo dentro significa menos exposición al riesgo |

## El semáforo: ¿es fiable el resultado?

Al final de cada backtest verás 🟢 🟡 🔴. Está basado en la metodología de la skill `backtest-expert`:

- **Operaciones**: con menos de 30, el resultado puede ser suerte. Con 100 o más es más fiable.
- **Años**: hay que pasar por mercados alcistas, bajistas y laterales. Mínimo 5 años.
- **Años en positivo**: si todo se gana en un único año bueno, depende de la suerte.
- **¿Mejor que comprar y mantener?** Si no, el bot tiene que justificarse por otra cosa, como una caída mucho menor.

## Prueba de robustez y sobreajuste

Con `--robustez`, el bot repite el backtest con ~30 combinaciones distintas: otras medias, otros stops, sin filtro, costes al doble...

**¿Por qué?** Por el **sobreajuste** (*overfitting*): si pruebas cientos de combinaciones, alguna saldrá espectacular por pura casualidad. Esa combinación "encaja" con el pasado, pero no tiene nada especial para el futuro.

Lo que buscamos es una **meseta**: que muchas combinaciones parecidas funcionen razonablemente, no un pico aislado.

### Ejemplo real con estos datos

En la rejilla de 2020-2026, las medias más lentas (EMA lenta de 80-100) ganaron más que la 20/50 por defecto. ¿Habría que cambiarlas? Hagamos la prueba correcta:

1. Elegimos la mejor combinación usando **solo los datos de 2020 a 2023** (como si estuviéramos en enero de 2024).
2. La probamos en **2024-2026**, datos que "no hemos visto".

| Combinación | 2020-2023 (para elegir) | 2024-2026 (prueba) |
|---|---|---|
| 30/100 (la mejor en 2020-2023) | +121 % | +32 % |
| 20/80 (la segunda mejor) | +114 % | +18 % |
| 20/50 (por defecto) | +21 % | +14 % |
| 10/40 (**la peor** en 2020-2023) | −3 % | **+33 %** |

La mejor del pasado siguió siendo positiva, pero **la peor del pasado fue la mejor del futuro**. Ordenar combinaciones por su resultado pasado predice poco. Por eso este bot usa unos valores clásicos (20/50) en lugar de los "óptimos".

### Ejercicio: hazlo tú

```bash
python -m bot backtest --hasta 2024-01-01                       # "entrenamiento"
python -m bot backtest --desde 2023-10-01                       # "prueba" (empieza antes para calcular la EMA 200)
```

Cambia `ema_lenta` en `config.yaml` y repite. Apunta los resultados en una tabla. ¿Los mejores del primer periodo son también los mejores del segundo?

## Más ejercicios

1. Pon `stop_loss_pct: 3` y luego `8`. ¿Qué pasa con el número de operaciones y la peor caída?
2. Pon `capital_inicial: 1000`. ¿Cambia el resultado en %? (Pista: casi nada. El % no depende de cuánto dinero tengas, salvo cuando el mínimo de 5 € por orden impide operar con cuentas muy pequeñas.)
3. Pon `comision_pct: 0.5`. ¿Sigue siendo rentable? Así de importantes son los costes.
4. Cambia `temporalidad` a `1d` (velas diarias). ¿Más o menos operaciones? ¿Mejor o peor?
5. Cambia `simbolo` a `ETH/EUR`. ¿Funciona igual en otra criptomoneda?

## Sobre la skill backtest-expert

En `.claude/skills/backtest-expert/` tienes una skill para Claude con la metodología completa (en inglés). Si le pides a Claude "evalúa este backtest", la usará para puntuarlo y señalar problemas.
