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
  --no-git-tag-version`. **Versión actual: 1.9.3.** El aviso lleva la lista de
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
- Ofrecido pero sin hacer: comando `/categoria crear` en Discord (hoy las
  categorías se crean desde el panel).
