// Versión con barra de «!level» (comandos/nivel.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/nivel.js'),
    nombre: 'level',
    desc: 'Show the level card',
    descEs: 'Ver la tarjeta de nivel',
    nombreEs: 'nivel',
    opciones: [
        {
            tipo: 'usuario',
            nombre: 'user',
            es: 'usuario',
            desc: 'Whose level (empty = yours)',
            descEs: 'De quién (vacío = el tuyo)',
            requerido: false,
        },
    ],
});
