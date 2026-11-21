const crypto = require('crypto');

// Comparación en tiempo constante (sin filtrar la longitud): compara hashes SHA-256.
function compararSeguro(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const ha = crypto.createHash('sha256').update(a).digest();
    const hb = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(ha, hb);
}

// Limitador de peticiones en memoria (ventana fija por IP). Sin dependencias externas.
function crearLimitador({ ventanaMs, max, mensaje = 'Demasiadas peticiones, inténtalo más tarde.' }) {
    const golpes = new Map();
    const limpieza = setInterval(() => {
        const ahora = Date.now();
        for (const [clave, e] of golpes) if (e.reinicio <= ahora) golpes.delete(clave);
    }, ventanaMs);
    limpieza.unref();

    return (req, res, next) => {
        const clave = req.ip || 'desconocida';
        const ahora = Date.now();
        let e = golpes.get(clave);
        if (!e || e.reinicio <= ahora) { e = { n: 0, reinicio: ahora + ventanaMs }; golpes.set(clave, e); }
        e.n++;
        if (e.n > max) {
            res.set('Retry-After', String(Math.ceil((e.reinicio - ahora) / 1000)));
            return res.status(429).json({ error: mensaje });
        }
        next();
    };
}

module.exports = { compararSeguro, crearLimitador };
