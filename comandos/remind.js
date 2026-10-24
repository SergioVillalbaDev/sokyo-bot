const Recordatorio = require('../models/Recordatorio.js');
const { parseDuracion, formatoDuracion } = require('../utils/duracion.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    name: 'remind',
    description: 'Create a reminder. Usage: !remind 2h take out the trash (supports s, m, h, d).',

    async execute(message, args, client, cfg) {
        try {
            const ms = parseDuracion(args[0]);
            if (!ms || ms < 5000) {
                return message.reply(t(cfg, '❌ Indica un tiempo válido. Ej.: `!remind 2h mirar el correo` (usa s, m, h, d).', '❌ Provide a valid time. e.g. `!remind 2h check the mail` (use s, m, h, d).'));
            }
            if (ms > 365 * 24 * 60 * 60 * 1000) {
                return message.reply(t(cfg, '❌ El máximo son 365 días.', '❌ The maximum is 365 days.'));
            }

            const texto = args.slice(1).join(' ').slice(0, 1500);
            const fechaAviso = new Date(Date.now() + ms);

            await Recordatorio.create({
                guildId: message.guild ? message.guild.id : null,
                canalId: message.channel.id,
                userId: message.author.id,
                userTag: message.author.tag,
                mensaje: texto,
                fechaAviso,
            });

            await message.reply(t(cfg, `⏰ Te lo recordaré dentro de **${formatoDuracion(ms)}**${texto ? `: "${texto}"` : ''}.`, `⏰ I’ll remind you in **${formatoDuracion(ms)}**${texto ? `: "${texto}"` : ''}.`));
        } catch (e) {
            console.error('Error en !remind:', e);
            await message.reply(t(cfg, '❌ No he podido crear el recordatorio.', '❌ I couldn’t create the reminder.')).catch(() => {});
        }
    },
};
