# 01 · Conceptos básicos

Lo mínimo que hay que entender antes de tocar nada.

## Trading frente a inversión

- **Invertir** es comprar algo y mantenerlo años porque crees que valdrá más (por ejemplo, un fondo indexado).
- **Hacer trading** es comprar y vender con más frecuencia para aprovechar movimientos del precio.

El trading parece más emocionante, pero la mayoría de quienes lo practican **pierde** frente a simplemente invertir y esperar. Este bot sirve para aprender cómo funciona por dentro, con reglas claras y riesgo controlado.

## Bitcoin (BTC) y el par BTC/EUR

**Bitcoin** es una criptomoneda: un activo digital cuyo precio sube y baja según la oferta y la demanda. Es muy **volátil**: puede moverse un 5 % en un día y un 50 % en meses.

Un **par** indica qué compras y con qué pagas. `BTC/EUR` significa comprar BTC pagando con euros. El precio de `BTC/EUR = 55.000` quiere decir que 1 BTC cuesta 55.000 €.

No hace falta comprar un bitcoin entero: puedes comprar **0,0001 BTC** (unos 5,50 € a ese precio). Por eso se puede empezar con 20 €.

## Exchange

Un **exchange** es la "casa de cambio" donde compras y vendes criptomonedas: Binance, Kraken, Bitvavo, Coinbase... El bot está hecho para **Binance**, aunque la librería que usa (`ccxt`) permite cambiar a otro con pocos ajustes.

Los exchanges ofrecen una **API**: una puerta para que un programa (el bot) opere sin que tengas que pulsar botones. Para usarla necesitas una **clave de API** (API key), que es como una contraseña solo para programas.

## Spot, futuros y apalancamiento

- **Spot** (contado): compras el BTC de verdad. Si baja, pierdes como mucho lo que has metido. **Es lo que usa este bot.**
- **Futuros**: apuestas sobre el precio sin tener el BTC. Permiten apostar a que baja ("ponerse corto").
- **Apalancamiento** (por ejemplo, 10x): el exchange te presta dinero para mover 10 veces más. Las ganancias se multiplican, pero las pérdidas también. Con 10x, una caída del 10 % **te borra la cuenta entera** (eso se llama *liquidación*).

Este bot **no usa apalancamiento**. Cuando hayas aprendido, en [10-siguientes-pasos.md](10-siguientes-pasos.md) se explica cómo probarlo solo en el testnet.

## Órdenes

- **Orden a mercado**: "cómprame ya al precio que haya". Es instantánea, pero no controlas el precio exacto. **El bot usa estas.**
- **Orden limitada**: "cómprame solo si el precio baja a X". Controlas el precio, pero puede no ejecutarse nunca.

## Los costes invisibles

1. **Comisión**: el exchange cobra por cada operación. En Binance spot es ~0,1 % de cada compra y de cada venta. Con 10 € pagas 0,01 €, que parece poco, pero si operas mucho se acumula.
2. **Spread**: la diferencia entre el mejor precio de compra y el de venta en ese momento.
3. **Slippage** (deslizamiento): la diferencia entre el precio que ves y el que te dan de verdad, porque el precio se mueve mientras se ejecuta la orden.

El bot cuenta todos estos costes en el backtest (`costes` en `config.yaml`). Un backtest sin costes es un backtest que te miente.

## Velas (candlesticks)

El precio se representa con **velas**. Cada una resume un periodo de tiempo:

```
      │  ← máximo: el precio más alto del periodo
    ┌─┴─┐
    │   │ ← cuerpo: entre apertura y cierre
    │   │   verde si cerró más arriba de donde abrió (subió)
    └─┬─┘   rojo si cerró más abajo (bajó)
      │  ← mínimo: el precio más bajo del periodo
```

La **temporalidad** es cuánto tiempo resume cada vela. Este bot usa velas de **4 horas** (6 al día). Con velas más cortas (1 minuto) hay mucho más ruido y muchas más operaciones, y las comisiones se lo comen todo.

## Tendencia, volatilidad y mercado lateral

- **Tendencia alcista**: el precio hace máximos y mínimos cada vez más altos.
- **Tendencia bajista**: al revés.
- **Mercado lateral**: el precio sube y baja sin ir a ningún sitio. **Es el peor escenario para este bot** (ver [03-estrategia.md](03-estrategia.md)).
- **Volatilidad**: cuánto se mueve el precio. Más volatilidad significa más oportunidades y más riesgo.

## Ganancia, pérdida y drawdown

- **P&L** (*profit and loss*): ganancia o pérdida de una operación.
- **Rentabilidad**: ganancia en porcentaje. De 20 € a 22 € es un +10 %.
- **Drawdown**: la caída desde el punto más alto de tu cuenta. Si llegaste a 30 € y bajaste a 24 €, tu drawdown es del 20 %.

**La asimetría de las pérdidas** es de lo más importante que vas a aprender:

| Si pierdes... | ...necesitas ganar esto para recuperarte |
|---|---|
| 10 % | 11 % |
| 25 % | 33 % |
| 50 % | 100 % |
| 75 % | 300 % |
| 90 % | 900 % |

Por eso el bot se centra en **no perder mucho**, antes que en ganar mucho.
