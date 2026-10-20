// Middleware de autenticación y permisos de la API.
const { verificarToken, igualesSeguro } = require('../utils/auth.js');
const { obtenerConfig } = require('../utils/config.js');
const { esStaff } = require('../utils/permisos.js');

const TTL_MIEMBRO_MS = 60 * 1000;
const cacheMiembros = new Map(); // `${guildId}:${userId}` -> { miembro, expira }

// Miembro de un servidor (o null si no está). Cachea también los "no está" para no
// preguntar a Discord en cada petición.
async function obtenerMiembro(guild, usuarioId) {
    if (!usuarioId) return null;
    const enCache = guild.members.cache.get(usuarioId);
    if (enCache) return enCache;

    const clave = `${guild.id}:${usuarioId}`;
    const guardado = cacheMiembros.get(clave);
    if (guardado && guardado.expira > Date.now()) return guardado.miembro;

    const miembro = await guild.members.fetch(usuarioId).catch(() => null);
    if (cacheMiembros.size > 5000) cacheMiembros.clear();
    cacheMiembros.set(clave, { miembro, expira: Date.now() + TTL_MIEMBRO_MS });
    return miembro;
}

async function esStaffDe(guild, usuarioId) {
    const miembro = await obtenerMiembro(guild, usuarioId);
    if (!miembro) return false;
    return esStaff(miembro, await obtenerConfig(guild.id));
}

// Identifica a quien llama: sesión de Discord (Bearer <token>) o clave de API
// (cabecera x-api-key o Bearer <API_KEY>), que da acceso de administrador a todo.
function crearAutenticacion({ apiKey, jwtSecret }) {
    return (req, res, next) => {
        const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
        const clave = String(req.headers['x-api-key'] || '').trim();

        if (apiKey && ((clave && igualesSeguro(clave, apiKey)) || (bearer && igualesSeguro(bearer, apiKey)))) {
            req.auth = { tipo: 'apikey', usuario: { id: null, username: 'Administrador', avatar: null } };
            return next();
        }

        const sesion = verificarToken(bearer, jwtSecret);
        if (!sesion?.id) return res.status(401).json({ error: 'Sesión no válida o caducada. Vuelve a iniciar sesión.' });
        req.auth = { tipo: 'discord', usuario: { id: sesion.id, username: sesion.username, avatar: sesion.avatar || null } };
        next();
    };
}

// Exige ser staff del servidor de la URL (:guildId) y deja el servidor en req.guild.
function staffDeServidor(client) {
    return async (req, res, next) => {
        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).json({ error: 'El bot no está en ese servidor.' });
        if (req.auth.tipo !== 'apikey' && !(await esStaffDe(guild, req.auth.usuario.id))) {
            return res.status(403).json({ error: 'No formas parte del staff de este servidor.' });
        }
        req.guild = guild;
        next();
    };
}

function soloSesionDiscord(req, res, next) {
    if (req.auth.tipo !== 'discord') return res.status(403).json({ error: 'El portal requiere iniciar sesión con Discord.' });
    next();
}

// Limitador sencillo en memoria (por usuario o IP) para las rutas que escriben en Discord.
function limitador({ ventanaMs = 10 * 1000, max = 5 } = {}) {
    const golpes = new Map();
    return (req, res, next) => {
        const clave = req.auth?.usuario?.id || req.ip;
        const ahora = Date.now();
        const recientes = (golpes.get(clave) || []).filter(t => ahora - t < ventanaMs);
        if (recientes.length >= max) return res.status(429).json({ error: 'Vas demasiado rápido. Espera unos segundos e inténtalo de nuevo.' });
        recientes.push(ahora);
        if (golpes.size > 10000) golpes.clear();
        golpes.set(clave, recientes);
        next();
    };
}

const infoServidor = (guild) => ({
    id: guild.id,
    nombre: guild.name,
    icono: guild.iconURL({ extension: 'png', size: 128 }),
    miembros: guild.memberCount
});

module.exports = { crearAutenticacion, staffDeServidor, soloSesionDiscord, limitador, obtenerMiembro, esStaffDe, infoServidor };
