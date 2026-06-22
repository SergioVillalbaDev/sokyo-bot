// ============================================================================
// Mensajes de bienvenida y despedida.
// Reutiliza el constructor de embeds (utils/embeds.js) para mandar un mensaje
// totalmente editable (texto + embed con imágenes/GIFs) a un canal cuando un
// miembro entra o sale. Soporta placeholders dinámicos que se sustituyen en el
// momento del envío. Lo usan los eventos guildMemberAdd / guildMemberRemove y
// el botón "Probar" del panel.
//
// Placeholders: {mention} {user} {servidor} {miembros} {avatar}
// ============================================================================
const path = require('path');
const { construirMensaje } = require('./embeds.js');

// Carpeta de imágenes subidas (misma que usa la API para los embeds).
const UPLOADS_DIR = path.join(__dirname, '..', 'api', 'uploads');

// Sustituye los placeholders en un texto.
function reemplazar(texto, datos) {
    return String(texto || '')
        .replace(/{mention}/g, datos.mention)
        .replace(/{user}/g, datos.user)
        .replace(/{servidor}/g, datos.servidor)
        .replace(/{miembros}/g, String(datos.miembros))
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
// envió, o un objeto { error } si algo falló (lo usa el botón "Probar").
async function enviar(member, conf) {
    if (!conf || !conf.activo) return { error: 'Desactivado.' };
    if (!conf.canalId) return { error: 'Sin canal configurado.' };
    const canal = member.guild.channels.cache.get(conf.canalId);
    if (!canal || typeof canal.send !== 'function') return { error: 'El canal no existe o no es de texto.' };

    const datos = datosDe(member);
    const contenido = reemplazar(conf.contenido, datos);
    const embed = reemplazarEmbed(conf.embed, datos);
    const payload = construirMensaje(contenido, embed, UPLOADS_DIR);
    if (!payload.content && !(payload.embeds && payload.embeds.length)) return { error: 'El mensaje está vacío.' };

    // Solo se pingea al usuario si está activado; nunca @everyone/roles por accidente.
    payload.allowedMentions = conf.mencionar ? { users: [member.id] } : { parse: [] };

    await canal.send(payload);
    return true;
}

async function enviarBienvenida(member, cfg) {
    try { return await enviar(member, cfg && cfg.bienvenida); }
    catch (e) { console.error('Error enviando bienvenida:', e.message); return { error: e.message }; }
}

async function enviarDespedida(member, cfg) {
    try { return await enviar(member, cfg && cfg.despedida); }
    catch (e) { console.error('Error enviando despedida:', e.message); return { error: e.message }; }
}

module.exports = { enviarBienvenida, enviarDespedida };
