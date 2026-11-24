const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const combate = require('../utils/combate.js');
const K = require('../utils/cofresNucleo.js');
const C = require('../utils/combateNucleo.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });
const opcionCarta = (o, n) => o.setName(`card${n}`).setNameLocalizations(ES(`carta${n}`)).setDescription(`Card ${n}`).setDescriptionLocalizations(ES(`Carta ${n}`)).setAutocomplete(true);

// /combate (1.32.0): combates por turnos con tu compañero y tu mazo de cartas. Lógica en utils/combate.js.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('fight')
        .setNameLocalizations(ES('combate'))
        .setDescription('Turn-based battles with your companion and your card deck')
        .setDescriptionLocalizations(ES('Combates por turnos con tu compañero y tu mazo de cartas'))
        .setContexts(InteractionContextType.Guild)
        .addSubcommand((s) => s.setName('challenge').setNameLocalizations(ES('retar')).setDescription('Challenge someone to a battle').setDescriptionLocalizations(ES('Reta a alguien a un combate'))
            .addUserOption((o) => o.setName('member').setNameLocalizations(ES('miembro')).setDescription('Who').setDescriptionLocalizations(ES('A quién')).setRequired(true))
            .addIntegerOption((o) => o.setName('bet').setNameLocalizations(ES('apuesta')).setDescription('Gold each one bets (optional)').setDescriptionLocalizations(ES('Oro que apuesta cada uno (opcional)')).setMinValue(0).setMaxValue(1000000)))
        .addSubcommand((s) => s.setName('tower').setNameLocalizations(ES('torre')).setDescription('Climb the tower: a new floor every win (resets monthly)').setDescriptionLocalizations(ES('Sube la torre: un piso por victoria (se reinicia cada mes)')))
        .addSubcommand((s) => s.setName('practice').setNameLocalizations(ES('practica')).setDescription('Practice against a creature at your level (no risk)').setDescriptionLocalizations(ES('Practica contra una criatura de tu nivel (sin riesgo)')))
        .addSubcommand((s) => s.setName('boss').setNameLocalizations(ES('jefe')).setDescription('This week’s server boss').setDescriptionLocalizations(ES('El jefe de la semana del servidor')))
        .addSubcommand((s) => s.setName('profile').setNameLocalizations(ES('perfil')).setDescription('Battle profile: rank, record and fighter').setDescriptionLocalizations(ES('Perfil de combate: rango, victorias y luchador'))
            .addUserOption((o) => o.setName('member').setNameLocalizations(ES('miembro')).setDescription('Whose').setDescriptionLocalizations(ES('De quién'))))
        .addSubcommand((s) => s.setName('ranking').setNameLocalizations(ES('clasificacion')).setDescription('Server battle ranking').setDescriptionLocalizations(ES('Clasificación de combate del servidor')))
        .addSubcommand((s) => s.setName('deck').setNameLocalizations(ES('mazo')).setDescription('See or set your battle deck (up to 3 cards)').setDescriptionLocalizations(ES('Ver o preparar tu mazo de combate (hasta 3 cartas)'))
            .addStringOption((o) => opcionCarta(o, 1)).addStringOption((o) => opcionCarta(o, 2)).addStringOption((o) => opcionCarta(o, 3)))
        .addSubcommand((s) => s.setName('help').setNameLocalizations(ES('ayuda')).setDescription('How battles work').setDescriptionLocalizations(ES('Cómo funcionan los combates'))),

    async autocomplete(interaction) {
        const col = await ColeccionMascotas.findOne({ guildId: interaction.guildId, userId: interaction.user.id }).select('cartas holos').lean();
        const q = String(interaction.options.getFocused() || '').toLowerCase();
        const ops = (col?.cartas || []).map((c) => {
            const d = K.def(c.id);
            const tec = C.tecnicaDe(c.id, C.fuerzaCarta(c.id, c.estrellas || 1));
            return { orden: K.RAREZAS[d.rareza].orden * 10 + (c.estrellas || 1), name: `${(col.holos || []).includes(c.id) ? '🌈 ' : ''}${d.es} ${'★'.repeat(c.estrellas || 1)} · ⚔ ${tec.es}`.slice(0, 100), value: c.id, texto: `${d.es} ${d.serie} ${tec.es}`.toLowerCase() };
        }).filter((o) => !q || o.texto.includes(q)).sort((a, b) => b.orden - a.orden).slice(0, 25);
        await interaction.respond(ops.map(({ name, value }) => ({ name, value }))).catch(() => {});
    },

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const sub = interaction.options.getSubcommand();
        if (sub === 'help') return interaction.reply(combate.ayuda(idioma));
        if (!combate.activos(cfg)) return interaction.reply({ content: combate.textoApagado(idioma), flags: 64 });
        if (sub === 'challenge') {
            await interaction.deferReply();
            const r = await combate.retar(interaction, cfg, idioma, interaction.options.getUser('member'), interaction.options.getInteger('bet') || 0);
            if (r.error) { await interaction.deleteReply().catch(() => {}); return interaction.followUp({ content: `❌ ${r.error}`, flags: 64 }); }
            return interaction.editReply(r.msg);
        }
        if (sub === 'tower' || sub === 'practice') {
            await interaction.deferReply({ flags: 64 });
            const r = sub === 'tower' ? await combate.torre(interaction, cfg, idioma) : await combate.practica(interaction, cfg, idioma);
            return interaction.editReply({ content: r.error ? `❌ ${r.error}` : r.texto });
        }
        if (sub === 'boss') {
            const jefe = require('../utils/jefe.js');
            if (!jefe.activo(cfg)) return interaction.reply({ content: t(idioma, '🐉 El jefe semanal no está activado aquí (panel → Diversión → Casino → Combates).', '🐉 The weekly boss isn’t turned on here (panel → Fun → Casino → Battles).'), flags: 64 });
            await interaction.deferReply();
            return interaction.editReply(await jefe.vista(interaction.guild, await jefe.deEstaSemana(interaction.guildId, cfg), idioma));
        }
        if (sub === 'profile') {
            await interaction.deferReply();
            const u = interaction.options.getUser('member');
            return interaction.editReply(await combate.verPerfil(interaction, cfg, idioma, u && u.id !== interaction.user.id ? u : null));
        }
        if (sub === 'ranking') return interaction.reply(await combate.ranking(interaction, idioma));
        if (sub === 'deck') {
            const ids = [1, 2, 3].map((n) => interaction.options.getString(`card${n}`)).filter(Boolean);
            const r = await combate.mazo(interaction.guildId, interaction.user.id, ids, idioma, cfg);
            return interaction.reply(r.error ? { content: `❌ ${r.error}`, flags: 64 } : { ...r, flags: 64 });
        }
        return null;
    },
};
