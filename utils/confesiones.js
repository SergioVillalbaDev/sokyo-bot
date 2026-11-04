// Confesiones anónimas (/confesar): se publican en su canal como «Confesión #N» sin
// decir quién la ha escrito. Si hay canal de revisión, al staff le llega antes con
// «Aprobar» y «Rechazar» (tampoco ve quién es). El autor se guarda solo para
// casos de acoso: verlo desde el panel queda apuntado en el registro.
//
// Opcional (1.9.10): «Confesar escribiendo en el canal». Con `escribirEnCanal`, lo que
// alguien escribe en el canal de confesar (`canalEscrituraId`, o el de las confesiones
// si está vacío) se borra al momento y sale como confesión, igual que con /confesar
// (mismas normas y revisión). La respuesta le llega por privado. Lo llama
// events/messageCreate.js lo primero, antes del automod, la actividad y la XP, y el
// borrado no va al registro de mensajes borrados (diría quién la escribió).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, MessageType } = require('discord.js');
const Confesion = require('../models/Confesion.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { getConfigCached } = require('./config.js');
const { miembroPuedeModerar } = require('./permisos.js');
const { t } = require('./i18n.js');

const MIN = 10;
const MAX = 1500;
const ENTRE_CONFESIONES = 2 * 60 * 1000;
const ultima = new Map(); // `${guildId}:${userId}` -> momento de la última

// Canal donde escribir cuenta como confesión (o null si esa opción está apagada).
const canalEscrituraDe = (cfg) => {
    const c = cfg?.confesiones;
    return c?.escribirEnCanal && c.canalId ? (c.canalEscrituraId || c.canalId) : null;
};

// Pie de la confesión: cómo enviar la tuya. Con «escribir en el canal» también lo dice
// (`aqui`: se escribe en este mismo canal; `nombreCanal`: en otro).
function pieConfesion(cfg, { aqui = false, nombreCanal = null } = {}) {
    if (aqui) return t(cfg, 'Anónima · escribe aquí o usa /confesar para enviar la tuya', 'Anonymous · write here or use /confess to send yours');
    if (nombreCanal) return t(cfg, `Anónima · escribe en #${nombreCanal} o usa /confesar para enviar la tuya`, `Anonymous · write in #${nombreCanal} or use /confess to send yours`);
    return t(cfg, 'Anónima · escribe /confesar para enviar la tuya', 'Anonymous · use /confess to send yours');
}

const embedConfesion = (doc, cfg, pie) => new EmbedBuilder()
    .setColor('#c084fc')
    .setTitle(t(cfg, `💬 Confesión #${doc.numero}`, `💬 Confession #${doc.numero}`))
    .setDescription(doc.texto)
    .setFooter({ text: pie || pieConfesion(cfg) })
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
        const escritura = canalEscrituraDe(cfg);
        const otro = escritura && escritura !== canal.id ? guild.channels.cache.get(escritura) : null;
        const pie = pieConfesion(cfg, { aqui: escritura === canal.id, nombreCanal: otro?.name || null });
        msg = await canal.send({ embeds: [embedConfesion(doc, cfg, pie)], allowedMentions: { parse: [] } });
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

// ---------------------------------------------------------------------------
// Confesar escribiendo en el canal
// ---------------------------------------------------------------------------
// Mensajes que borra el bot al convertirlos en confesión: events/messageDelete.js no
// los apunta en el registro (diría quién la escribió). Se olvidan al minuto.
const borradosPorConfesion = new Set();
const esBorradoPorConfesion = (id) => borradosPorConfesion.has(id);

// ¿Este mensaje es una confesión escrita en su canal? (no los bots, ni los avisos de
// Discord, ni los hilos: solo mensajes normales o respuestas en ese canal).
function esMensajeDeConfesion(message, cfg) {
    const canal = canalEscrituraDe(cfg);
    if (!canal || !cfg.confesiones.activo || !message.guild) return false;
    if (message.author?.bot || message.webhookId || message.system) return false;
    if (message.type !== MessageType.Default && message.type !== MessageType.Reply) return false;
    return message.channelId === canal;
}

// Por privado al autor. Si algo ha ido mal, le devuelve su texto (su mensaje ya no está).
// Si tiene los privados cerrados y no ha salido, un aviso en el canal (en el
// idioma del servidor, sin decir quién ni por qué, y que se borra solo), para que no
// crea que ha salido.
async function avisarAutor(message, texto, original, { avisoEnCanal = true, cfg = null } = {}) {
    const cita = original ? `\n\n${original.slice(0, 1800).split('\n').map((l) => `> ${l}`).join('\n')}` : '';
    const ok = await message.author.send({ content: `${texto}${cita}`.slice(0, 2000), allowedMentions: { parse: [] } }).then(() => true, () => false);
    if (ok || !avisoEnCanal || !message.channel?.send) return;
    const aviso = await message.channel.send({
        content: t(cfg,
            '⚠️ Una confesión no se ha podido publicar y no he podido avisar por privado a quien la escribió. Si era tuya, abre los mensajes directos de este servidor para ver el motivo y escríbela otra vez.',
            '⚠️ A confession couldn’t be posted and I couldn’t DM whoever wrote it. If it was yours, open DMs from this server to see why and write it again.'),
        allowedMentions: { parse: [] },
    }).catch(() => null);
    if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 20 * 1000).unref?.();
}

