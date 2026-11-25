// Tienda del servidor (2.0.0, utils/tiendaServidor.js): solo roles cosméticos, el oro se
// cobra con puerta atómica y se devuelve si falla el rol, y el stock no se vende dos veces.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { PermissionsBitField, Collection } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const CompraTienda = require('../models/CompraTienda.js');
const RolTemporal = require('../models/RolTemporal.js');
const ContadorTienda = require('../models/ContadorTienda.js');
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
    it('nunca un rol que da el bot: acceso de la doble bienvenida, preguntas al entrar, premios de nivel…', () => {
        for (const extra of [{ embudoAB: { rolVerificadoId: 'COLOR' } }, { preguntasEntrada: { preguntas: [{ opciones: [{ rolId: 'COLOR' }] }] } }, { recompensasNivel: [{ rolId: 'COLOR' }] }, { crecimiento: { votos: { rolId: 'COLOR' } } }]) {
            assert.ok(T.errorRol(g, g.roles.cache.get('COLOR'), { ...cfg, ...extra }), JSON.stringify(extra));
        }
    });
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
        orig = { find: ServidorConfig.findOne, cf: ContadorTienda.find, cu: ContadorTienda.updateOne, create: CompraTienda.create, en: economia.en, rt: [RolTemporal.findOne, RolTemporal.findOneAndUpdate, RolTemporal.deleteMany] };
        saldo = 500; compras = []; rolesDados = [];
        ServidorConfig.findOne = () => ({ lean: async () => cfg });
        let vendidosA1 = 0;
        ContadorTienda.find = () => ({ lean: async () => (vendidosA1 ? [{ productoId: 'a1', vendidos: vendidosA1 }] : []) });
        ContadorTienda.updateOne = async () => { vendidosA1++; };
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
        ServidorConfig.findOne = orig.find; ContadorTienda.find = orig.cf; ContadorTienda.updateOne = orig.cu; CompraTienda.create = orig.create; economia.en = orig.en;
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
    it('si ya lo tiene para siempre, no cobra ni pone fecha de caducidad', async () => {
        const conRol = miembro('U1'); conRol.roles.cache.set('COLOR', {});
        const r = await T.comprar(servidor(), conRol, 'a1');
        assert.ok(!r.ok); assert.strictEqual(saldo, 500);
    });
    it('si lo tiene por días, puede comprar la versión para siempre', async () => {
        const conRol = miembro('U1'); conRol.roles.cache.set('COLOR', {});
        RolTemporal.findOne = () => ({ lean: async () => ({ expiraEn: new Date(Date.now() + 86400000) }) });
        const r = await T.comprar(servidor(), conRol, 'a1');
        assert.ok(r.ok, r.error); assert.strictEqual(saldo, 400);
    });
    it('sin oro suficiente no da nada', async () => {
        saldo = 50;
        const r = await T.comprar(servidor(), miembro('U1'), 'a1');
        assert.ok(!r.ok);
        assert.strictEqual(rolesDados.length, 0);
        assert.strictEqual(saldo, 50);
    });
});

describe('cumpleaños sin trampas', () => {
    const { puedeCambiar } = require('../utils/cumpleanos.js');
    const DIA = 86400000;
    it('se corrige el mismo día; después, solo pasados 180 días', () => {
        const ahora = Date.now();
        assert.ok(puedeCambiar(null, 5, 5, ahora).ok);
        assert.ok(puedeCambiar({ dia: 1, mes: 1, fijadoEn: new Date(ahora - 3600000) }, 5, 5, ahora).ok);
        assert.strictEqual(puedeCambiar({ dia: 1, mes: 1, fijadoEn: new Date(ahora - 2 * DIA) }, 5, 5, ahora).ok, false);
        assert.ok(puedeCambiar({ dia: 1, mes: 1, fijadoEn: new Date(ahora - 181 * DIA) }, 5, 5, ahora).ok);
        assert.ok(puedeCambiar({ dia: 5, mes: 5, fijadoEn: new Date(ahora - 2 * DIA) }, 5, 5, ahora).ok, 'la misma fecha no es un cambio');
    });
});

describe('topes de los premios en oro', () => {
    const L = require('../utils/limites.js');
    it('nada de premios de un millón', () => {
        assert.strictEqual(L.topeOro('cumpleanos.oro', 1000000), 2000);
        assert.strictEqual(L.topeOro('clanes.premioOro', -5), 0);
        assert.strictEqual(L.topeOro('crecimiento.votos.oroExtra', 'abc'), 0);
        assert.deepStrictEqual(require('../utils/temporadas.js').oroPodio([1e9, 300, null]), [5000, 300, 0]);
    });
});

describe('freno a las subidas de imágenes', () => {
    const LS = require('../utils/limiteSubidas.js');
    it('20 por hora y 100 MB al día por persona', () => {
        LS._reiniciar();
        for (let i = 0; i < 20; i++) assert.strictEqual(LS.permitir('u:1', 1000, { ahora: 1e12 + i }), null);
        assert.ok(LS.permitir('u:1', 1000, { ahora: 1e12 + 30 }));
        assert.strictEqual(LS.permitir('u:2', 1000, { ahora: 1e12 }), null, 'otra persona no se ve afectada');
        assert.strictEqual(LS.permitir('u:1', 1000, { ahora: 1e12 + 3600001 }), null, 'a la hora vuelve a poder');
        LS._reiniciar();
        for (let i = 0; i < 12; i++) LS.permitir('u:3', 8 * 1024 * 1024, { ahora: 1e12 + i * 3600001 });
        assert.ok(LS.permitir('u:3', 8 * 1024 * 1024, { ahora: 1e12 + 13 * 3600001 }), 'más de 100 MB en un día');
    });
});
