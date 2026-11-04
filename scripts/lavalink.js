// Lanzador del servidor de música.
// Arranca DOS cosas en una sola terminal:
//   1. El servidor de tokens de Spotify (si está la carpeta spotify-tokener).
//      Lo necesita LavaSrc para cargar álbumes/playlists/búsquedas de Spotify.
//   2. El servidor Lavalink (Lavalink.jar), que procesa el audio.
// Carga el .env del bot para la contraseña y demás variables.
//
// Antes de arrancar Lavalink comprueba su versión: desde marzo de 2026 Discord
// solo deja sonar el audio cifrado (DAVE) y eso solo lo hace Lavalink 4.2 o más
// nuevo. Con uno anterior el bot entra al canal, «reproduce»… y no se oye nada.
// Si el Lavalink.jar es viejo (o no está), descarga el bueno él solo.
// LAVALINK_AUTO_UPDATE=0 lo desactiva y LAVALINK_VERSION elige otra versión.
//
// También lee lo que escribe Lavalink para la cuenta de YouTube (panel → Música):
// apunta el código de inicio de sesión de Google y el token que da al aceptar
// (utils/cuentaYoutube.js). Con cuenta, el cliente TV de YouTube va el primero.
//
// Uso:  npm run lavalink   (déjalo en una terminal aparte, igual que el bot)

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { StringDecoder } = require('string_decoder');
const cuentaYoutube = require('../utils/cuentaYoutube.js');

const VERSION_LAVALINK = process.env.LAVALINK_VERSION || '4.2.2';
const VERSION_MINIMA = '4.2.0'; // la primera con DAVE (audio cifrado de Discord)
const DIR = path.join(__dirname, '..', 'lavalink');
const JAR = path.join(DIR, 'Lavalink.jar');
// Nota de la versión descargada (por si un .jar no la lleva en su manifiesto).
const NOTA = path.join(DIR, '.version.json');

const procesos = [];
const matarTodos = () => { for (const p of procesos) { try { p.kill(); } catch { /* ya muerto */ } } };
process.on('SIGINT', () => { matarTodos(); process.exit(0); });
process.on('exit', matarTodos);

