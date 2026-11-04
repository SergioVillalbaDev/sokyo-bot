// Versión con barra de «!sanction» (comandos/sancion.js): misma lógica, vía utils/puenteSlash.js.
const { crearSlashDesdePrefijo } = require('../utils/puenteSlash.js');

module.exports = crearSlashDesdePrefijo({
    prefijo: require('../comandos/sancion.js'),
    nombre: 'sanction',
    desc: 'Apply a sanction type from the panel',
    descEs: 'Aplicar un tipo de sanción del panel',
    nombreEs: 'sancionar',
    opciones: [
        {
            tipo: 'usuario',
            nombre: 'user',
            es: 'usuario',
            desc: 'Who to sanction',
            descEs: 'A quién sancionar',
            requerido: true,
        },
        {
            tipo: 'texto',
            nombre: 'type',
            es: 'tipo',
            desc: 'Sanction type as named in the panel (empty = see the list)',
            descEs: 'Tipo de sanción como se llama en el panel (vacío = ver la lista)',
            requerido: false,
            max: 100,
        },
        {
            tipo: 'texto',
            nombre: 'reason',
            es: 'motivo',
            desc: 'Reason (optional)',
            descEs: 'Motivo (opcional)',
            max: 500,
        },
    ],
});
