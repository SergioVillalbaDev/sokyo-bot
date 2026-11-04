// Versión con barra de «!timeout» (comandos/timeout.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/timeout.js'),
    nombre: 'timeout',
    desc: 'Time out (mute) a member for a while',
    descEs: 'Aislar (silenciar) a un miembro un tiempo',
    nombreEs: 'aislar',
    opciones: [
        {
            tipo: 'usuario',
            nombre: 'user',
            es: 'usuario',
            desc: 'Who to time out',
            descEs: 'A quién aislar',
            requerido: true,
        },
        {
            tipo: 'texto',
            nombre: 'duration',
            es: 'duracion',
            desc: 'How long: 10m, 2h, 1d…',
            descEs: 'Cuánto tiempo: 10m, 2h, 1d…',
            requerido: true,
            max: 20,
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
