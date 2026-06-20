const { crearReporte } = require('../utils/reportes.js');

module.exports = {
    name: 'reportar',
    description: 'Reporta a un usuario al staff. Uso: !reportar @usuario [motivo] (o responde a un mensaje con !reportar [motivo])',

    async execute(message, args, client) {
        try {
            // Usuario reportado: por mención, o el autor del mensaje al que se responde.
            let reportado = message.mentions.users.first() || null;
            let mensajeReportado = null;

            if (message.reference && message.reference.messageId) {
                mensajeReportado = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
                if (mensajeReportado && !reportado) reportado = mensajeReportado.author;
            }

            if (!reportado) {
                return message.reply('❌ Menciona a un usuario o responde a su mensaje. Ej: `!reportar @usuario spam`');
            }
            if (reportado.id === message.author.id) {
                return message.reply('❌ No puedes reportarte a ti mismo.');
            }
            if (reportado.bot) {
                return message.reply('❌ No puedes reportar a un bot.');
            }

            const motivo = args.filter((a) => !/^<@!?\d+>$/.test(a)).join(' ');

            await crearReporte(client, {
                guildId: message.guild.id,
                reportante: message.author,
                reportado,
                canalId: message.channel.id,
                mensaje: mensajeReportado,
                motivo,
            });

            // Confirmación discreta y borrado del comando para no señalar al reportante.
            await message.reply('✅ Reporte enviado al staff. Gracias.').then((m) => setTimeout(() => m.delete().catch(() => {}), 6000)).catch(() => {});
            await message.delete().catch(() => {});
        } catch (e) {
            await message.reply(`❌ ${e.message}`).catch(() => {});
        }
    },
};
