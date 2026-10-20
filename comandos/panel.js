const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, InteractionContextType, MessageFlags } = require('discord.js');
const { obtenerConfig } = require('../utils/config.js');
const { publicarPanel } = require('../utils/panelSoporte.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Publica el panel de soporte con el botón para abrir tickets')
        .addChannelOption(opcion => opcion
            .setName('canal')
            .setDescription('Canal donde publicarlo (por defecto, este mismo)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        const canal = interaction.options.getChannel('canal') || interaction.channel;
        const permisos = canal.permissionsFor(interaction.guild.members.me);
        if (!permisos?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
            return interaction.reply({ content: `❌ No puedo escribir en ${canal}. Dame permisos de *Ver canal*, *Enviar mensajes* e *Insertar enlaces* allí.`, flags: MessageFlags.Ephemeral });
        }

        const config = await obtenerConfig(interaction.guildId);
        await publicarPanel(canal, config);
        await interaction.reply({
            content: `✅ Panel de soporte publicado en ${canal}.\n💡 Cambia sus textos y colores desde el panel web: el mensaje se actualizará solo.`,
            flags: MessageFlags.Ephemeral
        });
    }
};
