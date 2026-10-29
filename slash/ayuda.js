const { SlashCommandBuilder } = require('discord.js');
const { mensajeAyuda } = require('../utils/ayuda.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

// /ayuda: qué puede hacer el bot, por categorías (solo lo ve quien lo pide).
module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setNameLocalizations({ 'es-ES': 'ayuda', 'es-419': 'ayuda' })
        .setDescription('What Sokyo can do, explained by category')
        .setDescriptionLocalizations({ 'es-ES': 'Qué puede hacer Sokyo, explicado por categorías', 'es-419': 'Qué puede hacer Sokyo, explicado por categorías' }),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        await interaction.reply({ ...mensajeAyuda(idioma, (cfg && cfg.prefijo) || '!'), flags: 64 });
    },
};
