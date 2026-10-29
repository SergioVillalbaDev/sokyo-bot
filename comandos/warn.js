const { aplicarComando } = require('../utils/modCommands.js');

module.exports = {
    name: 'warn',
    aliases: ['avisar', 'aviso'], // en español también
    description: 'Warns a user (logged + DM only). Usage: !warn @user [reason]',

    async execute(message, args, client) {
        const motivo = args.filter((a) => !/^<@!?\d+>$/.test(a)).join(' ');
        await aplicarComando(message, client, { accion: 'aviso', motivo });
    },
};
