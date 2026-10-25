# CLAUDE.md — sokyo-bot

Contexto para retomar el trabajo en un chat nuevo sin repasar el historial.
Mantenlo al día cuando cambie algo de lo que pone aquí.

## Cómo trabajar con el dueño del proyecto
- Habla español: responde en español, claro y sin tecnicismos.
- Quiere las cosas bien hechas y sin fallos, con un aspecto profesional y muy
  intuitivo («que cualquiera sepa dónde está cada cosa»).
- **Al terminar cualquier cambio, siempre:** subirlo a la Raspberry Pi y subir la
  versión del bot para que salga el aviso «Bot actualizado» (ver *Desplegar*).
  Comprobar después que la Pi lo ha desplegado.
- Antes de subir: `npm test`, lint y build del panel, pruebas en el navegador
  (móvil y escritorio) y una revisión del propio cambio (skill `code-review`).
- Si se acaban los tokens a mitad, seguir donde se quedó al volver.

## Qué es cada parte
- **Bot** (discord.js): `index.js`, `events/`, `slash/`, `comandos/`, `utils/`,
  `models/` (Mongoose 9, MongoDB). `deploy-commands.js` registra los slash.
- **API** (Express 5): `api/server.js` (+ `api/routes/*`, `api/comunidadRoutes.js`,
  `api/crecimientoRoutes.js`, `api/paginaPublica.js`). La misma app sirve el panel
  compilado (`sokyo-panelFRONTEND/dist`) y las páginas públicas `/s/<slug>` y
  `/servidores` (`utils/paginaPublica.js`).
- **Web** (`sokyo-panelFRONTEND/`): React 19 + Vite + Tailwind v4 + i18next.
  - `/` landing · `#dashboard` o `/panel` → panel de admin · `/cuenta` → «Mi cuenta»
    (portal de usuarios, `src/Portal.jsx`, `components/portal/`).
  - `/descargas/sokyo-panel.apk` (app Android) y `/.well-known/assetlinks.json`.
- **App Android** (`app-android/`): Trusted Web Activity `studio.sokyo.panel` que
  abre `/panel`. Ver *App Android*.
- Otros documentos: `README.md`, `COBRO.md` (Stripe), `DESPLIEGUE-SPRINTS.md`,
  `RESUMEN-SESION.md` (historial antiguo).

## Desplegar (Raspberry Pi, dashboard.sokyo.studio detrás de Cloudflare)
- En la Pi, un cron ejecuta `deploy/deploy.sh` cada 5 min: trae
  `feature/frontend-redesign`, compila el panel y reinicia el proceso pm2 `bot`.
  Si no arranca, vuelve solo a la versión anterior.
- Flujo: trabajar en la rama `claude/…` → PR contra **`feature/frontend-redesign`**
  → merge. La Pi lo aplica en ~1 min. Comprobar con
  `curl https://dashboard.sokyo.studio/api/health` (el `uptime` vuelve a empezar).
- El check **Vercel** de los PR falla siempre por la configuración del proyecto de
  Vercel, no por el código. No afecta a la Pi. Basta con comentarlo una vez en el PR.
- **«Bot actualizado»**: `utils/anuncioActualizacion.js` lo manda una vez por
  versión (`version` de `package.json`) al servidor `ANUNCIO_SERVIDOR` (por defecto
  «Tokyto»). Para que salga hay que subir la versión: `npm version X.Y.Z
  --no-git-tag-version`. **Versión actual: 1.3.5.**
- El `.env` de la Pi no es accesible desde aquí. Lo que deba valer en la Pi sin
  tocar el `.env` va en código (p. ej. `utils/propietarios.js`).

## Propietarios del bot
`utils/propietarios.js`: los de `OWNER_IDS` del `.env` más los fijados en el código
(`1433388927233953902`). Ven todos los servidores, cambian planes, usan `/sistema`
y la búsqueda de empleo. Para quitar a alguien hay que borrarlo de ese archivo.

## Panel de admin: convenciones
- **Menú**: `components/dashboard/navConfig.js` (bloques, grupos e ítems con `tab`,
  `icon`, `area`, `premium`, `kw`). `area` = área de permisos de «Acceso al
  panel»; las mismas claves que `AREAS` y el middleware `exigeArea` de `api/server.js`.
- **Añadir una sección**: vista en `components/dashboard/views/`, entrada en
  `CARGAR_VISTA` y en `renderView` (`Dashboard.jsx`; las vistas se cargan bajo
  demanda y se precargan en segundo plano), ítem en `navConfig.js` y textos
  (`nav.items`, `meta`; opcional `sectionHelp` y `sectionTours` + `lib/sectionTours.js`).
- **Textos**: `src/i18n/locales/{es,en}.js` (web pública: `common`, `legal`,
  `landing`, `portal`) y `{es,en}.panel.js` (todo `dashboard.*`, se descargan al
  abrir el panel con `cargarTextosPanel`). **Mismas claves en es y en**: compruébalo
  al tocarlos.
