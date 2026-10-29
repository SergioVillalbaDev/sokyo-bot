// Novedades de cada versión: van en el aviso «Bot actualizado» (utils/anuncioActualizacion.js)
// y en la ventana «Novedades» del panel (la primera vez que se entra tras actualizar).
// Al subir la versión del bot, añade aquí lo nuevo en pocas palabras y sin
// tecnicismos: es lo que leen los miembros del servidor. Discord corta los
// mensajes a 2000 caracteres: unas 10-12 líneas como mucho.
// Cada novedad: un texto (solo en español) o { es, en, tab } — `tab` es la
// sección del panel donde está (navConfig.js), para el botón «Ver».
const NOVEDADES = {
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
