const { SlashCommandBuilder, InteractionContextType, MessageFlags, EmbedBuilder } = require('discord.js');
const { obtenerConfig } = require('../utils/config.js');
const { esStaff } = require('../utils/permisos.js');
const { resumenServidor, formatoDuracion } = require('../utils/estadisticas.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('estadisticas')
        .setDescription('Resumen del soporte del servidor (solo staff)')
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        const config = await obtenerConfig(interaction.guildId);
        if (!esStaff(interaction.member, config)) {
            return interaction.reply({ content: '❌ Solo el equipo de soporte puede ver las estadísticas.', flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const r = await resumenServidor(interaction.guildId, { dias: 7 });
        const media = r.valoracionMedia ? `${'⭐'.repeat(Math.round(r.valoracionMedia))} ${r.valoracionMedia.toFixed(2)} (${r.valoraciones})` : '*Sin valoraciones*';
        const topStaff = r.porStaff.length
            ? r.porStaff.map((s, i) => `**${i + 1}.** ${s.nombre} — ${s.atendidos} tickets${s.valoracionMedia ? ` · ⭐ ${s.valoracionMedia.toFixed(1)}` : ''}`).join('\n')
            : '*Nadie ha reclamado tickets todavía*';

        const embed = new EmbedBuilder()
            .setColor(config.colorPanel || '#5865F2')
            .setTitle(`📈 Soporte de ${interaction.guild.name}`)
            .addFields(
                { name: '🟢 Abiertos', value: String(r.abiertos), inline: true },
                { name: '🙋 Sin asignar', value: String(r.sinAsignar), inline: true },
                { name: '⏳ Esperando al staff', value: String(r.esperandoStaff), inline: true },
                { name: '🔒 Cerrados', value: String(r.cerrados), inline: true },
                { name: '📅 Nuevos (7 días)', value: String(r.ultimos7), inline: true },
                { name: '🎫 Total histórico', value: String(r.total), inline: true },
                { name: '⚡ 1ª respuesta media (30 d)', value: formatoDuracion(r.primeraRespuestaMediaMs), inline: true },
                { name: '✅ Resolución media (30 d)', value: formatoDuracion(r.resolucionMediaMs), inline: true },
                { name: '⭐ Satisfacción', value: media, inline: true },
                { name: '🏆 Staff más activo', value: topStaff }
            )
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
};
