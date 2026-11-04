// Versión con barra de «!xp» (comandos/xp.js): misma lógica, vía utils/puenteSlash.js.
const { PermissionFlagsBits } = require('discord.js');
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/xp.js'),
    nombre: 'xp',
    desc: 'Manage members\' XP',
    descEs: 'Gestionar la XP de los miembros',
    permisos: PermissionFlagsBits.ManageGuild,
    subcomandos: [
        {
            nombre: 'add',
            es: 'sumar',
            desc: 'Add XP to a member',
            descEs: 'Sumar XP a un miembro',
            opciones: [
                {
                    tipo: 'usuario',
                    nombre: 'user',
                    es: 'usuario',
                    desc: 'Member',
                    descEs: 'Miembro',
                    requerido: true,
                },
                {
                    tipo: 'entero',
                    nombre: 'amount',
                    es: 'cantidad',
                    desc: 'How much XP',
                    descEs: 'Cuánta XP',
                    requerido: true,
                    min: 1,
                    max: 1000000,
                },
            ],
        },
        {
            nombre: 'set',
            es: 'poner-nivel',
            desc: 'Set a member\'s level',
            descEs: 'Poner el nivel de un miembro',
            opciones: [
                {
                    tipo: 'usuario',
                    nombre: 'user',
                    es: 'usuario',
                    desc: 'Member',
                    descEs: 'Miembro',
                    requerido: true,
                },
                {
                    tipo: 'entero',
                    nombre: 'level',
                    es: 'nivel',
                    desc: 'Level',
                    descEs: 'Nivel',
                    requerido: true,
                    min: 0,
                    max: 1000,
                },
            ],
        },
        {
            nombre: 'reset',
            es: 'reiniciar',
            desc: 'Reset a member\'s XP',
            descEs: 'Reiniciar la XP de un miembro',
            opciones: [
                {
                    tipo: 'usuario',
                    nombre: 'user',
                    es: 'usuario',
                    desc: 'Member',
                    descEs: 'Miembro',
                    requerido: true,
                },
            ],
        },
    ],
});
