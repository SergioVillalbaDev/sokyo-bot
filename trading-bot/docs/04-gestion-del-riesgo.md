# 04 · Gestión del riesgo (lo más importante)

> "Los traders no quiebran por elegir una mala estrategia. Quiebran por arriesgar demasiado en ella."

La estrategia decide **cuándo** entrar. La gestión del riesgo decide **cuánto** meter y **cuándo parar**. Todo está en la sección `riesgo` de `config.yaml` y en el archivo `bot/riesgo.py`.

## 1. Tamaño de la posición: la regla del 2 %

En lugar de meter todo el dinero en cada compra, el bot calcula cuánto meter para que, **si salta el stop-loss, la pérdida sea como mucho el 2 % del capital**.

Ejemplo con tu cuenta de 20 €:

```
Riesgo máximo por operación = 20 € × 2 %        = 0,40 €
Stop-loss                    = 5 % por debajo de la compra
Tamaño de la compra          = 0,40 € ÷ 5 %     = 8 €
```

Si compra 8 € de BTC y el precio cae un 5 %, pierdes 0,40 €. Con este tamaño necesitarías **50 pérdidas seguidas** para quedarte a cero. Si metieras los 20 € enteros, cada stop-loss te costaría 1 €.

Opciones en `config.yaml`:

- `riesgo_por_operacion_pct: 2`: cuánto arriesgar por operación. Lo habitual entre profesionales es entre el 0,5 % y el 2 %.
- `max_posicion_pct: 100`: tope del capital que puede ir en una sola compra.
- `orden_minima_eur: 5`: Binance no acepta órdenes muy pequeñas (unos 5 €). Si el cálculo sale por debajo, el bot no compra.

> **El problema de las cuentas pequeñas.** Con 20 €, un riesgo del 2 % y un stop amplio (por ejemplo, del 12 %), la compra saldría de 3,33 €, por debajo del mínimo, y el bot no podría operar. Es una limitación real de empezar con poco dinero: lo verás en la prueba de robustez del backtest.

## 2. Stop-loss

El **stop-loss** es una venta automática si el precio cae un % desde la compra (`stop_loss_pct: 5`). Corta las pérdidas antes de que crezcan.

- **Stop muy ajustado** (2 %): salta con cualquier movimiento normal, así que tendrás muchas pérdidas pequeñas.
- **Stop muy amplio** (15 %): salta poco, pero cada vez que salta duele mucho.

**Límites del stop en este bot:**

- El bot lo vigila cada 60 segundos. Si el precio cae muy rápido, venderá algo por debajo del stop.
- **Si el bot está apagado, no hay stop.** No deja una orden de stop puesta en Binance; lo vigila él. Por eso hay que tenerlo siempre encendido cuando tiene una posición abierta (ver [10-siguientes-pasos.md](10-siguientes-pasos.md)).

## 3. Frenos de emergencia (circuit breakers)

Igual que la bolsa para la cotización cuando hay caídas extremas, el bot tiene frenos:

| Freno | Ajuste | Qué hace |
|---|---|---|
| Pérdida máxima diaria | `perdida_maxima_diaria_pct: 4` | Si hoy ya se ha perdido un 4 %, no abre nada más hasta mañana (UTC) |
| Racha perdedora | `racha_perdedora_maxima: 3`, `horas_de_pausa: 48` | Tras 3 pérdidas seguidas, descansa 48 h. Evita seguir operando en un mercado lateral que no le va bien |
| Drawdown máximo | `drawdown_maximo_pct: 30` | Si el capital cae un 30 % desde el inicio (20 € → 14 €), **se apaga** y te avisa. Tendrás que revisar qué pasa y reiniciarlo tú |

Los frenos **no cierran** posiciones abiertas, solo impiden abrir nuevas. Para cerrar ya están el stop-loss y la señal de venta.

## 4. Tu regla del x2

`objetivo_multiplicador: 2`: cuando el capital del bot llega al doble (40 €), el bot **aparta los 20 € iniciales** y sigue operando solo con las ganancias. A partir de ahí, lo que estás arriesgando ya no es tu dinero, sino lo que has ganado.

- En **simular** y **testnet**, el dinero apartado se marca y el bot deja de usarlo.
- En **real**, el bot no puede sacar dinero de Binance (y no debe poder: la clave de API no tiene permiso de retiro, por seguridad). Te avisa para que lo retires tú, y mientras tanto no lo toca.
- Solo aparta cuando no hay una posición abierta, para no tener que vender a mitad de una subida.

Con la estrategia por defecto, en el backtest de 2020 a 2026 **no llegó a cumplirse**. Duplicar el dinero con poco riesgo lleva mucho tiempo. Es normal.

## 5. Por qué tanto freno

Porque el mayor riesgo para un principiante no es la estrategia, sino **las emociones**: subir el riesgo tras una racha mala para "recuperar", o meter más dinero tras una racha buena. Los frenos están para que el bot no haga lo que haría una persona nerviosa.

**Recomendación:** no toques `riesgo_por_operacion_pct` por encima de 2 ni quites los frenos hasta que lleves meses con el bot y entiendas sus rachas.
