const TipoSancion = require('../models/TipoSancion.js');
const { aplicarComando } = require('../utils/modCommands.js');

module.exports = {
    name: 'sancion',
    description: 'Aplica un tipo de sanción del panel. Uso: !sancion @usuario <tipo> [motivo]',

    async execute(message, args, client) {
        const tipos = await TipoSancion.find({ guildId: message.guild.id }).sort({ orden: 1 });
        const target = message.mentions.users.first();

        // Sin usuario: mostramos la lista de tipos disponibles.
        if (!target) {
            if (tipos.length === 0) return message.reply('No hay tipos de sanción. Créalos en el panel (Moderación → Tipos de sanción).');
            return message.reply(`📋 Tipos disponibles: ${tipos.map((t) => `\`${t.nombre}\``).join(', ')}\nUso: \`!sancion @usuario <tipo> [motivo]\``);
        }

        // Texto tras quitar la mención: empieza por el nombre del tipo, luego el motivo.
        const rest = args.filter((a) => !/^<@!?\d+>$/.test(a)).join(' ').trim();
        // Buscamos el tipo cuyo nombre encabeza el texto (el más largo si hay varios).
        const match = tipos
            .filter((t) => rest.toLowerCase().startsWith(t.nombre.toLowerCase()))
            .sort((a, b) => b.nombre.length - a.nombre.length)[0];

        if (!match) return message.reply('❌ Tipo no encontrado. Escribe `!sancion` para ver la lista.');

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
