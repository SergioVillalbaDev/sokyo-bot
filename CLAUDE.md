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
  --no-git-tag-version`. **Versión actual: 1.31.2.** El aviso lleva la lista de
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
  Toda ruta que GUARDA algo de una sección con `area` tiene que comprobarla: con `exigeArea`
  si el servidor viene en la petición, o con `sinArea(req, res, guildId, area)` si solo se
  sabe después de buscarlo (anuncios por id, emojis/stickers con el servidor por defecto). Los
  routers aparte lo reciben de `server.js` (`musica.js` recibe `tieneAreaAcceso`). Desde 1.9.17
  lo cumplen también Música, Anuncios programados y Emojis/stickers. Las plantillas
  (`/api/anuncios/presets`) NO llevan área: las comparten Bienvenida, Verificación, Mi cuenta,
  Mensajes y Anuncios, y con un área concreta se romperían en las demás secciones.
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
- **Verificación completa (1.9.15)**, `utils/puertaEntrada.js` + `opcionesEntrada` en la config (para la
  verificación normal y la doble bienvenida): requisitos (`requisitoQueFalla`: edad de la cuenta, foto, espera;
  se miran en CADA paso que da el acceso, también por privado en la doble bienvenida), normas («He leído y
  acepto», botón `verif_normas`), captcha (letras, intentos con `contarFalloCaptcha` → `castigarCaptcha`
  DESPUÉS de contestarle: esperar/aislar/expulsar), al verificarse (`trasVerificarse`: roles de más, quitar
  «Sin verificar», privado y registro; lo llaman `verificacion.conceder`, `embudo.conceder` y
  `concederEntrada`, y SOLO si el rol de acceso se ha dado de verdad), «Sin verificar» al entrar (`alEntrar`;
  nunca puede ser un rol de acceso: `rolSinVerificar`), expulsar a quien no se verifica (`barrerSinVerificar`
  cada 15 min desde `ready.js`: solo quien entró después de `expulsarDesde`, nunca staff, quien espera al
  staff ni quien tiene cualquier rol de acceso o se verificó según el registro; la lista entera de miembros
  se pide como mucho una vez por hora; el recordatorio sale en su ventana para que un reinicio no lo repita)
  y registro (`models/RegistroEntrada.js`, 90 días, y canal opcional). **Aprobación en tres modos**
  (`preguntasEntrada.aprobacionModo`: nunca/siempre/sospechosos, `requiereAprobacion` en
  `preguntasEntrada.js`; `aprobacion` queda a juego para lo de antes): sospechoso = cuenta de menos de
  `revisarCuentaDias`, sin foto (`revisarSinAvatar`) o respuesta con `revisar` (🕵️ en el panel); el aviso al
  staff dice por qué y menciona `rolAvisoId`. API: `PUT /api/seguridad/:g/opciones`, `GET
  …/verificaciones/registro` (con `esperando` = las que siguen esperando) y `POST …/verificar` (a mano; si
  esperaba al staff, acepta su solicitud). Panel: `OpcionesEntrada.jsx` (bloques plegables con resumen),
  `RegistroVerificaciones.jsx` y los modos en `AprobacionEntrada.jsx`. Tests: `test/verificacionOpciones.test.js`.
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
- 1.9.15 **Verificación muy completa**: la aprobación del staff pasa a ser una elección (nadie, todos o
  solo los sospechosos), requisitos, normas, captcha a medida, qué pasa al verificarse, expulsar a quien no
  se verifica, registro con cifras y verificar a mano (ver *Verificación completa*).
- 1.9.16 **Buscar grupo con ventana y mensaje** (`utils/grupos.js`): `/grupo` ya no tiene opciones; abre la
  ventana `grp_ventana:nuevo` (`ventanaGrupo`: juego, plazas, cuándo y «Mensaje: ¿qué vais a hacer?», caja grande
  de hasta 1000 letras con varias líneas → `descripcion`, la del embed). Antes de abrirla mira si ya tiene un
  grupo abierto (sin esperar más de 1,5 s: la ventana hay que abrirla en 3 s; se vuelve a mirar al publicar).
  **«✏️ Editar»** (`grp_editar:<id>`, quien lo creó o el staff) abre la misma ventana (`grp_ventana:<id>`) con lo
  que hay; `editarGrupo` nunca deja menos plazas que apuntados (de una vez, en la consulta), reabre si hay más
  plazas y, si quedan justas, se llena como al apuntarse el último (`marcarLleno`, también de una vez: solo uno
  crea la sala; `avisarLleno`). La sala cambia de nombre/plazas sin esperar (Discord retiene los renombres).
  **Borrador**: si algo falla (plazas que no valen, ya tiene un grupo abierto, no puede escribir en el canal), lo
  escrito se guarda en memoria 1 hora por persona y destino (`guardarBorrador`/`verBorrador`) y sale «Volver a la
  ventana» (`grp_reabrir:<destino>`); `/grupo` también lo recupera. Las respuestas personales van en el idioma de
  quien pulsa (`idiomaInteraccion`); lo público, en el del servidor. Panel: vista previa de la ventana
  (`VentanaDiscord` acepta `ayuda`, el texto gris de Discord) y el mensaje en «Últimos grupos». Test:
  `test/grupos.test.js`.
- Ofrecido pero sin hacer: comando `/categoria crear` en Discord (hoy las
  categorías se crean desde el panel).
- 1.10.0 **Crecimiento**. Cinco funciones nuevas, todas con tests en `test/crecimiento110.test.js`:
  - **Votos en top.gg** (`utils/votos.js`, `/votar`, panel Crecimiento → Votos, `crecimiento.votos`): top.gg llama a
    `POST /api/topgg/voto` (público; lo protege `TOPGG_WEBHOOK_AUTH` en Authorization, comparado en tiempo constante).
    Oro por voto (1.30.0: se da en cada servidor con la sección activa donde esté; `ORO_POR_VOTO`, 300; el doble en fin de semana) y, en cada servidor con la sección activa
    donde esté quien vota, rol temporal (`RolTemporal`), XP y gracias. Los reintentos de top.gg no premian dos veces
    (modelo `Voto`, 11 h). Con `TOPGG_TOKEN` se publica el número de servidores cada 30 min. **Para que funcione hay que
    poner en top.gg la URL del webhook y las dos variables en el `.env` de la Pi** (sin ellas el panel avisa).
  - **Red Sokyo** (`utils/redSokyo.js`, Crecimiento → Red Sokyo, `crecimiento.red`): cada `cadaHoras` publica otro
    servidor de la red en el canal. Solo sale en los demás quien publica (red activa con canal) y tiene la página
    pública listada; nunca servidores NSFW. Se elige el que menos ha salido (`mostrado`), sin repetir los últimos
    (`vistos`) y del mismo idioma si se pide (`elegirCandidato`, pura).
  - **Temporadas** (`utils/temporadas.js`, `/temporada`, Diversión → Temporadas, `temporadas`): XP de temporada en
    `ActividadUsuario.xpTemporada` (se suma en `niveles.aplicarXp`). Al cerrar (día 1 o lunes, UTC): podio, oro al
    top 3 y rol de campeón (se quita al anterior). El cierre se «reserva» cambiando `fin` antes de premiar.
  - **Referidos** (`utils/referidos.js`, `/referidos ver|canjear|destino`, modelo `Referido`): el servidor nuevo canjea
    el código en sus 14 primeros días (quien pueda «Gestionar servidor», nunca el propio código ni el del dueño). A los
    7 días, si el bot sigue y hay 10+ miembros, 7 días de Premium al servidor `destino` (sin tocar Stripe ni Premium
    de por vida: entonces 2000 de oro). Máximo 10 premios al mes por persona. Se resuelve cada hora.
  - **Eventos de Discord** (`utils/eventosDiscord.js`): `Evento.enDiscord` crea/edita/borra el evento nativo
    (voz/escenario con `canalVozId`, externo con `lugar` y `duracionMin`; el bot necesita «Gestionar eventos»; si
    Discord lo rechaza, el evento del bot se crea igual y la API devuelve `errorDiscord`). Premio por asistir
    (`premioOro`/`premioXp`) a los 15 min de empezar a quien esté en el canal, una vez. `GET /api/servidor/canales-voz?escenarios=1`.
  - Todo lo periódico va en su propio temporizador de 5 min (`tickCrecimiento` en `utils/scheduler.js`), aparte del principal.
- 1.11.0 **Setup rápido, más opciones y el panel bien en inglés**:
  - **Setup rápido** (`utils/setupRapido.js`; panel: tarjeta en el Inicio + `components/dashboard/SetupRapido.jsx`,
    `POST /api/config/:guildId/setup-rapido` con `exigeAdmin`; Discord: `/setup-rapido` = `slash/quicksetup.js`, las
    preguntas son las opciones del comando). Idioma, tipo de servidor (mismos tipos que el Asistente), módulos y canales
    (`auto` = el configurado, uno con el mismo nombre o uno nuevo; `nuevo`; o un id). Nunca pisa lo hecho a mano (automod
    ya activo → «omitido»), reutiliza canales, crea el registro privado con permisos explícitos, el automod solo borra,
    una pasada por servidor y minuto (`puedePasar`) y mira antes los permisos del bot. Los detalles del resultado van en el
    idioma del panel (`idiomaTextos`) y los errores con `codigo` (el panel los traduce). El historial lo apunta todo.
  - **Seguridad**: `errorRolPeligroso` (`utils/permisos.js`): los roles que el bot reparte solo a cualquiera (votar,
    campeón) no pueden tener permisos de staff (al guardar y también al repartir). `rolesQueDaElBot` incluye ya
    `crecimiento.votos.rolId` y `temporadas.rolCampeonId`.
  - **Votos**: `oroExtra` y `mencionar` por servidor; `/votar recordar:sí|no` (modelo `RecordatorioVoto`, aviso por
    privado a las 12 h, `avisarRecordatorios` en `tickCrecimiento`). El mensaje de gracias está en `textosPorDefecto`.
  - **Red Sokyo**: `bloqueados` (en los dos sentidos), `minMiembros` y `etiquetas`; el panel enseña los últimos
    publicados con «Bloquear».
  - **Temporadas**: `excluirRoles` (no compiten ni cobran; tampoco quien se fue), `mencionar`, `anunciarInicio`.
  - **Idioma del panel**: (1) la API traduce el `error` de sus respuestas si `X-Sokyo-Lang: en` (`utils/erroresApi.js`;
    `test/erroresApi.test.js` falla si un `error: '…'` fijo no tiene traducción: añádela ahí); (2) al cambiar de idioma
    se vuelve a pedir lo de la sección abierta (`useDashboard`, `useModulo`, vistas de Crecimiento, Diagnóstico,
    Novedades, Mensajes fijos); (3) textos de ejemplo que se enseñan sin guardarse (Presentaciones: `preguntasPropias`
    = `null` mientras sean las de ejemplo, así el autoguardado no las guarda al cambiar de idioma). Al añadir una vista
    que pide datos con textos de la API o con errores, ponle el idioma en las dependencias de la carga.
- 1.12.0 **Quién puede entrar al panel** (Configuración → Acceso al panel, arriba; `views/QuienAccede.jsx`):
  galería con foto (aro del color del rol más alto), apodo, @usuario, rol, corona (dueño del servidor o propietario
  del bot), mazo (puede moderar) y un icono por área (color/icono de su grupo del menú; apagado = no llega). Filtro
  por área con recuento, buscador y ficha al pulsar con el menú entero (✓/✗ por sección, el grupo Propietario solo
  para propietarios del bot). `GET /api/config/:guildId/acceso/miembros` (`exigeArea('config')`: es la lista del
  staff) devuelve los candidatos (`utils/accesoPanel.js`: `datosMiembro`, `esCandidato`) con sus roles y permisos;
  la lista completa de miembros se pide a Discord como mucho cada 2 min por servidor (`parcial` si no llegó toda).
  Las reglas (`calcularAcceso`) están DOS veces: `utils/accesoPanel.js` y `src/lib/accesoPanel.js` (el panel
  recalcula al momento con los roles sin guardar). Si cambian las reglas de acceso de la API (guildsDelStaff,
  tieneAreaAcceso, puedeModerar), cámbialas en los dos. Test en `test/accesoPanel.test.js`.
- 1.13.0 **Staff avanzado**:
  - **Acceso por persona** (`models/AccesoPersona.js`, `views/AccesosPersona.jsx`, `GET/PUT/DELETE
    /api/config/:guildId/acceso/personas[/:userId]`; ver: área config; dar/quitar: `exigeAdmin`): áreas, moderar y
    `expiraEn` (null = sin fecha). Lo aplican `guildsDelStaff`, `tieneAreaAcceso`, `/api/mis-permisos`, `puedeModerar`
    y `puedeSancionar` (`concesionDe` en api/server.js) y `calcularAcceso(m, cfg, concesion)` (las dos copias).
    `barrerConcesiones` (tickCrecimiento) borra los caducados y lo apunta.
  - **Alertas de seguridad** (`alertaSeguridad` en utils/accesoPanel.js → Log categoría «Seguridad» + canal de registro):
    acceso dado/quitado/caducado, cambios de roles que entran o moderan, y quien gana o pierde el acceso por sus roles
    (`events/guildMemberUpdate.js`, `avisarCambioDeAcceso`).
  - **Ver el panel como…** (solo visual): `verComo` en useDashboard sustituye `misPermisos`; aviso fijo en Dashboard.jsx.
    La API sigue usando los permisos reales.
  - **Actividad del staff** (`utils/actividadStaff.js`, `views/StaffActividadView.jsx`, tab `datos-staff`, área datos):
    atendidos (`asignadoA`), mensajes y primera respuesta (Mensaje de alguien que no abrió el ticket), valoración y
    sanciones (`moderadorId`). Las respuestas desde el panel guardan ya el id de quien responde (antes `sokyo-web`).
  - **Confirmación doble** (`utils/confirmacionPanel.js`, `ConfirmacionAccion.jsx`, `registrarConfirmacion` en
    lib/api.js): borrar rol, canal o categoría y sanción masiva responden 428 hasta mandar `X-Sokyo-Confirmacion` con el
    código del privado (o el nombre del servidor si no hay privados). 10 min, 5 intentos, un solo uso; la API key no lo
    pide. Para proteger otra ruta: `exigeConfirmacion('<accion>')` (+ texto en `ACCIONES` y en `dashboard.confirmar`).
- 1.14.0 **Para qué sirve el oro** (tests en `test/oroSocial.test.js`):
  - **Mascota del servidor** (`utils/mascota.js`; reglas puras en `utils/mascotaNucleo.js`; imagen en
    `utils/tarjetaMascota.js` con los dibujos de Twemoji de `assets/mascota` (también en `public/mascota` para el panel);
    modelos `Mascota` y `CuidadoMascota`; `/mascota` = `slash/pet.js`; panel Diversión → Mascota, `MascotaView.jsx`;
    API `/api/config/:g/modulos/mascota[/eclosionar|/reiniciar]`). Huevo con votación de especie y nombre (24 h, botones
    `mas_*`), barras de comida/alegría/salud que cambian cada hora (`pasarTiempo`: mensajes y voz la alegran, automod y
    sanciones le bajan la salud vía `registrarIncidente`), hiberna sin comida ni alegría (pierde un nivel al día), forma
    de adulta al nivel 15 según el servidor, ventajas por nivel (`bonusXpServidor` lo lee `niveles.aplicarXp`;
    `descuentoBromasServidor` las bromas; solo con la mascota activa), buenos días, saludo a quien entra, susto en un
    raid, «Cuidador del mes» con rol. Pasada en `tickCrecimiento` (`barrerMascotas`).
  - **Bromas de oro** (`utils/bromas.js`, modelos `Broma` y `PerfilBroma`, `/broma` = `slash/prank.js`, panel Diversión →
    Bromas, `BromasView.jsx`): apodo, payaso (rol elegido, nunca con permisos de staff), reacción y loro (los dos últimos
    en `messageCreate` → `alMensaje`). Una broma a la vez por persona, espera entre bromas, escudo, «Devolvérsela» una vez
    pagando el doble (botones `brm_*`), roles intocables y `/broma salir`. Al acabar (`barrerBromas`, cada 30 s) vuelve el
    apodo de antes y se quita el rol. Si Discord falla, se devuelve el oro.
  - **Liga Sokyo** (`utils/liga.js`, modelos `LigaServidor`, `LigaMes`, `ImpulsoLiga`, `CombateMascota`; `/liga` =
    `slash/league.js`; panel Crecimiento → Liga Sokyo, `CrecLigaView.jsx`; API `/api/config/:g/crecimiento/liga`).
    Puntos por votos (`alVotar` desde `votos.procesarVoto`), impulsos con oro (tope diario por persona) y combates diarios
    de mascotas (17:00 UTC se emparejan y se anuncian con «Animar», 19:00 UTC se resuelven, `liga_animar:*`). El día 1 se
    cierra el mes una sola vez (`LigaMes`) y el podio queda destacado un mes: primero en `/servidores` y más a menudo en la
    Red Sokyo (`elegirCandidato`, `destacado`).
  - `economia.cobrar(id, n)`: cobro atómico (null si no llega).
- 1.15.0 **Mascota mucho más completa** (tests en `test/mascotaPlus.test.js`):
  - Reglas puras nuevas en `utils/mascotaExtras.js`: personalidad (al nacer; cambia hambre, aburrimiento, energía,
    XP, caricias, juego, toxicidad y combate), atributos fuerza/defensa/agilidad + energía (`entrenar`), tienda
    (`COMIDAS`, `ACCESORIOS` con su sitio `slot` y `POSICIONES` por especie, `HABITATS` con fondo y decoración), logros,
    textos del diario (`textoRecuerdo`), frases (`frase`) y sorpresas (`tocaEvento`, `eventoAlAzar`). **Los mismos datos
    están en `sokyo-panelFRONTEND/src/lib/mascota.js`** (un test comprueba que coinciden).
  - Discord en `utils/mascotaVida.js`: `entrenar`, `comprar` (con el oro de quien compra; comida al momento, accesorio y
    hábitat para siempre y puestos), `vestir`, `hablar`, diario (`recordar`, últimos 60) y logros (`comprobarLogros`; el de
    «Leyenda» regala la corona), sorpresas (`pasadaEventos`, botones `mas_ev:*`; el menú de la tienda es `mas_comprar`).
    `/mascota entrenar · tienda · vestir (staff) · hablar · diario`.
  - Combates (`N.combatir`): críticos y esquivas por agilidad, defensa (hasta −25 %) y habilidad especial de cada
    especie una vez por combate cuando va perdiendo (`ESPECIALES`). Las rondas guardan `eventoA/eventoB` y el relato de la
    Liga los cuenta. Pelear gasta energía.
  - Imagen (`utils/tarjetaMascota.js`, 960×400): hábitat, accesorio, personalidad, logros, 4 barras y atributos.
  - Panel: Diversión → Mascota con pestañas Estado, Aspecto (probar y comprar con tu oro: `POST …/mascota/comprar`,
    `PUT …/mascota/vestir`), Combate, Diario y Ajustes (sorpresas: `mascota.eventos`, `eventosPorDia`).
- 1.16.0 **Casino de oro y cofres de mascotas** (tests en `test/casino.test.js`, incluido lo que devuelve cada juego):
  - El oro es virtual: no se compra con dinero ni se cambia por dinero (comprobado: Stripe solo vende planes).
  - Reglas puras: `utils/casinoNucleo.js` (tragaperras ~95 %, ruleta europea 97,3 %, blackjack 6 mazos, crash 97 %, minas
    97 %, moneda ×1,94, duelo −3 %, carrera 94 %; `comprobarApuesta` con mínimo, máximo, tope diario y pausa) y
    `utils/cofresNucleo.js` (6 rarezas, 22 compañeros, 3 cofres con probabilidades, piedad cada 10, estrellas hasta 5,
    `ventajas`). La divina («celestial») sale con un 0,01-0,2 %. El azar es `crypto`.
  - Animaciones en `utils/casinoArte.js` (GIF que no se repiten: tragaperras, ruleta, moneda y cofre; PNG de la mesa de
    blackjack y de la colección). Dibujos de Twemoji en `assets/mascota` (y `public/mascota`).
  - Discord: `utils/casino.js` (`/casino`: apostar → `cobrarJugada`, botones `cas_*`; blackjack, crash en directo con
    ediciones cada 1,5 s, minas con cuadrícula de botones, duelos con aceptar, carrera de 45 s con ventana para la cantidad,
    bote por servidor `CasinoBote`) y `utils/cofres.js` (`/cofre`, botones `cof_*`, `ventajasUsuario` en caché 60 s: la leen
    `niveles.aplicarXp`, `economia.reclamarDaily` y el casino). Al arrancar, `devolverPendientes` devuelve lo apostado en
    jugadas `en_curso` (las partidas viven en memoria).
  - Modelos: `PerfilCasino`, `JugadaCasino` (90 días), `CasinoBote`, `ColeccionMascotas` (por servidor y persona desde 1.30.0), `AperturaCofre`.
  - Panel: Diversión → Casino y cofres (`CasinoView.jsx`, `src/lib/casino.js` con los mismos datos; un test lo comprueba),
    `GET/PUT /api/config/:g/modulos/casino`. Config en `ServidorConfig.casino` (apagado por defecto).
- 1.16.1 Guía del casino: `/casino ayuda` (`utils/casinoAyuda.js`: pasos, comandos con ejemplo, menú `cas_guia` con cada
  juego y botón «Probar» que reutiliza `cas_rep`), tarjeta «Cómo se juega» en el panel y `POST …/modulos/casino/guia`
  para publicar la guía en el canal del casino.
- 1.17.0 **Configurar en 1 minuto**:
  - `utils/setupRapido.js`: 16 módulos (antes 8: + sugerencias, salón, contadores, mascota, casino, bromas, liga, clanes),
    con sus canales (`CANALES`/`NOMBRES`) y lo que toca hacer (huevo de la mascota, guía del casino, contador de voz).
    `uno: true` = activar una sola cosa sin tocar idioma ni staff (freno de 3 s por cosa, `puedePasar(g, ahora, modulo)`).
    Tests en `test/setupRapido.test.js`.
  - Panel: el setup rápido (`SetupRapido.jsx`) tiene «⚡ Dejarlo listo ahora» en el paso 1 (lo recomendado del tipo, canales
    automáticos), módulos por grupos y progreso animado; la lista del Inicio (`AsistenteInicio.jsx`) tiene «⚡ Activar» en lo
    que el setup sabe hacer (`ACTIVABLE`) y «Activar todo lo que falta». `estadoModulos` (useDashboard) incluye las secciones
    nuevas. Si cambian los módulos del setup, actualiza `TIPOS`/`PACKS`/`CANALES` en `InstalacionGuiada.jsx` y `ACTIVABLE`.
  - `/setup-rapido` tiene la opción `diversion` (mascota, casino, bromas, liga y clanes). El mensaje al entrar en un servidor
    (`utils/onboarding.js`) lleva al setup en 1 minuto.
- 1.31.2 Ediciones del crash y de la carrera **en fila** (`editarEnFila` en `utils/casino.js`, test en
  `visual131.test.js`): una edición no sale hasta que Discord ha aplicado la anterior, y la vista se calcula al salir
  (null = ya no toca). Antes, una edición del vuelo lenta llegaba DESPUÉS del resultado y el mensaje volvía a enseñar
  el cohete con «Retirarme» (al pulsarlo, ⌛). Toda edición nueva de un mensaje en directo debe pasar por esa fila.
- 1.31.1 **GIF que no «se notan» y sin saltos** (tests en `test/visual131.test.js`):
  - `casinoArte.aGif` (async: devuelve una promesa; cede el turno cada pocos fotogramas para no bloquear el bot en
    la Pi): UNA paleta para toda la animación (muestra de hasta 10 fotogramas), tramado Bayer 4×4 suave (sin bandas;
    `tramado: 0` lo quita) y cada fotograma guarda solo lo que cambia (transparente + `dispose: 1`). `repetir: true` =
    en bucle (cartel del lobby, cohete); por defecto se ve una vez. Más fotogramas (~25/s) en tragaperras, ruleta,
    moneda y dado.
  - **Una jugada = un mensaje que no se edita**: tragaperras, ruleta, moneda, duelo, cofre y sobre cobran ANTES y el
    GIF ya trae el final (pastilla + tu oro, `resultado.saldo`). Antes se editaba al acabar y la imagen saltaba o
    volvía a empezar. Los premios gordos se anuncian con `anunciarDespues` (cuando acaba la animación). Lo que hay que
    contar aparte (hitos, pase, logros) va en un `followUp` tras la animación, solo si lo hay. El resultado también va
    escrito como spoiler (`oculto`, ‖…‖) para quien tiene los GIF en pausa.
  - **Blackjack**: `gifBlackjack` (destapa, roba carta a carta y resultado) en una sola edición; `pintarMesa` pinta la
    mesa para el PNG y el GIF. **Crash**: `gifCohete` (en bucle, en caché) mientras vuela y el número en grande en la
    descripción (`# 🚀 ×1,84`), que se edita cada segundo sin tocar la imagen; al acabar, la gráfica una vez.
    **Carrera**: durante las apuestas no se resube la pista (`vistaCarrera({ imagen: false })`, solo si
    `car.conImagen`); al salir, `gifCarrera` (cuenta atrás, tramos interpolados con galope y cartel de premios) en una
    edición. `car.corriendo`: una apuesta que se cobra cuando ya ha salido se devuelve. En `pasosCarrera` nadie retrocede.
