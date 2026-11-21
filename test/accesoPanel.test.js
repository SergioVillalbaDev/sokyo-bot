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
