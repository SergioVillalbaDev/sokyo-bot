// ============================================================================
// Errores de la API en inglés (1.11.0): todo `error: '…'` fijo del código tiene que tener
// su traducción en utils/erroresApi.js (o estar en NO_TRADUCIR si es un código o ya está
// en inglés). Así, con el panel en inglés, ningún aviso sale en español.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { EN, NO_TRADUCIR, middlewareErrores } = require('../utils/erroresApi.js');

function archivos(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === 'uploads' ? [] : archivos(p);
        return e.name.endsWith('.js') ? [p] : [];
    });
}

describe('errores de la API en inglés', () => {
    it('todos los errores fijos tienen traducción', () => {
        const raiz = path.join(__dirname, '..');
        const sinTraducir = new Set();
        for (const f of [...archivos(path.join(raiz, 'api')), ...archivos(path.join(raiz, 'utils'))]) {
            for (const m of fs.readFileSync(f, 'utf8').matchAll(/error: '([^']{1,})'/g)) {
                if (!EN[m[1]] && !NO_TRADUCIR.has(m[1])) sinTraducir.add(`${path.relative(raiz, f)}: ${m[1]}`);
            }
        }
        assert.deepStrictEqual([...sinTraducir], [], 'Añade estos errores a utils/erroresApi.js');
    });

    it('con el panel en inglés traduce el error; en español o sin cabecera no toca nada', () => {
        const probar = (lang, cuerpo) => {
            let enviado;
            const res = { json: (c) => { enviado = c; return c; } };
            middlewareErrores({ get: () => lang }, res, () => {});
            res.json(cuerpo);
            return enviado;
        };
        assert.deepStrictEqual(probar('en', { error: 'No se pudo guardar', codigo: 'x' }), { error: 'Couldn’t save', codigo: 'x' });
        assert.deepStrictEqual(probar('es', { error: 'No se pudo guardar' }), { error: 'No se pudo guardar' });
        assert.deepStrictEqual(probar('', { error: 'No se pudo guardar' }), { error: 'No se pudo guardar' });
        assert.deepStrictEqual(probar('en', { error: 'algo desconocido' }), { error: 'algo desconocido' });
        assert.deepStrictEqual(probar('en', [1, 2]), [1, 2]);
    });
});
