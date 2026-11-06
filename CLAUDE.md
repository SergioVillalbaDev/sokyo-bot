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
    (portal de usuarios, `src/Portal.jsx`, `components/portal/`; `#ajustes` = avisos,
    preferencias y sanciones).
  - `/estado` y `/novedades`: páginas públicas del servidor (`utils/paginasEstado.js`).
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
  --no-git-tag-version`. **Versión actual: 1.9.14.** El aviso lleva la lista de
  novedades de `utils/novedades.js`: al subir de versión, apunta ahí lo nuevo (en
  pocas palabras y sin tecnicismos; si no hay entrada, sale el texto genérico o
  `ANUNCIO_MENSAJE`). Desde 1.8.0 cada novedad es `{ es, en, tab }`: también sale en
  la ventana «Novedades» del panel (una vez tras actualizar) y en la web `/novedades`.
  Un test exige que la versión de `package.json` tenga novedades. Quien apaga los
  anuncios en `/preferencias` no recibe el privado (lo ve en el canal general).
- **Música (Lavalink)**: desde marzo de 2026 Discord exige audio cifrado (DAVE) y
  solo lo hace Lavalink 4.2+. `scripts/lavalink.js` (pm2 `lavalink`) mira la versión
  del `lavalink/Lavalink.jar` y, si es vieja, descarga la 4.2.2 de GitHub (la
  anterior queda en `Lavalink.jar.anterior`). DAVE necesita glibc 2.35+ (Raspberry
  Pi OS Bookworm). `/api/health` dice en `musica` si está conectado y su versión, y
  el panel (Música) avisa si no puede sonar.
- **YouTube (1.9.10)**: en agosto de 2026 la 1.18.2 del plugin dejó de sonar («All
  clients failed… This video requires login»). `lavalink/application.yml` usa la versión
  de desarrollo `2be8e54` (repositorio `snapshots`; volver a una normal cuando salga la
  1.18.3+), el servidor de cifrado `remoteCipher` (`YOUTUBE_CIPHER_URL`, por defecto el
  público `cipher.kikkia.dev`) y clientes por `YOUTUBE_CLIENTS`. Lo que de verdad quita el
  «requires login» es una **cuenta de YouTube** (Google secundaria): panel → Música →
  «Cuenta de YouTube», solo propietarios (`utils/cuentaYoutube.js`, `CuentaYoutube.jsx`,
  `/api/musica/youtube*`). El bot pide a Lavalink el inicio de sesión de TV (`POST
  /youtube`), el lanzador lee de su salida el código y el token y los guarda en
  `lavalink/.youtube-cuenta.json` (0600, fuera de git); el bot pasa el token en cada
  conexión. **El token NO va en application.yml**: uno caducado tumba el arranque de
  Lavalink (probado). Si cambia `utils/cuentaYoutube.js`, reiniciar también Lavalink.
  Una canción que falla (`trackError` en `utils/musica.js`) se prueba una vez con otra
  subida de la misma canción y, si no, se explica sin el error de Java; `queueEnd` espera a
  ese reintento. Desde una IP de la nube YouTube lo bloquea todo: no se puede probar el
  sonido aquí, solo con la Pi (SoundCloud y JioSaavn tampoco sirven de repuesto). Al
  aplicar la cuenta, solo «oauth2 token fetch: 400/401» (Google la rechaza) la borra; otro
  fallo la deja y reintenta al minuto. Los tests no escriben por stdout (rompe el ejecutor).
- **Apagones en la Pi (nov. 2026)**: con una fuente que no da bastante corriente
  (`vcgencmd get_throttled` ≠ `0x0`; `0x50000` = hubo bajo voltaje) la Pi se apagó justo
  tras desplegar y lo recién escrito quedó VACÍO en la tarjeta (`package.json`, ~130
  archivos del repo, `node_modules` del panel, el `dist` del panel): bot y Lavalink en
  bucle con «Invalid package config». Se arregla en la Pi: `git checkout -- .` (+ `sync`),
  reinstalar `node_modules` del panel y recompilar con el bot parado, y borrar
  `lavalink/plugins/youtube-plugin-*.jar` para que se baje limpio. Desde 1.9.12
  `deploy.sh` hace `sync` antes de reiniciar. `git status` en la Pi debe salir limpio.
- El `.env` de la Pi no es accesible desde aquí. Lo que deba valer en la Pi sin
  tocar el `.env` va en código (p. ej. `utils/propietarios.js`).

## Propietarios del bot
`utils/propietarios.js`: los de `OWNER_IDS` del `.env` más los fijados en el código
(`1433388927233953902`). Ven todos los servidores, cambian planes, usan `/sistema`
y la búsqueda de empleo. Para quitar a alguien hay que borrarlo de ese archivo.
Su grupo del menú, **Propietario** (el último, `owner: true` en `navConfig.js`), tiene
Suscripciones y **Mensaje de entrada** (1.9.11, `OwnerEntradaView.jsx`): el mensaje que manda
el bot al entrar en un servidor (`utils/onboarding.js` → `construirBienvenida` con los ajustes
de `models/MensajeEntrada.js`, documento global `clave: 'global'`, en caché 1 min con
`cargarMensajeEntrada`). Por defecto va por privado al dueño y al canal solo de respaldo
(`alCanal: 'respaldo'`), con la guía «Todo lo que puedo hacer». API: `GET/PUT
/api/owner/mensaje-entrada` y `POST …/probar` (a tu privado, botones desactivados); las
rutas de propietario exigen `req.staff.owner` (con la API key sola dan 403).

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
- **Landing** (`components/landing/`, estilo cristal en `src/landing.css`, clases
  `.lx-*`): sin framer-motion (sí se usa en el panel). Animaciones en CSS
  (`.sk-entra`, `.sk-revelar`, `.sk-plegable` en `index.css`) con
  `components/landing/Revelar.jsx` y `observar.js`; solo con `transform`/`opacity`
  (animar `width`/`height` disparaba el bloqueo en Lighthouse). Las secciones de
  abajo llevan `.lx-diferido` (`content-visibility: auto`); al pulsar un enlace
  `#…` `Landing.jsx` añade `.lx-listo` para pintarlas todas y caer en su sitio.
  `Revelar` va por fuera de la tarjeta (`lx-card lx-pulsable` dentro): si no, sus
  transiciones se pisan. Textos en `landing.*` (es/en), incluida la demo de
  «Mi cuenta» (`MiCuentaDemo.jsx`, `landing.cuenta`).
