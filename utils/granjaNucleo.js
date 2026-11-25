// Granja, álbum de mascotas y misiones semanales (1.28.0) — reglas puras.
//
// · Granja: tus mejores mascotas (hasta `huecos`) producen oro solas mientras no estás.
//   Producen más cuanto más raras, con más estrellas, más nivel de afinidad y mejor cuidadas
//   (barriga y alegría). Las que están de expedición no producen. Se guarda hasta TOPE_H horas:
//   hay que pasar a recogerlo (premia volver, no estar pegado a la pantalla).
// · Álbum: HITOS por mascotas DISTINTAS del catálogo (las de cada servidor no cuentan, para que
//   valga igual en todas partes). Cada hito da oro una vez y algunos abren un hueco más en la granja.
// · Misiones semanales: metas grandes que se cumplen jugando normal durante la semana.
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');

const HORA = 3600000;
const TOPE_H = 12;
const HUECOS_BASE = 3;
// Oro por hora de una mascota de 1 ★, nivel 0 y bien cuidada (factor 1).
const PRODUCCION = { comun: 3, rara: 5, epica: 8, legendaria: 13, mitica: 20, divina: 35 };
const POR_ESTRELLA = 0.15;  // +15 % por cada estrella por encima de 1
const POR_NIVEL = 0.02;     // +2 % por nivel de afinidad (nivel 30 → +60 %)

// Lo bien cuidada que está: de ×0,5 (hambrienta o triste) a ×1,2 (barriga y alegría a tope).
function factorCuidado(m, ahora = Date.now()) {
    const e = P.estado(m, ahora);
    const peor = Math.min(e.hambre ?? 80, e.alegria ?? 80);
    return Math.round((0.5 + 0.7 * Math.max(0, Math.min(100, peor)) / 100) * 100) / 100;
}

// Oro por hora de una mascota (0 si está de expedición).
function produccion(m, ahora = Date.now()) {
    if (!m || P.expedicionActiva(m, ahora)) return 0;
    const d = K.def(m.id);
    const base = PRODUCCION[d?.rareza] || 0;
    const est = 1 + POR_ESTRELLA * Math.max(0, (m.estrellas || 1) - 1);
    const niv = 1 + POR_NIVEL * P.nivel(m.afinidad || 0);
    return Math.round(base * est * niv * factorCuidado(m, ahora) * 10) / 10;
}

// Mascotas distintas del catálogo que tiene (lo que cuenta para el álbum).
function distintas(col) {
    return new Set((col?.mascotas || []).map((m) => m.id).filter((id) => K.COMPANEROS[id])).size;
}
const TOTAL = () => Object.keys(K.COMPANEROS).length;
const HITOS = [
    { n: 3, oro: 250 }, { n: 5, oro: 500, hueco: true }, { n: 10, oro: 1200, hueco: true },
    { n: 15, oro: 2000 }, { n: 20, oro: 3500, hueco: true }, { n: 30, oro: 6000, hueco: true },
    { n: 40, oro: 10000 }, { n: 50, oro: 15000, hueco: true }, { n: 'todas', oro: 30000, hueco: true },
];
const nHito = (h) => (h.n === 'todas' ? TOTAL() : h.n);

// Huecos de granja que tiene (los de base más los de los hitos alcanzados).
function huecos(col) {
    const n = distintas(col);
    return HUECOS_BASE + HITOS.filter((h) => h.hueco && n >= nHito(h)).length;
}
// Hitos alcanzados que aún no se le han premiado.
function hitosNuevos(col) {
    const n = distintas(col);
    const ya = new Set((col?.hitosAlbum || []).map(String));
    return HITOS.filter((h) => n >= nHito(h) && !ya.has(String(h.n)));
}
function siguienteHito(col) {
    const n = distintas(col);
    return HITOS.find((h) => n < nHito(h)) || null;
}
// Por rareza: cuántas tiene de cuántas hay.
function porRareza(col) {
    const tengo = new Set((col?.mascotas || []).map((m) => m.id));
    const r = {};
    for (const [id, d] of Object.entries(K.COMPANEROS)) {
        r[d.rareza] = r[d.rareza] || { tienes: 0, total: 0 };
        r[d.rareza].total++;
        if (tengo.has(id)) r[d.rareza].tienes++;
    }
    return r;
}

