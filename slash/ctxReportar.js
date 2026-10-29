const { ContextMenuCommandBuilder, ApplicationCommandType, InteractionContextType, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

// Clic derecho en un mensaje → Apps → «Reportar mensaje»: una ventana para el
// motivo y el staff recibe el reporte con el mensaje (nadie más se entera).
module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Report message')
        .setNameLocalizations({ 'es-ES': 'Reportar mensaje', 'es-419': 'Reportar mensaje' })
        .setType(ApplicationCommandType.Message)
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const msg = interaction.targetMessage;
        if (msg.author.id === interaction.user.id) return interaction.reply({ content: t(idioma, '🙃 No puedes reportar tu propio mensaje.', '🙃 You can’t report your own message.'), flags: 64 });
        if (msg.author.bot) return interaction.reply({ content: t(idioma, '🤖 Los mensajes de bots no se reportan.', '🤖 Bot messages can’t be reported.'), flags: 64 });
        if (!cfg || !cfg.reportes || !cfg.reportes.activo) {
            return interaction.reply({ content: t(idioma, 'ℹ️ Este servidor no tiene los reportes activados. Avisa a un moderador directamente.', 'ℹ️ This server doesn’t have reports turned on. Tell a moderator directly.'), flags: 64 });
        }
        await interaction.showModal(new ModalBuilder()
            .setCustomId(`crep_m:${msg.channelId}:${msg.id}`)
            .setTitle(t(idioma, '🚩 Reportar mensaje', '🚩 Report message'))
            .addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('motivo').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
                    .setLabel(t(idioma, '¿Qué pasa con este mensaje? (opcional)', 'What’s wrong with this message? (optional)'))
                    .setPlaceholder(t(idioma, 'Ej.: insultos, spam, contenido que no toca…', 'e.g. insults, spam, inappropriate content…')),
            )));
    },
};
