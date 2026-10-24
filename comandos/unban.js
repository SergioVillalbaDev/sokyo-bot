const { PermissionsBitField } = require('discord.js');
const Sancion = require('../models/Sancion.js');
const { revocarSancion } = require('../utils/moderationManager.js');
const { getConfigCached } = require('../utils/config.js');
const { miembroPuedeModerar } = require('../utils/permisos.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    name: 'unban',
    description: 'Removes a user’s ban. Usage: !unban <id or @user>',

    async execute(message, args, client) {
        const cfg = await getConfigCached(message.guild.id);
        if (!miembroPuedeModerar(message.member, cfg, PermissionsBitField.Flags.BanMembers)) {
            return message.reply(t(cfg, '❌ Necesitas el permiso Banear miembros.', '❌ You need the Ban Members permission.'));
        }

        // El usuario está fuera del servidor: por mención o por ID en bruto.
        let userId = message.mentions.users.first()?.id;
        if (!userId && /^\d{15,20}$/.test(args[0] || '')) userId = args[0];
        if (!userId) return message.reply(t(cfg, '❌ Indica el ID del usuario. Ej.: `!unban 123456789012345678`', '❌ Provide the user ID. e.g. `!unban 123456789012345678`'));

        try {
            // Si hay un ban activo registrado, lo revocamos (desbanea + actualiza el registro).
            const activa = await Sancion.findOne({ guildId: message.guild.id, usuarioId: userId, accion: 'ban', activa: true, revocada: false });
            if (activa) {
                await revocarSancion(client, activa._id, { id: message.author.id, tag: message.author.username });
                return message.reply(t(cfg, '✅ Usuario desbaneado y registro actualizado.', '✅ User unbanned and record updated.'));
            }
            // Sin registro: desbaneo directo.
            await message.guild.members.unban(userId, t(cfg, `Desbaneado por ${message.author.username}`, `Unban by ${message.author.username}`));
            return message.reply(t(cfg, '✅ Usuario desbaneado.', '✅ User unbanned.'));
        } catch (e) {
            return message.reply(t(cfg, `❌ No se ha podido desbanear (¿estaba baneado?). ${e.message}`, `❌ Couldn’t unban (were they banned?). ${e.message}`));
        }
    },
};
