// ============================================================================
// Tests de la 1.9.15: opciones de la verificación (utils/puertaEntrada.js) y la
// aprobación del staff en tres modos (utils/preguntasEntrada.js). Sin Discord ni base
// de datos: miembros y canales de mentira.
// ============================================================================
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const puerta = require('../utils/puertaEntrada.js');
const preguntas = require('../utils/preguntasEntrada.js');
const { generarCaptcha } = require('../utils/captcha.js');
const RegistroEntrada = require('../models/RegistroEntrada.js');

const DIA = 86400000;
const ahora = Date.now();

// Un rol / miembro / servidor de mentira que apunta lo que se le hace.
function servidor({ editables = ['100000001', '100000002', '100000003', '100000004'] } = {}) {
    const roles = new Map(['100000001', '100000002', '100000003', '100000004', '100000005'].map((id) => [id, { id, managed: false, editable: editables.includes(id) }]));
    return { id: 'G1', name: 'Nébula', roles: { cache: roles }, channels: { cache: new Map() } };
}
function miembro(guild, { id = 'U1', roles = [], creada = ahora - 400 * DIA, avatar = 'abc', dentro = 3600000, bot = false, staff = false, kickable = true, moderatable = true } = {}) {
    const reg = { dados: [], quitados: [], dms: [], kicks: 0, timeouts: 0 };
    const cache = new Set(roles);
    const m = {
        id, guild, joinedTimestamp: ahora - dentro, kickable, moderatable,
        user: { id, username: `u${id}`, bot, avatar, createdTimestamp: creada },
        permissions: { has: () => staff },
        roles: {
            cache: { has: (r) => cache.has(r) },
            add: async (r) => { for (const x of [].concat(r)) { cache.add(x); reg.dados.push(x); } },
            remove: async (r) => { for (const x of [].concat(r)) { cache.delete(x); reg.quitados.push(x); } },
        },
        send: async (p) => { reg.dms.push(p.content); return {}; },
        kick: async () => { reg.kicks++; },
        timeout: async () => { reg.timeouts++; },
    };
    return { m, reg };
}

const registroOriginal = RegistroEntrada.create;
let apuntados;
beforeEach(() => { apuntados = []; RegistroEntrada.create = async (d) => { apuntados.push(d); return d; }; });
afterEach(() => { RegistroEntrada.create = registroOriginal; puerta._fallosCaptcha.clear(); puerta._recordados.clear(); });

describe('guardar las opciones (sanearOpciones)', () => {
    it('recorta a sus límites y deja solo valores válidos', () => {
        const o = puerta.sanearOpciones({ edadMinDias: 9999, esperaMinutos: -3, captchaLongitud: 99, captchaIntentos: 0, captchaMinutos: 'x', captchaFallo: 'banear', rolesExtra: ['123456', '123456', 'nope', '7891011'], rolNoVerificadoId: 'x', normasTexto: 'a'.repeat(5000), canalRegistroId: '55555' });
        assert.strictEqual(o.edadMinDias, 365);
        assert.strictEqual(o.esperaMinutos, 0);
        assert.strictEqual(o.captchaLongitud, 8);
        assert.strictEqual(o.captchaIntentos, 1);
        assert.strictEqual(o.captchaMinutos, 5);
        assert.strictEqual(o.captchaFallo, 'esperar');
        assert.deepStrictEqual(o.rolesExtra, ['123456', '7891011']);
        assert.strictEqual(o.rolNoVerificadoId, null);
        assert.strictEqual(o.normasTexto.length, 4000);
        assert.strictEqual(o.canalRegistroId, '55555');
        assert.strictEqual(o.recordatorio, true);
    });
    it('la expulsión cuenta desde que se enciende (y no se mueve al guardar otra cosa)', () => {
        const t0 = new Date('2026-01-01T00:00:00Z');
        const enc = puerta.sanearOpciones({ expulsarHoras: 24 }, {}, t0);
        assert.strictEqual(enc.expulsarDesde.getTime(), t0.getTime());
        const otra = puerta.sanearOpciones({ expulsarHoras: 48 }, enc, new Date('2026-02-01T00:00:00Z'));
        assert.strictEqual(otra.expulsarDesde.getTime(), t0.getTime());
        assert.strictEqual(puerta.sanearOpciones({ expulsarHoras: 0 }, enc).expulsarDesde, null);
    });
});