- **Landing, estructura (1.5.0)**: `Landing.jsx` pinta la barra, el hero y «Dos
  entradas» (`Accesos.jsx`); todo lo demás (`LandingResto.jsx`: recorrido por el
  panel `Tour.jsx`, funciones, «Así está organizado» `Mapa.jsx`, Mi cuenta, app
  móvil `AppMovil.jsx`, seguridad, precios, preguntas, CTA y pie) llega en otra
  descarga dos fotogramas después de pintar la portada (si no, el móvil tarda más
  en enseñarla). Los enlaces `#…` a esas secciones se resuelven al llegar
  (`irAlEnlace`). El botón del panel es `EnlacePanel` (`Marcos.jsx`, clase
  `.lx-btn-panel`) y va siempre visible en la barra, también en el móvil.
  `Mapa.jsx` saca los bloques y grupos de `navConfig.js` (los nombres, de
  `landing.map`: si cambia el menú del panel, actualízalos igual que en el panel).
- **Capturas de la landing**: `public/landing/<es|en>-<nombre>-<640|960|1800>.webp`
  (escritorio) y `<es|en>-m-<inicio|cuenta>-<390|780>.webp` (móvil), elegidas con
  `srcset` (`components/landing/capturas.js`). Se sacaron con un servidor de
  ejemplo («Nébula Gaming», usuario «alex») y Playwright; esos scripts vivían en el
  scratchpad. Si cambia mucho el panel, hay que repetirlas en los dos idiomas y
  subir `VERSION` en `capturas.js` (va en la dirección, `?v=…`; se guardan un mes).
- **Vídeos «cómo se hace»** (tipo GIF): `public/videos/<es|en>-<id>.{mp4,webm,webp}`
  (H.264 + VP9 para los Chromium sin H.264, y póster). Ids: inicio, tickets,
  automod, niveles, analitica, buscador, sorteos, bienvenidas, canales, micuenta.
  `components/VideoDemo.jsx` los reproduce en bucle solo cuando se ven (y quietos
  con reducir movimiento o ahorro de datos); `lib/videos.js` dice qué sección del
  panel tiene vídeo (`VIDEOS_PANEL` → botón «Ver cómo se hace» de la cabecera,
  ventana `VideoAyuda.jsx`, pasos en `dashboard.videoAyuda.pasos`). En la landing
  van en el recorrido (`Tour.jsx`, 10 pestañas). Se grabaron con Playwright sobre
  el servidor de ejemplo (puntero visible) y ffmpeg; los scripts vivían en el
  scratchpad. Si cambia una pantalla, hay que regrabar su vídeo en los dos idiomas
  y subir `VERSION` en `lib/videos.js` (va en la dirección; se guardan un mes).
- **Autoguardado** (`hooks/useAutoguardado.js` + `EstadoAutoguardado.jsx`): en las
  secciones de ajustes, `useAutoguardado(valor, guardar, { listo })` guarda solo al
  dejar de tocar (1,5 s), con Ctrl + S y al salir de la sección; avisa si se cierra
  la pestaña con cambios. El `guardar` de la sección debe devolver `false` /
  `{ ok: false }` si falla (entonces reintenta, cada vez más espaciado). Solo cuenta
  como cambio lo que pasa tras tocar algo. No va en secciones que publican en
  Discord o tienen límites (canales, paneles). Se apaga en Preferencias (⚙).
  **Borradores (1.9.10)**: con `{ borrador: 'nombre', restaurar }` (lo contrario de armar
  el valor; `useModulo` ya lo pasa) lo no guardado se copia al momento en localStorage
  (`sokyoBorrador:<servidor>:<sección>`) y se recupera al volver tras recargar o cerrar,
  con aviso y «Descartar» (`AvisoBorrador.jsx`); si lo guardado cambió desde entonces,
  solo si es de hace menos de 10 min. Al ocultar o cerrar la página se intenta guardar ya
  (al recargar el navegador puede cortarlo: para eso está el borrador); con el autoguardado
  apagado avisa antes de salir y el estado es `sin-guardar`.
  Cerrar sesión borra los borradores. **Toda sección nueva con autoguardado: pásale
  `borrador` y `restaurar`.** Otros modos del mismo hook: sin `guardar` (null) = solo
  borrador (Creador de mensajes, Dinámicas, editor de paneles de roles); `useBorrador(sección,
  valor, vacío, restaurar)` para formularios de crear algo (anuncios, encuestas, eventos,
  sorteos: al vaciarse tras crear, el borrador desaparece); `manual: true` = se guarda solo
  con su botón (voz temporal, página pública, acceso al panel), con «Cambios sin guardar» y
  `avisarGuardado()` tras guardar bien. `borrarBorrador(sección)` lo quita a mano. Lo que
  cambia tarde (subir una imagen, resolver un enlace) llama a `marcarInteraccion()` antes:
  si no, pasado 1,5 s se tomaba por algo del servidor y no se guardaba. Sin borrador aún:
  ajustes de tickets, textos, registros y las listas (auto-respuestas, fijos, tipos, roles).
  **Copiar del servidor al formulario**: con `useDesdeServidor(configServidor, () => …)`
  (`hooks/useDesdeServidor.js`), NO con un `useEffect([configServidor])`: la respuesta de su
  propio guardado (marcada con `marcarEco` en `useDashboard`) no se copia, porque borraba las
  filas a medias (multiplicador sin rol, pregunta vacía), lo escrito mientras se guardaba y
  los campos vaciados (volvía el texto de fábrica). Lo mismo en `useModulo` y las vistas de
  Crecimiento: tras guardar, `form` no se pisa con `r.config`. Si el servidor cambia otro
  ajuste al guardar (p. ej. verificación ↔ doble bienvenida), la vista lo hace también.
