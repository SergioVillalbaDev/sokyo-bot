// ============================================================================
// Tests de la música (1.9.10): YouTube dejó de sonar en agosto de 2026 («All
// clients failed to load the item… This video requires login»).
//  - Por qué falla una canción, en palabras normales (utils/musica.js).
//  - La cuenta de YouTube: leer la salida de Lavalink, guardar el estado sin
//    enseñar nunca el token y hablar con Lavalink (utils/cuentaYoutube.js).
//  - El lanzador pasa la salida de Lavalink tal cual y apunta el código aunque
//    llegue partida en trozos (scripts/lavalink.js).
// Sin Discord ni Lavalink de verdad: un servidor HTTP hace de Lavalink.
// ============================================================================
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { PassThrough } = require('stream');

// Nada por la salida estándar: el ejecutor de tests la usa para hablar con este
// proceso, y un console.log a destiempo (el aviso de dotenv al cargar el lanzador, los
// de la cuenta de YouTube) la puede romper: «Unable to deserialize cloned data».
process.env.DOTENV_CONFIG_QUIET = 'true';
for (const k of ['log', 'info', 'warn']) console[k] = () => {};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sokyo-yt-'));
process.env.SOKYO_CUENTA_YOUTUBE = path.join(dir, 'cuenta.json');
process.env.LAVALINK_HOST = '127.0.0.1';
process.env.LAVALINK_PASSWORD = 'clave-prueba';

const { motivoFallo, tituloParaBuscar } = require('../utils/musica.js');
const cuenta = require('../utils/cuentaYoutube.js');

// Líneas reales de Lavalink 4.2.2 + youtube-plugin 2be8e54.
const PREFIJO = '2026-11-01T13:59:17.812Z  INFO 1798 --- [Lavalink] [  XNIO-1 task-2] d.l.youtube.http.YoutubeOauth2Handler    : ';
const LINEA_CODIGO = `${PREFIJO}OAUTH INTEGRATION: To give youtube-source access to your account, go to https://www.google.com/device and enter code JMS-HQW-LKNQ`;
const LINEA_TOKEN = `${PREFIJO}OAUTH INTEGRATION: Token retrieved successfully. Store your refresh token as this can be reused. (1//0gAbC-dEf_123)`;
const ERROR_PI = '(yts.version: 1.18.2) All clients failed to load the item.\n\nClient [ANDROID_VR] failed: This video requires login.\n\tat dev.lavalink.youtube.clients.skeleton.Client.getPlayabilityStatus(Client.java:77)';

