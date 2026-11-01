// ============================================================================
// Tests de la 1.9.8: vistas previas de Discord en el panel. Solo la parte pura:
// cambiar los {marcadores} por ejemplos (sokyo-panelFRONTEND/src/lib/rellenarEjemplo.js).
// ============================================================================
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');

let rellenarEjemplo;
before(async () => {
    ({ rellenarEjemplo } = await import(pathToFileURL(path.join(__dirname, '..', 'sokyo-panelFRONTEND', 'src', 'lib', 'rellenarEjemplo.js')).href));
});

describe('rellenarEjemplo (vistas previas del panel)', () => {
    it('cambia los marcadores conocidos y repetidos', () => {
        assert.strictEqual(rellenarEjemplo('¡{mention}! {mention} es nivel {level}', { mention: '@Alex', level: 5 }), '¡@Alex! @Alex es nivel 5');
    });
    it('deja tal cual los que no existen, para que se vea que no valen', () => {
        assert.strictEqual(rellenarEjemplo('Hola {nada} y {user}', { user: 'Alex' }), 'Hola {nada} y Alex');
    });
    it('un valor 0 o vacío también cuenta (no se confunde con «no existe»)', () => {
        assert.strictEqual(rellenarEjemplo('{n} {v}|', { n: 0, v: '' }), '0 |');
    });
    it('no se deja engañar por nombres heredados de los objetos', () => {
        assert.strictEqual(rellenarEjemplo('{constructor} {toString}', {}), '{constructor} {toString}');
    });
    it('texto vacío o que no es texto', () => {
        assert.strictEqual(rellenarEjemplo(undefined, { a: 1 }), '');
        assert.strictEqual(rellenarEjemplo(null), '');
    });
});