describe('requisitos para verificarse (requisitoQueFalla)', () => {
    const g = servidor();
    it('sin requisitos, nada', () => {
        assert.strictEqual(puerta.requisitoQueFalla(miembro(g, { creada: ahora - DIA, avatar: null, dentro: 1000 }).m, { idioma: 'es' }), null);
    });
    it('cuenta demasiado nueva, sin foto o sin esperar, por ese orden y diciendo cuándo podrá', () => {
        const cfg = { idioma: 'es', opcionesEntrada: { edadMinDias: 7, exigirAvatar: true, esperaMinutos: 10 } };
        const nueva = puerta.requisitoQueFalla(miembro(g, { creada: ahora - 2 * DIA, avatar: null, dentro: 1000 }).m, cfg, ahora);
        assert.strictEqual(nueva.tipo, 'edad');
        assert.match(nueva.texto, /7 días/);
        assert.match(nueva.texto, /<t:\d+:R>/);
        assert.strictEqual(puerta.requisitoQueFalla(miembro(g, { avatar: null, dentro: 1000 }).m, cfg, ahora).tipo, 'avatar');
        assert.strictEqual(puerta.requisitoQueFalla(miembro(g, { dentro: 60000 }).m, cfg, ahora).tipo, 'espera');
        assert.strictEqual(puerta.requisitoQueFalla(miembro(g, { dentro: 11 * 60000 }).m, cfg, ahora), null);
    });
});

describe('aprobación del staff en tres modos', () => {
    const conCanal = (pe) => ({ idioma: 'es', preguntasEntrada: { canalRevisionId: '999999', ...pe } });
    const vieja = { id: 'U', avatar: 'a', createdTimestamp: ahora - 400 * DIA };
    const nueva = { id: 'U', avatar: 'a', createdTimestamp: ahora - 2 * DIA };
    it('lo de antes (un sí/no) sigue igual: sí = todos, no = nadie', () => {
        assert.strictEqual(puerta.modoAprobacion({ preguntasEntrada: { aprobacion: true } }), 'siempre');
        assert.strictEqual(puerta.modoAprobacion({ preguntasEntrada: {} }), 'nunca');
        assert.strictEqual(puerta.modoAprobacion({ preguntasEntrada: { aprobacion: true, aprobacionModo: 'nunca' } }), 'nunca');
    });
    it('«nunca» o sin canal del staff: nadie espera', () => {
        assert.strictEqual(preguntas.requiereAprobacion(conCanal({ aprobacionModo: 'nunca' }), nueva), false);
        assert.strictEqual(preguntas.requiereAprobacion({ preguntasEntrada: { aprobacionModo: 'siempre' } }, vieja), false);
        assert.strictEqual(preguntas.aprobacionActiva(conCanal({ aprobacionModo: 'nunca' })), false);
    });
    it('«siempre»: todos esperan', () => {
        assert.strictEqual(preguntas.requiereAprobacion(conCanal({ aprobacionModo: 'siempre' }), vieja), true);
    });
    it('«solo los sospechosos»: cuenta nueva, sin foto o una respuesta marcada', () => {
        const cfg = conCanal({ aprobacionModo: 'sospechosos', revisarCuentaDias: 7, revisarSinAvatar: true, preguntas: [{ id: 'edad', opciones: [{ id: 'menor', revisar: true }, { id: 'mayor' }] }] });
        assert.strictEqual(preguntas.requiereAprobacion(cfg, vieja, { edad: ['mayor'] }), false);
        assert.strictEqual(preguntas.requiereAprobacion(cfg, nueva, {}), true);
        assert.strictEqual(preguntas.requiereAprobacion(cfg, { ...vieja, avatar: null }, {}), true);
        assert.strictEqual(preguntas.requiereAprobacion(cfg, vieja, { edad: ['menor'] }), true);
        assert.deepStrictEqual(puerta.motivosRevision(cfg, { ...nueva, avatar: null }, { edad: ['menor'] }), ['cuenta', 'avatar', 'respuesta']);
        assert.match(puerta.textoMotivos(cfg, ['cuenta', 'avatar'], nueva), /cuenta nueva \(2 días\) · sin foto de perfil/);
    });
    it('se puede quitar cada criterio', () => {
        const cfg = conCanal({ aprobacionModo: 'sospechosos', revisarCuentaDias: 0, revisarSinAvatar: false });
        assert.deepStrictEqual(puerta.motivosRevision(cfg, { ...nueva, avatar: null }, {}), []);
    });
    it('la marca «revisar» de una respuesta se guarda', () => {
        const [q] = preguntas.sanearPreguntas([{ texto: '¿Edad?', opciones: [{ etiqueta: '-18', revisar: true }, { etiqueta: '+18', revisar: 'no' }] }]);
        assert.strictEqual(q.opciones[0].revisar, true);
        assert.strictEqual(q.opciones[1].revisar, true); // cualquier valor «verdadero»
        const [q2] = preguntas.sanearPreguntas([{ texto: 'x', opciones: [{ etiqueta: 'a' }] }]);
        assert.strictEqual(q2.opciones[0].revisar, false);
    });
});

