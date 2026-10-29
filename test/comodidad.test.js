// ============================================================================
// Tests de las comodidades de la 1.8.0: historial de cambios, copiar ajustes a
// otro servidor, recordatorios, música (votos, letra, cola), diagnóstico, la
// ayuda por categorías, los errores explicados y las novedades.
// Solo la parte pura, con objetos falsos con la forma mínima de discord.js.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { Collection, PermissionsBitField } = require('discord.js');

const { diferencias, guildDeLaPeticion } = require('../utils/historialCambios.js');
const { remapearIds } = require('../utils/copiarConfig.js');
const { opcionesCuando } = require('../utils/recordatorios.js');
const { limpiarTitulo, votarSaltar, mensajeCola } = require('../utils/musicaExtra.js');
const { diagnosticar } = require('../utils/diagnostico.js');
const { mensajeAyuda, CATEGORIAS } = require('../utils/ayuda.js');
const { explicarError } = require('../utils/erroresDiscord.js');
const { mensajeNovedades, novedadesDe, NOVEDADES } = require('../utils/novedades.js');
const { version } = require('../package.json');

describe('historial de cambios', () => {
    it('solo cuenta los ajustes que cambian (no el plan ni los contadores)', () => {
        const antes = { prefijo: '!', bienvenida: { activo: false }, plan: 'free', iaUsos: 1 };
        const despues = { prefijo: '?', bienvenida: { activo: false }, plan: 'pro', iaUsos: 2 };
        assert.deepStrictEqual(diferencias(antes, despues), ['prefijo']);
    });
    it('un campo que aparece vacío no es un cambio', () => {
        assert.deepStrictEqual(diferencias({ a: 1 }, { a: 1, b: null }), []);
    });
    it('encuentra el servidor de la petición (ruta, query, cuerpo y copiar a otro)', () => {
        const id = '123456789012345678';
        assert.strictEqual(guildDeLaPeticion({ path: `/config/${id}/bienvenidas`, query: {}, body: {} }), id);
        assert.strictEqual(guildDeLaPeticion({ path: '/roles', query: { guildId: id }, body: {} }), id);
        assert.strictEqual(guildDeLaPeticion({ path: '/roles', query: {}, body: { guildId: id } }), id);
        assert.strictEqual(guildDeLaPeticion({ path: `/config/${id}/copiar`, query: {}, body: { destino: '223456789012345678' } }), '223456789012345678');
        assert.strictEqual(guildDeLaPeticion({ path: '/ping', query: {}, body: {} }), null);
    });
});

describe('copiar ajustes a otro servidor', () => {
    const servidor = (id, canales, roles) => ({
        id,
        channels: { cache: new Collection(canales.map((c) => [c.id, c])) },
        roles: { cache: new Collection(roles.map((r) => [r.id, r])) },
    });
    const origen = servidor('100000000000000001',
        [{ id: '200000000000000001', name: 'general', type: 0 }, { id: '200000000000000002', name: 'logs', type: 0 }],
        [{ id: '300000000000000001', name: 'Staff' }, { id: '300000000000000002', name: 'VIP' }]);
    const destino = servidor('100000000000000009', [{ id: '900000000000000001', name: 'General', type: 0 }], [{ id: '800000000000000001', name: 'staff' }]);

    it('cambia canales y roles por los del otro servidor con el mismo nombre', () => {
        const { cfg } = remapearIds({ bienvenida: { canalId: '200000000000000001', activo: true }, rolStaffId: '300000000000000001' }, origen, destino);
        assert.strictEqual(cfg.bienvenida.canalId, '900000000000000001');
        assert.strictEqual(cfg.bienvenida.activo, true);
        assert.strictEqual(cfg.rolStaffId, '800000000000000001');
    });
    it('lo que no existe allí se queda vacío y se avisa', () => {
        const { cfg, faltan } = remapearIds({ canalLogsId: '200000000000000002', autoRoles: ['300000000000000001', '300000000000000002'] }, origen, destino);
        assert.strictEqual(cfg.canalLogsId, null);
        assert.deepStrictEqual(cfg.autoRoles, ['800000000000000001']);
        assert.deepStrictEqual(faltan.map((f) => f.nombre).sort(), ['VIP', 'logs']);
    });
    it('quita de las listas lo que se queda sin rol y no copia mensajes del otro servidor', () => {
        const { cfg } = remapearIds({ recompensasNivel: [{ nivel: 5, rolId: '300000000000000002' }, { nivel: 10, rolId: '300000000000000001' }], verificacion: { mensajeId: '555555555555555555' } }, origen, destino);
        assert.deepStrictEqual(cfg.recompensasNivel, [{ nivel: 10, rolId: '800000000000000001' }]);
        assert.strictEqual(cfg.verificacion.mensajeId, null);
    });
    it('los identificadores de la base de datos y las fechas se copian tal cual', () => {
        const { Types } = require('mongoose');
        const id = new Types.ObjectId();
        const fecha = new Date('2026-01-01');
        const { cfg } = remapearIds({ urgencias: [{ _id: id, nombre: 'Urgent', nivel: 4 }], crecimiento: { bump: { proximoBump: fecha } } }, origen, destino);
        assert.ok(cfg.urgencias[0]._id instanceof Types.ObjectId);
        assert.strictEqual(String(cfg.urgencias[0]._id), String(id));
        assert.ok(cfg.crecimiento.bump.proximoBump instanceof Date);
    });
    it('los usuarios se quedan como están', () => {
        const { cfg } = remapearIds({ resumenDiario: { destinatarioId: '777777777777777777' } }, origen, destino);
        assert.strictEqual(cfg.resumenDiario.destinatarioId, '777777777777777777');
    });
});

