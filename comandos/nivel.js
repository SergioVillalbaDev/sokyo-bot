const { EmbedBuilder } = require('discord.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const { progreso, adjuntoTarjeta } = require('../utils/niveles.js');
const { getConfigCached } = require('../utils/config.js');

module.exports = {
    name: 'level',
    description: 'Show your level card. Usage: !level [@user]',

    async execute(message) {
        const cfg = await getConfigCached(message.guild.id);
        if (!cfg?.nivelesActivo) return message.reply('ℹ️ The leveling system isn’t enabled on this server.');

        const target = message.mentions.users.first() || message.author;
        const member = await message.guild.members.fetch(target.id).catch(() => null);
        const dif = cfg.dificultad || 1;

        const doc = await ActividadUsuario.findOne({ guildId: message.guild.id, userId: target.id });
        const xp = doc?.xp || 0;
        const { nivel, actual, necesaria } = progreso(xp, dif);
        const rank = (await ActividadUsuario.countDocuments({ guildId: message.guild.id, xp: { $gt: xp } })) + 1;

        // Tarjeta (imagen/GIF) si está disponible.
        if (cfg.tarjetaActiva !== false) {
            const adjunto = await adjuntoTarjeta(target.id, cfg, {
                avatarURL: target.displayAvatarURL({ extension: 'png', size: 256 }),
                nombre: member ? member.displayName : target.username,
                nivel, rank, xpActual: actual, xpNecesaria: necesaria,
            });
            if (adjunto) return message.reply({ files: [adjunto] });
        }

        // Respaldo en embed.
        const llenos = Math.round((actual / necesaria) * 12);
        const barra = '█'.repeat(llenos) + '░'.repeat(12 - llenos);
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: `${target.username}’s level`, iconURL: target.displayAvatarURL() })
            .addFields(
                { name: 'Rank', value: `**#${rank}**`, inline: true },
                { name: 'Level', value: `**${nivel}**`, inline: true },
                { name: 'Total XP', value: `**${xp}**`, inline: true },
                { name: 'Progress', value: `${barra}\n${actual} / ${necesaria} XP` },
            );
        await message.reply({ embeds: [embed] });
    },
};
