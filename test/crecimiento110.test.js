// ============================================================================
// Crecimiento 1.10.0: temporadas, Red Sokyo, referidos, votos de top.gg y eventos
// nativos de Discord. Lógica pura y, donde toca la BD, con los modelos simulados.
// ============================================================================
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { PermissionsBitField, ChannelType, GuildScheduledEventEntityType, Collection } = require('discord.js');

const temporadas = require('../utils/temporadas.js');
const red = require('../utils/redSokyo.js');
const referidos = require('../utils/referidos.js');
const votos = require('../utils/votos.js');
const eventosDiscord = require('../utils/eventosDiscord.js');

describe('temporadas', () => {
    it('la mensual acaba el día 1 del mes siguiente (UTC)', () => {
        assert.strictEqual(temporadas.finDeTemporada(new Date('2026-11-21T13:00:00Z')).toISOString(), '2026-12-01T00:00:00.000Z');
        assert.strictEqual(temporadas.finDeTemporada(new Date('2026-12-31T23:59:00Z')).toISOString(), '2027-01-01T00:00:00.000Z');
    });
    it('la semanal acaba el lunes siguiente; un lunes, el de la semana que viene', () => {
        assert.strictEqual(temporadas.finDeTemporada(new Date('2026-11-21T13:00:00Z'), 'semanal').toISOString(), '2026-11-23T00:00:00.000Z'); // sábado
        assert.strictEqual(temporadas.finDeTemporada(new Date('2026-11-23T08:00:00Z'), 'semanal').toISOString(), '2026-11-30T00:00:00.000Z'); // lunes
        assert.strictEqual(temporadas.finDeTemporada(new Date('2026-11-22T23:00:00Z'), 'semanal').toISOString(), '2026-11-23T00:00:00.000Z'); // domingo
    });
    it('los premios siempre son 3 enteros válidos', () => {
        assert.deepStrictEqual(temporadas.oroPodio([500, '200', -5, 9]), [500, 200, 0]);
        assert.deepStrictEqual(temporadas.oroPodio(null), [0, 0, 0]);
        assert.deepStrictEqual(temporadas.oroPodio([1e12]), [10000000, 0, 0]);
    });
});

describe('Red Sokyo', () => {
    const receptor = (extra = {}) => ({ guildId: 'A', idioma: 'es', crecimiento: { red: { mismoIdioma: true, vistos: [], ...extra } } });
    const c = (guildId, idioma, mostrado) => ({ guildId, idioma, mostrado });

    it('nunca se publica a sí mismo y respeta el idioma', () => {
        assert.strictEqual(red.elegirCandidato(receptor(), [c('A', 'es', 0), c('B', 'en', 0)]), null);
        assert.strictEqual(red.elegirCandidato(receptor({ mismoIdioma: false }), [c('A', 'es', 0), c('B', 'en', 0)]).guildId, 'B');
    });
    it('elige al que menos veces ha salido y no repite los últimos', () => {
        const lista = [c('B', 'es', 5), c('C', 'es', 1), c('D', 'es', 1)];
        assert.strictEqual(red.elegirCandidato(receptor(), lista, () => 0).guildId, 'C');
        assert.strictEqual(red.elegirCandidato(receptor({ vistos: ['C'] }), lista, () => 0).guildId, 'D');
    });
    it('si ya salieron todos, vale cualquiera menos el último', () => {
        const lista = [c('B', 'es', 0), c('C', 'es', 0)];
        assert.strictEqual(red.elegirCandidato(receptor({ vistos: ['B', 'C'] }), lista, () => 0).guildId, 'B');
        assert.strictEqual(red.elegirCandidato(receptor({ vistos: ['C', 'B'] }), lista, () => 0).guildId, 'C');
    });
    it('solo sale en los demás quien publica y tiene página en el directorio', () => {
        const pagina = { activo: true, listado: true, slug: 'nebula' };
        assert.strictEqual(red.esVisible({ crecimiento: { red: { activo: true, canalId: '1' }, pagina } }), true);
        assert.strictEqual(red.esVisible({ crecimiento: { red: { activo: true, canalId: null }, pagina } }), false);
        assert.strictEqual(red.esVisible({ crecimiento: { red: { activo: true, canalId: '1' }, pagina: { ...pagina, listado: false } } }), false);
    });
    it('cada cuánto: entre 6 h y una semana', () => {
        assert.strictEqual(red.horasEntre(1), 6);
        assert.strictEqual(red.horasEntre(999), 168);
        assert.strictEqual(red.horasEntre('x'), 24);
    });
});

