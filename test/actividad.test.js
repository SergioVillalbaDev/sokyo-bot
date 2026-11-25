// 1.34.0: rutas de la Actividad de Discord (api/routes/actividad.js). Sin el secreto de la aplicación dice que no está
// lista; sin code no llama a Discord; sin sesión no da datos; y solo vale en un servidor donde está el bot y la persona.
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { firmarToken, verificarToken } = require('../utils/auth.js');

async function arrancar(opciones) {
    const app = express(); app.use(express.json());
    const portalAuth = (req, res, next) => {
        const u = verificarToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''), 's');
        if (!u) return res.status(401).json({ error: 'Sesión no válida o caducada' });
        req.usuario = u; next();
    };
    const client = { guilds: { cache: new Map() } };
    app.use('/api', require('../api/routes/actividad.js')({ client, portalAuth, firmarToken, JWT_SECRET: 's', DURACION_SESION: 60, ...opciones }));
    const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
    return { url: `http://127.0.0.1:${srv.address().port}/api`, cerrar: () => srv.close() };
}

test('Actividad: configuración, code obligatorio, sesión y servidor', async () => {
    const sin = await arrancar({});
    try {
        assert.deepStrictEqual(await (await fetch(`${sin.url}/auth/actividad/config`)).json(), { clientId: null, lista: false });
        const r = await fetch(`${sin.url}/auth/actividad/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'x' }) });
        assert.strictEqual(r.status, 503);
    } finally { sin.cerrar(); }
    const con = await arrancar({ DISCORD_CLIENT_ID: '1', DISCORD_CLIENT_SECRET: '2' });
    try {
        assert.strictEqual((await (await fetch(`${con.url}/auth/actividad/config`)).json()).lista, true);
        const r = await fetch(`${con.url}/auth/actividad/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        assert.strictEqual(r.status, 400);
        assert.strictEqual((await fetch(`${con.url}/portal/actividad/estado?guildId=1`)).status, 401);
        const tk = firmarToken({ id: '5', username: 'a' }, 's', 60);
        const e = await fetch(`${con.url}/portal/actividad/estado?guildId=1`, { headers: { authorization: `Bearer ${tk}` } });
        assert.strictEqual(e.status, 404);
        assert.strictEqual((await e.json()).codigo, 'sin-bot');
    } finally { con.cerrar(); }
});
