# 🤖 Sokyo Bot

Bot de Discord de **tickets de soporte** con **panel web para el staff** y **portal para los usuarios**,
todo en español y con marca blanca (textos, colores y categorías personalizables).

- 🎫 **Tickets en Discord**: botón «Abrir Ticket» → formulario (categoría, asunto y descripción) → canal privado numerado (`ticket-0001-usuario`).
- 🛡️ **Gestión del staff**: reclamar/liberar, añadir/quitar personas, cambiar prioridad, cerrar con motivo, reabrir, transcript y eliminar canal.
- 📊 **Panel web**: resumen con métricas (tiempo de primera respuesta, resolución, satisfacción), lista de tickets con filtros y búsqueda, chat en vivo con el usuario, notas internas, auditoría y configuración completa.
- 🙋 **Portal de clientes**: cada usuario entra con Discord, ve sus tickets, abre nuevos, responde, los cierra y los valora.
- ⭐ **Valoraciones**: al cerrar, el usuario recibe por DM un resumen, la conversación y estrellas para puntuar (con comentario opcional).
- 📜 **Auditoría**: mensajes editados/borrados, entradas/salidas (con aviso de cuentas recién creadas) y todo el ciclo de vida de los tickets, también publicable en un canal.

```
sokyo-bot/
├── index.js               # Arranque: comandos, eventos, MongoDB, API y Discord
├── api/                   # API REST (Express) que usan el panel y el portal
│   ├── server.js          #   login con Discord (OAuth2), sesiones y errores
│   ├── staff.js           #   rutas del panel del staff (/api/servidores/:id/...)
│   ├── portal.js          #   rutas del portal de clientes (/api/portal/...)
│   ├── middleware.js      #   autenticación, permisos de staff y limitador
│   └── validacion.js      #   validación de la configuración
├── comandos/              # Slash commands (/panel, /ticket, /config, ...)
├── events/                # Eventos de Discord (interacciones, mensajes, miembros...)
├── interacciones/         # Botones, menús y formularios de los tickets
├── models/                # Esquemas de MongoDB (Ticket, Mensaje, Log, ServidorConfig)
├── utils/                 # Lógica compartida (ticketManager, transcripts, estadísticas...)
├── tests/                 # Pruebas de la API y de los flujos de Discord
└── sokyo-panelFRONTEND/   # Panel del staff y portal de clientes (React + Vite)
```

---

## ✅ Requisitos

