# 🤖 Sokyo Bot

Bot de Discord **todo en uno** (tickets, moderación, niveles, verificación, anuncios e IA)
con un **panel web** de administración (React + Vite) y un **portal de cliente** con login de
Discord. El bot expone una **API REST** (Express) que el panel consume, guarda todo en
**MongoDB** e integra **Claude (Anthropic)** para asistencia con IA y **Stripe** para los planes
de suscripción.

```
sokyo-bot/
├── index.js              # Arranque del bot (carga comandos, eventos y API)
├── api/server.js         # API REST + portal de cliente (OAuth Discord) + webhook Stripe
├── comandos/             # Comandos por prefijo "!"
├── events/               # Eventos de Discord (mensajes, miembros, reacciones, voz...)
├── models/               # Esquemas de MongoDB (Ticket, Sancion, ServidorConfig...)
├── utils/                # Lógica compartida (tickets, automod, niveles, IA, billing...)
└── sokyo-panelFRONTEND/  # Panel web de administración (React + Vite, ES/EN)
```

---

## ✨ Funcionalidades

### 🎫 Tickets de soporte
- Panel con botón **📩 Abrir Ticket**, categorías y formularios (modales).
- Cierre/reapertura, notas internas, logs por ticket y **auto-cierre por inactividad**.
- Gestión completa desde el panel web (ver conversación, responder).
- **Asistente IA opcional** en tickets (Claude) con cuota mensual por servidor.

### 🛡️ Moderación
- Comandos: `!ban`, `!unban`, `!kick`, `!timeout`, `!warn`, `!sancion`, `!historial`.
- Sistema de **sanciones** con tipos configurables y registro persistente.
- **Automod** (filtros de contenido) y **Anti-Raid**.

### ✅ Verificación y acceso
- **Captcha**, verificación de miembros y **onboarding** de nuevos usuarios.
- Paneles de verificación por botón.

### 🎭 Roles
- **Paneles de roles** (botones y menús desplegables) y **auto-rol**.
- **Roles temporales** (con expiración automática).
- Roles por reacción.

### 📊 Niveles y actividad
- Sistema de **XP/niveles** (`!xp`, `!nivel`, `!ranking`).
- **Tarjetas de rango** personalizables (canvas) con estilos y fuentes.
- Seguimiento de actividad de **mensajes y voz**.

### 🚨 Reportes
- Comando `!reportar` + gestión de reportes/incidencias desde el panel.

### 📢 Anuncios y comunicación
- **Anuncios programados** y **Difusión** (a un servidor o a TODOS los del bot, solo IDs autorizadas).
- **Creador de anuncios/embeds** con presets reutilizables y previsualización de Markdown.
- **Auto-respuestas** (expresiones/macros configurables).
- **Recordatorios** (`!remind`).

### 🧠 IA y analítica
- Integración con **Claude** para auditoría/analítica e IA en tickets.
- **Resumen diario** automático, estadísticas diarias y vista de analítica.

### 💳 Planes y facturación
- Planes **Free · Pro · Agencia** con **Stripe** (mensual/anual/de por vida).
- Cuotas por plan (p. ej. usos de IA: Free 5 · Pro 150 · Agencia 1500 al mes).
- Sin Stripe configurado, el bot funciona igual y los planes se activan a mano.

### ⚙️ Otros comandos
`!ping`, `!dado`, `!moneda`, `!emoji`, `!sticker`, `!user`, `!actividad`, `!setup`,
`!setupSoporte`, `!rol`.

### 🌐 Panel web + portal de cliente
- Panel de administración con ~30 vistas (Tickets, Logs, Usuarios, Roles, Automod,
  Verificación, Sanciones, Anuncios, Embeds, Analítica, Planes, Resumen, Backup...).
- **Portal de cliente** con login de Discord (OAuth2).
- Soporte **multi-idioma** (Español / Inglés).

---

## ✅ Requisitos previos

