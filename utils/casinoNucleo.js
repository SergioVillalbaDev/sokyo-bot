// Casino de oro (1.16.0) — reglas puras de los juegos, sin Discord ni BD (las prueban
// los tests, también lo que devuelve cada juego a la larga: la casa siempre se queda
// un poco, así el oro sale de la economía). El oro es virtual: no se compra con dinero
// ni se cambia por dinero.
const crypto = require('crypto');

// Azar de verdad (crypto) por defecto; los tests pasan uno con semilla.
const azarSeguro = () => crypto.randomInt(0, 2 ** 32) / 2 ** 32;

// ---------------------------------------------------------------------------
// 🎰 Tragaperras: 3 rodillos. Tres iguales pagan según la tabla; dos cerezas en
// cualquier sitio pagan ×2 y dos iguales seguidos devuelven lo apostado. 💎💎💎 se
// lleva además el bote del servidor. Devuelve ~95 % a la larga (sin contar el bote).
// ---------------------------------------------------------------------------
const SIMBOLOS = [
    { id: 'cereza', emoji: '🍒', svg: '1f352', peso: 26, paga3: 7 },
    { id: 'limon', emoji: '🍋', svg: '1f34b', peso: 23, paga3: 10 },
    { id: 'naranja', emoji: '🍊', svg: '1f34a', peso: 19, paga3: 14 },
    { id: 'uva', emoji: '🍇', svg: '1f347', peso: 15, paga3: 22 },
    { id: 'campana', emoji: '🔔', svg: '1f514', peso: 9, paga3: 36 },
    { id: 'estrella', emoji: '⭐', svg: '2b50', peso: 5, paga3: 75 },
    { id: 'diamante', emoji: '💎', svg: '1f48e', peso: 2, paga3: 180, bote: true },
    { id: 'siete', emoji: '7️⃣', svg: '37-20e3', peso: 1, paga3: 600 },
];
const PESO_TOTAL = SIMBOLOS.reduce((s, x) => s + x.peso, 0);
function simboloAlAzar(azar) {
    let x = azar() * PESO_TOTAL;
    for (const s of SIMBOLOS) { x -= s.peso; if (x < 0) return s.id; }
    return SIMBOLOS[0].id;
}
const simbolo = (id) => SIMBOLOS.find((s) => s.id === id);
// Multiplicador de una tirada (sin el bote).
function pagoTragaperras(rodillos) {
    const [a, b, c] = rodillos;
    if (a === b && b === c) return { mult: simbolo(a).paga3, tipo: 'tres', bote: !!simbolo(a).bote };
    const cerezas = rodillos.filter((x) => x === 'cereza').length;
    if (cerezas === 2) return { mult: 2, tipo: 'cerezas', bote: false };
    if (a === b || b === c) return { mult: 1, tipo: 'pareja', bote: false }; // dos iguales seguidos: recupera lo apostado
    return { mult: 0, tipo: 'nada', bote: false };
}
function tirarTragaperras(azar = azarSeguro) {
    const rodillos = [simboloAlAzar(azar), simboloAlAzar(azar), simboloAlAzar(azar)];
    return { rodillos, ...pagoTragaperras(rodillos) };
}

// ---------------------------------------------------------------------------
// 🎡 Ruleta europea (0-36). Las apuestas «de fuera» pagan ×2 (o ×3 las docenas); un
// número, ×36. El 0 hace perder todas las de fuera: de ahí sale la ventaja de la casa.
// ---------------------------------------------------------------------------
const ROJOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ORDEN_RUEDA = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const colorNumero = (n) => (n === 0 ? 'verde' : ROJOS.has(n) ? 'rojo' : 'negro');
const APUESTAS_RULETA = ['rojo', 'negro', 'par', 'impar', 'bajo', 'alto', 'docena1', 'docena2', 'docena3', 'numero'];
function pagoRuleta(apuesta, numeroElegido, sale) {
    if (apuesta === 'numero') return sale === numeroElegido ? 36 : 0;
    if (sale === 0) return 0;
    const ok = {
        rojo: ROJOS.has(sale), negro: !ROJOS.has(sale),
        par: sale % 2 === 0, impar: sale % 2 === 1,
        bajo: sale <= 18, alto: sale >= 19,
        docena1: sale <= 12, docena2: sale >= 13 && sale <= 24, docena3: sale >= 25,
    }[apuesta];
    if (!ok) return 0;
    return apuesta.startsWith('docena') ? 3 : 2;
}
const girarRuleta = (azar = azarSeguro) => Math.floor(azar() * 37) % 37;

