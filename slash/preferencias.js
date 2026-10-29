const { SlashCommandBuilder } = require('discord.js');
const { mensajePreferencias } = require('../utils/preferenciasDiscord.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /preferencias: tu idioma y qué mensajes privados quieres del bot.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('preferences')
        .setNameLocalizations(ES('preferencias'))
        .setDescription('Your language and which DMs you want from the bot')
        .setDescriptionLocalizations(ES('Tu idioma y qué mensajes privados quieres del bot')),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        await interaction.reply({ ...(await mensajePreferencias(interaction.user.id, idioma)), flags: 64 });
    },
};