- 1.31.0 **Mascotas, casino y niveles en imagen, con muy poco texto** (tests en `test/visual131.test.js`):
  - Casino (`utils/casinoArte.js`): `pastillaResultado`/`textoResultado` pintan +🪙/−🪙 (↩ si recuperas algo, 💨 en la tirada
    gratis sin premio) en el último fotograma de tragaperras, ruleta y moneda (`resultado`/`res`) y en la mesa de blackjack.
    Nuevos `graficaCrash` (la gráfica del final del crash), `pistaCarrera` (la pista mientras se apuesta) y
    `gifDado` (ver 1.31.1). En `utils/casino.js` los embeds solo llevan título (juego · apuesta) y pie corto (`pieSaldo`: oro · /casino
    pausa); el texto largo de antes solo sale si no se pudo dibujar. Toda edición que cambia la imagen lleva `files` +
    `attachments: []`.
  - `utils/arteVistas.js`: `tarjetaGranja`, `tarjetaPase`, `tarjetaLogros`, `tarjetaDiario` y `tarjetaRanking`. Reciben datos
    ya calculados (sin BD) y, si algo falla al pintar, devuelven null (envueltas en `seguro`) y la vista vuelve al texto.
    Granja/álbum/pase/logros (`granja.js`, `pase.js`) y `/diario`, `!ranking`, `!dado`, `!moneda` las usan. Las
    explicaciones largas («Cómo producir más», «Cómo se gana XP») pasan a los botones ❔ `grj:info` y `pse:info` (privado).
  - `/compi` (`compisArte.js`): franja de abajo (`datos.extra`: misiones, racha, expediciones, recuerdos, poder); con imagen,
    el embed solo deja los mensajes, la habilidad y «Te da en este servidor» (pie: cuándo estará listo el poder).
  - Probado con MongoDB real (Docker `mongo:7` con replica set) y un script de interacciones simuladas que recorre las 22
    vistas (vivía en el scratchpad).
