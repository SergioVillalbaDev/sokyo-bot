const { ContextMenuCommandBuilder, ApplicationCommandType, InteractionContextType } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const { crearTicket } = require('../utils/ticketManager.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

// Clic derecho en un mensaje → Apps → «Abrir ticket con esto»: abre un ticket
// para quien lo pulsa con ese mensaje citado, sin tener que copiarlo.
module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Open ticket about this')
        .setNameLocalizations({ 'es-ES': 'Abrir ticket con esto', 'es-419': 'Abrir ticket con esto' })
        .setType(ApplicationCommandType.Message)
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        await interaction.deferReply({ flags: 64 });
        const max = (cfg && cfg.maxTicketsAbiertos) || 0;
        if (max > 0) {
            const abiertos = await Ticket.countDocuments({ guildId: interaction.guildId, creadorId: interaction.user.id, estado: { $ne: 'Cerrado' } });
            if (abiertos >= max) return interaction.editReply(t(idioma, `🎫 Ya tienes ${abiertos} ticket(s) abierto(s), el máximo de este servidor. Sigue en ese o ciérralo primero.`, `🎫 You already have ${abiertos} open ticket(s), this server’s maximum. Continue there or close it first.`));
        }
        const msg = interaction.targetMessage;
        const texto = (msg.content || t(idioma, '(sin texto: imagen o archivo)', '(no text: image or file)')).slice(0, 900);
        const res = await crearTicket(client, {
            guildId: interaction.guildId,
            creador: { id: interaction.user.id, username: interaction.user.username, avatar: interaction.user.displayAvatarURL({ size: 128 }) },
            motivo: t(idioma, 'Sobre un mensaje', 'About a message'),
            titulo: t(idioma, `Sobre un mensaje de ${msg.author.username}`, `About a message from ${msg.author.username}`).slice(0, 100),
            descripcion: t(idioma, `**Mensaje:** ${texto}\n[Ir al mensaje](${msg.url})`, `**Message:** ${texto}\n[Go to the message](${msg.url})`),
        });
        if (!res.ok) throw new Error(res.error || 'ticket');
        await interaction.editReply(t(idioma, `✅ Ticket abierto: ${res.canal}. Cuéntale ahí al staff lo que necesitas.`, `✅ Ticket opened: ${res.canal}. Tell the staff what you need there.`));
    },
};
