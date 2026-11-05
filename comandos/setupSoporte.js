const { PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
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

            // 3. Publicamos el panel (utils/panelTickets.js, el mismo que el botón del panel web):
            //    si ya estaba en este canal, se actualiza en vez de repetirse.
            await require('../utils/panelTickets.js').publicarPanelTickets(message.channel, config);

            await message.delete().catch(console.error);

        } catch (error) {
            console.error('Error al ejecutar el setup del soporte:', error);
            message.reply(t(cfg, '❌ Ha ocurrido un error al lanzar el panel de soporte.', '❌ Something went wrong while launching the support panel.'));
        }
    }
};