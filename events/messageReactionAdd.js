const { Events } = require('discord.js');
const RolePanel = require('../models/RolePanel.js');
const { toggleRol, emojiDeReaccion } = require('../utils/rolePanelManager.js');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user, _detalles, client) {
        if (user.bot) return;
        try {
            // El mensaje puede no estar en caché (partial): lo traemos.
            if (reaction.partial) await reaction.fetch();
            // Salón de la fama: cuenta las estrellas del mensaje.
            await require('../utils/salonFama.js').alReaccionar(reaction, user, client).catch((e) => console.error('Salón de la fama:', e.message));
            const panel = await RolePanel.findOne({ messageId: reaction.message.id, tipo: 'reaccion' });
            if (!panel) return;

            const emoji = emojiDeReaccion(reaction);
            const item = panel.items.find((i) => i.emoji === emoji || i.emoji === reaction.emoji.name);
            if (!item) return;

            const member = await reaction.message.guild.members.fetch(user.id);
            // Reaccionar = añadir (soloAñadir: no alterna al reaccionar).
            await toggleRol(member, panel, item.roleId, { soloAñadir: true });
        } catch (e) { console.error('Error en reacción (añadir rol):', e.message); }
    },
};
