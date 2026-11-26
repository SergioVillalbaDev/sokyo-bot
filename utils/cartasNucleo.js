// Cartas de anime (1.24.0) — reglas puras. Los personajes del Pack anime
// (cofresNucleo.ANIME, id «a:<idAniList>») ya no son mascotas: son CARTAS que salen en
// SOBRES (otra lootbox, 3 cartas por sobre) y se usan cuando quieras sobre tu mascota para
// darle un empujón (compisNucleo.efectoCarta / aplicarEfecto). Las repetidas suben
// estrellas (hasta 5) y la carta es más fuerte. Cada carta se recarga en 20 h y se pueden
// usar 3 al día (más con mascotas de habilidad «recarga»/«divino»).
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');

const SOBRES = {
    normal: { precio: 300, emoji: '🃏', color: '#64748b', es: 'Sobre normal', en: 'Normal pack', prob: { comun: 72, rara: 22, epica: 5, legendaria: 0.9, mitica: 0.1, divina: 0 } },
    brillante: { precio: 1200, emoji: '✨', color: '#8b5cf6', es: 'Sobre brillante', en: 'Shiny pack', garantia: 'epica', prob: { comun: 40, rara: 38, epica: 17, legendaria: 4.2, mitica: 0.78, divina: 0.02 } },
    legendario: { precio: 4000, emoji: '🌟', color: '#f59e0b', es: 'Sobre legendario', en: 'Legendary pack', garantia: 'legendaria', prob: { comun: 0, rara: 40, epica: 40, legendaria: 16, mitica: 3.9, divina: 0.1 } },
};
const CARTAS_POR_SOBRE = 3;
const PIEDAD = 8;              // 8 sobres seguidos sin épica o mejor → el siguiente trae una segura
const MAX_ESTRELLAS = 5;
const DEVOLUCION = 0.15;       // repetida con 5 ★: devuelve el 15 % de lo que cuesta una carta del sobre
const CARTAS_DIA = 3;
const ESPERA_CARTA_H = 20;
const ORDEN = ['comun', 'rara', 'epica', 'legendaria', 'mitica', 'divina'];

