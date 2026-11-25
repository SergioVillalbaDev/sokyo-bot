# Actividad de Discord (preparada en 1.34.0)

Cuando alguien pulsa el cohete de **Actividades** en un canal de voz o de texto, Discord puede abrir Sokyo dentro de su
ventana. La página ya está hecha (`/actividad`): tu oro y el diario, tu mascota, la granja, el pase, lo siguiente que
te toca y qué hay encendido en el servidor. Hace lo mismo que `/menu` en Discord (misma lógica del bot).

## Lo que falta (solo el dueño de la aplicación, en el portal de Discord)
1. Entra en <https://discord.com/developers/applications> → la aplicación de Sokyo.
2. **Activities → Settings**: activa «Enable Activities».
3. **Activities → URL Mappings**: en `/` (Root Mapping) pon `dashboard.sokyo.studio` (sin `https://`).
4. **OAuth2**: no hace falta añadir ninguna dirección de redirección para la Actividad.
5. En el `.env` de la Pi tienen que estar `DISCORD_CLIENT_ID` y `DISCORD_CLIENT_SECRET` (los mismos del inicio de sesión
   del panel; normalmente ya están). Sin ellos la página dice «La Actividad aún no está activada».

Al activar las Actividades, Discord crea solo el comando de entrada («Launch»). El bot lo respeta al registrar sus
comandos (`deploy-commands.js` y `utils/comandosServidor.js` no lo borran).

## Cómo funciona por dentro
- `sokyo-panelFRONTEND/src/Actividad.jsx`: usa `@discord/embedded-app-sdk` (se descarga solo en esta página). Pide un
  `code` sin preguntar nada (`prompt: 'none'`, permiso `identify`), lo cambia por una sesión y enseña el estado del
  servidor donde se abrió. Fuera de Discord explica cómo abrirla y lleva a «Mi cuenta».
- `api/routes/actividad.js`: `GET /api/auth/actividad/config`, `POST /api/auth/actividad/token` (cambia el `code`
  con el secreto de la aplicación), `GET /api/portal/actividad/estado`, `POST /api/portal/actividad/diario` y
  `POST /api/portal/actividad/granja`. La sesión es la misma que la de «Mi cuenta» (`portalAuth`) y solo vale en un
  servidor donde la persona es miembro y está el bot.
- `api/server.js`: solo `/actividad` puede ir dentro de un marco, y solo de Discord (`frame-ancestors`); todo lo demás
  sigue con `X-Frame-Options: SAMEORIGIN`.
- En una Actividad, Discord solo deja cargar lo que pasa por su proxy: la página usa direcciones relativas (`/api/…`,
  `/sprites/…`) y nada de fuera (por eso no enseña avatares de Discord).
