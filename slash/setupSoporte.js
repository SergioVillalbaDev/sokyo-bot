// Versión con barra de «!sokyo» (comandos/setupSoporte.js): misma lógica, vía utils/puenteSlash.js.
const { PermissionFlagsBits } = require('discord.js');
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/setupSoporte.js'),
    nombre: 'support-panel',
    desc: 'Post the support panel (Open a ticket button) here',
    descEs: 'Publicar aquí el panel de soporte (botón Abrir ticket)',
    nombreEs: 'panel-soporte',
    permisos: PermissionFlagsBits.Administrator,
    opciones: [],
});
