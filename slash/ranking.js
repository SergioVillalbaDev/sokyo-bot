// Versión con barra de «!ranking» (comandos/ranking.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/ranking.js'),
    nombre: 'ranking',
    desc: 'Server level leaderboard',
    descEs: 'Clasificación de niveles del servidor',
    opciones: [],
});
