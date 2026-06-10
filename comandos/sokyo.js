const { PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');

module.exports = {
    name: 'sokyo',
    description: 'Genera el panel de soporte técnico',
    async execute(message, args, client) {
        // Validación de permisos
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Acceso denegado.');
        }
        
        // Guardar configuración en BD
        await ServidorConfig.findOneAndUpdate(
            { guildId: message.guild.id },
            { canalTicketsId: message.channel.id },
            { upsert: true, new: true }
        );

        // Crear el botón
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Abrir Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
        );

        await message.channel.send({ content: '**Soporte Técnico Activo**', components: [row] });
        await message.delete();
    }
};