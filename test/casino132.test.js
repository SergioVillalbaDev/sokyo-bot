// 1.32.0: plinko, rueda de la fortuna, lotería semanal y el aviso de juego responsable.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../utils/casinoNucleo.js');
const N = require('../utils/mascotaNucleo.js');

test('plinko: la casa siempre se queda algo y el camino cuadra con la casilla', () => {
    for (const r of Object.keys(C.PLINKO)) {
        const rtp = C.rtpPlinko(r);
        assert.ok(rtp > 0.94 && rtp < 0.975, `${r} ${rtp}`);
        assert.strictEqual(C.PLINKO[r].length, C.PLINKO_FILAS + 1);
        assert.deepStrictEqual(C.PLINKO[r], [...C.PLINKO[r]].reverse()); // simétrico
    }
    const azar = N.azarCon('p');
    let total = 0; const n = 40000;
    for (let i = 0; i < n; i++) {
        const t = C.tirarPlinko('medio', azar);
        assert.strictEqual(t.casilla, t.camino.reduce((a, b) => a + b, 0));
        total += t.mult;
    }
    assert.ok(Math.abs(total / n - C.rtpPlinko('medio')) < 0.03);
    assert.strictEqual(C.tirarPlinko('nada', azar).riesgo, 'bajo');
});

test('rueda: 50 casillas, cada número las veces que dice y ~94 % para todos', () => {
    assert.strictEqual(C.CASILLAS_RUEDA.length, 50);
    for (const r of C.RUEDA) {
        assert.strictEqual(C.CASILLAS_RUEDA.filter((x) => x === r.n).length, r.veces, String(r.n));
        const rtp = C.rtpRueda(r.n);
        assert.ok(rtp > 0.92 && rtp < 0.97, `${r.n} ${rtp}`);
    }
    // Las iguales no van todas juntas
    let seguidas = 0; for (let i = 0; i < 50; i++) if (C.CASILLAS_RUEDA[i] === C.CASILLAS_RUEDA[(i + 1) % 50] && C.CASILLAS_RUEDA[i] !== 1) seguidas++;
    assert.ok(seguidas <= 2);
    assert.strictEqual(C.pagoRueda(5, 5), C.RUEDA.find((r) => r.n === 5).paga);
    assert.strictEqual(C.pagoRueda(5, 2), 0);
    const g = C.girarRueda(N.azarCon('r'));
    assert.strictEqual(C.CASILLAS_RUEDA[g.indice], g.numero);
});

test('lotería: nunca sale a cuenta jugar, 3 premios a personas distintas y el sorteo es el domingo', () => {
    for (const vendidos of [1, 3, 15, 20, 60, 600]) assert.ok(C.boteLoteria(vendidos) <= vendidos * C.PRECIO_BOLETO * 0.95 + 1, String(vendidos));
    const r = C.sortearLoteria({ a: 10, b: 1, c: 3, d: 0 }, N.azarCon('l'));
    assert.strictEqual(r.ganadores.length, 3);
    assert.strictEqual(new Set(r.ganadores.map((g) => g.userId)).size, 3);
    assert.ok(!r.ganadores.some((g) => g.userId === 'd'));
    assert.ok(r.ganadores[0].premio > r.ganadores[1].premio && r.ganadores[1].premio > r.ganadores[2].premio);
    assert.ok(r.ganadores.reduce((a, g) => a + g.premio, 0) <= r.bote);
    assert.strictEqual(C.sortearLoteria({}).ganadores.length, 0);
    assert.strictEqual(C.sortearLoteria({ solo: 5 }).ganadores.length, 1);
    // Más boletos, más probabilidad
    let a = 0; const az = N.azarCon('l2');
    for (let i = 0; i < 3000; i++) if (C.sortearLoteria({ a: 9, b: 1 }, az).ganadores[0].userId === 'a') a++;
    assert.ok(a / 3000 > 0.85 && a / 3000 < 0.95);
    assert.strictEqual(C.sorteoDe('2026-11-23').toISOString(), '2026-11-29T20:00:00.000Z');
});

test('juego responsable: avisa a las 10 seguidas sin ganar, una vez por racha', () => {
    assert.strictEqual(C.tocaAviso({ rachaPerdidas: 9 }), false);
    assert.strictEqual(C.tocaAviso({ rachaPerdidas: 10 }), true);
    assert.strictEqual(C.tocaAviso({ rachaPerdidas: 12, avisoRacha: 10 }), false);
    assert.strictEqual(C.tocaAviso({ rachaPerdidas: 20, avisoRacha: 10 }), true);
    assert.strictEqual(C.tocaAviso({}), false);
});

