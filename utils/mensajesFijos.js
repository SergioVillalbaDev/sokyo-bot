// Mensaje fijo abajo: en los canales que lo tienen, cada vez que alguien escribe el
// bot borra su copia anterior y la vuelve a publicar al final, para que siempre se
// vea (normas, cómo pedir ayuda…). Para no llenar el canal, espera a que paren de
// escribir unos segundos y lo hace como mucho una vez cada 10 segundos.
const { EmbedBuilder } = require('discord.js');
const MensajeFijo = require('../models/MensajeFijo.js');

const ESPERA = 4000;          // tras el último mensaje
const ENTRE_PUBLICACIONES = 10000;
const cache = new Map();       // canalId -> documento (solo los activos)
const temporizadores = new Map();
const ultimaPublicacion = new Map();
let carga = null;

function cargar() {
    if (!carga) {
        carga = MensajeFijo.find({ activo: true }).lean().then((docs) => {
            cache.clear();
            for (const d of docs) cache.set(d.canalId, d);
        }).catch((e) => { carga = null; console.error('Mensajes fijos (cargar):', e.message); });
    }
    return carga;
}

// El panel ha cambiado uno: se actualiza la memoria.
function recordar(doc) {
    if (doc && doc.activo) cache.set(doc.canalId, typeof doc.toObject === 'function' ? doc.toObject() : doc);
    else if (doc) cache.delete(doc.canalId);
}
function olvidar(canalId) { cache.delete(canalId); clearTimeout(temporizadores.get(canalId)); temporizadores.delete(canalId); }

function contenido(doc) {
    if (doc.comoEmbed) {
        const embed = new EmbedBuilder().setColor(/^#[0-9a-f]{6}$/i.test(doc.color || '') ? doc.color : '#a855f7');
        if (doc.titulo) embed.setTitle(`📌 ${doc.titulo}`.slice(0, 256));
        if (doc.texto) embed.setDescription(doc.texto.slice(0, 4000));
        return { embeds: [embed], allowedMentions: { parse: [] } };
    }
    const texto = [doc.titulo ? `📌 **${doc.titulo}**` : '📌', doc.texto || ''].filter(Boolean).join('\n');
    return { content: texto.slice(0, 2000), allowedMentions: { parse: [] } };
}

// Borra la copia anterior y publica la nueva al final del canal.
async function publicar(client, doc) {
    const canal = client.channels.cache.get(doc.canalId);
    if (!canal || !canal.isTextBased()) return null;
    if (doc.ultimoMensajeId) await canal.messages.delete(doc.ultimoMensajeId).catch(() => {});
    const msg = await canal.send(contenido(doc)).catch(() => null);
    ultimaPublicacion.set(doc.canalId, Date.now());
    const id = msg ? msg.id : null;
    await MensajeFijo.updateOne({ _id: doc._id }, { $set: { ultimoMensajeId: id } }).catch(() => {});
    const enCache = cache.get(doc.canalId);
    if (enCache) enCache.ultimoMensajeId = id;
    return msg;
}

// Para cada mensaje de un servidor (también de otros bots, pero no del nuestro).
function alMensaje(message, client) {
    if (!carga) cargar();
    const doc = cache.get(message.channelId);
    if (!doc || message.author.id === client.user.id) return;
    clearTimeout(temporizadores.get(message.channelId));
    const desdeUltima = Date.now() - (ultimaPublicacion.get(message.channelId) || 0);
    const espera = Math.max(ESPERA, ENTRE_PUBLICACIONES - desdeUltima);
    temporizadores.set(message.channelId, setTimeout(() => {
        temporizadores.delete(message.channelId);
        const actual = cache.get(message.channelId);
        if (actual) publicar(client, actual).catch((e) => console.error('Mensaje fijo:', e.message));
    }, espera));
}

// Lo quita del canal (al borrarlo o apagarlo desde el panel).
async function retirar(client, doc) {
    olvidar(doc.canalId);
    const canal = client.channels.cache.get(doc.canalId);
    if (canal && doc.ultimoMensajeId) await canal.messages.delete(doc.ultimoMensajeId).catch(() => {});
}

module.exports = { cargar, recordar, olvidar, publicar, alMensaje, retirar, contenido };
