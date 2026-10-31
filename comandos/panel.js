const { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, InteractionContextType, MessageFlags } = require('discord.js');
const { obtenerConfig, buscarPanel } = require('../utils/config.js');
const { mensajePanel } = require('../utils/aperturaTickets.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Publica un panel con el botón para abrir tickets')
        .addStringOption(o => o.setName('panel').setDescription('Qué panel publicar (se configuran en el panel web)').setAutocomplete(true))
        .addChannelOption(o => o.setName('canal').setDescription('Dónde publicarlo (por defecto, este canal)').addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setContexts(InteractionContextType.Guild),

    async autocomplete(interaction) {
        const config = await obtenerConfig(interaction.guildId);
        const texto = interaction.options.getFocused().toLowerCase();
        const opciones = config.paneles
            .filter(p => p.nombre.toLowerCase().includes(texto))
            .slice(0, 25)
            .map(p => ({ name: p.nombre.slice(0, 100), value: String(p._id) }));
        await interaction.respond(opciones);
    },

    async execute(interaction, client) {
        const config = await obtenerConfig(interaction.guildId);
        const panelId = interaction.options.getString('panel');
        const panel = panelId ? buscarPanel(config, panelId) : buscarPanel(config);
        if (!panel) return interaction.reply({ content: '❌ No encuentro ese panel. Elige uno de la lista.', flags: MessageFlags.Ephemeral });

        const canal = interaction.options.getChannel('canal') || interaction.channel;
        const P = PermissionsBitField.Flags;
        if (!canal.permissionsFor(interaction.guild.members.me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])) {
            return interaction.reply({ content: `❌ No tengo permiso para escribir en ${canal}.`, flags: MessageFlags.Ephemeral });
        }

        const mensaje = await canal.send(mensajePanel(config, panel, client));
        return interaction.reply({ content: `✅ Panel **${panel.nombre}** publicado: ${mensaje.url}`, flags: MessageFlags.Ephemeral });
    }
};