describe('captcha: letras, intentos y qué pasa al fallarlos', () => {
    it('el código tiene las letras elegidas (4-8)', () => {
        for (const n of [4, 6, 8]) assert.strictEqual(generarCaptcha(n).codigo.length, n);
        assert.strictEqual(generarCaptcha(99).codigo.length, 8);
        assert.strictEqual(generarCaptcha().codigo.length, 5);
    });
    it('cuenta los intentos y, al acabarse, hay que esperar', () => {
        const cfg = { opcionesEntrada: { captchaIntentos: 3 } };
        assert.strictEqual(puerta.contarFalloCaptcha('G1', 'U1', cfg).quedan, 2);
        assert.strictEqual(puerta.contarFalloCaptcha('G1', 'U1', cfg).quedan, 1);
        assert.strictEqual(puerta.captchaEsperaHasta('G1', 'U1'), 0);
        assert.strictEqual(puerta.contarFalloCaptcha('G1', 'U1', cfg).quedan, 0);
        assert.ok(puerta.captchaEsperaHasta('G1', 'U1') > Date.now());
        puerta.limpiarCaptcha('G1', 'U1');
        assert.strictEqual(puerta.captchaEsperaHasta('G1', 'U1'), 0);
    });
    it('aislar o expulsar solo si el bot puede (si no, esperar) y se apunta', async () => {
        const g = servidor();
        const { m, reg } = miembro(g);
        const cfg = { idioma: 'es', opcionesEntrada: { captchaFallo: 'expulsar' } };
        assert.strictEqual(await puerta.castigarCaptcha(m, cfg), 'expulsar');
        assert.strictEqual(reg.kicks, 1);
        assert.strictEqual(reg.dms.length, 1);
        assert.strictEqual(apuntados.at(-1).tipo, 'captcha_fallido');
        const { m: m2, reg: reg2 } = miembro(g, { kickable: false });
        assert.strictEqual(puerta.accionCaptcha(m2, cfg), 'esperar');
        assert.strictEqual(await puerta.castigarCaptcha(m2, cfg), 'esperar');
        assert.strictEqual(reg2.kicks, 0);
        const { m: m3, reg: reg3 } = miembro(g);
        assert.strictEqual(await puerta.castigarCaptcha(m3, { opcionesEntrada: { captchaFallo: 'aislar' } }), 'aislar');
        assert.strictEqual(reg3.timeouts, 1);
    });
});

