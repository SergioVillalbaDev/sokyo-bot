const test = require('node:test');
const assert = require('node:assert/strict');
const { firmarToken, verificarToken } = require('../utils/auth.js');
const { validarEntorno } = require('../utils/entorno.js');
const { compararSeguro, crearLimitador } = require('../utils/seguridad.js');
const V = require('../utils/validacion.js');

const SECRETO = 'un-secreto-de-prueba-bastante-largo';

test('auth: firma y verifica, y rechaza manipulados, caducados y de otro tipo', () => {
    const t = firmarToken({ tipo: 'staff' }, SECRETO, 60);
    assert.equal(verificarToken(t, SECRETO, 'staff').tipo, 'staff');
    assert.equal(verificarToken(t, SECRETO, 'portal'), null, 'un token staff no sirve de portal');
    assert.equal(verificarToken(t, 'otro-secreto-distinto-largo', 'staff'), null);
    assert.equal(verificarToken(t + 'x', SECRETO, 'staff'), null);
    assert.equal(verificarToken('a.b.c', SECRETO), null);
    assert.equal(verificarToken('', SECRETO), null);
    assert.equal(verificarToken(undefined, SECRETO), null);
    assert.equal(verificarToken(firmarToken({ tipo: 'staff' }, SECRETO, -10), SECRETO, 'staff'), null, 'caducado');
});

test('auth: un token sin caducidad no es válido', () => {
    const crypto = require('crypto');
    const datos = Buffer.from(JSON.stringify({ tipo: 'staff' })).toString('base64url');
    const firma = crypto.createHmac('sha256', SECRETO).update(datos).digest('base64url');
    assert.equal(verificarToken(`${datos}.${firma}`, SECRETO, 'staff'), null);
});

test('entorno: exige claves largas, distintas y no de ejemplo', () => {
    const ok = { DISCORD_TOKEN: 'x', MONGO_URI: 'y', API_KEY: 'a'.repeat(32), JWT_SECRET: 'b'.repeat(32) };
    assert.deepEqual(validarEntorno(ok), []);
    assert.ok(validarEntorno({ ...ok, API_KEY: '' }).length);
    assert.ok(validarEntorno({ ...ok, JWT_SECRET: 'corta' }).length);
    assert.ok(validarEntorno({ ...ok, JWT_SECRET: ok.API_KEY }).some(e => /DISTINTO/.test(e)));
    assert.ok(validarEntorno({ ...ok, API_KEY: 'cambia-esta-clave-por-una-larga-y-aleatoria' }).length);
    assert.ok(validarEntorno({}).length >= 4);
});

test('seguridad: compararSeguro', () => {
    assert.equal(compararSeguro('abc', 'abc'), true);
    assert.equal(compararSeguro('abc', 'abd'), false);
    assert.equal(compararSeguro('abc', 'abcd'), false);
    assert.equal(compararSeguro(undefined, 'abc'), false);
    assert.equal(compararSeguro('abc', null), false);
});

test('seguridad: el limitador corta al superar el máximo', () => {
    const lim = crearLimitador({ ventanaMs: 60_000, max: 2 });
    const res = () => { const r = { codigo: 200, status(c) { this.codigo = c; return this; }, json() { return this; }, set() {} }; return r; };
    let pasadas = 0;
    const req = { ip: '1.2.3.4' };
    for (let i = 0; i < 3; i++) { const r = res(); lim(req, r, () => pasadas++); if (i === 2) assert.equal(r.codigo, 429); }
    assert.equal(pasadas, 2);
    let otra = 0; lim({ ip: '9.9.9.9' }, res(), () => otra++);
    assert.equal(otra, 1, 'otra IP no se ve afectada');
});

test('validación: mensajes', () => {
    assert.equal(V.validarMensaje('  hola  ').valor, 'hola');
    assert.equal(V.validarMensaje('   ').ok, false);
    assert.equal(V.validarMensaje(123).ok, false);
    assert.equal(V.validarMensaje('x'.repeat(1801)).ok, false);
    assert.equal(V.validarMensaje('x'.repeat(1800)).ok, true);
    assert.equal(V.validarNombreAutor('  Ana\nBot  '), 'Ana Bot');
    assert.equal(V.validarNombreAutor(''), 'Staff');
});

test('validación: motivos (máx. 25, únicos, nombre 1-100)', () => {
    assert.equal(V.validarMotivos([]).ok, false);
    assert.equal(V.validarMotivos(Array.from({ length: 26 }, (_, i) => ({ nombre: `m${i}` }))).ok, false);
    assert.equal(V.validarMotivos([{ nombre: 'A' }, { nombre: 'a' }]).ok, false, 'duplicado sin distinguir mayúsculas');
    assert.equal(V.validarMotivos([{ nombre: '' }]).ok, false);
    assert.equal(V.validarMotivos([{ nombre: 'x'.repeat(101) }]).ok, false);
    assert.deepEqual(V.validarMotivos([{ nombre: ' Pagos ', urgencia: 'Alta' }, 'Dudas']).valor,
        [{ nombre: 'Pagos', urgencia: 'Alta' }, { nombre: 'Dudas', urgencia: 'Normal' }]);
});

test('validación: urgencias y textos', () => {
    assert.equal(V.validarUrgencias([{ nombre: 'Alta', color: '#e67e22', nivel: 3 }]).ok, true);
    assert.equal(V.validarUrgencias([{ nombre: 'Alta', color: 'rojo', nivel: 3 }]).ok, false);
    assert.equal(V.validarUrgencias([{ nombre: 'Alta', color: '#e67e22', nivel: 'x' }]).ok, false);
    assert.equal(V.validarUrgencias([{ nombre: 'A', color: '#000000', nivel: 1 }, { nombre: 'a', color: '#000000', nivel: 2 }]).ok, false);
    assert.equal(V.validarTextos({ titulo: 'T', descripcion: 'D', footer: '' }).ok, true);
    assert.equal(V.validarTextos({ titulo: '', descripcion: 'D', footer: '' }).ok, false);
    assert.equal(V.validarTextos({ titulo: 'x'.repeat(257), descripcion: 'D', footer: '' }).ok, false);
    assert.equal(V.validarTextos({ titulo: 'T', descripcion: 'D', footer: 'x'.repeat(2049) }).ok, false);
});
