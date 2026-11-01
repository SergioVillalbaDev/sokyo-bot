# 🤖 Sokyo Bot

Bot de Discord de **sistema de tickets de soporte** con un **panel web** de administración
(React + Vite). El bot expone una API (Express) que el panel consume para gestionar
tickets, moderación, métricas del equipo, logs de auditoría y configurar el sistema.

Todo funciona con **comandos `/`** y el panel entra con **tu cuenta de Discord**: lo que cada persona
puede ver y hacer depende de sus **roles y permisos reales** en el servidor (ver
[Permisos](#-permisos-del-panel)).

```
sokyo-bot/
├── index.js              # Arranque del bot (carga comandos, eventos y API)
├── api/server.js         # API REST que consume el panel web
├── comandos/             # Comandos slash ("/")
├── events/               # Eventos de Discord (interacciones, mensajes, entradas/salidas...)
├── models/               # Esquemas de MongoDB (Ticket, Sancion, Macro, Articulo, Nivel...)
├── utils/                # Lógica compartida (permisos, moderación, tickets, métricas...)
├── tests/                # Tests (npm test)
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

DISCORD_CLIENT_ID=...            # Developer Portal -> OAuth2
DISCORD_CLIENT_SECRET=...
OAUTH_STAFF_REDIRECT_URI=http://localhost:3000/api/auth/staff/callback
OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
FRONTEND_URL=http://localhost:5173
JWT_SECRET=una-cadena-larga-y-aleatoria
```

**`sokyo-panelFRONTEND/.env`**:
```env
VITE_API_URL=http://localhost:3000
```

> 🔐 **El panel ya no usa una clave compartida (`API_KEY`/`VITE_API_KEY`).** Cada persona entra con
> Discord y el servidor comprueba sus permisos en cada petición. Hay que configurar el login:
>
> 1. [Developer Portal](https://discord.com/developers/applications) → tu app → **OAuth2**.
> 2. Copia **Client ID** y **Client Secret** al `.env`.
> 3. En **Redirects** añade **las dos** URLs exactas (`OAUTH_STAFF_REDIRECT_URI` para el panel y
>    `OAUTH_REDIRECT_URI` para el portal de clientes).
> 4. Genera `JWT_SECRET` con:
>    ```bash
>    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
>    ```
>
> Si el panel se abre desde **otro dispositivo** de la red, usa la IP del PC del bot en
> `VITE_API_URL`, `FRONTEND_URL` y las URLs de redirect (y regístralas en Discord).

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

1. Invita al bot con el scope **`bot` + `applications.commands`**. Los comandos `/` se registran solos
   al arrancar, en cada servidor.
2. Ejecuta **`/setup-soporte`** en el canal donde quieras el panel de soporte (aparece **📩 Abrir Ticket**).
3. Los usuarios abren tickets eligiendo categoría y rellenando un formulario. Si lo que escriben coincide
   con un artículo de la **FAQ**, el bot se lo sugiere antes de abrir el ticket.
4. El equipo atiende desde Discord **o** desde el panel web (<http://localhost:5173>).
5. Para que el bot funcione bien, su rol debe estar **por encima** de los roles que gestiona (auto-rol,
   verificación, recompensas) y de los miembros a los que modera.

### Comandos `/`

| Comando | Qué hace | Quién |
|---|---|---|
| `/setup-soporte` | Publica el botón de abrir ticket | Textos del bot |
| `/ticket reclamar · soltar · cerrar · nota` | Gestiona el ticket del canal | según permiso |
| `/macro <nombre>` | Envía una respuesta rápida (autocompletado) | Respuestas rápidas |
| `/warn · /mute · /unmute · /kick · /ban · /unban` | Moderación (con historial y logs) | permisos **de Discord** |
| `/sanciones <usuario>` | Historial de sanciones | Ver sanciones |
| `/faq [consulta]` | Busca en la base de conocimiento | todos |
| `/rank · /top` | Niveles y ranking | todos |
| `/sugerir` · `/encuesta` · `/sugerencia resolver` | Sugerencias y encuestas con votos | todos / staff |
| `/setup-verificacion` | Botón de verificación con rol | Comunidad |
| `/permisos` | Qué puedes hacer tú y por qué | todos |
| `/user [usuario]` · `/dado` · `/moneda` | Estadísticas de tickets y juegos | todos |

### Funciones del panel

- **Tickets:** búsqueda (también dentro de las conversaciones) y filtros, reclamar/soltar, notas internas,
  respuestas rápidas, exportar CSV, descargar transcripción HTML, avisos en vivo.
- **Métricas del staff:** tiempo de primera respuesta y resolución, satisfacción, actividad diaria,
  horas pico y ranking del equipo.
- **Moderación:** buscar usuarios y avisar, silenciar, expulsar o banear con historial.
- **Automatización:** recordatorios de SLA y cierre automático por inactividad.
- **AutoMod:** antispam y antienlaces. **Comunidad:** auto-rol, verificación, niveles y sugerencias.
- **Respuestas y FAQ**, **Ajustes de incidencias**, **Textos del bot** y **Logs de auditoría**.
- **Roles y permisos:** pantalla visual de quién accede a qué.

---

## 🔐 Permisos del panel

El panel y los comandos comparten un único sistema de permisos (`utils/permisos.js`). Los permisos se
calculan **en el servidor** con los roles reales de Discord de cada persona, así que ocultar un botón en
la web es solo cosmética: aunque alguien llame a la API a mano, recibe `403`.

- **Moderación (`warn`, `mute`, `kick`, `ban`)**: salen **solo de los permisos de Discord** del miembro
  (`Banear miembros`, `Expulsar miembros`, `Aislar temporalmente a miembros`). Si no puedes banear en
  Discord, **no puedes banear desde el panel**. Nunca se pueden conceder desde la web. Además se respeta la
  **jerarquía de roles** (no puedes sancionar a alguien con un rol igual o superior al tuyo) y se protege al
  propietario, a ti mismo y al bot.
- **Resto de apartados** (tickets, métricas, logs, configuración…): se heredan de permisos de Discord
  razonables (`Gestionar mensajes` → soporte básico, `Gestionar canales` → gestionar tickets,
  `Gestionar servidor` → configuración, `Administrador` → todo) y se pueden **ampliar por rol** desde el panel.
- **Anti-escalada:** solo puedes dar permisos que tú tienes y solo en roles por debajo del tuyo. Cada cambio
  queda en los logs.
- Quien no tiene ningún permiso no entra al panel. Los permisos se refrescan solos cada minuto.

En **Roles y permisos** hay cuatro vistas: *Mi acceso* (qué puedes y de dónde viene), *Quién entra a qué*
(roles por apartado), *Matriz* (roles × permisos) y *Editar roles*.

---

## 🛠️ Notas

- **Build de producción del panel:** `cd sokyo-panelFRONTEND && npm run build` (genera `dist/`).
- Los archivos `.env` están en `.gitignore`: cada persona crea el suyo a partir de `.env.example`.
- **Tests:** `npm test` (permisos, moderación, métricas, comandos…). El panel se valida con `npm run lint` y `npm run build`. Hay CI en GitHub Actions.
- Si cambias un `.env`, **reinicia** el proceso correspondiente (Vite no recarga variables en caliente).
