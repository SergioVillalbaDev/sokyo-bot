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

// 2.0.0: TOPES de los premios en oro que pone cada servidor. El oro no se puede «dar» a mano;
// con un cumpleaños de 1.000.000 de oro (antes se podía) se fabricaba oro igual. Con estos topes
// el oro se sigue ganando jugando, a un ritmo parecido al del diario (100-775 al día). Se aplican
// al guardar (panel) y, al arrancar, a lo que ya estuviera guardado por encima (recortarPremios).
const TOPES_ORO = {
    'cumpleanos.oro': 2000,
    'clanes.premioOro': 1000,
    'clanes.premioGuerra': 2000,
    'clanes.costeCrear': 100000,
    'crecimiento.invitaciones.oroPorInvitacion': 300,
    'crecimiento.bump.oroPorBump': 150,
    'crecimiento.votos.oroExtra': 1000,
    'dinamicas.qotd.oro': 300,
    'dinamicas.gota.oro': 300,
    'dinamicas.trivia.oro': 300,
    'dinamicas.reto.oro': 500,
    'dinamicas.tesoro.oro': 500,
    'dinamicas.miembroSemana.oro': 2000,
    'evento.premioOro': 1000,
    'temporadas.oro': 5000,
};
const topeOro = (clave, n) => Math.max(0, Math.min(TOPES_ORO[clave] ?? 1000, Math.floor(Number(n) || 0)));

// Al arrancar: recorta lo guardado por encima del tope (una consulta por clave, solo si hay algo).
async function recortarPremios() {
    const ServidorConfig = require('../models/ServidorConfig.js');
    let n = 0;
    for (const [clave, tope] of Object.entries(TOPES_ORO)) {
        if (clave.startsWith('evento.')) continue;
        if (clave === 'temporadas.oro') {
            const r = await ServidorConfig.updateMany({ 'temporadas.oro': { $elemMatch: { $gt: tope } } }, [{ $set: { 'temporadas.oro': { $map: { input: '$temporadas.oro', as: 'o', in: { $min: ['$$o', tope] } } } } }], { updatePipeline: true }).catch(() => null);
            n += r?.modifiedCount || 0;
            continue;
        }
        const r = await ServidorConfig.updateMany({ [clave]: { $gt: tope } }, { $set: { [clave]: tope } }).catch(() => null);
        n += r?.modifiedCount || 0;
    }
    const r = await require('../models/Evento.js').updateMany({ premioOro: { $gt: TOPES_ORO['evento.premioOro'] } }, { $set: { premioOro: TOPES_ORO['evento.premioOro'] } }).catch(() => null);
    n += r?.modifiedCount || 0;
    if (n) console.log(`🪙 Premios en oro recortados al tope en ${n} sitio(s).`);
    return n;
}

module.exports = { limite, LIMITES_FREE, TOPES_ORO, topeOro, recortarPremios };
