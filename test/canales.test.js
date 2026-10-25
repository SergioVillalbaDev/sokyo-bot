// ============================================================================
// Tests de "Mover y ordenar" canales (PUT /config/:guildId/canales/orden):
// qué orden se manda a Discord y qué peticiones se rechazan sin tocar nada.
// ============================================================================
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { ChannelType, Collection } = require('discord.js');
const rutasCanales = require('../api/routes/canales.js');

const GUILD = '900000000000000001';
// rawPosition como la da Discord: la voz cuenta aparte, así que se "mezcla" con el texto.
const canal = (id, type, parentId, rawPosition) => ({
    id, type, parentId, rawPosition, name: id, permissionOverwrites: { cache: new Collection() },
});
const canales = [
    canal('c-info', ChannelType.GuildCategory, null, 0),
    canal('c-comunidad', ChannelType.GuildCategory, null, 1),
    canal('t-normas', ChannelType.GuildText, 'c-info', 0),
    canal('v-charla', ChannelType.GuildVoice, 'c-comunidad', 0),
    canal('t-general', ChannelType.GuildText, 'c-comunidad', 1),
    canal('m-clips', ChannelType.GuildMedia, 'c-comunidad', 2), // tipo que el panel no edita ('otro')
    canal('f-ayuda', ChannelType.GuildForum, null, 0),
    canal('hilo', ChannelType.PublicThread, 't-general', 0), // los hilos no se ordenan
];
let llamadas = [];
const guild = {
    id: '900000000000000001',
    roles: { cache: new Collection() },
    members: { cache: new Collection() },
    channels: {
        cache: new Collection(canales.map((c) => [c.id, c])),
        setPositions: async (posiciones) => { llamadas.push(posiciones); },
    },
};
const client = { guilds: { cache: new Map([[GUILD, guild]]) } };

let servidor;
let base;
const arrancar = (opciones) => new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use('/api', rutasCanales({ client, ...opciones }));
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const ordenar = (cuerpo, guildId = GUILD, url = base) => fetch(`${url}/api/config/${guildId}/canales/orden`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
});

