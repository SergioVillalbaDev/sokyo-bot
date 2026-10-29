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
- **Ayuda antes de abrir**: el bot busca la respuesta en las respuestas automáticas (y, si se quiere, la IA responde solo con ellas) y pregunta «¿esto resuelve tu duda?».
- **Tickets por privado**: escribir al bot por privado abre un ticket; las respuestas del staff llegan por privado.

### 🛡️ Moderación
- Comandos: `!ban`, `!unban`, `!kick`, `!timeout`, `!warn`, `!sancion`, `!historial`.
- Sistema de **sanciones** con tipos configurables y registro persistente.
- **Automod** (filtros de contenido) y **Anti-Raid**.
- Respeta la **jerarquía de Discord**: nadie puede sancionar a través del bot a alguien con un rol igual o superior al suyo (ni a sí mismo).

### ✅ Verificación y acceso
- **Captcha**, verificación de miembros y **onboarding** de nuevos usuarios.
- Paneles de verificación por botón.

### 🎭 Roles
- **Paneles de roles** (botones y menús desplegables) y **auto-rol**.
- **Roles temporales** (con expiración automática).
- Roles por reacción.
- Desde el panel, el staff solo puede usar o repartir roles **por debajo de su rol más alto** y sin permisos que él no tenga (el dueño del servidor y los `OWNER_IDS` no tienen límite).

### 📊 Niveles y actividad
- Sistema de **XP/niveles** (`!xp`, `!nivel`, `!ranking`).
- **Tarjetas de rango** personalizables (canvas) con estilos y fuentes.
- Seguimiento de actividad de **mensajes y voz**.

### 🚀 Crecimiento
- **Invitaciones**: el bot sabe con qué invitación entra cada miembro y premia a quien invita con oro, XP y roles por número de invitaciones. Antitrampas: solo cuenta si el invitado sigue dentro pasadas X horas y si su cuenta tiene cierta antigüedad; cada persona cuenta una vez. Comando `/invites` (o `!invites`).
- **Bump de DISBOARD**: avisa cuando se puede volver a hacer `/bump`, menciona a un rol, premia con oro a quien lo hace y lleva un ranking. (Un bot no puede usar comandos de otro bot: el `/bump` lo hace una persona.)
- **Página pública** del servidor en `/s/<dirección>` con botón para unirse, y **directorio** de servidores con Sokyo en `/servidores`. Se generan en el servidor, así que al compartir el enlace sale la vista previa.
- **Avisos de directos** de Twitch y Kick, de vídeos de YouTube y de lo nuevo en comunidades de Reddit o en cualquier web con RSS. Funcionan sin claves; con `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET` y `YOUTUBE_API_KEY` (opcionales, ver `.env.example`) son más precisos.
- **Contadores en canales**: canales con una cifra en el nombre («👥 Miembros: 1.234») que se pone al día cada 10 minutos.
- **Sorteos** con un mínimo de invitaciones para participar y papeletas extra por invitar.

### 🎉 Comunidad y diversión
- **Cumpleaños** (`/cumple` o en «Mi cuenta»): felicitación, rol del día y regalo.
- **Buscar grupo** (`/grupo`): busca gente para jugar; al llenarse, sala de voz solo para el grupo.
- **Clanes** (`/clan`): equipos que compiten cada semana por XP, con premio para el ganador.
- **Salón de la fama**: los mensajes que llegan a X ⭐ se guardan en un canal.
- **Confesiones anónimas** (`/confesar`), con revisión del staff opcional.
- **Solicitudes al staff**: formularios con botón, aceptar/rechazar desde Discord o el panel y rol automático.
- **Ausente** (`/ausente`) y **Traducir** (clic derecho en un mensaje → Apps → Traducir).
- **Mensajes fijos**: un mensaje que siempre queda al final de un canal.

### 🚨 Reportes
- Comando `!reportar` + gestión de reportes/incidencias desde el panel.

### 📢 Anuncios y comunicación
- **Anuncios programados** y **Difusión** (a un servidor o a TODOS los del bot, solo IDs autorizadas).
- **Creador de anuncios/embeds** con presets reutilizables y previsualización de Markdown.
- **Auto-respuestas** (expresiones/macros configurables).
- **Recordatorios** (`!remind`).

### 🎵 Música
- Reproductor de voz con **Lavalink**: `/play` (URL de **YouTube/Spotify** o búsqueda por nombre),
  `/skip`, `/stop`, `/queue`, `/nowplaying`, `/pause`, `/resume`, `/volume`.
- Cola por servidor, anuncio de "reproduciendo ahora" y **salida automática** del canal
  al quedarse vacío o sin canciones.
- **Spotify** (canciones, álbumes y playlists) y **YouTube** funcionan de fábrica:
  Spotify aporta solo los títulos (legal) y el audio sale de YouTube.

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

