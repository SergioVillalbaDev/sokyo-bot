// Errores con solución: en vez de «Hubo un error», el bot dice qué ha pasado en
// palabras normales y, si se arregla en el panel, pone el botón para ir allí
// (normalmente a «¿Algo no funciona?», el diagnóstico del servidor).
const { ActionRowBuilder } = require('discord.js');
const { botonPanel } = require('./enlacesPanel.js');
const { t } = require('./i18n.js');

// Nombres de los permisos tal y como salen en Discord.
const NOMBRES = {
    ViewChannel: ['Ver canal', 'View Channel'], SendMessages: ['Enviar mensajes', 'Send Messages'],
    EmbedLinks: ['Insertar enlaces', 'Embed Links'], AttachFiles: ['Adjuntar archivos', 'Attach Files'],
    ReadMessageHistory: ['Leer el historial de mensajes', 'Read Message History'], AddReactions: ['Añadir reacciones', 'Add Reactions'],
    ManageMessages: ['Gestionar mensajes', 'Manage Messages'], ManageChannels: ['Gestionar canales', 'Manage Channels'],
    ManageRoles: ['Gestionar roles', 'Manage Roles'], KickMembers: ['Expulsar miembros', 'Kick Members'],
    BanMembers: ['Banear miembros', 'Ban Members'], ModerateMembers: ['Aislar temporalmente a miembros', 'Timeout Members'],
    Connect: ['Conectar', 'Connect'], Speak: ['Hablar', 'Speak'], ManageNicknames: ['Gestionar apodos', 'Manage Nicknames'],
    ManageGuild: ['Gestionar servidor', 'Manage Server'], CreateInstantInvite: ['Crear invitación', 'Create Invite'],
    ManageWebhooks: ['Gestionar webhooks', 'Manage Webhooks'], UseExternalEmojis: ['Usar emojis externos', 'Use External Emojis'],
};
const nombrePermiso = (flag, idioma) => (NOMBRES[flag] ? t(idioma, NOMBRES[flag][0], NOMBRES[flag][1]) : flag);

// ¿Qué permisos de la lista le faltan al bot en ese canal? (nombres legibles)
function permisosQueFaltan(canal, requeridos, idioma) {
    const yo = canal?.guild?.members?.me;
    if (!yo || typeof canal.permissionsFor !== 'function') return [];
    const tiene = canal.permissionsFor(yo);
    if (!tiene) return requeridos.map((f) => nombrePermiso(f, idioma));
    return requeridos.filter((f) => !tiene.has(f)).map((f) => nombrePermiso(f, idioma));
}

// Error de Discord -> { texto, tab }: qué decirle a la persona y dónde se arregla.
function explicarError(error, idioma) {
    const code = error && error.code;
    const diag = 'config-diagnostico';
    if (code === 50013) return { texto: t(idioma, '🔒 Me falta un permiso para hacer eso. En el panel, «¿Algo no funciona?» te dice cuál y cómo dármelo.', '🔒 I’m missing a permission to do that. In the panel, “Something not working?” tells you which one and how to give it to me.'), tab: diag };
    if (code === 50001) return { texto: t(idioma, '🙈 No puedo ver ese canal: me falta «Ver canal» ahí.', '🙈 I can’t see that channel: I’m missing “View Channel” there.'), tab: diag };
    if (code === 50007) return { texto: t(idioma, '✉️ No he podido mandarle un mensaje privado: los tiene cerrados.', '✉️ I couldn’t DM them: their DMs are closed.'), tab: null };
    if ([10003, 10008, 10011, 10013, 10007].includes(code)) return { texto: t(idioma, '🔎 Eso ya no existe (puede que lo hayan borrado hace un momento).', '🔎 That no longer exists (it may have just been deleted).'), tab: null };
    if (code === 30013 || code === 30005 || code === 30007) return { texto: t(idioma, '📦 Discord ha llegado a su máximo (canales, roles o webhooks). Borra alguno y vuelve a probar.', '📦 Discord reached its maximum (channels, roles or webhooks). Delete one and try again.'), tab: null };
    if (error && (error.status === 429 || error.name === 'RateLimitError')) return { texto: t(idioma, '⏳ Discord me está frenando por hacer muchas cosas seguidas. Prueba otra vez en un minuto.', '⏳ Discord is slowing me down for doing many things in a row. Try again in a minute.'), tab: null };
    return { texto: t(idioma, '😵 Algo ha fallado al hacerlo. Prueba otra vez; si sigue, mira «¿Algo no funciona?» en el panel.', '😵 Something went wrong. Try again; if it keeps happening, check “Something not working?” in the panel.'), tab: diag };
}

// Mensaje listo para responder (privado si es una interacción).
function respuestaError(error, idioma, { privado = true } = {}) {
    const { texto, tab } = explicarError(error, idioma);
    const msg = { content: texto };
    if (tab) msg.components = [new ActionRowBuilder().addComponents(botonPanel(idioma, tab, t(idioma, 'Ver cómo arreglarlo', 'See how to fix it')))];
    if (privado) msg.flags = 64;
    return msg;
}

module.exports = { explicarError, respuestaError, permisosQueFaltan, nombrePermiso, NOMBRES };
