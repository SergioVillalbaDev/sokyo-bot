const Recordatorio = require('../models/Recordatorio.js');
const { parseDuracion, formatoDuracion } = require('../utils/duracion.js');

module.exports = {
    name: 'remind',
    description: 'Create a reminder. Usage: !remind 2h take out the trash (supports s, m, h, d).',

    async execute(message, args) {
        try {
            const ms = parseDuracion(args[0]);
            if (!ms || ms < 5000) {
                return message.reply('❌ Provide a valid time. e.g. `!remind 2h check the mail` (use s, m, h, d).');
            }
            if (ms > 365 * 24 * 60 * 60 * 1000) {
                return message.reply('❌ The maximum is 365 days.');
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

            await message.reply(`⏰ I’ll remind you in **${formatoDuracion(ms)}**${texto ? `: "${texto}"` : ''}.`);
        } catch (e) {
            console.error('Error en !remind:', e);
            await message.reply('❌ I couldn’t create the reminder.').catch(() => {});
        }
    },
};
