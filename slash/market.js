const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const mercado = require('../utils/mercado.js');
const K = require('../utils/cofresNucleo.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /jugar mercado (1.32.0): comprar y vender cartas de anime entre miembros del servidor. Lógica en utils/mercado.js.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('market')
        .setNameLocalizations(ES('mercado'))
        .setDescription('Buy and sell anime cards with other members')
        .setDescriptionLocalizations(ES('Compra y vende cartas de anime con otros miembros'))
        .setContexts(InteractionContextType.Guild)
        .addSubcommand((s) => s.setName('browse').setNameLocalizations(ES('ver')).setDescription('What’s for sale').setDescriptionLocalizations(ES('Lo que hay a la venta'))
            .addStringOption((o) => o.setName('search').setNameLocalizations(ES('buscar')).setDescription('Card or series name').setDescriptionLocalizations(ES('Nombre de la carta o de la serie'))))
        .addSubcommand((s) => s.setName('sell').setNameLocalizations(ES('vender')).setDescription('Put a copy of one of your cards up for sale').setDescriptionLocalizations(ES('Pon a la venta una copia de una de tus cartas'))
            .addStringOption((o) => o.setName('card').setNameLocalizations(ES('carta')).setDescription('Which card').setDescriptionLocalizations(ES('Qué carta')).setRequired(true).setAutocomplete(true))
            .addIntegerOption((o) => o.setName('price').setNameLocalizations(ES('precio')).setDescription('Price in gold').setDescriptionLocalizations(ES('Precio en oro')).setRequired(true).setMinValue(10).setMaxValue(1000000)))
        .addSubcommand((s) => s.setName('mine').setNameLocalizations(ES('mias')).setDescription('Your cards for sale (and remove them)').setDescriptionLocalizations(ES('Tus cartas a la venta (y quitarlas)'))),

    async autocomplete(interaction) {
        const col = await ColeccionMascotas.findOne({ guildId: interaction.guildId, userId: interaction.user.id }).select('cartas holos').lean();
        const q = String(interaction.options.getFocused() || '').toLowerCase();
        const ops = (col?.cartas || []).map((c) => { const d = K.def(c.id); return { o: K.RAREZAS[d.rareza].orden, name: `${K.RAREZAS[d.rareza].emoji} ${(col.holos || []).includes(c.id) ? '🌈 ' : ''}${d.es} ${'★'.repeat(c.estrellas || 1)} · ${d.serie}`.slice(0, 100), value: c.id, txt: `${d.es} ${d.serie}`.toLowerCase() }; })
            .filter((x) => !q || x.txt.includes(q)).sort((a, b) => b.o - a.o).slice(0, 25);
        await interaction.respond(ops.map(({ name, value }) => ({ name, value }))).catch(() => {});
    },

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        if (!cfg?.compis?.anime) return interaction.reply({ content: t(idioma, '🃏 Las cartas de anime no están activadas en este servidor.', '🃏 Anime cards aren’t turned on on this server.'), flags: 64 });
        const sub = interaction.options.getSubcommand();
        if (sub === 'browse') return interaction.reply(await mercado.vista(interaction.guildId, interaction.user.id, idioma, { buscar: interaction.options.getString('search') }));
        if (sub === 'mine') return interaction.reply(await mercado.mias(interaction.guildId, interaction.user.id, idioma));
        const r = await mercado.vender(interaction.guildId, interaction.user.id, interaction.options.getString('card'), interaction.options.getInteger('price'), idioma);
        return interaction.reply({ content: r.error ? `❌ ${r.error}` : r.texto, allowedMentions: { parse: [] } });
    },
};
