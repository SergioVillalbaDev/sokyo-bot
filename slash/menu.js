const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /menu (1.34.0): tu pantalla de inicio. Todo en utils/menu.js.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('menu')
        .setNameLocalizations(ES('menu'))
        .setDescription('🏠 Your menu: your stuff, what’s ready and where to go, with buttons')
        .setDescriptionLocalizations(ES('🏠 Tu menú: lo tuyo, lo que está listo y a dónde ir, con botones'))
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        await interaction.deferReply({ flags: 64 });
        return interaction.editReply(await require('../utils/menu.js').vistaMenu(interaction, cfg || {}, idioma));
    },
};
