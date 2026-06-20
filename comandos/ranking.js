const { EmbedBuilder } = require('discord.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const { getConfigCached } = require('../utils/config.js');

module.exports = {
    name: 'ranking',
    description: 'Muestra el ranking de niveles del servidor. Uso: !ranking',

    async execute(message) {
        const cfg = await getConfigCached(message.guild.id);
        if (!cfg?.nivelesActivo) return message.reply('ℹ️ El sistema de niveles no está activado en este servidor.');

        const top = await ActividadUsuario.find({ guildId: message.guild.id, xp: { $gt: 0 } }).sort({ xp: -1 }).limit(10);
        if (top.length === 0) return message.reply('Aún no hay actividad registrada para el ranking.');

        const medallas = ['🥇', '🥈', '🥉'];
        const lineas = top.map((u, i) => {
            const pos = medallas[i] || `**${i + 1}.**`;
            return `${pos} <@${u.userId}> — Nivel **${u.nivel}** · ${u.xp} XP`;
        });

        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle(`🏆 Ranking de ${message.guild.name}`)
            .setDescription(lineas.join('\n'));
        await message.reply({ embeds: [embed] });
    },
};
