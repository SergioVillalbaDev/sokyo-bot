const { aplicarComando, parseDuracion } = require('../utils/modCommands.js');

module.exports = {
    name: 'timeout',
    description: 'Aísla (silencia) a un usuario. Uso: !timeout @usuario <tiempo> [motivo]',

    async execute(message, args, client) {
        const tokens = args.filter((a) => !/^<@!?\d+>$/.test(a));

        const duracionMin = parseDuracion(tokens[0]);
        if (duracionMin === null) {
            return message.reply('❌ Indica el tiempo. Ej: `!timeout @usuario 30m spam` (m, h, d).');
        }
        tokens.shift();

        const motivo = tokens.join(' ');
        await aplicarComando(message, client, { accion: 'timeout', duracionMin, motivo });
    },
};
