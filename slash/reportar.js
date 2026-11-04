// Versión con barra de «!report» (comandos/reportar.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/reportar.js'),
    nombre: 'report',
    desc: 'Report a member to the staff',
    descEs: 'Reportar a un miembro al staff',
    nombreEs: 'reportar',
    efimero: true, // que nadie del canal vea quién ha reportado
    opciones: [
        {
            tipo: 'usuario',
            nombre: 'user',
            es: 'usuario',
            desc: 'Who to report',
            descEs: 'A quién reportar',
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
