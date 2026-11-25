// 🔔 Resumen diario por privado (1.34.0). Opcional: se enciende y apaga en /menu (menu:res). Una vez al día, a partir
// de su hora (17:00 UTC por defecto), manda por privado lo que tiene listo en ese servidor, con las mismas cuentas que
// /menu (utils/menu.js → estadoJugador y avisos). Si no hay nada que hacer, no manda nada. El privado no lleva botones
// del servidor (en privado no funcionan): dice qué hay y lleva un enlace para volver.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ResumenDiario = require('../models/ResumenDiario.js');
const { t } = require('./i18n.js');

const hoy = (ahora = Date.now()) => new Date(ahora).toISOString().slice(0, 10);

async function estado(guildId, userId) {
    const r = await ResumenDiario.findOne({ guildId, userId }).lean();
    return !!r?.activo;
}
async function alternar(guildId, userId) {
    const r = await ResumenDiario.findOne({ guildId, userId }).lean();
    const activo = !r?.activo;
    await ResumenDiario.updateOne({ guildId, userId }, { $set: { activo } }, { upsert: true });
    return activo;
}

async function pasada(client, ahora = Date.now()) {
    const dia = hoy(ahora); const hora = new Date(ahora).getUTCHours();
    const lista = await ResumenDiario.find({ activo: true, ultimo: { $ne: dia }, hora: { $lte: hora } }).limit(200).lean();
    const menu = require('./menu.js');
    const { getConfigCached } = require('./config.js');
    for (const r of lista) {
        // Se marca antes: un reinicio a mitad no lo repite.
        const m = await ResumenDiario.updateOne({ _id: r._id, ultimo: { $ne: dia } }, { $set: { ultimo: dia } });
        if (!m.modifiedCount) continue;
        const guild = client.guilds.cache.get(r.guildId);
        if (!guild) continue;
        const cfg = await getConfigCached(r.guildId).catch(() => ({})) || {};
        const idioma = await require('./preferencias.js').idiomaMiembro(r.userId, { cfg }).catch(() => 'es');
        const e = await menu.estadoJugador(r.guildId, r.userId, cfg, ahora).catch(() => null);
        if (!e) continue;
        const avisos = menu.avisos(e, r.userId, idioma);
        if (!avisos.length) continue;
        const u = await client.users.fetch(r.userId).catch(() => null);
        if (!u) continue;
        const emb = new EmbedBuilder().setColor('#a855f7').setTitle(t(idioma, `🔔 Tu resumen en ${guild.name}`, `🔔 Your summary on ${guild.name}`))
            .setDescription([...avisos.map((a) => a.texto), '', t(idioma, '👉 Escribe **/menu** en el servidor para hacerlo todo con botones.', '👉 Type **/menu** on the server to do it all with buttons.')].join('\n'))
            .setFooter({ text: t(idioma, 'Lo apagas en /menu → 🔔 Resumen diario', 'Turn it off in /menu → 🔔 Daily summary') });
        const fila = new ActionRowBuilder().addComponents(new ButtonBuilder().setURL(`https://discord.com/channels/${r.guildId}`).setEmoji('🏠').setLabel(t(idioma, 'Ir al servidor', 'Go to the server')).setStyle(ButtonStyle.Link));
        await u.send({ embeds: [emb], components: [fila] }).catch(() => {});
    }
}

module.exports = { estado, alternar, pasada };
