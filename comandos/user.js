const { EmbedBuilder } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    name: 'user',
    description: 'Show a user’s ticket stats',
    async execute(message, args, client, cfg) {
        // 1. ¿De quién buscamos la info? (El mencionado, o si no hay mención, el que escribe)
        const targetUser = message.mentions.users.first() || message.author;

        // Etiqueta de estado interna en inglés (los valores en BD pueden estar en español).
        const estadoLabel = (e) => (e === 'Abierto' || e === 'Open' ? 'Open' : 'Closed');
        // Etiqueta de estado visible al usuario, según idioma del servidor.
        const estadoLabelVisible = (e) => t(cfg, (estadoLabel(e) === 'Open' ? 'Abierto' : 'Cerrado'), estadoLabel(e));

        try {
            // 2. Buscamos todos los tickets de ese usuario en la BD
            const userTickets = await Ticket.find({ creadorId: targetUser.id });

            // Si no tiene tickets, le avisamos rápido
            if (userTickets.length === 0) {
                return message.reply(t(cfg, `📊 **${targetUser.username}** no ha abierto ningún ticket en este servidor.`, `📊 **${targetUser.username}** hasn’t opened any tickets on this server.`));
            }

            // 3. Calculamos las estadísticas (Total, Abiertos, Cerrados)
            const totalTickets = userTickets.length;
            const ticketsAbiertos = userTickets.filter(t => estadoLabel(t.estado) === 'Open').length;
            const ticketsCerrados = totalTickets - ticketsAbiertos;

            // 4. Buscamos detalles del último ticket que abrió
            // Ordenamos el array para que el más reciente quede el primero
            const ultimoTicket = userTickets.reverse()[0];

            // 5. Construimos el panel visual (Embed)
            const embedUser = new EmbedBuilder()
                .setColor(ticketsAbiertos > 0 ? '#e67e22' : '#2ecc71') // Naranja si tiene abiertos, Verde si está todo cerrado
                .setTitle(t(cfg, `📊 Historial de soporte: ${targetUser.username}`, `📊 Support record: ${targetUser.username}`))
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: t(cfg, '🎫 Total histórico', '🎫 All-time total'), value: t(cfg, `${totalTickets} tickets`, `${totalTickets} tickets`), inline: true },
                    { name: t(cfg, '🟢 Abiertos ahora', '🟢 Open now'), value: `${ticketsAbiertos}`, inline: true },
                    { name: t(cfg, '🔒 Cerrados', '🔒 Closed'), value: `${ticketsCerrados}`, inline: true },
                    { name: t(cfg, '🕒 Último ticket abierto', '🕒 Last ticket opened'), value: t(cfg, `**Motivo:** ${ultimoTicket.motivo || 'No especificado'}\n**Estado:** ${estadoLabelVisible(ultimoTicket.estado)}`, `**Reason:** ${ultimoTicket.motivo || 'Not specified'}\n**Status:** ${estadoLabelVisible(ultimoTicket.estado)}`), inline: false }
                )
                .setFooter({ text: 'Sokyo management system' });

            // 6. Lo enviamos al canal
            await message.reply({ embeds: [embedUser] });

        } catch (error) {
            console.error('Error al ejecutar !user:', error);
            message.reply(t(cfg, '❌ Ha ocurrido un error al consultar la base de datos.', '❌ There was an error querying the database.'));
        }
    }
};