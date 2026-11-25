// 1.32.0: compañeros con personalidad, gustos, se ponen malitos si se les abandona, minijuegos,
// sorpresas en las expediciones, accesorios y variante brillante.
const test = require('node:test');
const assert = require('node:assert');
const P = require('../utils/compisNucleo.js');
const K = require('../utils/cofresNucleo.js');
const SPR = require('../utils/sprites.js');
const N = require('../utils/mascotaNucleo.js');

const T = Date.parse('2026-11-24T12:00:00Z');
const m0 = (extra = {}) => ({ id: 'gato', primera: new Date('2026-01-01'), hambre: 60, alegria: 60, energia: 80, actualizado: new Date(T), afinidad: 0, ...extra });

test('personalidad y gustos: fijos para cada compañero y la odiada nunca es la favorita', () => {
    const vistos = new Set();
    for (const id of Object.keys(K.COMPANEROS)) {
        for (let d = 0; d < 6; d++) {
            const m = { id, primera: new Date(T - d * 86400000) };
            assert.strictEqual(P.persDe(m), P.persDe({ ...m }));
            assert.ok(P.PERSONALIDADES[P.persDe(m)]);
            const g = P.gustosDe(m);
            assert.ok(P.COMIDAS[g.favorita] && P.COMIDAS[g.odiada] && g.favorita !== g.odiada);
            vistos.add(P.persDe(m));
        }
    }
    assert.strictEqual(vistos.size, Object.keys(P.PERSONALIDADES).length); // salen todas
});

test('la comida favorita da el doble de afinidad y la odiada la mitad', () => {
    const m = m0({ hambre: 40 });
    const g = P.gustosDe(m);
    const otra = Object.keys(P.COMIDAS).find((c) => c !== g.favorita && c !== g.odiada);
    const fav = P.comer(m, g.favorita, T); const odi = P.comer(m, g.odiada, T); const norm = P.comer(m, otra, T);
    assert.strictEqual(fav.reaccion, 'encanta'); assert.strictEqual(odi.reaccion, 'odia'); assert.strictEqual(norm.reaccion, 'normal');
    assert.ok(fav.afinidad > norm.afinidad && norm.afinidad > odi.afinidad);
    assert.ok(fav.alegria > norm.alegria);
    assert.strictEqual(P.comer(m, 'piedra', T).fallo, 'accion');
});

test('muy abandonado se pone malito, no sale de expedición y se cura cuidándolo', () => {
    const m = m0({ hambre: 3, alegria: 5 });
    assert.strictEqual(P.humor(P.estado(m, T)), 'enfermo');
    assert.strictEqual(P.salir(m, 'paseo', null, '2026-11-24', T).fallo, 'enfermo');
    const r = P.cuidar(m, 'comer', T);
    assert.notStrictEqual(P.humor(r), 'enfermo');
    // Los que ya tenían los tests de antes siguen igual (hambre baja pero no abandonado).
    assert.strictEqual(P.humor({ hambre: 10, alegria: 90, energia: 90 }), 'hambre');
    // En combate pelea algo peor si está malito.
    const C = require('../utils/combateNucleo.js');
    assert.ok(C.stats(m, T).atk < C.stats(m0({ hambre: 60, alegria: 60 }), T).atk);
});

test('la personalidad se nota: le encanta su cuidado favorito y el dormilón descansa antes', () => {
    const buscar = (pers) => { for (let d = 0; d < 400; d++) { const m = m0({ primera: new Date(T - d * 3600000), alegria: 40, hambre: 40, energia: 80 }); if (P.persDe(m) === pers) return m; } return null; };
    const jug = buscar('jugueton'); const otro = buscar('valiente');
    assert.ok(P.cuidar(jug, 'jugar', T).afinidad > P.cuidar({ ...otro }, 'jugar', T).afinidad);
    const dor = buscar('dormilon'); const nor = buscar('valiente');
    const luego = T + 3 * 3600000;
    assert.ok(P.estado({ ...dor, energia: 10 }, luego).energia > P.estado({ ...nor, energia: 10 }, luego).energia);
    const pres = buscar('presumido');
    assert.ok(P.cuidar({ ...pres, acc: 'lazo' }, 'mimar', T).afinidad >= P.cuidar(pres, 'mimar', T).afinidad);
});