// "4.2.2" -> [4, 2, 2]; compara dos versiones (negativo si a < b).
const partes = (v) => String(v).split(/[.-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
const comparar = (a, b) => { const x = partes(a); const y = partes(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

// Versión de un Lavalink.jar sin arrancarlo: la lleva su META-INF/MANIFEST.MF
// (Implementation-Version). Un .jar es un zip: se busca esa entrada en su índice.
function versionDelJar(ruta) {
    let fd;
    try {
        fd = fs.openSync(ruta, 'r');
        const tam = fs.fstatSync(fd).size;
        const largo = Math.min(tam, 65557); // el índice termina en los últimos 64 KB
        const cola = Buffer.alloc(largo);
        fs.readSync(fd, cola, 0, largo, tam - largo);
        let fin = -1;
        for (let i = largo - 22; i >= 0; i--) if (cola.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
        if (fin < 0) return null;
        const entradas = cola.readUInt16LE(fin + 10);
        const indice = Buffer.alloc(cola.readUInt32LE(fin + 12));
        fs.readSync(fd, indice, 0, indice.length, cola.readUInt32LE(fin + 16));
        for (let p = 0, n = 0; n < entradas && p + 46 <= indice.length; n++) {
            if (indice.readUInt32LE(p) !== 0x02014b50) return null;
            const metodo = indice.readUInt16LE(p + 10);
            const comprimido = indice.readUInt32LE(p + 20);
            const largoNombre = indice.readUInt16LE(p + 28);
            const nombre = indice.toString('utf8', p + 46, p + 46 + largoNombre);
            if (nombre === 'META-INF/MANIFEST.MF') {
                const local = indice.readUInt32LE(p + 42);
                const cabecera = Buffer.alloc(30);
                fs.readSync(fd, cabecera, 0, 30, local);
                const datos = Buffer.alloc(comprimido);
                fs.readSync(fd, datos, 0, comprimido, local + 30 + cabecera.readUInt16LE(26) + cabecera.readUInt16LE(28));
                const texto = (metodo === 8 ? zlib.inflateRawSync(datos) : datos).toString('utf8');
                return (texto.match(/^Implementation-Version:\s*(\S+)/m) || [])[1] || null;
            }
            p += 46 + largoNombre + indice.readUInt16LE(p + 30) + indice.readUInt16LE(p + 32);
        }
        return null;
    } catch {
        return null;
    } finally {
        if (fd !== undefined) fs.closeSync(fd);
    }
}

// Descarga el Lavalink.jar de la versión elegida (de GitHub) y solo lo pone en
// su sitio si llega entero y es esa versión. El anterior se guarda al lado.
async function descargarLavalink(version) {
    const url = `https://github.com/lavalink-devs/Lavalink/releases/download/${version}/Lavalink.jar`;
    const temporal = `${JAR}.descarga`;
    console.log(`🎵 Descargando Lavalink ${version} (unos 100 MB, puede tardar un par de minutos)...`);
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`GitHub respondió ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(temporal));
    const descargada = versionDelJar(temporal);
    if (descargada !== version) {
        fs.rmSync(temporal, { force: true });
        throw new Error(`el archivo descargado no es Lavalink ${version} (${descargada || 'ilegible'})`);
    }
    if (fs.existsSync(JAR)) fs.renameSync(JAR, `${JAR}.anterior`);
    fs.renameSync(temporal, JAR);
    try { fs.writeFileSync(NOTA, JSON.stringify({ version, tamano: fs.statSync(JAR).size })); } catch { /* solo es una ayuda */ }
    console.log(`🎵 Lavalink ${version} listo (el anterior queda en lavalink/Lavalink.jar.anterior).`);
}

// Versión del Lavalink.jar que hay: la de su manifiesto o, si no la lleva, la de
// la nota que se deja al descargarlo (si el archivo es el mismo).
function versionInstalada() {
    if (!fs.existsSync(JAR)) return null;
    const enJar = versionDelJar(JAR);
    if (enJar) return enJar;
    try {
        const nota = JSON.parse(fs.readFileSync(NOTA, 'utf8'));
        return nota.tamano === fs.statSync(JAR).size ? nota.version : null;
    } catch { return null; }
}

async function asegurarLavalink() {
    const actual = versionInstalada();
    const viejo = !actual || comparar(actual, VERSION_MINIMA) < 0;
    if (process.env.LAVALINK_AUTO_UPDATE === '0') {
        if (viejo) console.warn(`⚠️  Lavalink ${actual || '(no encontrado)'}: hace falta 4.2 o más nuevo para que Discord deje sonar la música.`);
        return;
    }
    // Con LAVALINK_VERSION se fija otra versión (también para volver atrás).
    const pedida = process.env.LAVALINK_VERSION && actual !== VERSION_LAVALINK;
    if (!viejo && !pedida) { console.log(`🎵 Lavalink ${actual}`); return; }
    if (actual) console.log(`🎵 Tienes Lavalink ${actual}; ${viejo ? 'Discord exige 4.2 o más nuevo (audio cifrado)' : 'se pide otra versión'}.`);
    try {
        await descargarLavalink(VERSION_LAVALINK);
    } catch (err) {
        console.error(`❌ No se pudo descargar Lavalink ${VERSION_LAVALINK}: ${err.message}`);
        if (!fs.existsSync(JAR)) { console.error('   Sin Lavalink.jar no hay música. Descárgalo a mano en lavalink/.'); process.exit(1); }
        console.error('   Sigo con el que hay; puede que la música no suene. Se reintentará al reiniciar.');
    }
}

// El cifrado de voz (DAVE) de Lavalink necesita glibc 2.35 o más nuevo
// (Raspberry Pi OS «Bookworm» o Ubuntu 22.04). Si no, se avisa bien claro.
function avisarSistema() {
    const glibc = process.report?.getReport?.()?.header?.glibcVersionRuntime;
    if (process.platform === 'linux' && glibc && comparar(glibc, '2.35') < 0) {
        console.warn(`⚠️  Este sistema tiene glibc ${glibc} y el audio cifrado de Discord necesita 2.35 o más nuevo.`);
        console.warn('   La música no sonará hasta actualizar el sistema (Raspberry Pi OS Bookworm o más nuevo).');
    }
}

// Pasa la salida de Lavalink tal cual (pm2 la sigue guardando) y, línea a línea,
// apunta lo del inicio de sesión de YouTube.
function vigilarSalida(flujo, destino) {
    const decoder = new StringDecoder('utf8');
    let resto = '';
    flujo.on('data', (trozo) => {
        destino.write(trozo);
        resto += decoder.write(trozo);
        const lineas = resto.split('\n');
        resto = lineas.pop();
        if (resto.length > 20000) resto = ''; // una «línea» sin fin no es de las que buscamos
        for (const linea of lineas) {
            const ev = cuentaYoutube.interpretarLinea(linea);
            if (!ev) continue;
            try {
                cuentaYoutube.apuntarEvento(ev);
                if (ev.tipo === 'token') console.log('🎵 Cuenta de YouTube conectada y guardada (lavalink/.youtube-cuenta.json).');
            } catch (err) { console.error('🎵 No se pudo guardar el estado de la cuenta de YouTube:', err.message); }
        }
    });
}

// Variables para Lavalink: con cuenta de YouTube, el cliente TV (el que la usa) va
// el primero. Si YOUTUBE_CLIENTS ya está en el .env, manda esa.
function entornoLavalink() {
    const env = { ...process.env };
    if (!env.YOUTUBE_CLIENTS && cuentaYoutube.hayCuenta()) env.YOUTUBE_CLIENTS = cuentaYoutube.CLIENTES_CON_CUENTA;
    return env;
}

async function main() {
    // 1. Servidor de tokens de Spotify (opcional: solo si existe la carpeta).
    const tokenerDir = path.join(__dirname, '..', 'spotify-tokener');
    if (fs.existsSync(path.join(tokenerDir, 'index.js'))) {
        console.log('🎫 Arrancando servidor de tokens de Spotify (puerto 37353)...');
        const tok = spawn('node', ['index.js'], { cwd: tokenerDir, stdio: 'inherit', env: process.env });
        tok.on('error', (err) => console.error('🎫 Error en el servidor de tokens:', err.message));
        procesos.push(tok);
    }

    // 2. Servidor Lavalink (con la versión buena).
    avisarSistema();
    await asegurarLavalink();
    console.log('🎵 Arrancando Lavalink... (la primera vez descarga los plugins, espera un poco)');
    try { cuentaYoutube.marcarLanzador(); } catch (err) { console.error('🎵 No se pudo preparar la cuenta de YouTube:', err.message); }
    if (cuentaYoutube.hayCuenta()) console.log('🎵 Hay una cuenta de YouTube conectada: el bot se la pasará a Lavalink al conectarse.');
    const java = spawn('java', ['-jar', 'Lavalink.jar'], { cwd: DIR, stdio: ['inherit', 'pipe', 'pipe'], env: entornoLavalink() });
    procesos.push(java);
    vigilarSalida(java.stdout, process.stdout);
    vigilarSalida(java.stderr, process.stderr);

    java.on('error', (err) => {
        if (err.code === 'ENOENT') {
            console.error('❌ No se encontró Java. Instala Java 17+ (tú tienes 21) y reinténtalo.');
        } else {
            console.error('❌ Error al arrancar Lavalink:', err.message);
        }
        matarTodos();
        process.exit(1);
    });

    java.on('exit', (code) => { matarTodos(); process.exit(code ?? 0); });
}

if (require.main === module) main();
module.exports = { versionDelJar, comparar, asegurarLavalink, vigilarSalida, entornoLavalink };
