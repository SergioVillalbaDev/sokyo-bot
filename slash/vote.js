const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const votos = require('../utils/votos.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /votar — enlace para votar por el bot en top.gg, qué se gana y cuándo se puede volver a votar.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setNameLocalizations(ES('votar'))
        .setDescription('Vote for Sokyo on top.gg and earn gold (and rewards on this server)')
        .setDescriptionLocalizations(ES('Vota por Sokyo en top.gg y gana oro (y premios en este servidor)')),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const { proximo, total } = await votos.estadoVoto(interaction.user.id);
        const oro = votos.ORO_POR_VOTO();
        const v = cfg?.crecimiento?.votos;
        const extras = [];
        if (v?.activo && interaction.guild) {
            if (v.rolId && interaction.guild.roles.cache.has(v.rolId)) extras.push(t(idioma, `el rol <@&${v.rolId}> durante ${v.horasRol || 12} h`, `the <@&${v.rolId}> role for ${v.horasRol || 12} h`));
            if (v.xp > 0 && cfg.nivelesActivo) extras.push(`${v.xp} XP`);
        }
        const embed = new EmbedBuilder()
            .setColor(0xff3366)
            .setTitle(t(idioma, '🗳️ Vota por Sokyo', '🗳️ Vote for Sokyo'))
            .setDescription([
                t(idioma, `Cada voto te da **${oro} de oro** (el doble el fin de semana)`, `Each vote gives you **${oro} gold** (double on weekends)`)
                    + (extras.length ? t(idioma, ` y, en este servidor, ${extras.join(' y ')}.`, ` and, on this server, ${extras.join(' and ')}.`) : '.'),
                t(idioma, 'Se puede votar cada 12 horas. ¡Así el bot llega a más gente!', 'You can vote every 12 hours. It helps the bot reach more people!'),
                '',
                proximo
                    ? t(idioma, `⏳ Ya has votado: puedes volver a votar <t:${Math.floor(proximo.getTime() / 1000)}:R>.`, `⏳ You’ve already voted: you can vote again <t:${Math.floor(proximo.getTime() / 1000)}:R>.`)
                    : t(idioma, '✅ ¡Ya puedes votar!', '✅ You can vote now!'),
                total ? t(idioma, `Llevas ${total} ${total === 1 ? 'voto' : 'votos'}. ¡Gracias!`, `You’ve voted ${total} ${total === 1 ? 'time' : 'times'}. Thank you!`) : '',
            ].filter((l) => l !== null).join('\n'));
        const fila = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(votos.urlVoto(client.user.id)).setLabel(t(idioma, 'Votar en top.gg', 'Vote on top.gg')).setEmoji('🗳️'),
        );
        return interaction.reply({ embeds: [embed], components: [fila], flags: 64 });
    },
};
