// Discord rechaza al registrar un comando con más de 25 subcomandos u opciones, más de 25 opciones en una lista
// o más de 8000 caracteres entre nombres, descripciones y valores (con traducciones). Si pasa, deploy-commands
// falla en la Pi y los comandos nuevos no salen.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

function caracteres(op) {
    let n = 0;
    const s = (x) => { if (typeof x === 'string' || typeof x === 'number') n += String(x).length; };
    const rec = (o) => {
        s(o.name); s(o.description);
        for (const v of Object.values(o.name_localizations || {})) s(v);
        for (const v of Object.values(o.description_localizations || {})) s(v);
        for (const c of o.choices || []) { s(c.name); s(c.value); for (const v of Object.values(c.name_localizations || {})) s(v); }
        for (const x of o.options || []) rec(x);
    };
    rec(op);
    return n;
}

test('comandos con barra dentro de los límites de Discord', () => {
    const dir = path.join(__dirname, '..', 'slash');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
        const j = require(path.join(dir, f)).data.toJSON();
        assert.ok(caracteres(j) <= 8000, `${f}: ${caracteres(j)} caracteres (máximo 8000)`);
        assert.ok((j.options || []).length <= 25, `${f}: más de 25 opciones`);
        const revisar = (o) => { assert.ok((o.choices || []).length <= 25, `${f}/${o.name}: más de 25 opciones en la lista`); assert.ok((o.options || []).length <= 25, `${f}/${o.name}: más de 25 opciones`); (o.options || []).forEach(revisar); };
        (j.options || []).forEach(revisar);
    }
});
