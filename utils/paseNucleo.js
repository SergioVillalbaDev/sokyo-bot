// Pase de temporada y logros (1.29.0) — reglas puras. Gratis: no se compra nada.
//
// · Pase: cada mes (UTC) hay una temporada nueva. Casi todo da XP del pase (cuidar, expediciones,
//   granja, cartas, cofres, sobres, misiones…). Cada nivel da oro y, cada pocos, TICKETS de sobres
//   y cofres gratis. El casino también da algo de XP, pero con tope diario y lo mismo apuestes
//   1 que 5000: no premia apostar más.
// · Logros: metas de una vez con su premio en oro (y una insignia en /jugar pase logros).
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');

const XP_NIVEL = 100;
const NIVEL_MAX = 50;
const XP = { cuidar: 5, expedicion: 15, carta: 10, granja: 10, cofre: 20, sobre: 20, casino: 3, mision: 10, misionSemanal: 50, hito: 40, serie: 40, logro: 25, combate: 8, victoria: 12, torre: 10, jefe: 10, minijuego: 4, diarioLogin: 15, voto: 25 };
const TOPE_CASINO_DIA = 25; // partidas del casino que dan XP al día
const ORO_EXTRA = 75;       // cada nivel por encima del máximo (prestigio)

const temporadaDe = (ahora = Date.now()) => new Date(ahora).toISOString().slice(0, 7);
const diaDe = (ahora = Date.now()) => new Date(ahora).toISOString().slice(0, 10);

// Tickets: { tipo: 'sobre'|'cofre', id } → clave en la colección.
const TICKETS = {
    sobre_normal: { tipo: 'sobre', id: 'normal' }, sobre_brillante: { tipo: 'sobre', id: 'brillante' }, sobre_legendario: { tipo: 'sobre', id: 'legendario' },
    cofre_basico: { tipo: 'cofre', id: 'basico' }, cofre_epico: { tipo: 'cofre', id: 'epico' }, cofre_legendario: { tipo: 'cofre', id: 'legendario' },
};

// Premio del nivel `n` del pase (1..NIVEL_MAX). Siempre oro; cada 5, un sobre; cada 10, un cofre.
function premio(n) {
    if (n > NIVEL_MAX) return { oro: ORO_EXTRA, tickets: {} };
    const p = { oro: 50 + 5 * n, tickets: {} };
    if (n % 5 === 0) p.tickets.sobre_normal = 1;
    if (n % 10 === 0) p.tickets.cofre_epico = 1;
    if (n === 15 || n === 35) p.tickets.cofre_basico = 2;
    if (n === 25) p.tickets.sobre_brillante = 1;
    if (n === 40) p.tickets.sobre_brillante = 2;
    if (n === NIVEL_MAX) { p.tickets.sobre_legendario = 1; p.tickets.cofre_legendario = 1; p.titulo = true; }
    return p;
}
const nivelDe = (xp = 0) => Math.floor(Math.max(0, xp) / XP_NIVEL);

// El pase tal cual para esta temporada (si es de otra, empieza de cero).
function actual(pase, temporada) {
    return pase && pase.temp === temporada ? { temp: temporada, xp: pase.xp || 0, casinoHoy: pase.casinoHoy || null, max: pase.max || 0 } : { temp: temporada, xp: 0, casinoHoy: null, max: 0 };
}
// Suma XP por una acción. Devuelve { pase, xp (lo sumado), niveles: [n…] (los que sube), premios }.
function sumar(pase0, accion, { ahora = Date.now(), n = 1 } = {}) {
    const temporada = temporadaDe(ahora);
    const pase = actual(pase0, temporada);
    let xp = (XP[accion] || 0) * Math.max(0, n);
    if (accion === 'casino') {
        const dia = diaDe(ahora);
        const hoy = pase.casinoHoy && pase.casinoHoy.dia === dia ? pase.casinoHoy.n || 0 : 0;
        const cuenta = Math.max(0, Math.min(n, TOPE_CASINO_DIA - hoy));
        xp = XP.casino * cuenta;
        pase.casinoHoy = { dia, n: hoy + cuenta };
    }
    if (!xp) return { pase, xp: 0, niveles: [], premios: { oro: 0, tickets: {} } };
    const antes = nivelDe(pase.xp);
    pase.xp += xp;
    const despues = nivelDe(pase.xp);
    const niveles = [];
    for (let i = Math.max(antes, pase.max || 0) + 1; i <= despues; i++) niveles.push(i);
    pase.max = Math.max(pase.max || 0, despues);
    const premios = { oro: 0, tickets: {}, titulo: false };
    for (const i of niveles) {
        const p = premio(i);
        premios.oro += p.oro;
        for (const [k, v] of Object.entries(p.tickets)) premios.tickets[k] = (premios.tickets[k] || 0) + v;
        if (p.titulo) premios.titulo = true;
    }
    return { pase, xp, niveles, premios };
}

