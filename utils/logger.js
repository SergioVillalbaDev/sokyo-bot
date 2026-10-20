// Registro de auditoría: guarda el evento en MongoDB (pestaña "Auditoría" del panel)
// y, si el servidor tiene un canal de logs configurado, lo publica también allí.
const { EmbedBuilder } = require('discord.js');
const Log = require('../models/Log.js');
const { obtenerConfig } = require('./config.js');
const { truncar } = require('./texto.js');

async function registrarLog(client, { guildId, categoria = 'General', accion, usuario, usuarioId = null, detalles = '', color = '#3498db' }) {
    if (!guildId) return null;
    try {
        const log = await Log.create({ guildId, categoria, accion, usuario: usuario || 'Sistema', usuarioId, detalles, color });

        const config = await obtenerConfig(guildId);
        const canal = config.canalLogsId && client?.channels.cache.get(config.canalLogsId);
        if (canal?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(truncar(accion, 256))
                .setFooter({ text: truncar(`${categoria} · ${usuario || 'Sistema'}`, 2048) })
                .setTimestamp(log.fecha);
            if (detalles) embed.setDescription(truncar(detalles, 4000));
            await canal.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
        }
        return log;
    } catch (error) {
        console.error('Error registrando log:', error);
        return null;
    }
}

module.exports = { registrarLog };
