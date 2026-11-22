// Acceso de soporte a la configuración de los servidores (1.23.0; lo usa Claude, el
// asistente que programa Sokyo). Un propietario crea una clave en el panel (solo se
// enseña una vez). Con ella, la API deja entrar SOLO a /api/soporte/… (nada de cobros, planes
// ni lo demás del propietario). En modo «lectura» solo puede mirar; en «completo»
// también cambiar, y cada cambio queda en el «Historial de cambios» con «Deshacer».
const crypto = require('crypto');
const AccesoSoporte = require('../models/AccesoSoporte.js');

const PREFIJO = 'sk_soporte_';
const huella = (clave) => crypto.createHash('sha256').update(String(clave)).digest('hex');
const pareceClave = (clave) => typeof clave === 'string' && clave.startsWith(PREFIJO) && clave.length > PREFIJO.length + 20;

// Una clave nueva (borra las anteriores: solo hay una a la vez).
async function crear({ modo = 'lectura', dias = 0, por = null } = {}) {
    const clave = PREFIJO + crypto.randomBytes(24).toString('base64url');
    await AccesoSoporte.deleteMany({});
    await AccesoSoporte.create({
        hash: huella(clave), pista: clave.slice(-4), modo: modo === 'completo' ? 'completo' : 'lectura', creadoPor: por,
        caduca: dias > 0 ? new Date(Date.now() + Math.min(365, dias) * 86400000) : null,
    });
    cache.clear();
    return clave;
}
async function revocar() { await AccesoSoporte.deleteMany({}); cache.clear(); }
async function estado() {
    const a = await AccesoSoporte.findOne().lean();
    return a ? { activo: !a.caduca || a.caduca > new Date(), modo: a.modo, pista: a.pista, creado: a.creado, caduca: a.caduca, ultimoUso: a.ultimoUso, usos: a.usos } : null;
}
async function cambiarModo(modo) {
    await AccesoSoporte.updateMany({}, { $set: { modo: modo === 'completo' ? 'completo' : 'lectura' } });
    cache.clear();
}

// Comprueba la clave (con memoria de 30 s para no ir a la base de datos en cada petición).
const cache = new Map();
async function verificar(clave) {
    if (!pareceClave(clave)) return null;
    const h = huella(clave);
    const c = cache.get(h);
    if (c && c.hasta > Date.now()) return c.acceso;
    const a = await AccesoSoporte.findOne({ hash: h }).lean();
    const acceso = a && (!a.caduca || a.caduca > new Date()) ? { modo: a.modo } : null;
    cache.set(h, { acceso, hasta: Date.now() + 30000 });
    if (acceso) AccesoSoporte.updateOne({ hash: h }, { $set: { ultimoUso: new Date() }, $inc: { usos: 1 } }).catch(() => {});
    return acceso;
}

module.exports = { PREFIJO, huella, pareceClave, crear, revocar, estado, cambiarModo, verificar };
