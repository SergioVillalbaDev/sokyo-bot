// Versión con barra de «!warn» (comandos/warn.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/warn.js'),
    nombre: 'warn',
    desc: 'Warn a member (logged and sent by DM)',
    descEs: 'Avisar a un miembro (queda registrado y le llega por privado)',
    nombreEs: 'avisar',
    opciones: [
        {
            tipo: 'usuario',
            nombre: 'user',
            es: 'usuario',
            desc: 'Who to warn',
            descEs: 'A quién avisar',
            requerido: true,
        },
        {
            tipo: 'texto',
            nombre: 'reason',
            es: 'motivo',
            desc: 'Reason (optional)',
            descEs: 'Motivo (opcional)',
            max: 500,
        },
    ],
});