const borrar = () => fs.rmSync(process.env.SOKYO_CUENTA_YOUTUBE, { force: true });
after(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('por qué no suena una canción (utils/musica.js: motivoFallo)', () => {
    it('el error de la Raspberry («This video requires login») es que YouTube pide iniciar sesión', () => {
        assert.strictEqual(motivoFallo(ERROR_PI), 'login');
        assert.strictEqual(motivoFallo('Client [TVHTML5_SIMPLY] failed: Sign in to confirm you’re not a bot'), 'login');
    });
    it('restricción de edad, vídeo no disponible y el resto', () => {
        assert.strictEqual(motivoFallo('Sign in to confirm your age'), 'edad');
        assert.strictEqual(motivoFallo('Client [WEB] failed: This video is not available'), 'no-disponible');
        assert.strictEqual(motivoFallo('Client [WEB_EMBEDDED_PLAYER] failed: This video is unavailable'), 'no-disponible');
        assert.strictEqual(motivoFallo('Something broke'), 'otro');
        assert.strictEqual(motivoFallo(''), 'otro');
    });
    it('si un cliente pide iniciar sesión y otro dice «no disponible», cuenta lo de iniciar sesión', () => {
        assert.strictEqual(motivoFallo('Client [WEB] failed: This video is not available\nClient [MWEB] failed: This video requires login.'), 'login');
    });
});

describe('buscar otra versión de la misma canción (tituloParaBuscar)', () => {
    it('quita «(Official Video)», «[Lyrics]» y lo que va tras « | »', () => {
        assert.strictEqual(tituloParaBuscar({ title: 'Ellie Goulding, Juice WRLD - Hate Me (Official Video)', author: 'Ellie Goulding' }), 'Ellie Goulding, Juice WRLD - Hate Me');
        assert.strictEqual(tituloParaBuscar({ title: 'Blinding Lights [Official Lyric Video] | 4K', author: 'The Weeknd' }), 'The Weeknd Blinding Lights');
    });
    it('añade el artista si el título no lo lleva, sin « - Topic» ni «VEVO»', () => {
        assert.strictEqual(tituloParaBuscar({ title: 'Hate Me', author: 'Ellie Goulding - Topic' }), 'Ellie Goulding Hate Me');
        assert.strictEqual(tituloParaBuscar({ title: 'Despacito', author: 'LuisFonsiVEVO' }), 'LuisFonsi Despacito');
    });
    it('no quita paréntesis que son parte del nombre', () => {
        assert.strictEqual(tituloParaBuscar({ title: 'Lose Yourself (From 8 Mile)', author: 'Eminem' }), 'Eminem Lose Yourself (From 8 Mile)');
    });
});

describe('cuenta de YouTube: salida de Lavalink (interpretarLinea)', () => {
    it('saca la dirección y el código', () => {
        assert.deepStrictEqual(cuenta.interpretarLinea(LINEA_CODIGO), { tipo: 'codigo', url: 'https://www.google.com/device', codigo: 'JMS-HQW-LKNQ' });
    });
    it('saca el token al aceptar', () => {
        assert.deepStrictEqual(cuenta.interpretarLinea(LINEA_TOKEN), { tipo: 'token', refreshToken: '1//0gAbC-dEf_123' });
    });
    it('código caducado o «No permitir»', () => {
        assert.deepStrictEqual(cuenta.interpretarLinea(`${PREFIJO}OAUTH INTEGRATION: The device token has expired. OAuth integration has been canceled.`), { tipo: 'caducado' });
        assert.deepStrictEqual(cuenta.interpretarLinea(`${PREFIJO}OAUTH INTEGRATION: Account linking was denied. OAuth integration has been canceled.`), { tipo: 'denegado' });
    });
    it('el resto de líneas no son nada', () => {
        assert.strictEqual(cuenta.interpretarLinea(`${PREFIJO}!!! DO NOT AUTHORISE WITH YOUR MAIN ACCOUNT, USE A BURNER !!!`), null);
        assert.strictEqual(cuenta.interpretarLinea('Lavalink is ready to accept connections.'), null);
    });
});

describe('cuenta de YouTube: estado guardado', () => {
    beforeEach(borrar);

    it('sin lanzador nuevo no se puede conectar (el código no llegaría al panel)', () => {
        assert.deepStrictEqual(cuenta.estadoCuenta(), { disponible: false, estado: 'sin-cuenta', url: null, codigo: null, desde: null });
    });

    it('código → conectada, y el panel nunca ve el token', () => {
        cuenta.marcarLanzador();
        cuenta.apuntarEvento(cuenta.interpretarLinea(LINEA_CODIGO));
        let e = cuenta.estadoCuenta();
        assert.strictEqual(e.disponible, true);
        assert.strictEqual(e.estado, 'esperando');
        assert.strictEqual(e.codigo, 'JMS-HQW-LKNQ');
        cuenta.apuntarEvento(cuenta.interpretarLinea(LINEA_TOKEN));
        e = cuenta.estadoCuenta();
        assert.strictEqual(e.estado, 'conectada');
        assert.strictEqual(e.codigo, null);
        assert.ok(!JSON.stringify(e).includes('1//0gAbC'));
        assert.strictEqual(cuenta.hayCuenta(), true);
    });

    it('el archivo con el token solo lo puede leer su dueño', { skip: process.platform === 'win32' }, () => {
        cuenta.apuntarEvento({ tipo: 'token', refreshToken: 'x1' });
        assert.strictEqual(fs.statSync(process.env.SOKYO_CUENTA_YOUTUBE).mode & 0o077, 0);
    });

    it('un «caducado» viejo no borra una cuenta ya conectada', () => {
        cuenta.apuntarEvento({ tipo: 'token', refreshToken: 'x1' });
        cuenta.apuntarEvento({ tipo: 'caducado' });
        assert.strictEqual(cuenta.estadoCuenta().estado, 'conectada');
    });

    it('al reiniciar Lavalink, un inicio de sesión a medias se olvida; la cuenta conectada no', () => {
        cuenta.marcarLanzador();
        cuenta.apuntarEvento(cuenta.interpretarLinea(LINEA_CODIGO));
        cuenta.marcarLanzador();
        assert.strictEqual(cuenta.estadoCuenta().estado, 'sin-cuenta');
        cuenta.apuntarEvento({ tipo: 'token', refreshToken: 'x1' });
        cuenta.marcarLanzador();
        assert.strictEqual(cuenta.estadoCuenta().estado, 'conectada');
    });
});

describe('lanzador: salida de Lavalink (scripts/lavalink.js)', () => {
    beforeEach(borrar);
    const { vigilarSalida, entornoLavalink } = require('../scripts/lavalink.js');

    it('pasa todo tal cual y apunta el código aunque llegue partido', async () => {
        const entrada = new PassThrough();
        const salida = new PassThrough();
        let copia = '';
        salida.on('data', (b) => { copia += b; });
        vigilarSalida(entrada, salida);
        const texto = `línea normal\n${LINEA_CODIGO}\notra`;
        entrada.write(Buffer.from(texto.slice(0, 120)));
        entrada.write(Buffer.from(texto.slice(120)));
        // Los flujos avisan en otra vuelta del bucle: se espera a que llegue (máx. 2 s).
        for (let i = 0; i < 200 && (copia !== texto || !cuenta.leer().codigo); i++) await new Promise((r) => setTimeout(r, 10));
        assert.strictEqual(copia, texto);
        assert.strictEqual(cuenta.leer().codigo, 'JMS-HQW-LKNQ');
    });

    it('con cuenta, el cliente TV va justo después de MUSIC; YOUTUBE_CLIENTS del .env manda', () => {
        assert.strictEqual(entornoLavalink().YOUTUBE_CLIENTS, undefined);
        cuenta.apuntarEvento({ tipo: 'token', refreshToken: 'x1' });
        assert.match(entornoLavalink().YOUTUBE_CLIENTS, /^MUSIC,TV,/);
        process.env.YOUTUBE_CLIENTS = 'MUSIC,WEB';
        try { assert.strictEqual(entornoLavalink().YOUTUBE_CLIENTS, 'MUSIC,WEB'); } finally { delete process.env.YOUTUBE_CLIENTS; }
    });
});

describe('cuenta de YouTube: hablar con Lavalink', () => {
    let servidor;
    let peticiones;
    let responder; // (req, cuerpo) => status
    let cuerpo500 = '';
    before(async () => {
        servidor = http.createServer((req, res) => {
            let cuerpo = '';
            req.on('data', (c) => { cuerpo += c; });
            req.on('end', () => {
                const json = cuerpo ? JSON.parse(cuerpo) : null;
                peticiones.push({ metodo: req.method, ruta: req.url, auth: req.headers.authorization, json });
                res.statusCode = responder(req, json);
                res.end(res.statusCode === 500 ? cuerpo500 : undefined);
            });
        });
        await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
        process.env.LAVALINK_PORT = String(servidor.address().port);
    });
    after(() => servidor.close());
    beforeEach(() => { borrar(); peticiones = []; responder = () => 204; cuerpo500 = ''; });

    it('conectar: pide el inicio de sesión a Lavalink y devuelve el código que apunta el lanzador', async () => {
        cuenta.marcarLanzador();
        // Lavalink escribe el código en su salida al momento; aquí lo hace «el lanzador».
        responder = (req, json) => { if (json && json.skipInitialization === false) setTimeout(() => cuenta.apuntarEvento(cuenta.interpretarLinea(LINEA_CODIGO)), 50); return 204; };
        const r = await cuenta.empezarConexion();
        assert.strictEqual(r.ok, true);
        assert.strictEqual(r.codigo, 'JMS-HQW-LKNQ');
        assert.deepStrictEqual(peticiones[0], { metodo: 'POST', ruta: '/youtube', auth: 'clave-prueba', json: { refreshToken: '', skipInitialization: false } });
    });

    it('conectar sin el lanzador nuevo avisa en vez de esperar un código que no llegará', async () => {
        assert.deepStrictEqual(await cuenta.empezarConexion(), { error: 'lanzador' });
        assert.strictEqual(peticiones.length, 0);
    });

    it('al conectarse el bot, le pasa la cuenta guardada a Lavalink', async () => {
        cuenta.apuntarEvento({ tipo: 'token', refreshToken: '1//guardado' });
        await cuenta.aplicarAlConectar();
        assert.deepStrictEqual(peticiones[0].json, { refreshToken: '1//guardado', skipInitialization: true });
        assert.strictEqual(cuenta.estadoCuenta().estado, 'conectada');
    });

    it('si Google ya no acepta la cuenta, se olvida, se quita de Lavalink y el panel pide conectarla otra vez', async () => {
        cuenta.apuntarEvento({ tipo: 'token', refreshToken: '1//caducado' });
        // Lo que responde Lavalink de verdad cuando Google rechaza el token.
        responder = (req, json) => (json && json.refreshToken === '1//caducado' ? 500 : 204);
        cuerpo500 = '{"status":500,"message":"Request processing failed: java.lang.RuntimeException: java.io.IOException: Invalid status code for oauth2 token fetch: 400"}';
        await cuenta.aplicarAlConectar();
        assert.strictEqual(cuenta.estadoCuenta().estado, 'invalida');
        assert.strictEqual(cuenta.hayCuenta(), false);
        assert.deepStrictEqual(peticiones[1].json, { refreshToken: '', skipInitialization: true });
    });

    it('si Lavalink falla por otra cosa (no Google), la cuenta NO se borra', async () => {
        cuenta.apuntarEvento({ tipo: 'token', refreshToken: '1//bueno' });
        responder = () => 500; // p. ej. sin conexión con Google un momento
        await cuenta.aplicarAlConectar();
        assert.strictEqual(cuenta.estadoCuenta().estado, 'conectada');
        assert.strictEqual(cuenta.leer().refreshToken, '1//bueno');
    });

    it('si «Conectar» no llega a empezar, la cuenta que había sigue (y se le vuelve a pasar a Lavalink)', async () => {
        cuenta.marcarLanzador();
        cuenta.apuntarEvento({ tipo: 'token', refreshToken: '1//bueno' });
        responder = (req, json) => (json && json.skipInitialization === false ? 500 : 204);
        const r = await cuenta.empezarConexion();
        assert.deepStrictEqual(r, { error: 'fallo' });
        assert.strictEqual(cuenta.estadoCuenta().estado, 'conectada');
        assert.strictEqual(cuenta.leer().refreshToken, '1//bueno');
        assert.deepStrictEqual(peticiones.at(-1).json, { refreshToken: '1//bueno', skipInitialization: true });
    });

    it('desconectar quita la cuenta de Lavalink y del archivo', async () => {
        cuenta.apuntarEvento({ tipo: 'token', refreshToken: '1//guardado' });
        const r = await cuenta.desconectar();
        assert.strictEqual(r.estado, 'sin-cuenta');
        assert.strictEqual(cuenta.leer().refreshToken, null);
        assert.deepStrictEqual(peticiones[0].json, { refreshToken: '', skipInitialization: true });
    });
});
