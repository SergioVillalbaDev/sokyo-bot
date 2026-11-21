// ============================================================================
// Setup rápido (1.11.0) y opciones nuevas de las funciones de crecimiento:
// bloqueos de la Red, roles peligrosos y roles que no compiten en las temporadas.
// ============================================================================
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { ChannelType, PermissionsBitField, Collection } = require('discord.js');
const setup = require('../utils/setupRapido.js');

const F = PermissionsBitField.Flags;
const G = '900000000000000001';

// Servidor de Discord simulado: guarda los canales que se crean.
function servidor({ permisosBot = [F.ManageChannels, F.ManageMessages, F.ModerateMembers, F.ViewChannel, F.SendMessages], canales = [] } = {}) {
    const cache = new Collection(canales.map((c) => [c.id, c]));
    let n = 0;
    const guild = {
        id: G, name: 'Prueba', systemChannelId: null,
        members: { me: { id: '555', permissions: new PermissionsBitField(permisosBot) } },
        roles: { cache: new Collection([['700000000000000001', { id: '700000000000000001', name: 'Staff', managed: false }]]) },
        channels: {
            cache,
            create: async (opc) => {
                const c = { id: `80000000000000000${++n}`, name: opc.name, type: opc.type, opc };
                cache.set(c.id, c);
                return c;
            },
        },
    };
    return guild;
}

describe('setup rápido · respuestas', () => {
    const guild = servidor({ canales: [{ id: '100000000000000001', type: ChannelType.GuildText, name: 'general' }] });
    it('exige idioma y tipo', () => {
        assert.ok(setup.validar({ tipo: 'gaming' }, guild).error);
        assert.ok(setup.validar({ idioma: 'es', tipo: 'nada' }, guild).error);
    });
    it('sin módulos usa los recomendados del tipo y descarta los que no existen', () => {
        assert.deepStrictEqual(setup.validar({ idioma: 'es', tipo: 'soporte' }, guild).respuestas.modulos, setup.recomendados('soporte'));
        assert.deepStrictEqual(setup.validar({ idioma: 'en', tipo: 'gaming', modulos: ['niveles', 'hackear', 'niveles'] }, guild).respuestas.modulos, ['niveles']);
    });
    it('los canales son automáticos, nuevos o uno de texto que exista', () => {
        const r = setup.validar({ idioma: 'es', tipo: 'gaming', canales: { bienvenida: '100000000000000001', registro: 'nuevo' } }, guild).respuestas;
        assert.strictEqual(r.canales.bienvenida, '100000000000000001');
        assert.strictEqual(r.canales.registro, 'nuevo');
        assert.strictEqual(r.canales.anuncios, 'auto');
        assert.ok(setup.validar({ idioma: 'es', tipo: 'gaming', canales: { bienvenida: '999999999999999999' } }, guild).error);
    });
    it('el rol del staff tiene que existir', () => {
        assert.strictEqual(setup.validar({ idioma: 'es', tipo: 'gaming', rolStaffId: '700000000000000001' }, guild).respuestas.rolStaffId, '700000000000000001');
        assert.ok(setup.validar({ idioma: 'es', tipo: 'gaming', rolStaffId: G }, guild).error); // @everyone
    });
    it('dice qué permisos le faltan al bot', () => {
        const r = setup.validar({ idioma: 'es', tipo: 'soporte' }, guild).respuestas;
        assert.deepStrictEqual(setup.permisosQueFaltan(servidor({ permisosBot: [] }), r), ['ManageChannels', 'ManageMessages', 'ModerateMembers']);
        assert.deepStrictEqual(setup.permisosQueFaltan(servidor(), r), []);
    });
    it('una pasada por servidor y minuto', () => {
        setup._reiniciarLimite();
        assert.strictEqual(setup.puedePasar('A', 1000), true);
        assert.strictEqual(setup.puedePasar('A', 30000), false);
        assert.strictEqual(setup.puedePasar('B', 30000), true);
        assert.strictEqual(setup.puedePasar('A', 62000), true);
    });
});

describe('setup rápido · canales', () => {
    it('reutiliza el canal con el mismo nombre en vez de duplicarlo', async () => {
        const guild = servidor({ canales: [{ id: '100000000000000009', type: ChannelType.GuildText, name: '📋・registro-sokyo' }] });
        const r = await setup.canalDe(guild, 'registro', 'es', { privado: true });
        assert.strictEqual(r.creado, false);
        assert.strictEqual(r.canal.id, '100000000000000009');
    });
    it('el de registro nuevo es privado: @everyone no lo ve y el staff sí', async () => {
        const guild = servidor();
        const { canal, creado } = await setup.canalDe(guild, 'registro', 'en', { privado: true, rolStaffId: '700000000000000001' });
        assert.strictEqual(creado, true);
        assert.strictEqual(canal.name, '📋・sokyo-log');
        const todos = canal.opc.permissionOverwrites.find((p) => p.id === G);
        assert.deepStrictEqual(todos.deny, [F.ViewChannel]);
        assert.ok(canal.opc.permissionOverwrites.some((p) => p.id === '700000000000000001'));
    });
});

