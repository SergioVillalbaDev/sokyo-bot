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