// ---------- Logros ----------
const rarezaMax = (col) => Math.max(-1, ...(col.mascotas || []).map((m) => K.RAREZAS[K.def(m.id)?.rareza]?.orden ?? -1));
const tieneRareza = (col, r) => (col.mascotas || []).some((m) => K.def(m.id)?.rareza === r);
const distintasCat = (col) => new Set((col.mascotas || []).map((m) => m.id).filter((id) => K.COMPANEROS[id])).size;
const cuidados = (col) => (col.mascotas || []).reduce((a, m) => a + (m.cuidados || 0), 0);
const nivelMax = (col) => Math.max(0, ...(col.mascotas || []).map((m) => P.nivel(m.afinidad || 0)));
const LOGROS = [
    { id: 'primera', emoji: '🥚', oro: 100, es: 'Primera mascota', en: 'First pet', ok: (c) => (c.mascotas || []).length >= 1 },
    { id: 'diez', emoji: '🐾', oro: 500, es: 'Diez mascotas distintas', en: 'Ten different pets', ok: (c) => distintasCat(c) >= 10 },
    { id: 'treinta', emoji: '🦁', oro: 2500, es: 'Treinta mascotas distintas', en: 'Thirty different pets', ok: (c) => distintasCat(c) >= 30 },
    { id: 'todas', emoji: '👑', oro: 20000, es: 'Todas las mascotas', en: 'Every pet', ok: (c) => distintasCat(c) >= Object.keys(K.COMPANEROS).length },
    { id: 'legendaria', emoji: '🟡', oro: 750, es: 'Una mascota legendaria', en: 'A legendary pet', ok: (c) => rarezaMax(c) >= 3 },
    { id: 'mitica', emoji: '🔴', oro: 2000, es: 'Una mascota mítica', en: 'A mythic pet', ok: (c) => rarezaMax(c) >= 4 },
    { id: 'divina', emoji: '🌈', oro: 10000, es: 'La mascota divina', en: 'The divine pet', ok: (c) => tieneRareza(c, 'divina') },
    { id: 'cinco', emoji: '⭐', oro: 1000, es: 'Una mascota con 5 ★', en: 'A 5 ★ pet', ok: (c) => (c.mascotas || []).some((m) => (m.estrellas || 1) >= 5) },
    { id: 'cuida100', emoji: '🤗', oro: 500, es: '100 cuidados', en: '100 cares', ok: (c) => cuidados(c) >= 100 },
    { id: 'cuida1000', emoji: '💖', oro: 4000, es: '1000 cuidados', en: '1000 cares', ok: (c) => cuidados(c) >= 1000 },
    { id: 'nivel10', emoji: '💞', oro: 800, es: 'Una mascota a nivel 10', en: 'A pet at level 10', ok: (c) => nivelMax(c) >= 10 },
    { id: 'nivel30', emoji: '💍', oro: 5000, es: 'Una mascota a nivel 30', en: 'A pet at level 30', ok: (c) => nivelMax(c) >= P.NIVEL_MAX },
    { id: 'racha7', emoji: '🔥', oro: 700, es: 'Racha de 7 días', en: '7-day streak', ok: (c) => (c.mejorRacha || 0) >= 7 },
    { id: 'racha30', emoji: '☄️', oro: 4000, es: 'Racha de 30 días', en: '30-day streak', ok: (c) => (c.mejorRacha || 0) >= 30 },
    { id: 'granja10k', emoji: '🧺', oro: 1000, es: '10.000 de oro de la granja', en: '10,000 gold from the farm', ok: (c) => (c.oroGranja || 0) >= 10000 },
    { id: 'granja100k', emoji: '🏡', oro: 6000, es: '100.000 de oro de la granja', en: '100,000 gold from the farm', ok: (c) => (c.oroGranja || 0) >= 100000 },
    { id: 'cartas50', emoji: '🃏', oro: 800, es: '50 cartas distintas', en: '50 different cards', ok: (c) => (c.cartas || []).length >= 50 },
    { id: 'cartas200', emoji: '📚', oro: 5000, es: '200 cartas distintas', en: '200 different cards', ok: (c) => (c.cartas || []).length >= 200 },
    { id: 'carta5', emoji: '🌟', oro: 1000, es: 'Una carta con 5 ★', en: 'A 5 ★ card', ok: (c) => (c.cartas || []).some((x) => (x.estrellas || 1) >= 5) },
    { id: 'serie1', emoji: '📺', oro: 500, es: 'Completar una serie', en: 'Complete a series', ok: (c) => (c.seriesCompletas || []).length >= 1 },
    { id: 'serie10', emoji: '🎬', oro: 5000, es: 'Completar 10 series', en: 'Complete 10 series', ok: (c) => (c.seriesCompletas || []).length >= 10 },
    { id: 'sobres100', emoji: '🎴', oro: 2000, es: 'Abrir 100 sobres', en: 'Open 100 packs', ok: (c) => (c.sobresAbiertos || 0) >= 100 },
    { id: 'pase25', emoji: '🎟️', oro: 1500, es: 'Nivel 25 del pase', en: 'Pass level 25', ok: (c) => (c.pase?.max || 0) >= 25 },
    { id: 'pase50', emoji: '🏆', oro: 5000, es: 'Pase completo (nivel 50)', en: 'Full pass (level 50)', ok: (c) => (c.pase?.max || 0) >= NIVEL_MAX },
    // 1.32.0: combates (contadores en col.cbt, los suma utils/combate.js y utils/jefe.js)
    { id: 'victoria1', emoji: '⚔️', oro: 200, es: 'Primera victoria en combate', en: 'First battle win', ok: (c) => (c.cbt?.victorias || 0) >= 1 },
    { id: 'victoria50', emoji: '🗡️', oro: 2500, es: '50 victorias en combate', en: '50 battle wins', ok: (c) => (c.cbt?.victorias || 0) >= 50 },
    { id: 'torre20', emoji: '🗼', oro: 1500, es: 'Piso 20 de la torre', en: 'Tower floor 20', ok: (c) => (c.cbt?.torre || 0) >= 20 },
    { id: 'torre50', emoji: '🏯', oro: 6000, es: 'Cima de la torre (piso 50)', en: 'Top of the tower (floor 50)', ok: (c) => (c.cbt?.torre || 0) >= 50 },
    { id: 'cazajefes', emoji: '🐉', oro: 1000, es: '20 ataques al jefe', en: '20 boss attacks', ok: (c) => (c.cbt?.jefe || 0) >= 20 },
];
function logrosNuevos(col) {
    const ya = new Set(col?.logros || []);
    return LOGROS.filter((l) => !ya.has(l.id) && l.ok(col || {}));
}

module.exports = { XP_NIVEL, NIVEL_MAX, XP, TOPE_CASINO_DIA, ORO_EXTRA, TICKETS, temporadaDe, premio, nivelDe, actual, sumar, LOGROS, logrosNuevos };
