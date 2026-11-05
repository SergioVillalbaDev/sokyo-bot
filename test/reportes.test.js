// ============================================================================
// Tests de los reportes anónimos (1.9.12): el aviso del staff no dice quién
// reportó y «Ver quién reportó» solo funciona para administradores y los roles
// elegidos. utils/reportes.js → autorOculto, puedeVerAutor.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { PermissionsBitField } = require('discord.js');
const { autorOculto, puedeVerAutor } = require('../utils/reportes.js');

const miembro = ({ permisos = [], roles = [] } = {}) => ({
    permissions: new PermissionsBitField(permisos),
    roles: { cache: new Map(roles.map((id) => [id, { id }])) },
});
const F = PermissionsBitField.Flags;

describe('reportes: quién reportó', () => {
    it('por defecto se oculta (también en servidores sin el ajuste guardado)', () => {
        assert.strictEqual(autorOculto(null), true);
        assert.strictEqual(autorOculto({ reportes: { activo: true } }), true);
        assert.strictEqual(autorOculto({ reportes: { ocultarAutor: false } }), false);
    });
    it('lo ven los administradores y quien gestiona el servidor', () => {
        assert.strictEqual(puedeVerAutor(miembro({ permisos: [F.Administrator] }), {}), true);
        assert.strictEqual(puedeVerAutor(miembro({ permisos: [F.ManageGuild] }), {}), true);
    });
    it('un moderador normal no lo ve, salvo que su rol esté elegido', () => {
        const cfg = { reportes: { rolesVerAutor: ['jefe'] } };
        assert.strictEqual(puedeVerAutor(miembro({ permisos: [F.ModerateMembers, F.KickMembers] }), cfg), false);
        assert.strictEqual(puedeVerAutor(miembro({ permisos: [F.ModerateMembers], roles: ['jefe'] }), cfg), true);
        assert.strictEqual(puedeVerAutor(null, cfg), false);
    });
});
