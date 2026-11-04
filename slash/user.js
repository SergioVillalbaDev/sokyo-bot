// Versión con barra de «!user» (comandos/user.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/user.js'),
    nombre: 'user',
    desc: 'Ticket stats of a member',
    descEs: 'Estadísticas de tickets de un miembro',
    nombreEs: 'usuario',
    opciones: [
        {
            tipo: 'usuario',
            nombre: 'user',
            es: 'usuario',
            desc: 'Whose stats (empty = yours)',
            descEs: 'De quién (vacío = las tuyas)',
            requerido: false,
        },
    ],
});
