const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const cofres = require('../utils/cofres.js');
const K = require('../utils/cofresNucleo.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /jugar cofre abrir [cantidad] · coleccion · probabilidades · historial
module.exports = {
    data: new SlashCommandBuilder()
        .setName('chest')
        .setNameLocalizations(ES('cofre'))
        .setDescription('Pet chests: open them with gold and collect companions')
        .setDescriptionLocalizations(ES('Cofres de mascotas: ábrelos con oro y colecciona compañeros'))
        .setContexts(InteractionContextType.Guild)
        .addSubcommand((s) => s.setName('open').setNameLocalizations(ES('abrir')).setDescription('Open a chest').setDescriptionLocalizations(ES('Abre un cofre'))
            .addStringOption((o) => o.setName('type').setNameLocalizations(ES('tipo')).setDescription('Which chest').setDescriptionLocalizations(ES('Qué cofre')).setRequired(true)
                .addChoices(...Object.entries(K.COFRES).map(([id, c]) => ({ name: `${c.emoji} ${c.en} · ${c.precio}`, name_localizations: ES(`${c.emoji} ${c.es} · ${c.precio}`), value: id }))))
            .addIntegerOption((o) => o.setName('amount').setNameLocalizations(ES('cantidad')).setDescription('1 or 10 at once (10 = 10% off)').setDescriptionLocalizations(ES('1 o 10 de golpe (10 = 10 % más barato)'))
                .addChoices({ name: '1', value: 1 }, { name: '10 (−10%)', name_localizations: ES('10 (−10 %)'), value: 10 })))
        .addSubcommand((s) => s.setName('history').setNameLocalizations(ES('historial')).setDescription('Your best pulls and how close the guaranteed epic is').setDescriptionLocalizations(ES('Tus mejores tiradas y cuánto falta para la épica segura')))
        .addSubcommand((s) => s.setName('collection').setNameLocalizations(ES('coleccion')).setDescription('Your companions (or someone else’s) and which one you have equipped').setDescriptionLocalizations(ES('Tus compañeros (o los de otra persona) y cuál llevas'))
            .addUserOption((o) => o.setName('member').setNameLocalizations(ES('miembro')).setDescription('Whose').setDescriptionLocalizations(ES('De quién'))))
        .addSubcommand((s) => s.setName('odds').setNameLocalizations(ES('probabilidades')).setDescription('What can come out of each chest').setDescriptionLocalizations(ES('Qué puede salir de cada cofre'))),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const sub = interaction.options.getSubcommand();
        if (sub === 'odds') return interaction.reply({ embeds: [cofres.embedProbabilidades(idioma, cfg)], flags: 64 });
        if (sub === 'collection') {
            const otro = interaction.options.getUser('member');
            await interaction.deferReply();
            return interaction.editReply(await cofres.verColeccion(interaction, idioma, otro && otro.id !== interaction.user.id ? otro : null));
        }
        if (sub === 'history') return interaction.reply(await cofres.historial(interaction, idioma));
        await interaction.deferReply();
        const r = interaction.options.getInteger('amount') === 10
            ? await cofres.abrirDiez({ interaction, cfg, idioma, cofre: interaction.options.getString('type') })
            : await cofres.abrir({ interaction, client, cfg, idioma, cofre: interaction.options.getString('type') });
        if (r.error) {
            await interaction.deleteReply().catch(() => {});
            return interaction.followUp({ content: `❌ ${r.error}`, flags: 64 });
        }
        return undefined;
    },
};
