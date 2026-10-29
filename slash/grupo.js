const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { crearGrupo } = require('../utils/grupos.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /grupo juego plazas: busca gente para jugar; los demás se apuntan con un botón.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('group')
        .setNameLocalizations(ES('grupo'))
        .setDescription('Look for people to play with: others join with a button')
        .setDescriptionLocalizations(ES('Busca gente para jugar: los demás se apuntan con un botón'))
        .setContexts(InteractionContextType.Guild)
        .addStringOption((o) => o.setName('game').setNameLocalizations(ES('juego'))
            .setDescription('What you’re going to play')
            .setDescriptionLocalizations(ES('A qué vais a jugar'))
            .setRequired(true).setMaxLength(100))
        .addIntegerOption((o) => o.setName('slots').setNameLocalizations(ES('plazas'))
            .setDescription('How many people in total, including you')
            .setDescriptionLocalizations(ES('Cuántas personas en total, contándote a ti'))
            .setRequired(true).setMinValue(2).setMaxValue(25))
        .addStringOption((o) => o.setName('when').setNameLocalizations(ES('cuando'))
            .setDescription('When: “now”, “at 22:00”… (optional)')
            .setDescriptionLocalizations(ES('Cuándo: «ahora», «a las 22:00»… (opcional)'))
            .setMaxLength(100))
        .addStringOption((o) => o.setName('details').setNameLocalizations(ES('detalles'))
            .setDescription('Anything else: rank, mode, mic required… (optional)')
            .setDescriptionLocalizations(ES('Algo más: rango, modo, con micro… (opcional)'))
            .setMaxLength(500)),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        await interaction.deferReply({ flags: 64 });
        const r = await crearGrupo(interaction, cfg, {
            juego: interaction.options.getString('game'),
            plazas: interaction.options.getInteger('slots'),
            cuando: interaction.options.getString('when'),
            descripcion: interaction.options.getString('details'),
        }, idioma);
        if (r.error) return interaction.editReply(r.error);
        await interaction.editReply(t(idioma, `✅ ¡Grupo publicado! ${r.url}\nCuando se llene os aviso a todos${cfg?.grupos?.crearSala === false ? '' : ' y os creo una sala de voz'}.`, `✅ Group posted! ${r.url}\nWhen it fills up I’ll let everyone know${cfg?.grupos?.crearSala === false ? '' : ' and make you a voice room'}.`));
    },
};
