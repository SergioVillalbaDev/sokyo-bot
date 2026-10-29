const { embedInvitaciones } = require('../utils/invitaciones.js');
const { t } = require('../utils/i18n.js');

// Crecimiento · igual que /invites. Uso: !invites [@usuario]
module.exports = {
    name: 'invites',
    aliases: ['invitaciones'], // en español también
    description: 'See how many people you (or someone) have invited. Usage: !invites [@user]',

    async execute(message, args, client, cfg) {
        if (!cfg?.crecimiento?.invitaciones?.activo) {
            return message.reply(t(cfg, 'ℹ️ El seguimiento de invitaciones no está activado en este servidor (panel → Crecimiento → Invitaciones).', 'ℹ️ Invite tracking isn’t enabled on this server (panel → Growth → Invites).'));
        }
        const usuario = message.mentions.users.first() || message.author;
        const embed = await embedInvitaciones(message.guild, usuario, cfg);
        await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    },
};
