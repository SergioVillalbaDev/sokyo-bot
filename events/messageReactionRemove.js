const { Events } = require('discord.js');
const RolePanel = require('../models/RolePanel.js');
const { emojiDeReaccion } = require('../utils/rolePanelManager.js');
const RolTemporal = require('../models/RolTemporal.js');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user) {
        if (user.bot) return;
        try {
            if (reaction.partial) await reaction.fetch();
            const panel = await RolePanel.findOne({ messageId: reaction.message.id, tipo: 'reaccion' });
            if (!panel) return;
            if (panel.permitirQuitar === false) return; // este panel no permite quitarse el rol

            const emoji = emojiDeReaccion(reaction);
            const item = panel.items.find((i) => i.emoji === emoji || i.emoji === reaction.emoji.name);
            if (!item) return;

            const member = await reaction.message.guild.members.fetch(user.id);
            await member.roles.remove(item.roleId).catch(() => {});
            await RolTemporal.deleteMany({ guildId: panel.guildId, userId: member.id, roleId: item.roleId });
        } catch (e) { console.error('Error en reacción (quitar rol):', e.message); }
    },
};
