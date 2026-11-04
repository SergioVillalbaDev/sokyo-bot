// Versión con barra de «!sticker» (comandos/sticker.js): misma lógica, vía utils/puenteSlash.js.
const { PermissionFlagsBits } = require('discord.js');
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/sticker.js'),
    nombre: 'sticker',
    desc: 'Add or remove server stickers',
    descEs: 'Añadir o quitar stickers del servidor',
    permisos: PermissionFlagsBits.ManageGuildExpressions,
    subcomandos: [
        {
            nombre: 'add',
            es: 'añadir',
            desc: 'Add a sticker (PNG, APNG or Lottie)',
            descEs: 'Añadir un sticker (PNG, APNG o Lottie)',
            opciones: [
                {
                    tipo: 'texto',
                    nombre: 'name',
                    es: 'nombre',
                    desc: 'Sticker name',
                    descEs: 'Nombre del sticker',
                    requerido: true,
                    junto: true,
                    max: 30,
                },
                {
                    tipo: 'adjunto',
                    nombre: 'image',
                    es: 'imagen',
                    desc: 'Sticker image',
                    descEs: 'Imagen del sticker',
                    requerido: true,
                },
            ],
        },
        {
            nombre: 'remove',
            es: 'quitar',
            desc: 'Remove a sticker',
            descEs: 'Quitar un sticker',
            opciones: [
                {
                    tipo: 'texto',
                    nombre: 'name',
                    es: 'nombre',
                    desc: 'Sticker name',
                    descEs: 'Nombre del sticker',
                    requerido: true,
                    junto: true,
                    max: 30,
                },
            ],
        },
    ],
});
