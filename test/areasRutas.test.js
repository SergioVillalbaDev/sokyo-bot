// 2.0.0: cada ruta de la API que CAMBIA algo de un servidor exige permiso: o lo lleva en su
// línea (exigeArea, exigeAdmin, exigeModerador, exigeOwner, soloPropietario, scope…, portalAuth), o está en la tabla de
// utils/areasRutas.js, o su archivo entero va protegido, o está en la lista de abajo con su motivo.
// Si añades una ruta y este test falla, ponle su área (o explícala aquí).
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const AR = require('../utils/areasRutas.js');

const RAIZ = path.join(__dirname, '..');
const ARCHIVOS_PROTEGIDOS = new Set(['api/crecimientoRoutes.js', 'api/routes/canales.js', 'api/routes/soporte.js', 'api/routes/actividad.js']);
const SIN_AREA = {
    'POST /api/billing/webhook': 'Stripe, con firma',
    'POST /api/topgg/voto': 'top.gg, con su clave',
    'POST /api/staff/mi-cuenta': 'entrada a «Mi cuenta» de quien ya está dentro',
    'PUT /api/presets-tarjeta': 'solo propietarios (soloPropietario)',
    'POST /api/presets-tarjeta/preview': 'solo dibuja una imagen',
    'POST /api/broadcast/enviar': 'solo difusores (BROADCAST_IDS)',
    'POST /cambios/:id/deshacer': 'mira el área del cambio dentro (panelExtra.js)',
    'POST /api/anuncios/presets': 'plantillas compartidas por varias secciones (CLAUDE.md)',
    'PUT /api/anuncios/presets/:id': 'plantillas compartidas por varias secciones (CLAUDE.md)',
    'DELETE /api/anuncios/presets/:id': 'plantillas compartidas por varias secciones (CLAUDE.md)',
    'POST /api/paneles/upload': 'subida de imágenes de todo el panel, con freno (utils/limiteSubidas.js)',
    'POST /api/sanciones/upload': 'subida de pruebas, con freno (utils/limiteSubidas.js)',
    'POST /config/:guildId/musica/control': 'controla la música (área musica en la tabla por /config/…/musica)',
};

function rutasQueEscriben() {
    const archivos = ['api/server.js', 'api/comunidadRoutes.js', 'api/crecimientoRoutes.js', ...fs.readdirSync(path.join(RAIZ, 'api/routes')).map((f) => `api/routes/${f}`)];
    const out = [];
    for (const f of archivos) {
        fs.readFileSync(path.join(RAIZ, f), 'utf8').split('\n').forEach((linea) => {
            const m = linea.match(/\b(app|router)\.(post|put|patch|delete)\(\s*(?:ruta\('([^']+)'\)|'([^']+)')(.*)/);
            if (!m) return;
            const ruta = m[3] ? `/config/:guildId/modulos/${m[3]}` : m[4];
            out.push({ f, metodo: m[2].toUpperCase(), ruta, resto: m[5] });
        });
    }
    return out;
}

describe('permisos de cada ruta que escribe', () => {
    for (const r of rutasQueEscriben()) {
        it(`${r.metodo} ${r.ruta}`, () => {
            if (/exige(Area|Admin|Moderador|Confirmacion|Owner)|soloPropietario|scope|portalAuth/.test(r.resto)) return;
            if (ARCHIVOS_PROTEGIDOS.has(r.f)) return;
            if (SIN_AREA[`${r.metodo} ${r.ruta}`]) return;
            const ejemplo = r.ruta.replace(/:guildId/g, '123').replace(/:[a-zA-Z]+/g, '64b000000000000000000000');
            assert.ok(AR.areaDeRuta(r.metodo, ejemplo), `${r.f}: ${r.metodo} ${r.ruta} no exige ningún área (añádela en utils/areasRutas.js)`);
        });
    }
});

describe('tabla de áreas', () => {
    it('cada sección va a su área', () => {
        assert.strictEqual(AR.areaDeRuta('DELETE', '/api/sorteos/64b000000000000000000000').area, 'comunidad');
        assert.strictEqual(AR.areaDeRuta('DELETE', '/api/sorteos/64b000000000000000000000').modelo, 'Sorteo');
        assert.strictEqual(AR.areaDeRuta('PUT', '/config/1/modulos/casino').area, 'comunidad');
        assert.strictEqual(AR.areaDeRuta('PUT', '/config/1/modulos/tienda').area, 'roles');
        assert.strictEqual(AR.areaDeRuta('GET', '/api/logs').area, 'logs');
        assert.strictEqual(AR.areaDeRuta('POST', '/api/billing/checkout').area, 'cuenta');
        assert.strictEqual(AR.areaDeRuta('GET', '/api/sanciones/tipos').modelo, 'TipoSancion');
    });
    it('los desplegables (canales, roles, miembros) y la cabecera siguen abiertos', () => {
        for (const r of ['/api/servidor/canales', '/api/servidor/roles', '/api/roles', '/api/servidor/miembros', '/api/stats/uso', '/api/guilds', '/api/anuncios/presets']) assert.strictEqual(AR.areaDeRuta('GET', r), null, r);
        assert.strictEqual(AR.areaDeRuta('POST', '/api/paneles/upload'), null);
        assert.strictEqual(AR.areaDeRuta('GET', '/api/anuncios').area, 'mensajes');
    });
    it('saca el servidor de la ruta, la query o el cuerpo, y el id del recurso', () => {
        assert.strictEqual(AR.guildDeRuta({ path: '/config/G1/modulos/casino', query: {}, body: {} }), 'G1');
        assert.strictEqual(AR.guildDeRuta({ path: '/sorteos', query: { guildId: 'G2' }, body: {} }), 'G2');
        assert.strictEqual(AR.guildDeRuta({ path: '/sorteos', query: {}, body: { guildId: 'G3' } }), 'G3');
        assert.strictEqual(AR.idDeRuta('/sorteos/64b0000000000000000000ab/terminar'), '64b0000000000000000000ab');
    });
});
