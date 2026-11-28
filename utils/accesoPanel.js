// Quién puede entrar al panel de un servidor y a qué partes (1.12.0). Mismas reglas que
// la API (api/server.js: guildsDelStaff, tieneAreaAcceso, /api/mis-permisos y
// puedeModerar), en una función pura para la vista «Quién tiene acceso» de
// Configuración → Acceso al panel. El panel recalcula lo mismo en el navegador mientras
// se cambian los roles (components/dashboard/views/AccesoView.jsx): si cambias algo aquí,
// cámbialo también allí.
const { PermissionsBitField } = require('discord.js');

const AREAS = ['tickets', 'moderacion', 'entrada', 'roles', 'comunidad', 'crecimiento', 'musica', 'mensajes', 'datos', 'logs', 'config', 'cuenta'];
const F = PermissionsBitField.Flags;

// `m`: { roles: [ids], admin, gestionarCanales, moderarNativo, duenoServidor, propietarioBot }.
// `cfg`: { rolStaffId, rolesPanelAcceso, accesoAreas, rolesModeracion }.
// `concesion` (1.13.0): acceso dado a esa persona { areas, moderar, expiraEn } o null.
// Devuelve { acceso, motivos: ['propietarioBot'|'admin'|'gestionarCanales'|'rolStaff'|'rolAcceso'|'concedido'], areas, moderar }.
function calcularAcceso(m, cfg = {}, concesion = null) {
    const roles = new Set(m.roles || []);
    const motivos = [];
    if (m.propietarioBot) motivos.push('propietarioBot');
    if (m.admin) motivos.push('admin');
    if (m.gestionarCanales && !m.admin) motivos.push('gestionarCanales'); // un admin ya lo tiene todo
    if (cfg.rolStaffId && roles.has(cfg.rolStaffId)) motivos.push('rolStaff');
    if ((cfg.rolesPanelAcceso || []).some((id) => roles.has(id))) motivos.push('rolAcceso');
    const dada = concesionVigente(concesion) ? concesion : null;
    if (dada) motivos.push('concedido');
    const acceso = motivos.length > 0;
    const todo = !!(m.propietarioBot || m.admin);
    const areas = {};
    for (const a of AREAS) {
        const lista = (cfg.accesoAreas && cfg.accesoAreas[a]) || [];
        areas[a] = acceso && (todo || lista.length === 0 || lista.some((id) => roles.has(id)) || !!(dada && (dada.areas || []).includes(a)));
    }
    const moderar = acceso && !!(todo || m.moderarNativo || (cfg.rolesModeracion || []).some((id) => roles.has(id)) || (dada && dada.moderar));
    return { acceso, motivos, areas, moderar };
}

// ¿Sigue en vigor? (sin fecha, o la fecha aún no ha pasado)
function concesionVigente(c, ahora = Date.now()) {
    return !!(c && (!c.expiraEn || new Date(c.expiraEn).getTime() > ahora));
}

// Datos de un miembro de Discord para calcularAcceso y para enseñarlo en el panel.
function datosMiembro(member, { ownerIds = new Set() } = {}) {
    const p = member.permissions;
    const alto = member.roles.highest;
    return {
        id: member.id,
        nombre: member.displayName,
        usuario: member.user.username,
        avatar: member.displayAvatarURL({ size: 128, extension: 'png' }),
        roles: member.roles.cache.filter((r) => r.id !== member.guild.id).map((r) => r.id),
        rolPrincipal: alto && alto.id !== member.guild.id ? { id: alto.id, nombre: alto.name, color: alto.hexColor } : null,
        admin: p.has(F.Administrator),
        gestionarCanales: p.has(F.ManageChannels),
        moderarNativo: p.has(F.BanMembers) || p.has(F.KickMembers) || p.has(F.ModerateMembers),
        duenoServidor: member.guild.ownerId === member.id,
        propietarioBot: ownerIds.has(member.id),
    };
}

// ¿Podría tener acceso con algún rol de la configuración? (para no mandar a todo el servidor:
// solo los que ya entran y los que tienen alguno de los roles que se pueden elegir).
function esCandidato(m, cfg = {}, concesion = null) {
    if (m.admin || m.gestionarCanales || m.propietarioBot || concesionVigente(concesion)) return true;
    const relevantes = new Set([cfg.rolStaffId, ...(cfg.rolesPanelAcceso || [])].filter(Boolean));
    return m.roles.some((id) => relevantes.has(id));
}

// Alerta de seguridad: queda en «Registro de actividad» (categoría Seguridad) y en el
// canal de registro de Discord, si hay uno.
// `accion` y `detalles` pueden ser [español, inglés]: sale el del idioma del servidor (2.5.2; antes siempre en español).
async function alertaSeguridad(client, guildId, { accion, usuario, detalles, color = '#f59e0b' }) {
    try {
        if (Array.isArray(accion) || Array.isArray(detalles)) {
            const cfg = await require('./config.js').getConfigCached(guildId).catch(() => null);
            const en = require('./i18n.js').t(cfg, 'es', 'en') === 'en';
            const elegir = (x) => (Array.isArray(x) ? x[en ? 1 : 0] : x);
            accion = elegir(accion); detalles = elegir(detalles);
        }
        const Log = require('../models/Log.js');
        const log = await Log.create({ guildId, categoria: 'Seguridad', accion, usuario: usuario || '—', detalles: detalles || '', color });
        if (client) await require('./logsManager.js').enviarLogADiscord(client, log);
    } catch (e) { console.error('Alerta de seguridad:', e.message); }
}

// Programador: borra los accesos caducados y lo apunta en el registro.
async function barrerConcesiones(client) {
    const AccesoPersona = require('../models/AccesoPersona.js');
    const caducadas = await AccesoPersona.find({ expiraEn: { $ne: null, $lte: new Date() } }).limit(100);
    for (const c of caducadas) {
        const borrado = await AccesoPersona.deleteOne({ _id: c._id });
        if (!borrado.deletedCount) continue;
        const guild = client.guilds.cache.get(c.guildId);
        const m = guild ? guild.members.cache.get(c.userId) : null;
        await alertaSeguridad(client, c.guildId, {
            accion: ['⌛ Acceso temporal al panel caducado', '⌛ Temporary panel access expired'], usuario: m ? m.user.username : c.userId,
            detalles: [`<@${c.userId}> ya no puede entrar al panel con el acceso que le dieron${c.creadoPorNombre ? ` (lo dio ${c.creadoPorNombre})` : ''}.`, `<@${c.userId}> can no longer open the panel with the access they were given${c.creadoPorNombre ? ` (given by ${c.creadoPorNombre})` : ''}.`], color: '#94a3b8',
        });
    }
}

module.exports = { AREAS, calcularAcceso, datosMiembro, esCandidato, concesionVigente, alertaSeguridad, barrerConcesiones };