- 1.30.0 **Todo por servidor**: en cada servidor todos empiezan de 0 y compiten con los de allí. **Oro**: `models/Monedero.js`
  (`guildId + discordId`: balance, mochila, diario, boost de XP). `utils/economia.js` ya NO exporta `darOro`/`cobrar`/…: se usa
  SIEMPRE `economia.en(guildId).darOro(userId, n)` (lanza error sin servidor; así no se puede dar oro «en ningún sitio»). El
  viejo `models/Usuario.js` (oro global) se queda sin usar y sin borrar. **Colección** (`ColeccionMascotas`: mascotas, cartas,
  granja, pase, logros, tickets, misiones) con `guildId`; índice único `guildId + userId`. `utils/migrarPorServidor.js` (en
  `ready`) quita el índice viejo `userId_1`; los documentos viejos sin `guildId` se quedan guardados sin usarse. Convención:
  todas las funciones de colección reciben `(guildId, userId, …)`: `compis.accion`, `cofres.ventajasUsuario/equipar/olvidar`,
  `granja.premiarHitos/recoger/vistaGranja/vistaAlbum`, `pase.registrar/revisarLogros/usarTicket/devolverTicket/vistaPase/
  vistaLogros`, `cartas.verCarta`, `empezar.vistaInicio`. Comandos de economía solo en servidores (`setContexts(Guild)`).
  Votos: el oro del voto (+ extra) se da en cada servidor con premios por votar donde esté. Referidos: en el servidor
  recomendado. **Web personal**: oro, diario y tienda del servidor elegido (`utils/servidorPortal.js`: `?guildId=`/body,
  comprobando que es miembro; `servidoresOro` en `/portal/resumen`; selector `components/portal/SelectorServidorOro.jsx`,
  recordado en `localStorage.sokyoPortalServidor`). La Liga sigue entre servidores (su tope diario es por persona).
  Comprar en la tienda usa transacción (necesita replica set, como antes).
  **Nombres de comandos**: `/pet`, `/prank` y `/league` no tenían nombre en español, así que en Discord en español
  «/mascota», «/broma» y «/liga» (lo que dicen la ayuda y los textos) no existían. Ya lo tienen; `test/nombresComandos.test.js`
  comprueba que cada comando que enseña `/ayuda` existe con ese nombre en español.
