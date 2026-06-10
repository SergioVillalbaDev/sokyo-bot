const { EmbedBuilder } = require('discord.js');
const Ticket = require('../models/Ticket.js');

module.exports = {
    name: 'user',
    description: 'Muestra las estadísticas de tickets de un usuario',
    async execute(message, args, client) {
        // 1. ¿De quién buscamos la info? (El mencionado, o si no hay mención, el que escribe)
        const targetUser = message.mentions.users.first() || message.author;

        try {
            // 2. Buscamos todos los tickets de ese usuario en la BD
            const userTickets = await Ticket.find({ creadorId: targetUser.id });

            // Si no tiene tickets, le avisamos rápido
            if (userTickets.length === 0) {
                return message.reply(`📊 **${targetUser.username}** no ha abierto ningún ticket en este servidor.`);
            }

            // 3. Calculamos las estadísticas (Total, Abiertos, Cerrados)
            const totalTickets = userTickets.length;
            const ticketsAbiertos = userTickets.filter(t => t.estado === 'Abierto').length;
            const ticketsCerrados = totalTickets - ticketsAbiertos;

            // 4. Buscamos detalles del último ticket que abrió
            // Ordenamos el array para que el más reciente quede el primero
            const ultimoTicket = userTickets.reverse()[0]; 
            
            // 5. Construimos el panel visual (Embed)
            const embedUser = new EmbedBuilder()
                .setColor(ticketsAbiertos > 0 ? '#e67e22' : '#2ecc71') // Naranja si tiene abiertos, Verde si está todo cerrado
                .setTitle(`📊 Registro de Soporte: ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '🎫 Total Histórico', value: `${totalTickets} tickets`, inline: true },
                    { name: '🟢 Abiertos Ahora', value: `${ticketsAbiertos}`, inline: true },
                    { name: '🔒 Cerrados', value: `${ticketsCerrados}`, inline: true },
                    { name: '🕒 Último Ticket Abierto', value: `**Motivo:** ${ultimoTicket.motivo || 'No especificado'}\n**Estado:** ${ultimoTicket.estado}`, inline: false }
                )
                .setFooter({ text: 'Sistema de Gestión Sokyo' });

            // 6. Lo enviamos al canal
            await message.reply({ embeds: [embedUser] });

        } catch (error) {
            console.error('Error al ejecutar !user:', error);
            message.reply('❌ Hubo un error al consultar la base de datos.');
        }
    }
};