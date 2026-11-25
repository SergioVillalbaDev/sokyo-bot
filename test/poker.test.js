// 1.33.0: póker Texas Hold'em (utils/pokerNucleo.js).
const test = require('node:test');
const assert = require('node:assert');
const P = require('../utils/pokerNucleo.js');

test('póker: categorías de mano y desempates', () => {
    const cat = (c) => P.mejorMano(c).categoria;
    assert.equal(cat(['A♠', 'K♠', 'Q♠', 'J♠', '10♠', '2♥', '3♦']), 8);
    assert.equal(cat(['5♠', '4♦', '3♠', '2♣', 'A♥', 'K♦', 'K♣']), 4); // escalera baja con el As
    assert.equal(cat(['9♠', '9♦', '9♥', '9♣', 'A♥', 'K♦', '2♣']), 7);
    assert.equal(cat(['9♠', '9♦', '9♥', 'K♣', 'K♥', '2♦', '3♣']), 6);
    assert.equal(cat(['2♥', '7♥', '9♥', 'J♥', 'K♥', 'A♣', 'A♦']), 5);
    assert.equal(cat(['2♥', '2♦', '9♣', '9♥', 'K♥', 'K♣', '3♦']), 2);
    // Pareja de ases con mejor acompañante gana.
    const a = P.mejorMano(['A♠', 'A♦', 'K♣', '7♥', '5♦', '3♣', '2♠']).valor;
    const b = P.mejorMano(['A♥', 'A♣', 'Q♣', '7♥', '5♦', '3♣', '2♠']).valor;
    assert.ok(P.comparar(a, b) > 0);
    // Escalera de 6 alta gana a la del As bajo.
    assert.ok(P.comparar(P.evaluar5(['6♠', '5♦', '4♠', '3♣', '2♥']), P.evaluar5(['5♠', '4♦', '3♠', '2♣', 'A♥'])) > 0);
});

test('póker: botes laterales con all-in y retirados', () => {
    const b = P.calcularBotes({ a: 50, b: 200, c: 200, d: 20 }, new Set(['a', 'b', 'c']));
    assert.deepEqual(b, [{ monto: 170, elegibles: ['a', 'b', 'c'] }, { monto: 300, elegibles: ['b', 'c'] }]);
    // Lo que nadie iguala vuelve a su dueño.
    const c = P.calcularBotes({ a: 100, b: 300 }, new Set(['a', 'b']));
    assert.deepEqual(c, [{ monto: 200, elegibles: ['a', 'b'] }, { monto: 200, elegibles: ['b'] }]);
});

// Un mazo que se reparte en el orden dado (pop saca del final).
const mazo = (...cartas) => [...cartas].reverse();
test('póker: una mano completa a dos con subida, igualada y showdown', () => {
    // Reparto: 1.ª ronda A, B; 2.ª ronda A, B; quema, flop (3), quema, turn, quema, river.
    const m = P.nuevaMano({ jugadores: [{ id: 'a', fichas: 1000 }, { id: 'b', fichas: 1000 }], boton: 0, ciega: 20,
        mazo: mazo('A♠', '7♦', 'A♥', '2♣', 'x', 'K♣', '9♦', '4♠', 'x', '3♥', 'x', 'J♦') });
    // A dos, el botón (a) pone la ciega pequeña y habla primero antes del flop.
    assert.equal(P.opciones(m).id, 'a');
    assert.equal(P.opciones(m).igualar, 10);
    P.actuar(m, 'a', 'subir', 60);
    assert.equal(P.opciones(m).id, 'b');
    P.actuar(m, 'b', 'igualar');
    assert.equal(m.calle, 'flop');
    assert.equal(P.opciones(m).id, 'b'); // después del flop habla primero el que no es botón
    P.actuar(m, 'b', 'pasar'); P.actuar(m, 'a', 'pasar');
    P.actuar(m, 'b', 'pasar'); P.actuar(m, 'a', 'pasar');
    P.actuar(m, 'b', 'pasar'); P.actuar(m, 'a', 'pasar');
    assert.equal(m.calle, 'fin');
    const rake = Math.floor(120 * P.RAKE);
    assert.equal(m.resultado.ganancias.a, 120 - rake);
    assert.equal(m.jugadores[0].fichas + m.jugadores[1].fichas, 2000 - rake);
});

test('póker: retirarse sin flop no paga comisión y el turno salta a quien está all-in', () => {
    const m = P.nuevaMano({ jugadores: [{ id: 'a', fichas: 500 }, { id: 'b', fichas: 30 }, { id: 'c', fichas: 500 }], boton: 0, ciega: 20 });
    // b es ciega pequeña (10), c grande (20); habla a.
    assert.equal(P.opciones(m).id, 'a');
    P.actuar(m, 'a', 'allin');
    P.actuar(m, 'b', 'igualar'); // b se queda all-in con 30
    P.actuar(m, 'c', 'retirarse');
    assert.equal(m.calle, 'fin');
    assert.equal(m.comunes.length, 5);
    const total = m.jugadores.reduce((x, j) => x + j.fichas, 0);
    assert.equal(total + m.rake, 1030);
});

test('póker: miles de manos al azar nunca crean ni pierden fichas (salvo la comisión)', () => {
    let semilla = 11; const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
    const { baraja } = require('../utils/casinoNucleo.js');
    for (let k = 0; k < 3000; k++) {
        const n = 2 + (k % 5);
        const jug = [...Array(n)].map((_, i) => ({ id: `p${i}`, fichas: 50 + Math.floor(azar() * 500) }));
        const total = jug.reduce((a, j) => a + j.fichas, 0);
        const m = P.nuevaMano({ jugadores: jug, boton: k % n, ciega: 20, mazo: baraja(azar, 1) });
        let pasos = 0;
        while (m.calle !== 'fin' && pasos++ < 200) {
            const op = P.opciones(m);
            const r = azar();
            const acc = r < 0.15 ? 'retirarse' : r < 0.55 ? 'igualar' : r < 0.7 ? 'pasar' : r < 0.9 ? 'subir' : 'allin';
            assert.ok(P.actuar(m, op.id, acc, op.minHasta + Math.floor(azar() * 100)).ok);
        }
        assert.equal(m.calle, 'fin');
        const ahora = m.jugadores.reduce((a, j) => a + j.fichas, 0);
        assert.equal(ahora + m.rake, total, `mano ${k}`);
        assert.ok(m.jugadores.every((j) => j.fichas >= 0));
    }
});
