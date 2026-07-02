const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economia = require('../utils/economia.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rich')
        .setDescription('Leaderboard of the adventurers with the most gold'),

    async execute(interaction, client, cfg) {
        const top = await economia.topRicos(10);
        if (!top.length) return interaction.reply({ content: t(cfg, '🪙 Nadie tiene oro todavía. ¡Empieza con `/daily`!', '🪙 Nobody has any gold yet. Start with `/daily`!'), ephemeral: true });

        const medallas = ['🥇', '🥈', '🥉'];
        const lineas = await Promise.all(top.map(async (u, i) => {
            const user = await client.users.fetch(u.discordId).catch(() => null);
            const nombre = user ? user.username : t(cfg, 'Usuario desconocido', 'Unknown user');
            const pos = medallas[i] || `\`${i + 1}.\``;
            return `${pos} **${nombre}** — 🪙 ${u.balance.toLocaleString('en-US')}`;
        }));

        const embed = new EmbedBuilder()
            .setColor('#f5b942')
            .setTitle(t(cfg, '🏆 Los más ricos de Sokyo', '🏆 Sokyo’s richest'))
            .setDescription(lineas.join('\n'));

        await interaction.reply({ embeds: [embed] });
    },
};
