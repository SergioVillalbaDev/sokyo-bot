const { SlashCommandBuilder } = require('discord.js');
const { mensajeRecordatorios } = require('../utils/recordatorios.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /recordatorios: los tuyos pendientes, con un botón para borrar cada uno.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('reminders')
        .setNameLocalizations(ES('recordatorios'))
        .setDescription('Your pending reminders (and delete them)')
        .setDescriptionLocalizations(ES('Tus recordatorios pendientes (y borrarlos)')),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        await interaction.reply({ ...(await mensajeRecordatorios(interaction.user.id, idioma)), flags: 64 });
    },
};
