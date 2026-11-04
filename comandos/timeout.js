const { aplicarComando, parseDuracion } = require('../utils/modCommands.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    name: 'timeout',
    aliases: ['aislar'], // en español también
    description: 'Times out (mutes) a user. Usage: !timeout @user <time> [reason]',

    async execute(message, args, client, cfg) {
        const tokens = args.filter((a) => !/^<@!?\d+>$/.test(a));

        const duracionMin = parseDuracion(tokens[0]);
        if (duracionMin === null) {
            return message.reply(t(cfg, '❌ Indica el tiempo. Ej.: `/aislar usuario: @alguien duracion: 30m motivo: spam` (m, h, d).', '❌ Provide the time. e.g. `/timeout user: @someone duration: 30m reason: spam` (m, h, d).'));
        }
        tokens.shift();

        const motivo = tokens.join(' ');
        await aplicarComando(message, client, { accion: 'timeout', duracionMin, motivo });
    },
};
