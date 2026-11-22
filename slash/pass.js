const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /pase (1.29.0): el pase de temporada gratis, tus tickets y tus logros. Lógica en utils/pase.js.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('pass')
        .setNameLocalizations(ES('pase'))
        .setDescription('Your free season pass: level, rewards, free tickets and achievements')
        .setDescriptionLocalizations(ES('Tu pase de temporada gratis: nivel, premios, tickets gratis y logros'))
        .setContexts(InteractionContextType.Guild)
        .addStringOption((o) => o.setName('view').setNameLocalizations(ES('ver')).setDescription('What to open').setDescriptionLocalizations(ES('Qué abrir'))
            .addChoices({ name: 'Pass', name_localizations: ES('Pase'), value: 'pase' }, { name: 'Achievements', name_localizations: ES('Logros'), value: 'logros' })),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const X = require('../utils/pase.js');
        await interaction.deferReply();
        const ver = interaction.options.getString('view') === 'logros' ? X.vistaLogros : X.vistaPase;
        return interaction.editReply(await ver(interaction.user.id, idioma));
    },
};
