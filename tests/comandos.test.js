const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'comandos');
const comandos = fs.readdirSync(dir).filter(f => f.endsWith('.js'))
    .flatMap(f => { const m = require(path.join(dir, f)); return m.comandos || [m]; });

test('todos los comandos son slash válidos para Discord', () => {
    assert.ok(comandos.length >= 15);
    const nombres = new Set();
    for (const c of comandos) {
        assert.equal(typeof c.execute, 'function', 'falta execute');
        const json = c.data.toJSON();
        assert.match(json.name, /^[a-z0-9_-]{1,32}$/, `nombre inválido: ${json.name}`);
        assert.ok(json.description.length > 0 && json.description.length <= 100, `descripción de /${json.name}`);
        assert.ok(!nombres.has(json.name), `comando duplicado: ${json.name}`);
        nombres.add(json.name);
    }
});

test('los comandos del prefijo "!" originales siguen existiendo como "/"', () => {
    const nombres = comandos.map(c => c.data.name);
    for (const n of ['dado', 'moneda', 'user', 'setup-soporte']) assert.ok(nombres.includes(n), n);
});

test('los comandos de moderación están ocultos por defecto a quien no tiene el permiso de Discord', () => {
    const por = Object.fromEntries(comandos.map(c => [c.data.name, c.data.toJSON().default_member_permissions]));
    for (const n of ['warn', 'mute', 'unmute', 'kick', 'ban', 'unban', 'sanciones']) assert.ok(por[n], `/${n} debe tener default_member_permissions`);
});

test('ya no queda ningún manejador de comandos con prefijo "!"', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'events', 'messageCreate.js'), 'utf8');
    assert.ok(!/startsWith\(['"]!['"]\)/.test(src));
});
