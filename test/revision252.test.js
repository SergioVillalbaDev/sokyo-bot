// Revisión 2.5.2 (segunda pasada): automod con lista blanca por dominio y también al editar, anuncios mensuales que
// respetan el día, sorteos sin repetidos, salas de voz con `type` en los permisos y avisos de seguridad en su idioma.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { enlacesPermitidos, revisarMensaje } = require('../utils/automod.js');
const { proximaFecha } = require('../utils/scheduler.js');

describe('automod: lista blanca de enlaces por dominio', () => {
    const lista = ['youtube.com', 'https://www.tenor.com/'];
    it('un dominio permitido en el texto ya no deja pasar otro enlace', () => {
        assert.strictEqual(enlacesPermitidos('mira youtube.com https://estafa.ru/regalo', lista), false);
    });
    it('subdominios y www valen; parecidos no', () => {
        assert.strictEqual(enlacesPermitidos('https://m.youtube.com/watch?v=1 y www.tenor.com/view/x', lista), true);
        assert.strictEqual(enlacesPermitidos('https://evilyoutube.com', lista), false);
        assert.strictEqual(enlacesPermitidos('https://youtube.com.estafa.ru', lista), false);
    });
});

describe('automod: lo editado también se revisa (sin contar como spam)', () => {
    const cfg = { automod: { activo: true, enlaces: { activo: true, accion: 'borrar', listaBlanca: [] }, spam: { activo: true, maxMensajes: 0 } } };
    const msg = (content) => {
        const m = { content, guild: { id: 'G' }, guildId: 'G', channelId: 'C', author: { id: 'U' }, borrado: false,
            member: { permissions: { has: () => false }, roles: { cache: { has: () => false } } },
            mentions: { everyone: false, users: { size: 0 }, roles: { size: 0 } }, channel: { send: async () => ({ delete: async () => {} }) } };
        m.delete = async () => { m.borrado = true; };
        return m;
    };
    it('un enlace metido al editar se borra', async () => {
        const m = msg('ahora sí: https://estafa.ru');
        assert.strictEqual(await revisarMensaje(m, cfg, { user: { id: 'B' } }, { edicion: true }), true);
        assert.ok(m.borrado);
    });
    it('editar un mensaje normal no cuenta como spam', async () => {
        const m = msg('hola qué tal');
        assert.strictEqual(await revisarMensaje(m, cfg, { user: { id: 'B' } }, { edicion: true }), false);
    });
});

describe('anuncios mensuales', () => {
    it('el 31 cae en el último día de los meses cortos y vuelve al 31', () => {
        let d = new Date('2027-01-31T10:00:00Z');
        const fechas = [];
        for (let i = 0; i < 4; i++) { d = proximaFecha(d, 'mensual', 31); fechas.push(d.toISOString().slice(0, 10)); }
        assert.deepStrictEqual(fechas, ['2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31']);
    });
    it('un día normal se queda igual y conserva la hora', () => {
        assert.strictEqual(proximaFecha(new Date('2027-03-15T18:30:00Z'), 'mensual').toISOString(), '2027-04-15T18:30:00.000Z');
        assert.strictEqual(proximaFecha(new Date('2027-12-10T00:00:00Z'), 'mensual').toISOString(), '2028-01-10T00:00:00.000Z');
    });
});

describe('salas de voz temporales', () => {
    it('los permisos de personas llevan type (si no, Discord no crea la sala con alguien que no está en caché)', () => {
        const src = require('node:fs').readFileSync(require.resolve('../utils/vozTemporal.js'), 'utf8');
        assert.match(src, /overwrites\.push\(\{ id: uid, type: 1, allow/);
        assert.match(src, /overwrites\.push\(\{ id: uid, type: 1, deny/);
        assert.doesNotMatch(src, /permissionOverwrites\.edit\(objetivoId, \{[^}]*\}\)\.catch/);
    });
});

describe('alertas de seguridad en el idioma del servidor', () => {
    it('con [es, en] elige el del servidor', async () => {
        const config = require('../utils/config.js');
        const Log = require('../models/Log.js');
        const orig = { cfg: config.getConfigCached, crear: Log.create };
        let guardado = null;
        config.getConfigCached = async () => ({ idioma: 'en' });
        Log.create = async (d) => { guardado = d; return d; };
        try {
            await require('../utils/accesoPanel.js').alertaSeguridad(null, 'G', { accion: ['🔑 Acceso dado', '🔑 Access given'], detalles: ['es', 'en'] });
            assert.strictEqual(guardado.accion, '🔑 Access given');
            assert.strictEqual(guardado.detalles, 'en');
        } finally { config.getConfigCached = orig.cfg; Log.create = orig.crear; }
    });
});
