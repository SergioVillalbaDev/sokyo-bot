const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../utils/helpers.js');

test('parseDuracion', () => {
    assert.equal(H.parseDuracion('10m'), 600000);
    assert.equal(H.parseDuracion('2h'), 7200000);
    assert.equal(H.parseDuracion('1d'), 86400000);
    assert.equal(H.parseDuracion('1h30m'), 5400000);
    assert.equal(H.parseDuracion('15'), 900000, 'sin unidad = minutos');
    for (const malo of ['', 'abc', '10x', '-5m', '0m', null, undefined, '1h 30']) assert.equal(H.parseDuracion(malo), null, String(malo));
});

test('formatDuracion', () => {
    assert.equal(H.formatDuracion(30_000), '30s');
    assert.equal(H.formatDuracion(5 * 60_000), '5 min');
    assert.equal(H.formatDuracion(90 * 60_000), '1 h 30 min');
    assert.equal(H.formatDuracion(3 * 86400000), '3 d');
    assert.equal(H.formatDuracion(null), '—');
});

test('renderPlantilla sustituye variables conocidas y respeta las desconocidas', () => {
    assert.equal(H.renderPlantilla('Hola {usuario}, soy {STAFF} de {servidor} {otra}', { usuario: 'Ana', staff: 'Bob', servidor: 'X' }), 'Hola Ana, soy Bob de X {otra}');
    assert.equal(H.renderPlantilla('{usuario}', {}), '{usuario}');
});

test('normalizarNombreMacro', () => {
    assert.equal(H.normalizarNombreMacro('  Saludo Inicial! '), 'saludo-inicial');
    assert.equal(H.normalizarNombreMacro('x'.repeat(100)).length, 32);
});

test('niveles: curva de XP coherente', () => {
    assert.equal(H.nivelDesdeXp(0).nivel, 0);
    assert.equal(H.nivelDesdeXp(99).nivel, 0);
    assert.equal(H.nivelDesdeXp(100).nivel, 1);
    let acumulado = 0; for (let n = 0; n < 10; n++) acumulado += H.xpNecesario(n);
    assert.equal(H.nivelDesdeXp(acumulado).nivel, 10);
    assert.equal(H.nivelDesdeXp(acumulado - 1).nivel, 9);
});

test('antienlaces: extracción y lista blanca', () => {
    assert.deepEqual(H.extraerDominios('mira https://www.evil.com/x y http://sub.otro.org:8080'), ['evil.com', 'sub.otro.org']);
    assert.deepEqual(H.extraerDominios('únete discord.gg/abc123'), ['discord.gg']);
    assert.deepEqual(H.extraerDominios('sin enlaces, solo texto. v1.2'), []);
    assert.ok(H.dominioPermitido('docs.google.com', ['google.com']));
    assert.ok(!H.dominioPermitido('evilgoogle.com', ['google.com']), 'no debe colarse por sufijo parcial');
    assert.ok(!H.dominioPermitido('x.com', []));
});

test('FAQ: ordena por coincidencias', () => {
    const a = [{ titulo: 'A', palabras: ['contraseña'] }, { titulo: 'B', palabras: ['contraseña', 'olvidé'] }, { titulo: 'C', palabras: ['pago'] }];
    assert.deepEqual(H.buscarArticulos(a, 'Olvidé mi CONTRASEÑA').map(x => x.titulo), ['B', 'A']);
    assert.deepEqual(H.buscarArticulos(a, 'nada'), []);
});

test('seguridad: HTML y CSV', () => {
    assert.equal(H.escaparHtml('<img onerror="x">&'), '&lt;img onerror=&quot;x&quot;&gt;&amp;');
    assert.equal(H.campoCsv('a,b'), '"a,b"');
    assert.equal(H.campoCsv('di "hola"'), '"di ""hola"""');
    assert.ok(H.campoCsv('=HYPERLINK("http://x")').startsWith(`"'=`), 'neutraliza fórmulas de Excel');
    assert.equal(H.campoCsv(null), '');
    assert.equal(new RegExp(H.escaparRegex('a.b*c')).test('a.b*c'), true);
    assert.equal(new RegExp(H.escaparRegex('a.b*c')).test('axbbc'), false);
});
