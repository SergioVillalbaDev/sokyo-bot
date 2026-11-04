// Cuenta de YouTube para la música.
//
// Desde agosto de 2026 YouTube pide iniciar sesión para dejar sonar muchas
// canciones («This video requires login», «Sign in to confirm you're not a bot»).
// Lo que de verdad lo arregla es que Lavalink use una cuenta de Google (una
// secundaria: nunca la principal). Cómo va, todo en la misma máquina que Lavalink:
//   1. El dueño pulsa «Conectar» en el panel (Música) → el bot pide a Lavalink que
//      empiece el inicio de sesión de Google para TVs (POST /youtube, token vacío).
//   2. Lavalink escribe en su salida «go to https://www.google.com/device and enter
//      code XXX-XXX-XXX». El lanzador (scripts/lavalink.js) lo lee y lo apunta en
//      lavalink/.youtube-cuenta.json, y el panel lo enseña.
//   3. Al aceptar en Google, Lavalink escribe el token y el lanzador lo guarda en el
//      mismo archivo (solo lo puede leer este usuario; no va a git ni al panel).
//   4. Cada vez que el bot se conecta a Lavalink le pasa el token (POST /youtube).
//      No va en application.yml a propósito: con un token caducado Lavalink NO
//      arranca (probado: «oauth2 token fetch: 400» tumba el arranque).
//
// Si cambias este archivo, reinicia también Lavalink (pm2 restart lavalink): el
// lanzador lo usa y el despliegue solo lo reinicia si cambia lavalink/ o el lanzador.

const fs = require('fs');
const path = require('path');

// SOKYO_CUENTA_YOUTUBE: otra ruta (solo la usan los tests).
const RUTA = process.env.SOKYO_CUENTA_YOUTUBE || path.join(__dirname, '..', 'lavalink', '.youtube-cuenta.json');

// Orden de clientes de YouTube con cuenta: TV (el que usa la cuenta) justo después
// de MUSIC (que solo busca). Sin cuenta se usa la lista de application.yml.
const CLIENTES_CON_CUENTA = 'MUSIC,TV,ANDROID_VR,WEB,WEBEMBEDDED,MWEB,IOS,TVHTML5_SIMPLY';

function leer() {
    try {
        const d = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
        return d && typeof d === 'object' ? d : {};
    } catch { return {}; }
}

// Escribe entero y de golpe (archivo temporal + renombrar), solo legible por este usuario.
function escribir(datos) {
    const tmp = `${RUTA}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(datos, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, RUTA);
}
const actualizar = (cambios) => { const d = { ...leer(), ...cambios }; escribir(d); return d; };

// Lee una línea de la salida de Lavalink y dice si es del inicio de sesión.
function interpretarLinea(linea) {
    const s = String(linea || '');
    let m = s.match(/OAUTH INTEGRATION: .*go to (https?:\/\/\S+) and enter code ([A-Z0-9-]{4,})/);
    if (m) return { tipo: 'codigo', url: m[1], codigo: m[2] };
    m = s.match(/OAUTH INTEGRATION: Token retrieved successfully\..*\((\S+)\)\s*$/);
    if (m) return { tipo: 'token', refreshToken: m[1] };
    if (/OAUTH INTEGRATION: The device token has expired/.test(s)) return { tipo: 'caducado' };
    if (/OAUTH INTEGRATION: Account linking was denied/.test(s)) return { tipo: 'denegado' };
    return null;
}

// Lo que ha pasado → estado guardado. Lo usa el lanzador.
function apuntarEvento(ev) {
    const ahora = Date.now();
    if (ev.tipo === 'codigo') return actualizar({ estado: 'esperando', url: ev.url, codigo: ev.codigo, desde: ahora });
    if (ev.tipo === 'token') return actualizar({ estado: 'conectada', refreshToken: ev.refreshToken, url: null, codigo: null, desde: ahora });
    if (ev.tipo === 'caducado' || ev.tipo === 'denegado') {
        const d = leer();
        // Solo si se estaba esperando: un aviso viejo no borra una cuenta ya conectada.
        if (d.estado !== 'esperando' && d.estado !== 'pidiendo') return d;
        return actualizar({ estado: ev.tipo, url: null, codigo: null, desde: ahora });
    }
    return leer();
}

// El lanzador avisa de que está (y de que lee la salida de Lavalink): sin esto el
// panel no puede ofrecer «Conectar», porque el código no llegaría.
function marcarLanzador() {
    const d = leer();
    // Al arrancar, un inicio de sesión a medias ya no vale (Lavalink lo ha olvidado).
    const aMedias = d.estado === 'esperando' || d.estado === 'pidiendo';
    return actualizar({ lanzador: Date.now(), ...(aMedias ? { estado: 'sin-cuenta', url: null, codigo: null } : {}) });
}

const hayCuenta = (d = leer()) => d.estado === 'conectada' && !!d.refreshToken;

// ---------------------------------------------------------------------------
// Lado del bot: hablar con Lavalink.
// ---------------------------------------------------------------------------
const lavalinkLocal = () => /^(localhost|127\.0\.0\.1|::1)$/i.test(process.env.LAVALINK_HOST || 'localhost');

async function peticion(ruta, { method = 'GET', body } = {}) {
    const host = process.env.LAVALINK_HOST || 'localhost';
    const puerto = Number(process.env.LAVALINK_PORT) || 2333;
    const res = await fetch(`http://${host}:${puerto}${ruta}`, {
        method,
        headers: { Authorization: process.env.LAVALINK_PASSWORD || 'sokyolavalink', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
    });
    return res;
}

