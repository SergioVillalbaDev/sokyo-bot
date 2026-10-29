const { crearRecordatorio, textoCreado } = require('../utils/recordatorios.js');
const { idiomaMiembro } = require('../utils/preferencias.js');

module.exports = {
    name: 'remind',
    aliases: ['recordar', 'recordatorio'], // en español también
    description: 'Create a reminder. Usage: !remind 2h take out the trash (supports s, m, h, d).',

    async execute(message, args, client, cfg) {
        const idioma = await idiomaMiembro(message.author.id, { cfg });
        try {
            const texto = args.slice(1).join(' ').slice(0, 1500);
            const r = await crearRecordatorio({
                guildId: message.guild ? message.guild.id : null,
                canalId: message.channel.id,
                userId: message.author.id,
                userTag: message.author.tag,
                cuando: args[0], texto,
            }, idioma);
            if (!r.ok) return message.reply(r.error);
            await message.reply(textoCreado(r, texto, false, idioma));
        } catch (e) {
            console.error('Error en !remind:', e);
            const { t } = require('../utils/i18n.js');
            await message.reply(t(idioma, '❌ No he podido crear el recordatorio.', '❌ I couldn’t create the reminder.')).catch(() => {});
        }
    },
};
