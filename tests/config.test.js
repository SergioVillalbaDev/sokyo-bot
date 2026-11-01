const test = require('node:test');
const assert = require('node:assert/strict');
const { SECCIONES } = require('../utils/configSchema.js');
const P = require('../utils/permisos.js');

test('cada sección de configuración exige un permiso real de config', () => {
    for (const [nombre, s] of Object.entries(SECCIONES)) { assert.ok(P.TODOS.includes(s.permiso), nombre); assert.ok(s.permiso.startsWith('config.'), nombre); }
});

test('el saneado limita rangos y descarta basura', () => {
    const a = SECCIONES.automod.limpiar({ activo: 'true', antiSpam: { mensajes: 99999, segundos: -4, minutosMute: 'x' }, antiEnlaces: { dominiosPermitidos: [' YouTube.com ', '', 5], activo: 1 }, __proto__x: 1, extra: 'no' });
    assert.equal(a['automod.activo'], true);
    assert.equal(a['automod.antiSpam.mensajes'], 30);
    assert.equal(a['automod.antiSpam.segundos'], 2);
    assert.equal(a['automod.antiSpam.minutosMute'], 10, 'valor no numérico => por defecto');
    assert.deepEqual(a['automod.antiEnlaces.dominiosPermitidos'], ['youtube.com', '5']);
    assert.equal(a['automod.antiEnlaces.activo'], false, 'solo true/"true" activan');
    assert.ok(!Object.keys(a).some(k => k.includes('extra')));
});

test('los ids de Discord deben ser numéricos', () => {
    const c = SECCIONES.comunidad.limpiar({ bienvenida: { autoRolId: '123456789012345678', verificacionRolId: '$ne' }, niveles: { recompensas: [{ nivel: 5, rolId: '123456789012345678' }, { nivel: 0, rolId: '1' }, { nivel: 3, rolId: 'malo' }] }, sugerenciasCanalId: { $gt: '' } });
    assert.equal(c['bienvenida.autoRolId'], '123456789012345678');
    assert.equal(c['bienvenida.verificacionRolId'], null, 'no se cuela un operador de MongoDB');
    assert.deepEqual(c['niveles.recompensas'], [{ nivel: 5, rolId: '123456789012345678' }]);
    assert.equal(c.sugerenciasCanalId, null);
});