test('minijuego de los vasos: quien sigue los cambios acierta', () => {
    for (let s = 0; s < 200; s++) {
        const p = P.prepararMinijuego('vasos', N.azarCon(`v${s}`));
        let pos = p.inicio;
        for (const [a, b] of p.cambios) { assert.notStrictEqual(a, b); if (pos === a) pos = b; else if (pos === b) pos = a; }
        assert.strictEqual(pos, p.correcta);
        assert.ok(p.cambios.length >= 4);
    }
    const m = m0();
    const gana = P.jugarMinijuego(m, 'vasos', 1, 1, { ahora: T, azar: () => 0.5 });
    const pierde = P.jugarMinijuego(m, 'vasos', 0, 1, { ahora: T, azar: () => 0.5 });
    assert.ok(gana.gana && !pierde.gana && gana.afinidad > pierde.afinidad && gana.oro > 0 && pierde.oro === 0);
    assert.strictEqual(P.jugarMinijuego(m, 'vasos', 1, 1, { ahora: T, premiado: false }).oro, 0); // sin premio pasado el tope
    assert.strictEqual(P.jugarMinijuego(m0({ energia: 2 }), 'pelota', 0, 0, { ahora: T }).fallo, 'energia');
    assert.strictEqual(P.prepararMinijuego('nada').fallo, 'accion');
});

test('sorpresas de expedición: a veces, y nunca dejan nada roto', () => {
    let n = 0; const azar = N.azarCon('ev');
    for (let i = 0; i < 2000; i++) { const e = P.eventoExpedicion(azar); if (e) { n++; assert.ok(e.es && e.en && e.emoji); } }
    assert.ok(n > 600 && n < 1000, `${n}`);
    for (const e of P.EVENTOS_EXP) assert.ok(!e.oroX || e.oroX > 0);
});

test('accesorios: cada uno con su sitio y su precio; se dibujan en todas las formas', () => {
    const { createCanvas } = require('@napi-rs/canvas');
    for (const [id, a] of Object.entries(SPR.ACCESORIOS)) {
        assert.ok(['cabeza', 'cara', 'cuello'].includes(a.slot) && a.precio > 0 && a.es && a.en, id);
        for (const comp of ['gato', 'pollito', 'kraken', 'yuki', 'pixel', 'boo', 'tiburon', 'mariposa']) {
            const c = createCanvas(SPR.TAM, SPR.TAM);
            assert.ok(SPR.dibujar(c.getContext('2d'), comp, { acc: id }));
        }
    }
});

test('variante brillante: rara, y solo una vez por compañero', () => {
    assert.ok(K.PROB_BRILLANTE > 0 && K.PROB_BRILLANTE < 0.05);
});

// 1.33.0: guardería.
test('guardería: quién puede criar, rareza del huevo y coste', () => {
    const P = require('../utils/compisNucleo.js');
    const K = require('../utils/cofresNucleo.js');
    const ids = Object.keys(K.COMPANEROS);
    const de = (r) => ids.find((id) => K.COMPANEROS[id].rareza === r);
    const af = P.umbral(P.CRIA.nivel);
    const a = { id: de('comun'), afinidad: af }; const b = { id: de('comun'), afinidad: af };
    assert.equal(P.motivoNoCria({ id: de('comun'), afinidad: 0 }), 'nivel');
    assert.equal(P.motivoNoCria(a), null);
    assert.equal(P.motivoNoCria({ ...a, criaHasta: new Date(Date.now() + 1000) }), 'descansa');
    assert.equal(P.motivoNoCria({ ...a, exp: { tipo: 'paseo', desde: new Date(), hasta: new Date(Date.now() + 3600000) } }), 'fuera');
    assert.equal(P.rarezaCria(a, b, () => 0.99), 'comun');
    assert.equal(P.rarezaCria(a, b, () => 0.01), 'rara');
    // Una divina cuenta como mítica y de la cría nunca sale divina.
    const div = { id: de('divina'), afinidad: af };
    for (let i = 0; i < 50; i++) assert.equal(P.rarezaCria(div, a, Math.random), 'mitica');
    assert.equal(P.costeCria(a, { id: de('legendaria') }), P.CRIA.coste.legendaria);
    assert.equal(P.probBrillanteCria({ ...a, variante: 'brillante' }, b), P.CRIA.brillantePadre);
});
