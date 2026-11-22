const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require('discord.js');
const economia = require('../utils/economia.js');
const { t } = require('../utils/i18n.js');
const ES = (v) => ({ 'es-ES': v, 'es-419': v }); // nombres y textos en español

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rich')
        .setNameLocalizations(ES('ricos'))
        .setDescription('Leaderboard of the adventurers with the most gold')
        .setDescriptionLocalizations(ES('Quién tiene más oro en el servidor'))
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        const top = await economia.en(interaction.guildId).topRicos(10);
        if (!top.length) return interaction.reply({ content: t(cfg, '🪙 Nadie tiene oro todavía. ¡Empieza con `/daily`!', '🪙 Nobody has any gold yet. Start with `/daily`!'), flags: 64 });

        const medallas = ['🥇', '🥈', '🥉'];
        const lineas = await Promise.all(top.map(async (u, i) => {
            const user = await client.users.fetch(u.discordId).catch(() => null);
            const nombre = user ? user.username : t(cfg, 'Usuario desconocido', 'Unknown user');
            const pos = medallas[i] || `\`${i + 1}.\``;
            return `${pos} **${nombre}** — 🪙 ${u.balance.toLocaleString('en-US')}`;
        }));

        const embed = new EmbedBuilder()
            .setColor('#f5b942')
            .setTitle(t(cfg, `🏆 Los más ricos de ${interaction.guild?.name || 'aquí'}`, `🏆 Richest in ${interaction.guild?.name || 'here'}`))
            .setDescription(lineas.join('\n'));

        await interaction.reply({ embeds: [embed] });
    },
};
