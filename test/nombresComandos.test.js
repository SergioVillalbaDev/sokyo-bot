// 1.30.0: la ayuda decía «/mascota», «/broma» y «/liga» pero esos comandos solo existían como /pet,
// /prank y /league (sin nombre en español): en Discord en español «no existían». Que no vuelva a pasar.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('cada comando que enseña /ayuda existe con ese mismo nombre en español', () => {
    const reales = new Map();
    for (const f of fs.readdirSync(path.join(__dirname, '../slash'))) {
        const d = require(`../slash/${f}`).data?.toJSON?.();
        if (d) reales.set(d.name, d.name_localizations?.['es-ES'] || d.name);
    }
    const src = fs.readFileSync(path.join(__dirname, '../utils/ayuda.js'), 'utf8');
    let n = 0;
    for (const m of src.matchAll(/\['([a-z0-9-]+)', 's', (null|'([^']+)')/g)) {
        n++;
        assert.ok(reales.has(m[1]), `/${m[1]} no existe`);
        assert.strictEqual(reales.get(m[1]), m[3] || m[1], `/${m[1]}: la ayuda dice «/${m[3] || m[1]}»`);
    }
    assert.ok(n > 30);
});

test('los textos del bot que nombran /mascota, /broma o /liga tienen ese comando', () => {
    const es = (f) => require(`../slash/${f}`).data.toJSON().name_localizations?.['es-ES'];
    assert.strictEqual(es('pet.js'), 'mascota');
    assert.strictEqual(es('prank.js'), 'broma');
    assert.strictEqual(es('league.js'), 'liga');
});
