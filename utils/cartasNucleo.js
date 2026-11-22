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
function cartaAlAzar(rareza, azar) {
    const todas = [...K.ANIME.entries()].filter(([, c]) => c.rareza === rareza).map(([id]) => id);
    if (!todas.length) return null;
    return todas[Math.floor(azar() * todas.length) % todas.length];
}
const CAMBIO_QUITADA = 0.4; // una carta de serie quitada se cambia por el 40 % de lo que vale en el sobre

// Abre un sobre sobre una colección ({ cartas, sinEpicaCartas }). Devuelve las 3 cartas
// (con si son nuevas, sus estrellas y el oro devuelto) y la piedad nueva.
function abrirSobre(col, sobre, azar = require('./casinoNucleo.js').azarSeguro, quitados = null) {
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
        let id = cartaAlAzar(rareza, azar);
        while (!id && K.RAREZAS[rareza].orden > 0) { rareza = ORDEN[K.RAREZAS[rareza].orden - 1]; id = cartaAlAzar(rareza, azar); }
        if (!id) continue;
        if (K.RAREZAS[rareza].orden >= 2) hayEpica = true;
        if (quitados && quitados.has(id)) {
            salen.push({ id: null, rareza, quitada: true, nuevo: false, estrellas: 0, devuelto: Math.floor((def.precio / CARTAS_POR_SOBRE) * CAMBIO_QUITADA * (1 + K.RAREZAS[rareza].orden)) });
            continue;
        }
        const antes = tengo.get(id) || 0;
        let estrellas = 1; let devuelto = 0;
        if (antes) {
            if (antes >= MAX_ESTRELLAS) { estrellas = MAX_ESTRELLAS; devuelto = Math.floor((def.precio / CARTAS_POR_SOBRE) * DEVOLUCION); }
            else estrellas = antes + 1;
        }
        tengo.set(id, estrellas);
        salen.push({ id, rareza, nuevo: !antes, estrellas, devuelto });
    }
    sinEpica = hayEpica ? 0 : sinEpica + 1;
    return { cartas: salen, sinEpica, piedad, devuelto: salen.reduce((a, c) => a + c.devuelto, 0) };
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
    const e = P.efectoCarta(cartaId, carta.estrellas || 1, m.id);
    if (!e) return { fallo: 'sinCarta' };
    const r = P.aplicarEfecto(e, m, { ahora, bromas, azar });
    const d = K.def(cartaId);
    return { ...r, carta: cartaId, emoji: P.ARQUETIPOS[d.poder.tipo].emoji, nombre: { es: d.poder.es, en: d.poder.en }, usadas: usadas + 1, limite };
}

module.exports = { CAMBIO_QUITADA, SOBRES, CARTAS_POR_SOBRE, PIEDAD, MAX_ESTRELLAS, DEVOLUCION, CARTAS_DIA, ESPERA_CARTA_H, rarezaAlAzar, cartaAlAzar, abrirSobre, limiteDia, faltaCarta, usarCarta };