describe('ordenar canales y categorías', () => {
    before(async () => {
        servidor = await arrancar();
        base = `http://127.0.0.1:${servidor.address().port}`;
    });
    after(() => servidor.close());
    beforeEach(() => { llamadas = []; });

    it('la estructura sale como la enseña Discord: texto primero y la voz debajo', async () => {
        const r = await fetch(`${base}/api/config/${GUILD}/canales/estructura`);
        const { categorias, sinCategoria } = await r.json();
        assert.deepStrictEqual(categorias.map((c) => [c.id, c.canales.map((x) => x.id)]), [
            ['c-info', ['t-normas']],
            ['c-comunidad', ['t-general', 'm-clips', 'v-charla']],
        ]);
        assert.deepStrictEqual(sinCategoria.map((c) => c.id), ['f-ayuda']);
        assert.strictEqual(categorias[1].canales[1].tipo, 'otro');
    });

    it('sin cambios no llama a Discord', async () => {
        const r = await ordenar({
            categorias: ['c-info', 'c-comunidad'],
            canales: [
                { id: 'f-ayuda', categoriaId: null },
                { id: 't-normas', categoriaId: 'c-info' },
                { id: 't-general', categoriaId: 'c-comunidad' },
                { id: 'm-clips', categoriaId: 'c-comunidad' },
                { id: 'v-charla', categoriaId: 'c-comunidad' },
            ],
        });
        assert.strictEqual(r.status, 200);
        assert.strictEqual((await r.json()).sinCambios, true);
        assert.deepStrictEqual(llamadas, []);
    });

    it('cambiar el orden de las categorías solo manda las categorías', async () => {
        const r = await ordenar({
            categorias: ['c-comunidad', 'c-info'],
            canales: [
                { id: 'f-ayuda', categoriaId: null },
                { id: 't-general', categoriaId: 'c-comunidad' },
                { id: 'm-clips', categoriaId: 'c-comunidad' },
                { id: 'v-charla', categoriaId: 'c-comunidad' },
                { id: 't-normas', categoriaId: 'c-info' },
            ],
        });
        assert.strictEqual(r.status, 200);
        assert.deepStrictEqual(llamadas, [[
            { channel: 'c-comunidad', position: 0 },
            { channel: 'c-info', position: 1 },
        ]]);
    });

    it('mover un canal de categoría manda solo esa categoría, contando por categoría', async () => {
        const r = await ordenar({
            categorias: ['c-info', 'c-comunidad'],
            canales: [
                { id: 'f-ayuda', categoriaId: null },
                { id: 't-normas', categoriaId: 'c-info' },
                { id: 't-general', categoriaId: 'c-info' },
                { id: 'm-clips', categoriaId: 'c-comunidad' },
                { id: 'v-charla', categoriaId: 'c-comunidad' },
            ],
        });
        assert.strictEqual(r.status, 200);
        // c-comunidad solo pierde un canal (el resto sigue igual): no se toca.
        assert.deepStrictEqual(llamadas, [[
            { channel: 't-normas', position: 0 },
            { channel: 't-general', position: 1, parent: 'c-info', lockPermissions: false },
        ]]);
    });

    it('reordenar dentro de una categoría manda todos sus canales, sin cambiar su categoría', async () => {
        const r = await ordenar({
            categorias: ['c-info', 'c-comunidad'],
            canales: [
                { id: 'f-ayuda', categoriaId: null },
                { id: 't-normas', categoriaId: 'c-info' },
                { id: 'm-clips', categoriaId: 'c-comunidad' },
                { id: 't-general', categoriaId: 'c-comunidad' },
                { id: 'v-charla', categoriaId: 'c-comunidad' },
            ],
        });
        assert.strictEqual(r.status, 200);
        assert.deepStrictEqual(llamadas, [[
            { channel: 'm-clips', position: 0 },
            { channel: 't-general', position: 1 },
            { channel: 'v-charla', position: 2 },
        ]]);
    });

    it('rechaza categorías repetidas o que no son categorías', async () => {
        for (const categorias of [['c-info', 'c-info'], ['t-general']]) {
            const r = await ordenar({ categorias, canales: [] });
            assert.strictEqual(r.status, 400, JSON.stringify(categorias));
        }
        assert.deepStrictEqual(llamadas, []);
    });

    it('rechaza canales repetidos, categorías o tipos que no se ordenan', async () => {
        const malos = [
            [{ id: 't-general' }, { id: 't-general' }],
            [{ id: 'c-info' }],
            [{ id: 'hilo' }],
            [{ id: 't-general', categoriaId: 't-normas' }],
        ];
        for (const lista of malos) {
            const r = await ordenar({ categorias: [], canales: lista });
            assert.strictEqual(r.status, 400, JSON.stringify(lista));
        }
        assert.deepStrictEqual(llamadas, []);
    });

    it('lo que ya no existe en Discord (sala temporal cerrada, ticket borrado…) se salta y se guarda el resto', async () => {
        const r = await ordenar({
            categorias: ['c-info', 'c-comunidad', 'cat-borrada'],
            canales: [
                { id: 'f-ayuda', categoriaId: null },
                { id: 't-normas', categoriaId: 'c-info' },
                { id: 't-general', categoriaId: 'c-info' },
                { id: 'sala-temporal-cerrada', categoriaId: 'c-comunidad' },
                { id: 'm-clips', categoriaId: 'c-comunidad' },
                { id: 'v-charla', categoriaId: 'c-comunidad' },
                { id: 'f-ayuda-2', categoriaId: 'cat-borrada' },
            ],
        });
        assert.strictEqual(r.status, 200);
        const cuerpo = await r.json();
        assert.strictEqual(cuerpo.success, true);
        assert.strictEqual(cuerpo.ignorados, 3);
        assert.deepStrictEqual(llamadas, [[
            { channel: 't-normas', position: 0 },
            { channel: 't-general', position: 1, parent: 'c-info', lockPermissions: false },
        ]]);
    });

    it('un canal existente movido a una categoría que ya no existe se queda donde estaba', async () => {
        const r = await ordenar({ categorias: [], canales: [{ id: 't-general', categoriaId: 'no-existe' }] });
        assert.strictEqual(r.status, 200);
        assert.strictEqual((await r.json()).ignorados, 1);
        assert.deepStrictEqual(llamadas, []);
    });

    it('sin cuerpo JSON no rompe: no hay nada que mover', async () => {
        const r = await fetch(`${base}/api/config/${GUILD}/canales/orden`, { method: 'PUT' });
        assert.strictEqual(r.status, 200);
        assert.deepStrictEqual(llamadas, []);
    });

    it('servidor desconocido: 404', async () => {
        const r = await ordenar({ categorias: [], canales: [] }, '1');
        assert.strictEqual(r.status, 404);
    });

    it('sin el área "config" no se puede reordenar', async () => {
        const s = await arrancar({ exigeArea: () => (req, res) => res.status(403).json({ error: 'Sin acceso' }) });
        const r = await ordenar({ categorias: ['c-info'], canales: [] }, GUILD, `http://127.0.0.1:${s.address().port}`);
        s.close();
        assert.strictEqual(r.status, 403);
        assert.deepStrictEqual(llamadas, []);
    });
});

