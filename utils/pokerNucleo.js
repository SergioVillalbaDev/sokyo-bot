// Póker Texas Hold'em (1.33.0) — reglas puras, sin Discord ni BD (las prueban test/poker.test.js).
// Una mesa de 2 a 6 personas con fichas = oro. Ciegas, cuatro calles (preflop, flop, turn, river),
// botes laterales con all-in y la mejor mano de 5 entre 7 cartas. La casa se lleva un RAKE pequeño de
// cada bote que llega al flop («sin flop no hay comisión»): así el oro sale poco a poco de la economía.
const { baraja } = require('./casinoNucleo.js');

const RAKE = 0.02;
const MAX_JUGADORES = 6;
const VALOR = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13, A: 14 };
const valor = (c) => VALOR[c.slice(0, -1)];
const palo = (c) => c.slice(-1);
const CATEGORIAS = [
    ['Carta alta', 'High card'], ['Pareja', 'Pair'], ['Doble pareja', 'Two pair'], ['Trío', 'Three of a kind'], ['Escalera', 'Straight'],
    ['Color', 'Flush'], ['Full', 'Full house'], ['Póker', 'Four of a kind'], ['Escalera de color', 'Straight flush'],
];

// ---------------------------------------------------------------------------
// Manos
// ---------------------------------------------------------------------------
// Valor de 5 cartas: [categoría, desempates…] (se comparan en orden).
function evaluar5(cartas) {
    const v = cartas.map(valor).sort((a, b) => b - a);
    const color = cartas.every((c) => palo(c) === palo(cartas[0]));
    const unicos = [...new Set(v)];
    let alta = 0;
    if (unicos.length === 5) {
        if (v[0] - v[4] === 4) alta = v[0];
        else if (v[0] === 14 && v[1] === 5) alta = 5; // A-2-3-4-5
    }
    if (alta && color) return [8, alta];
    const cuenta = {};
    for (const x of v) cuenta[x] = (cuenta[x] || 0) + 1;
    const grupos = Object.entries(cuenta).map(([x, n]) => [Number(x), n]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const ord = grupos.map((g) => g[0]);
    if (grupos[0][1] === 4) return [7, ...ord];
    if (grupos[0][1] === 3 && grupos[1][1] === 2) return [6, ...ord];
    if (color) return [5, ...v];
    if (alta) return [4, alta];
    if (grupos[0][1] === 3) return [3, ...ord];
    if (grupos[0][1] === 2 && grupos[1][1] === 2) return [2, ...ord];
    if (grupos[0][1] === 2) return [1, ...ord];
    return [0, ...v];
}
const comparar = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
// La mejor de 5 entre 5-7 cartas: { valor, cartas, categoria }.
function mejorMano(cartas) {
    let mejor = null;
    const n = cartas.length;
    const elegir = (desde, actual) => {
        if (actual.length === 5) { const e = evaluar5(actual); if (!mejor || comparar(e, mejor.valor) > 0) mejor = { valor: e, cartas: [...actual] }; return; }
        for (let i = desde; i < n; i++) { actual.push(cartas[i]); elegir(i + 1, actual); actual.pop(); }
    };
    elegir(0, []);
    return { ...mejor, categoria: mejor.valor[0] };
}
const nombreMano = (cat, idioma) => CATEGORIAS[cat][idioma === 'en' ? 1 : 0];

// ---------------------------------------------------------------------------
// Botes: `aportes` = { id: fichas puestas en la mano }; `vivos` = quienes no se han retirado.
// Devuelve [{ monto, elegibles }] (el principal primero). Lo que nadie más ha igualado vuelve a su dueño
// en un bote con un solo elegible.
// ---------------------------------------------------------------------------
function calcularBotes(aportes, vivos) {
    const resto = Object.fromEntries(Object.entries(aportes).filter(([, x]) => x > 0));
    const botes = [];
    const orden = Object.keys(aportes);
    while (Object.keys(resto).length) {
        const m = Math.min(...Object.values(resto));
        const participantes = orden.filter((id) => resto[id] > 0);
        const monto = m * participantes.length;
        const elegibles = participantes.filter((id) => vivos.has(id));
        for (const id of participantes) { resto[id] -= m; if (resto[id] === 0) delete resto[id]; }
        const ult = botes[botes.length - 1];
        if (ult && ult.elegibles.join() === elegibles.join()) ult.monto += monto;
        else botes.push({ monto, elegibles });
    }
    // Un bote sin nadie que pueda ganarlo (solo pusieron los que se retiraron) va al anterior.
    for (let i = botes.length - 1; i > 0; i--) if (!botes[i].elegibles.length) { botes[i - 1].monto += botes[i].monto; botes.splice(i, 1); }
    // Si quedan elegibles que ya no tenían fichas en una capa (p. ej. el bote se fundió con el anterior), se juntan.
    for (let i = botes.length - 1; i > 0; i--) if (botes[i].elegibles.join() === botes[i - 1].elegibles.join()) { botes[i - 1].monto += botes[i].monto; botes.splice(i, 1); }
    return botes;
}

// ---------------------------------------------------------------------------
// La mano (máquina de estados). `jugadores` = [{ id, fichas }] en el orden de la mesa.
// ---------------------------------------------------------------------------
function nuevaMano({ jugadores, boton = 0, ciega, mazo = baraja(undefined, 1) }) {
    const m = {
        jugadores: jugadores.map((j) => ({ id: j.id, fichas: j.fichas, apuesta: 0, aporte: 0, fuera: false, allin: false, actuo: false, cartas: [] })),
        boton: boton % jugadores.length, ciegaG: ciega, ciegaP: Math.max(1, Math.floor(ciega / 2)), mazo: [...mazo], comunes: [],
        calle: 'preflop', apuestaMax: 0, minSubida: ciega, turno: -1, log: [], resultado: null, rake: 0,
    };
    for (let r = 0; r < 2; r++) for (const j of m.jugadores) j.cartas.push(m.mazo.pop());
    const n = m.jugadores.length;
    const sb = n === 2 ? m.boton : (m.boton + 1) % n;
    const bb = (sb + 1) % n;
    poner(m, m.jugadores[sb], m.ciegaP);
    poner(m, m.jugadores[bb], m.ciegaG);
    m.apuestaMax = Math.max(m.jugadores[sb].apuesta, m.jugadores[bb].apuesta, m.ciegaG);
    m.ciegas = { sb: m.jugadores[sb].id, bb: m.jugadores[bb].id };
    m.turno = siguiente(m, bb);
    if (m.turno === -1 || puedenActuar(m).length === 0 || (puedenActuar(m).length === 1 && m.jugadores[m.turno].apuesta >= m.apuestaMax)) avanzar(m);
    return m;
}
function poner(m, j, x) {
    const p = Math.min(x, j.fichas);
    j.fichas -= p; j.apuesta += p; j.aporte += p;
    if (j.fichas === 0) j.allin = true;
    return p;
}
const vivos = (m) => m.jugadores.filter((j) => !j.fuera);
const puedenActuar = (m) => m.jugadores.filter((j) => !j.fuera && !j.allin);
// El siguiente (después de `i`) que puede actuar, o -1.
function siguiente(m, i) {
    const n = m.jugadores.length;
    for (let k = 1; k <= n; k++) { const j = m.jugadores[(i + k) % n]; if (!j.fuera && !j.allin) return (i + k) % n; }
    return -1;
}
// Lo que puede hacer quien tiene el turno.
function opciones(m) {
    if (m.calle === 'fin' || m.turno < 0) return null;
    const j = m.jugadores[m.turno];
    const igualar = Math.min(m.apuestaMax - j.apuesta, j.fichas);
    const minHasta = Math.min(m.apuestaMax + m.minSubida, j.apuesta + j.fichas);
    return {
        id: j.id, igualar, pasar: igualar === 0, puedeSubir: j.fichas > igualar && puedenActuar(m).length > 1,
        minHasta, maxHasta: j.apuesta + j.fichas, bote: m.jugadores.reduce((a, x) => a + x.aporte, 0),
    };
}
// Actúa quien tiene el turno: 'retirarse' | 'pasar' | 'igualar' | 'subir' (hasta = apuesta total en esta calle) | 'allin'.
function actuar(m, id, accion, hasta = 0) {
    const op = opciones(m);
    if (!op || op.id !== id) return { motivo: 'turno' };
    const j = m.jugadores[m.turno];
    if (accion === 'pasar' && !op.pasar) accion = 'igualar';
    if (accion === 'allin') { accion = j.fichas > op.igualar ? 'subir' : 'igualar'; hasta = j.apuesta + j.fichas; }
    if (accion === 'retirarse') { if (op.pasar) accion = 'pasar'; else { j.fuera = true; m.log.push([id, 'retirarse']); } }
    if (accion === 'pasar') m.log.push([id, 'pasar']);
    else if (accion === 'igualar') { poner(m, j, op.igualar); m.log.push([id, 'igualar', j.apuesta]); }
    else if (accion === 'subir') {
        if (!op.puedeSubir) { poner(m, j, op.igualar); m.log.push([id, 'igualar', j.apuesta]); } else {
            hasta = Math.max(op.minHasta, Math.min(op.maxHasta, Math.floor(hasta)));
            const subida = hasta - m.apuestaMax;
            poner(m, j, hasta - j.apuesta);
            if (subida >= m.minSubida) m.minSubida = subida;
            if (j.apuesta > m.apuestaMax) {
                m.apuestaMax = j.apuesta;
                for (const o of m.jugadores) if (o !== j) o.actuo = false;
            }
            m.log.push([id, j.allin ? 'allin' : 'subir', j.apuesta]);
        }
    }
    j.actuo = true;
    // ¿Sigue la calle?
    if (vivos(m).length === 1) return terminar(m), { ok: true };
    const pendientes = puedenActuar(m).filter((x) => !x.actuo || x.apuesta < m.apuestaMax);
    if (pendientes.length && !(puedenActuar(m).length === 1 && puedenActuar(m)[0].apuesta >= m.apuestaMax)) {
        m.turno = siguiente(m, m.turno);
        return { ok: true };
    }
    avanzar(m);
    return { ok: true };
}
// Cierra la calle y pasa a la siguiente (o reparte hasta el final si ya nadie puede apostar).
function avanzar(m) {
    for (;;) {
        for (const j of m.jugadores) { j.apuesta = 0; j.actuo = false; }
        m.apuestaMax = 0; m.minSubida = m.ciegaG;
        if (m.calle === 'preflop') { m.mazo.pop(); m.comunes.push(m.mazo.pop(), m.mazo.pop(), m.mazo.pop()); m.calle = 'flop'; }
        else if (m.calle === 'flop') { m.mazo.pop(); m.comunes.push(m.mazo.pop()); m.calle = 'turn'; }
        else if (m.calle === 'turn') { m.mazo.pop(); m.comunes.push(m.mazo.pop()); m.calle = 'river'; }
        else { terminar(m); return; }
        // Con uno o ninguno que pueda apostar, se reparten las cartas que faltan sin preguntar.
        if (puedenActuar(m).length >= 2) { m.turno = siguiente(m, m.boton); return; }
    }
}
// Reparte los botes. resultado = { ganancias: { id: fichas }, botes: [{ monto, ganadores, mano }], manos: { id: {…} }, showdown }.
function terminar(m) {
    m.calle = 'fin'; m.turno = -1;
    const aportes = Object.fromEntries(m.jugadores.map((j) => [j.id, j.aporte]));
    const vivosIds = new Set(vivos(m).map((j) => j.id));
    const botes = calcularBotes(aportes, vivosIds);
    const showdown = vivosIds.size > 1;
    const manos = {};
    if (showdown) for (const j of vivos(m)) manos[j.id] = mejorMano([...j.cartas, ...m.comunes]);
    const ganancias = Object.fromEntries(m.jugadores.map((j) => [j.id, 0]));
    const detalle = [];
    const conFlop = m.comunes.length >= 3;
    for (const b of botes) {
        let monto = b.monto;
        // Comisión solo en botes disputados que han llegado al flop.
        if (conFlop && b.elegibles.length > 1) { const r = Math.floor(monto * RAKE); m.rake += r; monto -= r; }
        let ganadores = b.elegibles;
        if (showdown && b.elegibles.length > 1) {
            let mejor = null;
            for (const id of b.elegibles) { const c = mejor ? comparar(manos[id].valor, mejor) : 1; if (c > 0) { mejor = manos[id].valor; ganadores = [id]; } else if (c === 0) ganadores = [...ganadores, id]; }
        }
        const cada = Math.floor(monto / ganadores.length);
        ganadores.forEach((id, i) => { ganancias[id] += cada + (i === 0 ? monto - cada * ganadores.length : 0); });
        detalle.push({ monto, ganadores, categoria: showdown && ganadores.length ? manos[ganadores[0]]?.categoria ?? null : null });
    }
    for (const j of m.jugadores) j.fichas += ganancias[j.id];
    m.resultado = { ganancias, botes: detalle, manos, showdown };
}

module.exports = { RAKE, MAX_JUGADORES, CATEGORIAS, valor, evaluar5, comparar, mejorMano, nombreMano, calcularBotes, nuevaMano, opciones, actuar, poner, vivos, puedenActuar };
