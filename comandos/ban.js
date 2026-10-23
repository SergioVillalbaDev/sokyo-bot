const { aplicarComando, parseDuracion } = require('../utils/modCommands.js');

module.exports = {
    name: 'ban',
    description: 'Bans a user. Usage: !ban @user [time] [reason]',

    async execute(message, args, client) {
        // Tokens sin las menciones.
        const tokens = args.filter((a) => !/^<@!?\d+>$/.test(a));

        // Si el primer token es una duración (7d, 2h…), es un ban temporal.
        let duracionMin = 0;
        const posibleDur = parseDuracion(tokens[0]);
        if (posibleDur !== null) { duracionMin = posibleDur; tokens.shift(); }

        const motivo = tokens.join(' ');
        await aplicarComando(message, client, { accion: 'ban', duracionMin, motivo });
    },
};
