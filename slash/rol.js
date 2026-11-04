// Versión con barra de «!role» (comandos/rol.js): misma lógica, vía utils/puenteSlash.js.
const { PermissionFlagsBits } = require('discord.js');
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/rol.js'),
    nombre: 'role',
    desc: 'Create, give or take away roles',
    descEs: 'Crear, dar o quitar roles',
    nombreEs: 'rol',
    permisos: PermissionFlagsBits.ManageRoles,
    subcomandos: [
        {
            nombre: 'create',
            es: 'crear',
            desc: 'Create a role',
            descEs: 'Crear un rol',
            opciones: [
                {
                    tipo: 'texto',
                    nombre: 'name',
                    es: 'nombre',
                    desc: 'Role name',
                    descEs: 'Nombre del rol',
                    requerido: true,
                    junto: true,
                    max: 100,
                },
                {
                    tipo: 'texto',
                    nombre: 'color',
                    es: 'color',
                    desc: 'Colour in #rrggbb (optional)',
                    descEs: 'Color en #rrggbb (opcional)',
                    max: 7,
                },
            ],
        },
        {
            nombre: 'assign',
            es: 'dar',
            desc: 'Give a role to a member',
            descEs: 'Dar un rol a un miembro',
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
                    tipo: 'rol',
                    nombre: 'role',
                    es: 'rol',
                    desc: 'Role',
                    descEs: 'Rol',
                    requerido: true,
                },
            ],
        },
        {
            nombre: 'remove',
            es: 'quitar',
            desc: 'Take a role away from a member',
            descEs: 'Quitar un rol a un miembro',
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
                    tipo: 'rol',
                    nombre: 'role',
                    es: 'rol',
                    desc: 'Role',
                    descEs: 'Rol',
                    requerido: true,
                },
            ],
        },
    ],
});
