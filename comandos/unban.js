const { PermissionsBitField } = require('discord.js');
const Sancion = require('../models/Sancion.js');
const { revocarSancion } = require('../utils/moderationManager.js');
const { getConfigCached } = require('../utils/config.js');
const { miembroPuedeModerar } = require('../utils/permisos.js');

module.exports = {
    name: 'unban',
    description: 'Quita el ban a un usuario. Uso: !unban <id o @usuario>',

    async execute(message, args, client) {
        const cfg = await getConfigCached(message.guild.id);
        if (!miembroPuedeModerar(message.member, cfg, PermissionsBitField.Flags.BanMembers)) {
            return message.reply('❌ Necesitas permiso de Banear miembros.');
        }

        // El usuario está fuera del servidor: por mención o por ID en bruto.
        let userId = message.mentions.users.first()?.id;
        if (!userId && /^\d{15,20}$/.test(args[0] || '')) userId = args[0];
        if (!userId) return message.reply('❌ Indica el ID del usuario. Ej: `!unban 123456789012345678`');

        try {
            // Si hay un ban activo registrado, lo revocamos (desbanea + actualiza el registro).
            const activa = await Sancion.findOne({ guildId: message.guild.id, usuarioId: userId, accion: 'ban', activa: true, revocada: false });
            if (activa) {
                await revocarSancion(client, activa._id, { id: message.author.id, tag: message.author.username });
                return message.reply('✅ Usuario desbaneado y registro actualizado.');
            }
            // Sin registro: desbaneo directo.
            await message.guild.members.unban(userId, `Unban por ${message.author.username}`);
            return message.reply('✅ Usuario desbaneado.');
        } catch (e) {
            return message.reply(`❌ No se pudo desbanear (¿estaba baneado?). ${e.message}`);
        }
    },
};
