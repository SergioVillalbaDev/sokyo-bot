// ============================================================================
// Tests de la verificación única (1.9.12): preguntas al entrar que dan roles y el
// rol de acceso al final (utils/preguntasEntrada.js), y «Cerrar el servidor»
// (utils/cierreServidor.js). Sin Discord ni MongoDB: objetos simulados.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { PermissionsBitField, Collection, ChannelType } = require('discord.js');
const pe = require('../utils/preguntasEntrada.js');
const cierre = require('../utils/cierreServidor.js');

const F = PermissionsBitField.Flags;
const PREGUNTAS = [
    { id: 'edad', texto: '¿Qué edad tienes?', opciones: [{ id: 'menor', etiqueta: '13-17', rolId: '111111' }, { id: 'mayor', etiqueta: '18+', rolId: '222222' }] },
    { id: 'juegos', texto: '¿A qué juegas?', multiple: true, obligatoria: false, opciones: [{ id: 'lol', etiqueta: 'LoL', emoji: '🎮', rolId: '333333', categoriaId: '900000' }, { id: 'mc', etiqueta: 'Minecraft', rolId: '444444' }] },
    { id: 'vacia', texto: 'Sin opciones', opciones: [] },
];
const cfg = { idioma: 'es', preguntasEntrada: { activo: true, preguntas: PREGUNTAS }, verificacion: { activo: true, rolVerificadoId: '555555', canalId: 'verif' } };

describe('preguntas al entrar', () => {
    it('solo cuentan las preguntas con texto y opciones', () => {
        assert.deepStrictEqual(pe.preguntasValidas(cfg).map((q) => q.id), ['edad', 'juegos']);
        assert.strictEqual(pe.hayPreguntas(cfg), true);
        assert.strictEqual(pe.hayPreguntas({ preguntasEntrada: { activo: false, preguntas: PREGUNTAS } }), false);
    });
    it('cada pantalla tiene su desplegable (varias respuestas si se permite) y «Saltar» si no es obligatoria', () => {
        const p0 = pe.pantallaPregunta('g1', cfg, 0);
        const menu0 = p0.components[0].components[0].data;
        assert.strictEqual(menu0.custom_id, 'entq:g1:0');
        assert.strictEqual(menu0.max_values, 1);
        assert.strictEqual(p0.components.length, 1, 'la primera no tiene «Atrás» ni «Saltar»');
        const p1 = pe.pantallaPregunta('g1', cfg, 1, ['lol']);
        assert.strictEqual(p1.components[0].components[0].data.max_values, 2);
        assert.strictEqual(p1.components[0].components[0].options[0].data.default, true, 'recuerda lo elegido al volver');
        assert.deepStrictEqual(p1.components[1].components.map((b) => b.data.custom_id), ['entq_atras:g1:1', 'entq_saltar:g1:1']);
        assert.match(p1.embeds[0].data.description, /Pregunta 2 de 2/);
    });
    it('los roles salen de lo respondido', () => {
        assert.deepStrictEqual(pe.rolesDeRespuestas(cfg, { edad: ['mayor'], juegos: ['lol', 'mc'] }), ['222222', '333333', '444444']);
        assert.deepStrictEqual(pe.rolesDeRespuestas(cfg, { edad: ['menor'], juegos: [] }), ['111111']);
        assert.strictEqual(pe.rolAcceso(cfg, 'verif'), '555555');
    });
    it('el panel no puede romper Discord: límites, ids únicos y roles válidos', () => {
        const s = pe.sanearPreguntas([{ id: 'a b!', texto: 'x'.repeat(300), opciones: [{ id: 'o', etiqueta: 'y'.repeat(150), rolId: 'no-es-id' }, { id: 'o', etiqueta: 'z', rolId: '123456' }] }, { id: 'ab' }]);
        assert.strictEqual(s[0].id, 'ab');
        assert.strictEqual(s[1].id, 'ab_2');
        assert.strictEqual(s[0].texto.length, 256);
        assert.strictEqual(s[0].opciones[0].etiqueta.length, 100);
        assert.deepStrictEqual(s[0].opciones.map((o) => o.id), ['o', 'o_2']);
        assert.deepStrictEqual(s[0].opciones.map((o) => o.rolId), [null, '123456']);
        assert.strictEqual(s[0].obligatoria, true);
    });
    it('emojis: normales y del servidor', () => {
        assert.strictEqual(pe.emojiDe('🎮'), '🎮');
        assert.deepStrictEqual(pe.emojiDe('<:pikachu:123456789>'), { id: '123456789', name: 'pikachu', animated: false });
        assert.strictEqual(pe.emojiDe(''), undefined);
    });
});

