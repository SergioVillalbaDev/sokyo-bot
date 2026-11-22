const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /empezar (1.29.0): guía para quien no tiene ni idea, con «¿Qué hago ahora?». Lógica en utils/empezar.js.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('start')
        .setNameLocalizations(ES('empezar'))
        .setDescription('New here? What to do with pets, cards, gold and the casino, step by step')
        .setDescriptionLocalizations(ES('¿Nuevo? Qué hacer con mascotas, cartas, oro y casino, paso a paso'))
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        await interaction.deferReply({ flags: 64 });
        return interaction.editReply(await require('../utils/empezar.js').vistaInicio(interaction.guildId, interaction.user.id, idioma, cfg));
    },
};
