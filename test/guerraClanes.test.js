// 1.33.0: guerra de clanes (parte pura de utils/guerraClanes.js).
const test = require('node:test');
const assert = require('node:assert');
const W = require('../utils/guerraClanes.js');

test('guerra: parejas por puntos parecidos y el impar descansa', () => {
    const cl = [{ _id: 'a', puntosTotal: 10 }, { _id: 'b', puntosTotal: 900 }, { _id: 'c', puntosTotal: 500 }, { _id: 'd', puntosTotal: 20 }, { _id: 'e', puntosTotal: 600 }];
    const r = W.emparejar(cl);
    assert.deepEqual(r.parejas.map((p) => p.map((x) => x._id)), [['b', 'e'], ['c', 'd']]);
    assert.equal(r.libre._id, 'a');
    assert.equal(W.emparejar([]).parejas.length, 0);
});

test('guerra: quién gana', () => {
    assert.equal(W.ganadorGuerra({ puntosSemana: 5 }, { puntosSemana: 3 }), 'a');
    assert.equal(W.ganadorGuerra({ puntosSemana: 1 }, { puntosSemana: 3 }), 'b');
    assert.equal(W.ganadorGuerra({ puntosSemana: 0 }, {}), 'empate');
});
