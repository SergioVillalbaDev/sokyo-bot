// Versión con barra de «!activity» (comandos/actividad.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/actividad.js'),
    nombre: 'activity',
    desc: '(Staff) A member\'s activity: messages, voice, invites',
    descEs: '(Staff) La actividad de un miembro: mensajes, voz, invitaciones',
    nombreEs: 'actividad',
    opciones: [
        {
            tipo: 'usuario',
            nombre: 'user',
            es: 'usuario',
            desc: 'Whose activity',
            descEs: 'De quién',
            requerido: true,
        },
    ],
});
