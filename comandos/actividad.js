const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const RegistroMensaje = require('../models/RegistroMensaje.js');
const { getConfigCached } = require('../utils/config.js');
const { miembroPuedeModerar } = require('../utils/permisos.js');

module.exports = {
    name: 'activity',
    description: 'Show a user’s activity. Usage: !activity @user',

    async execute(message, args, client) {
        // Requiere permiso de moderación (es información sensible).
        const cfg = await getConfigCached(message.guild.id);
        if (!miembroPuedeModerar(message.member, cfg, PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ You need moderation permission to view activity.');
        }

        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Mention a user. e.g. `!activity @user`');

        const act = await ActividadUsuario.findOne({ guildId: message.guild.id, userId: target.id });
        const ultimos = await RegistroMensaje.find({ guildId: message.guild.id, userId: target.id }).sort({ fecha: -1 }).limit(5);

        // ¿Está en voz AHORA MISMO? (estado en vivo, no la BD)
        const member = await message.guild.members.fetch(target.id).catch(() => null);
        const canalVozAhora = member?.voice?.channelId || null;

        // <t:unix:R> = "hace X" relativo, lo renderiza Discord.
        const rel = (d) => (d ? `<t:${Math.floor(new Date(d).getTime() / 1000)}:R>` : '—');

        const voz = canalVozAhora
            ? `🟢 **In voice now** in <#${canalVozAhora}>`
            : (act?.ultimaVozFecha ? `${rel(act.ultimaVozFecha)} in <#${act.ultimaVozCanalId}>` : 'No record');

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: `${target.username}’s activity`, iconURL: target.displayAvatarURL() })
            .addFields(
                { name: '💬 Last message', value: act?.ultimoMensajeFecha ? `${rel(act.ultimoMensajeFecha)} in <#${act.ultimoMensajeCanalId}>` : 'No record', inline: false },
                { name: '📊 Messages', value: String(act?.mensajesTotal || 0), inline: true },
                { name: '🔊 Voice', value: voz, inline: true },
            );

        if (ultimos.length) {
            embed.addFields({
                name: '🗒️ Recent messages',
                value: ultimos.map((m) => `• ${m.contenido ? m.contenido.slice(0, 80) : '_(attachment / empty)_'}`).join('\n').slice(0, 1024),
            });
        }

        await message.reply({ embeds: [embed] });
    },
};
