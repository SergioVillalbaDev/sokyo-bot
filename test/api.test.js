const test = require('node:test');
const assert = require('node:assert/strict');
const { crearApp } = require('../api/server.js');
const { firmarToken } = require('../utils/auth.js');

const API_KEY = 'k'.repeat(32);
const JWT_SECRET = 'j'.repeat(32);
const GUILD = '123456789012345678';

class Cache extends Map { first() { return this.values().next().value; } }
const client = { guilds: { cache: new Cache([[GUILD, { id: GUILD }]]) }, channels: { cache: new Map() } };

const env = { API_KEY, JWT_SECRET, PORT: '0', FRONTEND_URL: 'http://localhost:5173', CORS_ORIGINS: 'https://panel.ejemplo.com' };
let servidor, base;
test.before(async () => {
    servidor = crearApp(client, env).listen(0);
    await new Promise(r => servidor.once('listening', r));
    base = `http://127.0.0.1:${servidor.address().port}`;
});
test.after(() => servidor.close());

const peticion = (ruta, { metodo = 'GET', cabeceras = {}, cuerpo, raw } = {}) => fetch(base + ruta, {
    method: metodo,
    headers: { ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...cabeceras },
    body: raw ?? (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined)
});
const tokenStaff = () => firmarToken({ tipo: 'staff' }, JWT_SECRET, 60);

test('/api/estado es público', async () => {
    assert.equal((await peticion('/api/estado')).status, 200);
});

test('sin credenciales la API de staff responde 401', async () => {
    for (const ruta of ['/api/tickets', '/api/servidores', '/api/logs', '/api/usuarios/stats']) {
        assert.equal((await peticion(ruta)).status, 401, ruta);
    }
    assert.equal((await peticion('/api/tickets', { cabeceras: { 'x-api-key': 'mala' } })).status, 401);
    assert.equal((await peticion('/api/tickets', { cabeceras: { Authorization: 'Bearer basura' } })).status, 401);
});

test('un token de PORTAL no da acceso a la API de staff', async () => {
    const portal = firmarToken({ tipo: 'portal', id: '1', username: 'x' }, JWT_SECRET, 60);
    assert.equal((await peticion('/api/tickets', { cabeceras: { Authorization: `Bearer ${portal}` } })).status, 401);
});

test('login de staff: clave correcta devuelve token; incorrecta, 401', async () => {
    const mal = await peticion('/api/staff/login', { metodo: 'POST', cuerpo: { clave: 'nope' } });
    assert.equal(mal.status, 401);
    const sinCuerpo = await peticion('/api/staff/login', { metodo: 'POST', cuerpo: {} });
    assert.equal(sinCuerpo.status, 401);
    const bien = await peticion('/api/staff/login', { metodo: 'POST', cuerpo: { clave: API_KEY } });
    assert.equal(bien.status, 200);
    const { token } = await bien.json();
    // el token emitido sirve para pasar la autenticación (ruta con validación previa a la BD)
    const r = await peticion(`/api/config/${GUILD}/motivos`, { metodo: 'PUT', cabeceras: { Authorization: `Bearer ${token}` }, cuerpo: { motivos: [] } });
    assert.equal(r.status, 400);
});

test('el login tiene límite de intentos', async () => {
    let ultimo = 0;
    for (let i = 0; i < 12; i++) ultimo = (await peticion('/api/staff/login', { metodo: 'POST', cuerpo: { clave: 'x' } })).status;
    assert.equal(ultimo, 429);
});

test('la clave por cabecera x-api-key sigue valiendo para scripts', async () => {
    const r = await peticion(`/api/config/${GUILD}/motivos`, { metodo: 'PUT', cabeceras: { 'x-api-key': API_KEY }, cuerpo: { motivos: [] } });
    assert.equal(r.status, 400);
});

test('portal: exige token de tipo portal', async () => {
    assert.equal((await peticion('/api/portal/yo')).status, 401);
    assert.equal((await peticion('/api/portal/yo', { cabeceras: { Authorization: `Bearer ${tokenStaff()}` } })).status, 401);
    const portal = firmarToken({ tipo: 'portal', id: '1', username: 'u', avatar: null }, JWT_SECRET, 60);
    const r = await peticion('/api/portal/yo', { cabeceras: { Authorization: `Bearer ${portal}` } });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).id, '1');
});

test('config: validaciones y servidor inexistente', async () => {
    const h = { Authorization: `Bearer ${tokenStaff()}` };
    assert.equal((await peticion('/api/config/999999999999999999/motivos', { metodo: 'PUT', cabeceras: h, cuerpo: { motivos: [{ nombre: 'A' }] } })).status, 404);
    assert.equal((await peticion('/api/config/abc/motivos', { metodo: 'PUT', cabeceras: h, cuerpo: {} })).status, 404);
    assert.equal((await peticion(`/api/config/${GUILD}/urgencias`, { metodo: 'PUT', cabeceras: h, cuerpo: { urgencias: [{ nombre: 'A', color: 'x', nivel: 1 }] } })).status, 400);
    assert.equal((await peticion(`/api/config/${GUILD}/textos`, { metodo: 'PUT', cabeceras: h, cuerpo: { titulo: '', descripcion: 'd' } })).status, 400);
});

test('?guildId de un servidor donde no está el bot -> 404', async () => {
    const r = await peticion('/api/tickets?guildId=111111111111111111', { cabeceras: { Authorization: `Bearer ${tokenStaff()}` } });
    assert.equal(r.status, 404);
});

test('JSON roto -> 400 y ruta desconocida -> 404', async () => {
    const h = { Authorization: `Bearer ${tokenStaff()}` };
    const roto = await peticion('/api/staff/login', { metodo: 'POST', cabeceras: { 'Content-Type': 'application/json' }, raw: '{no-json' });
    assert.equal(roto.status, 400);
    assert.equal((await peticion('/api/no-existe', { cabeceras: h })).status, 404);
});

test('CORS: solo orígenes permitidos', async () => {
    const permitido = await peticion('/api/estado', { cabeceras: { Origin: 'https://panel.ejemplo.com' } });
    assert.equal(permitido.headers.get('access-control-allow-origin'), 'https://panel.ejemplo.com');
    const ajeno = await peticion('/api/estado', { cabeceras: { Origin: 'https://malo.com' } });
    assert.equal(ajeno.headers.get('access-control-allow-origin'), null);
});

test('OAuth: el callback sin state válido NO emite sesión', async () => {
    const r = await fetch(`${base}/api/auth/discord/callback?code=abc&state=falso`, { redirect: 'manual' });
    assert.equal(r.status, 302);
    assert.match(r.headers.get('location'), /error=estado/);
    assert.doesNotMatch(r.headers.get('location'), /token=/);
});

test('OAuth: el inicio fija cookie de state y la envía a Discord', async () => {
    const app = crearApp(client, { ...env, DISCORD_CLIENT_ID: '1', DISCORD_CLIENT_SECRET: 's' }).listen(0);
    await new Promise(r => app.once('listening', r));
    try {
        const r = await fetch(`http://127.0.0.1:${app.address().port}/api/auth/discord`, { redirect: 'manual' });
        const url = new URL(r.headers.get('location'));
        const cookie = r.headers.get('set-cookie');
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=Lax/);
        assert.ok(cookie.includes(`oauth_state=${url.searchParams.get('state')}`));
    } finally { app.close(); }
});
