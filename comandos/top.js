const { EmbedBuilder } = require('discord.js');
const MiembroStats = require('../models/MiembroStats.js');

module.exports = {
    name: 'top',
    description: 'Ranking de niveles: !top  |  ranking de invitaciones: !top invitaciones',
    async execute(message, args) {
        const porInvitaciones = ['invitaciones', 'invites', 'inv'].includes((args[0] || '').toLowerCase());

        const filas = porInvitaciones
            ? await MiembroStats.find({ guildId: message.guild.id, invitaciones: { $gt: 0 } }).sort({ invitaciones: -1 }).limit(50)
            : await MiembroStats.find({ guildId: message.guild.id, xp: { $gt: 0 } }).sort({ xp: -1 }).limit(10);

        let lista = filas;
        if (porInvitaciones) {
            lista = filas
                .map(f => ({ userId: f.userId, valor: f.invitaciones - f.invitacionesSalidas, total: f.invitaciones }))
                .sort((a, b) => b.valor - a.valor).slice(0, 10);
        } else {
            lista = filas.map(f => ({ userId: f.userId, valor: f.xp, nivel: f.nivel }));
        }
        if (lista.length === 0) return message.reply('📭 Todavía no hay datos para el ranking.');

        const medallas = ['🥇', '🥈', '🥉'];
        const descripcion = lista.map((f, i) => {
            const detalle = porInvitaciones ? `**${f.valor}** invitaciones (${f.total} totales)` : `Nivel **${f.nivel}** · ${f.valor} XP`;
            return `${medallas[i] || `**${i + 1}.**`} <@${f.userId}> — ${detalle}`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle(porInvitaciones ? '📨 Top invitaciones' : '🏆 Top niveles')
            .setDescription(descripcion);
        await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    }
};