// Las que trabajan: las que más producen ahora, hasta llenar los huecos.
function trabajando(col, ahora = Date.now()) {
    return (col?.mascotas || []).map((m) => ({ m, oroH: produccion(m, ahora) }))
        .filter((x) => x.oroH > 0).sort((a, b) => b.oroH - a.oroH).slice(0, huecos(col));
}
// Lo que hay para recoger. Sin `granja.desde` (primera vez) no hay nada: empieza a contar ahora.
function acumulado(col, ahora = Date.now()) {
    const equipo = trabajando(col, ahora);
    // 1.33.0: la comodidad de la casa sube la producción (hasta +25 %).
    const porHora = Math.round(equipo.reduce((a, x) => a + x.oroH, 0) * (1 + require('./casaNucleo.js').bonusGranja(col?.casa || {})) * 10) / 10;
    const desde = col?.granja?.desde ? new Date(col.granja.desde).getTime() : null;
    if (!desde) return { oro: 0, horas: 0, porHora, equipo, lleno: false, nueva: true, llenoEn: TOPE_H * HORA };
    const horas = Math.max(0, Math.min(TOPE_H, (ahora - desde) / HORA));
    return { oro: Math.floor(porHora * horas), horas, porHora, equipo, lleno: horas >= TOPE_H, nueva: false, llenoEn: Math.max(0, (TOPE_H - horas) * HORA) };
}

// ---------- Misiones semanales ----------
// Semana ISO (lunes a domingo, UTC): «2026-W47».
function semanaDe(ahora = Date.now()) {
    const d = new Date(ahora);
    const dia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dow = dia.getUTCDay() || 7;
    dia.setUTCDate(dia.getUTCDate() + 4 - dow);
    const ini = new Date(Date.UTC(dia.getUTCFullYear(), 0, 1));
    const sem = Math.ceil(((dia - ini) / 86400000 + 1) / 7);
    return `${dia.getUTCFullYear()}-W${String(sem).padStart(2, '0')}`;
}
const MISIONES_SEMANA = {
    cuidar: { emoji: '🤗', n: 40, es: 'Cuida a tus mascotas 40 veces', en: 'Care for your pets 40 times' },
    expedicion: { emoji: '🧭', n: 8, es: 'Manda 8 expediciones', en: 'Send 8 expeditions' },
    granja: { emoji: '🧺', n: 6, es: 'Recoge la granja 6 veces', en: 'Collect the farm 6 times' },
    carta: { emoji: '🃏', n: 6, es: 'Usa 6 cartas en tus mascotas', en: 'Use 6 cards on your pets' },
};
const PREMIO_SEMANA = 400;
const PREMIO_SEMANA_TODAS = 1000;
// Suma `n` a una misión semanal. Devuelve { sem, cumplida (id|null), todas }.
function avanzarSemana(sem0, accion, semana, n = 1) {
    const sem = sem0 && sem0.id === semana ? { id: semana, prog: { ...(sem0.prog || {}) }, hechas: [...(sem0.hechas || [])], todas: !!sem0.todas } : { id: semana, prog: {}, hechas: [], todas: false };
    const def = MISIONES_SEMANA[accion];
    if (!def || sem.hechas.includes(accion)) return { sem, cumplida: null, todas: false };
    sem.prog[accion] = (sem.prog[accion] || 0) + n;
    let cumplida = null; let todas = false;
    if (sem.prog[accion] >= def.n) {
        sem.hechas.push(accion); cumplida = accion;
        if (!sem.todas && Object.keys(MISIONES_SEMANA).every((k) => sem.hechas.includes(k))) { sem.todas = true; todas = true; }
    }
    return { sem, cumplida, todas };
}

module.exports = {
    TOPE_H, HUECOS_BASE, PRODUCCION, POR_ESTRELLA, POR_NIVEL, HITOS, MISIONES_SEMANA, PREMIO_SEMANA, PREMIO_SEMANA_TODAS,
    factorCuidado, produccion, distintas, TOTAL, nHito, huecos, hitosNuevos, siguienteHito, porRareza, trabajando, acumulado,
    semanaDe, avanzarSemana,
};
