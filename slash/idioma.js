// Versión con barra de «!sokyolanguage» (comandos/idioma.js): misma lógica, vía utils/puenteSlash.js.
const { PermissionFlagsBits } = require('discord.js');
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/idioma.js'),
    nombre: 'language',
    desc: 'Language the bot uses on this server',
    descEs: 'Idioma que usa el bot en este servidor',
    nombreEs: 'idioma',
    permisos: PermissionFlagsBits.Administrator,
    opciones: [
        {
            tipo: 'texto',
            nombre: 'language',
            es: 'idioma',
            desc: 'Language',
            descEs: 'Idioma',
            requerido: true,
            elecciones: [
                { nombre: 'Español', valor: 'es' },
                { nombre: 'English', valor: 'en' },
            ],
        },
    ],
});