function rarezaAlAzar(sobre, azar, minimo = null) {
    const prob = { ...SOBRES[sobre].prob };
    if (minimo) for (const r of ORDEN) if (K.RAREZAS[r].orden < K.RAREZAS[minimo].orden) prob[r] = 0;
    const total = Object.values(prob).reduce((a, b) => a + b, 0);
    let x = azar() * total;
    for (const r of [...ORDEN].reverse()) { x -= prob[r] || 0; if (x < 0) return r; }
    return minimo || 'comun';
}
// Una carta de esa rareza. Se tira SIEMPRE sobre todo el pack: si toca una de una serie quitada
// en el servidor, no se cambia por otra (eso subiría la probabilidad de las demás: no vale quitarlo
// todo menos tu favorita); quien abre recibe oro a cambio (abrirSobre).
// 1.32.0: `destacada` = la serie de la semana: sus cartas pesan ×SERIE_DESTACADA_X dentro de su rareza.
function cartaAlAzar(rareza, azar, destacada = null) {
    const todas = [...K.ANIME.entries()].filter(([, c]) => c.rareza === rareza);
    if (!todas.length) return null;
    if (!destacada) return todas[Math.floor(azar() * todas.length) % todas.length][0];
    const peso = (c) => (c.serie === destacada ? SERIE_DESTACADA_X : 1);
    const total = todas.reduce((a, [, c]) => a + peso(c), 0);
    let x = azar() * total;
    for (const [id, c] of todas) { x -= peso(c); if (x < 0) return id; }
    return todas[todas.length - 1][0];
}
// Serie destacada de la semana (lunes UTC): rota entre las series con 4 cartas o más.
const SERIE_DESTACADA_X = 3;
function serieDestacada(semana) {
    const grandes = [...series()].filter(([, ids]) => ids.length >= 4).map(([s]) => s).sort();
    if (!grandes.length) return null;
    let h = 2166136261; for (const ch of String(semana)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return grandes[h % grandes.length];
}
const CAMBIO_QUITADA = 0.4; // una carta de serie quitada se cambia por el 40 % de lo que vale en el sobre

// Abre un sobre sobre una colección ({ cartas, sinEpicaCartas }). Devuelve las 3 cartas
// (con si son nuevas, sus estrellas y el oro devuelto) y la piedad nueva.
function abrirSobre(col, sobre, azar = require('./casinoNucleo.js').azarSeguro, quitados = null, destacada = null) {
    const def = SOBRES[sobre];
    if (!def) return { fallo: 'sobre' };
    let sinEpica = col.sinEpicaCartas || 0;
    const piedad = sinEpica >= PIEDAD - 1;
    const tengo = new Map((col.cartas || []).map((c) => [c.id, c.estrellas || 1]));
    const salen = [];
    let hayEpica = false;
    for (let i = 0; i < CARTAS_POR_SOBRE; i++) {
        // La última carta trae la garantía del sobre (o la épica de la piedad).
        const ultima = i === CARTAS_POR_SOBRE - 1;
        let minimo = null;
        if (ultima && def.garantia) minimo = def.garantia;
        if (ultima && piedad && !hayEpica && (!minimo || K.RAREZAS[minimo].orden < 2)) minimo = 'epica';
        let rareza = rarezaAlAzar(sobre, azar, minimo);
        let id = cartaAlAzar(rareza, azar, destacada);
        while (!id && K.RAREZAS[rareza].orden > 0) { rareza = ORDEN[K.RAREZAS[rareza].orden - 1]; id = cartaAlAzar(rareza, azar, destacada); }
        if (!id) continue;
        if (K.RAREZAS[rareza].orden >= 2) hayEpica = true;
        // 1.32.0: holográfica (brilla y es un 5 % más fuerte en combate). Se tira SIEMPRE aquí, también
        // si la carta es de una serie quitada: así quitar series no cambia nada de lo demás.
        const holo = azar() < PROB_HOLO;
        if (quitados && quitados.has(id)) {
            salen.push({ id: null, rareza, quitada: true, nuevo: false, estrellas: 0, devuelto: Math.floor((def.precio / CARTAS_POR_SOBRE) * CAMBIO_QUITADA * (1 + K.RAREZAS[rareza].orden)) });
            continue;
        }
        const antes = tengo.get(id) || 0;
        let estrellas = 1; let devuelto = 0; let polvo = 0;
        if (antes) {
            // 1.32.0: la repetida al máximo da también polvo (para crear la carta que quieras).
            if (antes >= MAX_ESTRELLAS) { estrellas = MAX_ESTRELLAS; devuelto = Math.floor((def.precio / CARTAS_POR_SOBRE) * DEVOLUCION); polvo = POLVO[rareza]; }
            else estrellas = antes + 1;
        }
        tengo.set(id, estrellas);
        salen.push({ id, rareza, nuevo: !antes, estrellas, devuelto, polvo, holo });
    }
    sinEpica = hayEpica ? 0 : sinEpica + 1;
    return { cartas: salen, sinEpica, piedad, devuelto: salen.reduce((a, c) => a + c.devuelto, 0), polvo: salen.reduce((a, c) => a + (c.polvo || 0), 0) };
}

// Colecciones (1.25.0): las series con 2 cartas o más. Completar una da oro una vez
// (PREMIO_SERIE por carta) y SINERGIA: sus cartas son un 25 % más fuertes para siempre.
const PREMIO_SERIE = 150;
const SINERGIA = 0.25;
let seriesCache = null;
function series() {
    if (seriesCache) return seriesCache;
    const m = new Map();
    for (const [id, c] of K.ANIME) { if (!m.has(c.serie)) m.set(c.serie, []); m.get(c.serie).push(id); }
    seriesCache = new Map([...m].filter(([, ids]) => ids.length >= 2));
    return seriesCache;
}
// Series que ya tiene completas con estas cartas.
function seriesCompletas(cartas = []) {
    const tengo = new Set(cartas.map((c) => c.id));
    return [...series()].filter(([, ids]) => ids.every((id) => tengo.has(id))).map(([serie]) => serie);
}
// Las que acaba de completar (y aún no se le habían premiado), con su premio.
function nuevasSeries(cartas, yaPremiadas = []) {
    const ya = new Set(yaPremiadas);
    return seriesCompletas(cartas).filter((x) => !ya.has(x)).map((serie) => ({ serie, cartas: series().get(serie).length, oro: PREMIO_SERIE * series().get(serie).length }));
}
// Cómo vas en cada serie que has empezado (las más cerca de completarse primero).
function progresoSeries(cartas = [], max = 5) {
    const tengo = new Set(cartas.map((c) => c.id));
    return [...series()].map(([serie, ids]) => ({ serie, tienes: ids.filter((id) => tengo.has(id)).length, total: ids.length }))
        .filter((x) => x.tienes > 0 && x.tienes < x.total).sort((a, b) => b.tienes / b.total - a.tienes / a.total || b.total - a.total).slice(0, max);
}

// Regalar (1.25.0): se da una copia. Si tenías varias estrellas, bajas una; si solo una, la pierdes.
const REGALOS_DIA = 5;
function regalar(deCartas = [], aCartas = [], id) {
    const mia = deCartas.find((c) => c.id === id);
    if (!mia) return { fallo: 'sinCarta' };
    const nuevasDe = mia.estrellas > 1 ? deCartas.map((c) => (c.id === id ? { ...c, estrellas: c.estrellas - 1 } : c)) : deCartas.filter((c) => c.id !== id);
    const suya = aCartas.find((c) => c.id === id);
    let devuelto = 0;
    let nuevasA;
    if (!suya) nuevasA = [...aCartas, { id, estrellas: 1, primera: new Date() }];
    else if ((suya.estrellas || 1) >= MAX_ESTRELLAS) { nuevasA = aCartas; devuelto = 100; } // ya la tiene al máximo: le llega oro
    else nuevasA = aCartas.map((c) => (c.id === id ? { ...c, estrellas: (c.estrellas || 1) + 1 } : c));
    return { de: nuevasDe, a: nuevasA, nueva: !suya, devuelto };
}

// Cuántas cartas puedes usar hoy (con la habilidad de tu mascota equipada).
function limiteDia(mascotaId) {
    const h = mascotaId ? K.habilidad(mascotaId) : null;
    if (!h) return CARTAS_DIA;
    if (h.tipo === 'recarga') return CARTAS_DIA + h.valor;
    if (h.tipo === 'divino') return CARTAS_DIA + 1;
    return CARTAS_DIA;
}
const MIN = 60000;
function faltaCarta(carta, ahora = Date.now()) {
    const ult = carta && carta.usada ? new Date(carta.usada).getTime() : 0;
    return Math.max(0, Math.ceil((ult + ESPERA_CARTA_H * 3600000 - ahora) / MIN));
}
// Usa la carta `cartaId` sobre la mascota `m`. `dia` = 'YYYY-MM-DD'. Devuelve el efecto o { fallo }.
function usarCarta(col, cartaId, m, { ahora = Date.now(), dia, bromas = false, azar = Math.random, equipada = null } = {}) {
    const carta = (col.cartas || []).find((c) => c.id === cartaId);
    if (!carta) return { fallo: 'sinCarta' };
    if (!m) return { fallo: 'sinMascota' };
    const f = faltaCarta(carta, ahora);
    if (f) return { fallo: 'recargando', min: f };
    const usadas = col.cartasHoy && col.cartasHoy.dia === dia ? col.cartasHoy.n || 0 : 0;
    const limite = limiteDia(equipada || m.id);
    if (usadas >= limite) return { fallo: 'topeCartas', limite };
    // Con la serie completa, la carta es más fuerte (sinergia).
    const sinergia = (col.seriesCompletas || []).includes(K.def(cartaId).serie);
    const e = P.efectoCarta(cartaId, carta.estrellas || 1, m.id, sinergia ? SINERGIA : 0);
    if (!e) return { fallo: 'sinCarta' };
    const r = P.aplicarEfecto(e, m, { ahora, bromas, azar });
    const d = K.def(cartaId);
    return { ...r, carta: cartaId, emoji: P.ARQUETIPOS[d.poder.tipo].emoji, nombre: { es: d.poder.es, en: d.poder.en }, usadas: usadas + 1, limite };
}

// ---------------------------------------------------------------------------
// 1.32.0: polvo, desencantar, crear e intercambiar
// ---------------------------------------------------------------------------
const PROB_HOLO = 0.03;
const POLVO = { comun: 5, rara: 15, epica: 40, legendaria: 150, mitica: 500, divina: 2500 };   // al desencantar una copia
const COSTE_CREAR = { comun: 60, rara: 180, epica: 500, legendaria: 1800, mitica: 6000 };      // la divina no se puede crear
const INTERCAMBIOS_DIA = 5;
// Quita UNA copia (si tenía varias estrellas, baja una; si solo una, desaparece). Devuelve { cartas, polvo, ultima }.
function desencantar(cartas = [], id) {
    const c = cartas.find((x) => x.id === id);
    if (!c) return { fallo: 'sinCarta' };
    const r = K.def(id).rareza;
    const ultima = (c.estrellas || 1) <= 1;
    const nuevas = ultima ? cartas.filter((x) => x.id !== id) : cartas.map((x) => (x.id === id ? { ...x, estrellas: (x.estrellas || 1) - 1 } : x));
    return { cartas: nuevas, polvo: POLVO[r] || 0, ultima };
}
// Crea una copia de una carta con polvo (si ya la tienes, sube una estrella).
function crear(cartas = [], id, polvo = 0) {
    const d = K.ANIME.get(id);
    if (!d) return { fallo: 'noExiste' };
    const coste = COSTE_CREAR[d.rareza];
    if (!coste) return { fallo: 'divina' };
    const c = cartas.find((x) => x.id === id);
    if (c && (c.estrellas || 1) >= MAX_ESTRELLAS) return { fallo: 'max' };
    if (polvo < coste) return { fallo: 'polvo', coste, falta: coste - polvo };
    const nuevas = c ? cartas.map((x) => (x.id === id ? { ...x, estrellas: (x.estrellas || 1) + 1 } : x)) : [...cartas, { id, estrellas: 1, primera: new Date() }];
    return { cartas: nuevas, coste, nueva: !c };
}
// Cambio de una copia por otra entre dos personas. Si a alguien le llega una que ya tiene al máximo, recibe polvo.
function intercambiar(cartasA = [], cartasB = [], idA, idB) {
    if (!cartasA.some((c) => c.id === idA)) return { fallo: 'sinCartaA' };
    if (!cartasB.some((c) => c.id === idB)) return { fallo: 'sinCartaB' };
    if (idA === idB) return { fallo: 'iguales' };
    const r1 = regalar(cartasA, cartasB, idA);
    const r2 = regalar(r1.a, r1.de, idB);
    // r1: A da idA a B → r1.de (A sin idA), r1.a (B con idA). r2: B da idB a A → r2.de (B final), r2.a (A final).
    return { a: r2.a, b: r2.de, polvoA: r2.devuelto ? POLVO[K.def(idB).rareza] : 0, polvoB: r1.devuelto ? POLVO[K.def(idA).rareza] : 0 };
}

// 2.2.0: una carta gratis cada día (con las probabilidades del sobre normal, una sola carta; no
// cuenta para la piedad). Si sale una de una serie quitada, oro; repetida al máximo, polvo.
const CARTA_GRATIS_ORO_QUITADA = 40;
function cartaGratis(col, dia, azar = require('./casinoNucleo.js').azarSeguro, quitados = null, destacada = null) {
    if (col.cartaGratis === dia) return { fallo: 'hoy' };
    let rareza = rarezaAlAzar('normal', azar);
    let id = cartaAlAzar(rareza, azar, destacada);
    while (!id && K.RAREZAS[rareza].orden > 0) { rareza = ORDEN[K.RAREZAS[rareza].orden - 1]; id = cartaAlAzar(rareza, azar, destacada); }
    if (!id) return { fallo: 'vacio' };
    const holo = azar() < PROB_HOLO;
    if (quitados && quitados.has(id)) return { carta: { id: null, rareza, quitada: true, nuevo: false, estrellas: 0, devuelto: CARTA_GRATIS_ORO_QUITADA }, cartas: col.cartas || [], polvo: 0 };
    const cartas = [...(col.cartas || [])].map((c) => ({ ...c }));
    const ya = cartas.find((c) => c.id === id);
    let estrellas = 1; let polvo = 0;
    if (ya) {
        if ((ya.estrellas || 1) >= MAX_ESTRELLAS) { estrellas = MAX_ESTRELLAS; polvo = POLVO[rareza]; } else { estrellas = (ya.estrellas || 1) + 1; ya.estrellas = estrellas; }
    } else cartas.push({ id, estrellas: 1, primera: new Date() });
    return { carta: { id, rareza, nuevo: !ya, estrellas, devuelto: 0, polvo, holo }, cartas, polvo };
}

module.exports = {
    CARTA_GRATIS_ORO_QUITADA, cartaGratis,
    SERIE_DESTACADA_X, serieDestacada,
    PROB_HOLO, POLVO, COSTE_CREAR, INTERCAMBIOS_DIA, desencantar, crear, intercambiar, PREMIO_SERIE, SINERGIA, REGALOS_DIA, series, seriesCompletas, nuevasSeries, progresoSeries, regalar, CAMBIO_QUITADA, SOBRES, CARTAS_POR_SOBRE, PIEDAD, MAX_ESTRELLAS, DEVOLUCION, CARTAS_DIA, ESPERA_CARTA_H, rarezaAlAzar, cartaAlAzar, abrirSobre, limiteDia, faltaCarta, usarCarta };