// Guardar una categoría desde el panel: antes se mandaban a Discord dos cambios
// (nombre + permisos) aunque no cambiara nada, y con su límite de 2 cambios de
// nombre cada 10 minutos el panel se quedaba en «Guardando…».
describe('guardar una categoría', () => {
    const { PermissionsBitField } = require('discord.js');
    let ediciones = [];
    let lento = false;
    const categoria = {
        id: 'c-edit', type: ChannelType.GuildCategory, parentId: null, rawPosition: 9, position: 9, name: 'Soporte',
        permissionOverwrites: { cache: new Collection([['rol-staff', { id: 'rol-staff', type: 0, allow: new PermissionsBitField(['ViewChannel']), deny: new PermissionsBitField([]) }]]) },
        edit(cambios) {
            ediciones.push(cambios);
            if (cambios.name) this.name = cambios.name;
            return lento ? new Promise((r) => setTimeout(() => r(this), 1500)) : Promise.resolve(this);
        },
    };
    let s; let url;
    const guardar = (cuerpo) => fetch(`${url}/api/config/${GUILD}/canales/categorias/c-edit`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
    const permisos = (allow) => [{ id: 'rol-staff', allow, deny: [] }];

    before(async () => {
        guild.channels.cache.set('c-edit', categoria);
        process.env.CANALES_ESPERA_MS = '200';
        s = await arrancar();
        url = `http://127.0.0.1:${s.address().port}`;
    });
    after(() => { s.close(); guild.channels.cache.delete('c-edit'); delete process.env.CANALES_ESPERA_MS; });
    beforeEach(() => { ediciones = []; lento = false; });

    it('sin cambios no se manda nada a Discord', async () => {
        const r = await guardar({ nombre: 'Soporte', overwrites: permisos(['ViewChannel']) });
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.success, true);
        assert.deepStrictEqual(ediciones, []);
    });

    it('cambiar solo los permisos es una sola petición y sin tocar el nombre', async () => {
        const r = await guardar({ nombre: 'Soporte', overwrites: permisos(['ViewChannel', 'SendMessages']) });
        assert.strictEqual(r.success, true);
        assert.strictEqual(ediciones.length, 1);
        assert.strictEqual(ediciones[0].name, undefined);
        assert.ok(Array.isArray(ediciones[0].permissionOverwrites));
    });

    it('el tercer cambio de nombre en 10 minutos no se manda: se avisa con el tiempo que falta', async () => {
        await guardar({ nombre: 'Soporte 1' });
        await guardar({ nombre: 'Soporte 2' });
        assert.strictEqual(ediciones.filter((e) => e.name).length, 2);
        const r = await guardar({ nombre: 'Soporte 3' });
        assert.strictEqual(r.success, true);
        assert.strictEqual(r.aviso, 'limite_nombre');
        assert.strictEqual(r.minutos, 10);
        assert.strictEqual(ediciones.length, 2, 'Discord no recibe el tercer nombre');
    });

    it('si Discord retiene el cambio, el panel recibe respuesta enseguida (en cola)', async () => {
        lento = true;
        const inicio = Date.now();
        const r = await guardar({ overwrites: permisos(['ViewChannel', 'AttachFiles']) });
        assert.ok(Date.now() - inicio < 1200, 'no espera a Discord');
        assert.strictEqual(r.success, true);
        assert.strictEqual(r.aviso, 'en_cola');
        assert.strictEqual(ediciones.length, 1);
    });
});

