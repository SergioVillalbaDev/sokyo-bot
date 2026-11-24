const { AttachmentBuilder } = require('discord.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    name: 'coin',
    aliases: ['moneda'], // en español también
    description: 'Flip a coin (heads or tails)',
    async execute(message, args, client, cfg) {
        const sale = Math.random() < 0.5 ? 'cara' : 'cruz';
        const nombre = sale === 'cara' ? t(cfg, '👑 Cara', '👑 Heads') : t(cfg, '⭐ Cruz', '⭐ Tails');
        // 1.31.0: la moneda gira en el aire (el mismo GIF que el casino, sin apuesta).
        const gif = await require('../utils/casinoArte.js').gifMoneda(sale, { textos: { cara: t(cfg, '👑 CARA', '👑 HEADS'), cruz: t(cfg, '⭐ CRUZ', '⭐ TAILS') } }).catch(() => null);
        if (!gif) return message.reply(t(cfg, `La moneda está en el aire... ¡ha caído en **${nombre}**!`, `The coin is in the air... it landed on **${nombre}**!`));
        await message.reply({ content: `🪙 **${nombre}**`, files: [new AttachmentBuilder(gif, { name: 'moneda.gif' })] });
    }
};
