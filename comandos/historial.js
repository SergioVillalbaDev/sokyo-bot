const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const Sancion = require('../models/Sancion.js');
const { getConfigCached } = require('../utils/config.js');
const { miembroPuedeModerar } = require('../utils/permisos.js');

const ICONO = { aviso: '⚠️', timeout: '🔇', expulsion: '👢', ban: '🔨' };
const dur = (m) => (!m ? '' : ` · ${m >= 1440 ? `${Math.round(m / 1440)}d` : m >= 60 ? `${Math.round(m / 60)}h` : `${m}m`}`);

module.exports = {
    name: 'historial',
    description: 'Muestra el historial de sanciones de un usuario. Uso: !historial <id o @usuario>',

    async execute(message, args) {
        const cfg = await getConfigCached(message.guild.id);
        if (!miembroPuedeModerar(message.member, cfg, PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Necesitas permiso de moderación.');
        }

        let userId = message.mentions.users.first()?.id;
        if (!userId && /^\d{15,20}$/.test(args[0] || '')) userId = args[0];
        if (!userId) return message.reply('❌ Menciona o indica el ID del usuario. Ej: `!historial @usuario`');

        const sanciones = await Sancion.find({ guildId: message.guild.id, usuarioId: userId }).sort({ fecha: -1 }).limit(10);
        if (sanciones.length === 0) return message.reply('✅ Este usuario no tiene sanciones registradas.');

        const lineas = sanciones.map((s) => {
            const t = Math.floor(new Date(s.fecha).getTime() / 1000);
            const rev = s.revocada ? ' · ↩️ revocada' : '';
            return `${ICONO[s.accion] || ''} **${s.tipoNombre || s.accion}**${dur(s.duracionMin)} — <t:${t}:R> · por ${s.moderadorTag}${rev}\n┕ ${s.motivo || '_sin motivo_'}`;
        });

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📋 Historial de sanciones')
            .setDescription(lineas.join('\n\n').slice(0, 4096))
            .setFooter({ text: `${sanciones.length} sanción(es) registradas` });

        await message.reply({ embeds: [embed] });
    },
};
