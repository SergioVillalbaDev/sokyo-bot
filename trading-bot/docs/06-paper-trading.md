# 06 · Paper trading: practicar en directo sin arriesgar dinero

**Paper trading** es operar "en papel": el bot funciona en tiempo real, con precios de verdad, pero con dinero ficticio. Es el paso entre el backtest (el pasado) y el dinero real.

¿Por qué no basta con el backtest? Porque en directo aparecen cosas que el backtest no ve: cortes de internet, errores de la API, el ordenador que se apaga, tú mismo poniéndote nervioso...

## Paso 1: modo `simular` (sin cuenta, recomendado para empezar)

```bash
python -m bot simular
```

- Usa los precios **reales** de Binance en directo.
- El dinero (20 € ficticios) vive en `estado/simular.json`, en tu ordenador.
- No necesitas cuenta ni claves.

Verás algo así:

```
2026-11-26 20:49:10  INFO    Bot arrancado en modo SIMULAR · BTC/EUR 4h · EMA 20/50 + filtro 200 · capital del bot 20.00
2026-11-26 20:49:11  INFO    Vela 2026-11-26T16:00 cerrada: precio 55279.01 | EMA20 54946.17 | EMA50 55919.33 | señal: ninguna
```

Después escribirá una línea nueva cada 4 horas, cuando cierre cada vela. **Es normal que pase días o semanas sin operar**: solo compra cuando hay un cruce de medias con la tendencia a favor.

Para ver cómo va (desde otra terminal):

```bash
python -m bot estado simular
```

Para empezar de cero: `python -m bot reiniciar simular`.

### Qué vigilar durante la simulación

Apunta en una libreta o una hoja de cálculo:

- Cada operación: ¿entiendes por qué la hizo? Mira `resultados/bot_simular.log` y el gráfico de un backtest reciente.
- ¿Las operaciones se parecen a las del backtest en el mismo periodo? Haz `python -m bot backtest --desde <fecha en que arrancaste>` y compara.
- ¿Ha habido errores en el log? (líneas con `ERROR`)
- ¿Cómo te sientes al ver pérdidas? Mejor descubrirlo con dinero ficticio.

**¿Cuánto tiempo?** Al menos 4 semanas. Lo ideal son 2 o 3 meses, porque con velas de 4 h puede haber muy pocas operaciones en un mes.

## Paso 2: modo `testnet` (el entorno de pruebas de Binance)

El **testnet** es una copia de Binance con dinero falso. Aquí el bot envía **órdenes de verdad** al sistema de Binance, así que pruebas también la conexión, las claves y cómo se ejecutan las órdenes.

### Crear las claves del testnet

1. Entra en **https://testnet.binance.vision**.
2. Inicia sesión con tu cuenta de **GitHub** (botón "Log In with GitHub").
3. Pulsa **"Generate HMAC_SHA256 Key"**, ponle un nombre (por ejemplo, `bot`) y genera la clave.
4. Copia la **API Key** y la **Secret Key**. La Secret solo se muestra una vez.
5. En la carpeta `trading-bot`, crea tu archivo `.env`:

   ```bash
   cp .env.example .env        # en Windows: copy .env.example .env
   ```

6. Abre `.env` y pega las claves:

   ```
   BINANCE_TESTNET_API_KEY=tu_api_key
   BINANCE_TESTNET_API_SECRET=tu_secret_key
   ```

7. Lanza el bot:

   ```bash
   python -m bot testnet
   ```

El testnet te da saldo ficticio automáticamente (varias monedas, incluido USDT). El bot opera **BTC/USDT** (`simbolo_testnet` en `config.yaml`), porque el testnet casi no tiene pares en euros, y usará como máximo `capital_inicial` (20 USDT).

### Cosas a saber del testnet

- Binance lo **reinicia de vez en cuando**: se borran saldos y órdenes. Si pasa, borra `estado/testnet.json` y vuelve a empezar.
- Los precios del testnet a veces son raros (hay poca gente operando). Sirve para probar que **todo funciona**, no para medir si la estrategia gana.
- La web y el sistema de claves pueden cambiar. Si algo no coincide con estos pasos, busca "Binance Spot Testnet" en la documentación de Binance.

## Criterios para pasar al siguiente paso

Antes de pasar a dinero real, deberías poder decir **sí** a todo esto:

- [ ] He leído toda la documentación y entiendo cada regla del bot.
- [ ] He ejecutado el backtest y los ejercicios de [05-backtesting.md](05-backtesting.md).
- [ ] El bot ha funcionado en `simular` al menos 4 semanas sin errores graves.
- [ ] He visto al menos una compra y una venta, y sé explicar por qué ocurrieron.
- [ ] He probado el `testnet` y las órdenes se ejecutan bien.
- [ ] Sé dónde está el diario de operaciones y cómo pararlo (`Ctrl + C`).
- [ ] Acepto que puedo perder los 20 € y no me afectaría.
