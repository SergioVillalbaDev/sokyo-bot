const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economia = require('../utils/economia.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily gold reward (with streak)'),

    async execute(interaction) {
        const r = await economia.reclamarDaily(interaction.user.id);

        if (!r.ok) {
            const h = Math.floor(r.esperaHoras);
            const m = Math.round((r.esperaHoras - h) * 60);
            return interaction.reply({ content: `⏳ You already claimed recently. Come back in **${h}h ${m}m**.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#f5b942')
            .setTitle('🪙 Daily reward claimed!')
            .setDescription(`You received **${r.total}** gold.${r.jackpot ? `\n🎉 Streak bonus! **+${r.jackpot}** extra for reaching ${r.racha} days.` : ''}`)
            .addFields(
                { name: 'Streak', value: `🔥 **${r.racha}** day(s) in a row`, inline: true },
                { name: 'Balance', value: `🪙 **${r.balance.toLocaleString('en-US')}**`, inline: true },
            )
            .setFooter({ text: 'Come back tomorrow to keep your streak · jackpot every 7 days' });

        await interaction.reply({ embeds: [embed] });
    },
};
