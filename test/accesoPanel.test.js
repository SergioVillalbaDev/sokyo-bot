// ============================================================================
// Quién puede entrar al panel y a qué partes (1.12.0, utils/accesoPanel.js): las mismas
// reglas que aplica la API al entrar y al guardar.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { AREAS, calcularAcceso, esCandidato } = require('../utils/accesoPanel.js');

const base = { roles: [], admin: false, gestionarCanales: false, moderarNativo: false, propietarioBot: false };
const cfg = { rolStaffId: 'STAFF', rolesPanelAcceso: ['PANEL'], rolesModeracion: ['MOD'], accesoAreas: { tickets: [], moderacion: ['MOD'], cuenta: ['JEFE'] } };

describe('acceso al panel', () => {
    it('sin rol ni permisos, no entra', () => {
        const r = calcularAcceso(base, cfg);
        assert.strictEqual(r.acceso, false);
        assert.ok(AREAS.every((a) => r.areas[a] === false));
        assert.strictEqual(r.moderar, false);
    });
    it('un administrador lo ve todo (y no sale además «Gestionar canales»)', () => {
        const r = calcularAcceso({ ...base, admin: true, gestionarCanales: true }, cfg);
        assert.deepStrictEqual(r.motivos, ['admin']);
        assert.ok(AREAS.every((a) => r.areas[a]));
        assert.strictEqual(r.moderar, true);
    });
    it('el propietario del bot también, aunque no tenga roles', () => {
        assert.ok(calcularAcceso({ ...base, propietarioBot: true }, cfg).areas.cuenta);
    });
    it('el rol de staff entra; las áreas con lista solo con su rol, las vacías para todos', () => {
        const r = calcularAcceso({ ...base, roles: ['STAFF'] }, cfg);
        assert.deepStrictEqual(r.motivos, ['rolStaff']);
        assert.strictEqual(r.areas.tickets, true);
        assert.strictEqual(r.areas.moderacion, false);
        assert.strictEqual(r.areas.cuenta, false);
        assert.strictEqual(r.moderar, false);
    });
    it('con el rol de moderación, modera y ve Moderación', () => {
        const r = calcularAcceso({ ...base, roles: ['PANEL', 'MOD'] }, cfg);
        assert.deepStrictEqual(r.motivos, ['rolAcceso']);
        assert.strictEqual(r.areas.moderacion, true);
        assert.strictEqual(r.moderar, true);
    });
    it('el rol de moderación SIN acceso al panel no da nada en el panel', () => {
        const r = calcularAcceso({ ...base, roles: ['MOD'] }, cfg);
        assert.strictEqual(r.acceso, false);
        assert.strictEqual(r.moderar, false);
    });
    it('«Gestionar canales» da acceso al panel', () => {
        assert.deepStrictEqual(calcularAcceso({ ...base, gestionarCanales: true }, cfg).motivos, ['gestionarCanales']);
    });
    it('solo se manda a quien entra o tiene un rol que se puede elegir', () => {
        assert.strictEqual(esCandidato({ ...base, roles: ['OTRO'] }, cfg), false);
        assert.strictEqual(esCandidato({ ...base, roles: ['PANEL'] }, cfg), true);
        assert.strictEqual(esCandidato({ ...base, admin: true }, cfg), true);
    });
});

describe('acceso dado a una persona (1.13.0)', () => {
    it('entra solo a las áreas que se le dieron (y a las abiertas a todos)', () => {
        const r = calcularAcceso(base, cfg, { areas: ['cuenta'], moderar: false, expiraEn: null });
        assert.deepStrictEqual(r.motivos, ['concedido']);
        assert.strictEqual(r.areas.cuenta, true, 'restringida a JEFE, pero se la dieron');
        assert.strictEqual(r.areas.tickets, true, 'lista vacía: abierta a todo el que entra');
        assert.strictEqual(r.areas.moderacion, false);
        assert.strictEqual(r.moderar, false);
    });
    it('puede moderar si se le dio', () => {
        assert.strictEqual(calcularAcceso(base, cfg, { areas: ['tickets'], moderar: true }).moderar, true);
    });
    it('un acceso caducado no cuenta', () => {
        const r = calcularAcceso(base, cfg, { areas: ['tickets'], expiraEn: new Date(Date.now() - 1000) });
        assert.strictEqual(r.acceso, false);
        assert.strictEqual(esCandidato(base, cfg, { areas: ['tickets'], expiraEn: new Date(Date.now() - 1000) }), false);
        assert.strictEqual(esCandidato(base, cfg, { areas: ['tickets'], expiraEn: new Date(Date.now() + 60000) }), true);
    });
});