// ---------------------------------------------------------------------------
// 🃏 Blackjack: baraja de 6 mazos, la banca se planta en 17, blackjack paga 3:2,
// se puede doblar con las dos primeras cartas.
// ---------------------------------------------------------------------------
const PALOS = ['♠', '♥', '♦', '♣'];
const VALORES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
function baraja(azar = azarSeguro, mazos = 6) {
    const cartas = [];
    for (let m = 0; m < mazos; m++) for (const p of PALOS) for (const v of VALORES) cartas.push(`${v}${p}`);
    for (let i = cartas.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [cartas[i], cartas[j]] = [cartas[j], cartas[i]]; }
    return cartas;
}
const valorCarta = (c) => { const v = c.slice(0, -1); return v === 'A' ? 11 : ['J', 'Q', 'K'].includes(v) ? 10 : parseInt(v, 10); };
function puntos(mano) {
    let total = 0; let ases = 0;
    for (const c of mano) { total += valorCarta(c); if (c.startsWith('A')) ases++; }
    while (total > 21 && ases > 0) { total -= 10; ases--; }
    return { total, blanda: ases > 0 };
}
const esBlackjack = (mano) => mano.length === 2 && puntos(mano).total === 21;
// La banca roba hasta 17 o más.
function jugarBanca(mano, mazo) {
    const m = [...mano];
    while (puntos(m).total < 17) m.push(mazo.pop());
    return m;
}
// Resultado y multiplicador (lo que se cobra sobre lo apostado).
function resultadoBlackjack(jugador, banca) {
    const pj = puntos(jugador).total; const pb = puntos(banca).total;
    if (pj > 21) return { res: 'pasa', mult: 0 };
    if (esBlackjack(jugador) && !esBlackjack(banca)) return { res: 'blackjack', mult: 2.5 };
    if (esBlackjack(banca) && !esBlackjack(jugador)) return { res: 'pierde', mult: 0 };
    if (pb > 21) return { res: 'gana', mult: 2 };
    if (pj > pb) return { res: 'gana', mult: 2 };
    if (pj === pb) return { res: 'empate', mult: 1 };
    return { res: 'pierde', mult: 0 };
}

// ---------------------------------------------------------------------------
// 🚀 Crash: un multiplicador sube hasta que «explota». Si te retiras antes, cobras
// lo que marcaba. El punto de explosión se decide al empezar (97 % de devolución).
// ---------------------------------------------------------------------------
const CRASH_VENTAJA = 0.97;
function puntoCrash(azar = azarSeguro) {
    const u = azar();
    const p = CRASH_VENTAJA / (1 - u);
    return Math.max(1, Math.min(100, Math.floor(p * 100) / 100));
}
// Multiplicador a los `seg` segundos (×2 a los ~5,8 s, ×10 a los ~19 s).
const multCrash = (seg) => Math.floor(Math.exp(0.12 * Math.max(0, seg)) * 100) / 100;
const segundosHasta = (mult) => Math.log(Math.max(1, mult)) / 0.12;