- **Mensajes con botón que el bot deja fijos** (1.9.14, `utils/panelMensaje.js`): «Preséntate»
  (`presentaciones.panel`) y «Nueva sugerencia» (`sugerenciasPanel`) se guardan como `{ contenido,
  embed, textoBoton, estiloBoton }` (vacío = de fábrica en el idioma del bot: `defectoPanel*` en
  `utils/comunidad.js`, `GET /api/config/:g/paneles/:tipo/defecto`) y se arman con `armarPanel`; se
  publican con `editarOPublicar` (reedita el que hay, nunca repite). La ruta de la sección solo toca
  Discord si cambia algo que se ve (`mismoPanel`), de canal, o si la última vez falló (`panelPendiente`
  / `sugerenciasPanel.pendiente`, con aviso en el panel). En el panel: `EditorMensajePanel.jsx` (texto,
  `EmbedBuilder` empezando por lo de fábrica, `EditorBoton`, «Volver al de fábrica») y
  `lib/panelMensaje.js`. **Un panel nuevo de este tipo: hazlo igual y apúntalo en
  `utils/panelesPublicados.js`**, que reescribe los ya publicados (solo edita) al cambiar el idioma del
  bot (`PUT …/textos`, `!sokyolanguage`) y al «Deshacer» un ajuste suyo (`afectaPaneles`). El pie de
  fábrica del editor es solo el del servidor: «Powered by Sokyo» lo pone el bot al publicar en Free.
  Sugerencias en formulario: el bot cierra el canal a @everyone y apunta si lo hizo él
  (`sugerenciasPanel.bloqueado`); al salir del modo o cambiar de canal lo vuelve a abrir solo entonces y
  quita el botón. **Idioma del bot ≠ del panel**: `AvisoIdiomaBot.jsx` (Inicio, ocultable, y en los
  editores) con «Pasar el bot a …» (`cambiarIdiomaBot`, solo con el área config).
- **Buscador en los desplegables** (`BuscadorSelects.jsx`, montado en `Dashboard.jsx`): todo
  `<select>` del panel con 8 opciones o más abre una lista con buscador (ratón, toque, teclado)
  y cambia el valor como a mano (`change`), así que vale para cualquier sección sin tocarla.
  `data-sin-buscador` lo quita en uno concreto.
- **Modo ligero** (`lib/ligero.js`, `src/ligero.css`, clase `sk-ligero` en `<html>`):
  sin cristal difuminado ni fondo animado. Automático en Firefox, con ≤4 núcleos o
  ≤4 GB; se elige en Preferencias (vale para web, panel y Mi cuenta). En el panel,
  además, `MotionConfig reducedMotion`.
- **Historial del panel**: cada sección (y el ticket abierto, `…/t/<canal>`) es un
  paso del historial (`Dashboard.jsx`): el atrás del navegador y el botón «Atrás»
  de la cabecera vuelven a lo anterior. Atajos: Ctrl+K, /, ?, Ctrl+S, Alt+←.
- **Miembros** (`views/MiembrosView.jsx`, pestaña `mod-miembros`): lista de todo el
  servidor (`GET /api/servidor/miembros/lista`, por páginas) con Aislar · Expulsar ·
  Banear (el formulario `AplicarModal` del Centro de mando) y baneados
  (`/api/servidor/baneos`). La foto de abajo del menú abre «Mi perfil» (Mi cuenta)
  con `POST /api/staff/mi-cuenta`; «Mi cuenta» tiene botón al panel si ya se entró.
- **Permisos**: `PERMISOS_CATALOGO` (roles, `api/server.js`) y `PERMISOS_CANAL`
  (`api/routes/canales.js`) tienen todos los de Discord, con nombre y explicación en
  `roles_v.perms` / `roles_v.permsDesc`. Crear/editar canales comprueba antes
  Comunidad (anuncios/escenario), «Gestionar canales» y permisos que el bot no puede
  dar, y responde con `codigo` para que el panel lo explique.
- **Historial de cambios** (`utils/historialCambios.js`, modelo `CambioPanel`, 90 días):
  un middleware de `/api` compara `ServidorConfig` antes y después de cada guardado,
  ajuste a ajuste (`'bienvenida.canalId'`), y la respuesta lleva `X-Sokyo-Cambio`
  (lib/api.js → evento `sokyo-cambio` → aviso «Guardado · Deshacer», `AvisoDeshacer.jsx`).
  Lo que lleva el bot por su cuenta (estado de juegos, bump, mensajes publicados…)
  está en `utils/camposInternos.js`: no se apunta, no se deshace, no se copia a otro
  servidor y no se pisa al importar. Deshacer comprueba áreas y la jerarquía de roles.
