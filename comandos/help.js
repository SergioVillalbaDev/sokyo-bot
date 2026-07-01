// Guía de comandos en Discord: !help (alias !commands, !comandos, !ayuda).
// Lista todos los comandos agrupados por categoría, usando el prefijo del server.
const { EmbedBuilder } = require('discord.js');
const { getConfigCached } = require('../utils/config.js');

// 's' = comando slash (/), 'p' = comando de texto (prefijo del servidor).
const CATEGORIAS = [
    { titulo: '🎵 Music', cmds: [['play', 's'], ['queue', 's'], ['nowplaying', 's'], ['pause', 's'], ['resume', 's'], ['skip', 's'], ['stop', 's'], ['volume', 's'], ['247', 's'], ['filter', 's']] },
    { titulo: '🪙 Economy', cmds: [['daily', 's'], ['shop', 's'], ['inventory', 's'], ['use', 's'], ['givegold', 's'], ['rich', 's'], ['system', 's']] },
    { titulo: '📈 Levels', cmds: [['level', 's'], ['ranking', 'p'], ['xp', 'p']] },
    { titulo: '🛡️ Moderation', cmds: [['ban', 'p'], ['unban', 'p'], ['kick', 'p'], ['timeout', 'p'], ['warn', 'p'], ['sanction', 'p'], ['history', 'p'], ['report', 'p']] },
    { titulo: '🧰 Utility', cmds: [['ping', 'p'], ['user', 'p'], ['activity', 'p'], ['role', 'p'], ['remind', 'p'], ['emoji', 'p'], ['sticker', 'p'], ['dice', 'p'], ['setup', 'p'], ['sokyo', 'p']] },
];

module.exports = {
    name: 'help',
    aliases: ['commands', 'comandos', 'ayuda'],
    description: 'Shows the full command guide',

    async execute(message, args, client) {
        const cfg = await getConfigCached(message.guildId).catch(() => null);
        const prefijo = (cfg && cfg.prefijo) || '!';

        const embed = new EmbedBuilder()
            .setTitle('📖 Command guide')
            .setColor(cfg && cfg.colorEmbed ? cfg.colorEmbed : '#5865F2')
            .setDescription(`Commands with **/** are Discord slash commands; the ones with **${prefijo}** are typed with the server prefix.`)
            .setTimestamp();

        for (const cat of CATEGORIAS) {
            const lista = cat.cmds.map(([nombre, tipo]) => `\`${tipo === 's' ? '/' : prefijo}${nombre}\``).join('  ');
            embed.addFields({ name: cat.titulo, value: lista, inline: false });
        }

        if (message.guild && message.guild.iconURL()) embed.setThumbnail(message.guild.iconURL({ size: 64 }));
        await message.reply({ embeds: [embed] }).catch(() => {});
    },
};
