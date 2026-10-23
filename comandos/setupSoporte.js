const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { aplicarPieMarca } = require('../utils/marca.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    name: 'sokyo', // O el nombre que uses en tu gestor de comandos
    description: 'Launch the custom white-label support panel',
    async execute(message, args, client, cfg) { // Si usas comandos por mensaje (!sokyo)

        // 1. Verificación de seguridad básica (Solo administradores)
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply(t(cfg, '❌ Necesitas permiso de Administrador para ejecutar este comando.', '❌ You need Administrator permission to run this command.'));
        }

        try {
            // 2. Buscamos la configuración en la base de datos de la Raspberry
            let config = await ServidorConfig.findOne({ guildId: message.guild.id });

            // Si por algún casual no existe, la creamos vacía con los defaults
            if (!config) {
                config = await ServidorConfig.create({ guildId: message.guild.id });
            }

            // 3. Construimos el Embed MÁGICO devorando los datos dinámicos de tu web
            const embedPanel = new EmbedBuilder()
                .setTitle(config.mensajeSoporteTitulo || t(cfg, '🎫 El soporte está abierto', '🎫 Support is open'))
                .setDescription(config.mensajeSoporteDescripcion || t(cfg, 'Pulsa el botón de abajo para abrir un ticket de soporte.', 'Click the button below to open a support ticket.'))
                .setColor(config.colorEmbed || '#5865F2') // Color configurable desde el panel
                .setTimestamp();
            aplicarPieMarca(embedPanel, config); // marca blanca: Sokyo en Free, su marca en Pro

            // 4. Creamos el botón interactivo que dispara el evento "create_ticket"
            const botonAbrir = new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel(config.textoBoton || t(cfg, '📩 Abrir un ticket', '📩 Open a ticket'))
                .setStyle(ButtonStyle.Primary);

            const filaComponentes = new ActionRowBuilder().addComponents(botonAbrir);

            // 5. Lanzamos el panel al canal y borramos el comando del administrador para limpiar el chat
            await message.channel.send({
                embeds: [embedPanel],
                components: [filaComponentes]
            });

            await message.delete().catch(console.error);

        } catch (error) {
            console.error('Error al ejecutar el setup del soporte:', error);
            message.reply(t(cfg, '❌ Ha ocurrido un error al lanzar el panel de soporte.', '❌ Something went wrong while launching the support panel.'));
        }
    }
};