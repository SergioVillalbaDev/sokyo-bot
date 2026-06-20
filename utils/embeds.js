// Constructor de embeds reutilizable.
// Convierte un objeto plano (creado en el panel y guardado en BD) en un
// EmbedBuilder de discord.js, y arma el "payload" del mensaje (texto + embed +
// adjuntos). Lo usan: el envío de embeds desde el panel, los anuncios
// programados y las auto-respuestas en modo embed.
//
// Imágenes: pueden venir como URL externa (imagenUrl/miniaturaUrl) o como
// archivo subido al servidor (imagenArchivo/miniaturaArchivo en /uploads). Para
// los archivos subidos los adjuntamos al mensaje y los referenciamos con
// attachment://, así Discord los muestra aunque la API esté en localhost (mismo
// truco que utils/rolePanelManager.js).
const fs = require('fs');
const path = require('path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

// Pasa "#5865F2" (o un número) a un entero de color válido, o null si no lo es.
function normalizarColor(c) {
    if (typeof c === 'number') return c;
    if (typeof c !== 'string') return null;
    const hex = c.replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return parseInt(hex, 16);
}

// Solo deja el nombre del archivo (evita rutas raras / path traversal).
function nombreArchivoSeguro(s) {
    return String(s || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 120);
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
        imagenArchivo: nombreArchivoSeguro(e.imagenArchivo),
        miniaturaUrl: String(e.miniaturaUrl || '').slice(0, 500),
        miniaturaArchivo: nombreArchivoSeguro(e.miniaturaArchivo),
        autorNombre: String(e.autorNombre || '').slice(0, 256),
        footer: String(e.footer || '').slice(0, 2048),
        fecha: !!e.fecha,
        campos,
    };
}

// ¿El embed tiene algo que mostrar?
function embedTieneContenido(e) {
    if (!e) return false;
    return !!(e.titulo || e.descripcion || e.imagenUrl || e.imagenArchivo
        || e.miniaturaUrl || e.miniaturaArchivo || e.autorNombre || e.footer
        || (Array.isArray(e.campos) && e.campos.length));
}

// Construye el EmbedBuilder de discord.js SIN las imágenes (esas las pone
// construirMensaje, que también gestiona los adjuntos). Null si no hay contenido.
function construirEmbed(e) {
    if (!embedTieneContenido(e)) return null;
    const embed = new EmbedBuilder();
    if (e.titulo) embed.setTitle(String(e.titulo).slice(0, 256));
    if (e.descripcion) embed.setDescription(String(e.descripcion).slice(0, 4096));
    const color = normalizarColor(e.color);
    if (color !== null) embed.setColor(color);
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

// Aplica una imagen al embed: si hay archivo subido (y existe), lo adjunta y lo
// referencia con attachment://; si no, usa la URL externa si es http(s).
function aplicarImagen(embed, metodo, archivo, url, uploadsDir, files) {
    const nombre = nombreArchivoSeguro(archivo);
    if (nombre && uploadsDir) {
        const ruta = path.join(uploadsDir, nombre);
        if (fs.existsSync(ruta) && !files.some((f) => f.name === nombre)) {
            embed[metodo](`attachment://${nombre}`);
            files.push(new AttachmentBuilder(ruta, { name: nombre }));
            return;
        }
    }
    if (url && /^https?:\/\//i.test(url)) embed[metodo](url);
}

// Arma el payload de un mensaje: { content?, embeds?, files? }. Vacío si no hay nada.
// `uploadsDir` (opcional) es la carpeta de /uploads para adjuntar imágenes subidas.
function construirMensaje(contenido, embedCfg, uploadsDir) {
    const payload = {};
    const txt = String(contenido || '').slice(0, 2000);
    if (txt) payload.content = txt;
    const embed = construirEmbed(embedCfg);
    if (embed) {
        const files = [];
        aplicarImagen(embed, 'setImage', embedCfg && embedCfg.imagenArchivo, embedCfg && embedCfg.imagenUrl, uploadsDir, files);
        aplicarImagen(embed, 'setThumbnail', embedCfg && embedCfg.miniaturaArchivo, embedCfg && embedCfg.miniaturaUrl, uploadsDir, files);
        payload.embeds = [embed];
        if (files.length) payload.files = files;
    }
    return payload;
}

module.exports = { construirEmbed, construirMensaje, sanearEmbed, embedTieneContenido, normalizarColor };
