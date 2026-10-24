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

    it('manda a Discord el orden de categorías y canales, contando por categoría', async () => {
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
            { channel: 'f-ayuda', position: 0, parent: null, lockPermissions: false },
            { channel: 't-general', position: 0, parent: 'c-comunidad', lockPermissions: false },
            { channel: 'm-clips', position: 1, parent: 'c-comunidad', lockPermissions: false },
            { channel: 'v-charla', position: 2, parent: 'c-comunidad', lockPermissions: false },
            { channel: 't-normas', position: 0, parent: 'c-info', lockPermissions: false },
        ]]);
    });

    it('rechaza categorías repetidas o que no son categorías', async () => {
        for (const categorias of [['c-info', 'c-info'], ['t-general'], ['no-existe']]) {
            const r = await ordenar({ categorias, canales: [] });
            assert.strictEqual(r.status, 400, JSON.stringify(categorias));
        }
        assert.deepStrictEqual(llamadas, []);
    });

    it('rechaza canales desconocidos, repetidos, categorías o tipos que no se ordenan', async () => {
        const malos = [
            [{ id: 'no-existe' }],
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
