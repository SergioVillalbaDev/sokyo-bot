// Tienda del servidor (2.0.0, utils/tiendaServidor.js): solo roles cosméticos, el oro se
// cobra con puerta atómica y se devuelve si falla el rol, y el stock no se vende dos veces.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { PermissionsBitField, Collection } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const CompraTienda = require('../models/CompraTienda.js');
const RolTemporal = require('../models/RolTemporal.js');
const economia = require('../utils/economia.js');
const T = require('../utils/tiendaServidor.js');

const permisos = (...p) => new PermissionsBitField(p.map((x) => PermissionsBitField.Flags[x]));
function servidor() {
    const roles = new Collection([
        ['G', { id: 'G', name: '@everyone', position: 0, permissions: permisos() }],
        ['COLOR', { id: 'COLOR', name: 'Dorado', position: 2, permissions: permisos() }],
        ['MOD', { id: 'MOD', name: 'Mods', position: 3, permissions: permisos('KickMembers') }],
        ['STAFF', { id: 'STAFF', name: 'Staff', position: 2, permissions: permisos() }],
        ['ALTO', { id: 'ALTO', name: 'Alto', position: 9, permissions: permisos() }],
        ['BOT', { id: 'BOT', name: 'Integración', position: 1, managed: true, permissions: permisos() }],
    ]);
    return { id: 'G', roles: { cache: roles }, members: { me: { roles: { highest: { position: 5 } }, permissions: permisos('ManageRoles') } } };
}
const cfg = { rolStaffId: 'STAFF', tienda: { activo: true, productos: [{ id: 'a1', nombre: 'Dorado', rolId: 'COLOR', precio: 100, horas: 0, stock: 1, activo: true }] } };

describe('tienda del servidor: qué roles se pueden vender', () => {
    const g = servidor();
    it('un rol de color sí', () => assert.strictEqual(T.errorRol(g, g.roles.cache.get('COLOR'), cfg), null));
    it('nunca uno con permisos de staff, el del staff, @everyone, uno gestionado ni uno por encima del bot', () => {
        for (const id of ['MOD', 'STAFF', 'G', 'BOT', 'ALTO']) assert.ok(T.errorRol(g, g.roles.cache.get(id), cfg), id);
        assert.ok(T.errorRol(g, undefined, cfg));
    });
    it('valida y limpia la lista del panel', () => {
        const r = T.validarProductos(g, cfg, [{ nombre: ' Oro ', rolId: 'COLOR', precio: '250.7', horas: 99999, stock: '', emoji: 'no-emoji' }]);
        assert.ok(!r.error, r.error);
        assert.deepStrictEqual({ ...r.productos[0], id: 'x' }, { id: 'x', nombre: 'Oro', rolId: 'COLOR', precio: 250, horas: 2160, stock: null, descripcion: '', emoji: '🎁', activo: true });
        assert.ok(T.validarProductos(g, cfg, [{ nombre: 'Mal', rolId: 'MOD', precio: 10 }]).error);
        assert.ok(T.validarProductos(g, cfg, [{ nombre: 'Gratis', rolId: 'COLOR', precio: 0 }]).error);
        assert.ok(T.validarProductos(g, cfg, Array.from({ length: 26 }, () => ({ nombre: 'x', rolId: 'COLOR', precio: 1 }))).error);
    });
});

describe('tienda del servidor: comprar', () => {
    let orig; let saldo; let compras; let rolesDados;
    beforeEach(() => {
        orig = { find: ServidorConfig.findOne, agg: CompraTienda.aggregate, create: CompraTienda.create, en: economia.en, rt: [RolTemporal.findOne, RolTemporal.findOneAndUpdate, RolTemporal.deleteMany] };
        saldo = 500; compras = []; rolesDados = [];
        ServidorConfig.findOne = () => ({ lean: async () => cfg });
        CompraTienda.aggregate = async () => { const n = compras.filter((c) => !c.devuelta).length; return n ? [{ _id: 'a1', n }] : []; };
        CompraTienda.create = async (d) => { compras.push(d); return d; };
        RolTemporal.findOne = () => ({ lean: async () => null });
        RolTemporal.findOneAndUpdate = async () => null;
        RolTemporal.deleteMany = async () => null;
        economia.en = () => ({
            cobrar: async (_u, n) => { await new Promise((r) => setTimeout(r, 5)); if (saldo < n) return null; saldo -= n; return saldo; },
            darOro: async (_u, n) => { saldo += n; return saldo; },
            obtenerUsuario: async () => ({ balance: saldo }),
        });
    });
    afterEach(() => {
        ServidorConfig.findOne = orig.find; CompraTienda.aggregate = orig.agg; CompraTienda.create = orig.create; economia.en = orig.en;
        [RolTemporal.findOne, RolTemporal.findOneAndUpdate, RolTemporal.deleteMany] = orig.rt;
    });
    const miembro = (id, falla = false) => ({ id, roles: { cache: new Collection(), add: async (r) => { if (falla) throw new Error('no'); rolesDados.push([id, r]); } } });

    it('cobra y da el rol', async () => {
        const r = await T.comprar(servidor(), miembro('U1'), 'a1');
        assert.ok(r.ok, r.error);
        assert.strictEqual(saldo, 400);
        assert.deepStrictEqual(rolesDados, [['U1', 'COLOR']]);
    });
    it('si no puede dar el rol, devuelve el oro', async () => {
        const r = await T.comprar(servidor(), miembro('U1', true), 'a1');
        assert.ok(!r.ok);
        assert.strictEqual(saldo, 500);
    });
    it('con 1 unidad y dos compras a la vez, solo una se lleva el rol', async () => {
        const g = servidor();
        const [a, b] = await Promise.all([T.comprar(g, miembro('U1'), 'a1'), T.comprar(g, miembro('U2'), 'a1')]);
        assert.deepStrictEqual([a.ok, b.ok].sort(), [false, true]);
        assert.strictEqual(rolesDados.length, 1);
        assert.strictEqual(saldo, 400);
    });
    it('sin oro suficiente no da nada', async () => {
        saldo = 50;
        const r = await T.comprar(servidor(), miembro('U1'), 'a1');
        assert.ok(!r.ok);
        assert.strictEqual(rolesDados.length, 0);
        assert.strictEqual(saldo, 50);
    });
});
