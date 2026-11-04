// Versión con barra de «!coin» (comandos/moneda.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/moneda.js'),
    nombre: 'coin',
    desc: 'Flip a coin (heads or tails)',
    descEs: 'Lanzar una moneda (cara o cruz)',
    nombreEs: 'moneda',
    opciones: [],
});
