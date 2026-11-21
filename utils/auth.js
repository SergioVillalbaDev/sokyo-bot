// Tokens de sesión firmados para el Portal del Cliente.
// Usa HMAC-SHA256 con el módulo nativo `crypto` — sin dependencias externas.
// Formato: base64url(payload).base64url(firma)  (estilo JWT simplificado).
const crypto = require('crypto');

const b64url = (str) => Buffer.from(str).toString('base64url');

function firmarToken(payload, secret, expiraEnSeg = 60 * 60 * 24 * 7) {
    const cuerpo = { ...payload, exp: Math.floor(Date.now() / 1000) + expiraEnSeg };
    const datos = b64url(JSON.stringify(cuerpo));
    const firma = crypto.createHmac('sha256', secret).update(datos).digest('base64url');
    return `${datos}.${firma}`;
}

// `tipo` ('portal' | 'staff'): un token de un tipo no sirve para el otro.
function verificarToken(token, secret, tipo) {
    if (typeof token !== 'string' || !secret) return null;
    const partes = token.split('.');
    if (partes.length !== 2) return null;
    const [datos, firma] = partes;
    const esperada = crypto.createHmac('sha256', secret).update(datos).digest('base64url');
    if (firma.length !== esperada.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;

    let payload;
    try { payload = JSON.parse(Buffer.from(datos, 'base64url').toString()); } catch { return null; }
    if (!payload || typeof payload !== 'object') return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (tipo && payload.tipo !== tipo) return null;
    return payload;
}

module.exports = { firmarToken, verificarToken };
