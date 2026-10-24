// ============================================================================
// Tests de las reglas de jerarquía para el staff del panel (utils/permisos.js):
// nadie puede usar a través del bot roles a su altura o por encima, ni repartir
// roles con permisos que él no tiene.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { PermissionsBitField } = require('discord.js');

const { errorJerarquiaStaff, errorRolesNuevos } = require('../utils/permisos.js');

const P = PermissionsBitField.Flags;
const rol = (id, name, position, permisos = []) => ({ id, name, position, permissions: new PermissionsBitField(permisos) });
const ROLES = {
    admin: rol('1', 'Admin', 1, [P.Administrator]), // colocado abajo por error
    vip: rol('2', 'VIP', 2),
    staff: rol('3', 'Staff', 5, [P.ManageRoles, P.KickMembers]),
    jefe: rol('4', 'Jefe', 8),
};
const miembro = (id, alto, permisos) => ({ id, roles: { highest: alto }, permissions: new PermissionsBitField(permisos) });
const MIEMBROS = {
    laura: miembro('100', ROLES.staff, [P.ManageRoles, P.KickMembers]),
    dueno: miembro('999', ROLES.vip, []),
};
const guild = {
    ownerId: '999',
    members: {
        fetch: async (id) => {
            const m = Object.values(MIEMBROS).find((x) => x.id === id);
            if (!m) throw new Error('Unknown Member');
            return m;
        },
    },
    roles: { cache: new Map(Object.values(ROLES).map((r) => [r.id, r])) },
};
const client = { guilds: { cache: new Map([['G', guild]]) } };
const laura = { id: '100', username: 'laura' };

describe('errorJerarquiaStaff', () => {
    it('deja usar roles por debajo y bloquea los de su altura o superiores', async () => {
        assert.strictEqual(await errorJerarquiaStaff(guild, laura, { roles: [ROLES.vip] }), null);
        assert.match(await errorJerarquiaStaff(guild, laura, { roles: [ROLES.staff] }), /por debajo de tu rol más alto/);
        assert.match(await errorJerarquiaStaff(guild, laura, { roles: [ROLES.jefe] }), /Jefe/);
    });
    it('al repartir, bloquea roles con permisos que no tiene aunque estén abajo', async () => {
        assert.strictEqual(await errorJerarquiaStaff(guild, laura, { roles: [ROLES.admin] }), null); // quitar/editar: solo jerarquía
        assert.match(await errorJerarquiaStaff(guild, laura, { roles: [ROLES.admin], repartir: true }), /permisos que tú no tienes: Admin/);
    });
    it('no deja dar permisos que no tiene', async () => {
        assert.strictEqual(await errorJerarquiaStaff(guild, laura, { permisos: ['KickMembers'] }), null);
        assert.match(await errorJerarquiaStaff(guild, laura, { permisos: ['Administrator'] }), /Administrator/);
    });
    it('el dueño del servidor y los propietarios del bot no tienen límite', async () => {
        assert.strictEqual(await errorJerarquiaStaff(guild, { id: '999' }, { roles: [ROLES.jefe], repartir: true }), null);
        assert.strictEqual(await errorJerarquiaStaff(guild, { id: '5', owner: true }, { roles: [ROLES.jefe] }), null);
        assert.strictEqual(await errorJerarquiaStaff(guild, null, { roles: [ROLES.jefe] }), null); // API key
    });
    it('quien no es miembro del servidor no puede', async () => {
        assert.match(await errorJerarquiaStaff(guild, { id: '7' }, { roles: [ROLES.vip] }), /No eres miembro/);
    });
});

describe('errorRolesNuevos', () => {
    it('solo mira los roles que se añaden', async () => {
        assert.strictEqual(await errorRolesNuevos(client, laura, 'G', ['4', '2'], ['4']), null);
        assert.match(await errorRolesNuevos(client, laura, 'G', ['4', '2'], []), /Jefe/);
    });
    it('reparte: un rol con Administrador colocado abajo no se puede añadir', async () => {
        assert.match(await errorRolesNuevos(client, laura, 'G', ['1'], []), /Admin/);
    });
    it('sin cambios o sin lista no hay nada que comprobar', async () => {
        assert.strictEqual(await errorRolesNuevos(client, laura, 'G', undefined, ['4']), null);
        assert.strictEqual(await errorRolesNuevos(client, laura, 'G', [], []), null);
    });
});
