# 🤖 Sokyo Bot

Bot de Discord de **sistema de tickets de soporte** con un **panel web** de administración
(React + Vite). El bot expone una API (Express) que el panel consume para gestionar
tickets, ver logs de auditoría, estadísticas de usuarios y configurar el sistema.

```
sokyo-bot/
├── index.js              # Arranque del bot (carga comandos, eventos y API)
├── api/server.js         # API REST que consume el panel web
├── comandos/             # Comandos por prefijo "!"
├── events/               # Eventos de Discord (tickets, logs, entradas/salidas...)
├── models/               # Esquemas de MongoDB (Ticket, Mensaje, Log, ServidorConfig)
├── utils/                # Lógica compartida (cerrar/reabrir tickets, etc.)
└── sokyo-panelFRONTEND/  # Panel web de administración (React + Vite)
```

---

## ✅ Requisitos previos

Antes de empezar necesitas tener instalado/creado:

- **[Node.js](https://nodejs.org/)** 18 o superior (incluye `npm`).
- **Una base de datos MongoDB.** Lo más fácil es una gratuita en
  [MongoDB Atlas](https://www.mongodb.com/atlas) (obtienes una cadena `mongodb+srv://...`).
- **Una aplicación de bot de Discord** creada en el
  [Discord Developer Portal](https://discord.com/developers/applications) (de ahí sacas el *token*).

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

**`.env` del bot** — rellena tus valores:
```env
MONGO_URI=mongodb+srv://usuario:password@cluster.mongodb.net/SokyoDB
DISCORD_TOKEN=tu_token_de_discord
PORT=3000
API_KEY=una-clave-larga-y-aleatoria        # contraseña de acceso al panel (mín. 16 caracteres)
JWT_SECRET=otro-secreto-largo-y-distinto   # firma las sesiones (mín. 16 caracteres, distinto de API_KEY)
```

**`sokyo-panelFRONTEND/.env`** — solo la dirección de la API:
```env
VITE_API_URL=http://localhost:3000
```

> 🔑 **El bot no arranca** si `API_KEY` o `JWT_SECRET` faltan, son cortas, iguales entre sí o siguen con
> el valor de ejemplo. La `API_KEY` **ya no se pone en el frontend** (antes quedaba visible dentro del
> JavaScript del panel): al abrir el panel escribes la clave en la pantalla de acceso y el bot te da una
> sesión de 12 h. Genera claves con:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
> Si el panel está en otro dominio (p. ej. Vercel), añádelo a `CORS_ORIGINS` en el `.env` del bot.
> Si el panel se abre desde **otro dispositivo** de la red, pon en `VITE_API_URL` la IP del
> PC donde corre el bot (p. ej. `http://192.168.1.50:3000`). Si es el **mismo PC**, deja `localhost`.

### 4. Activar los *Intents* del bot en Discord

En el [Developer Portal](https://discord.com/developers/applications) → tu aplicación → pestaña **Bot**,
activa estos dos *Privileged Gateway Intents* (si no, el bot **no arranca**):

- ✅ **Message Content Intent**
- ✅ **Server Members Intent**

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
  cerrar/reabrir tickets, ver logs y estadísticas, y personalizar textos y categorías.

- **`!sokyo staff @rol`** (admin): ese rol podrá ver y atender todos los tickets nuevos. Sin él, solo los
  ven quienes tengan Administrador o «Gestionar canales».
- Cada usuario puede tener como máximo **3 tickets abiertos** a la vez.
- Cerrar un ticket puede hacerlo quien lo abrió o el staff.

Otros comandos: `!user [@usuario]` (estadísticas de tickets; ver a otros requiere «Gestionar mensajes»), `!dado`, `!moneda`.

### 🔒 Privacidad de los logs

Los logs de mensajes editados/borrados **solo se guardan de canales públicos** (los privados, como los
tickets, no). Se borran solos a los 90 días (`LOG_RETENTION_DAYS`).

### 🧪 Tests

```bash
npm test
```

---

## 🛠️ Notas

- **Build de producción del panel:** `cd sokyo-panelFRONTEND && npm run build` (genera `dist/`).
- El bot necesita en el servidor los permisos **Gestionar canales** (crear tickets) y **Ver canales / Enviar mensajes**.
- Los archivos `.env` están en `.gitignore`: cada persona crea el suyo a partir de `.env.example`.
- Si cambias un `.env`, **reinicia** el proceso correspondiente (Vite no recarga variables en caliente).
