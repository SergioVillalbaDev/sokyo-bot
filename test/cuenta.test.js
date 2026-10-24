// ============================================================================
// Tests de "Mi cuenta": el enlace de un solo uso de /cuenta (utils/cuenta.js)
// y las piezas del resumen del portal (api/routes/cuenta.js).
// ============================================================================
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.FRONTEND_URL = 'https://dashboard.sokyo.studio';
process.env.OAUTH_REDIRECT_URI = 'https://dashboard.sokyo.studio/api/auth/discord/callback';
const cuenta = require('../utils/cuenta.js');
const { zonaValida, ultimosDias, estadoDaily } = require('../api/routes/cuenta.js');

const usuario = { id: '123456789012345678', username: 'tokyto', displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/1/a.png' };
const codigoDe = (enlace) => new URL(enlace).searchParams.get('c');

describe('enlace de /cuenta', () => {
    beforeEach(() => cuenta._codigos.clear());

    it('apunta a la API pública y lleva un código largo y aleatorio', () => {
        const a = cuenta.crearEnlace(usuario);
        const b = cuenta.crearEnlace(usuario);
        assert.match(a, /^https:\/\/dashboard\.sokyo\.studio\/api\/auth\/magic\?c=[\w-]{32}$/);
        assert.notStrictEqual(codigoDe(a), codigoDe(b));
    });

    it('se canjea una sola vez y devuelve quién es y adónde iba', () => {
        const c = codigoDe(cuenta.crearEnlace(usuario, 'tienda'));
        const d = cuenta.canjear(c);
        assert.strictEqual(d.id, usuario.id);
        assert.strictEqual(d.username, 'tokyto');
        assert.strictEqual(d.avatar, 'https://cdn.discordapp.com/avatars/1/a.png');
        assert.strictEqual(d.vista, 'tienda');
        assert.strictEqual(cuenta.canjear(c), null, 'el segundo uso no vale');
    });

    it('caduca a los 15 minutos', () => {
        const c = codigoDe(cuenta.crearEnlace(usuario));
        cuenta._codigos.get(c).expira = Date.now() - 1;
        assert.strictEqual(cuenta.canjear(c), null);
    });

    it('rechaza códigos inventados o con formas raras', () => {
        for (const c of ['', 'abc', null, undefined, 42, 'x'.repeat(200), { c: 1 }]) assert.strictEqual(cuenta.canjear(c), null);
    });

    it('una pantalla desconocida lleva al inicio', () => {
        const d = cuenta.canjear(codigoDe(cuenta.crearEnlace(usuario, '../admin')));
        assert.strictEqual(d.vista, 'inicio');
    });

    it('no acumula códigos sin límite', () => {
        for (let i = 0; i < 5100; i++) cuenta.crearEnlace(usuario);
        assert.ok(cuenta._codigos.size <= 5000);
    });

    it('el mensaje es un botón de enlace con el código (para enviarlo en privado)', () => {
        const m = cuenta.mensajeAcceso(usuario, 'es', 'tickets');
        const boton = m.components[0].components[0].toJSON();
        assert.strictEqual(boton.style, 5); // Link
        assert.match(boton.url, /\/api\/auth\/magic\?c=/);
        assert.match(m.embeds[0].toJSON().footer.text, /15 minutos/);
        assert.match(cuenta.mensajeAcceso(usuario, 'en').embeds[0].toJSON().description, /straight away/);
    });
});

describe('direcciones de "Mi cuenta"', () => {
    it('son cortas y llevan a la pantalla pedida', () => {
        assert.strictEqual(cuenta.urlCuenta(), 'https://dashboard.sokyo.studio/cuenta');
        assert.strictEqual(cuenta.urlCuenta('inicio'), 'https://dashboard.sokyo.studio/cuenta');
        assert.strictEqual(cuenta.urlCuenta('tienda'), 'https://dashboard.sokyo.studio/cuenta#tienda');
        assert.strictEqual(cuenta.urlCuenta('tienda', 'mochila'), 'https://dashboard.sokyo.studio/cuenta#tienda/mochila');
        assert.strictEqual(cuenta.urlCuenta('tickets', '987654321098765432'), 'https://dashboard.sokyo.studio/cuenta#tickets/987654321098765432');
        assert.strictEqual(cuenta.urlCuenta('nada'), 'https://dashboard.sokyo.studio/cuenta');
    });

    it('el botón web es un enlace normal, sin sesión', () => {
        const b = cuenta.botonWeb('es', 'tarjeta', 'Personalizar').toJSON();
        assert.strictEqual(b.url, 'https://dashboard.sokyo.studio/cuenta#tarjeta');
        assert.ok(!b.url.includes('magic'));
        assert.strictEqual(b.label, 'Personalizar');
    });
});

describe('resumen del portal', () => {
    it('solo acepta zonas horarias reales', () => {
        assert.strictEqual(zonaValida('Europe/Madrid'), 'Europe/Madrid');
        assert.match(zonaValida('America/Argentina/Buenos_Aires'), /Buenos_Aires$/);
        assert.strictEqual(zonaValida('europe/madrid'), 'Europe/Madrid', 'se devuelve con su nombre canónico');
        assert.strictEqual(zonaValida('UTC'), 'UTC');
        for (const z of ['Mars/Olympus', '', null, '$where', 'Europe/Madrid; drop', 'x'.repeat(80)]) assert.strictEqual(zonaValida(z), null);
    });

    it('cuenta los días por el calendario, también con el cambio de hora', () => {
        // 26 de octubre de 2025: en Madrid el domingo dura 25 horas.
        const dias = ultimosDias(14, 'Europe/Madrid', new Date('2025-10-27T00:30:00+01:00'));
        assert.strictEqual(dias.length, 14);
        assert.strictEqual(dias[13], '2025-10-27');
        assert.strictEqual(dias[12], '2025-10-26');
        assert.strictEqual(new Set(dias).size, 14, 'sin días repetidos');
        // 30 de marzo de 2025: el domingo dura 23 horas.
        const marzo = ultimosDias(3, 'Europe/Madrid', new Date('2025-03-31T00:30:00+02:00'));
        assert.deepStrictEqual(marzo, ['2025-03-29', '2025-03-30', '2025-03-31']);
    });

    it('el día de hoy es el de la zona del usuario, no el del servidor', () => {
        const momento = new Date('2025-06-01T02:00:00Z'); // ya es 1 de junio en UTC, aún 31 de mayo en México
        assert.strictEqual(ultimosDias(1, 'UTC', momento)[0], '2025-06-01');
        assert.strictEqual(ultimosDias(1, 'America/Mexico_City', momento)[0], '2025-05-31');
    });

    it('la recompensa diaria sigue la misma regla que /daily (20 h, racha 48 h)', () => {
        const ahora = Date.parse('2025-06-01T12:00:00Z');
        assert.deepStrictEqual(estadoDaily({ ultimoDaily: null }, ahora), { disponible: true, proximo: null, racha: 0 });
        const hace5h = estadoDaily({ ultimoDaily: new Date(ahora - 5 * 3600000), rachaDaily: 4 }, ahora);
        assert.strictEqual(hace5h.disponible, false);
        assert.strictEqual(hace5h.racha, 4);
        assert.strictEqual(new Date(hace5h.proximo).getTime(), ahora + 15 * 3600000);
        const hace30h = estadoDaily({ ultimoDaily: new Date(ahora - 30 * 3600000), rachaDaily: 4 }, ahora);
        assert.strictEqual(hace30h.disponible, true);
        assert.strictEqual(hace30h.racha, 4);
        const hace3dias = estadoDaily({ ultimoDaily: new Date(ahora - 72 * 3600000), rachaDaily: 9 }, ahora);
        assert.strictEqual(hace3dias.racha, 0, 'pasadas 48 h la racha ya se ha perdido');
    });
});

describe('gráfica de actividad', () => {
    const RegistroMensaje = require('../models/RegistroMensaje.js');
    const { serieActividad } = require('../api/routes/cuenta.js');

    it('si la base de datos no conoce la zona, cuenta en UTC en vez de fallar', async (t) => {
        const zonas = [];
        t.mock.method(RegistroMensaje, 'aggregate', async (pipeline) => {
            const tz = pipeline[1].$group._id.$dateToString.timezone;
            zonas.push(tz);
            if (tz !== 'UTC') throw new Error('unrecognized time zone identifier');
            return [];
        });
        const r = await serieActividad('1', 'Europe/Kyiv');
        assert.deepStrictEqual(zonas, ['Europe/Kyiv', 'UTC']);
        assert.strictEqual(r.serie.length, 14);
    });

    it('calcula la subida de esta semana frente a la anterior', async (t) => {
        const hoy = ultimosDias(14, 'UTC');
        t.mock.method(RegistroMensaje, 'aggregate', async () => [
            { _id: hoy[0], n: 10 }, { _id: hoy[6], n: 10 }, // semana anterior: 20
            { _id: hoy[7], n: 15 }, { _id: hoy[13], n: 15 }, // esta semana: 30
        ]);
        const r = await serieActividad('1', 'UTC');
        assert.strictEqual(r.semanaAnterior, 20);
        assert.strictEqual(r.semana, 30);
        assert.strictEqual(r.cambio, 50);
        assert.strictEqual(r.serie[13].mensajes, 15);
    });

    it('sin semana anterior no inventa un porcentaje', async (t) => {
        const hoy = ultimosDias(14, 'UTC');
        t.mock.method(RegistroMensaje, 'aggregate', async () => [{ _id: hoy[13], n: 4 }]);
        const r = await serieActividad('1', 'UTC');
        assert.strictEqual(r.cambio, null);
    });
});
