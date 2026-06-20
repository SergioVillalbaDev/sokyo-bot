const { aplicarComando } = require('../utils/modCommands.js');

module.exports = {
    name: 'warn',
    description: 'Avisa a un usuario (solo queda registrado + MD). Uso: !warn @usuario [motivo]',

    async execute(message, args, client) {
        const motivo = args.filter((a) => !/^<@!?\d+>$/.test(a)).join(' ');
        await aplicarComando(message, client, { accion: 'aviso', motivo });
    },
};
