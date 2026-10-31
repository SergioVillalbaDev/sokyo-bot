// Migración: copia a almacenamiento propio (uploads/) las imágenes de los mensajes antiguos
// que todavía apuntan al CDN de Discord, cuyas URLs firmadas caducan a las ~24 h.
//
// Uso (desde la raíz del bot, con el .env configurado):
//   npm run migrar-adjuntos              -> descarga las imágenes y actualiza Mensaje.imagenes
//   npm run migrar-adjuntos -- --dry-run -> solo muestra cuántas se migrarían, sin tocar nada
//
// Las URLs caducadas se renuevan antes de descargarlas con POST /attachments/refresh-urls
// de la API de Discord (usa DISCORD_TOKEN). Se puede ejecutar varias veces sin problema:
// los mensajes ya migrados no vuelven a procesarse.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Mensaje = require('../models/Mensaje.js');
const { guardarImagenDesdeUrl, datosAdjuntoDiscord, EXTENSIONES_VALIDAS, UPLOADS_DIR } = require('../utils/adjuntos.js');

const DRY_RUN = process.argv.includes('--dry-run');
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const URL_REFRESCO = 'https://discord.com/api/v10/attachments/refresh-urls';
const MAX_URLS_POR_PETICION = 50;
const MAX_REINTENTOS = 5;

const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Solo migramos URLs de adjuntos de Discord cuyo nombre tiene extensión de imagen admitida.
function esCandidata(url) {
    const datos = datosAdjuntoDiscord(url);
    if (!datos) return false;
    const ext = path.extname(datos.nombre).slice(1).toLowerCase();
    return EXTENSIONES_VALIDAS.includes(ext === 'jpeg' ? 'jpg' : ext);
}

// Pide a Discord URLs nuevas para hasta 50 adjuntos. Devuelve [{ original, refreshed }].
async function refrescarLote(urls) {
    for (let intento = 1; intento <= MAX_REINTENTOS; intento++) {
        const res = await fetch(URL_REFRESCO, {
            method: 'POST',
            headers: { Authorization: `Bot ${DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ attachment_urls: urls })
        });
        if (res.status === 429) {
            const { retry_after: segundos = 1 } = await res.json().catch(() => ({}));
            console.warn(`⏳ Rate limit de Discord: esperando ${segundos}s...`);
            await esperar(segundos * 1000 + 250);
            continue;
        }
        if (!res.ok) throw new Error(`Discord respondió ${res.status}: ${await res.text()}`);
        const datos = await res.json();
        return Array.isArray(datos.refreshed_urls) ? datos.refreshed_urls : [];
    }
    throw new Error('Demasiados reintentos por rate limit');
}

// Devuelve un Map url original -> url renovada. Si un lote falla, sus URLs se quedan sin renovar
// (se intentará descargar la original, que sigue funcionando si aún no ha caducado).
async function refrescarUrls(urls) {
    const renovadas = new Map();
    if (!DISCORD_TOKEN) return renovadas;
    for (let i = 0; i < urls.length; i += MAX_URLS_POR_PETICION) {
        const lote = urls.slice(i, i + MAX_URLS_POR_PETICION);
        try {
            for (const { original, refreshed } of await refrescarLote(lote)) {
                if (original && refreshed) renovadas.set(original, refreshed);
            }
        } catch (error) {
            console.error(`❌ No se pudieron renovar ${lote.length} URLs:`, error.message);
        }
    }
    return renovadas;
}

async function procesarGrupo(mensajes, totales) {
    const urls = [...new Set(mensajes.flatMap(m => m.imagenes.filter(esCandidata)))];
    const renovadas = await refrescarUrls(urls);

    for (const msg of mensajes) {
        let cambiado = false;
        const nuevas = [];
        for (const url of msg.imagenes) {
            if (!esCandidata(url)) { nuevas.push(url); continue; }
            const { attachmentId } = datosAdjuntoDiscord(url);
            try {
                nuevas.push(await guardarImagenDesdeUrl({ ticketId: msg.ticketId, attachmentId, url: renovadas.get(url) || url }));
                cambiado = true;
                totales.migradas++;
            } catch (error) {
                console.error(`❌ Mensaje ${msg._id}, adjunto ${attachmentId}: ${error.message}. Se mantiene la URL de Discord.`);
                nuevas.push(url);
                totales.fallidas++;
            }
        }
        if (cambiado) await Mensaje.updateOne({ _id: msg._id }, { $set: { imagenes: nuevas } });
    }
}

async function main() {
    if (!process.env.MONGO_URI) throw new Error('Falta MONGO_URI en el .env');
    if (!DISCORD_TOKEN && !DRY_RUN) {
        console.warn('⚠️  DISCORD_TOKEN no definido: no se pueden renovar URLs, solo se migrarán las que aún no hayan caducado.');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`🟢 Conectado a MongoDB. Carpeta de destino: ${UPLOADS_DIR}${DRY_RUN ? ' (modo --dry-run)' : ''}`);

    const totales = { mensajes: 0, candidatas: 0, migradas: 0, fallidas: 0 };
    const cursor = Mensaje.find({ imagenes: { $regex: '^https://(cdn\\.discordapp\\.com|media\\.discordapp\\.net)/attachments/' } })
        .select({ ticketId: 1, imagenes: 1 })
        .lean()
        .cursor();

    // Agrupamos mensajes para renovar sus URLs en lotes de hasta 50.
    let grupo = [];
    let enGrupo = 0;
    for await (const msg of cursor) {
        const candidatas = msg.imagenes.filter(esCandidata).length;
        if (!candidatas) continue;
        totales.mensajes++;
        totales.candidatas += candidatas;
        if (DRY_RUN) continue;
        grupo.push(msg);
        enGrupo += candidatas;
        if (enGrupo >= MAX_URLS_POR_PETICION) {
            await procesarGrupo(grupo, totales);
            grupo = [];
            enGrupo = 0;
        }
    }
    if (grupo.length) await procesarGrupo(grupo, totales);

    if (DRY_RUN) {
        console.log(`🔎 ${totales.candidatas} imágenes de Discord en ${totales.mensajes} mensajes se migrarían.`);
    } else {
        console.log(`✅ Migradas ${totales.migradas} de ${totales.candidatas} imágenes (${totales.mensajes} mensajes). Fallidas: ${totales.fallidas}.`);
    }
    return totales;
}

main()
    .then(totales => { process.exitCode = totales.fallidas > 0 ? 1 : 0; })
    .catch(error => { console.error('🔴 Error en la migración:', error); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
