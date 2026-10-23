const { t } = require('../utils/i18n.js');

module.exports = {
    name: 'dice',
    description: 'Roll a 6-sided die',
    async execute(message, args, client, cfg) {
        const resultado = Math.floor(Math.random() * 6) + 1;
        await message.reply(t(cfg, `🎲 ¡Ha salido **${resultado}**!`, `🎲 You rolled a **${resultado}**!`));
    }
};