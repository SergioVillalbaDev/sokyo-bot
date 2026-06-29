const TipoSancion = require('../models/TipoSancion.js');
const { aplicarComando } = require('../utils/modCommands.js');

module.exports = {
    name: 'sanction',
    description: 'Applies a sanction type from the panel. Usage: !sanction @user <type> [reason]',

    async execute(message, args, client) {
        const tipos = await TipoSancion.find({ guildId: message.guild.id }).sort({ orden: 1 });
        const target = message.mentions.users.first();

        // Sin usuario: mostramos la lista de tipos disponibles.
        if (!target) {
            if (tipos.length === 0) return message.reply('No sanction types yet. Create them in the panel (Moderation → Sanction types).');
            return message.reply(`📋 Available types: ${tipos.map((t) => `\`${t.nombre}\``).join(', ')}\nUsage: \`!sanction @user <type> [reason]\``);
        }

        // Texto tras quitar la mención: empieza por el nombre del tipo, luego el motivo.
        const rest = args.filter((a) => !/^<@!?\d+>$/.test(a)).join(' ').trim();
        // Buscamos el tipo cuyo nombre encabeza el texto (el más largo si hay varios).
        const match = tipos
            .filter((t) => rest.toLowerCase().startsWith(t.nombre.toLowerCase()))
            .sort((a, b) => b.nombre.length - a.nombre.length)[0];

        if (!match) return message.reply('❌ Type not found. Type `!sanction` to see the list.');

        const motivo = rest.slice(match.nombre.length).trim();
        await aplicarComando(message, client, {
            accion: match.accion,
            duracionMin: match.duracionMin,
            borrarMensajesHoras: match.borrarMensajesHoras,
            motivo,
            nombre: match.nombre,
        });
    },
};
