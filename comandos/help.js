// Guía de comandos en Discord: !help (alias !commands, !comandos, !ayuda).
// La misma ayuda interactiva que /ayuda: menú por categorías y botón al panel.
const { getConfigCached } = require('../utils/config.js');
const { mensajeAyuda } = require('../utils/ayuda.js');
const { idiomaMiembro } = require('../utils/preferencias.js');

module.exports = {
    name: 'help',
    aliases: ['commands', 'comandos', 'ayuda'],
    description: 'Shows the full command guide',

    async execute(message, args, client) {
        const cfg = await getConfigCached(message.guildId).catch(() => null);
        const idioma = await idiomaMiembro(message.author.id, { cfg });
        await message.reply(mensajeAyuda(idioma, (cfg && cfg.prefijo) || '!')).catch(() => {});
    },
};
