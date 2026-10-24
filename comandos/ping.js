const { t } = require('../utils/i18n.js');

module.exports = {

    name: 'ping',
    description: 'Pings the bot',

    async execute(message, args, client, cfg) {
        // Justo al arrancar, antes del primer latido con Discord, ws.ping vale -1.
        const ping = client.ws.ping;
        const texto = Number.isFinite(ping) && ping >= 0 ? `${Math.round(ping)} ms` : t(cfg, 'midiendo… (prueba otra vez en unos segundos)', 'measuring… (try again in a few seconds)');
        await message.reply(t(cfg, `🏓 Mi latencia actual es de **${texto}**.`, `🏓 My current latency is **${texto}**.`)).catch(() => {});
    },

};
