// 1.32.0: tirada ×10, piedad a la vista y serie de la semana (sin trampas).
const test = require('node:test');
const assert = require('node:assert');
const K = require('../utils/cofresNucleo.js');
const S = require('../utils/cartasNucleo.js');
const N = require('../utils/mascotaNucleo.js');

test('×10 cuesta un 10 % menos y equivale a abrir 10 seguidos', () => {
    assert.strictEqual(K.precioVarios('basico', 10), Math.round(K.COFRES.basico.precio * 10 * 0.9));
    assert.strictEqual(K.precioVarios('basico', 1), K.COFRES.basico.precio);
    const col = { mascotas: [{ id: 'gato', estrellas: 4 }], sinEpica: 3 };
    const a = K.abrirVarios(col, 'basico', 10, N.azarCon('x10'));
    // Lo mismo, de uno en uno con la misma suerte
    const azar = N.azarCon('x10'); const c = { mascotas: col.mascotas.map((m) => ({ ...m })), sinEpica: 3 }; const uno = [];
    for (let i = 0; i < 10; i++) { const r = K.abrir(c, 'basico', azar); uno.push(r.id); const ya = c.mascotas.find((m) => m.id === r.id); if (ya) ya.estrellas = r.estrellas; else c.mascotas.push({ id: r.id, estrellas: 1 }); c.sinEpica = r.sinEpica; }
    assert.deepStrictEqual(a.res.map((r) => r.id), uno);
    assert.strictEqual(a.sinEpica, c.sinEpica);
    assert.strictEqual(a.res.length, 10);
    // Las nuevas y las que suben no se repiten y cuadran con el final
    const ids = [...a.nuevos, ...a.subir].map((x) => x.id);
    assert.strictEqual(new Set(ids).size, ids.length);
    for (const x of [...a.nuevos, ...a.subir]) assert.strictEqual(x.estrellas, c.mascotas.find((m) => m.id === x.id).estrellas);
    // La piedad funciona dentro de la tirada: en 10 seguidos con 9 sin épica, al menos una épica
    const p = K.abrirVarios({ mascotas: [], sinEpica: K.PIEDAD - 1 }, 'basico', 10, () => 0.01);
    assert.ok(p.res.some((r) => K.RAREZAS[r.rareza].orden >= 2));
});

test('serie de la semana: rota, existe, sube su probabilidad y sigue sin dar ventaja al quitar series', () => {
    const a = S.serieDestacada('2026-11-23'); const b = S.serieDestacada('2026-11-30');
    assert.ok(a && S.series().get(a).length >= 4);
    assert.strictEqual(S.serieDestacada('2026-11-23'), a);
    const semanas = new Set(); for (let i = 0; i < 30; i++) semanas.add(S.serieDestacada(`s${i}`));
    assert.ok(semanas.size > 5 && (a !== b || semanas.size > 1));
    // Más cartas de la destacada con ella que sin ella
    let con = 0; let sin = 0; const az1 = N.azarCon('d1'); const az2 = N.azarCon('d1');
    for (let i = 0; i < 4000; i++) {
        if (K.def(S.cartaAlAzar('comun', az1, a) || 'x').serie === a) con++;
        if (K.def(S.cartaAlAzar('comun', az2) || 'x').serie === a) sin++;
    }
    assert.ok(con >= sin, `${con} vs ${sin}`);
    // Quitar series: misma suerte → misma carta (o oro), también con destacada
    const quitados = new Set([...K.ANIME.entries()].filter(([, c]) => c.serie !== a).map(([id]) => id));
    for (let i = 0; i < 300; i++) {
        const x = S.abrirSobre({}, 'brillante', N.azarCon(`q${i}`), null, a);
        const y = S.abrirSobre({}, 'brillante', N.azarCon(`q${i}`), quitados, a);
        x.cartas.forEach((c, k) => { if (y.cartas[k].id) assert.strictEqual(y.cartas[k].id, c.id); });
    }
});
