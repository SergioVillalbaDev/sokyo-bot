// ============================================================================
// Tests de las categorías de los tickets (1.9.12): los abiertos siempre en su
// categoría (la elegida o «🎫 Tickets abiertos», que crea el bot) y los cerrados
// en la suya. utils/ticketManager.js → categoriaAbiertos, categoriaCerrados.
// Sin MongoDB: si el bot crea la categoría, apuntarla falla en silencio.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { ChannelType, Collection } = require('discord.js');
// Sin conexión, que Mongoose falle al momento en vez de esperar 10 s.
require('mongoose').set('bufferCommands', false);
const { categoriaAbiertos, categoriaCerrados } = require('../utils/ticketManager.js');

function servidor(categorias = []) {
    const cache = new Collection();
    const crear = (id, name, hijos = 0) => {
        const children = new Collection();
        for (let i = 0; i < hijos; i++) children.set(`${id}-h${i}`, {});
        const cat = { id, name, type: ChannelType.GuildCategory, children: { cache: children } };
        cache.set(id, cat);
        return cat;
    };
    categorias.forEach(([id, name, hijos]) => crear(id, name, hijos));
    let n = 0;
    return {
        id: 'g1', creadas: [],
        channels: { cache, async create({ name }) { const c = crear(`nueva${++n}`, name); this.creadas = (this.creadas || 0) + 1; return c; } },
    };
}

describe('tickets: categoría de los abiertos', () => {
    it('usa la elegida en el panel', async () => {
        const g = servidor([['cat1', 'Soporte', 3]]);
        assert.strictEqual(await categoriaAbiertos(g, { categoriaTicketsId: 'cat1' }), 'cat1');
    });
    it('sin ninguna elegida, crea «🎫 Tickets abiertos» (en el idioma del servidor)', async () => {
        const g = servidor();
        const id = await categoriaAbiertos(g, { idioma: 'es' });
        assert.strictEqual(g.channels.cache.get(id).name, '🎫 Tickets abiertos');
        // La segunda vez la reutiliza (no crea otra).
        assert.strictEqual(await categoriaAbiertos(g, { idioma: 'es' }), id);
    });
    it('si la elegida está llena (50), usa «… 2»', async () => {
        const g = servidor([['cat1', 'Soporte', 50]]);
        const id = await categoriaAbiertos(g, { categoriaTicketsId: 'cat1' });
        assert.notStrictEqual(id, 'cat1');
        assert.strictEqual(g.channels.cache.get(id).name, 'Soporte 2');
    });
});

describe('tickets: categoría de los cerrados', () => {
    it('la elegida en el panel manda sobre el nombre', async () => {
        const g = servidor([['arch', 'Cerrados', 0]]);
        const cat = await categoriaCerrados(g, { categoriaArchivadosId: 'arch', categoriaArchivados: 'Otra' }, 'x');
        assert.strictEqual(cat.id, 'arch');
    });
    it('sin elegida, por nombre (y se crea si no existe)', async () => {
        const g = servidor();
        const cat = await categoriaCerrados(g, { categoriaArchivados: '🗄️ Tickets cerrados' }, 'x');
        assert.strictEqual(cat.name, '🗄️ Tickets cerrados');
    });
});