describe('setup rápido · aplicar', () => {
    const ServidorConfig = require('../models/ServidorConfig.js');
    const panelTickets = require('../utils/panelTickets.js');
    const textos = require('../utils/textosPorDefecto.js');
    let cambios, doc, orig;
    beforeEach(() => {
        cambios = {};
        doc = new ServidorConfig({ guildId: G });
        orig = { findOne: ServidorConfig.findOne, create: ServidorConfig.create, updateOne: ServidorConfig.updateOne, publicar: panelTickets.publicarPanelTickets, adaptar: textos.adaptarTextosAlIdioma };
        ServidorConfig.findOne = async () => doc;
        ServidorConfig.updateOne = async (f, u) => { Object.assign(cambios, u.$set); for (const [k, v] of Object.entries(u.$set)) doc.set(k, v); };
        panelTickets.publicarPanelTickets = async () => ({});
        textos.adaptarTextosAlIdioma = async () => ({});
    });
    afterEach(() => {
        Object.assign(ServidorConfig, { findOne: orig.findOne, create: orig.create, updateOne: orig.updateOne });
        panelTickets.publicarPanelTickets = orig.publicar; textos.adaptarTextosAlIdioma = orig.adaptar;
    });

    it('deja un servidor de soporte funcionando: idioma, registro privado, bienvenidas, automod y tickets', async () => {
        const guild = servidor();
        const { respuestas } = setup.validar({ idioma: 'es', tipo: 'soporte', rolStaffId: '700000000000000001', modulos: ['bienvenidas', 'registro', 'automod', 'tickets'] }, guild);
        const r = await setup.aplicar({}, guild, respuestas);
        assert.deepStrictEqual(r.pasos.map((p) => `${p.id}:${p.estado}`), ['idioma:ok', 'staff:ok', 'registro:ok', 'bienvenidas:ok', 'automod:ok', 'tickets:ok']);
        assert.strictEqual(cambios.idioma, 'es');
        assert.strictEqual(cambios.rolStaffId, '700000000000000001');
        assert.strictEqual(cambios['bienvenida.activo'], true);
        assert.strictEqual(cambios['automod.estafas.accion'], 'borrar', 'el automod del setup nunca banea');
        assert.ok(cambios.categoriaTicketsId);
        assert.deepStrictEqual(r.creados.map((c) => c.nombre), ['📋・registro-sokyo', '👋・bienvenida', '🎫 Tickets', '🎫・soporte']);
    });
    it('no pisa un automod que ya estaba configurado', async () => {
        doc.set('automod.activo', true);
        doc.set('automod.spam.accion', 'ban');
        const guild = servidor();
        const { respuestas } = setup.validar({ idioma: 'en', tipo: 'gaming', modulos: ['automod'] }, guild);
        const r = await setup.aplicar({}, guild, respuestas);
        assert.strictEqual(r.pasos.find((p) => p.id === 'automod').estado, 'omitido');
        assert.strictEqual(cambios['automod.spam.accion'], undefined);
    });
    it('1.17.0: sugerencias, salón de la fama, bromas y clanes de una vez', async () => {
        const guild = servidor();
        const { respuestas } = setup.validar({ idioma: 'es', tipo: 'comunidad', modulos: ['sugerencias', 'salon', 'bromas', 'clanes'] }, guild);
        const r = await setup.aplicar({}, guild, respuestas);
        assert.deepStrictEqual(r.pasos.map((p) => `${p.id}:${p.estado}`), ['idioma:ok', 'sugerencias:ok', 'salon:ok', 'bromas:ok', 'clanes:ok']);
        assert.ok(cambios.canalSugerencias);
        assert.strictEqual(cambios['salonFama.activo'], true);
        assert.strictEqual(cambios['bromas.activo'], true);
        assert.strictEqual(cambios['bromas.tipos.payaso.activo'], false, 'sin rol de payaso, esa broma se queda apagada');
        assert.strictEqual(cambios['clanes.activo'], true);
        assert.deepStrictEqual(r.creados.map((c) => c.nombre), ['💡・sugerencias', '⭐・salon-de-la-fama']);
    });
    it('«Activar» una sola cosa no toca el idioma', async () => {
        const guild = servidor();
        const v = setup.validar({ uno: true, modulos: ['bromas'] }, guild);
        assert.ok(v.respuestas.uno);
        const r = await setup.aplicar({}, guild, v.respuestas);
        assert.deepStrictEqual(r.pasos.map((p) => p.id), ['bromas']);
        assert.strictEqual(cambios.idioma, undefined);
        assert.ok(setup.validar({ uno: true, modulos: ['bromas', 'clanes'] }, guild).error, 'solo una cosa');
        assert.ok(setup.validar({ uno: true, modulos: ['nada'] }, guild).error);
    });
    it('el freno de «uno» es de 3 s por cosa y no bloquea el setup completo', () => {
        setup._reiniciarLimite();
        assert.strictEqual(setup.puedePasar('A', 1000, 'bromas'), true);
        assert.strictEqual(setup.puedePasar('A', 2000, 'bromas'), false);
        assert.strictEqual(setup.puedePasar('A', 2000, 'clanes'), true);
        assert.strictEqual(setup.puedePasar('A', 5000, 'bromas'), true);
        assert.strictEqual(setup.puedePasar('A', 5000), true);
    });
    it('cada tipo recomienda cosas que existen', () => {
        for (const lista of Object.values(setup.TIPOS)) for (const m of lista) assert.ok(setup.MODULOS.includes(m), m);
        for (const m of setup.MODULOS) assert.ok(setup.NOMBRE_PASO[m], m);
    });
    it('un fallo en un paso no para los demás', async () => {
        const guild = servidor();
        guild.channels.create = async () => { const e = new Error('Missing Permissions'); e.code = 50013; throw e; };
        const { respuestas } = setup.validar({ idioma: 'es', tipo: 'gaming', modulos: ['bienvenidas', 'niveles'] }, guild);
        const r = await setup.aplicar({}, guild, respuestas);
        assert.strictEqual(r.pasos.find((p) => p.id === 'bienvenidas').estado, 'error');
        assert.strictEqual(r.pasos.find((p) => p.id === 'niveles').estado, 'ok');
    });
});