// Servidor simulado con @everyone, el rol de acceso y algunos canales.
function servidor() {
    const ediciones = [];
    const rol = (id, permisos) => ({
        id, permissions: new PermissionsBitField(permisos), editable: true,
        async setPermissions(p) { this.permissions = new PermissionsBitField(p); ediciones.push(['rol', id, this.permissions.has(F.ViewChannel)]); },
    });
    const everyone = rol('g1', [F.ViewChannel, F.SendMessages]);
    const acceso = rol('555555', [F.SendMessages]);
    const roles = new Collection([['g1', everyone], ['555555', acceso], ['333333', rol('333333', [])]]);
    const canal = (id, name, type, ows = {}, parent = null) => {
        const cache = new Collection(Object.entries(ows).map(([k, v]) => [k, { allow: new PermissionsBitField(v.allow || []), deny: new PermissionsBitField(v.deny || []) }]));
        const c = { id, name, type, parentId: parent, children: { cache: new Collection() },
            permissionOverwrites: { cache, async edit(target, cambios) { ediciones.push(['canal', id, target, cambios]); } },
            permissionsFor: () => new PermissionsBitField([F.ViewChannel]) };
        return c;
    };
    const canales = new Collection([
        ['verif', canal('verif', 'verificacion', ChannelType.GuildText)],
        ['reglas', canal('reglas', 'reglas', ChannelType.GuildText, { g1: { allow: [F.ViewChannel] } })],
        ['general', canal('general', 'general', ChannelType.GuildText)],
        ['900000', canal('900000', 'LoL', ChannelType.GuildCategory)],
    ]);
    return {
        id: 'g1', ediciones, roles: { cache: roles, everyone }, channels: { cache: canales },
        members: { me: { permissions: new PermissionsBitField([F.ManageRoles, F.ManageChannels]) } },
    };
}

describe('cerrar el servidor hasta verificarse', () => {
    it('el estado dice qué falta: abierto, el rol de acceso no ve y un canal abierto a @everyone', () => {
        const e = cierre.estadoCierre(servidor(), cfg);
        assert.strictEqual(e.cerrado, false);
        assert.strictEqual(e.accesoVe, false);
        assert.deepStrictEqual(e.abiertos.map((c) => c.id), ['reglas']);
        assert.deepStrictEqual(e.categorias, [{ rolId: '333333', categoriaId: '900000', existe: true }]);
    });
    it('cerrar: verificación visible, el rol de acceso ve, el canal abierto pasa al rol, la categoría del juego solo con su rol y @everyone deja de ver', async () => {
        const g = servidor();
        const { estado, fallos } = await cierre.cerrar(g, cfg);
        assert.deepStrictEqual(fallos, []);
        assert.strictEqual(estado.cerrado, true);
        assert.strictEqual(estado.accesoVe, true);
        const ed = g.ediciones;
        assert.ok(ed.some(([k, id, target, c]) => k === 'canal' && id === 'verif' && target === 'g1' && c.ViewChannel === true));
        assert.ok(ed.some(([k, id, target, c]) => k === 'canal' && id === 'reglas' && target === 'g1' && c.ViewChannel === null));
        assert.ok(ed.some(([k, id, target, c]) => k === 'canal' && id === 'reglas' && target === '555555' && c.ViewChannel === true));
        assert.ok(ed.some(([k, id, target, c]) => k === 'canal' && id === '900000' && target === 'g1' && c.ViewChannel === false));
        assert.ok(ed.some(([k, id, target, c]) => k === 'canal' && id === '900000' && target === '333333' && c.ViewChannel === true));
        // @everyone es lo último que se cierra (nunca queda nadie sin ver el canal de verificación).
        const iEveryone = ed.findIndex(([k, id]) => k === 'rol' && id === 'g1');
        assert.strictEqual(iEveryone, ed.length - 1);
    });
    it('sin rol de acceso o sin canal no toca nada', async () => {
        await assert.rejects(cierre.cerrar(servidor(), { verificacion: { activo: true, canalId: 'verif' } }), /sin-rol/);
        await assert.rejects(cierre.cerrar(servidor(), { verificacion: { activo: true, rolVerificadoId: '555555' } }), /sin-canal/);
    });
    it('abrir devuelve «Ver canales» a @everyone', async () => {
        const g = servidor();
        await cierre.cerrar(g, cfg);
        await cierre.abrir(g);
        assert.strictEqual(g.roles.everyone.permissions.has(F.ViewChannel), true);
    });
});
