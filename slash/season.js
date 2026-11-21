const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require('discord.js');
const temporadas = require('../utils/temporadas.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });
const MEDALLAS = ['🥇', '🥈', '🥉'];

// /temporada — el ranking de la temporada en curso, cuándo acaba y en qué puesto vas.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('season')
        .setNameLocalizations(ES('temporada'))
        .setDescription('The current season ranking: prizes for the top 3 when it ends')
        .setDescriptionLocalizations(ES('El ranking de la temporada: premios para los 3 primeros al terminar'))
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        const tp = cfg?.temporadas;
        if (!tp?.activo || !tp.fin) {
            return interaction.reply({ content: t(cfg, 'ℹ️ Las temporadas no están activadas en este servidor (panel → Diversión → Temporadas).', 'ℹ️ Seasons aren’t turned on in this server (panel → Fun → Seasons).'), flags: 64 });
        }
        const lista = await temporadas.ranking(interaction.guild.id, 10, { guild: interaction.guild, excluir: tp.excluirRoles });
        const yo = await temporadas.posicion(interaction.guild.id, interaction.user.id);
        const oro = temporadas.oroPodio(tp.oro);
        const premios = oro.map((o, i) => (o > 0 ? `${MEDALLAS[i]} ${o.toLocaleString('es-ES')} 🪙` : null)).filter(Boolean).join(' · ');
        const embed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(t(cfg, `🏆 Temporada ${tp.numero || 1}`, `🏆 Season ${tp.numero || 1}`))
            .setDescription([
                t(cfg, `Termina <t:${Math.floor(new Date(tp.fin).getTime() / 1000)}:R>.`, `Ends <t:${Math.floor(new Date(tp.fin).getTime() / 1000)}:R>.`)
                    + (premios ? ` ${t(cfg, 'Premios', 'Prizes')}: ${premios}` : '')
                    + (tp.rolCampeonId ? t(cfg, ` · el 1.º se lleva <@&${tp.rolCampeonId}>`, ` · 1st gets <@&${tp.rolCampeonId}>`) : ''),
                '',
                lista.length
                    ? lista.map((r, i) => `${MEDALLAS[i] || `**${i + 1}.**`} <@${r.userId}> · ${r.xpTemporada.toLocaleString('es-ES')} XP`).join('\n')
                    : t(cfg, 'Nadie ha ganado XP todavía: ¡escribe y entra en el ranking!', 'Nobody has earned XP yet: chat to get on the board!'),
                '',
                yo ? t(cfg, `Tú vas **${yo.puesto}.º** con ${yo.xp.toLocaleString('es-ES')} XP.`, `You’re **#${yo.puesto}** with ${yo.xp.toLocaleString('es-ES')} XP.`)
                    : t(cfg, 'Aún no tienes XP en esta temporada.', 'You don’t have any XP this season yet.'),
            ].join('\n'));
        return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    },
};
