const { EmbedBuilder } = require('discord.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const { getConfigCached } = require('../utils/config.js');

module.exports = {
    name: 'ranking',
    description: 'Show the server’s level leaderboard. Usage: !ranking',

    async execute(message) {
        const cfg = await getConfigCached(message.guild.id);
        if (!cfg?.nivelesActivo) return message.reply('ℹ️ The leveling system isn’t enabled on this server.');

        const top = await ActividadUsuario.find({ guildId: message.guild.id, xp: { $gt: 0 } }).sort({ xp: -1 }).limit(10);
        if (top.length === 0) return message.reply('No activity recorded for the leaderboard yet.');

        const medallas = ['🥇', '🥈', '🥉'];
        const lineas = top.map((u, i) => {
            const pos = medallas[i] || `**${i + 1}.**`;
            return `${pos} <@${u.userId}> — Level **${u.nivel}** · ${u.xp} XP`;
        });

        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle(`🏆 ${message.guild.name} leaderboard`)
            .setDescription(lineas.join('\n'));
        await message.reply({ embeds: [embed] });
    },
};
