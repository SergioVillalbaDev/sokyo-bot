const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const liga = require('../utils/liga.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /comunidad liga ver · impulsar
module.exports = {
    data: new SlashCommandBuilder()
        .setName('league')
        .setNameLocalizations(ES('liga'))
        .setDescription('Sokyo League: the monthly ranking of servers')
        .setDescriptionLocalizations(ES('Liga Sokyo: la clasificación mensual de servidores'))
        .setContexts(InteractionContextType.Guild)
        .addSubcommand((s) => s.setName('view').setNameLocalizations(ES('ver'))
            .setDescription('The standings and where this server is')
            .setDescriptionLocalizations(ES('La clasificación y dónde está este servidor')))
        .addSubcommand((s) => s.setName('boost').setNameLocalizations(ES('impulsar'))
            .setDescription(`Spend gold to push this server up (${liga.ORO_POR_PUNTO} gold = 1 point)`)
            .setDescriptionLocalizations(ES(`Gasta oro para subir este servidor (${liga.ORO_POR_PUNTO} de oro = 1 punto)`))
            .addIntegerOption((o) => o.setName('gold').setNameLocalizations(ES('oro')).setDescription('How much gold').setDescriptionLocalizations(ES('Cuánto oro')).setRequired(true).setMinValue(liga.ORO_POR_PUNTO).setMaxValue(liga.TOPE_ORO_DIA))),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const sub = interaction.options.getSubcommand();
        if (!cfg?.liga?.activo) return interaction.reply({ content: t(idioma, '🏆 Este servidor no está en la Liga Sokyo. El staff puede apuntarlo en el panel (Crecimiento → Liga Sokyo).', '🏆 This server isn’t in the Sokyo League. The staff can sign it up in the panel (Growth → Sokyo League).'), flags: 64 });
        if (sub === 'view') {
            const top = await liga.clasificacion(client, undefined, 10);
            const mio = await liga.posicionDe(interaction.guildId);
            return interaction.reply({ embeds: [liga.embedClasificacion(top, idioma, { mio })], allowedMentions: { parse: [] } });
        }
        const r = await liga.impulsar(interaction.guildId, interaction.user.id, cfg, interaction.options.getInteger('gold'), idioma);
        if (r.error) return interaction.reply({ content: `❌ ${r.error}`, flags: 64 });
        return interaction.reply({ content: t(idioma, `🚀 <@${interaction.user.id}> ha impulsado el servidor con 🪙 ${r.cantidad}: **+${r.puntos}** puntos de Liga${r.extraCompa ? ` (${r.extraCompa} gracias a su compañero)` : ''} (ya sois **${r.total}**).`, `🚀 <@${interaction.user.id}> boosted the server with 🪙 ${r.cantidad}: **+${r.puntos}** League points${r.extraCompa ? ` (${r.extraCompa} thanks to their companion)` : ''} (now **${r.total}**).`), allowedMentions: { parse: [] } });
    },
};
