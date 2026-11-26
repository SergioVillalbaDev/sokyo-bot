# 08 · Avisos por Telegram (opcional)

El bot puede mandarte un mensaje al móvil cuando:

- arranca,
- compra o vende (con el precio, el motivo y el resultado),
- se activa un freno (pausa por racha perdedora, apagado por drawdown),
- se cumple tu regla del x2,
- hay varios errores seguidos (por ejemplo, sin internet).

Cada mensaje empieza por 🧪 SIMULACIÓN, 🧪 TESTNET o 💶 REAL, para que nunca los confundas.

## Configurarlo (5 minutos)

1. En Telegram, busca **@BotFather** (el oficial, con el tick azul) y escríbele `/newbot`.
2. Elige un nombre (por ejemplo, "Mi bot de trading") y un usuario que acabe en `bot` (por ejemplo, `mi_trading_123_bot`).
3. BotFather te dará un **token** parecido a `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`. Cópialo.
4. Abre el chat con tu bot nuevo y mándale cualquier mensaje (por ejemplo, "hola").
5. En el navegador, abre esta dirección, cambiando `<TOKEN>` por tu token:

   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

   Busca `"chat":{"id":` y copia el número que va después. Ese es tu **chat id**.

6. Ponlo en `.env`:

   ```
   TELEGRAM_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
   TELEGRAM_CHAT_ID=987654321
   ```

7. Arranca el bot (`python -m bot simular`). Debería llegarte el mensaje "Bot arrancado...".

Si no llega, revisa que le escribiste antes al bot (paso 4) y que no hay espacios de más en `.env`. Un fallo de Telegram nunca para el bot: solo aparece un aviso en el log.

> El token es como una contraseña: quien lo tenga puede escribir como tu bot. No lo compartas.
