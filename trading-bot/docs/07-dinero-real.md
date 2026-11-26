# 07 · Pasar a dinero real (con 20 €)

> Lee esto entero antes de activar el modo real. Si has saltado directamente aquí, vuelve a [00-empieza-aqui.md](00-empieza-aqui.md).

## Qué esperar de verdad

- Con 20 €, aunque todo vaya bien, ganarás **céntimos o pocos euros**. En el backtest, el bot ganó de media un ~6 % al año, es decir, **~1,20 € al año con 20 €**. Algunos años pierde.
- El objetivo de esta fase no es ganar dinero, sino **comprobar que todo funciona con dinero real** y aprender cómo te sientes.
- Puedes perder los 20 €. Mete solo lo que estés dispuesto a perder entero.

## Paso 1: cuenta de Binance

1. Crea una cuenta en Binance y completa la verificación de identidad (KYC).
2. Activa la **verificación en dos pasos (2FA)** con una app (Google Authenticator o similar), no por SMS.
3. Ingresa los 20 € (por transferencia bancaria o tarjeta; mira las comisiones de cada método).

> Antes de elegir exchange, comprueba que está autorizado para operar en España y en la UE. Kraken o Bitvavo también son opciones. Cambiar el bot a otro exchange es posible con `ccxt`, pero requiere tocar `bot/broker.py`.

## Paso 2: clave de API segura

En Binance: **Perfil → Gestión de API → Crear API** (clave generada por el sistema).

Permisos:

- ✅ **Habilitar lectura** (Enable Reading)
- ✅ **Habilitar trading spot y de margen** (Enable Spot & Margin Trading)
- ❌ **NUNCA "Habilitar retiros"** (Enable Withdrawals). Si alguien robara la clave, sin este permiso no podría sacar tu dinero.
- ❌ No actives futuros.
- Recomendado: **restringir el acceso por IP** si el bot va a funcionar siempre desde el mismo sitio (por ejemplo, un servidor con IP fija).

Pega las claves en `.env`:

```
BINANCE_API_KEY=tu_api_key
BINANCE_API_SECRET=tu_secret_key
CONFIRMO_DINERO_REAL=si
```

Nunca compartas el archivo `.env` ni subas las claves a GitHub (ya está en `.gitignore`).

## Paso 3: revisar config.yaml

- `capital_inicial: 20`: **el bot nunca usará más que esto**, aunque tengas más dinero en Binance.
- `orden_minima_eur: 5`: comprueba el mínimo actual de Binance para BTC/EUR. Si es mayor, súbelo.
- No subas `riesgo_por_operacion_pct` por encima de 2.

## Paso 4: arrancar

```bash
python -m bot real --una-vez     # primero una sola revisión, para comprobar que conecta
python -m bot real               # luego en marcha
```

El bot muestra un aviso de que va a operar con dinero de verdad. El modo real **no arranca** si falta `CONFIRMO_DINERO_REAL=si`.

## Mientras funciona

- Revisa `python -m bot estado real` y el log a diario las primeras semanas.
- Comprueba en la app de Binance que las operaciones coinciden con las del log.
- **No toques nada a mano en Binance** mientras el bot tenga una posición abierta: si vendes tú el BTC, el bot no lo sabrá.
- **Para pararlo:** `Ctrl + C`. Si tenía una posición abierta, seguirá abierta en Binance y sin stop-loss: decide tú si la vendes a mano.

## Cuándo apagarlo y replantearse todo

- Se activa el freno de drawdown (el capital cae un 30 %).
- Ves operaciones que no sabes explicar.
- Los resultados se alejan mucho del backtest del mismo periodo.
- Te sorprendes queriendo "ayudar" al bot o subir el riesgo para recuperar.

## Impuestos en España (Hacienda)

> Esto es información general, no asesoramiento fiscal. Para tu caso concreto, consulta a un asesor o la web de la Agencia Tributaria.

- **Cada venta** de criptomonedas (también cambiarlas por otra cripto) es una **ganancia o pérdida patrimonial** y se declara en la renta del año, aunque sean céntimos.
- Tributa en la **base del ahorro**: un 19 % para los primeros 6.000 € de ganancia, y tipos más altos a partir de ahí.
- Las pérdidas pueden compensar ganancias (con algunos límites).
- Para calcular la ganancia se usa el método **FIFO**: lo primero que compras es lo primero que vendes.
- El bot guarda todas las operaciones en `resultados/operaciones_real.csv` (fecha, precio, cantidad, euros, comisión). **Guarda ese archivo.** Binance también permite descargar el historial.
- Hay obligaciones informativas adicionales (por ejemplo, el modelo 721) a partir de saldos mucho más altos (50.000 €). Con 20 € no te afectan, pero conviene saber que existen.
