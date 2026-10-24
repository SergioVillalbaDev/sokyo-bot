// Guía de comandos en Discord: !help (alias !commands, !comandos, !ayuda).
// Lista todos los comandos agrupados por categoría, usando el prefijo del server.
const { EmbedBuilder } = require('discord.js');
const { getConfigCached } = require('../utils/config.js');
const { t } = require('../utils/i18n.js');

// 's' = comando slash (/), 'p' = comando de texto (prefijo del servidor).
const CATEGORIAS = [
    { titulo: ['👤 Tu cuenta en la web', '👤 Your account on the web'], cmds: [['account', 's', 'cuenta']] },
    { titulo: ['🎵 Música', '🎵 Music'], cmds: [['play', 's'], ['queue', 's'], ['nowplaying', 's'], ['pause', 's'], ['resume', 's'], ['skip', 's'], ['stop', 's'], ['volume', 's'], ['247', 's'], ['filter', 's']] },
    { titulo: ['🪙 Economía', '🪙 Economy'], cmds: [['daily', 's'], ['shop', 's'], ['inventory', 's'], ['use', 's'], ['givegold', 's'], ['rich', 's'], ['system', 's']] },
    { titulo: ['📈 Niveles', '📈 Levels'], cmds: [['level', 's'], ['ranking', 'p'], ['xp', 'p']] },
    { titulo: ['🚀 Crecimiento', '🚀 Growth'], cmds: [['invites', 's']] },
    { titulo: ['🛡️ Moderación', '🛡️ Moderation'], cmds: [['ban', 'p'], ['unban', 'p'], ['kick', 'p'], ['timeout', 'p'], ['warn', 'p'], ['sanction', 'p'], ['history', 'p'], ['report', 'p']] },
    { titulo: ['🧰 Utilidades', '🧰 Utility'], cmds: [['ping', 'p'], ['user', 'p'], ['activity', 'p'], ['role', 'p'], ['remind', 'p'], ['emoji', 'p'], ['sticker', 'p'], ['dice', 'p'], ['setup', 'p'], ['sokyo', 'p']] },
];

module.exports = {
    name: 'help',
    aliases: ['commands', 'comandos', 'ayuda'],
    description: 'Shows the full command guide',

    async execute(message, args, client) {
        const cfg = await getConfigCached(message.guildId).catch(() => null);
        const prefijo = (cfg && cfg.prefijo) || '!';

        const embed = new EmbedBuilder()
            .setTitle(t(cfg, '📖 Guía de comandos', '📖 Command guide'))
            .setColor(cfg && cfg.colorEmbed ? cfg.colorEmbed : '#5865F2')
            .setDescription(t(cfg,
                `Los comandos con **/** son comandos de barra de Discord; los que llevan **${prefijo}** se escriben con el prefijo del servidor.\n\n✨ **¿Tus tickets, tu oro, la tienda y tu tarjeta en la web?** Usa \`/cuenta\` y entra con un clic.`,
                `Commands with **/** are Discord slash commands; the ones with **${prefijo}** are typed with the server prefix.\n\n✨ **Your tickets, gold, shop and card on the web?** Use \`/account\` and get in with one click.`))
            .setTimestamp();

        for (const cat of CATEGORIAS) {
            // El 3.º valor es el nombre en español (Discord lo enseña así a quien lo tiene en español).
            const lista = cat.cmds.map(([nombre, tipo, es]) => `\`${tipo === 's' ? '/' : prefijo}${(es && t(cfg, es, nombre)) || nombre}\``).join('  ');
            embed.addFields({ name: t(cfg, cat.titulo[0], cat.titulo[1]), value: lista, inline: false });
        }

        if (message.guild && message.guild.iconURL()) embed.setThumbnail(message.guild.iconURL({ size: 64 }));
        await message.reply({ embeds: [embed] }).catch(() => {});
    },
};
