// Versión con barra de «!ping» (comandos/ping.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/ping.js'),
    nombre: 'ping',
    desc: 'Check the bot\'s response time',
    descEs: 'Ver cuánto tarda en responder el bot',
    opciones: [],
});
