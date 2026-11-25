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
        .setDescription('Vote for Sokyo every 12 h: gold, a free chest every day and an epic one every 7 days')
        .setDescriptionLocalizations(ES('Vota por Sokyo cada 12 h: oro, un cofre gratis al día y uno épico cada 7 días'))
        .addBooleanOption((o) => o.setName('remind').setNameLocalizations(ES('recordar'))
            .setDescription('Get a DM when you can vote again (every 12 h)')
            .setDescriptionLocalizations(ES('Recibe un privado cuando puedas volver a votar (cada 12 h)'))),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const recordar = interaction.options.getBoolean('remind');
        if (recordar !== null) await votos.ponerRecordatorio(interaction.user.id, recordar);
        const conAviso = await votos.tieneRecordatorio(interaction.user.id);
        const { proximo, total } = await votos.estadoVoto(interaction.user.id);
        const racha = await votos.rachaVotos(interaction.user.id).catch(() => 0);
        const faltan = 7 - (racha % 7 || 7);
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
                t(idioma, 'Tarda 10 segundos y lo ganas **en cada servidor donde juegas con Sokyo**:', 'It takes 10 seconds and you get it **on every server where you play with Sokyo**:'),
                t(idioma, `🪙 **${oro} de oro** por voto (el doble el fin de semana) · se vota cada 12 h`, `🪙 **${oro} gold** per vote (double on weekends) · vote every 12 h`),
                t(idioma, '📦 **Un cofre básico gratis** con tu primer voto de cada día', '📦 **A free basic chest** with your first vote each day'),
                t(idioma, '💜 **Un cofre épico** cada 7 días seguidos votando', '💜 **An epic chest** every 7 days in a row'),
                t(idioma, '🎟️ XP para tu pase de temporada', '🎟️ XP for your season pass'),
                extras.length ? t(idioma, `✨ Y en este servidor, además: ${extras.join(' y ')}.`, `✨ And on this server, also: ${extras.join(' and ')}.`) : null,
                '',
                racha ? t(idioma, `🔥 Racha: **${racha} ${racha === 1 ? 'día' : 'días'}**${faltan ? ` · cofre épico en ${faltan} ${faltan === 1 ? 'día' : 'días'}` : ' · ¡hoy toca cofre épico!'}`, `🔥 Streak: **${racha} day${racha === 1 ? '' : 's'}**${faltan ? ` · epic chest in ${faltan} day${faltan === 1 ? '' : 's'}` : ' · epic chest today!'}`) : null,
                proximo
                    ? t(idioma, `⏳ Ya has votado: puedes volver a votar <t:${Math.floor(proximo.getTime() / 1000)}:R>.`, `⏳ You’ve already voted: you can vote again <t:${Math.floor(proximo.getTime() / 1000)}:R>.`)
                    : t(idioma, '✅ ¡Ya puedes votar!', '✅ You can vote now!'),
                total ? t(idioma, `Llevas ${total} ${total === 1 ? 'voto' : 'votos'}. ¡Gracias!`, `You’ve voted ${total} ${total === 1 ? 'time' : 'times'}. Thank you!`) : '',
                conAviso
                    ? t(idioma, '🔔 Te avisaremos por privado cuando puedas volver a votar (quítalo con `/votar recordar:no`).', '🔔 We’ll DM you when you can vote again (turn it off with `/vote remind:no`).')
                    : t(idioma, '-# ¿Quieres un aviso cada 12 h? Usa `/votar recordar:sí`.', '-# Want a reminder every 12 h? Use `/vote remind:true`.'),
            ].filter((l) => l !== null).join('\n'));
        const fila = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(votos.urlVoto(client.user.id)).setLabel(t(idioma, 'Votar en top.gg', 'Vote on top.gg')).setEmoji('🗳️'),
        );
        return interaction.reply({ embeds: [embed], components: [fila], flags: 64 });
    },
};
