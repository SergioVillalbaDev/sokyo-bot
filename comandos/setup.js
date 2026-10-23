const { PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { construirBienvenida } = require('../utils/onboarding.js');

module.exports = {
    name: 'setup',
    description: 'Show the initial setup guide and the server’s status',

    async execute(message) {
        // Solo administradores ven/relanzan la guía.
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ You need Administrator permission to view the configuration.');
        }

        let config = await ServidorConfig.findOne({ guildId: message.guild.id });
        if (!config) config = await ServidorConfig.create({ guildId: message.guild.id });

        await message.reply(construirBienvenida(message.guild, config));
    },
};
