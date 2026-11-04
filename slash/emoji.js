// Versión con barra de «!emoji» (comandos/emoji.js): misma lógica, vía utils/puenteSlash.js.
const { PermissionFlagsBits } = require('discord.js');
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/emoji.js'),
    nombre: 'emoji',
    desc: 'Add or remove server emojis',
    descEs: 'Añadir o quitar emojis del servidor',
    permisos: PermissionFlagsBits.ManageGuildExpressions,
    subcomandos: [
        {
            nombre: 'add',
            es: 'añadir',
            desc: 'Add an emoji (upload an image or paste an emoji)',
            descEs: 'Añadir un emoji (sube una imagen o pega un emoji)',
            opciones: [
                {
                    tipo: 'texto',
                    nombre: 'name',
                    es: 'nombre',
                    desc: 'Emoji name',
                    descEs: 'Nombre del emoji',
                    requerido: true,
                    junto: true,
                    max: 32,
                },
                {
                    tipo: 'adjunto',
                    nombre: 'image',
                    es: 'imagen',
                    desc: 'Image or GIF',
                    descEs: 'Imagen o GIF',
                },
                {
                    tipo: 'texto',
                    nombre: 'emoji',
                    es: 'emoji',
                    desc: 'Or paste an emoji from another server',
                    descEs: 'O pega un emoji de otro servidor',
                    max: 100,
                },
            ],
        },
        {
            nombre: 'remove',
            es: 'quitar',
            desc: 'Remove an emoji',
            descEs: 'Quitar un emoji',
            opciones: [
                {
                    tipo: 'texto',
                    nombre: 'name',
                    es: 'nombre',
                    desc: 'Emoji name (or paste it)',
                    descEs: 'Nombre del emoji (o pégalo)',
                    requerido: true,
                    max: 100,
                },
            ],
        },
    ],
});