- **Diagnóstico** (`utils/diagnostico.js`, sección `config-diagnostico`, aviso en el
  Inicio si hay errores): permisos del bot, canales/roles borrados o que el bot no
  puede usar, módulos a medio configurar y música; textos desde la API en el idioma
  del panel. «Quitarlo» solo quita lo que de verdad ya no existe.
- **Comodidades del panel 1.8.0**: buscar ajustes concretos y resaltarlos
  (`lib/indiceAjustes.js`, saca los textos de cada vista de `dashboard.<espacio>`),
  favoritos (`lib/favoritos.js`), ficha rápida al pasar el ratón (`FichaRapida.jsx`,
  `GET /api/servidor/miembro/:id/ficha`), acciones en grupo en Miembros, «➕ Crear
  canal/rol nuevo…» en los desplegables (`<OpcionCrear />` + `CrearAlVuelo.jsx`, que
  escucha el `change` en captura), asistente por tipo de servidor en el Inicio
  (`AsistenteInicio.jsx`), copiar ajustes a otro servidor (Backup), letra/compacto/
  tema según el sistema (`lib/aspecto.js`) y avisos del navegador (`lib/avisosNavegador.js`).
- **Comandos con barra (1.9.11)**: TODO comando de prefijo (`comandos/*.js`) tiene su versión
  `/` en `slash/` hecha con `crearSlashDesdePrefijo` (`utils/puenteSlash.js`): traduce las
  opciones a los argumentos de siempre y le pasa al comando un «mensaje» equivalente (reply,
  menciones, adjuntos, cfg), así las dos formas hacen lo mismo. `test/puenteSlash.test.js`
  falla si un `!comando` nuevo no tiene su `/` (o si un nombre se repite). Las opciones de texto se
  parten en palabras (motivos); `junto: true` las pasa enteras (nombre de un rol con espacios) y
  `efimero: true` en el comando hace que solo lo vea quien lo usa (`/reportar`). Las ayudas de uso de
  los comandos enseñan la forma con `/` (nombre en español en el texto en español).
- **Discord 1.8.0**: clic derecho (`slash/ctx*.js`), `/ayuda` por categorías
  (`utils/ayuda.js`: si añades un comando, apúntalo ahí), todos los slash con nombre en
  español, errores explicados con botón al panel (`utils/erroresDiscord.js`),
  `!ban`/`!kick` piden confirmación y ban/aislar tienen «Deshacer» 15 min, botones y
  ventanas nuevos en `utils/interaccionesExtra.js`, `/recordar` y `/recordatorios`,
  `/preferencias` (modelo `PreferenciasMiembro`: idioma y privados), música con
  sugerencias, votos, `/letra` (LRCLIB) y ❤️ favoritas (`utils/musicaExtra.js`).
- **Tickets 1.8.0**: `esperaRespuesta`/`ultimoMensajeUsuario` en `Ticket` (los invitados
  cuentan como el lado del usuario), aviso a las X horas (`avisoSinRespuestaHoras`,
  `utils/avisosTicket.js`), privado al responder desde el panel y «está escribiendo»
  (`utils/escribiendo.js`, intent `GuildMessageTyping`).
- **Funciones 1.9.0** (cada una con su `utils/*.js`, sección del panel y textos `dashboard.<x>_v`):
  cumpleaños (`utils/cumpleanos.js`, `/cumple`, modelo `Cumpleanos` global por persona, también en
  «Mi cuenta»; rol del día con `RolTemporal`), solicitudes al staff (`utils/solicitudes.js`, formularios
  de hasta 5 preguntas en `solicitudes.formularios`), salón de la fama (`utils/salonFama.js`, desde
  `messageReactionAdd/Remove`: ojo, discord.js manda `(reaction, user, detalles)` y el `client` va 4.º),
  buscar grupo (`utils/grupos.js`, `/grupo`, sala de voz al llenarse que se borra a los 5 min vacía),
  clanes (`utils/clanes.js`, `/clan`; suma la XP de `otorgarXp`/`otorgarXpVoz`, cierre de semana el
  lunes), confesiones (`utils/confesiones.js`, `/confesar`; «Ver quién fue» en el panel exige el área
  moderación y deja un log), ausente (`utils/ausente.js`, `/ausente`, en memoria + BD), traducir (clic
  derecho, `utils/traducir.js`: MyMemory gratis y, si falla, la IA del servidor), mensajes fijos
  (`utils/mensajesFijos.js`, modelo `MensajeFijo`), contadores en canales (`utils/contadoresCanal.js`,
  `contadoresCanal`, cada 10 min por el límite de nombres de Discord), ayuda antes del ticket
  (`utils/ayudaPrevia.js`: busca en las respuestas automáticas y, si se quiere, la IA responde solo con
  ellas) y tickets por privado (`utils/ticketsPrivado.js`, intent `DirectMessages`, `Ticket.porPrivado`).
  Los botones nuevos pasan por `utils/interaccionesComunidad.js`; la creación del ticket del formulario
  está en `abrirTicketFormulario` (`events/interactionCreate.js`). API del panel: `api/routes/modulos.js`
  (`/api/config/:guildId/modulos/<x>`), en el panel `cargarModulo`/`guardarModulo`/`accionModulo` y el
  hook `hooks/useModulo.js`. Menú: grupo nuevo «Diversión» (`diversion`).