- 1.29.0 **Pase de temporada, logros, tickets gratis y /empezar**. Reglas puras en `utils/paseNucleo.js` (test/pase.test.js):
  pase mensual (UTC) de 50 niveles de 100 XP; `XP` por acción; el casino da `XP.casino` por partida con
  `TOPE_CASINO_DIA` y sin mirar la apuesta (no premiar apostar más). `premio(n)`: oro siempre, sobre normal cada 5,
  cofre épico cada 10, extras en 15/25/35/40 y el 50 (legendarios + título); por encima de 50, `ORO_EXTRA`. `LOGROS`
  (24, una vez, con oro). Discord en `utils/pase.js`: `registrar(userId, acciones)` suma XP con versión optimista
  (`paseV`), paga niveles (oro + `tickets.<clave>`) y revisa logros; devuelve mensajes para enseñar. Se llama desde
  `compis.accion` (cuidar/expedición/carta + misiones), `granja.recoger` y `premiarHitos`, `cofres.abrir`,
  `cartas.abrir` (sobre + series) y `casino.cobrarJugada`. Tickets: `cofres.abrir`/`cartas.abrir` aceptan
  `ticket` (gasta el ticket en vez de oro; si falla, lo devuelve). `/pase` (`slash/pass.js`, botones
  `pse:ver|log|abrir|info|tk:<clave>:<owner>`). **`/empezar`** (`slash/start.js`, `utils/empezar.js`, botones `emp:…`): guía
  para quien no tiene ni idea, con `siguientePaso()` (pura: diario → primer cofre → tickets → granja → cuidar →
  misiones → primer sobre → expedición → pase) y temas explicados en sencillo. Está en `/ayuda`, en el lobby del
  casino («¿Nuevo? Empieza aquí») y en los avisos de «aún no tienes mascotas». Copia de números para el panel en
  `lib/casino.js` (`PASE`, comprobado en test/casino.test.js). Si cambias lo que dice la guía, que sea verdad en el bot.
