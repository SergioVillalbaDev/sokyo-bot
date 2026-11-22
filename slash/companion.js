const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const compis = require('../utils/compis.js');
const K = require('../utils/cofresNucleo.js');
const P = require('../utils/compisNucleo.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /compi [compañero] [miembro]: tu compañero tipo tamagotchi (1.20.0). Los compañeros se
// consiguen en los cofres (/cofre). Botones y lógica en utils/compis.js.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('companion')
        .setNameLocalizations(ES('compi'))
        .setDescription('Your companion: feed it, play, talk and send it on expeditions')
        .setDescriptionLocalizations(ES('Tu compañero: dale de comer, juega, habla con él y mándalo de expedición'))
        .setContexts(InteractionContextType.Guild)
        .addStringOption((o) => o.setName('companion').setNameLocalizations(ES('compañero')).setDescription('Which one (by default, the one you have equipped)').setDescriptionLocalizations(ES('Cuál (si no, el que llevas equipado)')).setAutocomplete(true))
        .addUserOption((o) => o.setName('member').setNameLocalizations(ES('miembro')).setDescription('See someone else’s companion').setDescriptionLocalizations(ES('Ver el compañero de otra persona'))),

    async autocomplete(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg).catch(() => 'es');
        const col = await ColeccionMascotas.findOne({ userId: interaction.user.id }).select('mascotas').lean();
        const q = String(interaction.options.getFocused() || '').toLowerCase();
        const ops = (col?.mascotas || []).map((m) => {
            const d = K.def(m.id);
            const nombre = m.apodo ? `${m.apodo} (${t(idioma, d.es, d.en).split(',')[0]})` : t(idioma, d.es, d.en);
            return { name: `${d.emoji} ${nombre} · ${t(idioma, 'nivel', 'level')} ${P.nivel(m.afinidad || 0)}`.slice(0, 100), value: m.id };
        }).filter((o) => !q || o.name.toLowerCase().includes(q)).slice(0, 25);
        await interaction.respond(ops).catch(() => {});
    },

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const otro = interaction.options.getUser('member');
        const quien = otro && otro.id !== interaction.user.id ? otro : interaction.user;
        const member = otro ? interaction.options.getMember('member') : interaction.member;
        const nombre = member?.displayName || quien.globalName || quien.username;
        await interaction.deferReply();
        const res = await compis.accion(quien.id, interaction.options.getString('companion'), 'ver', { idioma, dueno: nombre });
        if (res.fallo === 'sin') {
            return interaction.editReply({ content: otro ? t(idioma, `${nombre} aún no tiene compañeros.`, `${nombre} has no companions yet.`) : compis.textoFallo('sin', idioma), allowedMentions: { parse: [] } });
        }
        return interaction.editReply(await compis.vista({ ownerId: quien.id, duenoNombre: nombre, idioma, res, ajeno: quien.id !== interaction.user.id, cfg }));
    },
};