describe('actividad del staff (1.13.0)', () => {
    const { resumir } = require('../utils/actividadStaff.js');
    const A = '111111111111111111', B = '222222222222222222', U = '333333333333333333';
    const t0 = new Date('2026-11-01T10:00:00Z');
    const min = (n) => new Date(t0.getTime() + n * 60000);
    it('cuenta tickets, primera respuesta, valoración y sanciones de cada uno', () => {
        const filas = resumir({
            tickets: [
                { canalId: 'T1', creadorId: U, asignadoA: A, estado: 'Cerrado', fechaCreacion: t0, valoracionCSAT: 5 },
                { canalId: 'T2', creadorId: U, asignadoA: A, estado: 'Abierto', fechaCreacion: t0, valoracionCSAT: 3 },
            ],
            mensajes: [
                { ticketId: 'T1', usuarioId: U, fecha: min(1) },       // quien lo abrió: no cuenta
                { ticketId: 'T1', usuarioId: A, fecha: min(10) },      // primera respuesta de A: 10 min
                { ticketId: 'T1', usuarioId: B, fecha: min(12) },
                { ticketId: 'T2', usuarioId: B, fecha: min(20) },      // primera respuesta de B: 20 min
                { ticketId: 'T2', usuarioId: 'sokyo-web', fecha: min(21) }, // sin persona: no cuenta
            ],
            sanciones: [{ moderadorId: B, accion: 'ban' }, { moderadorId: B, accion: 'aviso' }, { moderadorId: null, accion: 'ban' }],
        });
        const a = filas.find((f) => f.userId === A);
        const b = filas.find((f) => f.userId === B);
        assert.deepStrictEqual(a.tickets, { atendidos: 2, cerrados: 1, mensajes: 1, primeraRespuestaMin: 10, valoracion: 4 });
        assert.deepStrictEqual(b.tickets, { atendidos: 0, cerrados: 0, mensajes: 2, primeraRespuestaMin: 20, valoracion: null });
        assert.deepStrictEqual(b.sanciones, { total: 2, aviso: 1, timeout: 0, expulsion: 0, ban: 1 });
        assert.strictEqual(filas[0].userId, A, 'ordenado por puntos');
    });
});

describe('confirmación doble (1.13.0)', () => {
    const conf = require('../utils/confirmacionPanel.js');
    const G = '900000000000000001';
    const clienteCon = (puedeMd) => {
        const enviados = [];
        return {
            enviados,
            guilds: { cache: new Map([[G, { id: G, name: 'Nébula Gaming' }]]) },
            users: { fetch: async () => ({ send: async (txt) => { if (!puedeMd) throw new Error('DMs cerrados'); enviados.push(txt); } }) },
        };
    };
    const llamar = async (mw, { cabecera = null } = {}) => {
        let estado = 200, cuerpo = null, siguio = false;
        const req = { staff: { id: '444444444444444444' }, params: { guildId: G }, body: {}, query: {}, get: (h) => (h === 'x-sokyo-confirmacion' ? cabecera : null) };
        const res = { status(c) { estado = c; return this; }, json(c) { cuerpo = c; return this; } };
        await mw(req, res, () => { siguio = true; });
        return { estado, cuerpo, siguio };
    };
    it('sin código no hace nada: manda uno por privado y pide confirmar; con el bueno sigue', async () => {
        conf._pendientes.clear();
        const client = clienteCon(true);
        const mw = conf.crearExigeConfirmacion(client)('borrar-rol');
        const r1 = await llamar(mw);
        assert.strictEqual(r1.estado, 428);
        assert.strictEqual(r1.siguio, false);
        assert.strictEqual(r1.cuerpo.via, 'md');
        const codigo = client.enviados[0].match(/\*\*(\d{6})\*\*/)[1];
        const mal = await llamar(mw, { cabecera: '000000' === codigo ? '111111' : '000000' });
        assert.strictEqual(mal.siguio, false);
        assert.strictEqual(mal.cuerpo.incorrecto, true);
        const bien = await llamar(mw, { cabecera: codigo });
        assert.strictEqual(bien.siguio, true);
        const otraVez = await llamar(mw, { cabecera: codigo });
        assert.strictEqual(otraVez.siguio, false, 'el código es de un solo uso');
    });
    it('con los privados cerrados se confirma escribiendo el nombre del servidor', async () => {
        conf._pendientes.clear();
        const mw = conf.crearExigeConfirmacion(clienteCon(false))('borrar-canal');
        const r1 = await llamar(mw);
        assert.strictEqual(r1.cuerpo.via, 'nombre');
        assert.strictEqual(r1.cuerpo.servidor, 'Nébula Gaming');
        assert.strictEqual((await llamar(mw, { cabecera: '  nébula gaming ' })).siguio, true);
    });
    it('tras 5 intentos fallidos el código deja de valer', () => {
        conf._pendientes.clear();
        conf._pendientes.set('k', { hash: conf._hash('123456'), expira: Date.now() + 60000, intentos: 0, via: 'md', nombre: '' });
        for (let i = 0; i < 5; i++) assert.strictEqual(conf.comprobar('k', '000000'), 'mal');
        assert.strictEqual(conf.comprobar('k', '123456'), 'nada');
    });
    it('con la API key (sin sesión de staff) no se pide', async () => {
        const mw = conf.crearExigeConfirmacion(clienteCon(true))('borrar-rol');
        let siguio = false;
        await mw({ params: {}, body: {}, query: {}, get: () => null }, {}, () => { siguio = true; });
        assert.strictEqual(siguio, true);
    });
});
