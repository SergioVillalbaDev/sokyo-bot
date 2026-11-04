// Versión con barra de «!history» (comandos/historial.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/historial.js'),
    nombre: 'history',
    desc: 'See a member\'s sanction history',
    descEs: 'Ver el historial de sanciones de un miembro',
    nombreEs: 'historial',
    opciones: [
        {
            tipo: 'usuario',
            nombre: 'user',
            es: 'usuario',
            desc: 'Member',
            descEs: 'Miembro',
            requerido: false,
        },
        {
            tipo: 'texto',
            nombre: 'user-id',
            es: 'id-usuario',
            desc: 'Or their ID (if they already left)',
            descEs: 'O su ID (si ya se fue)',
            max: 25,
        },
    ],
});
