// Versión con barra de «!dice» (comandos/dado.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/dado.js'),
    nombre: 'dice',
    desc: 'Roll a 6-sided die',
    descEs: 'Tirar un dado de 6 caras',
    nombreEs: 'dado',
    opciones: [],
});