// ---------------------------------------------------------------------------
// 💣 Minas: 20 casillas y N minas. Cada casilla segura sube el multiplicador; si
// tocas una mina lo pierdes todo. Te puedes retirar cuando quieras.
// ---------------------------------------------------------------------------
const CASILLAS = 20;
const MINAS_VENTAJA = 0.97;
function colocarMinas(minas, azar = azarSeguro) {
    const pos = [...Array(CASILLAS).keys()];
    for (let i = pos.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [pos[i], pos[j]] = [pos[j], pos[i]]; }
    return pos.slice(0, minas).sort((a, b) => a - b);
}
// Multiplicador justo tras `aciertos` casillas seguras, con la ventaja de la casa.
function multMinas(minas, aciertos) {
    let m = 1;
    for (let i = 0; i < aciertos; i++) m *= (CASILLAS - i) / (CASILLAS - minas - i);
    return aciertos ? Math.floor(m * MINAS_VENTAJA * 100) / 100 : 1;
}

// ---------------------------------------------------------------------------
// 🪙 Cara o cruz (contra la banca: ×1,94) y duelos entre miembros (el ganador se lleva
// el doble menos un 3 %).
// ---------------------------------------------------------------------------
const MONEDA_PAGO = 1.94;
const DUELO_COMISION = 0.03;
const lanzarMoneda = (azar = azarSeguro) => (azar() < 0.5 ? 'cara' : 'cruz');

// ---------------------------------------------------------------------------
// 🏇 Carrera: 5 corredores con cuotas fijas. La probabilidad de ganar de cada uno
// es su `fuerza` / total; la cuota paga un poco menos de lo justo.
// ---------------------------------------------------------------------------
const CORREDORES = [
    { id: 'caballo', emoji: '🐎', fuerza: 30 },
    { id: 'unicornio', emoji: '🦄', fuerza: 25 },
    { id: 'cebra', emoji: '🦓', fuerza: 20 },
    { id: 'camello', emoji: '🐪', fuerza: 15 },
    { id: 'tortuga', emoji: '🐢', fuerza: 10 },
];
const CARRERA_VENTAJA = 0.94;
const FUERZA_TOTAL = CORREDORES.reduce((s, c) => s + c.fuerza, 0);
const cuota = (id) => { const c = CORREDORES.find((x) => x.id === id); return c ? Math.floor((FUERZA_TOTAL / c.fuerza) * CARRERA_VENTAJA * 100) / 100 : 0; };
function ganadorCarrera(azar = azarSeguro) {
    let x = azar() * FUERZA_TOTAL;
    for (const c of CORREDORES) { x -= c.fuerza; if (x < 0) return c.id; }
    return CORREDORES[0].id;
}
// Posiciones paso a paso (para la animación): todos avanzan al azar y el ganador cruza
// primero en el último paso. Devuelve [{ id: avance(0-1) }] por paso.
function pasosCarrera(ganador, pasos = 8, azar = azarSeguro) {
    const pos = Object.fromEntries(CORREDORES.map((c) => [c.id, 0]));
    const out = [];
    for (let p = 1; p <= pasos; p++) {
        for (const c of CORREDORES) {
            const objetivo = p === pasos ? (c.id === ganador ? 1 : 0.72 + azar() * 0.24) : Math.min(0.95, pos[c.id] + (0.06 + azar() * 0.13));
            // En la llegada nadie retrocede (1.31.1: con la animación fluida se veía): los que pierden
            // se quedan donde estaban o un poco más allá, siempre por detrás del ganador.
            pos[c.id] = p === pasos && c.id === ganador ? objetivo : Math.min(p === pasos ? 0.97 : 1, Math.max(pos[c.id], objetivo));
        }
        out.push({ ...pos });
    }
    return out;
}

