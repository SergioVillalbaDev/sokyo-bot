// Los comandos que enseña la ayuda salen del catálogo (utils/catalogo.js, 1.34.0): cada uno tiene que existir.
// (1.30.0: la ayuda decía «/mascota», «/broma» y «/liga» pero no existían con ese nombre en español.)
const test = require('node:test');
const assert = require('node:assert');
const C = require('../utils/catalogo.js');
const P = require('../utils/puertas.js');

test('cada comando del catálogo existe (suelto o dentro de su puerta)', () => {
    const reales = P.comandos();
    for (const m of C.MODULOS) {
        for (const c of m.comandos || []) assert.ok(reales.has(c), `${m.id}: /${c} no existe`);
        for (const [puerta, c] of m.partes || []) {
            assert.ok(reales.has(c), `${m.id}: /${c} no existe`);
            assert.ok(P.PUERTAS[puerta], `${m.id}: la puerta ${puerta} no existe`);
            assert.ok(P.rutaDe(c, 'es') && P.rutaDe(c, 'en'), `${m.id}: ${c} sin ruta`);
        }
    }
});

test('ningún comando queda fuera del catálogo (si no, nadie lo encuentra en /ayuda ni en /menu)', () => {
    const enCatalogo = new Set(C.MODULOS.flatMap((m) => [...(m.comandos || []), ...(m.partes || []).map(([, c]) => c)]));
    const fuera = [...P.comandos().keys()].filter((n) => !enCatalogo.has(n));
    assert.deepStrictEqual(fuera, []);
});

test('la ayuda enseña los comandos con su nombre en cada idioma', () => {
    const A = require('../utils/ayuda.js');
    assert.strictEqual(A.nombreComando('chest', 'es'), '`/jugar cofre`');
    assert.strictEqual(A.nombreComando('chest', 'en'), '`/games chest`');
    assert.strictEqual(A.nombreComando('daily', 'es'), '`/diario`');
    const msg = A.mensajeAyuda('es', '!', { categoria: 'jugar', cfg: {} });
    assert.match(msg.embeds[0].data.description, /jugar cofre/);
});
