const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');

module.exports = {
    name: 'sokyo', // O el nombre que uses en tu gestor de comandos
    description: 'Lanza el panel de soporte personalizado de marca blanca',
    async execute(message, args) { // Si usas comandos por mensaje (!sokyo)
        
        // 1. Verificación de seguridad básica (Solo administradores)
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Necesitas permisos de Administrador para ejecutar este comando.');
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
                .setTitle(config.mensajeSoporteTitulo || '🎫 Soporte Técnico Activo')
                .setDescription(config.mensajeSoporteDescripcion || 'Haz clic en el botón de abajo para abrir un ticket de soporte.')
                .setColor('#5865F2') // Color Blurple oficial de Discord (o el que tú quieras corporativo)
                .setFooter({ text: config.footerPersonalizado || 'Sistema de Gestión Sokyo' })
                .setTimestamp();

            // 4. Creamos el botón interactivo que dispara el evento "create_ticket"
            const botonAbrir = new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('📩 Abrir Ticket')
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
            message.reply('❌ Hubo un fallo interno al intentar lanzar el panel de soporte.');
        }
    }
};