- **[Node.js](https://nodejs.org/) 20.19 o superior** (recomendado 22 LTS). Con Node 18 no funciona.
- **MongoDB**: local o gratis en [MongoDB Atlas](https://www.mongodb.com/atlas).
- **Una aplicación de Discord** en el [Developer Portal](https://discord.com/developers/applications).

---

## 🚀 Puesta en marcha

### 1. Instalar dependencias
```bash
git clone https://github.com/SergioVillalbaDev/sokyo-bot.git
cd sokyo-bot
npm install
cd sokyo-panelFRONTEND && npm install && cd ..
```

### 2. Configurar la aplicación de Discord
En el [Developer Portal](https://discord.com/developers/applications) → tu aplicación:

1. **Bot** → copia el token (*Reset Token*) y activa estos *Privileged Gateway Intents*:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
2. **OAuth2** → copia el *Client ID* y el *Client Secret*, y en **Redirects** añade exactamente
   `http://localhost:3000/api/auth/discord/callback` (o la URL pública de tu API).
3. **Invita al bot** a tu servidor con este enlace (cambia `TU_CLIENT_ID`):
   ```
   https://discord.com/oauth2/authorize?client_id=TU_CLIENT_ID&scope=bot+applications.commands&permissions=268692496
   ```
   Incluye los permisos que necesita: ver canales, enviar mensajes, insertar enlaces, adjuntar archivos,
   leer el historial, gestionar mensajes, **gestionar canales**, **gestionar roles** y mencionar roles.

### 3. Variables de entorno
```bash
cp .env.example .env                                              # Windows: copy .env.example .env
cp sokyo-panelFRONTEND/.env.example sokyo-panelFRONTEND/.env      # Windows: copy ...
```
Rellena el `.env` del bot (cada variable está explicada en `.env.example`):

| Variable | Para qué sirve |
|---|---|
| `MONGO_URI` | Conexión a MongoDB **(obligatoria)** |
| `DISCORD_TOKEN` | Token del bot **(obligatoria)** |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Login con Discord en el panel y el portal |
| `OAUTH_REDIRECT_URI` | Debe coincidir con el *Redirect* de OAuth2 |
| `FRONTEND_URL` | Dónde se abre el panel (a dónde vuelve el login) |
| `JWT_SECRET` | Secreto largo y aleatorio para firmar las sesiones |
| `API_KEY` | *(Opcional)* clave de administrador para entrar sin Discord |
| `GUILD_ID_DEV` | *(Opcional)* registra los comandos solo en ese servidor, al instante |

En `sokyo-panelFRONTEND/.env` solo hay que poner `VITE_API_URL` (la URL de la API del bot).
Si abres el panel desde otro dispositivo de la red, usa la IP del equipo del bot (`http://192.168.1.50:3000`).

> 🔑 Genera secretos con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 4. Arrancar
```bash
npm start                      # Terminal 1: el bot y la API
cd sokyo-panelFRONTEND
npm run dev                    # Terminal 2: el panel web → http://localhost:5173
```
Deberías ver en la terminal del bot:
```
✅ 8 comandos cargados: /ayuda, /config, /dado, /estadisticas, /moneda, /panel, /ticket, /usuario
🟢 Conectado a MongoDB
🌐 API escuchando en el puerto 3000
🚀 Bienvenidos a la órbita. Conectado como TuBot#0000 en 1 servidor(es).
✅ Slash commands registrados globalmente.
```

### 5. Primeros pasos en Discord
1. `/config rol-staff rol:@Soporte` → el rol que atenderá los tickets (o hazlo desde el panel web).
2. `/config categoria` → (opcional) categoría donde se crean los tickets.
3. `/panel` en el canal de soporte → publica el mensaje con el botón **📩 Abrir Ticket**.

---

## 💬 Comandos

| Comando | Quién | Qué hace |
|---|---|---|
| `/panel [canal]` | Admins | Publica el panel de soporte |
| `/config ver · rol-staff · categoria · transcripts · logs · limite` | Admins | Configuración rápida desde Discord |
| `/ticket cerrar [motivo]` | Creador o staff | Cierra el ticket del canal |
| `/ticket reclamar · liberar · reabrir · prioridad` | Staff | Gestión del ticket |
| `/ticket agregar · quitar` | Staff | Añadir o quitar personas del ticket |
| `/ticket transcript` | Creador o staff | Descarga la conversación en HTML |
| `/usuario [@usuario]` | Todos (otros: staff) | Historial de soporte |
| `/estadisticas` | Staff | Resumen del soporte del servidor |
| `/ayuda` · `/dado` · `/moneda` | Todos | Ayuda y diversión |

Los botones de cada ticket hacen lo mismo sin escribir comandos. Al cerrarse, el ticket pasa a
**🗄️ Tickets Archivados** en solo lectura y sus botones cambian a *Reabrir / Transcript / Eliminar canal*.

---

## 🖥️ Panel web y portal

Ambos están en la misma web (`http://localhost:5173`). Al entrar con Discord:

- Si eres **staff** de algún servidor del bot (administrador, gestor de canales o con un rol de staff)
  entras al **panel**: resumen, tickets, usuarios, auditoría y configuración. Si estás en varios servidores
  puedes cambiar entre ellos en la barra lateral.
- Si no, entras al **portal**, donde ves y gestionas solo tus tickets. El staff también puede abrir
  su portal desde «Mis tickets como usuario».
- Con `API_KEY` configurada aparece «Acceso de administrador con clave» (acceso completo sin Discord).

Desde **Configuración** se editan las categorías y urgencias, los textos y colores del panel (con vista
previa en vivo; el panel ya publicado en Discord se actualiza solo), los roles de staff, los canales de
transcripts y auditoría, el límite de tickets por usuario y los módulos (encuesta, DM, avisos, auditoría).

---

## 🔄 Si vienes de la versión anterior

- Los comandos con `!` pasan a ser **slash commands** (`!sokyo` → `/panel`, `!user` → `/usuario`...).
  Si alguien escribe el comando antiguo, el bot le indica el nuevo.
- Los paneles y tickets ya publicados en Discord **siguen funcionando**; los tickets antiguos se
  actualizan al nuevo formato la primera vez que se pulsa uno de sus botones.
- El panel ya **no usa `VITE_API_KEY`** (quedaba visible en el navegador): el staff entra con Discord.
  Puedes borrar esa variable del `.env` del panel.
- Requiere **Node.js 20.19+**.

---

## 🧪 Pruebas
Con un MongoDB accesible (por defecto `mongodb://127.0.0.1:27017`, configurable con `MONGO_URI_TEST`):
```bash
npm test                       # API (84 comprobaciones) y flujos de Discord (49) con un Discord simulado
cd sokyo-panelFRONTEND && npm run lint && npm run build
```

---

## 🛠️ Solución de problemas

| Síntoma | Causa probable |
|---|---|
| `Used disallowed intents` al arrancar | Activa los dos *Privileged Gateway Intents* del paso 2 |
| No aparecen los slash commands | Los globales pueden tardar un poco: usa `GUILD_ID_DEV` para pruebas |
| «Me faltan permisos…» al abrir un ticket | El bot necesita *Gestionar canales* y *Gestionar roles* (vuelve a invitarlo con el enlace) |
| El staff no ve los tickets | Añade su rol en `/config rol-staff` o en *Ajustes generales* |
| El login con Discord vuelve con error | `OAUTH_REDIRECT_URI` debe coincidir exactamente con el *Redirect* de OAuth2 |
| El panel dice «No se puede conectar con el bot» | El bot está apagado o `VITE_API_URL` apunta a otra dirección |
| `El puerto 3000 ya está en uso` | Hay otra instancia abierta: ciérrala o cambia `PORT` |

**Producción:** `cd sokyo-panelFRONTEND && npm run build` genera `dist/` para servirlo con cualquier
servidor web. Recuerda actualizar `FRONTEND_URL`, `OAUTH_REDIRECT_URI` y `VITE_API_URL` con tus dominios.