describe('opciones nuevas de seguridad', () => {
    const { errorRolPeligroso, rolesQueDaElBot } = require('../utils/permisos.js');
    it('un rol con permisos de staff no se reparte automáticamente', () => {
        assert.ok(errorRolPeligroso({ name: 'Mod', permissions: new PermissionsBitField([F.BanMembers]) }));
        assert.ok(errorRolPeligroso({ name: 'Admin', permissions: new PermissionsBitField([F.Administrator]) }));
        assert.strictEqual(errorRolPeligroso({ name: 'Votante', permissions: new PermissionsBitField([F.SendMessages, F.AttachFiles]) }), null);
    });
    it('los roles de votar y de campeón cuentan como «roles que da el bot»', () => {
        const ids = rolesQueDaElBot({ crecimiento: { votos: { rolId: '1' } }, temporadas: { rolCampeonId: '2' } });
        assert.ok(ids.includes('1') && ids.includes('2'));
    });
    it('Red: bloqueos en los dos sentidos, mínimo de miembros y temas', () => {
        const { elegirCandidato } = require('../utils/redSokyo.js');
        const rec = (red) => ({ guildId: 'A', idioma: 'es', crecimiento: { red: { mismoIdioma: true, vistos: [], ...red } } });
        const c = (guildId, extra = {}) => ({ guildId, idioma: 'es', mostrado: 0, miembros: 100, etiquetas: [], bloqueados: [], ...extra });
        assert.strictEqual(elegirCandidato(rec({ bloqueados: ['B'] }), [c('B')]), null);
        assert.strictEqual(elegirCandidato(rec({}), [c('B', { bloqueados: ['A'] })]), null, 'si B bloqueó a A, B no sale en A');
        assert.strictEqual(elegirCandidato(rec({ minMiembros: 500 }), [c('B'), c('C', { miembros: 900 })]).guildId, 'C');
        assert.strictEqual(elegirCandidato(rec({ etiquetas: ['Minecraft'] }), [c('B', { etiquetas: ['anime'] }), c('C', { etiquetas: ['minecraft'] })]).guildId, 'C');
    });
    it('Temporadas: el staff excluido y quien se fue no compiten', async () => {
        const ActividadUsuario = require('../models/ActividadUsuario.js');
        const temporadas = require('../utils/temporadas.js');
        const orig = ActividadUsuario.find;
        ActividadUsuario.find = () => ({ sort: () => ({ limit: () => ({ select: () => ({ lean: async () => [
            { userId: 'staff', xpTemporada: 900 }, { userId: 'ido', xpTemporada: 800 }, { userId: 'ana', xpTemporada: 500 }, { userId: 'leo', xpTemporada: 100 }] }) }) }) });
        const miembro = (roles) => ({ user: { bot: false }, roles: { cache: new Collection(roles.map((r) => [r, { id: r }])) } });
        const guild = { members: { cache: new Collection([['staff', miembro(['ROL_STAFF'])], ['ana', miembro([])], ['leo', miembro([])]]), fetch: async () => null } };
        try {
            const lista = await temporadas.ranking(G, 10, { guild, excluir: ['ROL_STAFF'] });
            assert.deepStrictEqual(lista.map((f) => f.userId), ['ana', 'leo']);
        } finally { ActividadUsuario.find = orig; }
    });
});
