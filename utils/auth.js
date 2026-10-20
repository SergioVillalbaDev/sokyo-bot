// Tokens de sesión firmados para el panel y el portal.
// Usa HMAC-SHA256 con el módulo nativo `crypto` — sin dependencias externas.
// Formato: base64url(payload).base64url(firma)  (estilo JWT simplificado).
const crypto = require('crypto');

const b64url = (str) => Buffer.from(str).toString('base64url');
const firmar = (datos, secret) => crypto.createHmac('sha256', secret).update(datos).digest('base64url');

// Comparación en tiempo constante que no lanza si las longitudes difieren.
function igualesSeguro(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function firmarToken(payload, secret, expiraEnSeg = 60 * 60 * 24 * 7) {
    const cuerpo = { ...payload, exp: Math.floor(Date.now() / 1000) + expiraEnSeg };
    const datos = b64url(JSON.stringify(cuerpo));
    return `${datos}.${firmar(datos, secret)}`;
}

function verificarToken(token, secret) {
    if (typeof token !== 'string') return null;
    const partes = token.split('.');
    if (partes.length !== 2) return null;
    const [datos, firma] = partes;
    if (!igualesSeguro(firma, firmar(datos, secret))) return null;

    let payload;
    try { payload = JSON.parse(Buffer.from(datos, 'base64url').toString()); } catch { return null; }
    if (!payload || typeof payload !== 'object') return null;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
}

module.exports = { firmarToken, verificarToken, igualesSeguro };
