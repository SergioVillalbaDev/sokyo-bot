const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const Ticket = require('../models/Ticket.js');

module.exports = {
    name: 'user',
    description: 'Muestra las estadísticas de tickets de un usuario (ver a otros requiere "Gestionar mensajes")',
    async execute(message) {
        const mencionado = message.mentions.users.first();
        if (mencionado && mencionado.id !== message.author.id &&
            !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ Solo el staff puede consultar las estadísticas de otros usuarios.');
        }
        const targetUser = mencionado || message.author;

        // Solo tickets de ESTE servidor, del más reciente al más antiguo
        const tickets = await Ticket.find({ guildId: message.guild.id, creadorId: targetUser.id }).sort({ fechaCreacion: -1 });
        if (tickets.length === 0) {
            return message.reply({ content: `📊 **${targetUser.username}** no ha abierto ningún ticket en este servidor.`, allowedMentions: { parse: [] } });
        }

        const abiertos = tickets.filter(t => t.estado !== 'Cerrado').length;
        const ultimo = tickets[0];

        const embed = new EmbedBuilder()
            .setColor(abiertos > 0 ? '#e67e22' : '#2ecc71')
            .setTitle(`📊 Registro de Soporte: ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: '🎫 Total Histórico', value: `${tickets.length} tickets`, inline: true },
                { name: '🟢 Abiertos Ahora', value: `${abiertos}`, inline: true },
                { name: '🔒 Cerrados', value: `${tickets.length - abiertos}`, inline: true },
                { name: '🕒 Último Ticket Abierto', value: `**Motivo:** ${ultimo.motivo || 'No especificado'}\n**Estado:** ${ultimo.estado}`, inline: false }
            )
            .setFooter({ text: 'Sistema de Gestión Sokyo' });

        await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    }
};
