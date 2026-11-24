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
        .addSubcommand((s) => s.setName('disenchant').setNameLocalizations(ES('desencantar')).setDescription('Turn a copy of a card into dust').setDescriptionLocalizations(ES('Convierte una copia de una carta en polvo'))
            .addStringOption((o) => o.setName('card').setNameLocalizations(ES('carta')).setDescription('Which card').setDescriptionLocalizations(ES('Qué carta')).setRequired(true).setAutocomplete(true)))
        .addSubcommand((s) => s.setName('craft').setNameLocalizations(ES('crear')).setDescription('Craft any card with dust').setDescriptionLocalizations(ES('Crea la carta que quieras con polvo'))
            .addStringOption((o) => o.setName('any').setNameLocalizations(ES('cualquiera')).setDescription('Any card of the pack (type its name)').setDescriptionLocalizations(ES('Cualquier carta del pack (escribe su nombre)')).setRequired(true).setAutocomplete(true)))
        .addSubcommand((s) => s.setName('trade').setNameLocalizations(ES('intercambiar')).setDescription('Offer someone a card swap').setDescriptionLocalizations(ES('Propón a alguien un cambio de cartas'))
            .addUserOption((o) => o.setName('member').setNameLocalizations(ES('miembro')).setDescription('With whom').setDescriptionLocalizations(ES('Con quién')).setRequired(true))
            .addStringOption((o) => o.setName('card').setNameLocalizations(ES('carta')).setDescription('Your card').setDescriptionLocalizations(ES('Tu carta')).setRequired(true).setAutocomplete(true))
            .addStringOption((o) => o.setName('theirs').setNameLocalizations(ES('suya')).setDescription('Their card').setDescriptionLocalizations(ES('Su carta')).setRequired(true).setAutocomplete(true)))
        .addSubcommand((s) => s.setName('odds').setNameLocalizations(ES('probabilidades')).setDescription('What can come out of each pack').setDescriptionLocalizations(ES('Qué puede salir en cada sobre'))),

    async autocomplete(interaction) {
        const foco = interaction.options.getFocused(true);
        const q = String(foco.value || '').toLowerCase();
        // 1.32.0: «crear» busca en todo el pack (con lo que cuesta); «suya», en las cartas de la otra persona.
        if (foco.name === 'any') {
            const mia = await ColeccionMascotas.findOne({ guildId: interaction.guildId, userId: interaction.user.id }).select('cartas polvo').lean();
            const tengo = new Map((mia?.cartas || []).map((c) => [c.id, c.estrellas || 1]));
            const ops = [...K.ANIME.entries()].filter(([, d]) => d.rareza !== 'divina' && (!q || `${d.es} ${d.serie}`.toLowerCase().includes(q)))
                .slice(0, 25).map(([id, d]) => ({ name: `${K.RAREZAS[d.rareza].emoji} ${d.es} · ${d.serie} · ✨ ${S.COSTE_CREAR[d.rareza]}${tengo.has(id) ? ` (★${tengo.get(id)})` : ''}`.slice(0, 100), value: id }));
            return interaction.respond(ops).catch(() => {});
        }
        const otro = foco.name === 'theirs' ? interaction.options.get('member')?.value : null;
        if (foco.name === 'theirs' && !otro) return interaction.respond([]).catch(() => {});
        const col = await ColeccionMascotas.findOne({ guildId: interaction.guildId, userId: otro || interaction.user.id }).select('cartas').lean();
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
        if (sub === 'disenchant') {
            const r = await cartas.desencantar(interaction.guildId, interaction.user.id, interaction.options.getString('card'), idioma);
            if (r.confirmar) return interaction.reply(r.confirmar);
            return interaction.reply({ content: r.error ? `❌ ${r.error}` : r.texto, flags: 64 });
        }
        if (sub === 'craft') {
            await interaction.deferReply();
            const r = await cartas.crear(interaction.guildId, interaction.user.id, interaction.options.getString('any'), idioma);
            if (r.error) { await interaction.deleteReply().catch(() => {}); return interaction.followUp({ content: `❌ ${r.error}`, flags: 64 }); }
            const v = await cartas.verCarta(interaction.guildId, interaction.user.id, r.id, idioma);
            return interaction.editReply({ content: r.texto, ...v, allowedMentions: { parse: [] } });
        }
        if (sub === 'trade') {
            const yo = await ColeccionMascotas.findOne({ guildId: interaction.guildId, userId: interaction.user.id }).select('cartas').lean();
            if (!(yo?.cartas || []).some((c) => c.id === interaction.options.getString('card'))) return interaction.reply({ content: t(idioma, '❌ No tienes esa carta.', '❌ You don’t have that card.'), flags: 64 });
            const r = cartas.proponerIntercambio(interaction, idioma, interaction.options.getUser('member'), interaction.options.getString('card'), interaction.options.getString('theirs'));
            if (r.error) return interaction.reply({ content: `❌ ${r.error}`, flags: 64 });
            return interaction.reply(r.msg);
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
