const { PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { construirBienvenida } = require('../utils/onboarding.js');

module.exports = {
    name: 'setup',
    description: 'Muestra la guía de configuración inicial y el estado del servidor',

    async execute(message) {
        // Solo administradores ven/relanzan la guía.
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Necesitas permisos de Administrador para ver la configuración.');
        }

        let config = await ServidorConfig.findOne({ guildId: message.guild.id });
        if (!config) config = await ServidorConfig.create({ guildId: message.guild.id });

        await message.reply(construirBienvenida(message.guild, config));
    },
};
