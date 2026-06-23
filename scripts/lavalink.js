// Lanzador del servidor de música.
// Arranca DOS cosas en una sola terminal:
//   1. El servidor de tokens de Spotify (si está la carpeta spotify-tokener).
//      Lo necesita LavaSrc para cargar álbumes/playlists/búsquedas de Spotify.
//   2. El servidor Lavalink (Lavalink.jar), que procesa el audio.
// Carga el .env del bot para la contraseña y demás variables.
//
// Uso:  npm run lavalink   (déjalo en una terminal aparte, igual que el bot)

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const procesos = [];
const matarTodos = () => { for (const p of procesos) { try { p.kill(); } catch { /* ya muerto */ } } };
process.on('SIGINT', () => { matarTodos(); process.exit(0); });
process.on('exit', matarTodos);

// 1. Servidor de tokens de Spotify (opcional: solo si existe la carpeta).
const tokenerDir = path.join(__dirname, '..', 'spotify-tokener');
if (fs.existsSync(path.join(tokenerDir, 'index.js'))) {
    console.log('🎫 Arrancando servidor de tokens de Spotify (puerto 37353)...');
    const tok = spawn('node', ['index.js'], { cwd: tokenerDir, stdio: 'inherit', env: process.env });
    tok.on('error', (err) => console.error('🎫 Error en el servidor de tokens:', err.message));
    procesos.push(tok);
}

// 2. Servidor Lavalink.
console.log('🎵 Arrancando Lavalink... (la primera vez descarga los plugins, espera un poco)');
const java = spawn('java', ['-jar', 'Lavalink.jar'], {
    cwd: path.join(__dirname, '..', 'lavalink'),
    stdio: 'inherit',
    env: process.env,
});
procesos.push(java);

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