- **[Node.js](https://nodejs.org/)** 18 o superior (incluye `npm`).
- **Una base de datos MongoDB** (gratis en [MongoDB Atlas](https://www.mongodb.com/atlas), te da una cadena `mongodb+srv://...`).
- **Una aplicación de bot de Discord** en el [Developer Portal](https://discord.com/developers/applications) (de ahí sacas el *token*).
- *(Opcional)* Cuenta de **[Stripe](https://dashboard.stripe.com)** para los pagos.
- *(Opcional)* Clave de **[Anthropic](https://console.anthropic.com)** para el asistente IA.

---

## 🚀 Puesta en marcha (paso a paso)

### 1. Clonar el repositorio
```bash
git clone https://github.com/SergioVillalbaDev/sokyo-bot.git
cd sokyo-bot
```

### 2. Instalar dependencias
Hay que instalar las del **bot** y las del **panel** por separado:
```bash
# Dependencias del bot (en la raíz)
npm install

# Dependencias del panel web
cd sokyo-panelFRONTEND
npm install
cd ..
```

### 3. Configurar las variables de entorno

Hay dos archivos `.env` (NO se suben a git). Cópialos desde las plantillas `.env.example`:

```bash
# Bot
copy .env.example .env                                  # Windows
# cp .env.example .env                                  # macOS/Linux

# Panel
copy sokyo-panelFRONTEND\.env.example sokyo-panelFRONTEND\.env   # Windows
# cp sokyo-panelFRONTEND/.env.example sokyo-panelFRONTEND/.env   # macOS/Linux
```

**`.env` del bot** — los valores **obligatorios** son:
```env
MONGO_URI=mongodb+srv://usuario:password@cluster.mongodb.net/SokyoDB
DISCORD_TOKEN=tu_token_de_discord
PORT=3000
API_KEY=una-clave-larga-y-aleatoria
```

El resto son **opcionales** y están explicados con detalle dentro de `.env.example`:
- **Portal de cliente (OAuth):** `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `OAUTH_REDIRECT_URI`, `FRONTEND_URL`, `JWT_SECRET`.
- **Propietarios y difusión:** `OWNER_IDS` (ven todos los servidores/tickets), `BROADCAST_IDS` (pueden usar la Difusión).
- **Pagos (Stripe):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y los `STRIPE_PRICE_*` de cada plan.
- **Asistente IA (Claude):** `ANTHROPIC_API_KEY` y, opcional, `ANTHROPIC_MODEL`.

> Si dejas vacías las claves de Stripe o de Anthropic, esas funciones quedan **desactivadas**
> y el bot funciona igual.

**`sokyo-panelFRONTEND/.env`** — la clave debe ser **la misma** que `API_KEY`:
```env
VITE_API_URL=http://localhost:3000
VITE_API_KEY=una-clave-larga-y-aleatoria
```

> 🔑 `API_KEY` (bot) y `VITE_API_KEY` (panel) **deben coincidir exactamente**. Es la que
> protege la API. Puedes generar una con:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
> Si el panel se abre desde **otro dispositivo** de la red, pon en `VITE_API_URL` la IP del
> PC donde corre el bot (p. ej. `http://192.168.1.50:3000`). Si es el **mismo PC**, deja `localhost`.

### 4. Activar los *Intents* del bot en Discord

En el [Developer Portal](https://discord.com/developers/applications) → tu aplicación → pestaña **Bot**,
activa estos *Privileged Gateway Intents* (si no, el bot **no arranca**):

- ✅ **Message Content Intent**
- ✅ **Server Members Intent**

> El bot usa además los intents de mensajes, reacciones y estados de voz (para roles por
> reacción, logs y registro de actividad de voz).

### 5. Arrancar

Necesitas **dos terminales abiertas a la vez**:

```bash
# Terminal 1 — el bot (déjala abierta)
npm start
```
Deberías ver:
```
🌐 API corriendo en puerto 3000
🟢 Conectado a MongoDB
🚀 Logged in as TuBot#0000!
```

```bash
# Terminal 2 — el panel web
cd sokyo-panelFRONTEND
npm run dev
```
Abre la URL que indica Vite (normalmente <http://localhost:5173>).

> ⚠️ El bot debe estar **encendido** para que el panel cargue datos. Si cierras su terminal,
> el panel mostrará un error de conexión.

---

## 🎫 Uso básico

- En tu servidor de Discord, ejecuta **`!sokyo`** (como administrador) en el canal donde
  quieras el panel de soporte. Aparecerá un botón **📩 Abrir Ticket**.
- Los usuarios abren tickets eligiendo categoría y rellenando un formulario.
- Desde el panel web puedes ver conversaciones, responder, añadir notas internas,
  cerrar/reabrir tickets, ver logs y estadísticas, gestionar moderación, niveles,
  verificación, anuncios y mucho más.

Algunos comandos rápidos: `!user [@usuario]` (estadísticas), `!nivel`, `!ranking`,
`!warn`, `!ban`, `!remind`, `!dado`, `!moneda`.

---

## 🛠️ Notas

- **Build de producción del panel:** `cd sokyo-panelFRONTEND && npm run build` (genera `dist/`).
- Los archivos `.env` están en `.gitignore`: cada persona crea el suyo a partir de `.env.example`.
- Si cambias un `.env`, **reinicia** el proceso correspondiente (Vite no recarga variables en caliente).
- **Stack:** Node.js, discord.js v14, Express 5, Mongoose, @anthropic-ai/sdk, Stripe,
  @napi-rs/canvas y React + Vite en el panel.
</content>
</invoke>
