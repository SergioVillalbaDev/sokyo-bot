const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const clanes = require('../utils/clanes.js');
const Clan = require('../models/Clan.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /clan crear · unirme · salir · info · ranking · expulsar
module.exports = {
    data: new SlashCommandBuilder()
        .setName('clan')
        .setDescription('Clans: teams that compete every week for XP')
        .setDescriptionLocalizations(ES('Clanes: equipos que compiten cada semana por XP'))
        .setContexts(InteractionContextType.Guild)
        .addSubcommand((s) => s.setName('create').setNameLocalizations(ES('crear'))
            .setDescription('Found a clan (you’ll be its leader)')
            .setDescriptionLocalizations(ES('Funda un clan (serás su líder)'))
            .addStringOption((o) => o.setName('name').setNameLocalizations(ES('nombre')).setDescription('Clan name').setDescriptionLocalizations(ES('Nombre del clan')).setRequired(true).setMinLength(3).setMaxLength(32))
            .addStringOption((o) => o.setName('emoji').setDescription('Its emoji, e.g. 🐺 (optional)').setDescriptionLocalizations(ES('Su emoji, por ejemplo 🐺 (opcional)')).setMaxLength(8)))
        .addSubcommand((s) => s.setName('join').setNameLocalizations(ES('unirme'))
            .setDescription('Join a clan')
            .setDescriptionLocalizations(ES('Únete a un clan'))
            .addStringOption((o) => o.setName('name').setNameLocalizations(ES('nombre')).setDescription('Which clan').setDescriptionLocalizations(ES('A qué clan')).setRequired(true).setAutocomplete(true)))
        .addSubcommand((s) => s.setName('leave').setNameLocalizations(ES('salir'))
            .setDescription('Leave your clan')
            .setDescriptionLocalizations(ES('Sal de tu clan')))
        .addSubcommand((s) => s.setName('info')
            .setDescription('A clan’s members and points (yours if you don’t pick one)')
            .setDescriptionLocalizations(ES('Los miembros y puntos de un clan (el tuyo si no eliges)'))
            .addStringOption((o) => o.setName('name').setNameLocalizations(ES('nombre')).setDescription('Which clan').setDescriptionLocalizations(ES('Qué clan')).setAutocomplete(true)))
        .addSubcommand((s) => s.setName('ranking')
            .setDescription('This week’s clan standings')
            .setDescriptionLocalizations(ES('La clasificación de clanes de esta semana')))
        .addSubcommand((s) => s.setName('kick').setNameLocalizations(ES('expulsar'))
            .setDescription('(Leader) Remove someone from your clan')
            .setDescriptionLocalizations(ES('(Líder) Echa a alguien de tu clan'))
            .addUserOption((o) => o.setName('member').setNameLocalizations(ES('miembro')).setDescription('Who').setDescriptionLocalizations(ES('A quién')).setRequired(true))),

    async autocomplete(interaction) {
        const escrito = clanes.clave(interaction.options.getFocused());
        const lista = await Clan.find({ guildId: interaction.guildId }).select('nombre nombreClave emoji miembros').limit(200).lean();
        await interaction.respond(lista
            .filter((c) => !escrito || c.nombreClave.includes(escrito))
            .slice(0, 25)
            .map((c) => ({ name: `${c.emoji} ${c.nombre} (${c.miembros.length})`.slice(0, 100), value: c.nombre })));
    },

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const sub = interaction.options.getSubcommand();
        const gid = interaction.guildId;
        const uid = interaction.user.id;
        const privado = (content) => interaction.reply({ content, flags: 64 });

        if (sub === 'ranking') {
            return interaction.reply({ embeds: [clanes.embedRanking(await clanes.ranking(gid, 10), idioma)], allowedMentions: { parse: [] } });
        }
        if (sub === 'info') {
            const nombre = interaction.options.getString('name');
            const clan = nombre ? await clanes.buscar(gid, nombre) : await clanes.clanDe(gid, uid);
            if (!clan) return privado(nombre ? t(idioma, 'No hay ningún clan con ese nombre.', 'There’s no clan with that name.') : t(idioma, 'No estás en ningún clan. Únete con `/clan unirme` o funda uno con `/clan crear`.', 'You’re not in a clan. Join one with `/clan join` or found one with `/clan create`.'));
            return interaction.reply({ embeds: [clanes.embedClan(clan, idioma)], allowedMentions: { parse: [] } });
        }
        if (!cfg?.clanes?.activo) return privado(t(idioma, '🛡️ Los clanes no están activados en este servidor.', '🛡️ Clans aren’t turned on on this server.'));

        if (sub === 'create') {
            const r = await clanes.crear(gid, uid, cfg, interaction.options.getString('name'), interaction.options.getString('emoji'), idioma);
            if (r.error) return privado(`❌ ${r.error}`);
            return interaction.reply({ content: t(idioma, `🛡️ ¡Has fundado **${r.clan.emoji} ${r.clan.nombre}**!${r.coste ? ` (🪙 ${r.coste})` : ''} Los demás se unen con \`/clan unirme\`. Cada XP que ganéis suma puntos para el clan.`, `🛡️ You founded **${r.clan.emoji} ${r.clan.nombre}**!${r.coste ? ` (🪙 ${r.coste})` : ''} Others join with \`/clan join\`. Every XP you earn adds points for the clan.`), allowedMentions: { parse: [] } });
        }
        if (sub === 'join') {
            const r = await clanes.unirse(gid, uid, cfg, interaction.options.getString('name'), idioma);
            if (r.error) return privado(`❌ ${r.error}`);
            return interaction.reply({ content: t(idioma, `🤝 <@${uid}> se ha unido a **${r.clan.emoji} ${r.clan.nombre}** (${r.clan.miembros.length} miembros).`, `🤝 <@${uid}> joined **${r.clan.emoji} ${r.clan.nombre}** (${r.clan.miembros.length} members).`), allowedMentions: { parse: [] } });
        }
        if (sub === 'leave') {
            const r = await clanes.salir(gid, uid, idioma);
            if (r.error) return privado(`❌ ${r.error}`);
            if (r.disuelto) return privado(t(idioma, `👋 Has salido de **${r.clan.nombre}**. Como no quedaba nadie, el clan ha desaparecido.`, `👋 You left **${r.clan.nombre}**. As nobody was left, the clan is gone.`));
            return privado(r.nuevoLider
                ? t(idioma, `👋 Has salido de **${r.clan.nombre}**. Ahora el líder es <@${r.nuevoLider}>.`, `👋 You left **${r.clan.nombre}**. The new leader is <@${r.nuevoLider}>.`)
                : t(idioma, `👋 Has salido de **${r.clan.nombre}**.`, `👋 You left **${r.clan.nombre}**.`));
        }
        if (sub === 'kick') {
            const objetivo = interaction.options.getUser('member');
            const r = await clanes.expulsar(gid, uid, objetivo.id, idioma);
            if (r.error) return privado(`❌ ${r.error}`);
            return privado(t(idioma, `✅ **${objetivo.username}** ya no está en **${r.clan.nombre}**.`, `✅ **${objetivo.username}** is no longer in **${r.clan.nombre}**.`));
        }
        return privado('?');
    },
};
