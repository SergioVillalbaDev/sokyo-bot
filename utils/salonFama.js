// Salón de la fama: cuando un mensaje llega a X reacciones con el emoji elegido
// (⭐ por defecto), el bot lo copia al canal del salón con un botón para ir al
// original. Si sigue sumando, se actualiza el número. Se engancha desde
// events/messageReactionAdd.js y messageReactionRemove.js.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const SalonFama = require('../models/SalonFama.js');
const { getConfigCached } = require('./config.js');
const { t } = require('./i18n.js');

const ESPERA_EDICION = 2500;            // varias reacciones seguidas: una sola edición
const pendientes = new Map();           // mensajeId -> temporizador

// ¿Es la reacción el emoji del salón? Acepta '⭐' o uno del servidor '<:nombre:id>'.
function esEmojiDelSalon(emoji, configurado = '⭐') {
    const propio = String(configurado || '⭐').match(/<a?:\w+:(\d+)>/);
    if (propio) return emoji.id === propio[1];
    const limpio = (s) => String(s || '').replace(/️/g, '');
    return !emoji.id && limpio(emoji.name) === limpio(configurado);
}

// Estrellas que cuentan (sin la del autor, si así se ha configurado).
async function contarEstrellas(reaction, message, sf) {
    let n = reaction.count || 0;
    if (!sf.propios && n > 0 && message.author) {
        const usuarios = await reaction.users.fetch().catch(() => null);
        if (usuarios && usuarios.has(message.author.id)) n--;
    }
    return n;
}

function construir(message, n, emoji, idioma) {
    const embed = new EmbedBuilder()
        .setColor('#fbbf24')
        .setAuthor({ name: (message.member?.displayName || message.author?.username || '?').slice(0, 256), iconURL: message.author?.displayAvatarURL({ size: 64 }) || undefined })
        .setTimestamp(message.createdAt || new Date())
        .setFooter({ text: `#${message.channel?.name || ''}`.slice(0, 2048) });
    if (message.content) embed.setDescription(message.content.slice(0, 4000));
    const imagen = message.attachments.find((a) => (a.contentType || '').startsWith('image/'))
        || message.embeds.find((e) => e.image || e.thumbnail);
    if (imagen) embed.setImage(imagen.url || imagen.image?.url || imagen.thumbnail?.url);
    else if (!message.content && message.attachments.size) embed.setDescription(t(idioma, `📎 ${message.attachments.first().name}`, `📎 ${message.attachments.first().name}`));
    const boton = new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(message.url).setLabel(t(idioma, 'Ir al mensaje', 'Go to the message'));
    return {
        content: `${emoji} **${n}** · <#${message.channelId}>`,
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(boton)],
        allowedMentions: { parse: [] },
    };
}

async function alReaccionar(reaction, user, client) {
    const message = reaction.message;
    if (!message.guildId) return;
    const cfg = await getConfigCached(message.guildId);
    const sf = cfg?.salonFama;
    if (!sf?.activo || !sf.canalId) return;
    if (!esEmojiDelSalon(reaction.emoji, sf.emoji)) return;
    if (message.channelId === sf.canalId || (sf.canalesExentos || []).includes(message.channelId)) return;
    if (message.partial) await message.fetch().catch(() => null);
    if (!message.author || message.author.id === client.user.id) return;
    const salon = message.guild.channels.cache.get(sf.canalId);
    if (!salon || !salon.isTextBased()) return;
    // Lo de un canal +18 no sale en un salón que no lo es.
    if (message.channel?.nsfw && !salon.nsfw) return;

    // Varias estrellas seguidas: se espera un momento y se cuenta una sola vez.
    clearTimeout(pendientes.get(message.id));
    pendientes.set(message.id, setTimeout(() => {
        pendientes.delete(message.id);
        actualizar(reaction, message, salon, sf, cfg).catch((e) => console.error('Salón de la fama:', e.message));
    }, ESPERA_EDICION));
}

async function actualizar(reaction, message, salon, sf, cfg) {
    const fresca = message.reactions.cache.get(reaction.emoji.id || reaction.emoji.name) || reaction;
    const n = await contarEstrellas(fresca, message, sf);
    const minimo = Math.max(1, sf.minimo || 3);
    const emoji = sf.emoji || '⭐';
    const existente = await SalonFama.findOne({ mensajeId: message.id });

    if (existente) {
        if (existente.estrellas === n) return;
        existente.estrellas = n;
        await existente.save();
        const copia = existente.publicadoId ? await salon.messages.fetch(existente.publicadoId).catch(() => null) : null;
        if (copia) await copia.edit(construir(message, n, emoji, cfg)).catch(() => {});
        return;
    }
    if (n < minimo) return;
    // Solo uno publica la copia aunque lleguen dos reacciones a la vez.
    const antes = await SalonFama.findOneAndUpdate(
        { mensajeId: message.id },
        { $setOnInsert: { guildId: message.guildId, canalId: message.channelId, autorId: message.author.id, estrellas: n, fecha: new Date() } },
        { upsert: true, returnDocument: 'before' },
    ).catch(() => 'duplicado');
    if (antes) return;
    const copia = await salon.send(construir(message, n, emoji, cfg)).catch(() => null);
    if (copia) await SalonFama.updateOne({ mensajeId: message.id }, { $set: { publicadoId: copia.id } });
    else await SalonFama.deleteOne({ mensajeId: message.id }); // no se pudo publicar: se reintenta con la siguiente estrella
}

// Para el panel: los últimos mensajes del salón con su enlace.
async function ultimos(guildId, limite = 30) {
    return SalonFama.find({ guildId, publicadoId: { $ne: null } }).sort({ fecha: -1 }).limit(limite).lean();
}

module.exports = { alReaccionar, esEmojiDelSalon, construir, ultimos };