- 1.28.0 **Granja, álbum y misiones semanales** (1.30.0: por servidor, como el oro). Reglas puras en `utils/granjaNucleo.js`
  (test/granja.test.js); Discord en `utils/granja.js` (botones `grj:ver|rec|alb|abrir|info:<owner>`; sin dueño o de otra persona
  → se abre la suya en privado) y `/granja` (`slash/farm.js`). Granja: las mejores mascotas (huecos = 3 + hitos con hueco)
  producen `PRODUCCION[rareza]` oro/h × (1 + 0,15·(★−1)) × (1 + 0,02·nivel) × cuidado (0,5–1,2 según barriga y alegría);
  de expedición, 0. Se guarda hasta `TOPE_H` = 12 h; la primera vez solo arranca (`granja.desde`), sin oro retroactivo.
  `recoger` cobra con filtro por `granja.desde` (dos clics a la vez → uno cobra). Álbum: hitos por mascotas DISTINTAS del
  catálogo (`COMPANEROS`, las de servidor no cuentan), premiados una vez (`hitosAlbum`, `$ne` + `$addToSet`); se dan al
  sacar una nueva en un cofre (`cofres.abrir`) o al abrir granja/álbum. Misiones semanales (`semana`, semana ISO UTC):
  cuidar 40, expediciones 8, recoger granja 6, usar cartas 6 → 400 cada una + 1000 todas; se suman en `compis.accion`
  (`semAcc`) y en `recoger`. El panel tiene una copia de los números en `lib/casino.js` (`GRANJA`, comprobada en
  test/casino.test.js). En el panel, Mascotas queda en bloques plegables (cómo funciona, granja, mascotas del servidor,
  galería del pack anime…). Nada de oro de pago ni trucos de apuesta: la granja premia volver, no apostar.