// ---------------------------------------------------------------------------
// Apuestas: mínimos, máximos y el tope de pérdidas del día.
// ---------------------------------------------------------------------------
function comprobarApuesta(cantidad, cfgCasino = {}, perfil = {}, ahora = new Date()) {
    const n = Math.floor(Number(cantidad) || 0);
    const min = Math.max(1, cfgCasino.apuestaMin ?? 10);
    const max = Math.max(min, cfgCasino.apuestaMax ?? 5000);
    if (perfil.pausaHasta && new Date(perfil.pausaHasta) > ahora) return { fallo: 'pausa' };
    if (n < min) return { fallo: 'min', min };
    if (n > max) return { fallo: 'max', max };
    const tope = cfgCasino.limiteDiario ?? 20000;
    const hoy = ahora.toISOString().slice(0, 10);
    const perdido = perfil.dia === hoy ? (perfil.perdidoHoy || 0) : 0;
    if (tope > 0 && perdido + n > tope) return { fallo: 'limite', queda: Math.max(0, tope - perdido) };
    return { ok: true, cantidad: n };
}

// ---------------------------------------------------------------------------
// 🃏 Mayor o menor (1.25.0): sale una carta (A=1 … K=13) y dices si la siguiente será
// mayor o menor. Si es igual, empate: no pasa nada y sigues. Cada acierto multiplica lo que
// llevas por lo que paga esa jugada (con un 3 % para la casa); puedes retirarte cuando quieras.
// ---------------------------------------------------------------------------
const HILO_VENTAJA = 0.97;
const HILO_MAX_MULT = 100;
const valorHilo = (c) => VALORES.indexOf(String(c).slice(0, -1)) + 1;
const cartaHilo = (azar = azarSeguro) => `${VALORES[Math.floor(azar() * 13)]}${PALOS[Math.floor(azar() * 4)]}`;
// Lo que paga acertar «mayor» o «menor» desde la carta `c` (0 si no se puede).
function pagoHilo(c, eleccion) {
    const v = valorHilo(c);
    const casos = eleccion === 'mayor' ? 13 - v : v - 1;
    if (casos <= 0) return 0;
    return Math.floor((HILO_VENTAJA * 12 / casos) * 100) / 100;
}
// 'gana' | 'pierde' | 'empate'
function resultadoHilo(actual, siguiente, eleccion) {
    const a = valorHilo(actual); const b = valorHilo(siguiente);
    if (a === b) return 'empate';
    return (eleccion === 'mayor' ? b > a : b < a) ? 'gana' : 'pierde';
}

// ---------------------------------------------------------------------------
// 🎟️ Rasca y gana (1.25.0): 9 casillas; si salen 3 símbolos iguales, ganas lo que paga ese
// símbolo. El premio se decide al comprar el boleto (RASCA_PREMIOS) y luego se rasca.
// ---------------------------------------------------------------------------
const RASCA_PREMIOS = [
    { simbolo: '7️⃣', mult: 500, p: 0.00005 }, { simbolo: '💎', mult: 100, p: 0.0006 }, { simbolo: '⭐', mult: 25, p: 0.004 },
    { simbolo: '🔔', mult: 10, p: 0.015 }, { simbolo: '🍇', mult: 4, p: 0.05 }, { simbolo: '🍋', mult: 2, p: 0.10 }, { simbolo: '🍒', mult: 1, p: 0.22 },
];
const RASCA_SIMBOLOS = RASCA_PREMIOS.map((x) => x.simbolo);
const rtpRasca = () => RASCA_PREMIOS.reduce((a, x) => a + x.mult * x.p, 0);
// Devuelve { casillas: [9 símbolos], premio: {simbolo, mult} | null }. Nunca hay dos tríos, y si
// no toca nada, ningún símbolo sale 3 veces.
function boletoRasca(azar = azarSeguro) {
    let x = azar(); let premio = null;
    for (const pz of RASCA_PREMIOS) { x -= pz.p; if (x < 0) { premio = pz; break; } }
    const casillas = [];
    const cuenta = {};
    if (premio) { for (let i = 0; i < 3; i++) casillas.push(premio.simbolo); cuenta[premio.simbolo] = 3; }
    while (casillas.length < 9) {
        const s = RASCA_SIMBOLOS[Math.floor(azar() * RASCA_SIMBOLOS.length)];
        if ((cuenta[s] || 0) >= 2 && s !== premio?.simbolo) continue;
        if (s === premio?.simbolo) continue;
        cuenta[s] = (cuenta[s] || 0) + 1;
        casillas.push(s);
    }
    for (let i = casillas.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [casillas[i], casillas[j]] = [casillas[j], casillas[i]]; }
    return { casillas, premio: premio ? { simbolo: premio.simbolo, mult: premio.mult } : null };
}


