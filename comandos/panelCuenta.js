const { PermissionsBitField } = require('discord.js');
const { publicarPanelCuenta, puedePublicar } = require('../utils/cuenta.js');
const { t } = require('../utils/i18n.js');

// Igual que /panel-cuenta: publica (o actualiza) en este canal el botón para que
// cada miembro entre a su cuenta con un clic. Borra el comando para no ensuciar.
module.exports = {
    name: 'accountpanel',
    aliases: ['panelcuenta', 'panel-cuenta', 'account-panel', 'botoncuenta'],
    description: 'Post the “My account” button in this channel. Usage: !accountpanel',

    async execute(message, args, client, cfg) {
        if (!message.guild) return;
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply(t(cfg, '❌ Necesitas el permiso «Gestionar servidor».', '❌ You need the “Manage Server” permission.')).catch(() => {});
        }
        if (!puedePublicar(message.channel)) {
            return message.reply(t(cfg, '❌ No puedo publicar aquí: dame «Enviar mensajes» e «Insertar enlaces» en este canal.', '❌ I can’t post here: give me “Send Messages” and “Embed Links” in this channel.')).catch(() => {});
        }
        await publicarPanelCuenta(message.channel, cfg);
        await message.delete().catch(() => {});
    },
};
