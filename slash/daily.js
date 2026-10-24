const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economia = require('../utils/economia.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily gold reward (with streak)'),

    async execute(interaction, client, cfg) {
        const r = await economia.reclamarDaily(interaction.user.id);

        if (!r.ok) {
            // Minutos redondeados hacia arriba antes de partir en horas: con
            // floor + round salían cosas como "19h 60m".
            const totalMin = Math.max(1, Math.ceil(r.esperaHoras * 60));
            const h = Math.floor(totalMin / 60);
            const m = totalMin % 60;
            return interaction.reply({ content: t(cfg, `⏳ Ya reclamaste tu recompensa hace poco. Vuelve en **${h}h ${m}m**.`, `⏳ You already claimed recently. Come back in **${h}h ${m}m**.`), flags: 64 });
        }

        const embed = new EmbedBuilder()
            .setColor('#f5b942')
            .setTitle(t(cfg, '🪙 ¡Recompensa diaria reclamada!', '🪙 Daily reward claimed!'))
            .setDescription(t(cfg,
                `Has recibido **${r.total}** de oro.${r.jackpot ? `\n🎉 ¡Bonus de racha! **+${r.jackpot}** extra por llegar a ${r.racha} días.` : ''}`,
                `You received **${r.total}** gold.${r.jackpot ? `\n🎉 Streak bonus! **+${r.jackpot}** extra for reaching ${r.racha} days.` : ''}`))
            .addFields(
                { name: t(cfg, 'Racha', 'Streak'), value: t(cfg, `🔥 **${r.racha}** día(s) seguidos`, `🔥 **${r.racha}** day(s) in a row`), inline: true },
                { name: t(cfg, 'Saldo', 'Balance'), value: `🪙 **${r.balance.toLocaleString('en-US')}**`, inline: true },
            )
            .setFooter({ text: t(cfg, 'Vuelve mañana para mantener tu racha · bonus cada 7 días', 'Come back tomorrow to keep your streak · jackpot every 7 days') });

        await interaction.reply({ embeds: [embed] });
    },
};
