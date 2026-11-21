// Confirmación doble para acciones peligrosas del panel (1.13.0): borrar un rol, un canal
// o una categoría y las sanciones masivas. La primera petición no hace nada: el bot manda
// por privado un código de 6 dígitos a quien lo pide y la API responde 428 { codigo:
// 'confirmar' }. El panel lo pide (ConfirmacionAccion.jsx) y repite la petición con la
// cabecera X-Sokyo-Confirmacion. Si no se le puede escribir por privado, se confirma
// escribiendo el nombre exacto del servidor. Caduca a los 10 min y admite 5 intentos.
// Con la API key (sin sesión de staff, p. ej. scripts del propietario) no se pide.
const crypto = require('crypto');
const { t } = require('./i18n.js');

const DURACION = 10 * 60 * 1000;
const MAX_INTENTOS = 5;
const pendientes = new Map(); // `${userId}:${guildId}` -> { hash, expira, intentos, via, nombre }
const hash = (x) => crypto.createHash('sha256').update(String(x)).digest('hex');
const igualSeguro = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

const ACCIONES = {
    'borrar-rol': ['borrar un rol', 'delete a role'],
    'borrar-canal': ['borrar un canal', 'delete a channel'],
    'borrar-categoria': ['borrar una categoría', 'delete a category'],
    'sancion-masiva': ['sancionar a varias personas a la vez', 'sanction several people at once'],
};

// Comprueba lo que manda el panel contra lo pendiente. 'ok' | 'mal' | 'nada'.
function comprobar(clave, enviado, ahora = Date.now()) {
    const p = pendientes.get(clave);
    if (!p || p.expira < ahora) { pendientes.delete(clave); return 'nada'; }
    const valor = String(enviado || '').trim();
    const ok = p.via === 'md' ? igualSeguro(hash(valor), p.hash) : valor.toLowerCase() === p.nombre.trim().toLowerCase();
    if (ok) { pendientes.delete(clave); return 'ok'; }
    p.intentos++;
    if (p.intentos >= MAX_INTENTOS) pendientes.delete(clave);
    return 'mal';
}

// Fábrica del middleware: exigeConfirmacion('borrar-rol', (req) => guildId).
function crearExigeConfirmacion(client) {
    return (accion, guildDe = (req) => req.params.guildId || (req.body && req.body.guildId) || req.query.guildId) => async (req, res, next) => {
        if (!req.staff) return next();
        try {
            const guildId = String(guildDe(req) || '');
            const guild = client.guilds.cache.get(guildId);
            const clave = `${req.staff.id}:${guildId}`;
            const enviado = req.get('x-sokyo-confirmacion');
            if (enviado) {
                const r = comprobar(clave, enviado);
                if (r === 'ok') return next();
                if (r === 'mal') {
                    const p = pendientes.get(clave);
                    return res.status(428).json({ error: 'Código incorrecto', codigo: 'confirmar', incorrecto: true, via: p ? p.via : 'md', servidor: guild ? guild.name : '' });
                }
            }
            // Código nuevo por privado (o, si no se puede, el nombre del servidor).
            const codigo = String(crypto.randomInt(100000, 1000000));
            let via = 'md';
            try {
                const { idiomaMiembro } = require('./preferencias.js');
                const idioma = await idiomaMiembro(req.staff.id, {}).catch(() => 'en');
                const que = ACCIONES[accion] || ACCIONES['borrar-canal'];
                const user = await client.users.fetch(req.staff.id);
                await user.send(t(idioma,
                    `🔐 Código para confirmar en el panel de Sokyo: **${codigo}**\nVas a ${que[0]} en **${guild ? guild.name : guildId}**. Caduca en 10 minutos.\n-# Si no has sido tú, no lo compartas con nadie y avisa a un administrador.`,
                    `🔐 Code to confirm in the Sokyo panel: **${codigo}**\nYou’re about to ${que[1]} on **${guild ? guild.name : guildId}**. It expires in 10 minutes.\n-# If this wasn’t you, don’t share it with anyone and tell an administrator.`));
            } catch { via = 'nombre'; }
            pendientes.set(clave, { hash: hash(codigo), expira: Date.now() + DURACION, intentos: 0, via, nombre: guild ? guild.name : '' });
            if (pendientes.size > 5000) for (const [k, v] of pendientes) if (v.expira < Date.now()) pendientes.delete(k);
            return res.status(428).json({ error: 'Confirma esta acción', codigo: 'confirmar', via, accion, servidor: guild ? guild.name : '' });
        } catch (e) {
            console.error('Confirmación doble:', e.message);
            return res.status(500).json({ error: 'Fallo interno' });
        }
    };
}

module.exports = { crearExigeConfirmacion, comprobar, ACCIONES, _pendientes: pendientes, _hash: hash };