### 🌐 Panel web + "Mi cuenta"
- Panel de administración con ~30 vistas (Tickets, Logs, Usuarios, Roles, Automod,
  Verificación, Sanciones, Anuncios, Embeds, Analítica, Planes, Resumen, Backup...).
- **Mi cuenta** (`/cuenta` en la web): la página de cada usuario, con diseño de cristal
  futurista. Inicio con su nivel, oro, gráfica de actividad de 14 días y servidores;
  recompensa diaria con un clic; sus tickets con chat y avisos de respuestas nuevas;
  tienda (catálogo, mochila, cajas y crear objetos); música; y su tarjeta de nivel.
  Menú inferior siempre a mano, buscador de acciones (`Ctrl + K`) y botón "atrás" que funciona.
- **Entrar con un clic desde Discord:** `/cuenta` (`/account`) da un botón privado que abre
  la web con la sesión ya iniciada (código de un solo uso, caduca en 15 min; `!cuenta` lo
  manda por MD). También se entra con Discord (OAuth2) desde la propia página.
- Accesos por todas partes: botón "Seguir en la web" en cada ticket nuevo, botones en
  `/shop`, `/inventory`, `/daily` y `!level`, la sección de `!help`, la portada y las
  páginas públicas de los servidores. La antigua `tienda.html` lleva a `/cuenta#tienda`.
- Soporte **multi-idioma** (Español / Inglés): el bot habla en Discord en el idioma del servidor (`sokyolanguage` o el panel) y los textos de fábrica se adaptan solos al cambiarlo.
- **Sesiones de 30 días que se renuevan solas** mientras se use el panel o el portal; un fallo de red no cierra la sesión.

---

## ✅ Requisitos previos

- **[Node.js](https://nodejs.org/)** 20.19 o superior (incluye `npm`). Mongoose 9 y Vite no funcionan en versiones anteriores.
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
- **Aviso "Bot actualizado":** `ANUNCIO_SERVIDOR` (nombre o ID del servidor, por defecto `Tokyto`; vacío lo desactiva), `ANUNCIO_MENSAJE` y `ANUNCIO_MAX_DMS`. Se envía una vez por cada `version` nueva de `package.json`: súbela al desplegar cambios que quieras anunciar.

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

Necesitas **tres terminales abiertas a la vez** (la de música es opcional si no la usas):

```bash
# Terminal 1 — servidor de música Lavalink (déjala abierta)
npm run lavalink
```
Espera a ver `Lavalink is ready to accept connections`. La primera vez descarga
los plugins (YouTube y Spotify), así que tarda un poco más.

```bash
# Terminal 2 — el bot (déjala abierta)
npm start
```
Deberías ver:
```
🌐 API corriendo en puerto 3000
🟢 Conectado a MongoDB
🎵 Lavalink conectado (nodo: sokyo-node)
🚀 Logged in as TuBot#0000!
```

```bash
# Terminal 3 — el panel web
cd sokyo-panelFRONTEND
npm run dev
```

> 🎵 **Música:** necesitas **Java 17+** instalado (para Lavalink). Las URLs de
> **YouTube y Spotify** (canciones, álbumes y playlists) funcionan sin configurar
> nada: `npm run lavalink` arranca Lavalink **y** un pequeño servidor de tokens de
> Spotify (carpeta `spotify-tokener`) a la vez. La primera vez instala sus
> dependencias con `cd spotify-tokener && npm install`.
Abre la URL que indica Vite (normalmente <http://localhost:5173>).

> ⚠️ El bot debe estar **encendido** para que el panel cargue datos. Si cierras su terminal,
> el panel mostrará un error de conexión.

---

## 🍓 Despliegue en la Raspberry Pi

En producción el bot corre con **pm2** (proceso `bot`, y `lavalink` para la música) y sirve
también el panel de `dashboard.sokyo.studio` desde `sokyo-panelFRONTEND/dist`.

```bash
bash deploy/deploy.sh                 # trae lo último de GitHub, instala, compila el panel y reinicia
bash deploy/instalar-autodeploy.sh    # (una vez) lo hace solo cada 5 minutos con cron
```

- Solo reinstala dependencias si cambia un `package.json` y solo compila el panel si cambia algo suyo.
  La compilación se hace con el bot parado y en 2 núcleos, porque con todo encendido la Pi se llegó a colgar.
- Comprueba en `/api/estado` (que publica `version` y `commit`) que arranca el código nuevo. Si no
  arranca, **vuelve solo a la versión anterior** y no reintenta ese commit hasta que llegue otro.
- Registro: `tail -f ~/sokyo-deploy.log`. Para desactivar el automático: `bash deploy/instalar-autodeploy.sh --quitar`.
- El aviso "Bot actualizado" solo se manda si sube la `version` de `package.json`.

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
  @napi-rs/canvas, Lavalink + lavalink-client (música) y React + Vite en el panel.
</content>
</invoke>