- **Avisos de directos** (`utils/directos.js`): Twitch, YouTube, Kick (`kick.com/api/v2/channels`),
  Reddit (su RSS) y cualquier web con RSS. Las direcciones que escribe el staff pasan por
  `utils/redSegura.js` (nada de IPs privadas, también tras redirecciones). TikTok no tiene forma
  pública de saber cuándo alguien publica: no se ofrece.
- **Modo simple / avanzado de permisos** (1.9.11, `lib/modoPermisos.js` +
  `SelectorModoPermisos.jsx`, se recuerda en el navegador): simple = lo de siempre; avanzado =
  todo lo de Discord. Roles: «Mostrar por separado» (`separado` → `hoist`) en los dos modos;
  en avanzado `mencionable`, `colorSecundario` (degradado, solo con `ENHANCED_ROLE_COLORS`) y
  `emoji` (`unicodeEmoji`, solo con `ROLE_ICONS`; `GET /api/roles/funciones`), copiar y quitar
  permisos. Canales: `@everyone` en los dos modos; en avanzado, permisos de miembros concretos
  (`tipo: 'miembro'`, `quitarMiembros` para borrarlos) y «Permitir/Denegar todo». **Cada
  overwrite que se manda a Discord lleva `type`** (0 rol, 1 miembro): sin él, discord.js lo
  busca en caché y falla con «not a cached User or Role» (pasaba al guardar tickets).
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
- 1.4.0 Web principal rehecha en cristal: hero con las dos entradas (añadir el
  bot / entrar a mi cuenta), «¿Por dónde empiezas?», funciones en rejilla, demo
  en 3 pasos de cómo se entra a «Mi cuenta», precios, preguntas, CTA y páginas
  legales en cristal. Lighthouse móvil igual que antes en local (76-78, sin
  compresión). El tutorial del panel ya no parte «Siguiente →» en dos líneas.
- 1.5.0 Web principal rehecha con el **panel de control al frente**: botón
  «Panel de control» siempre a la vista (también en el móvil), hero con capturas
  reales del panel y de Mi cuenta, «Dos entradas, cada una a lo suyo», recorrido
  por el panel en pestañas, «Así está organizado» (el menú del panel), app móvil
  (APK e iPhone), seguridad, más preguntas y pie con todos los accesos. Lighthouse
  móvil igual que 1.4.0 (93-97). Arreglos del panel: al entrar directo a una
  sección que no es Inicio ya no sale «Plan Free»/«Subir a Pro» en servidores
  Premium; las gráficas de Analítica (miembros, mensajes por día, tickets) salían
  vacías por un color inexistente (`var(--brand)`); en el móvil, el título de un
  ticket abierto ya no se parte palabra por palabra y la conversación va primero.
- 1.6.0 Vídeos cortos «cómo se hace» (en bucle como un GIF, 150-600 KB) en el
  recorrido de la web y en el panel (botón «Ver cómo se hace» con sus pasos).
  Arreglos: en el chat de un ticket, las respuestas del staff salen a la derecha
  (antes se miraba el nombre «Admin»/«Sokyo»; ahora, todo lo que no escribe el
  autor del ticket ni un invitado es del staff), la respuesta aparece al momento,
  primero va a Discord y luego se guarda (si Discord falla, el panel lo avisa y
  devuelve el texto a la caja para reintentar), la columna
  del chat ya no se desplaza de lado ni se queda estrecha a 1280 px; la rueda
  del ratón encima de un campo numérico ya no cambia su valor (main.jsx); los
  botones de variables de la bienvenida insertan `{server}`/`{members}`.
- 1.7.0 La música vuelve a sonar (Lavalink 4.2.2 automático por el audio cifrado de
  Discord; aviso en el panel y en el canal si Discord rechaza la voz). Crear canales
  de anuncios dice el motivo real (p. ej., falta la Comunidad) en vez de «permisos».
  Sección «Miembros y baneos». Todos los permisos de Discord con explicación y
  buscador. Autoguardado, botón «Atrás» e historial del navegador, perfil desde la
  foto del menú, acceso al panel desde Mi cuenta, mover categorías con «Mover» /
  «Solo categorías» / «Al principio», modo ligero (Firefox y PCs modestos), atajos
  (?), «Volver arriba» y recientes en el buscador.
- 1.8.0 Comodidad e intuitividad en todo: diagnóstico «¿Algo no funciona?»,
  «Deshacer» e historial de cambios, clic derecho en Discord (sancionar, ficha,
  reportar, ticket), `/ayuda` por categorías y comandos en español, errores con
  solución, recordatorios y preferencias de cada miembro, música (sugerencias, votos,
  letra, favoritas), avisos de eventos y sorteos, tickets sin respuesta y «está
  escribiendo», buscador de ajustes, favoritos, ficha rápida, acciones en grupo,
  crear canal/rol al vuelo, asistente de inicio, copiar ajustes a otro servidor,
  ventana de novedades, letra grande/compacto/tema automático, avisos del navegador,
  «Mi cuenta» con avisos y sanciones, y páginas públicas `/estado` y `/novedades`.
- 1.9.0 Más vida en el servidor: cumpleaños, solicitudes al staff, salón de la fama,
  /grupo, clanes, confesiones, /ausente, traducir con clic derecho, mensajes fijos,
  contadores en canales, ayuda antes de abrir un ticket, tickets por privado y avisos
  de Kick, Reddit y RSS. Grupo «Diversión» en el menú del panel.
