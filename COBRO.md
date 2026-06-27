# 💳 Activar el cobro (Stripe)

El sistema de cobro está **construido y probado** (Free / Pro / Agencia, checkout,
webhooks, caducidad de premium y cuota de IA). Solo está **apagado** hasta que
pongas tus claves de Stripe. Mientras `STRIPE_SECRET_KEY` esté vacía, los pagos
quedan desactivados y los botones del panel salen deshabilitados (el bot funciona
igual). Esta es la receta para encenderlo.

> Haz **todo primero en modo TEST** de Stripe (datos de mentira, tarjeta de
> prueba). Cuando funcione, repites en modo LIVE con tus claves reales.

---

## 1. Crea la cuenta y los productos

1. Entra en **https://dashboard.stripe.com** y crea la cuenta.
2. Arriba a la derecha, activa **"Test mode"** (modo de prueba).
3. Ve a **Productos → Añadir producto** y crea **dos productos**:
   - **Sokyo Pro** — añade dos precios: **7 €/mes** y **70 €/año** (recurrentes).
     (Opcional: un tercer precio de **pago único** para "de por vida".)
   - **Sokyo Agencia** — precios **25 €/mes** y **250 €/año** (recurrentes).
4. En cada precio, copia su **ID** (empieza por `price_...`).

> ⚠️ Los importes deben **coincidir** con los del panel
> (`sokyo-panelFRONTEND/src/components/dashboard/views/PlanesView.jsx`, constante
> `PRECIO`): pro 7/70, agency 25/250. Si cambias los precios, cámbialos en ambos sitios.

## 2. Pega los IDs y la clave en el `.env`

En el `.env` del bot (en la Pi):

```
STRIPE_SECRET_KEY=sk_test_...            # Desarrolladores → Claves de API → "Clave secreta"
STRIPE_PRICE_PRO_MONTH=price_...
STRIPE_PRICE_PRO_YEAR=price_...
STRIPE_PRICE_PRO_LIFETIME=price_...      # solo si creaste el pago único
STRIPE_PRICE_AGENCY_MONTH=price_...
STRIPE_PRICE_AGENCY_YEAR=price_...
STRIPE_PRICE_AGENCY_LIFETIME=price_...
```

## 3. Crea el webhook (esto es lo que activa el premium tras pagar)

1. En Stripe: **Desarrolladores → Webhooks → Añadir endpoint**.
2. **URL del endpoint:** `https://dashboard.sokyo.studio/api/billing/webhook`
3. **Eventos a escuchar** (selecciona estos cuatro):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Guarda y copia el **"Signing secret"** (empieza por `whsec_...`):

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

> **En local** (sin dominio público) usa la CLI de Stripe:
> `stripe listen --forward-to localhost:3001/api/billing/webhook`
> y usa el `whsec_...` que te imprime.

## 4. Reinicia y prueba

```bash
pm2 restart bot
```

1. Entra en el panel → pestaña **Mi Plan** → pulsa **Subir a Pro**.
2. En la página de pago de Stripe (modo test) usa la tarjeta de prueba:
   - Número: `4242 4242 4242 4242` · Fecha: cualquiera futura · CVC: cualquiera.
3. Al volver, el servidor debe aparecer como **Pro**. Si es así, el webhook
   funciona de punta a punta.

## 5. Pasar a real (LIVE)

Cuando todo funcione en test: en Stripe quita el "Test mode", vuelve a crear los
productos/precios y el webhook en modo **Live**, y sustituye en el `.env` las
claves `sk_live_...`, los `price_...` reales y el `whsec_...` del webhook live.
Reinicia el bot. **A partir de ahí cobras de verdad.**

---

## Cómo está montado (referencia rápida)

- Lógica central: [`utils/billing.js`](utils/billing.js) — tramos, caducidad,
  cuota de IA, sesiones de Checkout/Portal y proceso de webhooks.
- Endpoints: en [`api/server.js`](api/server.js) — `POST /api/billing/webhook`
  (público, firma verificada), `GET /api/billing/estado`,
  `POST /api/billing/checkout`, `POST /api/billing/portal`.
- Red de seguridad: `barrerPremiumCaducado()` corre cada hora (scheduler) por si
  un webhook se pierde.
- Tests de la lógica: [`test/billing.test.js`](test/billing.test.js) — `npm test`.
- **Plan Agencia** = gestionado a mano (ver venta): activas Pro en los servidores
  del cliente con `node scripts/premium.js on <guildId>`.
