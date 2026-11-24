const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, InteractionContextType, AttachmentBuilder } = require('discord.js');
const economia = require('../utils/economia.js');
const { t } = require('../utils/i18n.js');
const { botonWeb } = require('../utils/cuenta.js');
const ES = (v) => ({ 'es-ES': v, 'es-419': v }); // nombres y textos en español

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setNameLocalizations(ES('diario'))
        .setDescription('Claim your daily gold reward (with streak)')
        .setDescriptionLocalizations(ES('Recoge tu oro de cada día (con racha)'))
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        const r = await economia.en(interaction.guildId).reclamarDaily(interaction.user.id);

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
                `Has recibido **${r.total}** de oro.${r.jackpot ? `\n🎉 ¡Bonus de racha! **+${r.jackpot}** extra por llegar a ${r.racha} días.` : ''}${r.extraCompa ? `\n🐾 Tu compañero te trae **+${r.extraCompa}** más.` : ''}`,
                `You received **${r.total}** gold.${r.jackpot ? `\n🎉 Streak bonus! **+${r.jackpot}** extra for reaching ${r.racha} days.` : ''}${r.extraCompa ? `\n🐾 Your companion brings you **+${r.extraCompa}** more.` : ''}`))
            .addFields(
                { name: t(cfg, 'Racha', 'Streak'), value: t(cfg, `🔥 **${r.racha}** día(s) seguidos`, `🔥 **${r.racha}** day(s) in a row`), inline: true },
                { name: t(cfg, 'Saldo', 'Balance'), value: `🪙 **${r.balance.toLocaleString('en-US')}**`, inline: true },
            )
            .setFooter({ text: t(cfg, 'Vuelve mañana para mantener tu racha · bonus cada 7 días', 'Come back tomorrow to keep your streak · jackpot every 7 days') });

        // 1.31.0: tarjeta con el oro, la semana de la racha en casillas y tu saldo.
        const png = require('../utils/arteVistas.js').tarjetaDiario({
            total: r.total, racha: r.racha, bote: r.jackpot || 0, extra: r.extraCompa || 0, saldo: r.balance, idioma: t(cfg, 'es', 'en'),
            textos: { dia: t(cfg, 'Día', 'Day'), racha: t(cfg, r.racha === 1 ? 'día seguido' : 'días seguidos', r.racha === 1 ? 'day in a row' : 'days in a row'), saldo: t(cfg, 'Tu oro', 'Your gold') },
        });
        if (png) embed.setFields([]).setDescription(null).setFooter(null).setImage('attachment://diario.png');
        // Desde «Mi cuenta» también se puede reclamar con un clic.
        const web = new ActionRowBuilder().addComponents(botonWeb(cfg, 'inicio', t(cfg, 'Mi cuenta', 'My account')));
        await interaction.reply({ embeds: [embed], components: [web], files: png ? [new AttachmentBuilder(png, { name: 'diario.png' })] : [] });
    },
};
