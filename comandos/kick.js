const { aplicarComando } = require('../utils/modCommands.js');

module.exports = {
    name: 'kick',
    description: 'Expulsa a un usuario. Uso: !kick @usuario [motivo]',

    async execute(message, args, client) {
        const motivo = args.filter((a) => !/^<@!?\d+>$/.test(a)).join(' ');
        await aplicarComando(message, client, { accion: 'expulsion', motivo });
    },
};