// Discord rechaza el orden entero si el bot no puede tocar uno solo de los
// canales. Antes el panel solo decía «no se pudo»: ahora se comprueba antes y
// se dice cuáles, y los errores de Discord llegan con un código claro.
describe('ordenar: permisos del bot y errores de Discord', () => {
    const { PermissionsBitField } = require('discord.js');
    const conPermisos = (flags) => ({ has: (pedidos) => new PermissionsBitField(flags).has(pedidos) });
    const todo = ['ViewChannel', 'ManageChannels'];
    let permisosServidor = todo;
    let fallo = null;
    let lento = false;
    let posiciones = [];
    const yo = { id: 'bot', permissions: { has: (f) => new PermissionsBitField(permisosServidor).has(f) } };
    const mk = (id, type, parentId, rawPosition, flags = todo) => ({
        id, type, parentId, rawPosition, name: id, permissionOverwrites: { cache: new Collection() },
        permissionsFor: (quien) => (quien === yo ? conPermisos(flags) : null),
    });
    const lista = [
        mk('cat-a', ChannelType.GuildCategory, null, 0),
        mk('cat-b', ChannelType.GuildCategory, null, 1),
        mk('cat-staff', ChannelType.GuildCategory, null, 2, ['ViewChannel']),
        mk('a1', ChannelType.GuildText, 'cat-a', 0),
        mk('a2', ChannelType.GuildText, 'cat-a', 1),
        mk('b1', ChannelType.GuildText, 'cat-b', 0),
        mk('privado', ChannelType.GuildText, 'cat-b', 1, []),
    ];
    const g = {
        id: '900000000000000002',
        roles: { cache: new Collection() },
        members: { cache: new Collection(), me: yo },
        channels: {
            cache: new Collection(lista.map((c) => [c.id, c])),
            setPositions: (p) => {
                posiciones.push(p);
                if (fallo) return Promise.reject(fallo);
                return lento ? new Promise((r) => setTimeout(r, 1500)) : Promise.resolve();
            },
        },
    };
    const cli = { guilds: { cache: new Map([[g.id, g]]) } };
    let s; let url;
    const pedir = (cuerpo) => fetch(`${url}/api/config/${g.id}/canales/orden`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
    // Mueve a2 encima de a1 (solo cambia cat-a); el resto, como está.
    const subirA2 = {
        categorias: ['cat-a', 'cat-b', 'cat-staff'],
        canales: [
            { id: 'a2', categoriaId: 'cat-a' }, { id: 'a1', categoriaId: 'cat-a' },
            { id: 'b1', categoriaId: 'cat-b' }, { id: 'privado', categoriaId: 'cat-b' },
        ],
    };

    before(async () => {
        process.env.CANALES_ESPERA_MS = '200';
        const app = express();
        app.use(express.json());
        app.use('/api', rutasCanales({ client: cli }));
        s = await new Promise((resolve) => { const srv = app.listen(0, '127.0.0.1', () => resolve(srv)); });
        url = `http://127.0.0.1:${s.address().port}`;
    });
    after(() => { s.close(); delete process.env.CANALES_ESPERA_MS; });
    beforeEach(() => { posiciones = []; fallo = null; lento = false; permisosServidor = todo; });

    it('un canal privado de OTRA categoría ya no impide ordenar', async () => {
        const r = await pedir(subirA2);
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.success, true);
        assert.deepStrictEqual(posiciones, [[{ channel: 'a2', position: 0 }, { channel: 'a1', position: 1 }]]);
    });

    it('si se mueve algo que el bot no puede tocar, dice cuáles y no llama a Discord', async () => {
        const r = await pedir({
            categorias: ['cat-a', 'cat-b', 'cat-staff'],
            canales: [
                { id: 'a1', categoriaId: 'cat-a' }, { id: 'a2', categoriaId: 'cat-a' },
                { id: 'privado', categoriaId: 'cat-b' }, { id: 'b1', categoriaId: 'cat-b' },
            ],
        });
        assert.strictEqual(r.status, 403);
        assert.strictEqual(r.codigo, 'sin_permiso');
        assert.deepStrictEqual(r.canales, ['privado']);
        assert.deepStrictEqual(posiciones, []);
    });

    it('la categoría de destino también tiene que poder gestionarla', async () => {
        const r = await pedir({
            categorias: ['cat-a', 'cat-b', 'cat-staff'],
            canales: [
                { id: 'a1', categoriaId: 'cat-a' },
                { id: 'b1', categoriaId: 'cat-b' }, { id: 'privado', categoriaId: 'cat-b' },
                { id: 'a2', categoriaId: 'cat-staff' },
            ],
        });
        assert.strictEqual(r.status, 403);
        assert.deepStrictEqual(r.canales, ['cat-staff']);
        assert.deepStrictEqual(posiciones, []);
    });

    it('sin «Gestionar canales» en el servidor lo dice tal cual', async () => {
        permisosServidor = ['ViewChannel'];
        const r = await pedir(subirA2);
        assert.strictEqual(r.status, 403);
        assert.strictEqual(r.codigo, 'sin_permiso_servidor');
        assert.deepStrictEqual(posiciones, []);
    });

    it('los errores de Discord llegan al panel con un código claro', async () => {
        fallo = Object.assign(new Error('Missing Permissions'), { code: 50013, status: 403 });
        let r = await pedir(subirA2);
        assert.strictEqual(r.status, 403);
        assert.strictEqual(r.codigo, 'sin_permiso');

        fallo = Object.assign(new Error('Invalid Form Body\n0.position[NUMBER_TYPE_COERCE]'), { code: 50035, status: 400 });
        r = await pedir(subirA2);
        assert.strictEqual(r.status, 502);
        assert.strictEqual(r.codigo, 'discord');
        assert.match(r.detalle, /Invalid Form Body/);

        fallo = new Error('red caída');
        r = await pedir(subirA2);
        assert.strictEqual(r.status, 500);
        assert.strictEqual(r.codigo, 'error');
    });

    it('si Discord retiene el orden, el panel recibe respuesta enseguida (en cola)', async () => {
        lento = true;
        const inicio = Date.now();
        const r = await pedir(subirA2);
        assert.ok(Date.now() - inicio < 1200, 'no espera a Discord');
        assert.strictEqual(r.success, true);
        assert.strictEqual(r.aviso, 'en_cola');
    });
});
