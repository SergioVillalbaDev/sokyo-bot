const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const { EPH } = require('../utils/accesos.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('Muestra las estadísticas de tickets de un usuario')
        .addUserOption(o => o.setName('usuario').setDescription('Usuario a consultar (por defecto, tú)')),
    async execute(interaction) {
        const objetivo = interaction.options.getUser('usuario') || interaction.user;
        // Solo cuentan los tickets de ESTE servidor.
        const tickets = await Ticket.find({ creadorId: objetivo.id, guildId: interaction.guildId }).sort({ fechaCreacion: -1 });

        if (tickets.length === 0) {
            return interaction.reply({ content: `📊 **${objetivo.username}** no ha abierto ningún ticket en este servidor.`, flags: EPH });
        }

        const abiertos = tickets.filter(t => t.estado === 'Abierto').length;
        const valorados = tickets.filter(t => t.valoracionCSAT > 0);
        const media = valorados.length ? (valorados.reduce((a, t) => a + t.valoracionCSAT, 0) / valorados.length).toFixed(1) : '—';
        const ultimo = tickets[0];

        const embed = new EmbedBuilder()
            .setColor(abiertos > 0 ? '#e67e22' : '#2ecc71')
            .setTitle(`📊 Registro de Soporte: ${objetivo.username}`)
            .setThumbnail(objetivo.displayAvatarURL())
            .addFields(
                { name: '🎫 Total Histórico', value: `${tickets.length} tickets`, inline: true },
                { name: '🟢 Abiertos Ahora', value: `${abiertos}`, inline: true },
                { name: '🔒 Cerrados', value: `${tickets.length - abiertos}`, inline: true },
                { name: '⭐ Valoración media', value: media === '—' ? 'Sin valorar' : `${media}/5`, inline: true },
                { name: '🕒 Último Ticket', value: `**Motivo:** ${ultimo.motivo || 'No especificado'}\n**Estado:** ${ultimo.estado}`, inline: false }
            )
            .setFooter({ text: 'Sistema de Gestión Sokyo' });

        await interaction.reply({ embeds: [embed], flags: EPH });
    }
};
