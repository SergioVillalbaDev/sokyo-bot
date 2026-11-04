// Versión con barra de «!unban» (comandos/unban.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/unban.js'),
    nombre: 'unban',
    desc: 'Remove a member\'s ban',
    descEs: 'Quitar el ban a alguien',
    nombreEs: 'desbanear',
    opciones: [
        {
            tipo: 'usuario',
            nombre: 'user',
            es: 'usuario',
            desc: 'Who (if Discord lets you pick them)',
            descEs: 'A quién (si Discord deja elegirlo)',
            requerido: false,
        },
        {
            tipo: 'texto',
            nombre: 'user-id',
            es: 'id-usuario',
            desc: 'Or their ID',
            descEs: 'O su ID',
            max: 25,
        },
    ],
});
