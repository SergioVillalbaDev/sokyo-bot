const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, InteractionContextType } = require('discord.js');
const { publicarPanelCuenta, puedePublicar } = require('../utils/cuenta.js');
const { t } = require('../utils/i18n.js');

// Publica en un canal el mensaje fijo de «Mi cuenta» (utils/cuenta.js): un botón
// que cualquier miembro pulsa para entrar a su cuenta con un clic. Si ya estaba
// en ese canal, lo actualiza. Lo mismo se hace desde el panel web.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('account-panel')
        .setNameLocalizations({ 'es-ES': 'panel-cuenta', 'es-419': 'panel-cuenta' })
        .setDescription('Post a button so every member can open their Sokyo account in one click')
        .setDescriptionLocalizations({
            'es-ES': 'Publica un botón para que cada miembro abra su cuenta de Sokyo con un clic',
            'es-419': 'Publica un botón para que cada miembro abra su cuenta de Sokyo con un clic',
        })
        .addChannelOption((o) => o.setName('channel').setNameLocalizations({ 'es-ES': 'canal', 'es-419': 'canal' })
            .setDescription('Where to post it (this channel by default)')
            .setDescriptionLocalizations({ 'es-ES': 'Dónde publicarlo (este canal por defecto)', 'es-419': 'Dónde publicarlo (este canal por defecto)' })
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        // Solo lo ven/usan quienes pueden gestionar el servidor.
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        if (!interaction.guild) return interaction.reply({ content: t(cfg, '❌ Este comando solo funciona en un servidor.', '❌ This command only works in a server.'), flags: 64 });
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: t(cfg, '❌ Necesitas el permiso «Gestionar servidor».', '❌ You need the “Manage Server” permission.'), flags: 64 });
        }
        const canal = interaction.options.getChannel('channel') || interaction.channel;
        if (!puedePublicar(canal)) {
            return interaction.reply({ content: t(cfg, `❌ No puedo escribir en <#${canal.id}>: dame «Ver canal», «Enviar mensajes» e «Insertar enlaces» ahí.`, `❌ I can’t post in <#${canal.id}>: give me “View Channel”, “Send Messages” and “Embed Links” there.`), flags: 64 });
        }
        await interaction.deferReply({ flags: 64 });
        const { mensaje, actualizado } = await publicarPanelCuenta(canal, cfg);
        await interaction.editReply(actualizado
            ? t(cfg, `✅ He actualizado el botón de «Mi cuenta» en <#${canal.id}>: ${mensaje.url}`, `✅ I updated the “My account” button in <#${canal.id}>: ${mensaje.url}`)
            : t(cfg, `✅ Listo: <#${canal.id}> ya tiene el botón para que cada miembro entre a su cuenta con un clic.`, `✅ Done: <#${canal.id}> now has the button so every member can open their account in one click.`));
    },
};
