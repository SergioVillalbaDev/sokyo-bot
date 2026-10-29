const { ContextMenuCommandBuilder, ApplicationCommandType, InteractionContextType, PermissionFlagsBits } = require('discord.js');
const { mensajeFicha } = require('../utils/moderacionRapida.js');
const { miembroPuedeModerar } = require('../utils/permisos.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

// Clic derecho en alguien → Apps → «Sancionar»: su ficha y los botones para
// avisar, aislar, expulsar o banear (solo lo ven quienes pueden moderar).
module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Sanction')
        .setNameLocalizations({ 'es-ES': 'Sancionar', 'es-419': 'Sancionar' })
        .setType(ApplicationCommandType.User)
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        if (!miembroPuedeModerar(interaction.member, cfg, PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: t(idioma, '❌ Solo el staff de moderación puede sancionar.', '❌ Only moderation staff can sanction.'), flags: 64 });
        }
        if (interaction.targetUser.id === interaction.user.id) return interaction.reply({ content: t(idioma, '🙃 No puedes sancionarte a ti mismo.', '🙃 You can’t sanction yourself.'), flags: 64 });
        if (interaction.targetUser.bot) return interaction.reply({ content: t(idioma, '🤖 A los bots no se les sanciona desde aquí.', '🤖 Bots can’t be sanctioned from here.'), flags: 64 });
        await interaction.reply(await mensajeFicha(client, interaction, cfg, idioma));
    },
};
