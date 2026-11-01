const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { exigir, obtenerConfig, EPH } = require('../utils/accesos.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-soporte')
        .setDescription('Publica en este canal el panel para abrir tickets de soporte')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setContexts(InteractionContextType.Guild),
    async execute(interaction) {
        if (!(await exigir(interaction, 'config.textos'))) return;

        const config = await obtenerConfig(interaction.guildId);
        const embed = new EmbedBuilder()
            .setTitle(config.mensajeSoporteTitulo || '🎫 Soporte Técnico Activo')
            .setDescription(config.mensajeSoporteDescripcion || 'Haz clic en el botón de abajo para abrir un ticket de soporte.')
            .setColor('#5865F2')
            .setFooter({ text: config.footerPersonalizado || 'Sistema de Gestión Sokyo' })
            .setTimestamp();
        const fila = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 Abrir Ticket').setStyle(ButtonStyle.Primary)
        );

        await interaction.channel.send({ embeds: [embed], components: [fila] });
        await interaction.reply({ content: '✅ Panel de soporte publicado en este canal.', flags: EPH });
    }
};
