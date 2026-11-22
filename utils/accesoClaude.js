// Acceso de Claude a la configuración de los servidores (1.23.0).
// Un propietario crea una clave en el panel (solo se enseña una vez) y se la da a
// Claude. Con ella, la API deja entrar SOLO a /api/claude/… (nada de cobros, planes
// ni lo demás del propietario). En modo «lectura» solo puede mirar; en «completo»
// también cambiar, y cada cambio queda en el «Historial de cambios» con «Deshacer».
const crypto = require('crypto');
const AccesoClaude = require('../models/AccesoClaude.js');

const PREFIJO = 'sokyo_claude_';
const huella = (clave) => crypto.createHash('sha256').update(String(clave)).digest('hex');
const pareceClave = (clave) => typeof clave === 'string' && clave.startsWith(PREFIJO) && clave.length > PREFIJO.length + 20;

// Una clave nueva (borra las anteriores: solo hay una a la vez).
async function crear({ modo = 'lectura', dias = 0, por = null } = {}) {
    const clave = PREFIJO + crypto.randomBytes(24).toString('base64url');
    await AccesoClaude.deleteMany({});
    await AccesoClaude.create({
        hash: huella(clave), pista: clave.slice(-4), modo: modo === 'completo' ? 'completo' : 'lectura', creadoPor: por,
        caduca: dias > 0 ? new Date(Date.now() + Math.min(365, dias) * 86400000) : null,
    });
    cache.clear();
    return clave;
}
async function revocar() { await AccesoClaude.deleteMany({}); cache.clear(); }
async function estado() {
    const a = await AccesoClaude.findOne().lean();
    return a ? { activo: !a.caduca || a.caduca > new Date(), modo: a.modo, pista: a.pista, creado: a.creado, caduca: a.caduca, ultimoUso: a.ultimoUso, usos: a.usos } : null;
}
async function cambiarModo(modo) {
    await AccesoClaude.updateMany({}, { $set: { modo: modo === 'completo' ? 'completo' : 'lectura' } });
    cache.clear();
}

// Comprueba la clave (con memoria de 30 s para no ir a la base de datos en cada petición).
const cache = new Map();
async function verificar(clave) {
    if (!pareceClave(clave)) return null;
    const h = huella(clave);
    const c = cache.get(h);
    if (c && c.hasta > Date.now()) return c.acceso;
    const a = await AccesoClaude.findOne({ hash: h }).lean();
    const acceso = a && (!a.caduca || a.caduca > new Date()) ? { modo: a.modo } : null;
    cache.set(h, { acceso, hasta: Date.now() + 30000 });
    if (acceso) AccesoClaude.updateOne({ hash: h }, { $set: { ultimoUso: new Date() }, $inc: { usos: 1 } }).catch(() => {});
    return acceso;
}

module.exports = { PREFIJO, huella, pareceClave, crear, revocar, estado, cambiarModo, verificar };