describe('referidos', () => {
    const ahora = Date.parse('2026-11-21T12:00:00Z');
    const guild = { id: 'G', ownerId: 'DUENO', joinedTimestamp: ahora - 2 * 86400000 };
    const admin = { id: 'ADMIN', permissions: new PermissionsBitField([PermissionsBitField.Flags.ManageGuild]) };
    const codigo = { referidorId: 'AMIGO', destinoGuildId: 'OTRO' };
    const err = (x) => referidos.errorCanje({ codigoDoc: codigo, guild, member: admin, yaCanjeado: false, ahora, ...x });

    it('un canje normal vale', () => assert.strictEqual(err({}), null));
    it('rechaza códigos que no existen, sin permiso o propios', () => {
        assert.strictEqual(err({ codigoDoc: null }), 'no_existe');
        assert.strictEqual(err({ member: { id: 'X', permissions: new PermissionsBitField() } }), 'sin_permiso');
        assert.strictEqual(err({ codigoDoc: { referidorId: 'ADMIN' } }), 'propio');
        assert.strictEqual(err({ codigoDoc: { referidorId: 'DUENO' } }), 'propio');
    });
    it('rechaza el mismo servidor de destino, segundos canjes y canjes tardíos', () => {
        assert.strictEqual(err({ codigoDoc: { referidorId: 'AMIGO', destinoGuildId: 'G' } }), 'mismo_servidor');
        assert.strictEqual(err({ yaCanjeado: true }), 'ya_canjeado');
        assert.strictEqual(err({ guild: { ...guild, joinedTimestamp: ahora - 15 * 86400000 } }), 'tarde');
    });
    it('los códigos usan letras que no se confunden', () => {
        const cod = referidos.generarCodigo();
        assert.match(cod, /^[A-HJ-NP-Z2-9]{6}$/);
        assert.strictEqual(referidos.normalizarCodigo(' ab-c 12 '), 'ABC12');
    });

    describe('días de Premium', () => {
        const ServidorConfig = require('../models/ServidorConfig.js');
        const billing = require('../utils/billing.js');
        let cfg, activado, orig;
        beforeEach(() => {
            orig = { findOne: ServidorConfig.findOne, activarPlan: billing.activarPlan };
            activado = null;
            ServidorConfig.findOne = async () => cfg;
            billing.activarPlan = async (gid, datos) => { activado = { gid, ...datos }; };
        });
        afterEach(() => { ServidorConfig.findOne = orig.findOne; billing.activarPlan = orig.activarPlan; });

        it('a un servidor Free le da Pro durante 7 días', async () => {
            cfg = { esPremium: false, plan: 'free', premiumHasta: null };
            assert.strictEqual(await referidos.sumarDiasPremium('G', 7), true);
            assert.strictEqual(activado.plan, 'pro');
            assert.ok(Math.abs(activado.premiumHasta.getTime() - (Date.now() + 7 * 86400000)) < 5000);
        });
        it('si ya tiene Premium con fecha, lo alarga sin cambiar el plan', async () => {
            const hasta = new Date(Date.now() + 3 * 86400000);
            cfg = { esPremium: true, plan: 'agency', premiumHasta: hasta };
            assert.strictEqual(await referidos.sumarDiasPremium('G', 7), true);
            assert.strictEqual(activado.plan, 'agency');
            assert.strictEqual(activado.premiumHasta.getTime(), hasta.getTime() + 7 * 86400000);
        });
        it('no toca suscripciones de Stripe ni Premium de por vida', async () => {
            cfg = { esPremium: true, plan: 'pro', premiumHasta: new Date(Date.now() + 86400000), stripeSubscriptionId: 'sub_1' };
            assert.strictEqual(await referidos.sumarDiasPremium('G', 7), false);
            cfg = { esPremium: true, plan: 'pro', premiumHasta: null };
            assert.strictEqual(await referidos.sumarDiasPremium('G', 7), false);
            assert.strictEqual(activado, null);
        });
    });
});

