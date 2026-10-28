// Confirmaciones de acciones peligrosas (!ban, !kick…): el bot pregunta con dos
// botones y solo quien lo pidió puede confirmar. Se guardan un rato en memoria.
const crypto = require('crypto');

const pendientes = new Map(); // id -> { autorId, expira, datos }
const DURACION = 2 * 60 * 1000;

function guardarPendiente(autorId, datos) {
    const ahora = Date.now();
    for (const [k, v] of pendientes) if (v.expira < ahora) pendientes.delete(k);
    const id = crypto.randomBytes(6).toString('hex');
    pendientes.set(id, { autorId, expira: ahora + DURACION, datos });
    return id;
}

// Lo saca (una sola vez). null si caducó o no existe.
function tomarPendiente(id) {
    const p = pendientes.get(id);
    if (!p) return null;
    pendientes.delete(id);
    return p.expira >= Date.now() ? p : null;
}

const verPendiente = (id) => pendientes.get(id) || null;

module.exports = { guardarPendiente, tomarPendiente, verPendiente, DURACION };