// Al conectarse a Lavalink: le pasa la cuenta guardada. Si Google la rechaza
// (contraseña cambiada, acceso quitado…), se olvida y el panel pide conectarla otra vez.
// Con un token, Lavalink lo prueba con Google al momento (aunque skipInitialization
// sea true): si Google lo rechaza, responde 500 con «oauth2 token fetch: 400/401».
const rechazadoPorGoogle = (texto) => /token fetch: 40[01]\b/.test(String(texto || ''));
let reintento = null;

async function aplicarAlConectar() {
    if (!lavalinkLocal()) return;
    const d = leer();
    if (!hayCuenta(d)) return;
    clearTimeout(reintento);
    try {
        const res = await peticion('/youtube', { method: 'POST', body: { refreshToken: d.refreshToken, skipInitialization: true } });
        if (res.ok) { console.log('🎵 Cuenta de YouTube aplicada a Lavalink.'); return; }
        if (res.status === 404) return; // Lavalink sin el plugin de YouTube
        const texto = await res.text().catch(() => '');
        if (rechazadoPorGoogle(texto)) {
            console.warn('🎵 Google ha rechazado la cuenta de YouTube guardada. Hay que volver a conectarla desde el panel (Música).');
            actualizar({ estado: 'invalida', refreshToken: null, desde: Date.now() });
            await peticion('/youtube', { method: 'POST', body: { refreshToken: '', skipInitialization: true } }).catch(() => {});
            return;
        }
        // Otro fallo (sin conexión con Google, Lavalink arrancando…): la cuenta se queda y se reintenta.
        console.warn(`🎵 No se pudo pasar la cuenta de YouTube a Lavalink (${res.status}); se reintenta en un minuto.`);
    } catch (e) {
        console.warn('🎵 No se pudo pasar la cuenta de YouTube a Lavalink:', e.message, '(se reintenta en un minuto)');
    }
    reintento = setTimeout(() => aplicarAlConectar().catch(() => {}), 60 * 1000);
    reintento.unref?.();
}

// Estado para el panel (nunca el token).
function estadoCuenta() {
    const d = leer();
    const estado = hayCuenta(d) ? 'conectada' : (d.estado && d.estado !== 'conectada' ? d.estado : 'sin-cuenta');
    return {
        disponible: lavalinkLocal() && !!d.lanzador,
        estado,
        url: estado === 'esperando' ? d.url : null,
        codigo: estado === 'esperando' ? d.codigo : null,
        desde: d.desde || null,
    };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Empieza el inicio de sesión y devuelve el código que hay que escribir en Google.
async function empezarConexion() {
    if (!lavalinkLocal()) return { error: 'remoto' };
    const antes = leer();
    if (!antes.lanzador) return { error: 'lanzador' };
    const pedido = Date.now();
    // Si no sale bien, todo vuelve a como estaba (también la cuenta que hubiera).
    const deshacer = async () => {
        const ahora = leer();
        escribir({ ...antes, lanzador: ahora.lanzador || antes.lanzador });
        if (hayCuenta(antes)) await aplicarAlConectar().catch(() => {});
    };
    actualizar({ estado: 'pidiendo', url: null, codigo: null, desde: pedido });
    let res;
    try {
        res = await peticion('/youtube', { method: 'POST', body: { refreshToken: '', skipInitialization: false } });
    } catch {
        await deshacer();
        return { error: 'apagado' };
    }
    if (!res.ok) { await deshacer(); return { error: res.status === 404 ? 'sin-plugin' : 'fallo' }; }
    // Lavalink ya ha olvidado la cuenta anterior para empezar de nuevo: aquí también.
    actualizar({ refreshToken: null });
    // El lanzador apunta el código en cuanto Lavalink lo escribe (suele ser al momento).
    const llego = () => { const d = leer(); return d.estado === 'esperando' && d.desde >= pedido && !!d.codigo; };
    for (let i = 0; i < 40; i++) {
        if (llego()) return { ok: true, ...estadoCuenta() };
        await esperar(250);
    }
    if (llego()) return { ok: true, ...estadoCuenta() }; // justo al final
    await deshacer();
    return { error: 'sin-codigo' };
}

async function desconectar() {
    if (lavalinkLocal()) await peticion('/youtube', { method: 'POST', body: { refreshToken: '', skipInitialization: true } }).catch(() => {});
    actualizar({ estado: 'sin-cuenta', refreshToken: null, url: null, codigo: null, desde: Date.now() });
    return { ok: true, ...estadoCuenta() };
}

module.exports = {
    RUTA, CLIENTES_CON_CUENTA, leer, interpretarLinea, apuntarEvento, marcarLanzador, hayCuenta,
    aplicarAlConectar, estadoCuenta, empezarConexion, desconectar,
};
