// Confesiones anónimas (/confesar): se publican en su canal como «Confesión #N» sin
// decir quién la ha escrito. Si hay canal de revisión, al staff le llega antes con
// «Aprobar» y «Rechazar» (tampoco ve quién es). El autor se guarda solo para
// casos de acoso: verlo desde el panel queda apuntado en el registro.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const Confesion = require('../models/Confesion.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { getConfigCached } = require('./config.js');
const { miembroPuedeModerar } = require('./permisos.js');
const { t } = require('./i18n.js');

const MIN = 10;
const MAX = 1500;
const ENTRE_CONFESIONES = 2 * 60 * 1000;
const ultima = new Map(); // `${guildId}:${userId}` -> momento de la última

const embedConfesion = (doc, cfg) => new EmbedBuilder()
    .setColor('#c084fc')
    .setTitle(t(cfg, `💬 Confesión #${doc.numero}`, `💬 Confession #${doc.numero}`))
    .setDescription(doc.texto)
    .setFooter({ text: t(cfg, 'Anónima · escribe /confesar para enviar la tuya', 'Anonymous · use /confess to send yours') })
    .setTimestamp(doc.fecha);

// ¿El texto lleva alguna palabra prohibida del automoderador?
function palabraProhibida(texto, cfg) {
    const p = cfg?.automod?.activo && cfg.automod.palabras;
    if (!p?.activo || !p.lista?.length) return null;
    const bajo = texto.toLowerCase();
    return p.lista.find((w) => w && bajo.includes(String(w).toLowerCase())) || null;
}

async function publicar(client, doc, cfg) {
    const guild = client.guilds.cache.get(doc.guildId);
    const canal = guild && cfg?.confesiones?.canalId ? guild.channels.cache.get(cfg.confesiones.canalId) : null;
    if (!canal || !canal.isTextBased()) throw new Error(t(cfg, 'El canal de las confesiones no existe', 'The confessions channel doesn’t exist'));
    // El número se da al publicarla, así las rechazadas no dejan huecos. Se reserva
    // antes de enviar; si ya estuviera cogido (p. ej. tras restaurar una copia de la
    // configuración), el contador salta al último usado y se prueba otra vez.
    for (let intento = 0; ; intento++) {
        const r = await ServidorConfig.findOneAndUpdate({ guildId: doc.guildId }, { $inc: { 'confesiones.ultimoNumero': 1 } }, { returnDocument: 'after' });
        doc.numero = r.confesiones.ultimoNumero;
        try { await doc.save(); break; } catch (e) {
            if (e.code !== 11000 || intento >= 3) throw e;
            const ultima = await Confesion.findOne({ guildId: doc.guildId, numero: { $type: 'number' } }).sort({ numero: -1 }).select('numero').lean();
            await ServidorConfig.updateOne({ guildId: doc.guildId }, { $max: { 'confesiones.ultimoNumero': ultima ? ultima.numero : 0 } });
        }
    }
    let msg;
    try {
        msg = await canal.send({ embeds: [embedConfesion(doc, cfg)], allowedMentions: { parse: [] } });
    } catch (e) {
        doc.numero = null; // no ha salido: se queda sin número para reintentarlo
        await doc.save().catch(() => {});
        throw e;
    }
    doc.estado = 'publicada';
    doc.mensajeId = msg.id;
    await doc.save();
    return msg;
}

