const { EmbedBuilder } = require('discord.js');
const MiembroStats = require('../models/MiembroStats.js');

module.exports = {
    name: 'nivel',
    description: 'Muestra tu nivel y XP (o el de otro usuario)',
    async execute(message) {
        const objetivo = message.mentions.users.first() || message.author;
        const stats = await MiembroStats.findOne({ guildId: message.guild.id, userId: objetivo.id });
        if (!stats) return message.reply(`📊 **${objetivo.username}** aún no tiene XP. ¡A charlar!`);

        const siguiente = Math.pow((stats.nivel + 1) * 10, 2); // XP total para el siguiente nivel
        const posicion = await MiembroStats.countDocuments({ guildId: message.guild.id, xp: { $gt: stats.xp } }) + 1;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`⭐ ${objetivo.username}`)
            .setThumbnail(objetivo.displayAvatarURL())
            .addFields(
                { name: 'Nivel', value: `${stats.nivel}`, inline: true },
                { name: 'XP', value: `${stats.xp} / ${siguiente}`, inline: true },
                { name: 'Ranking', value: `#${posicion}`, inline: true },
                { name: 'Mensajes', value: `${stats.mensajes}`, inline: true });
        await message.reply({ embeds: [embed] });
    }
};
