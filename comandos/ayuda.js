const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('Explica cómo funciona Sokyo y lista sus comandos'),

    async execute(interaction) {
        const portal = process.env.FRONTEND_URL && !/localhost|127\.0\.0\.1/.test(process.env.FRONTEND_URL)
            ? `\n🌐 **Panel y portal web:** ${process.env.FRONTEND_URL}`
            : '';

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🤖 Ayuda de Sokyo')
            .setDescription(`Sokyo gestiona el soporte del servidor mediante **tickets**: canales privados entre tú y el equipo.${portal}`)
            .addFields(
                {
                    name: '🙋 Para usuarios',
                    value: [
                        '• Pulsa **📩 Abrir Ticket** en el canal de soporte, elige la categoría y describe tu problema.',
                        '• Al cerrarse recibirás una copia por DM y podrás valorar la atención.',
                        '• `/ticket cerrar` — cierra tu ticket · `/usuario` — tu historial'
                    ].join('\n')
                },
                {
                    name: '🛡️ Para el staff (dentro de un ticket)',
                    value: [
                        '`/ticket reclamar` · `/ticket liberar` — asignarte o soltar el ticket',
                        '`/ticket agregar` · `/ticket quitar` — gestionar participantes',
                        '`/ticket prioridad` · `/ticket transcript` · `/ticket reabrir`',
                        '`/estadisticas` — resumen del soporte · `/usuario @alguien` — historial'
                    ].join('\n')
                },
                {
                    name: '⚙️ Para administradores',
                    value: [
                        '`/panel` — publica el panel con el botón de abrir tickets',
                        '`/config ver` — muestra la configuración',
                        '`/config rol-staff` · `/config categoria` · `/config transcripts` · `/config logs` · `/config limite`'
                    ].join('\n')
                },
                { name: '🎲 Diversión', value: '`/dado` · `/moneda`' }
            )
            .setFooter({ text: 'Sokyo · Sistema de tickets' });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
