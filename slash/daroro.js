const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const economia = require('../utils/economia.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daroro')
        .setDescription('(Admin) Da o quita oro a un usuario')
        .addUserOption(o => o.setName('usuario').setDescription('A quién dárselo').setRequired(true))
        .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad (negativa para quitar)').setRequired(true))
        // Solo lo ven/usan quienes tengan permiso de Administrador en el servidor.
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const usuario = interaction.options.getUser('usuario');
        const cantidad = interaction.options.getInteger('cantidad');
        const balance = await economia.darOro(usuario.id, cantidad);

        const embed = new EmbedBuilder()
            .setColor('#c9a227')
            .setDescription(`🪙 ${cantidad >= 0 ? 'Añadido' : 'Retirado'} **${Math.abs(cantidad)}** de oro a ${usuario}.\nSaldo actual: **${balance}**.`);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