- 1.9.1 Bienvenidas: «Enviar prueba» funciona aunque el mensaje esté desactivado
  (`enviarBienvenida(member, cfg, { prueba: true, idioma })`), guarda antes lo que se
  ve y dice qué permiso falta; los errores salen en el idioma del panel. Recortar
  imágenes de los embeds (`RecortarImagen.jsx` + `lib/recorte.js`): al subir (o con
  «Ajustar») se mueve, amplía y gira con vista previa de Discord; forma `circulo`
  (iconos del autor y del pie: «Que se vea entera» mete el logo completo en el
  círculo), `cuadrado` (miniatura) y `ancho` (imagen grande). Va en un portal a
  `.sk-dash`: dentro de una tarjeta con cristal, un `fixed` salía cortado. Los GIF se
  suben tal cual. «Añadir campo» ya no se borra: `sanearEmbed` guarda los campos a
  medias (si no, el autoguardado los quitaba) y solo se mandan los completos
  (`camposCompletos`; `embedTieneAlgo` para guardar, `embedTieneContenido` para enviar).
- 1.9.2 Bienvenidas: aviso arriba con el estado real (`lib/estadoBienvenida.js`, con
  test): si NO se manda (apagada, sin canal, canal borrado, vacía) o si sale sin
  notificación (mención apagada, sin `{mention}` en el texto o solo dentro del embed:
  Discord no avisa por las menciones de los embeds), con botón para arreglarlo. Si está
  encendida y falla al entrar/salir alguien, se apunta en el Registro (Entradas/Salidas)
  y en el canal de logs (`events/guildMemberAdd.js` y `guildMemberRemove.js`).
- 1.9.3 Enlazar canales en bienvenidas/despedidas: «#reglas» se convierte en `<#id>` al
  enviar (`utils/mencionesCanal.js`, con test): busca el canal por nombre exacto y, si
  no, sin mayúsculas, tildes ni adornos («📜・reglas»); nunca categorías; no toca
  `# Título`, enlaces con `#`, `C#` ni `<#id>`. Se aplica al texto, la descripción y el
  valor de los campos (donde Discord enseña enlaces). En el panel, desplegable
  «Mencionar un canal» junto a las variables.
- 1.9.4 Al escribir «#» en la bienvenida/despedida (texto, descripción y valor de los
  campos del embed) sale la lista de canales, como en Discord: `TextareaCanales.jsx`
  (lógica en `lib/canalesTexto.js`, con test), con ratón, toque o ↑ ↓ + Enter/Tab y
  Escape. Inserta «#nombre» y el bot lo convierte al enviar (1.9.3). `EmbedBuilder`
  solo lo activa si recibe `canales` (hoy, solo Bienvenidas: es donde se convierte).
- 1.9.5 Varias bienvenidas (una por juego/categoría): `ServidorConfig.bienvenidasExtra`
  (hasta 15, `{ id, nombre, activo, cuando: 'entrar'|'rol', rolId, canalId, contenido,
  mencionar, embed }`). Salen al entrar (`events/guildMemberAdd.js`) o al recibir el rol
  (`events/guildMemberUpdate.js`, se salta miembros parciales y bots) con
  `enviarBienvenidasExtra` (`utils/bienvenida.js`); los fallos van al Registro con
  `apuntarFallo`. API: `PUT …/bienvenidas` acepta `extras` y `POST …/probar` acepta
  `extraId`. El panel las muestra como fichas encima del editor («Principal» + las
  demás + «Añadir mensaje»), con estado propio (`estadoMensaje` mira también el rol) y
  el Diagnóstico revisa su canal, permisos y rol. Las etiquetas de imagen/miniatura del
  embed dicen que vale un GIF (y «GIF subido» si lo es).
- 1.9.6 Panel de entrada de la Doble bienvenida personalizable (`embudoAB.panel`: `contenido`,
  `embed`, `textoBoton`, `estiloBoton`; `contenidoPanel` en `utils/embudo.js`, sin embed sale el
  de siempre) y color del botón en la verificación (`verificacion.estiloBoton`). Colores por
  nombre (verde/azul/gris/rojo): `estiloBoton`/`sanearEstiloBoton` en `utils/embeds.js`, en el
  panel `lib/estilosBoton.js` + `EditorBoton.jsx`; `EmbedBuilder` acepta `texto` y `botones`
  para la vista previa. «#canal» se enlaza también en estos paneles (`mencionarEnMensaje`).
  Publicar guarda antes y reedita con `attachments: []` (si no, la imagen vieja se quedaba).
  Aviso «Has cambiado el mensaje del panel…» hasta publicar. `useModulo` refresca los datos de
  las secciones 1.9.0 cada 5 s y al volver a la pestaña (sin tocar `form`). Test en
  `test/paneles.test.js`.
- 1.9.7 Diseños de tarjeta con imagen o GIF de fondo (catálogo global de Niveles, solo para
  propietarios: `PUT /api/presets-tarjeta` exige `req.staff.owner` y el panel solo lo enseña a
  ellos). `CatalogoPresets.fondoTipo: 'imagen'` + `fondoImagen` + `encuadre` ({ escala, x, y,
  giro, ancho, alto }): se ajusta con `RecortarImagen` forma `tarjeta` (no recorta: devuelve el
  encuadre, así que también vale para GIF) y lo aplica `utils/rankCard.js` (`dibujarFondo`;
  GIF con `omggif`, fotogramas a ≤ 900 px, animado solo en Pro). `utils/catalogoTarjetas.js`
  sanea los diseños y el bot usa el diseño del catálogo como esté ahora (`opcionesTarjeta`).
  Vista previa en la web: `lib/encuadreTarjeta.js`; la real, `POST /api/presets-tarjeta/preview`.
  Arreglo del autoguardado (`useDesdeServidor`, ver Autoguardado) y buscador en los desplegables.
  Test en `test/tarjetas.test.js`.