describe('recordatorios: sugerencias de «cuándo»', () => {
    it('un tiempo válido sale primero, explicado', () => {
        const op = opcionesCuando('2h', 'es');
        assert.strictEqual(op[0].value, '2h');
        assert.match(op[0].name, /2h/);
    });
    it('un número solo se ofrece en minutos, horas y días', () => {
        assert.deepStrictEqual(opcionesCuando('15', 'en').slice(0, 3).map((o) => o.value), ['15m', '15h', '15d']);
    });
    it('sin escribir nada salen ideas y nunca más de 25', () => {
        const op = opcionesCuando('', 'es');
        assert.ok(op.length > 3 && op.length <= 25);
        for (const o of op) assert.ok(o.name.length <= 100 && o.value.length <= 100);
    });
});

describe('música', () => {
    it('limpia los añadidos de YouTube del título para buscar la letra', () => {
        assert.strictEqual(limpiarTitulo('Queen - Bohemian Rhapsody (Official Video Remastered)'), 'Queen - Bohemian Rhapsody');
        assert.strictEqual(limpiarTitulo('Bad Bunny ft. Drake - Mia [Lyric Video]'), 'Bad Bunny - Mia');
        assert.strictEqual(limpiarTitulo('Despacito'), 'Despacito');
    });

    const reproductor = (oyentes, pedidoPor = 'p1') => {
        const miembros = new Collection(oyentes.map((id) => [id, { id, user: { bot: false } }]));
        return {
            guildId: `g-${oyentes.length}-${pedidoPor}`, voiceChannelId: 'voz',
            queue: { current: { encoded: 'cancion-1', info: { title: 'x' }, requester: { id: pedidoPor } }, tracks: [] },
            _canal: { members: miembros },
        };
    };
    const miembro = (id, player, { admin = false } = {}) => ({
        id, permissions: { has: () => admin }, roles: { cache: new Map() },
        guild: { channels: { cache: new Map([['voz', player._canal]]) } },
    });

    it('con 1 o 2 personas escuchando se salta al momento', () => {
        const p = reproductor(['a', 'b']);
        assert.strictEqual(votarSaltar(p, miembro('a', p)).saltar, true);
    });
    it('quien pidió la canción o un admin saltan sin votar', () => {
        const p = reproductor(['p1', 'b', 'c', 'd']);
        assert.strictEqual(votarSaltar(p, miembro('p1', p)).saltar, true);
        assert.strictEqual(votarSaltar(p, miembro('c', p, { admin: true })).saltar, true);
    });
    it('con más gente hace falta la mitad de los que escuchan', () => {
        const p = reproductor(['p1', 'b', 'c', 'd', 'e'], 'p1');
        const v1 = votarSaltar(p, miembro('b', p));
        assert.strictEqual(v1.saltar, false);
        assert.strictEqual(v1.necesarios, 3);
        assert.strictEqual(votarSaltar(p, miembro('b', p)).votos, 1, 'votar dos veces no cuenta doble');
        assert.strictEqual(votarSaltar(p, miembro('c', p)).saltar, false);
        assert.strictEqual(votarSaltar(p, miembro('d', p)).saltar, true);
    });
    it('la cola va por páginas de 10 con sus botones', () => {
        const pista = (i) => ({ info: { title: `Canción ${i}`, duration: 60000 } });
        const player = { queue: { current: pista(0), tracks: Array.from({ length: 23 }, (_, i) => pista(i + 1)) } };
        const p0 = mensajeCola(player, 0, 'es');
        assert.strictEqual(p0.components.length, 1);
        assert.match(p0.embeds[0].data.footer.text, /Página 1 de 3/);
        const p2 = mensajeCola(player, 9, 'es'); // fuera de rango: la última
        assert.match(p2.embeds[0].data.footer.text, /Página 3 de 3/);
        assert.strictEqual(mensajeCola({ queue: { current: pista(0), tracks: [] } }, 0, 'es').components.length, 0);
    });
});

