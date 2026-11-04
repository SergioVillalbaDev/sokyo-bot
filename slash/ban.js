// Versión con barra de «!ban» (comandos/ban.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/ban.js'),
    nombre: 'ban',
    desc: 'Ban a member (asks for confirmation)',
    descEs: 'Banear a un miembro (pide confirmación)',
    nombreEs: 'banear',
    opciones: [
        {
            tipo: 'usuario',
            nombre: 'user',
            es: 'usuario',
            desc: 'Who to ban',
            descEs: 'A quién banear',
            requerido: true,
        },
        {
            tipo: 'texto',
            nombre: 'duration',
            es: 'duracion',
            desc: 'How long: 30m, 2h, 7d… (empty = permanent)',
            descEs: 'Cuánto tiempo: 30m, 2h, 7d… (vacío = para siempre)',
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
