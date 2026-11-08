// Novedades de cada versión: van en el aviso «Bot actualizado» (utils/anuncioActualizacion.js)
// y en la ventana «Novedades» del panel (la primera vez que se entra tras actualizar).
// Al subir la versión del bot, añade aquí lo nuevo en pocas palabras y sin
// tecnicismos: es lo que leen los miembros del servidor. Discord corta los
// mensajes a 2000 caracteres: unas 10-12 líneas como mucho.
// Cada novedad: un texto (solo en español) o { es, en, tab } — `tab` es la
// sección del panel donde está (navConfig.js), para el botón «Ver».
const NOVEDADES = {
    '1.9.16': [
        { tab: 'com-grupos', es: '🎮 /grupo ahora abre una ventana con todo a la vista: a qué vais a jugar, cuántos hacen falta, cuándo y una caja grande para un mensaje con lo que vais a hacer (modo, nivel, si hace falta micro… en varias líneas).', en: '🎮 /group now opens a form with everything in sight: what you’ll play, how many people you need, when and a big box for a message about what you’ll do (mode, rank, mic needed… over several lines).' },
        { tab: 'com-grupos', es: '✏️ Botón «Editar» en cada grupo: quien lo creó (o el staff) cambia el mensaje, el juego, la hora o las plazas cuando quiera y el grupo se actualiza solo.', en: '✏️ “Edit” button on every group: whoever started it (or the staff) can change the message, the game, the time or the slots whenever they want, and the group updates itself.' },
        { tab: 'com-grupos', es: '📝 Borrador: si algo falla al publicar (por ejemplo, unas plazas que no valen), lo que has escrito no se pierde. Con «Volver a la ventana» (o usando /grupo otra vez) sigue ahí.', en: '📝 Drafts: if something goes wrong when posting (say, slots that aren’t valid), what you wrote isn’t lost. “Back to the form” (or using /group again) brings it back.' },
    ],
    '1.9.15': [
        { tab: 'seg-verificacion', es: '🚪 La aprobación del staff ya es una opción: eliges si tiene que esperar **nadie** (entran al momento, lo normal), **todos** o **solo los sospechosos** (cuenta muy nueva, sin foto o una respuesta marcada con 🕵️). Y puedes avisar a un rol del staff cuando llega una.', en: '🚪 Staff approval is now an option: you choose whether **nobody** has to wait (they get in straight away, the usual), **everyone** or **only suspicious ones** (very new account, no picture or an answer marked with 🕵️). You can also ping a staff role when one arrives.' },
        { tab: 'seg-verificacion', es: '🧱 Requisitos para verificarse: edad mínima de la cuenta de Discord, foto de perfil obligatoria y un rato dentro antes de poder verificarse. Si no los cumple, el bot le dice por qué y cuándo podrá.', en: '🧱 Requirements to verify: minimum Discord account age, a required profile picture and some time inside before verifying. If they don’t meet them, the bot tells them why and when they can.' },
        { tab: 'seg-verificacion', es: '📜 Normas que hay que aceptar («He leído y acepto») antes de verificarse.', en: '📜 Rules they must accept (“I’ve read them and accept”) before verifying.' },
        { tab: 'seg-verificacion', es: '🧩 Captcha a tu medida: letras del código, intentos, minutos para resolverlo y qué pasa si falla todos (esperar, aislar o expulsar).', en: '🧩 Captcha your way: code letters, attempts, minutes to solve it and what happens if they fail them all (wait, time out or kick).' },
        { tab: 'seg-verificacion', es: '🎉 Al verificarse: roles de más, un rol «Sin verificar» que se quita solo, tu propio mensaje de «¡Listo!» y un privado de bienvenida.', en: '🎉 When they verify: extra roles, an “Unverified” role that removes itself, your own “Done!” message and a welcome DM.' },
        { tab: 'seg-verificacion', es: '⏰ Quien no se verifica: le llega un recordatorio por privado y, si quieres, sale del servidor pasadas las horas que elijas (solo los que entren desde ahora y nunca el staff).', en: '⏰ Anyone who doesn’t verify gets a DM reminder and, if you want, is removed after the hours you choose (only people joining from now on, never the staff).' },
        { tab: 'seg-verificacion', es: '📒 Registro de la verificación con las cifras de la semana (en el panel y, si quieres, en un canal) y «Verificar a alguien a mano» desde el panel.', en: '📒 Verification log with the week’s figures (in the panel and, if you want, in a channel) and “Verify someone manually” from the panel.' },
    ],
    '1.9.14': [
        { tab: 'com-presentaciones', es: '✏️ El mensaje «Preséntate a la comunidad» se personaliza entero: título, texto, imagen o GIF, colores y el botón (texto y color). Lo que cambias se actualiza solo en el mensaje que ya está en Discord.', en: '✏️ The “Introduce yourself to the community” message is fully customizable: title, text, image or GIF, colours and the button (text and colour). What you change updates on its own in the message already in Discord.' },
        { tab: 'com-sugerencias', es: '💡 Lo mismo con el mensaje «Nueva sugerencia». Arreglado: con el formulario, cada guardado publicaba el mensaje otra vez; ahora se actualiza el que ya hay.', en: '💡 Same for the “New suggestion” message. Fixed: in form mode, every save posted the message again; now the existing one is updated.' },
        { tab: 'config-textos', es: '🌐 Si el bot escribe en inglés y tu panel está en español, el panel te avisa y lo cambias con un botón. Al cambiar el idioma, los paneles que ya estaban en Discord (presentaciones, tickets, Mi cuenta, verificación…) se reescriben solos en el idioma nuevo.', en: '🌐 If the bot writes in a different language from your panel, the panel tells you and you switch it with one button. When you change the language, the panels already in Discord (intros, tickets, My account, verification…) are rewritten on their own.' },
        { tab: 'config-cambios', es: '↩️ «Deshacer» un cambio de uno de esos mensajes también lo deshace en Discord.', en: '↩️ “Undo” on a change to one of those messages also undoes it in Discord.' },
    ],
    '1.9.13': [
        { tab: 'seg-verificacion', es: '🛂 Verificación con aprobación: nadie entra al servidor hasta que el staff acepta su verificación. Le llega a un canal vuestro (y al panel) con lo que respondió, «Aceptar» y «Rechazar»; si se rechaza, recibe el motivo por privado.', en: '🛂 Verification with approval: nobody gets into the server until the staff accepts their verification. It reaches a channel of yours (and the panel) with what they answered, “Accept” and “Reject”; if rejected, they get the reason by DM.' },
        { tab: 'seg-verificacion', es: '📁 Cada respuesta de las preguntas al entrar puede abrir una categoría o un canal suelto.', en: '📁 Each answer to the joining questions can open a category or a single channel.' },
        { tab: 'tickets-config', es: '🎫 «Publicar el panel de tickets» desde el panel: elige el canal y listo, ya no hace falta escribir !sokyo (si ya está, se actualiza).', en: '🎫 “Publish the ticket panel” from the panel: pick the channel and done, no need to type !sokyo anymore (if it’s already there, it gets updated).' },
        { tab: 'tickets-gestion', es: '📅 Cada ticket enseña cuándo se abrió (y cuándo se cerró).', en: '📅 Each ticket shows when it was opened (and when it was closed).' },
    ],
    '1.9.12': [
        { tab: 'seg-verificacion', es: '🚪 Una sola verificación para todo: tras el botón (o el captcha), el bot hace tus preguntas una a una (edad, de dónde eres, anuncios, juegos…) y cada respuesta da su rol. El rol de acceso llega al terminar.', en: '🚪 One verification for everything: after the button (or the captcha), the bot asks your questions one by one (age, where you’re from, announcements, games…) and each answer gives its role. The access role comes at the end.' },
        { tab: 'seg-verificacion', es: '🔒 «Cerrar el servidor hasta verificarse»: sin el rol de acceso solo se ve el canal de verificación, y las categorías de juegos solo las ve quien las elige.', en: '🔒 “Close the server until verified”: without the access role only the verification channel is visible, and game categories are only visible to those who pick them.' },
        { tab: 'com-presentaciones', es: '📝 Presentaciones con aprobación: el staff acepta (se publica en el canal) o rechaza (le llega un privado con el motivo, y el mensaje lo escribes tú).', en: '📝 Intros with approval: the staff accepts (it’s published in the channel) or rejects (they get a DM with the reason, and you write the message).' },
        { tab: 'seg-reportes', es: '🕵️ Reportes anónimos: el reportado nunca sabe quién fue. Solo los administradores y los roles que elijas lo ven, con «Ver quién reportó».', en: '🕵️ Anonymous reports: the reported member never knows who it was. Only administrators and the roles you choose can see it, with “See who reported”.' },
        { tab: 'tickets-config', es: '🎫 Tickets ordenados: los abiertos van siempre a su categoría (el bot la crea si hace falta) y los cerrados a la suya. Con «Ordenar ahora» se colocan los que ya había.', en: '🎫 Tidy tickets: open ones always go to their category (the bot creates it if needed) and closed ones to theirs. “Sort now” puts the existing ones in place.' },
        { tab: 'com-micuenta', es: '✏️ El mensaje de «Mi cuenta» de los miembros se personaliza entero: texto, imagen o GIF, colores y todos los botones con sus textos.', en: '✏️ The members’ “My account” message is fully customizable: text, image or GIF, colours and every button with its text.' },
        { tab: 'prod-anuncios', es: '🖊️ «Editar» en los anuncios programados, eventos, sorteos, encuestas, motivos de ticket, respuestas rápidas y mensajes guardados: corrige sin borrar y empezar de cero (lo publicado en Discord se actualiza solo).', en: '🖊️ “Edit” on scheduled announcements, events, giveaways, polls, ticket reasons, quick replies and saved messages: fix things without deleting and starting over (what’s published in Discord updates itself).' },
        { tab: 'inicio', es: '🎨 «Mi cuenta» con todos los temas del panel (los Premium, con plan Premium) y el «Guardar» del Creador de mensajes siempre a mano.', en: '🎨 “My account” with all the panel themes (Premium ones with a Premium plan) and the message creator’s “Save” always at hand.' },
    ],
    '1.9.11': [
        { tab: 'musica', es: '🎵 /play cumple los ajustes de Música del panel (fuentes, playlists y máximo de la cola) y, si el servidor de música está apagado o una búsqueda falla, lo dice claro en vez de un error raro.', en: '🎵 /play follows the panel’s Music settings (sources, playlists and queue limit) and, if the music server is off or a search fails, it says so clearly instead of a weird error.' },
        { tab: 'roles-gestion', es: '🎭 Roles: nueva opción «Mostrar a los miembros del rol por separado». Y modo simple o avanzado: el avanzado trae todo lo de Discord (mencionable, color en degradado, emoji del rol, copiar o quitar permisos).', en: '🎭 Roles: new “Display role members separately” option. Plus simple or advanced mode: advanced has everything Discord offers (mentionable, gradient colour, role emoji, copy or clear permissions).' },
        { tab: 'config-canales', es: '🗂️ Canales: ya se puede añadir @everyone para hacer un canal privado, y el modo avanzado deja dar permisos a personas concretas y «Permitir/Denegar todo». Arreglado: guardar los permisos de un ticket o una sala temporal ya no falla.', en: '🗂️ Channels: you can now add @everyone to make a channel private, and advanced mode lets you give permissions to specific people and “Allow/Deny all”. Fixed: saving a ticket’s or temporary room’s permissions no longer fails.' },
        { tab: 'inicio', es: '⌨️ Todos los comandos funcionan con /: banear, aislar, avisar, nivel, ranking, rol, emoji, sticker, xp, ping y más. Escribe / y Discord te los enseña; con ! siguen funcionando.', en: '⌨️ Every command works with /: ban, timeout, warn, level, ranking, role, emoji, sticker, xp, ping and more. Type / and Discord shows them; they still work with !.' },
        { tab: 'owner-entrada', es: '💌 Al entrar en un servidor nuevo, el bot le manda al dueño por privado una guía con todo lo que puede hacer y cómo ponerlo en marcha.', en: '💌 When it joins a new server, the bot DMs the owner a guide with everything it can do and how to set it up.' },
    ],
    '1.9.10': [
        { tab: 'musica', es: '🎵 La música vuelve a sonar: YouTube cambió en agosto y casi todas las canciones daban «This video requires login». Si un vídeo concreto no se puede reproducir, el bot pone otra versión de la misma canción, y los errores se explican con palabras normales.', en: '🎵 Music plays again: YouTube changed in August and almost every song failed with “This video requires login”. If a specific video can’t play, the bot plays another version of the same song, and errors are explained in plain words.' },
        { tab: 'musica', es: '🔑 Si YouTube sigue pidiendo iniciar sesión, el dueño del bot puede conectar una cuenta de YouTube desde Música → «Cuenta de YouTube» (con un código, como en una tele).', en: '🔑 If YouTube keeps asking to sign in, the bot owner can connect a YouTube account from Music → “YouTube account” (with a code, like on a TV).' },
        { tab: 'com-confesiones', es: '🤫 Confesiones escribiendo en un canal (opcional): lo que alguien escribe ahí se borra y sale como confesión anónima. /confesar sigue funcionando igual.', en: '🤫 Confessions by writing in a channel (optional): whatever someone writes there is deleted and posted as an anonymous confession. /confess keeps working the same.' },
        { tab: 'inicio', es: '💾 Ya no se pierde lo que estás configurando si recargas o cierras la página antes de que se guarde: al volver se recupera (con «Descartar» por si no lo querías). Vale también para anuncios, encuestas, eventos, sorteos, dinámicas, paneles de roles y voz temporal. Con el autoguardado apagado también avisa antes de salir.', en: '💾 What you’re setting up is no longer lost if you reload or close the page before it saves: it comes back when you return (with “Discard” in case you didn’t want it). It also works for announcements, polls, events, giveaways, dynamics, role panels and temporary voice. With autosave off it also warns before leaving.' },
        { tab: 'prod-embeds', es: '📝 Creador de mensajes: botón «Guardar» junto a «Enviar» para guardar el mensaje y seguir otro día (y «Guardar cambios» si lo abres de «Mensajes guardados»). Lo que escribes se queda como borrador aunque recargues.', en: '📝 Message creator: a “Save” button next to “Send” to keep the message and carry on another day (and “Save changes” when you open it from “Saved messages”). What you write stays as a draft even if you reload.' },
        { tab: 'prod-embeds', es: '🎞️ Los GIF del móvil ya se suben bien en todo el panel: si pesan más de 8 MB se encogen solos, los «GIF» de WhatsApp o Telegram (que son vídeos) y los WebP animados se convierten en GIF, ya no se quedan quietos ni recortados, y pegar el enlace de Tenor o Giphy pone el GIF de verdad.', en: '🎞️ Phone GIFs now upload properly across the whole panel: if they’re over 8 MB they shrink on their own, WhatsApp or Telegram “GIFs” (which are videos) and animated WebPs become GIFs, they no longer end up still or cropped, and pasting a Tenor or Giphy link puts the actual GIF.' },
        { tab: 'config-expresiones', es: '😀 Emojis: cámbiales el nombre tocándolos, ve cuántos huecos quedan y cuáles ha desactivado Discord por falta de hueco (por eso salía «No hay ranuras de emojis abiertas»). Un GIF grande se encoge solo hasta caber.', en: '😀 Emojis: rename them by tapping, see how many slots are left and which ones Discord disabled for lack of slots (that’s why it said “No emoji slots available”). A big GIF shrinks on its own until it fits.' },
    ],
    '1.9.9': [
        { tab: 'com-sugerencias', es: '👀 Vista previa de cómo lo ve la gente en Discord en muchas más secciones: sugerencias, presentaciones (con la ventana que se abre), eventos, sorteos, encuestas, confesiones, salón de la fama, grupos, clanes, parte diario, ausente, dinámicas, reportes, paneles de roles, voz temporal, música, registros y el privado de las sanciones.', en: '👀 Preview of how people see it in Discord in many more sections: suggestions, introductions (with the window that opens), events, giveaways, polls, confessions, hall of fame, groups, clans, daily report, away mode, dynamics, reports, role panels, temporary voice, music, logs and the sanction DM.' },
        { tab: 'mod-tipos', es: '🛡️ En «Tipos de sanción» ves cómo le llega el aviso al miembro por privado.', en: '🛡️ In “Sanction types” you see how the member receives the notice by DM.' },
    ],
    '1.9.8': [
        { tab: 'prod-bienvenidas', es: '👀 Vista previa como en Discord en las secciones con mensajes: bienvenidas (con el texto de encima y {mention}, {server}… cambiados por ejemplos), niveles, cumpleaños, invitaciones, bump, directos, solicitudes (con sus botones) y mensajes fijos. Así ves cómo queda sin probarlo en Discord.', en: '👀 Discord-style preview in the sections that send messages: welcomes (with the text above and {mention}, {server}… replaced by examples), levels, birthdays, invites, bump, live alerts, applications (with their buttons) and pinned messages. See how it will look without testing it in Discord.' },
    ],
    '1.9.7': [
        { tab: 'config-niveles', es: '🖼️ Los diseños de tarjeta de nivel pueden llevar una imagen o un GIF de fondo. Se sube, se mueve y se amplía como un logo, y en la tarjeta el GIF se mueve.', en: '🖼️ Level card designs can now have an image or GIF background. Upload it, move and zoom it like a logo, and on the card the GIF moves.' },
        { tab: 'config-niveles', es: '🛠️ El guardado automático ya no borra lo que estás a medias: «Añadir multiplicador», «Añadir recompensa» o «Añadir pregunta» ya no desaparecen solos, y no se pierde lo que escribes mientras se guarda.', en: '🛠️ Autosave no longer wipes what you’re in the middle of: “Add multiplier”, “Add reward” or “Add question” no longer vanish on their own, and nothing you type while it saves gets lost.' },
        { tab: 'inicio', es: '🔎 Los desplegables largos del panel (canales, roles…) tienen buscador: escribe parte del nombre y elige con el ratón, el dedo o Enter.', en: '🔎 Long dropdowns in the panel (channels, roles…) now have a search box: type part of the name and pick with the mouse, your finger or Enter.' },
    ],
    '1.9.6': [
        { tab: 'seg-verificacion', es: '🎨 El panel de entrada de la Doble bienvenida («¡Bienvenido al servidor!» con el botón «Empezar») ya se personaliza entero: texto, embed con imágenes o GIF, y el texto y el color del botón. En la verificación también puedes elegir el color del botón.', en: '🎨 The Dual welcome entry panel (“Welcome to the server!” with the “Get started” button) is now fully customizable: text, an embed with images or GIFs, and the button’s text and color. In verification you can also pick the button color.' },
        { tab: 'prod-ausente', es: '🔄 Las listas del panel (ausentes, grupos, solicitudes, confesiones, clanes, cumpleaños y salón de la fama) se actualizan solas en unos segundos, sin recargar la página.', en: '🔄 Panel lists (away members, groups, requests, confessions, clans, birthdays and hall of fame) update by themselves within seconds, without reloading the page.' },
    ],
    '1.9.5': [
        { tab: 'prod-bienvenidas', es: '🎮 Varias bienvenidas a la vez: añade un mensaje (con su embed) para cada juego o categoría. Cada uno puede salir al entrar alguien o cuando recibe un rol (por ejemplo, el rol de un juego), en su propio canal.', en: '🎮 Several welcomes at once: add a message (with its embed) for each game or category. Each one can be sent when someone joins or when they get a role (for example, a game role), in its own channel.' },
        { tab: 'prod-bienvenidas', es: '🎞️ La imagen y la miniatura de los embeds también pueden ser un GIF animado (desde un enlace o subido desde el PC).', en: '🎞️ Embed images and thumbnails can also be an animated GIF (from a link or uploaded from your PC).' },
    ],
    '1.9.4': [
        { tab: 'prod-bienvenidas', es: '#️⃣ Enlazar canales en la bienvenida, como en Discord: escribe # y sale la lista de canales. Elige uno (con el ratón o con ↑ ↓ y Enter) y en el mensaje saldrá como enlace azul que se puede pulsar. Vale en el texto y en la descripción y los campos del embed.', en: '#️⃣ Link channels in welcomes, just like in Discord: type # and the list of channels appears. Pick one (with the mouse or ↑ ↓ and Enter) and it shows up in the message as a blue link people can click. Works in the text and in the embed description and fields.' },
    ],
    '1.9.3': [
        { tab: 'prod-bienvenidas', es: '📢 Enlazar canales en la bienvenida y la despedida: escribe # y el nombre del canal (por ejemplo #reglas) o elígelo en «Mencionar un canal», y saldrá como enlace azul que se puede pulsar. Vale en el texto y en la descripción y los campos del embed.', en: '📢 Link channels in welcomes and goodbyes: type # and the channel name (for example #rules) or pick it in “Mention a channel”, and it shows up as a blue link people can click. Works in the text and in the embed description and fields.' },
    ],
    '1.9.2': [
        { tab: 'prod-bienvenidas', es: '👋 Bienvenidas y despedidas: arriba del todo te dice si de verdad se mandan solas y, si no, por qué (apagada, sin canal, vacía…) o si salen sin notificación, con un botón para arreglarlo.', en: '👋 Welcomes and goodbyes: at the top it tells you whether they’re really sent automatically and, if not, why (off, no channel, empty…) or whether they go out without a notification, with a button to fix it.' },
        { tab: 'logs-todos', es: '⚠️ Si la bienvenida está encendida pero no puede salir al entrar alguien (falta un permiso, el canal se borró…), queda apuntado en el registro y en el canal de logs.', en: '⚠️ If the welcome is on but can’t be sent when someone joins (a missing permission, a deleted channel…), it’s noted in the log and the logs channel.' },
    ],
    '1.9.1': [
        { tab: 'prod-bienvenidas', es: '🖼️ Al subir una imagen o un logo a un embed (bienvenidas, anuncios…) puedes recortarla, moverla, ampliarla y ver cómo quedará en Discord. Con «Que se vea entera», el logo ya no se corta en el icono redondo.', en: '🖼️ When you upload an image or logo to an embed (welcomes, announcements…) you can crop, move and zoom it and see how it will look in Discord. With “Show it whole”, logos no longer get cut off in the round icon.' },
        { tab: 'prod-bienvenidas', es: '📨 «Enviar prueba» en bienvenidas y despedidas funciona aunque el mensaje aún no esté activado, guarda antes lo que ves y, si algo falla, te dice qué permiso le falta al bot.', en: '📨 “Send test” in welcomes and goodbyes works even if the message isn’t turned on yet, saves what you see first and, if something fails, tells you which permission the bot is missing.' },
        { tab: 'prod-bienvenidas', es: '➕ «Añadir campo» en los embeds ya no se borra solo mientras lo escribes.', en: '➕ “Add field” in embeds no longer disappears by itself while you’re typing it.' },
    ],
    '1.9.0': [
        { tab: 'com-cumpleanos', es: '🎂 Cumpleaños: guarda el tuyo con /cumple (o en Mi cuenta) y el servidor te felicita ese día, con rol especial y regalo si el staff quiere.', en: '🎂 Birthdays: save yours with /birthday (or in My account) and the server congratulates you on the day, with a special role and a gift if the staff likes.' },
        { tab: 'com-grupos', es: '🎮 /grupo: busca gente para jugar y los demás se apuntan con un botón. Al llenarse, sala de voz solo para el grupo.', en: '🎮 /group: look for people to play with and others join with a button. When it’s full, a voice room just for the group.' },
        { tab: 'com-clanes', es: '🛡️ Clanes: funda uno con /clan crear. Cada XP suma para tu clan y cada lunes gana el que más tiene.', en: '🛡️ Clans: found one with /clan create. Every XP counts for your clan and every Monday the top one wins.' },
        { tab: 'com-salon', es: '⭐ Salón de la fama: los mensajes que llegan a varias estrellas se guardan en un canal especial.', en: '⭐ Hall of fame: messages that get enough stars are saved in a special channel.' },
        { tab: 'com-confesiones', es: '💬 Confesiones anónimas con /confesar (con revisión del staff si se quiere).', en: '💬 Anonymous confessions with /confess (with staff review if wanted).' },
        { tab: 'com-solicitudes', es: '📝 Solicitudes al staff: un formulario con botón en Discord; el staff acepta o rechaza y el bot da el rol.', en: '📝 Staff applications: a form with a button in Discord; the staff accepts or rejects and the bot gives the role.' },
        { tab: 'tickets-config', es: '🎫 Tickets: antes de abrir uno, el bot busca la respuesta en las respuestas del servidor. Y ahora se pueden abrir escribiendo al bot por privado.', en: '🎫 Tickets: before opening one, the bot looks for the answer in the server’s replies. And now you can open one by DMing the bot.' },
        { tab: 'prod-ausente', es: '🌐 Clic derecho en un mensaje → Apps → Traducir, y /ausente para avisar de que no estás si te mencionan.', en: '🌐 Right-click a message → Apps → Translate, and /afk to let people know you’re away when they mention you.' },
        { tab: 'prod-fijos', es: '📌 Mensajes fijos: un mensaje (como las normas) que se queda siempre al final del canal.', en: '📌 Sticky messages: a message (like the rules) that always stays at the bottom of the channel.' },
        { tab: 'crec-contadores', es: '🔢 Canales con contadores en el nombre: «👥 Miembros: 1.234», gente en voz, mejoras…', en: '🔢 Channels with counters in their name: “👥 Members: 1,234”, people in voice, boosts…' },
        { tab: 'crec-directos', es: '📡 Avisos de directos de Kick y de lo nuevo en comunidades de Reddit o en cualquier web con RSS.', en: '📡 Alerts for Kick streams and for new posts in Reddit communities or on any website with RSS.' },
    ],
    '1.8.0': [
        { tab: 'config-diagnostico', es: '🩺 «¿Algo no funciona?» en el panel: revisa permisos, canales y roles y te dice cómo arreglarlo, casi siempre con un botón.', en: '🩺 “Something not working?” in the panel: it checks permissions, channels and roles and tells you how to fix it, usually with one button.' },
        { tab: 'config-cambios', es: '↩️ «Deshacer» justo después de guardar e «Historial de cambios»: quién cambió qué y un botón para dejarlo como estaba.', en: '↩️ “Undo” right after saving, plus a “Change history”: who changed what and a button to put it back.' },
        { tab: null, es: '🖱️ Clic derecho en Discord (Apps): sancionar, ver la ficha de alguien, reportar un mensaje o abrir un ticket con él. Banear y expulsar piden confirmación.', en: '🖱️ Right-click in Discord (Apps): sanction, view someone’s profile, report a message or open a ticket with it. Bans and kicks ask to confirm.' },
        { tab: null, es: '📖 /ayuda por categorías y todos los comandos en español (/pausar, /cola, /tienda…). Los errores dicen qué pasa y cómo se arregla.', en: '📖 /help by category and all commands in Spanish too. Errors now say what happened and how to fix it.' },
        { tab: 'musica', es: '🎵 Música: sugerencias al escribir en /play, votar para saltar, /letra y ❤️ para guardar la canción en tus favoritas.', en: '🎵 Music: suggestions as you type in /play, vote to skip, /lyrics and ❤️ to save the song to your favorites.' },
        { tab: null, es: '⏰ /recordar con sugerencias y «10 min más», y /preferencias: tu idioma y qué mensajes privados quieres del bot.', en: '⏰ /remind with suggestions and “10 more min”, and /preferences: your language and which DMs you want from the bot.' },
        { tab: 'com-eventos', es: '🔔 «Avisarme» en los eventos, «¡último aviso!» antes de que acabe un sorteo y un privado al ganador.', en: '🔔 “Remind me” on events, a “last call” before a giveaway ends and a DM to the winner.' },
        { tab: 'tickets-gestion', es: '🎫 Tickets: «está escribiendo…», aviso de los que llevan horas sin respuesta y un privado a quien abrió el ticket cuando le respondes.', en: '🎫 Tickets: “is typing…”, a reminder for the ones waiting hours for a reply, and a DM to the person when you reply.' },
        { tab: 'mod-miembros', es: '👥 Panel más cómodo: buscar un ajuste concreto, favoritos en el menú, ficha al pasar el ratón, acciones con varios miembros a la vez y «➕ Crear canal/rol» en los desplegables.', en: '👥 A handier panel: search for a specific setting, favorites in the menu, a profile on hover, actions on several members at once and “➕ Create channel/role” in dropdowns.' },
        { tab: 'inicio', es: '🧭 Asistente de primera configuración según el tipo de servidor, copiar los ajustes a otro servidor, tamaño de letra, vista compacta y tema según el sistema.', en: '🧭 A setup guide for your type of server, copy settings to another server, text size, compact view and a theme that follows your system.' },
        { tab: null, es: '👤 Mi cuenta: tus avisos y preferencias, los sorteos que ganas y tu historial de sanciones. Nuevas páginas de /estado y /novedades en la web.', en: '👤 My account: your notices and preferences, the giveaways you win and your sanction history. New /estado and /novedades pages on the website.' },
    ],
    '1.7.0': [
        '🎵 La música vuelve a sonar: el servidor de música se pone al día solo con el audio cifrado que Discord exige desde 2026.',
        '👥 Nueva sección «Miembros» en el panel: todo el servidor en una lista, con botones para aislar, expulsar y banear, y una pestaña de baneados para quitar un ban.',
        '📣 Crear canales de anuncios: el panel dice claro qué pasa (por ejemplo, que el servidor necesita la Comunidad activada) en vez de un error genérico.',
        '🔐 Todos los permisos de Discord en roles y canales, cada uno con su explicación y con buscador.',
        '💾 Autoguardado: los ajustes se guardan solos al dejar de tocarlos (y con Ctrl + S).',
        '↩️ Botón «Atrás» en el panel, y el atrás del navegador ya no te saca de él.',
        '👤 Tu foto, abajo en el menú, abre tu perfil («Mi cuenta») sin volver a entrar, y desde «Mi cuenta» vas directo al panel.',
        '🗂️ Mover categorías sin recorrer toda la página: botón «Mover» en cada una, vista «Solo categorías» y «Al principio» / «Al final».',
        '⚡ Modo ligero automático para PCs con pocos recursos y para Firefox: la web va mucho más fluida.',
        '⌨️ Más comodidad: atajos de teclado (pulsa ?), botón «Volver arriba», secciones recientes en el buscador y aviso si cierras con algo sin guardar.',
    ],
};

const textoDe = (n, idioma = 'es') => (typeof n === 'string' ? n : (n[idioma] || n.es));

// Mensaje del aviso para una versión (null si no tiene novedades apuntadas).
function mensajeNovedades(version) {
    const lista = NOVEDADES[version];
    if (!lista || !lista.length) return null;
    const texto = [
        `🚀 **Sokyo se ha actualizado (v${version})**`,
        '',
        '**Novedades:**',
        ...lista.map((l) => `• ${textoDe(l)}`),
        '',
        '¡Gracias por usar Sokyo!',
    ].join('\n');
    return texto.length <= 2000 ? texto : `${texto.slice(0, 1990)}…`;
}

// Para el panel y la página pública /novedades: [{ texto, tab }] en el idioma pedido.
function novedadesDe(version, idioma = 'es') {
    return (NOVEDADES[version] || []).map((n) => ({ texto: textoDe(n, idioma), tab: typeof n === 'string' ? null : n.tab || null }));
}

module.exports = { NOVEDADES, mensajeNovedades, novedadesDe };
