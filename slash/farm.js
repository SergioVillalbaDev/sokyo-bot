const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /mascotas granja (1.28.0): tus mascotas producen oro solas; aquí se recoge y se ve el álbum. Lógica en utils/granja.js.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('farm')
        .setNameLocalizations(ES('granja'))
        .setDescription('Your pets make gold on their own: collect it and see your album')
        .setDescriptionLocalizations(ES('Tus mascotas producen oro solas: recógelo y mira tu álbum'))
        .setContexts(InteractionContextType.Guild)
        .addStringOption((o) => o.setName('view').setNameLocalizations(ES('ver')).setDescription('What to open').setDescriptionLocalizations(ES('Qué abrir'))
            .addChoices({ name: 'Farm', name_localizations: ES('Granja'), value: 'granja' }, { name: 'Album', name_localizations: ES('Álbum'), value: 'album' })),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const G = require('../utils/granja.js');
        await interaction.deferReply();
        const ver = interaction.options.getString('view') === 'album' ? G.vistaAlbum : G.vistaGranja;
        return interaction.editReply(await ver(interaction.guildId, interaction.user.id, idioma));
    },
};
