const { SlashCommandBuilder, InteractionContextType, MessageFlags, EmbedBuilder } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const { obtenerConfig } = require('../utils/config.js');
const { esStaff } = require('../utils/permisos.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('usuario')
        .setDescription('Historial de tickets de un usuario en este servidor')
        .addUserOption(o => o.setName('miembro').setDescription('Usuario a consultar (solo staff puede consultar a otros)'))
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        const objetivo = interaction.options.getUser('miembro') || interaction.user;
        if (objetivo.id !== interaction.user.id) {
            const config = await obtenerConfig(interaction.guildId);
            if (!esStaff(interaction.member, config)) {
                return interaction.reply({ content: '❌ Solo el staff puede consultar el historial de otras personas.', flags: MessageFlags.Ephemeral });
            }
        }

        const tickets = await Ticket.find({ guildId: interaction.guildId, creadorId: objetivo.id }).sort({ fechaCreacion: -1 }).lean();
        if (tickets.length === 0) {
            return interaction.reply({ content: `📊 **${objetivo.username}** no ha abierto ningún ticket en este servidor.`, flags: MessageFlags.Ephemeral });
        }

        const abiertos = tickets.filter(t => t.estado === 'Abierto').length;
        const valorados = tickets.filter(t => t.valoracionCSAT);
        const media = valorados.length ? (valorados.reduce((s, t) => s + t.valoracionCSAT, 0) / valorados.length).toFixed(1) : '—';
        const ultimo = tickets[0];

        const embed = new EmbedBuilder()
            .setColor(abiertos > 0 ? '#e67e22' : '#2ecc71')
            .setTitle(`📊 Registro de Soporte: ${objetivo.username}`)
            .setThumbnail(objetivo.displayAvatarURL())
            .addFields(
                { name: '🎫 Total', value: `${tickets.length} tickets`, inline: true },
                { name: '🟢 Abiertos', value: `${abiertos}`, inline: true },
                { name: '⭐ Valoración media', value: `${media}`, inline: true },
                { name: '🕒 Último ticket', value: `**${ultimo.titulo || ultimo.motivo}**\n${ultimo.motivo} · ${ultimo.estado} · <t:${Math.floor(new Date(ultimo.fechaCreacion).getTime() / 1000)}:R>` }
            );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