// 1.33.0: blackjack con dividir y seguro.
test('blackjack: dividir solo con dos cartas del mismo valor', () => {
    const C = require('../utils/casinoNucleo.js');
    assert.equal(C.puedeDividir(['8♠', '8♥']), true);
    assert.equal(C.puedeDividir(['K♠', 'Q♥']), true); // las dos valen 10
    assert.equal(C.puedeDividir(['8♠', '9♥']), false);
    assert.equal(C.puedeDividir(['8♠', '8♥', '2♣']), false);
});

test('blackjack: seguro con As de la banca y paga 2 a 1 solo con blackjack', () => {
    const C = require('../utils/casinoNucleo.js');
    assert.equal(C.ofreceSeguro(['A♠', '5♥'], ['9♣', '7♦']), true);
    assert.equal(C.ofreceSeguro(['K♠', 'A♥'], ['9♣', '7♦']), false);
    assert.equal(C.ofreceSeguro(['A♠', '5♥'], ['A♣', 'K♦']), false);
    assert.equal(C.pagoSeguro(['A♠', 'K♥']), 3); // se devuelve lo pagado + 2 a 1
    assert.equal(C.pagoSeguro(['A♠', '5♥']), 0);
});

test('blackjack: 21 con dos cartas tras dividir no es blackjack (paga 1 a 1)', () => {
    const C = require('../utils/casinoNucleo.js');
    assert.equal(C.resultadoBlackjack(['A♠', 'K♥'], ['10♣', '8♦']).mult, 2.5);
    assert.equal(C.resultadoBlackjack(['A♠', 'K♥'], ['10♣', '8♦'], true).mult, 2);
});

// 1.33.0: dados, baccarat y bingo.
test('dados: la casa siempre se queda algo y el trío hace perder lo de fuera', () => {
    const C = require('../utils/casinoNucleo.js');
    for (const a of ['grande', 'pequeno', 'par', 'impar', 'trio']) { const r = C.rtpDados(a); assert.ok(r > 0.93 && r < 0.98, `${a} ${r}`); }
    for (let n = 1; n <= 6; n++) assert.ok(Math.abs(C.rtpDados('numero', n) - 0.963) < 0.001);
    assert.equal(C.pagoDados('grande', null, [4, 4, 4]), 0);
    assert.equal(C.pagoDados('trio', null, [4, 4, 4]), C.TRIO_PAGO);
    assert.equal(C.pagoDados('numero', 2, [2, 2, 5]), 3);
    assert.equal(C.pagoDados('pequeno', null, [1, 2, 3]), 2);
});

test('baccarat: reglas de la tercera carta y lo que devuelve a la larga', () => {
    const C = require('../utils/casinoNucleo.js');
    assert.equal(C.puntosBaccarat(['7♠', '8♥']), 5);
    assert.equal(C.puntosBaccarat(['K♠', 'A♥']), 1);
    assert.equal(C.bancaRoba(3, '8♠'), false);
    assert.equal(C.bancaRoba(6, '7♠'), true);
    assert.equal(C.bancaRoba(6, null), false);
    // Natural: nadie roba.
    const r = C.repartirBaccarat(['2♠', '5♣', '9♠', 'K♦', '8♥']); // salen del final: jugador 8♥ K♦ (8), banca 9♠ 5♣ (4)
    assert.deepEqual([r.jugador.length, r.banca.length, r.ganador], [2, 2, 'jugador']);
    let semilla = 7; const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
    const T = 60000; const n = { jugador: 0, banca: 0, empate: 0 }; let mazo = C.baraja(azar, 8);
    for (let i = 0; i < T; i++) { if (mazo.length < 10) mazo = C.baraja(azar, 8); n[C.repartirBaccarat(mazo).ganador]++; }
    for (const a of ['jugador', 'banca', 'empate']) {
        const rtp = (n.jugador * C.pagoBaccarat(a, 'jugador') + n.banca * C.pagoBaccarat(a, 'banca') + n.empate * C.pagoBaccarat(a, 'empate')) / T;
        assert.ok(rtp > 0.8 && rtp < 1, `${a} ${rtp}`);
    }
});

test('bingo: cartones de 15 distintos, línea antes que bingo y el reparto nunca supera el bote', () => {
    const C = require('../utils/casinoNucleo.js');
    let semilla = 3; const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 200; k++) {
        const cartones = [...Array(1 + (k % 6))].map((_, i) => ({ id: String(i), filas: C.cartonBingo(azar) }));
        for (const c of cartones) { const t = c.filas.flat(); assert.equal(new Set(t).size, 15); assert.ok(t.every((x) => x >= 1 && x <= C.BOLAS_BINGO)); }
        const res = C.jugarBingo(cartones, C.bolasBingo(azar));
        assert.ok(res.bingo && res.linea && res.linea.bola <= res.bingo.bola);
        const vendido = cartones.length * 100;
        const total = Object.values(C.repartoBingo(vendido, res)).reduce((a, b) => a + b, 0);
        assert.ok(total <= C.boteBingo(vendido) && total < vendido, `${total} ${vendido}`);
    }
});
