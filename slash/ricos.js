const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economia = require('../utils/economia.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ricos')
        .setDescription('Ranking de los aventureros con más oro'),

    async execute(interaction, client) {
        const top = await economia.topRicos(10);
        if (!top.length) return interaction.reply({ content: '🪙 Aún no hay nadie con oro. ¡Empieza con `/daily`!', ephemeral: true });

        const medallas = ['🥇', '🥈', '🥉'];
        const lineas = await Promise.all(top.map(async (u, i) => {
            const user = await client.users.fetch(u.discordId).catch(() => null);
            const nombre = user ? user.username : `Usuario desconocido`;
            const pos = medallas[i] || `\`${i + 1}.\``;
            return `${pos} **${nombre}** — 🪙 ${u.balance.toLocaleString('es-ES')}`;
        }));

        const embed = new EmbedBuilder()
            .setColor('#f5b942')
            .setTitle('🏆 Los más ricos de Sokyo')
            .setDescription(lineas.join('\n'));

        await interaction.reply({ embeds: [embed] });
    },
};
