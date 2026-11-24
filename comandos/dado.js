const { AttachmentBuilder } = require('discord.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    name: 'dice',
    aliases: ['dado'], // en español también
    description: 'Roll a 6-sided die',
    async execute(message, args, client, cfg) {
        const resultado = Math.floor(Math.random() * 6) + 1;
        // 1.31.0: el dado rueda (GIF) y el número se ve en él; si no se puede dibujar, texto.
        const gif = await require('../utils/casinoArte.js').gifDado(resultado).catch(() => null);
        if (!gif) return message.reply(t(cfg, `🎲 ¡Ha salido **${resultado}**!`, `🎲 You rolled a **${resultado}**!`));
        await message.reply({ content: `🎲 **${resultado}**`, files: [new AttachmentBuilder(gif, { name: 'dado.gif' })] });
    }
};
