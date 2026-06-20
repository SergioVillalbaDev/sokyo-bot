// Constructor de embeds reutilizable.
// Convierte un objeto plano (creado en el panel y guardado en BD) en un
// EmbedBuilder de discord.js, y arma el "payload" del mensaje (texto + embed).
// Lo usan: el envío de embeds desde el panel, los anuncios programados y las
// auto-respuestas en modo embed.
const { EmbedBuilder } = require('discord.js');

// Pasa "#5865F2" (o un número) a un entero de color válido, o null si no lo es.
function normalizarColor(c) {
    if (typeof c === 'number') return c;
    if (typeof c !== 'string') return null;
    const hex = c.replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return parseInt(hex, 16);
}

// Devuelve un objeto plano "limpio" del embed (para guardar en BD o reenviar).
function sanearEmbed(e) {
    e = e || {};
    const campos = Array.isArray(e.campos)
        ? e.campos.slice(0, 25).map((c) => ({
            nombre: String((c && c.nombre) || '').slice(0, 256),
            valor: String((c && c.valor) || '').slice(0, 1024),
            inline: !!(c && c.inline),
        })).filter((c) => c.nombre && c.valor)
        : [];
    return {
        titulo: String(e.titulo || '').slice(0, 256),
        descripcion: String(e.descripcion || '').slice(0, 4096),
        color: typeof e.color === 'string' ? e.color.slice(0, 9) : '#5865F2',
        imagenUrl: String(e.imagenUrl || '').slice(0, 500),
        miniaturaUrl: String(e.miniaturaUrl || '').slice(0, 500),
        autorNombre: String(e.autorNombre || '').slice(0, 256),
        footer: String(e.footer || '').slice(0, 2048),
        fecha: !!e.fecha,
        campos,
    };
}

// ¿El embed tiene algo que mostrar?
function embedTieneContenido(e) {
    if (!e) return false;
    return !!(e.titulo || e.descripcion || e.imagenUrl || e.miniaturaUrl || e.autorNombre || e.footer
        || (Array.isArray(e.campos) && e.campos.length));
}

// Construye el EmbedBuilder de discord.js (o null si no hay contenido).
function construirEmbed(e) {
    if (!embedTieneContenido(e)) return null;
    const embed = new EmbedBuilder();
    if (e.titulo) embed.setTitle(String(e.titulo).slice(0, 256));
    if (e.descripcion) embed.setDescription(String(e.descripcion).slice(0, 4096));
    const color = normalizarColor(e.color);
    if (color !== null) embed.setColor(color);
    if (e.imagenUrl && /^https?:\/\//i.test(e.imagenUrl)) embed.setImage(e.imagenUrl);
    if (e.miniaturaUrl && /^https?:\/\//i.test(e.miniaturaUrl)) embed.setThumbnail(e.miniaturaUrl);
    if (e.autorNombre) embed.setAuthor({ name: String(e.autorNombre).slice(0, 256) });
    if (e.footer) embed.setFooter({ text: String(e.footer).slice(0, 2048) });
    if (e.fecha) embed.setTimestamp(new Date());
    if (Array.isArray(e.campos)) {
        for (const c of e.campos.slice(0, 25)) {
            if (!c || !c.nombre || !c.valor) continue;
            embed.addFields({ name: String(c.nombre).slice(0, 256), value: String(c.valor).slice(0, 1024), inline: !!c.inline });
        }
    }
    return embed;
}

// Arma el payload de un mensaje: { content?, embeds? }. Vacío si no hay nada.
function construirMensaje(contenido, embedCfg) {
    const payload = {};
    const txt = String(contenido || '').slice(0, 2000);
    if (txt) payload.content = txt;
    const embed = construirEmbed(embedCfg);
    if (embed) payload.embeds = [embed];
    return payload;
}

module.exports = { construirEmbed, construirMensaje, sanearEmbed, embedTieneContenido, normalizarColor };
