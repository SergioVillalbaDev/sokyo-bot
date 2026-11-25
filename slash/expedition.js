const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const P = require('../utils/compisNucleo.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /expedicion (1.33.0): expedición en grupo para todo el canal. Todo en utils/expedicionGrupo.js.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('expedition')
        .setNameLocalizations(ES('expedicion'))
        .setDescription('🧭 Group expedition: everyone joins with their companion (more people, more gold)')
        .setDescriptionLocalizations(ES('🧭 Expedición en grupo: todos se apuntan con su compañero (más gente, más oro)'))
        .setContexts(InteractionContextType.Guild)
        .addStringOption((o) => o.setName('destination').setNameLocalizations(ES('destino')).setDescription('Where to').setDescriptionLocalizations(ES('A dónde')).setRequired(true)
            .addChoices(...Object.entries(P.EXPEDICIONES).filter(([, x]) => x.grupo).map(([id, x]) => ({ name: `${x.emoji} ${x.en} (${x.horas} h)`, name_localizations: ES(`${x.emoji} ${x.es} (${x.horas} h)`), value: id })))),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        await interaction.deferReply();
        const r = await require('../utils/expedicionGrupo.js').abrir({ interaction, idioma, destino: interaction.options.getString('destination') });
        if (r?.error) {
            await interaction.deleteReply().catch(() => {});
            return interaction.followUp({ content: `❌ ${r.error}`, flags: 64 });
        }
        return undefined;
    },
};
