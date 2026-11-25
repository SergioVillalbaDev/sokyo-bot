const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /mascotas guarderia (1.33.0): cría de compañeros. Todo en utils/guarderia.js.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('nursery')
        .setNameLocalizations(ES('guarderia'))
        .setDescription('🥚 Breed two of your companions and hatch their egg')
        .setDescriptionLocalizations(ES('🥚 Cría a dos de tus compañeros y abre su huevo'))
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        await interaction.deferReply({ flags: 64 });
        return interaction.editReply(await require('../utils/guarderia.js').vista(interaction.guildId, interaction.user.id, idioma));
    },
};
