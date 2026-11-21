// Quién puede entrar al panel de un servidor y a qué partes (1.12.0). Mismas reglas que
// la API (api/server.js: guildsDelStaff, tieneAreaAcceso, /api/mis-permisos y
// puedeModerar), en una función pura para la vista «Quién tiene acceso» de
// Configuración → Acceso al panel. El panel recalcula lo mismo en el navegador mientras
// se cambian los roles (components/dashboard/views/AccesoView.jsx): si cambias algo aquí,
// cámbialo también allí.
const { PermissionsBitField } = require('discord.js');

const AREAS = ['tickets', 'moderacion', 'entrada', 'roles', 'crecimiento', 'musica', 'mensajes', 'datos', 'logs', 'config', 'cuenta'];
const F = PermissionsBitField.Flags;

// `m`: { roles: [ids], admin, gestionarCanales, moderarNativo, duenoServidor, propietarioBot }.
// `cfg`: { rolStaffId, rolesPanelAcceso, accesoAreas, rolesModeracion }.
// Devuelve { acceso, motivos: ['propietarioBot'|'admin'|'gestionarCanales'|'rolStaff'|'rolAcceso'], areas, moderar }.
function calcularAcceso(m, cfg = {}) {
    const roles = new Set(m.roles || []);
    const motivos = [];
    if (m.propietarioBot) motivos.push('propietarioBot');
    if (m.admin) motivos.push('admin');
    if (m.gestionarCanales && !m.admin) motivos.push('gestionarCanales'); // un admin ya lo tiene todo
    if (cfg.rolStaffId && roles.has(cfg.rolStaffId)) motivos.push('rolStaff');
    if ((cfg.rolesPanelAcceso || []).some((id) => roles.has(id))) motivos.push('rolAcceso');
    const acceso = motivos.length > 0;
    const todo = !!(m.propietarioBot || m.admin);
    const areas = {};
    for (const a of AREAS) {
        const lista = (cfg.accesoAreas && cfg.accesoAreas[a]) || [];
        areas[a] = acceso && (todo || lista.length === 0 || lista.some((id) => roles.has(id)));
    }
    const moderar = acceso && !!(todo || m.moderarNativo || (cfg.rolesModeracion || []).some((id) => roles.has(id)));
    return { acceso, motivos, areas, moderar };
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
function esCandidato(m, cfg = {}) {
    if (m.admin || m.gestionarCanales || m.propietarioBot) return true;
    const relevantes = new Set([cfg.rolStaffId, ...(cfg.rolesPanelAcceso || [])].filter(Boolean));
    return m.roles.some((id) => relevantes.has(id));
}

module.exports = { AREAS, calcularAcceso, datosMiembro, esCandidato };
