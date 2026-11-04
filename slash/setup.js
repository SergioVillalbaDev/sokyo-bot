// Versión con barra de «!setup» (comandos/setup.js): misma lógica, vía utils/puenteSlash.js.
const { PermissionFlagsBits } = require('discord.js');
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/setup.js'),
    nombre: 'setup',
    desc: 'Setup guide and server status',
    descEs: 'Guía de puesta en marcha y estado del servidor',
    permisos: PermissionFlagsBits.Administrator,
    opciones: [],
});
