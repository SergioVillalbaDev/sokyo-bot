const Recordatorio = require('../models/Recordatorio.js');
const { parseDuracion, formatoDuracion } = require('../utils/duracion.js');

module.exports = {
    name: 'remind',
    description: 'Crea un recordatorio. Uso: !remind 2h sacar la basura (admite s, m, h, d).',

    async execute(message, args) {
        try {
            const ms = parseDuracion(args[0]);
            if (!ms || ms < 5000) {
                return message.reply('❌ Indica un tiempo válido. Ej: `!remind 2h revisar el correo` (usa s, m, h, d).');
            }
            if (ms > 365 * 24 * 60 * 60 * 1000) {
                return message.reply('❌ El máximo es 365 días.');
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

            await message.reply(`⏰ Te avisaré en **${formatoDuracion(ms)}**${texto ? `: "${texto}"` : ''}.`);
        } catch (e) {
            console.error('Error en !remind:', e);
            await message.reply('❌ No pude crear el recordatorio.').catch(() => {});
        }
    },
};
