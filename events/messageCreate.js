const { Events } = require('discord.js');
const Mensaje = require('../models/Mensaje.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot) return;

        // 1. Guardar mensajes de los tickets en la BD
        if (message.channel.name && message.channel.name.startsWith('ticket-')) {
            console.log(`\n--- 📩 NUEVO MENSAJE EN TICKET ---`);
            console.log(`👤 Usuario: ${message.author.username}`);
            console.log(`📝 Texto: "${message.content}"`);
            console.log(`📎 Adjuntos: ${message.attachments.size}`);

            try {
                let imagenesAdjuntas = [];
                
                if (message.attachments.size > 0) {
                    // Extraemos las URLs de forma segura
                    message.attachments.forEach(adjunto => {
                        imagenesAdjuntas.push(adjunto.url);
                    });
                }

                console.log(`🔗 URLs a guardar:`, imagenesAdjuntas);

                // Guardamos en MongoDB
                const msgGuardado = await Mensaje.create({
                    ticketId: message.channel.id,
                    usuario: message.author.username,
                    usuarioId: message.author.id,
                    contenido: message.content,
                    imagenes: imagenesAdjuntas
                });
                
                console.log(`✅ Guardado en BD exitosamente con ${msgGuardado.imagenes.length} imágenes.`);

            } catch (error) {
                console.error('❌ Error al guardar mensaje en la BD:', error);
            } 
        }

        // 2. Ejecutar comandos (Si empieza por !)
        if (!message.content.startsWith('!')) return;

        const args = message.content.slice(1).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName);
        if (!command) return;

        try {
            await command.execute(message, args, client);
        } catch (error) {
            console.error(error);
            message.reply('❌ Hubo un error al intentar ejecutar ese comando.');
        }
    },
};