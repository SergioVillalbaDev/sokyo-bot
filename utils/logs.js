// Registro de auditoría: guarda en MongoDB (panel web) y, si está configurado,
// lo publica también en el canal de logs del servidor.
const { EmbedBuilder } = require('discord.js');
const Log = require('../models/Log.js');
const ServidorConfig = require('../models/ServidorConfig.js');

async function registrarLog(client, { guildId, categoria = 'General', accion, usuario = 'Sistema', detalles = '', color = '#3498db' }) {
    if (!guildId) return;
    try {
        await Log.create({ guildId, categoria, accion, usuario, detalles, color });
    } catch (e) {
        console.error('Error guardando log:', e);
        return;
    }

    if (!client) return;
    try {
        const config = await ServidorConfig.findOne({ guildId }).select('canalLogsId').lean();
        if (!config || !config.canalLogsId) return;
        const canal = client.channels.cache.get(config.canalLogsId);
        if (!canal || !canal.isTextBased()) return;
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(accion.slice(0, 256))
            .setDescription((detalles || '—').slice(0, 4000))
            .setFooter({ text: `${categoria} · ${usuario}`.slice(0, 2048) })
            .setTimestamp();
        await canal.send({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (e) { /* sin permisos en el canal de logs: no debe romper nada */ }
}

module.exports = { registrarLog };