// ---------------------------------------------------------------------------
// 🔻 Plinko (1.32.0): la bola cae por 8 filas de clavos (izquierda o derecha en cada una) y
// acaba en una de 9 casillas. Los bordes pagan mucho y salen poco. Tres riesgos (~96 %).
// ---------------------------------------------------------------------------
const PLINKO_FILAS = 8;
const PLINKO = {
    bajo: [5.6, 2.1, 1.1, 1, 0.4, 1, 1.1, 2.1, 5.6],
    medio: [13, 3, 1.3, 0.65, 0.4, 0.65, 1.3, 3, 13],
    alto: [29, 4, 1.4, 0.3, 0.2, 0.3, 1.4, 4, 29],
};
const comb = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
const rtpPlinko = (riesgo) => PLINKO[riesgo].reduce((a, m, k) => a + (m * comb(PLINKO_FILAS, k)) / 2 ** PLINKO_FILAS, 0);
function tirarPlinko(riesgo = 'bajo', azar = azarSeguro) {
    if (!PLINKO[riesgo]) riesgo = 'bajo';
    const camino = []; let casilla = 0;
    for (let i = 0; i < PLINKO_FILAS; i++) { const d = azar() < 0.5 ? 0 : 1; camino.push(d); casilla += d; }
    return { riesgo, camino, casilla, mult: PLINKO[riesgo][casilla] };
}

// ---------------------------------------------------------------------------
// 🎡 Rueda de la fortuna (1.32.0): 50 casillas con números (1, 2, 5, 10, 20 y 40). Apuestas a uno:
// si sale, cobras lo que paga (cuanto menos sale, más paga; ~94 %).
// ---------------------------------------------------------------------------
const RUEDA = [
    { n: 1, veces: 23, paga: 2.05, color: '#facc15' },
    { n: 2, veces: 13, paga: 3.6, color: '#38bdf8' },
    { n: 5, veces: 7, paga: 6.8, color: '#a78bfa' },
    { n: 10, veces: 4, paga: 11.8, color: '#4ade80' },
    { n: 20, veces: 2, paga: 23.5, color: '#fb923c' },
    { n: 40, veces: 1, paga: 47, color: '#f43f5e' },
];
// Orden de las casillas en la rueda (repartidas para que no estén juntas las iguales).
const CASILLAS_RUEDA = (() => {
    const total = RUEDA.reduce((a, r) => a + r.veces, 0);
    const huecos = new Array(total).fill(null);
    for (const r of [...RUEDA].reverse()) {
        const paso = total / r.veces;
        for (let i = 0; i < r.veces; i++) {
            let k = Math.floor(i * paso + paso / 2) % total;
            while (huecos[k] !== null) k = (k + 1) % total;
            huecos[k] = r.n;
        }
    }
    return huecos;
})();
const rtpRueda = (n) => { const r = RUEDA.find((x) => x.n === n); return (r.veces * r.paga) / CASILLAS_RUEDA.length; };
function girarRueda(azar = azarSeguro) {
    const i = Math.floor(azar() * CASILLAS_RUEDA.length) % CASILLAS_RUEDA.length;
    return { indice: i, numero: CASILLAS_RUEDA[i] };
}
const pagoRueda = (apuesta, sale) => (apuesta === sale ? RUEDA.find((r) => r.n === sale).paga : 0);

