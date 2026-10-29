// Novedades de cada versión: van en el aviso «Bot actualizado» (utils/anuncioActualizacion.js)
// y en la ventana «Novedades» del panel (la primera vez que se entra tras actualizar).
// Al subir la versión del bot, añade aquí lo nuevo en pocas palabras y sin
// tecnicismos: es lo que leen los miembros del servidor. Discord corta los
// mensajes a 2000 caracteres: unas 10-12 líneas como mucho.
// Cada novedad: un texto (solo en español) o { es, en, tab } — `tab` es la
// sección del panel donde está (navConfig.js), para el botón «Ver».
const NOVEDADES = {
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
