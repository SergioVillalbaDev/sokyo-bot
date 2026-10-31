// ============================================================================
// Mensajes de bienvenida y despedida.
// Reutiliza el constructor de embeds (utils/embeds.js) para mandar un mensaje
// totalmente editable (texto + embed con imágenes/GIFs) a un canal cuando un
// miembro entra o sale. Soporta placeholders dinámicos que se sustituyen en el
// momento del envío. Lo usan los eventos guildMemberAdd / guildMemberRemove y
// el botón "Probar" del panel.
//
// Placeholders: {mention} {user} {server} {members} {avatar}
// (Se aceptan {servidor} y {miembros} como alias en español por compatibilidad
//  con configuraciones guardadas antes del cambio a inglés.)
// ============================================================================
const path = require('path');
const { construirMensaje } = require('./embeds.js');
const { t } = require('./i18n.js');
const { explicarError, permisosQueFaltan } = require('./erroresDiscord.js');

// Carpeta de imágenes subidas (misma que usa la API para los embeds).
const UPLOADS_DIR = path.join(__dirname, '..', 'api', 'uploads');

// Sustituye los placeholders en un texto.
function reemplazar(texto, datos) {
    return String(texto || '')
        .replace(/{mention}/g, datos.mention)
        .replace(/{user}/g, datos.user)
        .replace(/{server}/g, datos.servidor)
        .replace(/{servidor}/g, datos.servidor)   // alias ES (compatibilidad)
        .replace(/{members}/g, String(datos.miembros))
        .replace(/{miembros}/g, String(datos.miembros)) // alias ES (compatibilidad)
        .replace(/{avatar}/g, datos.avatar);
}

// Sustituye los placeholders en todos los campos de texto/URL de un embed.
function reemplazarEmbed(embed, datos) {
    if (!embed || typeof embed !== 'object') return null;
    const e = { ...embed };
    const claves = ['titulo', 'tituloUrl', 'descripcion', 'imagenUrl', 'miniaturaUrl',
        'autorNombre', 'autorUrl', 'autorIconoUrl', 'footer', 'footerIconoUrl'];
    for (const k of claves) if (typeof e[k] === 'string') e[k] = reemplazar(e[k], datos);
    if (Array.isArray(e.campos)) {
        e.campos = e.campos.map((c) => ({
            ...c,
            nombre: reemplazar(c && c.nombre, datos),
            valor: reemplazar(c && c.valor, datos),
        }));
    }
    return e;
}

// Datos de sustitución a partir del miembro.
function datosDe(member) {
    return {
        mention: `<@${member.id}>`,
        user: member.user.username,
        servidor: member.guild.name,
        miembros: member.guild.memberCount,
        avatar: member.displayAvatarURL({ extension: 'png', size: 256 }),
    };
}

// Envía el mensaje (bienvenida o despedida) según su config. Devuelve true si se
// envió, o un objeto { error } si algo falló (lo usa el botón "Enviar prueba").
// Opciones (solo las usa la prueba del panel):
//  - prueba: se manda aunque el mensaje esté desactivado, para verlo antes de activarlo.
//  - idioma: idioma de los errores (el del panel de quien prueba; si no, el del bot).
async function enviar(member, conf, cfg, { prueba = false, idioma } = {}) {
    const lang = idioma || cfg;
    if (!conf || (!conf.activo && !prueba)) return { error: t(lang, 'Está desactivado.', 'Disabled.') };
    if (!conf.canalId) return { error: t(lang, 'No hay ningún canal configurado.', 'No channel configured.') };
    const canal = member.guild.channels.cache.get(conf.canalId);
    if (!canal || typeof canal.send !== 'function') return { error: t(lang, 'El canal no existe o no es de texto.', 'The channel doesn’t exist or isn’t a text channel.') };

    const datos = datosDe(member);
    const contenido = reemplazar(conf.contenido, datos);
    const embed = reemplazarEmbed(conf.embed, datos);
    const payload = construirMensaje(contenido, embed, UPLOADS_DIR);
    if (!payload.content && !(payload.embeds && payload.embeds.length)) return { error: t(lang, 'El mensaje está vacío.', 'The message is empty.') };

    // Antes de mandar, ¿puede el bot escribir ahí? Así la prueba dice qué permiso falta.
    const necesarios = ['ViewChannel', 'SendMessages'];
    if (payload.embeds && payload.embeds.length) necesarios.push('EmbedLinks');
    if (payload.files && payload.files.length) necesarios.push('AttachFiles');
    const faltan = permisosQueFaltan(canal, necesarios, idioma || cfg);
    if (faltan.length) {
        return { error: t(lang, `Al bot le faltan permisos en #${canal.name}: ${faltan.join(', ')}.`, `The bot is missing permissions in #${canal.name}: ${faltan.join(', ')}.`) };
    }

    // Solo se pingea al usuario si está activado; nunca @everyone/roles por accidente.
    payload.allowedMentions = conf.mencionar ? { users: [member.id] } : { parse: [] };

    await canal.send(payload);
    return true;
}

// Error de Discord al mandar -> texto que entiende quien está en el panel.
function textoError(e, idioma) {
    // 50035: Discord rechaza el contenido, casi siempre por una dirección de imagen
    // que no es válida (no empieza por https://, una variable mal escrita…).
    if (e && e.code === 50035) {
        return t(idioma, 'Discord no acepta alguna imagen o enlace del mensaje. Revisa que las direcciones empiecen por https:// o sube la imagen desde el PC.',
            'Discord rejected an image or link in the message. Check that the addresses start with https:// or upload the image from your PC.');
    }
    return explicarError(e, idioma).texto;
}

async function enviarBienvenida(member, cfg, opciones = {}) {
    try { return await enviar(member, cfg && cfg.bienvenida, cfg, opciones); }
    catch (e) { console.error('Error enviando bienvenida:', e.message); return { error: textoError(e, opciones.idioma || cfg) }; }
}

async function enviarDespedida(member, cfg, opciones = {}) {
    try { return await enviar(member, cfg && cfg.despedida, cfg, opciones); }
    catch (e) { console.error('Error enviando despedida:', e.message); return { error: textoError(e, opciones.idioma || cfg) }; }
}

module.exports = { enviarBienvenida, enviarDespedida };
