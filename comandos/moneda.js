const { t } = require('../utils/i18n.js');

module.exports = {
    name: 'coin',
    description: 'Flip a coin (heads or tails)',
    async execute(message, args, client, cfg) {
        const opcionesEs = ['Cara 🪙', 'Cruz 🦅'];
        const opcionesEn = ['Heads 🪙', 'Tails 🦅'];
        const eleccion = Math.floor(Math.random() * 2);
        const opciones = t(cfg, opcionesEs, opcionesEn);
        await message.reply(t(cfg, `La moneda está en el aire... ¡ha caído en **${opciones[eleccion]}**!`, `The coin is in the air... it landed on **${opciones[eleccion]}**!`));
    }
};