describe('al verificarse (trasVerificarse) y al entrar (alEntrar)', () => {
    it('roles de más, quitar «Sin verificar», privado con variables y registro', async () => {
        const g = servidor();
        const { m, reg } = miembro(g, { roles: ['100000004', '100000003'] });
        const cfg = { idioma: 'es', opcionesEntrada: { rolesExtra: ['100000002', '100000003'], rolNoVerificadoId: '100000004', dmActivo: true, mensajeDM: 'Hola {user}, ya estás en {server}' } };
        const r = await puerta.trasVerificarse(m, cfg, { via: 'manual', detalle: 'alex' });
        assert.strictEqual(r.fallo, false);
        assert.deepStrictEqual(reg.dados, ['100000002']); // EXTRA2 ya lo tenía
        assert.deepStrictEqual(reg.quitados, ['100000004']);
        assert.deepStrictEqual(reg.dms, ['Hola <@U1>, ya estás en Nébula']);
        assert.deepStrictEqual({ tipo: apuntados[0].tipo, detalle: apuntados[0].detalle }, { tipo: 'manual', detalle: 'alex' });
    });
    it('un rol que el bot no puede dar se avisa (fallo) y no se intenta', async () => {
        const g = servidor({ editables: ['100000001'] });
        const { m, reg } = miembro(g);
        const r = await puerta.trasVerificarse(m, { opcionesEntrada: { rolesExtra: ['100000005'] } });
        assert.strictEqual(r.fallo, true);
        assert.deepStrictEqual(reg.dados, []);
        assert.strictEqual(reg.dms.length, 0); // sin dmActivo no se manda nada
    });
    it('el «¡Listo!» personalizado', () => {
        assert.strictEqual(puerta.textoExito({ opcionesEntrada: { mensajeExito: '¡Bienvenido {user} a {server}!' } }, { name: 'Nébula' }, { id: 'U1' }), '¡Bienvenido <@U1> a Nébula!');
        assert.strictEqual(puerta.textoExito({}, { name: 'x' }, { id: 'U1' }), null);
    });
    it('«Sin verificar» al entrar, solo si hay verificación encendida', async () => {
        const g = servidor();
        const cfg = { opcionesEntrada: { rolNoVerificadoId: '100000004' }, verificacion: { activo: true, rolVerificadoId: '100000001' } };
        const { m, reg } = miembro(g);
        assert.strictEqual(await puerta.alEntrar(m, cfg), true);
        assert.deepStrictEqual(reg.dados, ['100000004']);
        const { m: m2, reg: reg2 } = miembro(g);
        assert.strictEqual(await puerta.alEntrar(m2, { ...cfg, verificacion: { activo: false } }), false);
        assert.deepStrictEqual(reg2.dados, []);
        const { m: bot } = miembro(g, { bot: true });
        assert.strictEqual(await puerta.alEntrar(bot, cfg), false);
    });
});

