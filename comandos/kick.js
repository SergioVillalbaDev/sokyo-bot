const { aplicarComando } = require('../utils/modCommands.js');

module.exports = {
    name: 'kick',
    description: 'Kicks a user. Usage: !kick @user [reason]',

    async execute(message, args, client) {
        const motivo = args.filter((a) => !/^<@!?\d+>$/.test(a)).join(' ');
        await aplicarComando(message, client, { accion: 'expulsion', motivo });
    },
};
