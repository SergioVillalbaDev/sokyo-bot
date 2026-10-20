const { SlashCommandBuilder, InteractionContextType, MessageFlags, EmbedBuilder } = require('discord.js');
const { obtenerConfig } = require('../utils/config.js');
const { esStaff } = require('../utils/permisos.js');
const { estadisticasUsuario } = require('../utils/estadisticas.js');

const estrellas = (media) => media ? `${'⭐'.repeat(Math.round(media))} (${media.toFixed(1)})` : '*Sin valoraciones*';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('usuario')
        .setDescription('Muestra el historial de soporte de un usuario')
        .setContexts(InteractionContextType.Guild)
        .addUserOption(o => o.setName('usuario').setDescription('Usuario a consultar (por defecto, tú)')),

    async execute(interaction) {
        const objetivo = interaction.options.getUser('usuario') || interaction.user;

        // Cualquiera puede ver su propio historial; el de otros, solo el staff.
        if (objetivo.id !== interaction.user.id) {
            const config = await obtenerConfig(interaction.guildId);
            if (!esStaff(interaction.member, config)) {
                return interaction.reply({ content: '❌ Solo el equipo de soporte puede consultar el historial de otros usuarios.', flags: MessageFlags.Ephemeral });
            }
        }

        const stats = await estadisticasUsuario(interaction.guildId, objetivo.id);
        if (stats.total === 0) {
            return interaction.reply({ content: `📊 **${objetivo.username}** no ha abierto ningún ticket en este servidor.`, flags: MessageFlags.Ephemeral });
        }

        const ultimo = stats.ultimo;
        const numero = ultimo.numero ? `#${String(ultimo.numero).padStart(4, '0')} · ` : '';
        const embed = new EmbedBuilder()
            .setColor(stats.abiertos > 0 ? '#e67e22' : '#2ecc71')
            .setTitle(`📊 Historial de soporte de ${objetivo.username}`)
            .setThumbnail(objetivo.displayAvatarURL({ size: 128 }))
            .addFields(
                { name: '🎫 Total', value: String(stats.total), inline: true },
                { name: '🟢 Abiertos', value: String(stats.abiertos), inline: true },
                { name: '🔒 Cerrados', value: String(stats.cerrados), inline: true },
                { name: '⭐ Valoración media', value: estrellas(stats.valoracionMedia), inline: false },
                {
                    name: '🕒 Último ticket',
                    value: `**${numero}${ultimo.titulo || ultimo.motivo}**\n🏷️ ${ultimo.motivo} · ${ultimo.estado === 'Abierto' ? '🟢 Abierto' : '🔒 Cerrado'} · <t:${Math.floor(new Date(ultimo.fechaCreacion).getTime() / 1000)}:R>`
                }
            );
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
