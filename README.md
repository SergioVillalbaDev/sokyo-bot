# 🤖 Sokyo Bot

Bot de **tickets para Discord** con formularios por tipo de consulta, **panel web** para el staff,
**portal** para los usuarios e **IA** que responde sola las dudas repetidas.

- **`/setup` en 1 minuto:** crea la categoría de tickets, el canal de logs y publica el panel.
- **Formularios por tipo:** cada tipo de ticket hace sus propias preguntas (hasta 5) y puede tener
  su propio equipo (roles) y su propia categoría.
- **IA (API de Claude):** antes de abrir un ticket intenta resolverlo con las preguntas frecuentes;
  al abrirlo detecta idioma, ánimo y urgencia; en el panel resume, sugiere respuestas, traduce y
  convierte tickets resueltos en artículos de FAQ.
- **Multi-servidor:** cada servidor tiene su configuración y sus datos. El staff entra al panel con
  su cuenta de Discord y solo ve los servidores donde es admin o staff.
- **Plan gratis con marca / Premium sin marca:** el plan gratis muestra “⚡ Sokyo” y un botón para
  añadir el bot; Premium la quita y amplía la IA y los logs.

```
sokyo-bot/
├── index.js              # Arranque: carga comandos y eventos, API y MongoDB
├── api/                  # API REST (login con Discord, rutas por servidor) + sirve el panel
├── comandos/             # Comandos / (setup, panel, ticket, usuario, ayuda, dado, moneda)
├── events/               # Eventos de Discord (interacciones, mensajes, logs, entradas...)
├── models/               # Esquemas de MongoDB
├── utils/                # Tickets, IA, permisos, logs, marca...
├── scripts/              # Premium y actualización de la Raspberry
└── sokyo-panelFRONTEND/  # Web pública + panel de staff + portal (React + Vite)
```

---

## ✅ Requisitos

- **[Node.js](https://nodejs.org/) 18 o superior.**
- **MongoDB** (local o gratis en [MongoDB Atlas](https://www.mongodb.com/atlas)).
- **Una aplicación de Discord** en el [Developer Portal](https://discord.com/developers/applications).
- *(Opcional)* **Clave de la API de Anthropic** para la IA: <https://console.anthropic.com>.

---

## 🚀 Puesta en marcha

### 1. Instalar
```bash
git clone https://github.com/SergioVillalbaDev/sokyo-bot.git
cd sokyo-bot
npm install
npm run build:panel     # instala y compila el panel web (carpeta sokyo-panelFRONTEND/dist)
```

### 2. Configurar el `.env`
```bash
cp .env.example .env    # en Windows: copy .env.example .env
```
Rellena como mínimo `MONGO_URI`, `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
`JWT_SECRET`, `OAUTH_REDIRECT_URI` y `FRONTEND_URL`. Cada variable está explicada en el propio archivo.

> El panel ya **no usa `API_KEY`**: cada persona entra con su cuenta de Discord. Si tu `.env` antiguo
> la tiene, no molesta (se usa como `JWT_SECRET` si no defines uno).

### 3. Developer Portal de Discord
En tu aplicación:
1. **Bot → Privileged Gateway Intents:** activa **Message Content Intent** y **Server Members Intent**.
2. **OAuth2 → Redirects:** añade exactamente el valor de `OAUTH_REDIRECT_URI`
   (p. ej. `http://192.168.1.50:3000/api/auth/discord/callback`).

### 4. Arrancar
```bash
npm start
```
Con la build hecha, **el bot sirve también la web** en el mismo puerto: abre `http://IP-DEL-BOT:3000`.
Verás la web pública, “Entrar al panel” (staff) y “Mis tickets” (usuarios).

En la consola aparece el **enlace para invitar el bot** a un servidor.

> **Desarrollo del panel:** `cd sokyo-panelFRONTEND && npm run dev` abre Vite en
> <http://localhost:5173> y reenvía `/api` al bot (puerto 3000). En ese caso pon
> `FRONTEND_URL=http://localhost:5173` en el `.env` del bot.

---

## 🍓 Actualizar en la Raspberry

Dentro de la carpeta del repositorio en la Raspberry:
```bash
bash scripts/actualizar-raspberry.sh            # actualiza la rama actual
bash scripts/actualizar-raspberry.sh main       # o una rama concreta
```
Descarga los cambios, instala dependencias, compila el panel y reinicia el bot con
[pm2](https://pm2.keymetrics.io/) (si no lo tienes: `sudo npm install -g pm2`; para que arranque
con la Raspberry, `pm2 startup` una vez).

---

## 🎫 Uso en Discord

| Comando | Qué hace |
|---|---|
| `/setup rol_staff:@Rol` | Configura todo: equipo, categoría de tickets, canal de logs y publica el panel |
| `/panel [panel] [canal]` | Publica un panel (se diseñan en el panel web) |
| `/ticket agregar · quitar · renombrar · cerrar` | Gestión dentro de un ticket |
| `/ticket resumen` | Resumen del ticket con IA (solo lo ve quien lo pide) |
| `/usuario [miembro]` | Historial de tickets |
| `/ayuda`, `/dado`, `/moneda` | Ayuda y juegos |

Los comandos `/` se registran solos al arrancar (globales: la primera vez pueden tardar hasta 1 hora
en aparecer; con `DEV_GUILD_ID` aparecen al instante en ese servidor).

**Desde la versión anterior:** los paneles ya publicados con `!sokyo` siguen funcionando. Los comandos
con `!` responden indicando el comando `/` nuevo.

---

## 🤖 IA

Con `ANTHROPIC_API_KEY` en el `.env`, cada servidor puede activarla en **Panel → Inteligencia artificial**:

- **Responder antes de abrir el ticket:** usa las **Preguntas frecuentes** del panel (y, en Premium,
  los resúmenes de tickets cerrados). Si la IA no está segura, se abre el ticket normal.
- **Triaje:** idioma, ánimo y urgencia; si es más grave de lo marcado, sube la prioridad.
- **En el panel:** sugerir respuesta, resumen, traducir y convertir en FAQ.

Cada servidor tiene un cupo mensual (`IA_LIMITE_GRATIS`, `IA_LIMITE_PREMIUM`). Una llamada que falla
no gasta cupo.

---

## ⭐ Premium

Lo activa quien aloja el bot, con el ID del servidor:
```bash
npm run premium -- 123456789012345678 30      # 30 días (0 = sin caducidad)
npm run premium -- 123456789012345678 quitar
npm run premium -- lista
```

---

## 📈 Antes de llegar a 100 servidores

Discord exige **verificar el bot** a partir de 75 servidores y no deja pasar de 100 sin verificar.
En la verificación hay que justificar los intents privilegiados: **Message Content** (guardar la
conversación de los tickets para el panel, el transcript y la IA) y **Server Members** (logs de
entradas/salidas y permisos del panel).
