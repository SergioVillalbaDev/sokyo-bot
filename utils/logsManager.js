// Reenvía un log ya guardado en BD al canal de Discord configurado (si hay uno).
// Lo llaman los eventos de logs (mensajes borrados/editados, entradas/salidas,
// tickets) justo después de crear el documento en Mongo.
const { EmbedBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');

async function enviarLogADiscord(client, log) {
    try {
        const cfg = await ServidorConfig.findOne({ guildId: log.guildId });
        if (!cfg?.canalLogsId) return;
        const canal = client.channels.cache.get(cfg.canalLogsId);
        if (!canal?.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor(log.color || '#3498db')
            .setAuthor({ name: `${log.accion}${log.categoria ? ` · ${log.categoria}` : ''}` })
            .addFields({ name: 'User', value: log.usuario || 'Unknown' })
            .setTimestamp(log.fecha || Date.now());
        if (log.detalles) embed.setDescription(String(log.detalles).slice(0, 4000));

        const embeds = [embed];
        if (log.imagenes?.length) {
            embed.setImage(log.imagenes[0]);
            // Discord solo permite una imagen grande por embed: las extra van en
            // embeds adicionales (mismo mensaje), hasta un máximo razonable.
            for (const url of log.imagenes.slice(1, 4)) {
                embeds.push(new EmbedBuilder().setColor(log.color || '#3498db').setImage(url));
            }
        }
        await canal.send({ embeds }).catch(() => {});
    } catch (e) { console.error('Error enviando log a Discord:', e.message); }
}

module.exports = { enviarLogADiscord };