async function desdeMensaje(message, cfg, idioma) {
    const original = String(message.content || '').trim();
    // Primero se borra: mientras esté, se ve quién lo ha escrito. Si no se puede, no se
    // publica (no sería anónima) y se le explica.
    borradosPorConfesion.add(message.id);
    setTimeout(() => borradosPorConfesion.delete(message.id), 60 * 1000).unref?.();
    try {
        await message.delete();
    } catch {
        borradosPorConfesion.delete(message.id);
        console.warn(`🤐 No se pudo borrar un mensaje del canal de confesar en ${message.guildId} (falta «Gestionar mensajes»): no se publica.`);
        return avisarAutor(message, t(idioma,
            '🤐 No he podido borrar tu mensaje del canal de confesiones, así que no lo he publicado como confesión (se vería que es tuyo). Avisa al staff: me falta el permiso «Gestionar mensajes» ahí. Mientras, usa /confesar.',
            '🤐 I couldn’t delete your message from the confessions channel, so I didn’t post it as a confession (it would show it’s yours). Tell the staff: I’m missing the “Manage messages” permission there. Meanwhile, use /confess.'), null, { avisoEnCanal: false }); // su mensaje sigue ahí: ya lo ve
    }
    if (!original) {
        return avisarAutor(message, t(idioma, '✍️ Las confesiones son solo de texto: escribe lo que quieras contar (sin imágenes ni stickers).', '✍️ Confessions are text only: write what you want to say (no images or stickers).'), null, { cfg });
    }
    if (original.length > MAX) {
        return avisarAutor(message, t(idioma, `✍️ Es demasiado larga (máximo ${MAX} letras). Aquí la tienes para acortarla:`, `✍️ It’s too long (${MAX} characters max). Here it is so you can shorten it:`), original, { cfg });
    }
    // Lo mismo que /confesar: un «contexto» con lo que usa enviar().
    const ctx = { guildId: message.guildId, guild: message.guild, user: message.author, client: message.client };
    let respuesta;
    try { respuesta = await enviar(ctx, cfg, original, idioma); } catch (e) {
        console.error('Confesión escrita en el canal:', e.message);
        respuesta = t(idioma, '❌ No he podido publicar tu confesión. Prueba otra vez en un momento.', '❌ I couldn’t post your confession. Try again in a moment.');
    }
    // enviar() contesta «✅ ¡Publicada…» o «📨 ¡Enviada…» cuando sale bien.
    const salio = /^(✅|📨)/.test(respuesta);
    return avisarAutor(message, respuesta, salio ? null : original, { avisoEnCanal: !salio, cfg });
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

module.exports = {
    enviar, publicar, revisar, manejarBoton, palabraProhibida, embedConfesion, pieConfesion,
    canalEscrituraDe, esMensajeDeConfesion, desdeMensaje, esBorradoPorConfesion,
};
