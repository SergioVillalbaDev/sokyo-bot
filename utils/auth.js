// Tokens de sesión firmados para el Portal del Cliente.
// Usa HMAC-SHA256 con el módulo nativo `crypto` — sin dependencias externas.
// Formato: base64url(payload).base64url(firma)  (estilo JWT simplificado).
const crypto = require('crypto');
const fs = require('fs');

const b64url = (str) => Buffer.from(str).toString('base64url');

function firmarToken(payload, secret, expiraEnSeg = 60 * 60 * 24 * 7) {
    const cuerpo = { ...payload, exp: Math.floor(Date.now() / 1000) + expiraEnSeg };
    const datos = b64url(JSON.stringify(cuerpo));
    const firma = crypto.createHmac('sha256', secret).update(datos).digest('base64url');
    return `${datos}.${firma}`;
}

function verificarToken(token, secret) {
    if (typeof token !== 'string') return null;
    const partes = token.split('.');
    if (partes.length !== 2) return null;
    const [datos, firma] = partes;
    const esperada = crypto.createHmac('sha256', secret).update(datos).digest('base64url');
    // Se comparan bytes (no caracteres): con caracteres no ASCII las longitudes
    // podrían coincidir en texto y no en bytes, y timingSafeEqual lanzaría.
    const a = Buffer.from(firma);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    let payload;
    try { payload = JSON.parse(Buffer.from(datos, 'base64url').toString()); } catch { return null; }
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
}

// Secreto aleatorio guardado en un archivo: se crea la primera vez y después se
// reutiliza, para que las sesiones firmadas con él sobrevivan a los reinicios.
function secretoGuardado(ruta) {
    try {
        const guardado = fs.readFileSync(ruta, 'utf8').trim();
        if (guardado.length >= 32) return guardado;
    } catch { /* todavía no existe */ }
    const nuevo = crypto.randomBytes(32).toString('hex');
    try {
        fs.writeFileSync(ruta, nuevo, { mode: 0o600 });
    } catch (e) {
        console.warn(`⚠️ No se pudo guardar el secreto de sesión en ${ruta} (${e.message}): las sesiones se perderán al reiniciar.`);
    }
    return nuevo;
}

module.exports = { firmarToken, verificarToken, secretoGuardado };
