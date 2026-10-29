const { ContextMenuCommandBuilder, ApplicationCommandType, InteractionContextType } = require('discord.js');
const { respuestaTraduccion } = require('../utils/traducir.js');
const { idiomaInteraccion, preferenciasDe } = require('../utils/preferencias.js');

// Clic derecho en un mensaje → Apps → «Traducir»: el mensaje en tu idioma, solo para ti.
module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Translate')
        .setNameLocalizations({ 'es-ES': 'Traducir', 'es-419': 'Traducir' })
        .setType(ApplicationCommandType.Message)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

    async execute(interaction, client, cfg) {
        await interaction.deferReply({ flags: 64 });
        const idioma = await idiomaInteraccion(interaction, cfg);
        const prefs = await preferenciasDe(interaction.user.id);
        const texto = await respuestaTraduccion(interaction.targetMessage, { locale: interaction.locale, preferido: prefs.idioma, idioma, cfg });
        await interaction.editReply({ content: texto, allowedMentions: { parse: [] } });
    },
};
