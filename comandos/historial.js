const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const Sancion = require('../models/Sancion.js');
const { getConfigCached } = require('../utils/config.js');
const { miembroPuedeModerar } = require('../utils/permisos.js');

const ICONO = { aviso: '⚠️', timeout: '🔇', expulsion: '👢', ban: '🔨' };
const dur = (m) => (!m ? '' : ` · ${m >= 1440 ? `${Math.round(m / 1440)}d` : m >= 60 ? `${Math.round(m / 60)}h` : `${m}m`}`);

module.exports = {
    name: 'history',
    description: 'Show a user’s sanction history. Usage: !history <id or @user>',

    async execute(message, args) {
        const cfg = await getConfigCached(message.guild.id);
        if (!miembroPuedeModerar(message.member, cfg, PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ You need moderation permission.');
        }

        let userId = message.mentions.users.first()?.id;
        if (!userId && /^\d{15,20}$/.test(args[0] || '')) userId = args[0];
        if (!userId) return message.reply('❌ Mention or provide the user ID. e.g. `!history @user`');

        const sanciones = await Sancion.find({ guildId: message.guild.id, usuarioId: userId }).sort({ fecha: -1 }).limit(10);
        if (sanciones.length === 0) return message.reply('✅ This user has no recorded sanctions.');

        const lineas = sanciones.map((s) => {
            const t = Math.floor(new Date(s.fecha).getTime() / 1000);
            const rev = s.revocada ? ' · ↩️ revoked' : '';
            return `${ICONO[s.accion] || ''} **${s.tipoNombre || s.accion}**${dur(s.duracionMin)} — <t:${t}:R> · by ${s.moderadorTag}${rev}\n┕ ${s.motivo || '_no reason_'}`;
        });

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📋 Sanction history')
            .setDescription(lineas.join('\n\n').slice(0, 4096))
            .setFooter({ text: `${sanciones.length} sanction(s) recorded` });

        await message.reply({ embeds: [embed] });
    },
};
