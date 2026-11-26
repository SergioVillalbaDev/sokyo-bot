# 10 · Siguientes pasos

## Tener el bot encendido 24/7

El bot vigila el stop-loss **solo mientras está encendido**. Opciones, de más fácil a más profesional:

| Opción | Coste | Ventajas | Inconvenientes |
|---|---|---|---|
| Tu ordenador | 0 € | Fácil | Si lo apagas o se suspende, el bot para |
| Raspberry Pi en casa | ~60 € una vez | Consume poco y está siempre encendida | Hay que configurarla |
| Servidor en la nube (VPS) | ~4-6 €/mes | Siempre encendido, IP fija | **Con 20 € de capital, el servidor cuesta más de lo que ganará el bot** |

**Recomendación:** mientras sea `simular` o 20 € reales, usa tu ordenador y evita que se suspenda. Si el bot se apaga, al volver a arrancar recuerda la posición y sigue.

Para dejarlo funcionando en un servidor Linux aunque cierres la terminal:

```bash
# Opción sencilla: tmux (una terminal que sigue viva aunque te desconectes)
tmux new -s bot
source .venv/bin/activate && python -m bot simular
# Para salir sin pararlo: Ctrl+B y luego D.  Para volver: tmux attach -t bot
```

## Mejorar la estrategia (como ejercicio)

Ideas para investigar. Pruébalas **siempre** con backtest, robustez y periodo de prueba aparte (ver [05-backtesting.md](05-backtesting.md)):

- **Stop dinámico con ATR**: el ATR mide cuánto se mueve el precio normalmente. Un stop de "2 × ATR" se adapta a la volatilidad.
- **Trailing stop**: un stop que sube cuando sube el precio, para proteger las ganancias.
- **Otras criptomonedas**: ETH/EUR. ¿Funciona igual? ¿Repartir entre BTC y ETH reduce las caídas?
- **Velas diarias**: menos operaciones y menos comisiones.

Puedes pedirle ayuda a Claude con cualquiera de estas ideas. La skill `position-sizer` (en `.claude/skills/`) sirve para calcular tamaños de posición con ATR o Kelly.

## Futuros y apalancamiento (solo en testnet)

Cuando domines el modo spot, puedes experimentar con futuros en el **testnet de futuros** de Binance para ver en directo cómo el apalancamiento amplifica ganancias y pérdidas. Reglas si lo haces:

- Empieza siempre con dinero ficticio.
- Apalancamiento bajo (2x-3x como mucho).
- Entiende antes qué es el *precio de liquidación* y la *tasa de financiación* (funding).

Este bot no lo incluye a propósito: primero hay que dominar lo básico.

## Invertir a largo plazo (lo que más importa)

El bot es para **aprender** con una cantidad pequeña. Para que tus ahorros crezcan, lo más fiable para casi todo el mundo es mucho más aburrido:

1. **Fondo de emergencia**: 3-6 meses de gastos en una cuenta remunerada.
2. **Sin deudas caras** (tarjetas de crédito, préstamos personales).
3. **Aportación mensual automática a un fondo indexado global** (por ejemplo, uno que replique el MSCI World). Ya incluye Apple, Nvidia, Microsoft y otras ~1.500 empresas.
4. Si quieres, **una parte pequeña** en acciones concretas o en cripto.
5. **Una parte muy pequeña** para experimentar: este bot.

Esto es información general, no una recomendación personalizada.

## Para seguir aprendiendo

- Lee el código en este orden: `indicadores.py` → `estrategia.py` → `riesgo.py` → `cuenta.py` → `backtest.py` → `trader.py`.
- Cambia un número en `config.yaml`, repite el backtest y explica con tus palabras por qué ha cambiado el resultado. Es la mejor forma de aprender.
- Ejecuta `python -m pytest -q tests` después de cambiar cualquier cosa del código.
