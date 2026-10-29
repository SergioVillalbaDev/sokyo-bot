const { ContextMenuCommandBuilder, ApplicationCommandType, InteractionContextType, PermissionFlagsBits } = require('discord.js');
const { mensajeFicha } = require('../utils/moderacionRapida.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

// Clic derecho en alguien → Apps → «Ver ficha»: desde cuándo está, nivel,
// sanciones y tickets, con los botones de sanción para el staff.
module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('View profile')
        .setNameLocalizations({ 'es-ES': 'Ver ficha', 'es-419': 'Ver ficha' })
        .setType(ApplicationCommandType.User)
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        await interaction.reply(await mensajeFicha(client, interaction, cfg, idioma));
    },
};
