// Constructor de embeds reutilizable.
// Convierte un objeto plano (creado en el panel y guardado en BD) en un
// EmbedBuilder de discord.js, y arma el "payload" del mensaje (texto + embed +
// adjuntos). Lo usan: el envío de embeds desde el panel, los anuncios
// programados y las auto-respuestas en modo embed.
//
// Imágenes/iconos: pueden venir como URL externa (…Url) o como archivo subido al
// servidor (…Archivo en /uploads). Para los archivos subidos los adjuntamos al
// mensaje y los referenciamos con attachment://, así Discord los muestra aunque
// la API esté en localhost (mismo truco que utils/rolePanelManager.js).
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

const esHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

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
        tituloUrl: String(e.tituloUrl || '').slice(0, 500),
        descripcion: String(e.descripcion || '').slice(0, 4096),
        color: typeof e.color === 'string' ? e.color.slice(0, 9) : '#5865F2',
        imagenUrl: String(e.imagenUrl || '').slice(0, 500),
        imagenArchivo: nombreArchivoSeguro(e.imagenArchivo),
        miniaturaUrl: String(e.miniaturaUrl || '').slice(0, 500),
        miniaturaArchivo: nombreArchivoSeguro(e.miniaturaArchivo),
        autorNombre: String(e.autorNombre || '').slice(0, 256),
        autorUrl: String(e.autorUrl || '').slice(0, 500),
        autorIconoUrl: String(e.autorIconoUrl || '').slice(0, 500),
        autorIconoArchivo: nombreArchivoSeguro(e.autorIconoArchivo),
        footer: String(e.footer || '').slice(0, 2048),
        footerIconoUrl: String(e.footerIconoUrl || '').slice(0, 500),
        footerIconoArchivo: nombreArchivoSeguro(e.footerIconoArchivo),
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

// Resuelve una imagen/icono a una referencia usable (attachment:// o URL http),
// adjuntando el archivo subido si existe. Devuelve null si no hay nada válido.
function resolverImagenRef(archivo, url, uploadsDir, files) {
    const nombre = nombreArchivoSeguro(archivo);
    if (nombre && uploadsDir) {
        const ruta = path.join(uploadsDir, nombre);
        if (fs.existsSync(ruta)) {
            if (!files.some((f) => f.name === nombre)) files.push(new AttachmentBuilder(ruta, { name: nombre }));
            return `attachment://${nombre}`;
        }
    }
    return esHttp(url) ? url : null;
}

// Construye el EmbedBuilder con lo que NO necesita adjuntos (texto, color,
// campos, título clicable). Las imágenes/iconos los añade construirMensaje.
function construirEmbed(e) {
    if (!embedTieneContenido(e)) return null;
    const embed = new EmbedBuilder();
    if (e.titulo) {
        embed.setTitle(String(e.titulo).slice(0, 256));
        if (esHttp(e.tituloUrl)) embed.setURL(e.tituloUrl);
    }
    if (e.descripcion) embed.setDescription(String(e.descripcion).slice(0, 4096));
    const color = normalizarColor(e.color);
    if (color !== null) embed.setColor(color);
    if (e.fecha) embed.setTimestamp(new Date());
    if (Array.isArray(e.campos)) {
        for (const c of e.campos.slice(0, 25)) {
            if (!c || !c.nombre || !c.valor) continue;
            embed.addFields({ name: String(c.nombre).slice(0, 256), value: String(c.valor).slice(0, 1024), inline: !!c.inline });
        }
    }
    return embed;
}

// Arma el payload de un mensaje: { content?, embeds?, files? }. Vacío si no hay nada.
// `uploadsDir` (opcional) es la carpeta de /uploads para adjuntar imágenes subidas.
function construirMensaje(contenido, e, uploadsDir) {
    const payload = {};
    const txt = String(contenido || '').slice(0, 2000);
    if (txt) payload.content = txt;
    const embed = construirEmbed(e);
    if (embed) {
        const files = [];
        const img = resolverImagenRef(e && e.imagenArchivo, e && e.imagenUrl, uploadsDir, files);
        if (img) embed.setImage(img);
        const thumb = resolverImagenRef(e && e.miniaturaArchivo, e && e.miniaturaUrl, uploadsDir, files);
        if (thumb) embed.setThumbnail(thumb);
        if (e && e.autorNombre) {
            const opt = { name: String(e.autorNombre).slice(0, 256) };
            if (esHttp(e.autorUrl)) opt.url = e.autorUrl;
            const ic = resolverImagenRef(e.autorIconoArchivo, e.autorIconoUrl, uploadsDir, files);
            if (ic) opt.iconURL = ic;
            embed.setAuthor(opt);
        }
        if (e && e.footer) {
            const opt = { text: String(e.footer).slice(0, 2048) };
            const ic = resolverImagenRef(e.footerIconoArchivo, e.footerIconoUrl, uploadsDir, files);
            if (ic) opt.iconURL = ic;
            embed.setFooter(opt);
        }
        payload.embeds = [embed];
        if (files.length) payload.files = files;
    }
    return payload;
}

module.exports = { construirEmbed, construirMensaje, sanearEmbed, embedTieneContenido, normalizarColor };
