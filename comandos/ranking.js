const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const { getConfigCached } = require('../utils/config.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    name: 'ranking',
    description: 'Show the server’s level leaderboard. Usage: !ranking',

    async execute(message) {
        const cfg = await getConfigCached(message.guild.id);
        if (!cfg?.nivelesActivo) return message.reply(t(cfg, 'ℹ️ El sistema de niveles no está activado en este servidor.', 'ℹ️ The leveling system isn’t enabled on this server.'));

        const top = await ActividadUsuario.find({ guildId: message.guild.id, xp: { $gt: 0 } }).sort({ xp: -1 }).limit(10);
        if (top.length === 0) return message.reply(t(cfg, 'Todavía no hay actividad registrada para el ranking.', 'No activity recorded for the leaderboard yet.'));

        const medallas = ['🥇', '🥈', '🥉'];
        const lineas = top.map((u, i) => {
            const pos = medallas[i] || `**${i + 1}.**`;
            return t(cfg, `${pos} <@${u.userId}> — Nivel **${u.nivel}** · ${u.xp} XP`, `${pos} <@${u.userId}> — Level **${u.nivel}** · ${u.xp} XP`);
        });

        const titulo = t(cfg, `🏆 Ranking de ${message.guild.name}`, `🏆 ${message.guild.name} leaderboard`);
        // 1.31.0: podio con las fotos de los 3 primeros y barras para el resto (imagen).
        const filas = await Promise.all(top.map(async (u) => {
            const m = message.guild.members.cache.get(u.userId) || await message.guild.members.fetch(u.userId).catch(() => null);
            // Quien ya no está en el servidor: su usuario de Discord (o lo último que se guardó).
            const us = m ? null : await message.client?.users?.fetch(u.userId).catch(() => null);
            return { nombre: m?.displayName || us?.username || u.usuarioTag || `#${String(u.userId).slice(-4)}`, avatar: (m || us) ? (m || us).displayAvatarURL({ extension: 'png', size: 128 }) : null, nivel: u.nivel, xp: u.xp };
        }));
        const png = await require('../utils/arteVistas.js').tarjetaRanking({ titulo, filas, idioma: t(cfg, 'es', 'en'), textos: { nivel: t(cfg, 'Nv.', 'Lv.') } }).catch(() => null);
        const embed = new EmbedBuilder().setColor('#f1c40f').setTitle(titulo);
        if (png) embed.setImage('attachment://ranking.png');
        else embed.setDescription(lineas.join('\n'));
        await message.reply({ embeds: [embed], files: png ? [new AttachmentBuilder(png, { name: 'ranking.png' })] : [], allowedMentions: { parse: [] } });
    },
};