- 1.9.8 Vistas previas de Discord en todo lo que manda un mensaje: `VistaDiscord.jsx` (avatar y
  nombre del bot con APP, texto, embed y botones) con `MarkdownDiscord.jsx` (negrita, cursiva,
  citas, menciones y emojis) y `lib/rellenarEjemplo.js` (cambia `{mention}`, `{level}`… por
  ejemplos; los que no existen se dejan). Lleva `variables` con los mismos nombres que rellena el
  bot (`utils/niveles.js`, `cumpleanos.js`, `invitaciones.js`, `bump.js`, `directos.js`…). En
  Niveles, Cumpleaños, Invitaciones, Bump, Directos, Solicitudes (panel con botones y mensaje al
  aceptar), Mensajes fijos y Auto-respuestas. `EmbedBuilder` acepta `texto`, `botones` y
  `variables` (Bienvenidas: texto de encima y `{avatar}`). **Si añades una sección que manda un
  mensaje, ponle `VistaDiscord` con las variables del bot y copia los textos por defecto.**
  Test en `test/vistaprevia.test.js`.
- 1.9.9 Vistas previas en las demás secciones que mandan algo a Discord: sugerencias, presentaciones,
  eventos, sorteos, encuestas, confesiones, salón de la fama, grupos, clanes, parte diario, ausente,
  dinámicas (una por mensaje), reportes, paneles de roles, voz temporal, música, registros y el
  privado de las sanciones. Nuevo `VentanaDiscord.jsx` (la ventana/formulario que abre un botón del
  bot: sugerencia, presentación) y `VistaDiscord` acepta `embed.autor` y `menu` (desplegable). Cada
  vista previa copia el formato de su `utils/*.js` (se cita en un comentario encima) y los textos por
  defecto en es/en; `lib/pieMarca.js` pone «Powered by Sokyo» solo si `esPremium === false`.
  Contadores: `PreviaCanal` (nombre del canal de voz con una cifra de ejemplo). Ojo (descubierto
  al hacer la de sanciones): el privado de una sanción usa el color y el emoji de la ACCIÓN, no los
  del tipo (`utils/moderationManager.js`: `enviarDM`); el color/emoji del tipo solo se ven en el panel.
- 1.9.10 La música vuelve a sonar (YouTube, ver *Desplegar → YouTube*): plugin de desarrollo,
  servidor de cifrado, «Cuenta de YouTube» en Música, otra versión de la canción si un vídeo
  falla y errores con palabras normales. Autoguardado que no pierde nada al recargar
  (borradores, ver *Autoguardado*). Confesiones escribiendo en un canal (opcional:
  `confesiones.escribirEnCanal` + `canalEscrituraId`, vacío = el de las confesiones): en
  `events/messageCreate.js` va lo primero (antes del automod, la actividad y la XP), el bot
  borra el mensaje, lo pasa por `enviar` como /confesar y contesta por privado (si falla, le
  devuelve su texto). Si no puede borrarlo no la publica; su borrado no va al registro
  (`esBorradoPorConfesion`); el Diagnóstico mira «Gestionar mensajes» ahí. Tests en
  `test/musica.test.js` y `test/confesiones.test.js`.
- 1.9.10 (2.ª parte) **Imágenes y GIF** (`src/lib/imagenes.js` + `hooks/useSubidaImagen.js` +
  `EstadoSubida.jsx`; en «Mi cuenta», `components/portal/prepararPortal.js`): todo campo de imagen
  mira qué es el archivo por sus bytes (galerías del móvil sin tipo), no recorta lo animado (se
  quedaba quieto), encoge GIF de más de 8 MB (omggif + gifenc, se cargan solo si hacen falta),
  pasa WebP/PNG animados (ImageDecoder) y vídeos cortos (WhatsApp/Telegram) a GIF, y cambia el
  enlace de la página de Tenor/Giphy por el GIF (`GET /api/imagen/enlace`; Tenor por su og:image
  con `redSegura`). El servidor también mira los bytes (`utils/imagenes.js`) en todas las subidas.
  Ojo: Eventos, Sorteos, Encuestas, Dinámicas y voz temporal guardan `/uploads/…` y el bot le
  pone delante `FRONTEND_URL` (Discord la descarga): si no es pública, no se ve (lo avisa el
  Diagnóstico). El Creador de mensajes y los paneles de roles adjuntan el archivo. Enviar desde
  el Creador comprueba antes «Adjuntar archivos» y explica los errores de Discord.
  **Creador de mensajes**: «Guardar» junto a «Enviar» (mensajes guardados = `AnuncioPreset`,
  `PUT /api/anuncios/presets/:id` para guardar cambios) y borrador. **Emojis**: renombrar
  (`PATCH /api/servidor/emojis/:id`), huecos por nivel de mejoras (`/emojis/limite`) y los que
  Discord desactiva al perder mejoras (`disponible: false`; «No hay ranuras de emojis abiertas»
  es Discord). Tests en `test/imagenes.test.js` (con `test/fixtures/`).
- 1.9.11 **Música**: `/play` cumple las mismas reglas que la web (`fuenteDe`, `limitarEncolado`,
  `nodoMusica` en `utils/musica.js`: fuentes permitidas, playlists, tope de la cola, «ya
  suena en otro canal») y nunca enseña el error técnico; los dos buscan ANTES de entrar a la voz
  (si no hay nada que añadir, el bot no se queda en el canal callado); Lavalink arranca con `clientReady`
  (`'ready'` está obsoleto). **Roles**: «Mostrar por separado» y modo simple/avanzado (los colores solo se mandan si
  cambian: así no se pierde el estilo holográfico de Discord); **canales**:
  `@everyone`, permisos por miembro y `type` en cada overwrite (ver *Modo simple / avanzado*).
  **Todos los comandos con `/`** (ver *Comandos con barra*), `/ayuda` al día (descripciones
  reales, sin «solo con prefijo») y `/sancionar` sin tipo enseña la lista. **Mensaje de entrada**
  configurable por los propietarios (ver *Propietarios del bot*). Tests: `test/puenteSlash.test.js`,
  `test/entrada.test.js` y más en `musica` y `canales`.
