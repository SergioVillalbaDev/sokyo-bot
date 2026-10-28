const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const Sancion = require('../models/Sancion.js');
const { getConfigCached } = require('../utils/config.js');
const { miembroPuedeModerar } = require('../utils/permisos.js');
const { t } = require('../utils/i18n.js');

const ICONO = { aviso: '⚠️', timeout: '🔇', expulsion: '👢', ban: '🔨' };
const dur = (m) => (!m ? '' : ` · ${m >= 1440 ? `${Math.round(m / 1440)}d` : m >= 60 ? `${Math.round(m / 60)}h` : `${m}m`}`);

module.exports = {
    name: 'history',
    aliases: ['historial'], // en español también
    description: 'Show a user’s sanction history. Usage: !history <id or @user>',

    async execute(message, args) {
        const cfg = await getConfigCached(message.guild.id);
        if (!miembroPuedeModerar(message.member, cfg, PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply(t(cfg, '❌ Necesitas permiso de moderación.', '❌ You need moderation permission.'));
        }

        let userId = message.mentions.users.first()?.id;
        if (!userId && /^\d{15,20}$/.test(args[0] || '')) userId = args[0];
        if (!userId) return message.reply(t(cfg, '❌ Menciona al usuario o pon su ID. Ej.: `!history @usuario`', '❌ Mention or provide the user ID. e.g. `!history @user`'));

        const sanciones = await Sancion.find({ guildId: message.guild.id, usuarioId: userId }).sort({ fecha: -1 }).limit(10);
        if (sanciones.length === 0) return message.reply(t(cfg, '✅ Este usuario no tiene sanciones registradas.', '✅ This user has no recorded sanctions.'));

        const lineas = sanciones.map((s) => {
            const ts = Math.floor(new Date(s.fecha).getTime() / 1000);
            const rev = s.revocada ? t(cfg, ' · ↩️ revocada', ' · ↩️ revoked') : '';
            return `${ICONO[s.accion] || ''} **${s.tipoNombre || s.accion}**${dur(s.duracionMin)} — <t:${ts}:R> · ${t(cfg, 'por', 'by')} ${s.moderadorTag}${rev}\n┕ ${s.motivo || t(cfg, '_sin motivo_', '_no reason_')}`;
        });

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(t(cfg, '📋 Historial de sanciones', '📋 Sanction history'))
            .setDescription(lineas.join('\n\n').slice(0, 4096))
            .setFooter({ text: t(cfg, `${sanciones.length} sanción(es) registrada(s)`, `${sanciones.length} sanction(s) recorded`) });

        await message.reply({ embeds: [embed] });
    },
};
