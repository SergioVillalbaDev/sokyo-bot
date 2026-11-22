// 1.26.0: los canales del bot se ordenan en categorías (solo los que están sueltos).
const { test } = require('node:test');
const assert = require('node:assert');
const { ChannelType, Collection } = require('discord.js');
const S = require('../utils/setupRapido.js');

function guildFalso() {
    const canales = new Collection();
    const g = { id: 'g1', members: { me: { id: 'bot' } }, channels: { cache: canales } };
    let n = 0;
    g.channels.create = async ({ name, type }) => { const c = { id: `c${++n}`, name, type, parentId: null }; c.setParent = async (pid) => { c.parentId = pid; }; canales.set(c.id, c); return c; };
    const nuevo = (id, name, parentId = null) => { const c = { id, name, type: ChannelType.GuildText, parentId }; c.setParent = async (pid) => { c.parentId = pid; }; canales.set(id, c); return c; };
    return { g, nuevo, canales };
}

test('mete los canales sueltos del bot en su categoría y no toca los ya colocados', async () => {
    const { g, nuevo, canales } = guildFalso();
    nuevo('b', '👋・bienvenida'); nuevo('r', '📋・registro-sokyo'); nuevo('cas', '🎰・casino'); nuevo('m', '🐾・mascota', 'miCategoria');
    const movidos = await S.organizarCanales(g, { bienvenida: { canalId: 'b' }, canalLogsId: 'r', casino: { canalId: 'cas' }, mascota: { canalId: 'm' } }, 'es');
    assert.equal(movidos.length, 3);
    const cat = (id) => canales.get(canales.get(id).parentId)?.name;
    assert.equal(cat('b'), '📢 COMUNIDAD');
    assert.equal(cat('r'), '🛡️ STAFF');
    assert.equal(cat('cas'), '🎮 DIVERSIÓN');
    assert.equal(canales.get('m').parentId, 'miCategoria');
    // Otra vez: no se crean categorías repetidas ni se mueve nada.
    const antes = canales.size;
    assert.equal((await S.organizarCanales(g, { bienvenida: { canalId: 'b' } }, 'es')).length, 0);
    assert.equal(canales.size, antes);
});
