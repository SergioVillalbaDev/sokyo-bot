// Enlaces del bot al panel de control: así un mensaje de Discord puede llevar
// directo a la sección donde se arregla o se configura algo.
const { ButtonBuilder, ButtonStyle } = require('discord.js');
const { origenApi } = require('./cuenta.js');
const { t } = require('./i18n.js');

const base = () => (process.env.FRONTEND_URL || origenApi()).replace(/\/+$/, '');

// Dirección de una sección del panel (tab de navConfig.js). Sin tab, el inicio.
function urlPanel(tab = null) {
    return tab && tab !== 'inicio' ? `${base()}/panel#dashboard/${tab}` : `${base()}/panel#dashboard`;
}

function botonPanel(idioma, tab = null, etiqueta = null) {
    return new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(urlPanel(tab))
        .setEmoji('🛠️')
        .setLabel(etiqueta || t(idioma, 'Abrir en el panel', 'Open in the panel'));
}

module.exports = { urlPanel, botonPanel };
