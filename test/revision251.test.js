// Revisión 2.5.1: contador sin dobles, XP con espera atómica, menciones de los comandos, paneles de roles con roles
// quitados, sorteos que no se sortean dos veces y plantillas con «$».
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const Contador = require('../models/Contador.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const Sorteo = require('../models/Sorteo.js');
const economia = require('../utils/economia.js');
const { primeraMencion } = require('../utils/mencion.js');
const { toggleRol, aplicarSeleccionMenu } = require('../utils/rolePanelManager.js');

describe('primeraMencion: el que se escribe, no al que se responde', () => {
    const users = new Map([['111111111111111111', { id: '111111111111111111' }], ['222222222222222222', { id: '222222222222222222' }]]);
    it('respondiendo a B con «!ban @A», el objetivo es A', () => {
        const m = { content: '!ban <@222222222222222222> spam', mentions: { users } };
        assert.strictEqual(primeraMencion(m).id, '222222222222222222');
    });
    it('sin mención escrita (solo la de la respuesta) no hay objetivo', () => {
        assert.strictEqual(primeraMencion({ content: '!ban spam', mentions: { users } }), null);
    });
    it('vale con <@!id>', () => {
        assert.strictEqual(primeraMencion({ content: '!warn <@!111111111111111111>', mentions: { users } }).id, '111111111111111111');
    });
});

describe('paneles de roles: un rol quitado del panel ya no se da', () => {
    const miembro = () => {
        const tiene = new Set();
        return { id: 'U', tiene, roles: { cache: { has: (id) => tiene.has(id) }, add: async (x) => { for (const id of [].concat(x)) tiene.add(id); }, remove: async (x) => { for (const id of [].concat(x)) tiene.delete(id); } } };
    };
    const panel = { guildId: 'G', items: [{ roleId: 'A' }, { roleId: 'B' }] };
    it('un botón viejo de un rol que ya no está: nada', async () => {
        const m = miembro();
        assert.strictEqual(await toggleRol(m, panel, 'VIP'), 'fuera');
        assert.ok(!m.tiene.has('VIP'));
    });
    it('un menú viejo: solo se ponen los del panel', async () => {
        const m = miembro();
        const r = await aplicarSeleccionMenu(m, panel, ['A', 'VIP']);
        assert.deepStrictEqual([...m.tiene], ['A']);
        assert.strictEqual(r.puestos, 1);
    });
});

describe('contador: dos «5» a la vez no cuentan dos veces', () => {
    const orig = {};
    let estado; let oro;
    beforeEach(() => {
        orig.foau = Contador.findOneAndUpdate; orig.uo = Contador.updateOne; orig.fbi = Contador.findById; orig.en = economia.en;
        estado = { _id: 'C', numeroActual: 4, ultimoUserId: 'X', record: 10 };
        oro = 0;
        Contador.findOneAndUpdate = async (f, u) => {
            if (u.$setOnInsert) return { ...estado };
            if (f.numeroActual !== estado.numeroActual) return null;
            if (f.ultimoUserId && f.ultimoUserId.$ne === estado.ultimoUserId) return null;
            Object.assign(estado, u.$set);
            return { ...estado };
        };
        Contador.updateOne = async (f, u) => { Object.assign(estado, u.$set); };
        Contador.findById = () => ({ lean: async () => ({ ...estado }) });
        economia.en = () => ({ darOro: async (_, n) => { oro += n; } });
    });
    afterEach(() => { Contador.findOneAndUpdate = orig.foau; Contador.updateOne = orig.uo; Contador.findById = orig.fbi; economia.en = orig.en; });
    const msg = (autor, texto) => ({
        content: texto, guildId: 'G', author: { id: autor }, member: { id: autor }, guild: { id: 'G' },
        channel: { id: 'CANAL', send: async () => {} }, react: async () => {}, delete: async () => {},
    });
    const cfg = { dinamicas: { contador: { activo: true, canalId: 'CANAL', oro: 10, repetirUsuario: false } } };
    it('el primero cuenta y cobra; el segundo rompe la cuenta y no cobra', async () => {
        const { procesarMensaje } = require('../utils/dinamicas.js');
        await Promise.all([procesarMensaje(msg('A', '5'), cfg), procesarMensaje(msg('B', '5'), cfg)]);
        assert.strictEqual(oro, 10);
        assert.strictEqual(estado.numeroActual, 0);
    });
    it('la misma persona dos veces muy rápido: solo una', async () => {
        const { procesarMensaje } = require('../utils/dinamicas.js');
        await Promise.all([procesarMensaje(msg('A', '5'), cfg), procesarMensaje(msg('A', '5'), cfg)]);
        assert.strictEqual(oro, 10);
        assert.strictEqual(estado.numeroActual, 5);
    });
});

describe('XP por mensaje: la espera se reserva de una vez', () => {
    const orig = {};
    let doc; let veces;
    beforeEach(() => {
        orig.uo = ActividadUsuario.updateOne; orig.ex = ActividadUsuario.exists; orig.foau = ActividadUsuario.findOneAndUpdate;
        orig.vent = require('../utils/cofres.js').ventajasUsuario;
        // Lo que viene después de la reserva (sumar la XP) no se prueba aquí: que no espere a la base de datos.
        ActividadUsuario.findOneAndUpdate = async () => { throw new Error('sin BD'); };
        require('../utils/cofres.js').ventajasUsuario = async () => null;
        doc = { ultimoXp: null }; veces = 0;
        ActividadUsuario.updateOne = async (f, u) => {
            if (f.$or) {
                const libre = doc.ultimoXp === null || doc.ultimoXp < f.$or[1].ultimoXp.$lt;
                if (!libre) return { matchedCount: 0 };
                doc.ultimoXp = u.$set.ultimoXp; return { matchedCount: 1 };
            }
            return { matchedCount: 1, upsertedCount: 0 };
        };
        ActividadUsuario.exists = async () => true;
    });
    afterEach(() => { ActividadUsuario.updateOne = orig.uo; ActividadUsuario.exists = orig.ex; ActividadUsuario.findOneAndUpdate = orig.foau; require('../utils/cofres.js').ventajasUsuario = orig.vent; });
    it('cinco mensajes a la vez dan XP una sola vez', async () => {
        const niveles = require('../utils/niveles.js');
        // Se cuenta cuántas reservas de la espera entran (cada una da XP): con la puerta atómica, una.
        const m = { member: { id: 'U', roles: { cache: { has: () => false, some: () => false } } }, guild: { id: 'G' }, channel: { id: 'C' } };
        const cfg = { nivelesActivo: true, xpCooldownSeg: 60 };
        const orUo = ActividadUsuario.updateOne;
        ActividadUsuario.updateOne = async (f, u) => { const r = await orUo(f, u); if (f.$or && r.matchedCount) veces++; return r; };
        await Promise.all(Array.from({ length: 5 }, () => niveles.otorgarXp(m, cfg).catch(() => {})));
        assert.strictEqual(veces, 1);
    });
});

describe('sorteo: «Terminar» y el programador a la vez sortean una sola vez', () => {
    let orig;
    beforeEach(() => { orig = Sorteo.findOneAndUpdate; });
    afterEach(() => { Sorteo.findOneAndUpdate = orig; });
    it('si otro ya lo ha cerrado, no se vuelve a sortear', async () => {
        const { finalizarSorteo } = require('../utils/comunidad.js');
        Sorteo.findOneAndUpdate = async () => null;
        let guardado = false;
        const s = { _id: 'S', guildId: 'G', participantes: ['a'], ganadores: 1, activo: true, save: async () => { guardado = true; } };
        await finalizarSorteo({ guilds: { cache: new Map() }, channels: { fetch: async () => null } }, s);
        assert.strictEqual(guardado, false);
        assert.ok(!s.ganadoresSeleccionados);
    });
});

describe('plantillas con «$» en el texto', () => {
    it('un título con $$$ o un nombre con $& salen tal cual', () => {
        const { rellenar } = require('../utils/directos.js');
        assert.strictEqual(rellenar('🔴 {streamer}: {title}', { streamer: "$'", title: 'Gano $$$ hoy' }), "🔴 $': Gano $$$ hoy");
    });
});

describe('aplicarXp: la XP se suma en la base de datos', () => {
    it('usa $inc (dos sumas a la vez no se pisan) y no reescribe el total', async () => {
        const niveles = require('../utils/niveles.js');
        const orig = { foau: ActividadUsuario.findOneAndUpdate, uo: ActividadUsuario.updateOne, vent: require('../utils/cofres.js').ventajasUsuario };
        const vistos = [];
        let xp = 0;
        ActividadUsuario.findOneAndUpdate = async (f, u) => { vistos.push(u); xp += u.$inc.xp; return { xp, nivel: 0 }; };
        ActividadUsuario.updateOne = async () => ({});
        require('../utils/cofres.js').ventajasUsuario = async () => null;
        try {
            const member = { id: 'U', user: { username: 'u' } };
            await Promise.all([niveles.aplicarXp({ id: 'G' }, member, 5, { anuncioTipo: 'off' }, null), niveles.aplicarXp({ id: 'G' }, member, 7, { anuncioTipo: 'off' }, null)]);
            assert.strictEqual(xp, 12);
            assert.ok(vistos.every((u) => u.$inc && !('xp' in (u.$set || {}))));
        } finally {
            ActividadUsuario.findOneAndUpdate = orig.foau; ActividadUsuario.updateOne = orig.uo; require('../utils/cofres.js').ventajasUsuario = orig.vent;
        }
    });
});
