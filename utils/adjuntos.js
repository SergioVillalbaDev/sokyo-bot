// Almacenamiento propio de las imágenes adjuntas de los tickets.
//
// Las URLs de adjuntos del CDN de Discord van firmadas (?ex=&is=&hm=) y caducan a las ~24 h.
// Por eso, al guardar un mensaje de ticket descargamos sus imágenes a disco
// (uploads/<ticketId>/<attachmentId>.<ext>) y en Mensaje.imagenes guardamos una URL propia
// de la API (/api/adjuntos/<ticketId>/<archivo>), que api/server.js sirve con autenticación.
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads'));
const TAMANO_MAXIMO = (Number(process.env.ADJUNTOS_MAX_MB) || 8) * 1024 * 1024;
const TIMEOUT_DESCARGA_MS = 20_000;

// Tipos de imagen que guardamos (contentType -> extensión). SVG queda fuera a propósito:
// puede contener scripts y no queremos servirlo desde nuestro propio origen.
const EXTENSIONES = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif'
};
const EXTENSIONES_VALIDAS = [...new Set(Object.values(EXTENSIONES))];

const PREFIJO_STAFF = '/api/adjuntos/';
const RE_ID = /^\d{1,25}$/; // snowflakes de Discord (id de canal / id de adjunto)
const RE_ARCHIVO = new RegExp(`^\\d{1,25}\\.(${EXTENSIONES_VALIDAS.join('|')})$`);
const RE_URL_PROPIA = /^\/api\/adjuntos\/(\d{1,25})\/([^/]+)$/;

const tipoBase = (contentType) => (contentType || '').split(';')[0].trim().toLowerCase();

// Extensión con la que se guarda un tipo de imagen, o null si ese tipo no se guarda.
const extensionDe = (contentType) => EXTENSIONES[tipoBase(contentType)] || null;

// Ruta en disco de un adjunto guardado, o null si los parámetros no son válidos
// (evita path traversal: solo ids numéricos y extensiones de la lista).
function rutaAdjunto(ticketId, archivo) {
    if (!RE_ID.test(String(ticketId)) || !RE_ARCHIVO.test(String(archivo))) return null;
    return path.join(UPLOADS_DIR, String(ticketId), String(archivo));
}

// URL propia (la que se guarda en Mensaje.imagenes y usa el panel de staff).
const urlPropia = (ticketId, archivo) => `${PREFIJO_STAFF}${ticketId}/${archivo}`;

// La misma imagen vista desde el Portal del Cliente (ruta protegida por sesión + propiedad).
// Las URLs que no son propias (p. ej. respaldo de Discord) se devuelven sin tocar.
function urlParaPortal(url) {
    const m = typeof url === 'string' && url.match(RE_URL_PROPIA);
    return m ? `/api/portal/tickets/${m[1]}/adjuntos/${m[2]}` : url;
}

// Descarga `url` cortando si supera `maxBytes` o tarda demasiado. Devuelve { buffer, contentType }.
async function descargar(url, maxBytes = TAMANO_MAXIMO) {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_DESCARGA_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status} al descargar`);

    const declarado = Number(res.headers.get('content-length'));
    if (declarado > maxBytes) {
        await res.body?.cancel().catch(() => {});
        throw new Error(`supera el tamaño máximo (${declarado} bytes)`);
    }

    // Leemos por trozos por si no viene content-length (o miente).
    const trozos = [];
    let total = 0;
    for await (const trozo of res.body) {
        total += trozo.length;
        if (total > maxBytes) throw new Error(`supera el tamaño máximo (${maxBytes} bytes)`);
        trozos.push(trozo);
    }
    return { buffer: Buffer.concat(trozos), contentType: res.headers.get('content-type') };
}

// Descarga una imagen y la guarda en uploads/<ticketId>/<attachmentId>.<ext>.
// `contentType` es el tipo declarado por Discord; si no se pasa, se usa el de la respuesta.
// Devuelve la URL propia. Lanza un error si no se puede guardar.
async function guardarImagenDesdeUrl({ ticketId, attachmentId, url, contentType = null }) {
    const { buffer, contentType: tipoRespuesta } = await descargar(url);
    const tipo = contentType || tipoRespuesta;
    const ext = extensionDe(tipo);
    if (!ext) throw new Error(`tipo de imagen no admitido (${tipo || 'desconocido'})`);

    const archivo = `${attachmentId}.${ext}`;
    const destino = rutaAdjunto(ticketId, archivo);
    if (!destino) throw new Error(`identificadores no válidos (ticket ${ticketId}, adjunto ${attachmentId})`);

    // Escritura atómica: primero a un temporal y luego rename, para no servir nunca un archivo a medias.
    await fs.promises.mkdir(path.dirname(destino), { recursive: true });
    const temporal = `${destino}.${process.pid}.${Date.now()}.tmp`;
    try {
        await fs.promises.writeFile(temporal, buffer);
        await fs.promises.rename(temporal, destino);
    } catch (error) {
        await fs.promises.unlink(temporal).catch(() => {});
        throw error;
    }
    return urlPropia(ticketId, archivo);
}

// Convierte los adjuntos de un mensaje de Discord en las URLs a guardar en Mensaje.imagenes.
// Las imágenes se copian a almacenamiento propio; los demás adjuntos, y las imágenes que no se
// puedan guardar, se quedan con la URL de Discord como respaldo (registrando el motivo).
async function persistirAdjuntos(message) {
    const ticketId = message.channel.id;
    return Promise.all([...message.attachments.values()].map(async (adjunto) => {
        const tipo = tipoBase(adjunto.contentType);
        if (!tipo.startsWith('image/')) return adjunto.url;

        let motivo;
        if (!extensionDe(tipo)) motivo = `tipo de imagen no admitido (${tipo})`;
        else if (adjunto.size > TAMANO_MAXIMO) motivo = `supera el tamaño máximo (${adjunto.size} bytes)`;
        else {
            try {
                return await guardarImagenDesdeUrl({ ticketId, attachmentId: adjunto.id, url: adjunto.url, contentType: tipo });
            } catch (error) {
                motivo = error.message;
            }
        }
        console.error(`❌ No se pudo guardar la imagen ${adjunto.id} (${adjunto.name}) del ticket ${ticketId}: ${motivo}. Se guarda la URL de Discord como respaldo.`);
        return adjunto.url;
    }));
}

// Datos de una URL de adjunto del CDN de Discord, o null si no lo es.
// Formato: https://cdn.discordapp.com/attachments/<canalId>/<attachmentId>/<nombre>?ex=..&is=..&hm=..
function datosAdjuntoDiscord(url) {
    let u;
    try { u = new URL(url); } catch { return null; }
    if (!['cdn.discordapp.com', 'media.discordapp.net'].includes(u.hostname)) return null;
    const m = u.pathname.match(/^\/attachments\/(\d+)\/(\d+)\/([^/]+)$/);
    if (!m) return null;
    let nombre = m[3];
    try { nombre = decodeURIComponent(nombre); } catch { /* se deja tal cual */ }
    return { canalId: m[1], attachmentId: m[2], nombre };
}

module.exports = {
    UPLOADS_DIR,
    TAMANO_MAXIMO,
    EXTENSIONES_VALIDAS,
    rutaAdjunto,
    urlPropia,
    urlParaPortal,
    guardarImagenDesdeUrl,
    persistirAdjuntos,
    datosAdjuntoDiscord
};