- 1.27.0 **Lo básico arriba, lo demás plegado**. `components/dashboard/Plegable.jsx` (`<Plegable id emoji titulo sub abierto>`):
  bloque que empieza recogido y recuerda si lo abriste (`localStorage.sokyoPlegable:<id>`). Los hijos van SIEMPRE montados
  (`[data-plegable-cuerpo][hidden]`) para que el buscador (Ctrl + K, `indiceAjustes.resaltarTexto`) encuentre lo que hay dentro:
  si el texto está en un bloque plegado, lo abre y vuelve a buscar. Aplicado en Inicio (estado del bot, mapa, equipo), Mascotas
  (ventajas, catálogo, cuidadores), Casino (estadísticas, cofres), Ajustes de tickets (todo desde «Ayuda antes del ticket»),
  Verificación (preguntas, aprobación, requisitos, cierre, registro), Automod (exenciones, entradas, filtros de mensajes), Voz
  temporal (botones y vista previa), Acceso (áreas) y Bienvenidas (embed; abierto si ya hay uno). Textos `dashboard.plegable.*`.
  Si una pantalla crece mucho, mete lo secundario en un `Plegable` en vez de quitarlo. Los tours por sección se saltan solos los
  pasos que quedan dentro de un bloque cerrado.
- 1.26.0 **Panel menos abrumador**. Menú en **modo sencillo** por defecto (`navConfig.BASICOS`, `gruposVisibles(…, { sencillo,
  extra })`; el interruptor «Ver todas las secciones» se guarda en `localStorage.sokyoMenuSencillo`; la sección abierta y las
  favoritas se ven siempre). **Centro de funciones** (tab `funciones`, `views/FuncionesView.jsx`, textos `dashboard.funciones.*`):
  todas las secciones como tarjetas con estado (`estadoModulos`), «Activar» (`lib/activar.js`) y «Abrir», filtros y buscador.
  Al añadir una sección nueva, piensa si va en `BASICOS`. **Canales en categorías**: `setupRapido.categoriaDe` crea/usa las
  categorías de `CATEGORIAS` (la de staff, privada) y `canalDe` mete ahí los canales nuevos; `organizarCanales(guild, cfg)` mueve
  los canales del bot que estén sueltos (nunca los ya colocados). API: `POST /modulos/organizar-canales` (botón en el Centro de
  funciones) y `POST /api/soporte/:guildId/organizar`.
- 1.25.0 **Casino**: juegos `hilo` (Mayor o menor: `C.pagoHilo`/`resultadoHilo`, 3 % para la casa por paso, tope ×100 o 12
  aciertos; botones `cas_hl:<id>:mayor|menor|cobrar`, mesa PNG `casinoArte.mesaHilo`) y `rasca` (Rasca y gana: `C.boletoRasca`
  con `RASCA_PREMIOS`, RTP 95,5 %; botones `cas_ras:<id>:<i>|todo`). Están en `JUEGOS`, `cfg.casino.juegos`, `/casino mayormenor`
  y `/casino rasca`, el lobby y la guía. **Cartas**: colecciones (`cartasNucleo.series()` = series con 2+ cartas; completar una
  da `PREMIO_SERIE`×cartas una vez y `SINERGIA` +25 % a sus cartas: `col.seriesCompletas`), `/carta regalar` (una copia, 5 al día,
  `col.regalosHoy`) y `/carta mostrar`. **Soporte**: `POST /api/soporte/:guildId/setup` (setup completo, todos los módulos por
  defecto), `POST /api/soporte/:guildId/rol` (sin permisos peligrosos) y `POST /api/soporte/:guildId/casino/lobby`.