// ---------------------------------------------------------------------------
// 🎟️ Lotería semanal (1.32.0): boletos de PRECIO_BOLETO; el domingo se sortean 3 premios entre
// los boletos (70 %, 20 % y 10 % del bote; cada persona gana uno como mucho). El bote es el
// BOTE_LOTERIA de lo vendido (el resto sale de la economía) y empieza en BOTE_BASE.
// ---------------------------------------------------------------------------
const PRECIO_BOLETO = 100;
const MAX_BOLETOS = 20;
const BOTE_LOTERIA = 0.85;
const BOTE_BASE = 300;
const REPARTO_LOTERIA = [0.7, 0.2, 0.1];
// La casa pone un extra (hasta BOTE_BASE) pero nunca más de un 10 % de lo vendido: jugar nunca sale a cuenta.
const boteLoteria = (vendidos) => { const v = vendidos * PRECIO_BOLETO; return Math.floor(v * BOTE_LOTERIA) + Math.min(BOTE_BASE, Math.floor(v * 0.1)); };
// `boletos` = { userId: n }. Devuelve [{ userId, puesto, premio }] (hasta 3, personas distintas).
function sortearLoteria(boletos = {}, azar = azarSeguro) {
    const quedan = new Map(Object.entries(boletos).filter(([, n]) => n > 0));
    const total = [...quedan.values()].reduce((a, n) => a + n, 0);
    const bote = boteLoteria(total);
    const out = [];
    for (let p = 0; p < REPARTO_LOTERIA.length && quedan.size; p++) {
        const suma = [...quedan.values()].reduce((a, n) => a + n, 0);
        let x = azar() * suma; let elegido = null;
        for (const [u, n] of quedan) { x -= n; if (x < 0) { elegido = u; break; } }
        elegido = elegido || [...quedan.keys()].pop();
        out.push({ userId: elegido, puesto: p + 1, premio: Math.floor(bote * REPARTO_LOTERIA[p]) });
        quedan.delete(elegido);
    }
    return { bote, ganadores: out };
}
// Domingo 20:00 UTC de la semana (lunes `semana`).
const sorteoDe = (semana) => new Date(Date.parse(`${semana}T20:00:00Z`) + 6 * 86400000);

// ---------------------------------------------------------------------------
// 🫶 Juego responsable (1.32.0): tras RACHA_AVISO partidas seguidas sin ganar, un aviso (una vez
// por racha) antes de la siguiente jugada.
// ---------------------------------------------------------------------------
const RACHA_AVISO = 10;
const tocaAviso = (perfil = {}) => (perfil.rachaPerdidas || 0) >= RACHA_AVISO && (perfil.avisoRacha || 0) < Math.floor((perfil.rachaPerdidas || 0) / RACHA_AVISO) * RACHA_AVISO;

module.exports = {
    PLINKO_FILAS, PLINKO, rtpPlinko, tirarPlinko, RUEDA, CASILLAS_RUEDA, rtpRueda, girarRueda, pagoRueda,
    PRECIO_BOLETO, MAX_BOLETOS, BOTE_LOTERIA, BOTE_BASE, REPARTO_LOTERIA, boteLoteria, sortearLoteria, sorteoDe, RACHA_AVISO, tocaAviso,
    HILO_VENTAJA, HILO_MAX_MULT, valorHilo, cartaHilo, pagoHilo, resultadoHilo,
    RASCA_PREMIOS, RASCA_SIMBOLOS, rtpRasca, boletoRasca,
    azarSeguro,
    SIMBOLOS, simbolo, simboloAlAzar, pagoTragaperras, tirarTragaperras,
    ROJOS, ORDEN_RUEDA, colorNumero, APUESTAS_RULETA, pagoRuleta, girarRuleta,
    PALOS, baraja, valorCarta, puntos, esBlackjack, jugarBanca, resultadoBlackjack,
    CRASH_VENTAJA, puntoCrash, multCrash, segundosHasta,
    CASILLAS, colocarMinas, multMinas,
    MONEDA_PAGO, DUELO_COMISION, lanzarMoneda,
    CORREDORES, cuota, ganadorCarrera, pasosCarrera,
    comprobarApuesta,
};
