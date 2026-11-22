const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const cartas = require('../utils/cartas.js');
const K = require('../utils/cofresNucleo.js');
const S = require('../utils/cartasNucleo.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /carta abrir · album · ver · usar · probabilidades (1.24.0). Las cartas de anime salen en sobres
// y se usan sobre tu mascota. Lógica en utils/cartas.js y utils/cartasNucleo.js.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('card')
        .setNameLocalizations(ES('carta'))
        .setDescription('Anime cards: open packs and use them to power up your pet')
        .setDescriptionLocalizations(ES('Cartas de anime: abre sobres y úsalas para potenciar a tu mascota'))
        .setContexts(InteractionContextType.Guild)
        .addSubcommand((s) => s.setName('open').setNameLocalizations(ES('abrir')).setDescription('Open a pack of 3 cards').setDescriptionLocalizations(ES('Abre un sobre de 3 cartas'))
            .addStringOption((o) => o.setName('pack').setNameLocalizations(ES('sobre')).setDescription('Which pack').setDescriptionLocalizations(ES('Qué sobre')).setRequired(true)
                .addChoices(...Object.entries(S.SOBRES).map(([id, s]) => ({ name: `${s.emoji} ${s.en} · ${s.precio}`, name_localizations: ES(`${s.emoji} ${s.es} · ${s.precio}`), value: id })))))
        .addSubcommand((s) => s.setName('album').setNameLocalizations(ES('album')).setDescription('Your cards (or someone else’s)').setDescriptionLocalizations(ES('Tus cartas (o las de otra persona)'))
            .addUserOption((o) => o.setName('member').setNameLocalizations(ES('miembro')).setDescription('Whose').setDescriptionLocalizations(ES('De quién'))))
        .addSubcommand((s) => s.setName('see').setNameLocalizations(ES('ver')).setDescription('See one of your cards').setDescriptionLocalizations(ES('Ver una de tus cartas'))
            .addStringOption((o) => o.setName('card').setNameLocalizations(ES('carta')).setDescription('Which card').setDescriptionLocalizations(ES('Qué carta')).setRequired(true).setAutocomplete(true)))
        .addSubcommand((s) => s.setName('use').setNameLocalizations(ES('usar')).setDescription('Use a card on your equipped pet').setDescriptionLocalizations(ES('Usa una carta en tu mascota equipada'))
            .addStringOption((o) => o.setName('card').setNameLocalizations(ES('carta')).setDescription('Which card').setDescriptionLocalizations(ES('Qué carta')).setRequired(true).setAutocomplete(true)))
        .addSubcommand((s) => s.setName('show').setNameLocalizations(ES('mostrar')).setDescription('Show one of your cards in the channel').setDescriptionLocalizations(ES('Enseña una de tus cartas en el canal'))
            .addStringOption((o) => o.setName('card').setNameLocalizations(ES('carta')).setDescription('Which card').setDescriptionLocalizations(ES('Qué carta')).setRequired(true).setAutocomplete(true)))
        .addSubcommand((s) => s.setName('gift').setNameLocalizations(ES('regalar')).setDescription('Gift a copy of a card to someone').setDescriptionLocalizations(ES('Regala una copia de una carta a alguien'))
            .addUserOption((o) => o.setName('member').setNameLocalizations(ES('miembro')).setDescription('Who').setDescriptionLocalizations(ES('A quién')).setRequired(true))
            .addStringOption((o) => o.setName('card').setNameLocalizations(ES('carta')).setDescription('Which card').setDescriptionLocalizations(ES('Qué carta')).setRequired(true).setAutocomplete(true)))
        .addSubcommand((s) => s.setName('odds').setNameLocalizations(ES('probabilidades')).setDescription('What can come out of each pack').setDescriptionLocalizations(ES('Qué puede salir en cada sobre'))),

    async autocomplete(interaction) {
        const col = await ColeccionMascotas.findOne({ guildId: interaction.guildId, userId: interaction.user.id }).select('cartas').lean();
        const q = String(interaction.options.getFocused() || '').toLowerCase();
        const ahora = Date.now();
        const ops = (col?.cartas || []).map((c) => {
            const d = K.def(c.id); const f = S.faltaCarta(c, ahora);
            return { orden: K.RAREZAS[d.rareza].orden, listo: !f, name: `${f ? '⏳' : '✅'} ${d.es} ${'★'.repeat(c.estrellas || 1)} · ${d.serie}`.slice(0, 100), value: c.id, texto: `${d.es} ${d.serie} ${d.poder?.es || ''}`.toLowerCase() };
        }).filter((o) => !q || o.texto.includes(q)).sort((a, b) => b.listo - a.listo || b.orden - a.orden).slice(0, 25);
        await interaction.respond(ops.map(({ name, value }) => ({ name, value }))).catch(() => {});
    },

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const sub = interaction.options.getSubcommand();
        if (sub === 'odds') return interaction.reply({ embeds: [cartas.embedProbabilidades(idioma)], flags: 64 });
        if (sub === 'album') {
            const otro = interaction.options.getUser('member');
            await interaction.deferReply();
            return interaction.editReply(await cartas.verAlbum(interaction, idioma, otro && otro.id !== interaction.user.id ? otro : null));
        }
        if (sub === 'see') {
            await interaction.deferReply({ flags: 64 });
            return interaction.editReply(await cartas.verCarta(interaction.guildId, interaction.user.id, interaction.options.getString('card'), idioma));
        }
        if (sub === 'show') {
            await interaction.deferReply();
            return interaction.editReply(await cartas.mostrar(interaction, interaction.options.getString('card'), idioma));
        }
        if (!cartas.activas(cfg)) return interaction.reply({ content: cartas.textoApagadas(idioma), flags: 64 });
        if (sub === 'gift') {
            const r = await cartas.regalar(interaction, idioma, interaction.options.getUser('member'), interaction.options.getString('card'));
            if (r.error) return interaction.reply({ content: `❌ ${r.error}`, flags: 64 });
            return interaction.reply({ content: r.texto, allowedMentions: { users: [r.destino] } });
        }
        if (sub === 'use') {
            await interaction.deferReply();
            const compis = require('../utils/compis.js');
            const nombre = interaction.member?.displayName || interaction.user.username;
            const res = await compis.accion(interaction.guildId, interaction.user.id, null, `carta:${interaction.options.getString('card')}`, { idioma, dueno: nombre, bromas: !!cfg?.bromas?.activo });
            if (res.fallo === 'sin') return interaction.editReply({ content: compis.textoFallo('sinMascota', idioma) });
            return interaction.editReply(await compis.vista({ ownerId: interaction.user.id, duenoNombre: nombre, idioma, res, cfg }));
        }
        await interaction.deferReply();
        const r = await cartas.abrir({ interaction, cfg, idioma, sobre: interaction.options.getString('pack') });
        if (r.error) {
            await interaction.deleteReply().catch(() => {});
            return interaction.followUp({ content: `❌ ${r.error}`, flags: 64 });
        }
        return undefined;
    },
};
