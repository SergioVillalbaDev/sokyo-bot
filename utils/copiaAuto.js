// 💾 Copia de seguridad automática (2.4.0). El bot lanza una vez al día scripts/backup.js (toda la base de datos
// a un .json.gz en BACKUP_DIR, con rotación y, si hay BACKUP_WEBHOOK_URL, copia en Discord). Así no depende de que
// alguien haya puesto un cron en la Pi. Si ya hay una copia de menos de 20 h (p. ej. de un cron), no hace otra.
// Se apaga con BACKUP_AUTOMATICO=no. Va en otro proceso para no frenar al bot.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DIR = () => process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const estado = { ultima: null, error: null, enCurso: false, intento: 0 };
const ESPERA_FALLO = 6 * 3600000; // tras un fallo no se reintenta enseguida (cada intento lee toda la base de datos)

// ¿Cuándo se hizo la última copia? (null si no hay)
function ultimaCopia(dir = DIR()) {
    try {
        const t = fs.readdirSync(dir).filter((f) => f.startsWith('sokyo-') && f.endsWith('.json.gz'))
            .map((f) => fs.statSync(path.join(dir, f)).mtimeMs).sort((a, b) => b - a)[0];
        return t ? new Date(t) : null;
    } catch { return null; }
}
const toca = (ultima, ahora = Date.now()) => !ultima || ahora - new Date(ultima).getTime() >= 20 * 3600000;

function hacerCopia() {
    if (String(process.env.BACKUP_AUTOMATICO || '').toLowerCase() === 'no' || !process.env.MONGO_URI) return Promise.resolve(false);
    if (estado.enCurso) return Promise.resolve(false);
    if (estado.error && Date.now() - estado.intento < ESPERA_FALLO) return Promise.resolve(false);
    const previa = ultimaCopia();
    estado.ultima = previa;
    if (!toca(previa)) return Promise.resolve(false);
    estado.enCurso = true;
    estado.intento = Date.now();
    return new Promise((resolve) => {
        const hijo = spawn(process.execPath, [path.join(__dirname, '..', 'scripts', 'backup.js')], { stdio: ['ignore', 'ignore', 'pipe'], env: process.env });
        let err = '';
        hijo.stderr.on('data', (d) => { err = (err + d).slice(-500); });
        hijo.on('close', (code) => {
            estado.enCurso = false;
            estado.ultima = ultimaCopia();
            estado.error = code === 0 ? null : (err.trim() || `salió con código ${code}`).slice(0, 200);
            if (code === 0) console.log('💾 Copia de seguridad diaria hecha.'); else console.error('💾 Copia de seguridad diaria:', estado.error);
            resolve(code === 0);
        });
        hijo.on('error', (e) => { estado.enCurso = false; estado.error = e.message; resolve(false); });
    });
}

// Para /api/health: solo la fecha y si fue bien (nunca el texto del error: podría llevar datos internos).
function resumen() {
    if (estado.ultima === null && !estado.leida) { estado.ultima = ultimaCopia(); estado.leida = true; }
    return { ultima: estado.ultima ? new Date(estado.ultima).toISOString() : null, ok: !estado.error };
}

module.exports = { hacerCopia, ultimaCopia, toca, resumen, estado };
