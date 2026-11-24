// 1.32.0: eventos de temporada y regalos por racha del diario.
const test = require('node:test');
const assert = require('node:assert');
const E = require('../utils/eventos.js');
const SPR = require('../utils/sprites.js');

const d = (s) => Date.parse(`${s}T12:00:00Z`);
test('eventos: cada uno en sus fechas (también el que cruza de año) y nunca dos a la vez', () => {
    assert.strictEqual(E.eventoActivo(d('2026-10-31')).id, 'halloween');
    assert.strictEqual(E.eventoActivo(d('2026-11-24')).id, 'otono');
    assert.strictEqual(E.eventoActivo(d('2026-12-25')).id, 'navidad');
    assert.strictEqual(E.eventoActivo(d('2027-01-03')).id, 'navidad');
    assert.strictEqual(E.eventoActivo(d('2027-02-14')).id, 'sanvalentin');
    assert.strictEqual(E.eventoActivo(d('2027-05-10')), null);
    for (let i = 0; i < 366; i++) {
        const f = new Date(Date.UTC(2027, 0, 1) + i * 86400000);
        assert.ok(E.EVENTOS.filter((ev) => E.dentro(ev, f)).length <= 1, f.toISOString());
    }
    assert.strictEqual(E.finDe(E.eventoActivo(d('2026-12-20')), d('2026-12-20')).toISOString(), '2027-01-06T23:59:59.000Z');
    assert.strictEqual(E.finDe(E.eventoActivo(d('2027-01-02')), d('2027-01-02')).toISOString(), '2027-01-06T23:59:59.000Z');
    const p = E.proximo(d('2027-05-10'));
    assert.strictEqual(p.ev.id, 'verano');
});

test('cada evento tiene su accesorio exclusivo, que se dibuja', () => {
    const { createCanvas } = require('@napi-rs/canvas');
    for (const ev of E.EVENTOS) {
        const a = SPR.ACCESORIOS[ev.accesorio];
        assert.ok(a && a.evento === ev.id, ev.id);
        const c = createCanvas(SPR.TAM, SPR.TAM);
        assert.ok(SPR.dibujar(c.getContext('2d'), 'gato', { acc: ev.accesorio }));
        assert.ok(ev.bonusDiario > 0 && ev.bonusDiario <= 0.3);
    }
});
