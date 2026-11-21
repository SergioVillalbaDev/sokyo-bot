const { Events } = require('discord.js');
const Mensaje = require('../models/Mensaje.js');
const ticketCache = require('../utils/ticketCache.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // 1. Guardar mensajes de los tickets abiertos (se identifican por la base de datos, no por el nombre del canal)
        try {
            if (await ticketCache.esTicketAbierto(message.channel.id)) {
                await Mensaje.create({
                    ticketId: message.channel.id,
                    usuario: message.author.username,
                    usuarioId: message.author.id,
                    contenido: message.content,
                    imagenes: [...message.attachments.values()].map(a => a.url)
                });
            }
        } catch (error) {
            console.error('Error al guardar mensaje de ticket:', error.message);
        }

        // 2. Comandos con prefijo "!"
        if (!message.content.startsWith('!')) return;
        const args = message.content.slice(1).trim().split(/ +/);
        const command = client.commands.get(args.shift().toLowerCase());
        if (!command) return;

        try {
            await command.execute(message, args, client);
        } catch (error) {
            console.error(`Error en el comando !${command.name}:`, error);
            message.reply('❌ Hubo un error al intentar ejecutar ese comando.').catch(() => {});
        }
    },
};
