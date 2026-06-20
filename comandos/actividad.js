const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const RegistroMensaje = require('../models/RegistroMensaje.js');
const { getConfigCached } = require('../utils/config.js');
const { miembroPuedeModerar } = require('../utils/permisos.js');

module.exports = {
    name: 'actividad',
    description: 'Muestra la actividad de un usuario. Uso: !actividad @usuario',

    async execute(message, args, client) {
        // Requiere permiso de moderación (es información sensible).
        const cfg = await getConfigCached(message.guild.id);
        if (!miembroPuedeModerar(message.member, cfg, PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Necesitas permiso de moderación para ver la actividad.');
        }

        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Menciona a un usuario. Ej: `!actividad @usuario`');

        const act = await ActividadUsuario.findOne({ guildId: message.guild.id, userId: target.id });
        const ultimos = await RegistroMensaje.find({ guildId: message.guild.id, userId: target.id }).sort({ fecha: -1 }).limit(5);

        // ¿Está en voz AHORA MISMO? (estado en vivo, no la BD)
        const member = await message.guild.members.fetch(target.id).catch(() => null);
        const canalVozAhora = member?.voice?.channelId || null;

        // <t:unix:R> = "hace X" relativo, lo renderiza Discord.
        const rel = (d) => (d ? `<t:${Math.floor(new Date(d).getTime() / 1000)}:R>` : '—');

        const voz = canalVozAhora
            ? `🟢 **En voz ahora** en <#${canalVozAhora}>`
            : (act?.ultimaVozFecha ? `${rel(act.ultimaVozFecha)} en <#${act.ultimaVozCanalId}>` : 'Sin registro');

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: `Actividad de ${target.username}`, iconURL: target.displayAvatarURL() })
            .addFields(
                { name: '💬 Último mensaje', value: act?.ultimoMensajeFecha ? `${rel(act.ultimoMensajeFecha)} en <#${act.ultimoMensajeCanalId}>` : 'Sin registro', inline: false },
                { name: '📊 Mensajes', value: String(act?.mensajesTotal || 0), inline: true },
                { name: '🔊 Voz', value: voz, inline: true },
            );

        if (ultimos.length) {
            embed.addFields({
                name: '🗒️ Últimos mensajes',
                value: ultimos.map((m) => `• ${m.contenido ? m.contenido.slice(0, 80) : '_(adjunto / vacío)_'}`).join('\n').slice(0, 1024),
            });
        }

        await message.reply({ embeds: [embed] });
    },
};
