const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../utils/permisos.js');

// Miembro simulado: `flags` = permisos nativos de Discord, `roles` = ids de roles.
const miembro = ({ id = '1', flags = [], roles = [], owner = false } = {}) => ({
    id,
    guild: { ownerId: owner ? id : 'otro' },
    permissions: { has: (f) => flags.includes('Administrator') || flags.includes(f) },
    roles: { cache: new Map(roles.map(r => [r, { id: r, name: `rol-${r}` }])) }
});

test('catálogo: coherencia interna', () => {
    const grupos = new Set(P.GRUPOS.map(g => g.id));
    for (const p of P.PERMISOS) assert.ok(grupos.has(p.grupo), `${p.id} tiene grupo desconocido`);
    for (const s of P.SECCIONES) for (const r of s.requiere) assert.ok(P.TODOS.includes(r), `${s.id} exige un permiso que no existe: ${r}`);
    for (const lista of Object.values(P.HEREDADOS)) for (const id of lista) assert.ok(P.TODOS.includes(id), `HEREDADOS referencia ${id}`);
    assert.equal(new Set(P.TODOS).size, P.TODOS.length, 'ids duplicados');
});

test('los permisos de moderación son SOLO de Discord y nunca concedibles', () => {
    const mod = P.PERMISOS.filter(p => p.grupo === 'moderacion');
    assert.ok(mod.length >= 4);
    for (const p of mod) { assert.equal(p.soloDiscord, true); assert.ok(!P.CONCEDIBLES.includes(p.id)); assert.ok(p.nativos.length > 0); }
});

test('el propietario y el administrador lo tienen todo', () => {
    const dueno = P.calcularPermisos(miembro({ owner: true }), null);
    assert.equal(dueno.permisos.size, P.TODOS.length); assert.equal(dueno.rango, 'Propietario');
    const admin = P.calcularPermisos(miembro({ flags: ['Administrator'] }), null);
    assert.equal(admin.permisos.size, P.TODOS.length); assert.equal(admin.rango, 'Administrador');
});

test('quien no tiene permisos no tiene acceso', () => {
    const c = P.calcularPermisos(miembro(), { rolesPermisos: [] });
    assert.equal(c.permisos.size, 0); assert.equal(c.rango, 'Sin acceso');
    assert.equal(P.calcularPermisos(null, null).permisos.size, 0);
});

test('"Gestionar mensajes" da soporte básico pero no cerrar ni moderar', () => {
    const c = P.calcularPermisos(miembro({ flags: ['ManageMessages'] }), null);
    for (const id of ['tickets.ver', 'tickets.responder', 'tickets.reclamar']) assert.ok(c.permisos.has(id), id);
    for (const id of ['tickets.cerrar', 'metricas.ver', 'config.permisos', 'mod.ban', 'mod.kick']) assert.ok(!c.permisos.has(id), id);
    assert.equal(c.rango, 'Soporte');
});

test('SIN permiso de baneo en Discord => sin mod.ban, aunque el panel diga lo contrario', () => {
    const config = { rolesPermisos: [{ rolId: 'r1', permisos: ['mod.ban', 'mod.kick', 'tickets.cerrar'] }] };
    const c = P.calcularPermisos(miembro({ roles: ['r1'], flags: ['KickMembers'] }), config);
    assert.ok(!c.permisos.has('mod.ban'), 'mod.ban NO debe venir del panel');
    assert.ok(c.permisos.has('mod.kick'), 'mod.kick viene de Discord');
    assert.ok(c.permisos.has('tickets.cerrar'), 'tickets.cerrar sí viene del panel');
});

test('cada permiso de moderación depende de su flag de Discord', () => {
    const con = (f) => P.calcularPermisos(miembro({ flags: [f] }), null).permisos;
    assert.ok(con('BanMembers').has('mod.ban') && !con('BanMembers').has('mod.kick') && !con('BanMembers').has('mod.mute'));
    assert.ok(con('KickMembers').has('mod.kick') && !con('KickMembers').has('mod.ban'));
    assert.ok(con('ModerateMembers').has('mod.mute') && !con('ModerateMembers').has('mod.ban'));
    assert.equal(P.calcularPermisos(miembro({ flags: ['BanMembers'] }), null).rango, 'Moderador');
});

test('las concesiones por rol suman y registran su origen', () => {
    const config = { rolesPermisos: [{ rolId: 'r1', permisos: ['metricas.ver'] }, { rolId: 'r2', permisos: ['logs.ver'] }] };
    const c = P.calcularPermisos(miembro({ roles: ['r1', 'r2'] }), config);
    assert.deepEqual([...c.permisos].sort(), ['logs.ver', 'metricas.ver']);
    assert.equal(c.fuentes['metricas.ver'][0].tipo, 'rol');
});

test('concesiones inválidas se ignoran', () => {
    assert.deepEqual(P.concesionesDeRol({ rolesPermisos: [{ rolId: 'r', permisos: ['inventado', 'mod.ban', 'tickets.ver'] }] }, 'r'), ['tickets.ver']);
});

test('anti-escalada: solo puedes dar los permisos que tienes', () => {
    const { permitidos, rechazados } = P.sanitizarConcesion(['tickets.ver', 'metricas.ver', 'mod.ban', 'nada'], new Set(['tickets.ver']));
    assert.deepEqual(permitidos, ['tickets.ver']); assert.deepEqual(rechazados, ['metricas.ver']);
    assert.deepEqual(P.sanitizarConcesion('basura', new Set(P.TODOS)).permitidos, []);
});

test('el origen de un admin es compacto (no lista todos los flags)', () => {
    assert.equal(P.resumenFlags(['Administrator', 'ManageGuild']), 'Administrador');
    assert.equal(P.resumenFlags(['ManageGuild', 'ManageChannels', 'ManageMessages']), 'Gestionar servidor, Gestionar canales y 1 más');
});
