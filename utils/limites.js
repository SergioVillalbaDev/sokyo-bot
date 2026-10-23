// ============================================================================
// LÍMITES POR PLAN. El plan Free es generoso pero tiene techos en las funciones
// que un servidor que CRECE acaba tocando. Pro/Agencia = ilimitado. Cuando el
// servidor choca con el techo, ve un aviso claro de "sube a Pro" (palanca de
// conversión por dolor de crecimiento).
// ============================================================================
const { esPro } = require('./billing.js');

// Techos del plan FREE. Lo no listado = sin límite.
const LIMITES_FREE = {
    panelesRoles: 1,        // paneles de auto-roles publicables
    autoRespuestas: 5,      // FAQs / triggers automáticos
    anunciosProgramados: 3, // anuncios con fecha
    rolesPorNivel: 3,       // recompensas de rol por nivel
};

// Límite numérico para una clave según el plan del servidor (Infinity = sin tope).
function limite(cfg, clave) {
    if (esPro(cfg)) return Infinity;
    return Object.prototype.hasOwnProperty.call(LIMITES_FREE, clave) ? LIMITES_FREE[clave] : Infinity;
}

module.exports = { limite, LIMITES_FREE };
