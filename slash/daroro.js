const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const economia = require('../utils/economia.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('givegold')
        .setDescription('(Admin) Give or take gold from a user')
        .addUserOption(o => o.setName('user').setDescription('Who to give it to').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('Amount (negative to take away)').setRequired(true))
        // Solo lo ven/usan quienes tengan permiso de Administrador en el servidor.
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const usuario = interaction.options.getUser('user');
        const cantidad = interaction.options.getInteger('amount');
        const balance = await economia.darOro(usuario.id, cantidad);

        const embed = new EmbedBuilder()
            .setColor('#c9a227')
            .setDescription(`🪙 ${cantidad >= 0 ? 'Added' : 'Removed'} **${Math.abs(cantidad)}** gold ${cantidad >= 0 ? 'to' : 'from'} ${usuario}.\nCurrent balance: **${balance}**.`);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
