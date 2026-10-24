const { PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { construirBienvenida } = require('../utils/onboarding.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    name: 'setup',
    description: 'Show the initial setup guide and the server’s status',

    async execute(message, args, client, cfg) {
        // Solo administradores ven/relanzan la guía.
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply(t(cfg, '❌ Necesitas el permiso de Administrador para ver la configuración.', '❌ You need Administrator permission to view the configuration.'));
        }

        let config = await ServidorConfig.findOne({ guildId: message.guild.id });
        if (!config) config = await ServidorConfig.create({ guildId: message.guild.id });

        await message.reply(construirBienvenida(message.guild, config));
    },
};
