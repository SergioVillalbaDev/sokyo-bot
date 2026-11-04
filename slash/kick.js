// Versión con barra de «!kick» (comandos/kick.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/kick.js'),
    nombre: 'kick',
    desc: 'Kick a member (asks for confirmation)',
    descEs: 'Expulsar a un miembro (pide confirmación)',
    nombreEs: 'expulsar',
    opciones: [
        {
            tipo: 'usuario',
            nombre: 'user',
            es: 'usuario',
            desc: 'Who to kick',
            descEs: 'A quién expulsar',
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
