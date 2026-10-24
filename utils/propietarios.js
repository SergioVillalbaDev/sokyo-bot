// Propietarios del bot: pueden con todo (todos los servidores en el panel,
// planes, /sistema, búsqueda de empleo…). Son los de OWNER_IDS del .env más
// los fijados aquí, que no dependen del .env de cada máquina.
const FIJOS = [
    '1433388927233953902',
];

const OWNER_IDS = new Set([
    ...FIJOS,
    ...(process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
]);

module.exports = { OWNER_IDS };