describe('votos de top.gg', () => {
    const Voto = require('../models/Voto.js');
    const ServidorConfig = require('../models/ServidorConfig.js');
    const economia = require('../utils/economia.js');
    let orig, creados, oro, existe;
    beforeEach(() => {
        orig = { exists: Voto.exists, create: Voto.create, find: ServidorConfig.find, darOro: economia.darOro, env: process.env.TOPGG_WEBHOOK_AUTH };
        creados = []; oro = []; existe = false;
        Voto.exists = async () => existe;
        Voto.create = async (d) => { creados.push(d); return d; };
        ServidorConfig.find = async () => [];
        economia.darOro = async (id, n) => { oro.push([id, n]); };
    });
    afterEach(() => {
        Object.assign(Voto, { exists: orig.exists, create: orig.create });
        ServidorConfig.find = orig.find; economia.darOro = orig.darOro;
        if (orig.env === undefined) delete process.env.TOPGG_WEBHOOK_AUTH; else process.env.TOPGG_WEBHOOK_AUTH = orig.env;
    });

    it('la clave del webhook se comprueba y sin clave no se acepta nada', () => {
        delete process.env.TOPGG_WEBHOOK_AUTH;
        assert.strictEqual(votos.autorizacionValida('lo-que-sea'), false);
        process.env.TOPGG_WEBHOOK_AUTH = 'secreto-largo';
        assert.strictEqual(votos.autorizacionValida('secreto-largo'), true);
        assert.strictEqual(votos.autorizacionValida('secreto-larg0'), false);
        assert.strictEqual(votos.autorizacionValida(undefined), false);
    });
    it('lee el cuerpo de top.gg y descarta lo que no es un usuario', () => {
        assert.deepStrictEqual(votos.leerVoto({ user: '123456789012345678', type: 'upvote', isWeekend: true }), { userId: '123456789012345678', finde: true, prueba: false });
        assert.strictEqual(votos.leerVoto({ user: 'abc' }), null);
        assert.strictEqual(votos.leerVoto(null), null);
    });
    it('un voto da oro (el doble en fin de semana) y se apunta', async () => {
        const r = await votos.procesarVoto({ guilds: { cache: new Collection() } }, { userId: '1', finde: false });
        assert.deepStrictEqual(r, { estado: 'ok', oro: 300, servidores: 0 });
        await votos.procesarVoto({ guilds: { cache: new Collection() } }, { userId: '2', finde: true });
        assert.deepStrictEqual(oro, [['1', 300], ['2', 600]]);
        assert.strictEqual(creados.length, 2);
    });
    it('los reintentos de top.gg y los votos de prueba no premian', async () => {
        existe = true;
        assert.strictEqual((await votos.procesarVoto({}, { userId: '1' })).estado, 'repetido');
        assert.strictEqual((await votos.procesarVoto({}, { userId: '1', prueba: true })).estado, 'prueba');
        assert.deepStrictEqual(oro, []);
    });
    it('el mensaje de gracias rellena sus variables', () => {
        const txt = votos.rellenar('{mention} {user} {gold}{extra} {next} {server}', { userId: '9', nombre: 'Alex', oro: 12000, extra: ' y 50 XP', proximo: new Date(1700000000000), servidor: 'Nébula' });
        assert.strictEqual(txt, '<@9> Alex 12.000 y 50 XP <t:1700000000:R> Nébula');
    });
});

describe('eventos nativos de Discord', () => {
    const voz = { id: 'V', type: ChannelType.GuildVoice };
    const escenario = { id: 'S', type: ChannelType.GuildStageVoice };
    const guild = { channels: { cache: new Collection([['V', voz], ['S', escenario]]) } };
    const inicio = new Date('2026-12-01T18:00:00Z');

    it('externo: lleva lugar y hora de fin', () => {
        const { opciones } = eventosDiscord.opcionesDiscord({ titulo: 'Quedada', tipo: 'externo', lugar: 'Madrid', duracionMin: 90, fechaInicio: inicio }, guild);
        assert.strictEqual(opciones.entityType, GuildScheduledEventEntityType.External);
        assert.strictEqual(opciones.entityMetadata.location, 'Madrid');
        assert.strictEqual(opciones.scheduledEndTime.toISOString(), '2026-12-01T19:30:00.000Z');
    });
    it('voz y escenario necesitan su tipo de canal', () => {
        assert.ok(eventosDiscord.opcionesDiscord({ titulo: 'x', tipo: 'voz', canalVozId: null, fechaInicio: inicio }, guild).error);
        assert.ok(eventosDiscord.opcionesDiscord({ titulo: 'x', tipo: 'voz', canalVozId: 'S', fechaInicio: inicio }, guild).error);
        assert.strictEqual(eventosDiscord.opcionesDiscord({ titulo: 'x', tipo: 'voz', canalVozId: 'V', fechaInicio: inicio }, guild).opciones.channel, 'V');
        assert.strictEqual(eventosDiscord.opcionesDiscord({ titulo: 'x', tipo: 'escenario', canalVozId: 'S', fechaInicio: inicio }, guild).opciones.entityType, GuildScheduledEventEntityType.StageInstance);
    });
    it('explica el permiso que falta', () => {
        assert.match(eventosDiscord.errorDiscord({ code: 50013 }), /Gestionar eventos/);
    });
});
