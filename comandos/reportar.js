const { crearReporte } = require('../utils/reportes.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    name: 'report',
    aliases: ['reportar'], // en español también
    description: 'Report a user to the staff. Usage: !report @user [reason] (or reply to a message with !report [reason])',

    async execute(message, args, client, cfg) {
        try {
            // Usuario reportado: por mención, o el autor del mensaje al que se responde.
            let reportado = message.mentions.users.first() || null;
            let mensajeReportado = null;

            if (message.reference && message.reference.messageId) {
                mensajeReportado = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
                if (mensajeReportado && !reportado) reportado = mensajeReportado.author;
            }

            if (!reportado) {
                return message.reply(t(cfg, '❌ Menciona a un usuario o responde a su mensaje. Ej.: `!report @usuario spam`', '❌ Mention a user or reply to their message. e.g. `!report @user spam`'));
            }
            if (reportado.id === message.author.id) {
                return message.reply(t(cfg, '❌ No puedes reportarte a ti mismo.', '❌ You can’t report yourself.'));
            }
            if (reportado.bot) {
                return message.reply(t(cfg, '❌ No puedes reportar a un bot.', '❌ You can’t report a bot.'));
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
            await message.reply(t(cfg, '✅ Reporte enviado al staff. Gracias.', '✅ Report sent to the staff. Thank you.')).then((m) => setTimeout(() => m.delete().catch(() => {}), 6000)).catch(() => {});
            await message.delete().catch(() => {});
        } catch (e) {
            await message.reply(`❌ ${e.message}`).catch(() => {});
        }
    },
};
