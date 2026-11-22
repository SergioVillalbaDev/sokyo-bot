const test = require('node:test');
const assert = require('node:assert');
const G = require('../utils/granjaNucleo.js');
const K = require('../utils/cofresNucleo.js');

const H = 3600000;
const AHORA = Date.UTC(2026, 10, 22, 12);
const sana = (id, extra = {}) => ({ id, estrellas: 1, afinidad: 0, hambre: 100, alegria: 100, energia: 100, actualizado: new Date(AHORA), ...extra });

test('granja: más rareza, estrellas, nivel y cuidado producen más', () => {
    const comun = Object.keys(K.COMPANEROS).find((id) => K.COMPANEROS[id].rareza === 'comun');
    const mitica = Object.keys(K.COMPANEROS).find((id) => K.COMPANEROS[id].rareza === 'mitica');
    const base = G.produccion(sana(comun), AHORA);
    assert.ok(base > 0);
    assert.ok(G.produccion(sana(mitica), AHORA) > base);
    assert.ok(G.produccion(sana(comun, { estrellas: 3 }), AHORA) > base);
    assert.ok(G.produccion(sana(comun, { afinidad: 5000 }), AHORA) > base);
    assert.ok(G.produccion(sana(comun, { hambre: 0 }), AHORA) < base);
    // de expedición no produce
    assert.strictEqual(G.produccion(sana(comun, { exp: { tipo: 'paseo', desde: new Date(AHORA), hasta: new Date(AHORA + H) } }), AHORA), 0);
});

test('granja: la primera vez no regala nada y tiene tope de horas', () => {
    const ids = Object.keys(K.COMPANEROS).slice(0, 2);
    const col = { mascotas: ids.map((id) => sana(id)) };
    const a0 = G.acumulado(col, AHORA);
    assert.strictEqual(a0.nueva, true); assert.strictEqual(a0.oro, 0);
    const a1 = G.acumulado({ ...col, granja: { desde: new Date(AHORA - 2 * H) } }, AHORA);
    assert.strictEqual(a1.oro, Math.floor(a1.porHora * 2));
    const a2 = G.acumulado({ ...col, granja: { desde: new Date(AHORA - 100 * H) } }, AHORA);
    assert.strictEqual(a2.lleno, true);
    assert.strictEqual(a2.oro, Math.floor(a2.porHora * G.TOPE_H));
});

test('granja: solo trabajan las mejores hasta llenar los huecos', () => {
    const ids = Object.keys(K.COMPANEROS).slice(0, 4); // 4 distintas → 3 huecos (el de 5 aún no)
    const col = { mascotas: ids.map((id) => sana(id)) };
    assert.strictEqual(G.huecos(col), G.HUECOS_BASE);
    assert.strictEqual(G.trabajando(col, AHORA).length, 3);
    const cinco = { mascotas: Object.keys(K.COMPANEROS).slice(0, 5).map((id) => sana(id)) };
    assert.strictEqual(G.huecos(cinco), G.HUECOS_BASE + 1);
});

test('álbum: hitos por mascotas distintas, una vez cada uno; las del servidor no cuentan', () => {
    const ids = Object.keys(K.COMPANEROS).slice(0, 5);
    const col = { mascotas: [...ids.map((id) => sana(id)), sana('s:1:x'), sana(ids[0])] };
    assert.strictEqual(G.distintas(col), 5);
    assert.deepStrictEqual(G.hitosNuevos(col).map((h) => h.n), [3, 5]);
    assert.deepStrictEqual(G.hitosNuevos({ ...col, hitosAlbum: ['3', '5'] }), []);
    assert.strictEqual(G.siguienteHito(col).n, 10);
    const todas = { mascotas: Object.keys(K.COMPANEROS).map((id) => sana(id)) };
    assert.strictEqual(G.siguienteHito(todas), null);
    assert.ok(G.hitosNuevos(todas).some((h) => h.n === 'todas'));
    const pr = G.porRareza(col);
    assert.strictEqual(Object.values(pr).reduce((a, r) => a + r.total, 0), G.TOTAL());
});

test('misiones semanales: avanzan, pagan una vez y se reinician cada semana', () => {
    const sem = G.semanaDe(AHORA);
    assert.match(sem, /^\d{4}-W\d{2}$/);
    assert.notStrictEqual(G.semanaDe(AHORA + 7 * 86400000), sem);
    let s = null; let cumplidas = 0; let todas = 0;
    for (const [k, d] of Object.entries(G.MISIONES_SEMANA)) {
        for (let i = 0; i < d.n + 3; i++) { const r = G.avanzarSemana(s, k, sem); s = r.sem; if (r.cumplida) cumplidas++; if (r.todas) todas++; }
    }
    assert.strictEqual(cumplidas, Object.keys(G.MISIONES_SEMANA).length);
    assert.strictEqual(todas, 1);
    const nueva = G.avanzarSemana(s, 'cuidar', '2099-W01');
    assert.strictEqual(nueva.sem.prog.cuidar, 1);
    assert.strictEqual(G.avanzarSemana(null, 'nada', sem).cumplida, null);
});
