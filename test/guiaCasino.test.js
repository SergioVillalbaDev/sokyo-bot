// 1.34.1: guía del casino rehecha. Que cada pantalla sea un mensaje que Discord acepta y que los
// botones lleven a algo que funciona allí (jugar solo en el canal del casino; fuera, ir a él).
const test = require('node:test');
const assert = require('node:assert');
const G = require('../utils/casinoAyuda.js');

const cfg = { guildId: 'g1', casino: { activo: true, canalId: 'casino1', apuestaMin: 10 } };
const valido = (e) => !e || !!e.id || /^\p{RGI_Emoji}$/v.test(e.name);
function revisar(p) {
    const filas = p.components.map((c) => c.toJSON());
    assert.ok(filas.length <= 5);
    for (const f of filas) {
        assert.ok(f.components.length <= 5);
        for (const c of f.components) {
            assert.ok(valido(c.emoji), `emoji ${c.emoji?.name}`);
            for (const o of c.options || []) { assert.ok(valido(o.emoji), `emoji ${o.emoji?.name}`); assert.ok((o.description || '').length <= 100 && o.label.length <= 100); }
            assert.ok((c.options || []).length <= 25);
        }
    }
    for (const e of p.embeds.map((x) => x.toJSON())) {
        for (const u of [e.image?.url, e.thumbnail?.url].filter((x) => x?.startsWith('attachment://'))) assert.ok(p.files.some((f) => f.name === u.slice(13)), `falta ${u}`);
        for (const f of e.fields || []) assert.ok(f.value && f.value.length <= 1024);
    }
    return filas.flatMap((f) => f.components).filter((c) => c.type === 2);
}

test('portada: la tirada se juega en cualquier canal (en privado); fuera, además, el enlace al canal del casino', async () => {
    const dentro = revisar(await G.guiaGeneral('es', cfg, { canalId: 'casino1', guildId: 'g1' }));
    assert.ok(dentro.some((b) => b.custom_id === 'cas_lb:diaria'));
    const fuera = revisar(await G.guiaGeneral('en', cfg, { canalId: 'otro', guildId: 'g1' }));
    assert.ok(fuera.some((b) => b.custom_id === 'cas_lb:diaria'), '2.5.0: fuera del casino la tirada también vale (en privado)');
    assert.ok(fuera.some((b) => b.style === 5 && b.url === 'https://discord.com/channels/g1/casino1'));
    const cerrado = revisar(await G.guiaGeneral('es', { casino: { activo: false } }, {}));
    assert.equal(cerrado.length, 0, 'casino cerrado: nada que pulsar que dé error');
});

test('cada juego tiene su ficha y sus botones llevan a algo que existe', async () => {
    const casino = require('../utils/casino.js');
    for (const j of [...Object.keys(G.GUIA), 'cofres']) {
        const b = revisar(await G.guiaJuego(j, 'es', cfg, { canalId: 'casino1', guildId: 'g1' }));
        assert.ok(b.some((x) => x.custom_id === 'cas_guiav'), `${j}: sin «Todos los juegos»`);
        for (const x of b) {
            if (x.custom_id?.startsWith('cas_rep:')) assert.ok(casino.JUEGOS[x.custom_id.split(':')[1]], `${j}: «Probar» a un juego que no existe`);
            if (x.custom_id?.startsWith('cas_lb:')) assert.ok(['carrera', 'cohete', 'mesaruleta', 'diaria', 'mio'].includes(x.custom_id.split(':')[1]), `${j}: botón del lobby desconocido`);
        }
        // 2.5.0: fuera del canal del casino, los juegos solo para ti se prueban igual (en privado); los de grupo, no.
        const fuera = revisar(await G.guiaJuego(j, 'es', cfg, { canalId: 'otro', guildId: 'g1' }));
        if (G.GUIA[j]?.grupo) assert.ok(!fuera.some((x) => x.custom_id?.startsWith('cas_rep:') || /^cas_lb:(carrera|cohete|mesaruleta)$/.test(x.custom_id || '')), `${j}: una partida de grupo no se abre fuera del casino`);
        else if (G.GUIA[j] && G.GUIA[j].probar != null) assert.ok(fuera.some((x) => x.custom_id?.startsWith('cas_rep:')), `${j}: un juego solo para ti se prueba desde cualquier canal`);
    }
});

test('un juego apagado sale marcado y sin botón de jugar', async () => {
    const b = revisar(await G.guiaJuego('crash', 'es', { ...cfg, casino: { ...cfg.casino, juegos: { crash: false } } }, { canalId: 'casino1', guildId: 'g1' }));
    assert.ok(!b.some((x) => x.custom_id?.startsWith('cas_rep:')));
    const menu = (await G.guiaGeneral('es', { ...cfg, casino: { ...cfg.casino, juegos: { crash: false } } }, {})).components[0].toJSON().components[0];
    assert.ok(!menu.options.some((o) => o.value === 'crash' || o.value === 'cohete'), 'el cohete va con el crash');
});

test('en la guía pública fija del canal, elegir un juego no cambia el mensaje de todos', async () => {
    const llamadas = [];
    const i = (privado) => ({ message: { flags: { has: (f) => f === 64 && privado } }, update: async () => llamadas.push('update'), reply: async (p) => llamadas.push(p.flags === 64 ? 'privado' : 'público') });
    await G.manejarGuia(i(false), {});
    await G.manejarGuia(i(true), {});
    assert.deepEqual(llamadas, ['privado', 'update']);
});
