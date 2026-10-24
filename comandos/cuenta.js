const { mensajeAcceso, urlCuenta } = require('../utils/cuenta.js');
const { t } = require('../utils/i18n.js');

// Igual que /cuenta. El botón abre la sesión, así que nunca se publica en el
// canal: se manda por MD y en el canal solo se avisa.
module.exports = {
    name: 'account',
    aliases: ['cuenta', 'micuenta', 'mi-cuenta', 'web', 'portal'],
    description: 'Get a private button to open your Sokyo account on the web. Usage: !account',

    async execute(message, args, client, cfg) {
        const enviado = await message.author.send(mensajeAcceso(message.author, cfg)).then(() => true).catch(() => false);
        const texto = enviado
            ? t(cfg, '📬 Te he mandado por MD un botón para entrar en tu cuenta con un clic.', '📬 I’ve sent you a DM with a button to open your account in one click.')
            : t(cfg, `🔒 No puedo mandarte MD. Usa **/cuenta** (solo lo verás tú) o entra en ${urlCuenta()}`, `🔒 I can’t DM you. Use **/account** (only you will see it) or go to ${urlCuenta()}`);
        await message.reply({ content: texto, allowedMentions: { repliedUser: false } }).catch(() => {});
    },
};