- **Canales y categorías** (`api/routes/canales.js`): Discord solo deja cambiar el
  nombre o el tema de un canal 2 veces cada 10 min y deja esperando el resto. Al
  guardar, manda una sola petición con lo que cambia (`guardarEnDiscord`).
  Reordenar (`PUT …/canales/orden`) manda solo las listas que cambian: Discord
  rechaza la petición entera (50013) si el bot no puede tocar uno de los canales.
  Lo que ya no existe (salas de voz temporales, tickets borrados mientras se
  ordena) se salta y se cuenta en `ignorados`; nunca bloquea el guardado.
- **Estilo cristal**: `src/dashboard.css` (`.sk-*`) y `src/portal.css` (`.gx-*`).
  En Tailwind v4 el CSS sin capa gana a las utilidades: las clases propias van en
  `@layer components`. En móvil/tablet (≤1023 px o `pointer: coarse`) las tarjetas
  van sin `backdrop-filter`, porque es lo que más cuesta al hacer scroll.
- **Temas**: `src/lib/themes.js` (3 gratis + 8 premium). En `useDashboard`,
  `esPremium` empieza en `null` («cargando») y `temasPremium` = propietario o plan
  que no es Free. Nunca tratar «cargando» como Free.
- **Landing**: sin framer-motion (sí se usa en el panel). Animaciones en CSS
  (`.sk-entra`, `.sk-revelar`, `.sk-plegable` en `index.css`) con
  `components/landing/Revelar.jsx` y `observar.js`.
- Fuentes propias en `public/fonts` (Inter y JetBrains Mono, OFL). Los `.js`/`.css`
  con huella se sirven con caché de un año.
- Si una parte no se descarga (típico justo tras un despliegue),
  `components/RecargaSiFalla.jsx` recarga una vez o muestra «Recargar».
- Código, comentarios y nombres en español, con el estilo del código de alrededor.
  El ESLint de `react-hooks` es estricto (no `setState` en efectos sin desactivarlo
  a propósito, no mutar durante el render).

## App Android
- `app-android/README.md` explica cómo recompilar. La **clave de firma no está en
  el repo**: la tiene el dueño (`sokyo-panel.keystore`, alias `sokyo`, con su
  contraseña). Huella SHA-256 `EC:3F:93:F3:…:DE:F9` en `api/server.js`
  (sobrescribible con `ANDROID_CERT_SHA256`).
- La APK se publica en `sokyo-panelFRONTEND/public/descargas/sokyo-panel.apk`. Si
  cambia, actualizar `versionCode`/`versionName` y `src/lib/appMovil.js`.
- Compilar: JDK 17+ y Android SDK 35. Detrás de un proxy, Maven Central puede dar
  429: usar el espejo `https://maven-central.storage-download.googleapis.com/maven2/`
  con un init script de Gradle.
- iPhone: sin app. Se usa la web en Safari («Añadir a pantalla de inicio»). No se
  marca como web app independiente porque perdería la sesión de Discord.

## Cómo se ha probado hasta ahora
- `npm test` (node:test, `test/*.test.js`), `npm --prefix sokyo-panelFRONTEND run lint`
  y `run build`.
- Prueba real: `api/server.js` con un cliente de Discord simulado y MongoDB en Docker
  (`mongo:7`), y Playwright (viene instalado) para recorrer las 41 secciones en móvil
  y escritorio con varios temas. El rendimiento se mide con Lighthouse en perfil
  móvil. Esos scripts vivían en el scratchpad de la sesión y no están en el repo.

## Historial reciente (PR a `feature/frontend-redesign`)
- #6 Crecimiento (invitaciones, bump de DISBOARD, página pública, directos).
- #7 «Mi cuenta»: portal de usuarios con estilo cristal y entrada con `/cuenta`.
- #8 Panel de admin rehecho (cristal, menú en 3 bloques, buscador Ctrl+K, mapa
  en Inicio), mover canales arrastrando y app Android con la sección «App móvil».
- #9 Web más rápida en el móvil (landing 80 → 95 en Lighthouse) y permisos de
  propietario para `1433388927233953902`.
- #10 Los temas premium ya no se pierden al abrir el panel en el móvil.
- #12 Guardar una categoría o un canal ya no se queda en «Guardando…»: una sola
  petición a Discord con solo lo que cambia, aviso del límite de nombres (2 cada
  10 min) y respuesta rápida aunque Discord retenga el cambio.
- 1.3.4 «Guardar orden» (mover canales) ya no falla por un canal privado de otra
  categoría: solo se manda a Discord lo que cambia, se comprueban antes los
  permisos del bot canal por canal y el panel dice cuál falla y por qué. La barra
  de guardar es opaca en el móvil (`sk-flotante`).
- 1.3.5 Mover un canal a otra categoría ya no falla con «Alguien ha creado o
  borrado un canal…» (se saltan los canales que desaparecen mientras se ordena).
  «Mi cuenta» para todo el servidor: mensaje fijo con el botón «Abrir mi cuenta»
  (`/panel-cuenta`, `!panelcuenta` o el panel → Tu comunidad → «Mi cuenta de los
  miembros»), «Ver mis tickets» en el panel de tickets, y el botón en `!help` y al
  mencionar al bot. Los botones `cuenta:abrir[:vista]` responden con el enlace
  mágico de cada uno (utils/cuenta.js).
- Ofrecido pero sin hacer: comando `/categoria crear` en Discord (hoy las
  categorías se crean desde el panel).
