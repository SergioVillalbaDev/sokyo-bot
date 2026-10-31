const { Events } = require('discord.js');
const Mensaje = require('../models/Mensaje.js');
const { persistirAdjuntos } = require('../utils/adjuntos.js');

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
                // Las URLs del CDN de Discord caducan a las ~24 h: copiamos las imágenes a
                // almacenamiento propio y guardamos nuestra URL (o la de Discord si falla).
                const imagenesAdjuntas = message.attachments.size > 0 ? await persistirAdjuntos(message) : [];

                console.log(`🔗 URLs a guardar:`, imagenesAdjuntas);

                // Guardamos en MongoDB. La fecha es la del mensaje en Discord para que el
                // tiempo de descarga de los adjuntos no altere el orden de la conversación.
                const msgGuardado = await Mensaje.create({
                    ticketId: message.channel.id,
                    usuario: message.author.username,
                    usuarioId: message.author.id,
                    contenido: message.content,
                    imagenes: imagenesAdjuntas,
                    fecha: message.createdAt
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