// /confesar texto
async function enviar(interaction, cfg, texto, idioma) {
    const c = cfg?.confesiones;
    if (!c?.activo || !c.canalId) return t(idioma, '🤐 Las confesiones no están activadas en este servidor.', '🤐 Confessions aren’t turned on on this server.');
    texto = String(texto || '').trim();
    if (texto.length < MIN) return t(idioma, `✍️ Escribe un poco más (al menos ${MIN} letras).`, `✍️ Write a bit more (at least ${MIN} characters).`);
    const k = `${interaction.guildId}:${interaction.user.id}`;
    const espera = ENTRE_CONFESIONES - (Date.now() - (ultima.get(k) || 0));
    if (espera > 0) return t(idioma, `⏳ Espera ${Math.ceil(espera / 1000)} s antes de enviar otra.`, `⏳ Wait ${Math.ceil(espera / 1000)} s before sending another one.`);
    if (palabraProhibida(texto, cfg)) return t(idioma, '🚫 Tu confesión lleva palabras que no se permiten en este servidor.', '🚫 Your confession contains words that aren’t allowed on this server.');
    ultima.set(k, Date.now());
    if (ultima.size > 5000) ultima.clear();

    const doc = await Confesion.create({ guildId: interaction.guildId, autorId: interaction.user.id, texto: texto.slice(0, MAX) });
    const revision = c.canalRevisionId ? interaction.guild.channels.cache.get(c.canalRevisionId) : null;
    if (revision && revision.isTextBased()) {
        const embed = new EmbedBuilder()
            .setColor('#fbbf24')
            .setTitle(t(cfg, '💬 Confesión para revisar', '💬 Confession to review'))
            .setDescription(doc.texto)
            .setFooter({ text: t(cfg, 'Es anónima: nadie ve quién la ha escrito', 'It’s anonymous: nobody sees who wrote it') });
        const fila = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`conf_ok:${doc._id}`).setStyle(ButtonStyle.Success).setEmoji('✅').setLabel(t(cfg, 'Publicar', 'Publish')),
            new ButtonBuilder().setCustomId(`conf_no:${doc._id}`).setStyle(ButtonStyle.Danger).setEmoji('🗑️').setLabel(t(cfg, 'Rechazar', 'Reject')),
        );
        const msg = await revision.send({ embeds: [embed], components: [fila], allowedMentions: { parse: [] } }).catch(() => null);
        if (msg) {
            doc.revisionCanalId = revision.id;
            doc.revisionMensajeId = msg.id;
            await doc.save();
            return t(idioma, '📨 ¡Enviada! El staff la revisará antes de publicarla. Nadie sabrá que es tuya.', '📨 Sent! The staff will review it before it’s posted. Nobody will know it’s yours.');
        }
    }
    await publicar(interaction.client, doc, cfg);
    return t(idioma, `✅ ¡Publicada como confesión #${doc.numero}! Nadie sabrá que es tuya.`, `✅ Posted as confession #${doc.numero}! Nobody will know it’s yours.`);
}

// Aprobar o rechazar (desde Discord o desde el panel). Devuelve { ok, error }.
async function revisar(client, id, aprobar, revisor) {
    // La primera persona que la revisa se la queda: si dos pulsan a la vez, solo vale una.
    const doc = await Confesion.findOneAndUpdate({ _id: id, estado: 'pendiente', revisadoPor: null }, { $set: { revisadoPor: revisor } }, { returnDocument: 'after' });
    if (!doc) return { ok: false, error: 'ya' };
    const cfg = await getConfigCached(doc.guildId);
    if (aprobar) {
        try { await publicar(client, doc, cfg); } catch (e) {
            await Confesion.updateOne({ _id: doc._id, estado: 'pendiente' }, { $set: { revisadoPor: null } }).catch(() => {}); // que se pueda reintentar
            return { ok: false, error: e.message };
        }
    } else {
        doc.estado = 'rechazada';
        await doc.save();
    }
    // El aviso al staff se queda sin botones y dice qué se hizo.
    const canal = doc.revisionCanalId ? client.channels.cache.get(doc.revisionCanalId) : null;
    const aviso = canal && doc.revisionMensajeId ? await canal.messages.fetch(doc.revisionMensajeId).catch(() => null) : null;
    if (aviso) {
        const embed = EmbedBuilder.from(aviso.embeds[0] || {})
            .setColor(aprobar ? '#22c55e' : '#ef4444')
            .setTitle(aprobar ? t(cfg, `✅ Publicada como #${doc.numero} por ${revisor}`, `✅ Posted as #${doc.numero} by ${revisor}`) : t(cfg, `🗑️ Rechazada por ${revisor}`, `🗑️ Rejected by ${revisor}`));
        await aviso.edit({ embeds: [embed], components: [] }).catch(() => {});
    }
    return { ok: true, doc };
}

async function manejarBoton(interaction, client) {
    const [accion, id] = interaction.customId.split(':');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    if (!miembroPuedeModerar(interaction.member, cfg, PermissionsBitField.Flags.ManageMessages)) {
        return interaction.reply({ content: t(cfg, '❌ Solo el staff puede revisar las confesiones.', '❌ Only the staff can review confessions.'), flags: 64 });
    }
    await interaction.deferUpdate();
    const r = await revisar(client, id, accion === 'conf_ok', interaction.user.username);
    if (!r.ok) await interaction.followUp({ content: r.error === 'ya' ? t(cfg, 'Otra persona del staff ya la ha revisado.', 'Someone else on the staff already reviewed it.') : `❌ ${r.error}`, flags: 64 }).catch(() => {});
}

module.exports = { enviar, publicar, revisar, manejarBoton, palabraProhibida, embedConfesion };