describe('quien no se verifica (quienesSinVerificar)', () => {
    const g = servidor();
    const desde = new Date(ahora - 10 * DIA);
    const cfg = { verificacion: { activo: true, rolVerificadoId: '100000001' }, opcionesEntrada: { expulsarHoras: 24, expulsarDesde: desde, recordatorio: true } };
    it('expulsa a quien pasó el plazo, avisa a mitad y respeta al resto', () => {
        const fuera = miembro(g, { id: 'A', dentro: 25 * 3600000 }).m;
        const mitad = miembro(g, { id: 'B', dentro: 12.2 * 3600000 }).m;
        const pasadoLaMitad = miembro(g, { id: 'J', dentro: 18 * 3600000 }).m; // ya se le avisó antes de un reinicio
        const conOtroAcceso = miembro(g, { id: 'K', dentro: 30 * 3600000, roles: ['100000009'] }).m; // se verificó con la doble bienvenida
        const reciente = miembro(g, { id: 'C', dentro: 3600000 }).m;
        const verificado = miembro(g, { id: 'D', dentro: 30 * 3600000, roles: ['100000001'] }).m;
        const staff = miembro(g, { id: 'E', dentro: 30 * 3600000, staff: true }).m;
        const esperando = miembro(g, { id: 'F', dentro: 30 * 3600000 }).m;
        const deAntes = miembro(g, { id: 'H', dentro: 20 * DIA }).m; // entró antes de encender la opción
        const bot = miembro(g, { id: 'I', dentro: 30 * 3600000, bot: true }).m;
        const r = puerta.quienesSinVerificar([fuera, mitad, pasadoLaMitad, conOtroAcceso, reciente, verificado, staff, esperando, deAntes, bot], { ...cfg, embudoAB: { activo: false, rolVerificadoId: '100000009' } }, { ahora, pendientes: new Set(['F']) });
        assert.deepStrictEqual(r.expulsar.map((m) => m.id), ['A']);
        assert.deepStrictEqual(r.recordar.map((m) => m.id), ['B']);
    });
    it('sin verificación encendida, sin rol de acceso o sin plazo: nadie', () => {
        const m = miembro(g, { dentro: 30 * 3600000 }).m;
        assert.deepStrictEqual(puerta.quienesSinVerificar([m], { ...cfg, verificacion: { activo: false, rolVerificadoId: '100000001' } }, { ahora }).expulsar, []);
        assert.deepStrictEqual(puerta.quienesSinVerificar([m], { ...cfg, opcionesEntrada: { expulsarHoras: 0 } }, { ahora }).expulsar, []);
        assert.deepStrictEqual(puerta.quienesSinVerificar([m], { ...cfg, opcionesEntrada: { expulsarHoras: 24 } }, { ahora }).expulsar, []); // sin «desde»
    });
});

describe('arreglos de la revisión (1.9.15)', () => {
    it('el rol «Sin verificar» nunca es un rol de acceso (ni se da ni se quita)', async () => {
        const g = servidor();
        const cfg = { opcionesEntrada: { rolNoVerificadoId: '100000001' }, verificacion: { activo: true, rolVerificadoId: '100000001' } };
        assert.strictEqual(puerta.rolSinVerificar(cfg), null);
        const { m, reg } = miembro(g);
        assert.strictEqual(await puerta.alEntrar(m, cfg), false);
        assert.deepStrictEqual(reg.dados, []);
        const { m: m2, reg: reg2 } = miembro(g, { roles: ['100000001'] });
        await puerta.trasVerificarse(m2, cfg);
        assert.deepStrictEqual(reg2.quitados, []);
    });
    it('sin el rol de acceso no cuenta como verificado (ni privado ni registro)', async () => {
        const g = servidor({ editables: ['100000002'] }); // el de acceso no se puede dar
        const { m, reg } = miembro(g, { id: '100000077' });
        g.members = { fetch: async () => m };
        const client = { guilds: { cache: new Map([['G1', g]]) } };
        const cfg = { idioma: 'es', verificacion: { activo: true, rolVerificadoId: '100000001' }, opcionesEntrada: { dmActivo: true } };
        const r = await preguntas.concederEntrada(client, { gid: 'G1', cfg, userId: m.id, respuestas: {}, origen: 'verif' });
        assert.strictEqual(r.fallo, true);
        assert.strictEqual(reg.dms.length, 0);
        assert.strictEqual(apuntados.length, 0);
    });
    it('los intentos fallados del captcha se olvidan a la hora', () => {
        const cfg = { opcionesEntrada: { captchaIntentos: 3 } };
        puerta.contarFalloCaptcha('G1', 'U9', cfg);
        assert.strictEqual(puerta.contarFalloCaptcha('G1', 'U9', cfg).quedan, 1);
        puerta._fallosCaptcha.get('G1:U9').ultimo = Date.now() - 2 * 3600000;
        assert.strictEqual(puerta.contarFalloCaptcha('G1', 'U9', cfg).quedan, 2);
    });
});