- 1.24.0 **Mascotas y cartas**. Las MASCOTAS son el catálogo de `cofresNucleo.COMPANEROS` (+ las propias del servidor) y
  salen en los cofres; cada una tiene su habilidad exclusiva (`HABILIDADES`, `K.habilidad(id)`: tipos xp/diario/vuelta/bromas/
  liga/expedicion suman en `K.ventajas`; gloton/alegre/incansable en `compisNucleo.estado`; rapido en `salir`; tesoro en `botin`;
  afin en `conAfinidad`; cartas/recarga/divino en las cartas). Los personajes del Pack anime YA NO son mascotas: son CARTAS
  (`utils/cartasNucleo.js`: `SOBRES` de 3 cartas con garantía y piedad, `abrirSobre` (si toca una serie quitada da oro, nunca
  otra carta), `usarCarta` (recarga de 20 h por carta, 3 al día + habilidad)). Efecto de cada carta: `compisNucleo.efectoCarta`
  (tipo de `data/animePoderes.txt` → `ARQUETIPOS`, con `potencia` = +% a las ventajas de esa mascota (`col.potencia`, lo suma
  `cofres.ventajasUsuario`) y `botin` = ×oro en su próxima expedición (`mascota.botinX`)) y `aplicarEfecto`. En Discord:
  `/carta` (`slash/card.js`: abrir, album, ver, usar, probabilidades), `utils/cartas.js` (botones `crt_*`), `utils/cartasArte.js`
  (carta, GIF del sobre, álbum) y en `/compi` el botón `cmp:cartas` → selector efímero `cmp_crt:<dueño>:<msgId>:<mascota>` que
  edita la tarjeta original. `ColeccionMascotas.cartas/sobresAbiertos/sinEpicaCartas/cartasHoy/potencia`. `utils/migrarCartas.js`
  (al arrancar) pasa los «a:…» que hubiera en `mascotas` a `cartas`. Las cartas solo están con `cfg.compis.anime`.
- 1.23.0 **Lobby del casino** (`utils/casinoLobby.js`): mensaje fijo (cartel GIF `casinoArte.bannerCasino`, bote, premios gordos,
  ranking) con el desplegable `cas_lob` → «mesa» efímera de cada juego (`mesa()`: opciones `cas_lx:<juego>:extra|cantidad`, fichas
  que son `cas_rep:<juego>:<cantidad>[:extra]`, «Otra cantidad» `cas_lm`, duelo con `cas_ldu:<cantidad>`), botones `cas_lb:*`
  (diaria, mio, ranking, guia, carrera, coleccion) y pausa `cas_lp:<días>`. `casino.manejar` le pasa lo que no es suyo.
  `casino.jugarRepetir` juega en un mensaje nuevo (errores solo para quien juega). Se publica con `POST /modulos/casino/lobby`
  (botón en el panel) y al activar el casino con el setup; `cfg.casino.lobby` (interno) dice dónde está; el programador lo
  refresca cada 5 min (`refrescar`, rehace el GIF solo si cambia el bote). `/casino menu` lo abre en efímero.
- 1.23.0 **Acceso de soporte** (lo usa Claude; en 1.24.0 se renombró para que el panel no diga «Claude» en ningún sitio:
  `utils/accesoSoporte.js`, `models/AccesoSoporte.js`, `api/routes/soporte.js`): un propietario crea una clave en Panel →
  Propietario → Acceso de soporte (`OwnerSoporteView.jsx`; se guarda solo su sha256, `sk_soporte_…`).
  Con ella la API solo deja entrar a `/api/soporte/…` (modo `lectura` = solo GET; `completo` = también PATCH y deshacer):
  `GET /soporte/servidores`, `GET /soporte/:guildId` (config aplanada, canales, roles, diagnóstico), `GET /soporte/:guildId/cambios`,
  `PATCH /soporte/:guildId {set, unset}` (solo rutas del esquema y no internas ni de cobros: `rutaValida`) y
  `POST /soporte/:guildId/deshacer/:id`. Los cambios salen en el historial como «Equipo de Sokyo». Para usarla, Claude pide la
  clave con request_credential (host dashboard.sokyo.studio, cabecera Authorization: Bearer). En el panel NO debe aparecer
  «Claude» en ningún texto, ruta ni nombre visible.
- 1.22.0 **Pack anime**: `data/animePack.json` (643 personajes de AniList: `id`, `n` nombre, `s` serie, `r` rareza por
  popularidad, `v` voz, `i` archivo de la foto en `s4.anilist.co/.../character/large/`). Se regenera con un script que pide a
  la API GraphQL de AniList los personajes por `FAVOURITES_DESC` (no está en el repo; las fotos no se guardan en git).
  En `utils/cofresNucleo.js`: `ANIME` (id `a:<idAniList>`), `K.def` lo incluye, `idsAnime(fuera)`, `esAnime`, `esExtra`
  (servidor o anime). Kurumi Tokisaki (`KURUMI`) es la única divina del pack (con `frases` [es, en] y `titulo`). Solo sale en
  los cofres de los servidores con `cfg.compis.anime` y sin sus `cfg.compis.animeFuera` (`cofres.extrasDe`). Las fotos se
  bajan al usarse a `cache/anime` (`casinoArte.imagenAnime`, solo de s4.anilist.co). API `GET/PUT /modulos/compis/anime`
  (antes que `compis/:cid`). Panel: tarjeta «Pack anime» en `CompisView.jsx` (`dashboard.compis_v.anime.*`). Va gratis
  para todos (las condiciones de la API de AniList son para uso no comercial): no lo pongas detrás de Premium.
  **Poder de cada personaje**: `data/animePoderes.txt` (`idAniList|tipo|nombre es|nombre en|# nombre`), lo lee
  `cofresNucleo` (`PODERES_ANIME`, `def(id).poder`). `compisNucleo.ARQUETIPOS` dice qué hace cada tipo (oro, XP con
  duración, escudo, volver de expedición, llenar, energía, alegría, afinidad, recuerdo; `caos` = uno al azar) y `FUERZA`
  lo escala por rareza (`efectoAnime`, `textoEfecto`); la divina suma la Bendición. Si se regenera el pack, añade aquí
  los nuevos (el test exige que no falte ninguno).
  **Series quitadas sin trampa (1.22.1)**: `cofres.extrasDe` pasa SIEMPRE el pack entero y `cofres.quitadosDe` las quitadas;
  `K.companeroAlAzar(rareza, azar, extra, quitados)` tira sobre todo y, si toca uno quitado, da uno del catálogo de esa
  rareza. Así quitar series no sube la probabilidad de ningún personaje (lo comprueba test/compis.test.js).
