// Cambia el idioma en el que el bot escribe en este servidor (Discord),
// guardado en ServidorConfig.idioma. Independiente del idioma del panel web
// (ese es por navegador). Solo Administrador puede cambiarlo.
const { PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { t } = require('../utils/i18n.js');

const ALIAS = {
    es: 'es', spanish: 'es', español: 'es', espanol: 'es', castellano: 'es',
    en: 'en', english: 'en', inglés: 'en', ingles: 'en',
};

module.exports = {
    name: 'sokyolanguage',
    aliases: ['sokyoidioma'],
    description: 'Set the language the bot uses in this server (spanish/english)',
    async execute(message, args, client, cfg) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply(t(cfg, '❌ Necesitas el permiso de Administrador para cambiar el idioma del bot.', '❌ You need Administrator permission to change the bot’s language.'));
        }

        const elegido = ALIAS[(args[0] || '').toLowerCase()];
        if (!elegido) {
            const actual = (cfg && cfg.idioma) === 'es' ? 'Español' : 'English';
            return message.reply(t(cfg,
                `Idioma actual: **${actual}**. Uso: \`sokyolanguage spanish\` o \`sokyolanguage english\`.`,
                `Current language: **${actual}**. Usage: \`sokyolanguage spanish\` or \`sokyolanguage english\`.`));
        }

        const config = await ServidorConfig.findOneAndUpdate(
            { guildId: message.guild.id },
            { $set: { idioma: elegido } },
            { new: true, upsert: true },
        );

        const nombre = elegido === 'es' ? 'Español' : 'English';
        return message.reply(t(config, `✅ Idioma del bot cambiado a **${nombre}**.`, `✅ Bot language switched to **${nombre}**.`));
    },
};
