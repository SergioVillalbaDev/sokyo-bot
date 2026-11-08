const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { abrirVentanaNuevo } = require('../utils/grupos.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /grupo: abre una ventana para contar a qué se juega, cuántos hacen falta, cuándo y,
// si se quiere, un mensaje con lo que se va a hacer. Los demás se apuntan con un botón.
// Todo en utils/grupos.js (ventana, borrador y publicación).
module.exports = {
    data: new SlashCommandBuilder()
        .setName('group')
        .setNameLocalizations(ES('grupo'))
        .setDescription('Look for people to play with: a form opens so you can tell them everything')
        .setDescriptionLocalizations(ES('Busca gente para jugar: se abre una ventana para contarlo todo'))
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        return abrirVentanaNuevo(interaction, cfg);
    },
};
