// 1.23.0: acceso de soporte a la configuración (sin base de datos).
const { test } = require('node:test');
const assert = require('node:assert');
const { rutaValida } = require('../api/routes/soporte.js');
const A = require('../utils/accesoSoporte.js');

test('solo deja tocar rutas que existen y no son internas ni de cobros', () => {
    assert.equal(rutaValida('casino.activo'), null);
    assert.equal(rutaValida('casino.apuestaMax'), null);
    assert.equal(rutaValida('idioma'), null);
    assert.equal(rutaValida('compis.animeFuera'), null);
    assert.ok(rutaValida('plan'));
    assert.ok(rutaValida('esPremium'));
    assert.ok(rutaValida('stripeCustomerId'));
    assert.ok(rutaValida('guildId'));
    assert.ok(rutaValida('noExiste.nada'));
    assert.ok(rutaValida('casino.$where'));
    assert.ok(rutaValida(''));
});
test('las claves tienen su prefijo y se guardan como huella', () => {
    assert.ok(!A.pareceClave('abc'));
    assert.ok(!A.pareceClave('eyJhbGciOi.jwt.token'));
    assert.ok(A.pareceClave(`${A.PREFIJO}${'x'.repeat(30)}`));
    assert.notEqual(A.huella('a'), 'a');
    assert.equal(A.huella('a').length, 64);
});

test('lobby del casino: fichas con la mínima y la máxima, cinco como mucho', () => {
    const { fichas, OPCIONES, RESUMEN } = require('../utils/casinoLobby.js');
    assert.deepEqual(fichas(10, 5000), [10, 100, 500, 1000, 5000]);
    assert.deepEqual(fichas(50, 200), [50, 100, 200]);
    assert.deepEqual(fichas(1000, 1000), [1000]);
    for (const [min, max] of [[1, 10], [10, 100000], [300, 700]]) {
        const f = fichas(min, max);
        assert.ok(f.length <= 5 && f[0] === min && f.at(-1) === max, `${min}-${max}: ${f}`);
    }
    const J = require('../utils/casino.js').JUEGOS;
    for (const j of Object.keys(J)) assert.ok(RESUMEN[j], j);
    // Las opciones de la ruleta valen como apuesta del juego.
    const C = require('../utils/casinoNucleo.js');
    for (const [v] of OPCIONES.ruleta) { const [ap, num] = v.split('-'); assert.ok(C.pagoRuleta ? true : ap, v); if (num) assert.ok(+num >= 0 && +num <= 36); }
});