describe('diagnóstico', () => {
    const P = PermissionsBitField.Flags;
    const guild = ({ permisos = [P.Administrator], canales = [], roles = [], topeBot = 5 } = {}) => {
        const me = {
            permissions: new PermissionsBitField(permisos),
            roles: { highest: { position: topeBot } },
        };
        return {
            id: 'g1', members: { me },
            channels: { cache: new Collection(canales.map((c) => [c.id, { ...c, permissionsFor: () => new PermissionsBitField(c.permisos ?? [P.ViewChannel, P.SendMessages, P.EmbedLinks]) }])) },
            roles: { cache: new Collection(roles.map((r) => [r.id, r])) },
        };
    };
    const cliente = (g) => ({ guilds: { cache: new Map([[g.id, g]]) } });

    it('un canal borrado sale como error y se puede quitar con un botón', async () => {
        const g = guild();
        const r = await diagnosticar(cliente(g), 'g1', { rolStaffId: null, canalLogsId: '999' }, 'es');
        const p = r.problemas.find((x) => x.id === 'falta:canalLogsId');
        assert.ok(p);
        assert.strictEqual(p.nivel, 'error');
        assert.deepStrictEqual(p.arreglo, { accion: 'quitar', ruta: 'canalLogsId' });
    });
    it('un rol por encima del bot no se puede dar', async () => {
        const g = guild({ roles: [{ id: 'r1', name: 'VIP', position: 9, managed: false }] });
        const r = await diagnosticar(cliente(g), 'g1', { rolStaffId: 'x', autoRoles: ['r1'] }, 'es');
        assert.ok(r.problemas.some((x) => x.id === 'alto:autoRoles:r1'));
    });
    it('sin «Gestionar canales» avisa de los permisos que faltan', async () => {
        const g = guild({ permisos: [P.ViewChannel, P.SendMessages] });
        const r = await diagnosticar(cliente(g), 'g1', { rolStaffId: 'x' }, 'en');
        const p = r.problemas.find((x) => x.id === 'permisos');
        assert.ok(p);
        assert.match(p.detalle, /Manage channels/);
    });
    it('todo en orden: sin errores (los errores van antes que los avisos)', async () => {
        const g = guild({ canales: [{ id: 'c1', name: 'logs', type: 0 }], roles: [{ id: 'x', name: 'Staff', position: 1, managed: false }] });
        const r = await diagnosticar(cliente(g), 'g1', { rolStaffId: 'x', canalLogsId: 'c1' }, 'es');
        assert.strictEqual(r.problemas.filter((x) => x.nivel === 'error').length, 0);
        assert.ok(r.comprobados > 5);
    });
});

describe('ayuda por categorías', () => {
    it('cada categoría cabe en un mensaje de Discord', () => {
        for (const idioma of ['es', 'en']) {
            for (const cat of [null, ...CATEGORIAS.map((c) => c.id)]) {
                const m = mensajeAyuda(idioma, '!', { categoria: cat });
                const e = m.embeds[0].data;
                assert.ok((e.description || '').length <= 4096);
                assert.ok((e.fields || []).length <= 25);
                for (const fila of m.components) assert.ok(fila.components.length <= 5);
                assert.ok(m.components[0].components[0].options.length <= 25);
            }
        }
    });
});

describe('errores explicados', () => {
    it('sin permisos: dice qué pasa y lleva al diagnóstico del panel', () => {
        const r = explicarError({ code: 50013 }, 'es');
        assert.ok(r.texto.length > 10);
        assert.strictEqual(r.tab, 'config-diagnostico');
    });
    it('un error cualquiera también tiene un texto amable', () => {
        const r = explicarError(new Error('boom'), 'en');
        assert.ok(r.texto.length > 10);
    });
});

describe('novedades', () => {
    it('la versión actual tiene novedades y el aviso cabe en Discord', () => {
        assert.ok(NOVEDADES[version], `faltan las novedades de la ${version} en utils/novedades.js`);
        const m = mensajeNovedades(version);
        assert.ok(m.length <= 2000);
        assert.ok(m.includes(version));
    });
    it('en inglés y en español, con su sección del panel', () => {
        const en = novedadesDe(version, 'en');
        const es = novedadesDe(version, 'es');
        assert.strictEqual(en.length, es.length);
        assert.ok(en.every((n) => n.texto && typeof n.texto === 'string'));
        assert.ok(es.some((n) => n.tab));
    });
});