- 1.21.0 **Más compañeros por rareza**: `RAREZAS` tiene también `bromas` (descuento, tope 60 %), `liga` (puntos extra al
  impulsar) y `expedicion` (más oro); `K.ventajas` los devuelve y se aplican en `bromas.gastar` (no en devoluciones),
  `liga.impulsar` y `compisNucleo.botin`. `compisNucleo`: `INTERACCIONES` (se desbloquean por `rareza` = orden mínimo, con
  `espera` en minutos guardada en `mascotas.cds`; frases en `compisFrases.EXTRA`) y `PODERES` (uno por rareza, uno al día por
  persona: `poderUsado`; Inspiración/Bendición guardan `buff` que suma XP en `cofres.ventajasUsuario`; Escudo usa
  `PerfilBroma.escudoHasta`). En `/compi`: botón `cmp:poder`, menú `cmp_int`, campos «Te da en este servidor» (`ventajasAqui`,
  según los módulos activos) y «Sabe hacer». Compañeros propios: hasta 100 (`MAX_COMPIS`) y subida masiva en el panel.
  Al tocar rarezas/interacciones/poderes, actualiza `src/lib/casino.js` (lo comprueba test/casino.test.js).
- 1.20.0 **Compañeros tipo tamagotchi** (`/compi` = `slash/companion.js`). Catálogo ampliado a 57 en `utils/cofresNucleo.js`
  (`tipo: 'personaje'` = personajes originales de estilo anime con Twemoji; `voz` = su forma de hablar). Reglas puras en
  `utils/compisNucleo.js` (hambre/alegría/energía que cambian por hora, `cuidar`, afinidad → `nivel` 1-30, `extraCuidado` que
  suma a `K.ventajas(id, estrellas, extra)`, `EXPEDICIONES` con tope `EXPEDICIONES_DIA`, `RECUERDOS`, `misionesDelDia`, racha con
  `PREMIOS_RACHA`; sin castigos). Frases en `utils/compisFrases.js` (`GENERAL` por humor/acción, `VOCES` por personaje; [es, en],
  `{d}` = dueño). `utils/compis.js`: `accion()` (en cola por usuario; recoge la expedición al volver), `vista()` (tarjeta de
  `utils/compisArte.js`: PNG o GIF con efecto) y `manejar()` (`cmp:<acción>:<dueño>:<id>`, `cmp_exp`, `cmp_sel`, `cmp_apodo`).
  Estado en el subdocumento de `ColeccionMascotas.mascotas` (+ `racha`, `misiones`, `expHoy` en la colección).
  **Compañeros del servidor**: `models/CompaneroServidor.js`, id `s:<guildId>:<cid>`, registrados en memoria con
  `K.registrarPersonalizado` (al arrancar: `compis.cargarPersonalizados`); usa siempre `K.def(id)` (nunca `K.COMPANEROS[id]`).
  Solo salen en los cofres de su servidor (`personalizadosDe` en `utils/cofres.js`); foto en `/uploads` (`casinoArte.imagenCompanero`).
  API `GET/POST /modulos/compis`, `PUT/DELETE /modulos/compis/:cid` (si alguien lo tiene, DELETE solo lo quita de los cofres).
  Panel: Diversión → Compañeros (`views/CompisView.jsx`, textos `dashboard.compis_v.*`; nombres en `casino_v.comp.*`).
  Al añadir compañeros: dibujo en `assets/mascota` y `public/mascota`, `src/lib/casino.js` (test) y `casino_v.comp`.
- 1.19.0 **Instalación guiada** (`components/dashboard/InstalacionGuiada.jsx`, sustituye a `SetupRapido.jsx`): asistente por
  preguntas (`PASOS`: hola, idioma, tipo, qué — `PACKS` de módulos con «Elegir qué incluye» —, dónde — cada canal de `CANALES`
  «Que Sokyo lo prepare» o un `<select>` con los canales del usuario —, staff, resumen en frases). Manda
  `{idioma, tipo, modulos, canales, rolStaffId}` a `POST /setup-rapido` y muestra el resultado con «¿Y ahora qué?». Textos en
  `dashboard.guia.*`; reutiliza `dashboard.setup.*` y `dashboard.asistente.tipos.*`. `TarjetaInstalacion` es la tarjeta del inicio.
- 1.18.0 **«Esto está apagado» en cada sección** (`components/dashboard/AvisoApagado.jsx`, montado en `Dashboard.jsx` encima
  de la vista): si `estadoModulos[tab]` es false sale una tarjeta grande con qué hace (`asistente.porque`), qué hará al
  activarla (`dashboard.activar.que.<modulo>`) y «⚡ Activarlo ahora» (`lib/activar.js`: `ACTIVABLE` + `activarSeccion`, el
  setup rápido con `uno`). Si la sección no es activable, el botón lleva al primer `[role=switch]` de la vista
  (`data-vista-seccion`) y lo resalta (`sk-resaltado`). Al terminar recarga la sección (`recargarSeccion()`). Si una
  sección nueva tiene interruptor, añádela a `estadoModulos` (useDashboard) y, si el setup sabe activarla, a `ACTIVABLE` y a
  `activar.que`.

