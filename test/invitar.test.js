// 2.3.1: enlace para añadir el bot y botón «Añadir app» del perfil (utils/invitar.js).
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const I = require('../utils/invitar.js');
console.log = () => {}; // los tests no escriben por stdout

function rest(app) {
    const llamadas = [];
    return { llamadas, get: async () => app, patch: async (_r, { body }) => { llamadas.push(body); Object.assign(app, body); return app; } };
}

describe('invitar', () => {
    beforeEach(() => { Object.assign(I.estado, { comprobado: false, publico: null, enlace: null, error: null }); delete process.env.INSTALACION_AUTOMATICA; });
    it('enlace con bot + comandos y, si se pide, el servidor ya elegido', () => {
        const u = new URL(I.urlInvitar({ clientId: '123' }));
        assert.strictEqual(u.searchParams.get('client_id'), '123');
        assert.deepStrictEqual(u.searchParams.get('scope').split(' ').sort(), ['applications.commands', 'bot']);
        assert.strictEqual(u.searchParams.get('permissions'), I.permisos());
        const g = new URL(I.urlInvitar({ clientId: '123', guildId: '9' }));
        assert.strictEqual(g.searchParams.get('guild_id'), '9');
    });
    it('pone el enlace de instalación si falta y deja la instalación de usuario como estaba', async () => {
        const r = rest({ bot_public: true, integration_types_config: { 1: { oauth2_install_params: null } } });
        await I.ponerInstalacion({ rest: r });
        assert.strictEqual(r.llamadas.length, 1);
        const b = r.llamadas[0];
        assert.deepStrictEqual(b.install_params.scopes.sort(), ['applications.commands', 'bot']);
        assert.ok(b.integration_types_config['0'].oauth2_install_params);
        assert.ok('1' in b.integration_types_config);
        assert.strictEqual(I.estado.enlace, 'discord');
    });
    it('si ya está, no toca nada; con enlace propio, tampoco', async () => {
        const quiero = { scopes: ['applications.commands', 'bot'], permissions: I.permisos() };
        const r = rest({ bot_public: true, install_params: quiero, integration_types_config: { 0: { oauth2_install_params: quiero } } });
        await I.ponerInstalacion({ rest: r });
        assert.strictEqual(r.llamadas.length, 0);
        const r2 = rest({ bot_public: true, custom_install_url: 'https://x' });
        await I.ponerInstalacion({ rest: r2 });
        assert.strictEqual(r2.llamadas.length, 0);
        assert.strictEqual(I.estado.enlace, 'propio');
    });
    it('dice si el bot no es público', async () => {
        await I.ponerInstalacion({ rest: rest({ bot_public: false, custom_install_url: 'https://x' }) });
        assert.strictEqual(I.estado.publico, false);
    });
});
