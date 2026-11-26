# 03 · La estrategia: cruce de medias móviles

## La idea en una frase

> "Cuando el precio empieza a subir con fuerza, súbete. Cuando la subida se acaba, bájate."

Esto se llama **seguimiento de tendencia** (*trend following*). No intenta adivinar el futuro: reacciona a lo que el precio ya está haciendo.

## La media móvil exponencial (EMA)

Una **media móvil** es el precio medio de las últimas N velas. Con 20 velas de 4 h, es el precio medio de los últimos ~3 días y medio. Cada vez que cierra una vela nueva, la media "se mueve": entra la vela nueva y sale la más antigua.

La **exponencial** (EMA) da más peso a las velas recientes, así que reacciona antes a los cambios.

```
EMA_hoy = precio_hoy × k + EMA_ayer × (1 − k)        con k = 2 / (N + 1)
```

Para N = 20, k = 0,095: el precio de hoy pesa un 9,5 % y el resto viene de la media anterior.

- **EMA rápida (20)**: sigue al precio de cerca.
- **EMA lenta (50)**: se mueve despacio y marca la dirección general.
- **EMA de filtro (200)**: muy lenta; dice si el mercado es alcista "a lo grande".

## Las reglas exactas

**COMPRA** cuando, al cerrar una vela, se cumplen las dos cosas:

1. La EMA 20 **cruza por encima** de la EMA 50. Es decir, en la vela anterior estaba por debajo y en esta está por encima.
2. El precio está **por encima de la EMA 200** (filtro de tendencia).

**VENDE** cuando:

- la EMA 20 **cruza por debajo** de la EMA 50, **o**
- salta el **stop-loss** (el precio cae un 5 % desde la compra).

```
precio
  │                  ╭──╮  ← vende aquí: la rápida cruza hacia abajo
  │              ╭──╯    ╲
  │   rápida ── ╱          ╲
  │   lenta  ··╳··········· ╳·····
  │          ╱  ↑             ╲
  │  ───────╯   compra aquí: la rápida cruza hacia arriba
  └────────────────────────────────── tiempo
```

## ¿Por qué el filtro de la EMA 200?

Sin filtro, el bot compraría cada pequeño rebote en mitad de una caída larga (como en 2022). El filtro dice: "solo compro rebotes si el mercado de fondo es alcista".

En el backtest con datos de 2020 a 2026, quitar el filtro **ganó más** pero con una **peor caída**. Ninguna opción es gratis: menos riesgo suele significar menos ganancia. Compruébalo tú: pon `ema_filtro: 0` en `config.yaml` y repite el backtest.

## Por qué acierta "solo" un 26 % de las veces (y no pasa nada)

En el backtest, el bot gana en 1 de cada 4 operaciones. Parece malo, pero:

- cuando **pierde**, pierde poco (de media −3,7 %, porque el stop-loss corta),
- cuando **gana**, gana mucho (de media +17,6 %, porque deja correr las subidas).

```
3 pérdidas × −3,7 % = −11,1 %
1 ganancia  × +17,6 % = +17,6 %
                         ───────
Resultado de 4 operaciones: +6,5 %
```

Esta es la filosofía del seguimiento de tendencia: **"corta las pérdidas rápido y deja correr las ganancias"**. Lo importante no es cuántas veces aciertas, sino cuánto ganas cuando aciertas comparado con cuánto pierdes cuando fallas.

> Psicológicamente es muy duro: verás muchas pérdidas pequeñas seguidas. Ahí es donde la gente apaga el bot... justo antes de la operación buena. Por eso hay que entender esto **antes** de empezar.

## Cuándo funciona mal

- **Mercados laterales**: el precio sube y baja sin dirección, las medias se cruzan una y otra vez, y cada cruce es una pequeña pérdida más las comisiones. Se llama *whipsaw* ("latigazo").
- **Caídas bruscas**: si BTC cae un 15 % en una hora, el stop del −5 % se ejecuta más abajo de lo previsto (lo verás en el backtest como pérdidas de −5,2 % o peores).
- **Llega tarde**: las medias necesitan tiempo para cruzarse, así que nunca compra en el mínimo ni vende en el máximo. Se pierde el principio y el final de cada subida.

## Los parámetros que puedes tocar

En `config.yaml`, sección `estrategia`:

| Parámetro | Qué pasa si lo SUBES | Qué pasa si lo BAJAS |
|---|---|---|
| `ema_rapida` | Menos operaciones, reacciona más tarde | Más operaciones, más falsas alarmas |
| `ema_lenta` | Se queda más tiempo en cada tendencia | Sale antes, más operaciones |
| `ema_filtro` | Más exigente para comprar | Compra más (0 = sin filtro) |

**Antes de cambiar nada, lee la parte de *sobreajuste* en [05-backtesting.md](05-backtesting.md).** Es muy fácil encontrar los números que mejor habrían funcionado en el pasado, y eso casi nunca significa que vayan a funcionar en el futuro.
