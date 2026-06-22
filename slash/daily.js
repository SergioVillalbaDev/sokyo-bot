const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economia = require('../utils/economia.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Reclama tu recompensa diaria de oro (con racha)'),

    async execute(interaction) {
        const r = await economia.reclamarDaily(interaction.user.id);

        if (!r.ok) {
            const h = Math.floor(r.esperaHoras);
            const m = Math.round((r.esperaHoras - h) * 60);
            return interaction.reply({ content: `⏳ Ya has reclamado hace poco. Vuelve en **${h}h ${m}m**.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#f5b942')
            .setTitle('🪙 ¡Recompensa diaria reclamada!')
            .setDescription(`Has recibido **${r.total}** de oro.${r.jackpot ? `\n🎉 ¡Premio de racha! **+${r.jackpot}** extra por llegar a ${r.racha} días.` : ''}`)
            .addFields(
                { name: 'Racha', value: `🔥 **${r.racha}** día(s) seguidos`, inline: true },
                { name: 'Saldo', value: `🪙 **${r.balance.toLocaleString('es-ES')}**`, inline: true },
            )
            .setFooter({ text: 'Vuelve mañana para no perder la racha · premio gordo cada 7 días' });

        await interaction.reply({ embeds: [embed] });
    },
};
