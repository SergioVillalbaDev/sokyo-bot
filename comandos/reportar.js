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
                return message.reply(t(cfg, '❌ Elige a quién reportar. Ej.: `/reportar usuario: @alguien motivo: spam` (o clic derecho en su mensaje → Apps → Reportar mensaje).', '❌ Pick who to report. e.g. `/report user: @someone reason: spam` (or right-click their message → Apps → Report message).'));
            }
            if (reportado.id === message.author.id) {
                return message.reply(t(cfg, '❌ No puedes reportarte a ti mismo.', '❌ You can’t report yourself.'));
            }
            if (reportado.bot) {
                return message.reply(t(cfg, '❌ No puedes reportar a un bot.', '❌ You can’t report a bot.'));
            }

            const motivo = args.filter((a) => !/^<@!?\d+>$/.test(a)).join(' ');

            // !report: el mensaje se borra lo primero (lo menos posible a la vista).
            if (!message.esSlash) await message.delete().catch(() => {});

            await crearReporte(client, {
                guildId: message.guild.id,
                reportante: message.author,
                reportado,
                canalId: message.channel.id,
                mensaje: mensajeReportado,
                motivo,
            });

            // Que nadie sepa quién ha reportado: con /reportar la respuesta solo la ve él
            // (puente con `efimero`); con !report se borra su mensaje YA y la confirmación
            // le llega por privado (antes salía en el canal como respuesta a su mensaje).
            const gracias = t(cfg, '✅ Reporte enviado al staff. Nadie más sabe que has sido tú. ¡Gracias!', '✅ Report sent to the staff. Nobody else knows it was you. Thanks!');
            if (message.esSlash) {
                await message.reply(gracias).catch(() => {});
            } else {
                const consejo = t(cfg, '\n-# La próxima vez usa `/reportar` o clic derecho en su mensaje → Apps → Reportar mensaje: así ni siquiera le llega una mención.', '\n-# Next time use `/report` or right-click their message → Apps → Report message: that way they don’t even get a mention.');
                await message.author.send(gracias + consejo).catch(() => {});
            }
        } catch (e) {
            // Con !report su mensaje ya no está: el error también le llega por privado.
            if (message.esSlash) await message.reply(`❌ ${e.message}`).catch(() => {});
            else await message.author.send(`❌ ${e.message}`).catch(() => {});
        }
    },
};