- 1.9.12 **Verificación única** (`utils/preguntasEntrada.js`, `preguntasEntrada` en la config, tarjeta
  `PreguntasEntrada.jsx` en Verificación): tras el botón/captcha o la doble bienvenida (`siHayPreguntas`
  en `verificacion.js` y `embudo.js`), preguntas una a una con desplegable (`entq:<gid>:<n>`, también por
  MD), cada opción da un rol (y abre una categoría); el rol de acceso se da AL TERMINAR. **Cerrar el
  servidor** (`utils/cierreServidor.js`, `CierreServidor.jsx`, `GET/POST /api/seguridad/:g/cierre`, solo
  admins): canal de verificación abierto a @everyone, rol de acceso con «Ver canales», canales abiertos a
  @everyone → al rol de acceso, categorías de las respuestas solo con su rol y, lo ÚLTIMO, @everyone sin
  «Ver canales». **Presentaciones con aprobación** (`presentaciones.aprobacion`, `revisarPresentacion`,
  botones `intro_ok/intro_no`, `POST /api/presentaciones/:id/revisar`, privado de rechazo con {motivo});
  el panel «Preséntate» ya no se publica en cada guardado (`panelMensajeId`). **Reportes anónimos**
  (`reportes.ocultarAutor` + `rolesVerAutor`, botón `rep_autor`, la API oculta el autor a quien no puede;
  `!report` borra el mensaje y confirma por privado; `/reportar` efímero). **Tickets**: categoría de
  abiertos siempre (`categoriaAbiertos` la crea si falta) y de cerrados por id (`categoriaArchivadosId`) o
  nombre; `POST …/tickets/ordenar`. **Mensaje de «Mi cuenta» personalizable** (`panelCuenta.contenido/
  embed/textoBoton/estiloBoton/botonWeb/secciones/etiquetas`, solo `canalId`/`fecha` son internos).
  **Editar** (`editarCreado` en `useDashboard`, `PUT /api/{anuncios,sorteos,eventos,encuestas}/:id`,
  `refrescarPublicado` repinta el mensaje de Discord), motivos de ticket y respuestas rápidas en su sitio,
  renombrar mensajes guardados. **Temas en «Mi cuenta»** (`lib/temaCuenta.js`, `data-cuenta` + paleta
  `--gx-*` por tema en `portal.css`; nada de `bg-white/…` en el portal: `bg-[rgb(var(--gx-tinta)/.06)]`).
  `MarkdownDiscord` entiende `-#`. Tests: `entradaPreguntas`, `presentaciones`, `reportes`, `tickets`.
- 1.9.13 **Verificación con aprobación del staff** (`preguntasEntrada.aprobacion` + `canalRevisionId`,
  `mensajeRechazo`/`mensajeAceptada`; modelo `SolicitudEntrada`): al terminar (con o sin preguntas) no se da
  nada: `solicitarAprobacion` manda al canal un aviso con lo respondido y `entv_ok/entv_no` (motivo en
  ventana `entv_nom`); `revisarSolicitud` la reserva de golpe (doble clic) y da roles + acceso con
  `concederEntrada`. Panel: `AprobacionEntrada.jsx` en Verificación (ajustes, vista previa y solicitudes
  pendientes con vista previa del aviso al staff y de los dos privados; `GET/POST
  /api/seguridad/:g/verificaciones…`, área `entrada`). El canal del staff tiene que ser del mismo
  servidor (`canalRevision`), dos clics no crean dos solicitudes, si el aviso no llega se reenvía al
  volver a intentarlo y una revisión cortada por un reinicio (`revisandoDesde`) se libera a los 2 min.
  Las respuestas pueden abrir un canal suelto (no solo categorías); al cerrar el servidor, ese canal
  deja de verlo el rol de acceso. **Panel de tickets** (`utils/panelTickets.js`, `panelTickets` en la
  config): `!sokyo` y el botón del panel (Tickets → Ajustes, `POST /api/config/:g/tickets/panel`) lo
  publican o actualizan igual. `guardarTextosConfig` y `guardarCambiosConfig` ya no sacan un `alert` en
  inglés: devuelven true/false y el botón `BotonGuardar.jsx` dice «✅ Guardado» o el error. Fecha de
  apertura/cierre en cada ticket (`TicketsView`). Tests: `aprobacionEntrada`, `entradaPreguntas`.
- 1.9.14 **Mensajes «Preséntate» y «Nueva sugerencia» personalizables** enteros (texto, embed con
  imágenes/GIF, botón con texto y color) y actualizados solos en Discord (ver *Mensajes con botón que el
  bot deja fijos*). Arreglado: Sugerencias en formulario publicaba el mensaje otra vez en cada guardado.
  Aviso «El bot escribe en inglés…» con botón para cambiarlo, y al cambiar el idioma los paneles ya
  publicados (presentaciones, sugerencias, tickets, Mi cuenta, verificación, doble bienvenida,
  solicitudes, voz temporal) se reescriben. Test en `test/panelesMensaje.test.js`.
- Ofrecido pero sin hacer: comando `/categoria crear` en Discord (hoy las
  categorías se crean desde el panel).
