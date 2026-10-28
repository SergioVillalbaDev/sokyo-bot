const { SlashCommandBuilder } = require('discord.js');
const { crearRecordatorio, textoCreado, opcionesCuando } = require('../utils/recordatorios.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /recordar: el bot te avisa dentro de un rato. «Cuándo» sugiere tiempos mientras escribes.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setNameLocalizations(ES('recordar'))
        .setDescription('Have the bot remind you of something later')
        .setDescriptionLocalizations(ES('Que el bot te recuerde algo dentro de un rato'))
        .addStringOption((o) => o.setName('when').setNameLocalizations(ES('cuando'))
            .setDescription('In how long: 10m, 2h, 1d… (pick one from the list)')
            .setDescriptionLocalizations(ES('Dentro de cuánto: 10m, 2h, 1d… (elige uno de la lista)'))
            .setRequired(true).setAutocomplete(true).setMaxLength(30))
        .addStringOption((o) => o.setName('what').setNameLocalizations(ES('que'))
            .setDescription('What to remind you of')
            .setDescriptionLocalizations(ES('Qué quieres que te recuerde'))
            .setRequired(true).setMaxLength(1500))
        .addBooleanOption((o) => o.setName('dm').setNameLocalizations(ES('privado'))
            .setDescription('Remind you by DM instead of in this channel')
            .setDescriptionLocalizations(ES('Avisarte por mensaje privado en vez de en este canal'))),

    async autocomplete(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        await interaction.respond(opcionesCuando(interaction.options.getFocused(), idioma));
    },

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const texto = interaction.options.getString('what');
        const porMD = !!interaction.options.getBoolean('dm') || !interaction.guildId;
        const r = await crearRecordatorio({
            guildId: interaction.guildId || null,
            canalId: interaction.channelId,
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            cuando: interaction.options.getString('when'), texto, porMD,
        }, idioma);
        await interaction.reply({ content: r.ok ? textoCreado(r, texto, porMD, idioma) : r.error, flags: 64 });
    },
};
