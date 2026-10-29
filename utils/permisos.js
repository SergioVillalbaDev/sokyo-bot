const { PermissionsBitField } = require('discord.js');

// ¿Este miembro puede moderar? Es cierto si: es administrador, tiene el permiso
// nativo indicado (banear/expulsar/aislar…), o tiene uno de los "roles de
// moderación" configurados en el panel (Acceso y permisos).
function miembroPuedeModerar(member, cfg, flag) {
    if (!member) return false;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    if (flag && member.permissions.has(flag)) return true;
    const rolesMod = (cfg && cfg.rolesModeracion) || [];
    return rolesMod.some((id) => member.roles.cache.has(id));
}

// Reglas de Discord para el staff que gestiona roles desde el panel (y que el bot,
// que es administrador, aplica en su nombre). Sin ellas, cualquiera con acceso a
// la sección de roles podía darse un rol con Administrador a través del bot.
//  - roles: solo los que estén por debajo de su rol más alto.
//  - repartir: si se van a DAR esos roles (a un miembro, por autorol, panel…),
//    tampoco pueden llevar permisos que él no tenga (p. ej. un rol con
//    Administrador colocado abajo por error).
//  - permisos: permisos que se quieren poner a un rol (crear/editar).
// El dueño del servidor y los propietarios del bot (OWNER_IDS / API key) no
// tienen límite. Devuelve el mensaje de error, o null si está permitido.
async function errorJerarquiaStaff(guild, staff, { roles = [], repartir = false, permisos = [] } = {}) {
    if (!staff || staff.owner) return null;
    const member = await guild.members.fetch(staff.id).catch(() => null);
    if (!member) return 'No eres miembro de ese servidor';
    if (guild.ownerId === member.id) return null;
    const nombres = (lista) => lista.map((r) => r.name).join(', ');
    const altos = roles.filter((r) => r && r.position >= member.roles.highest.position);
    if (altos.length) return `Solo puedes usar roles que estén por debajo de tu rol más alto: ${nombres(altos)}`;
    if (repartir) {
        const conMas = roles.filter((r) => r && !member.permissions.has(r.permissions));
        if (conMas.length) return `No puedes repartir roles con permisos que tú no tienes: ${nombres(conMas)}`;
    }
    const sinPermiso = permisos.filter((p) => {
        try { return !member.permissions.has(p); } catch { return true; }
    });
    if (sinPermiso.length) return `No puedes dar permisos que tú no tienes: ${sinPermiso.join(', ')}`;
    return null;
}

// Roles que el bot repartirá por su cuenta (autorol, verificación, recompensas de
// nivel, paneles de roles…), con las reglas de arriba. Solo se miran los roles que
// se AÑADEN: los que ya estaban (p. ej. puestos por el dueño) no impiden guardar
// lo demás.
async function errorRolesNuevos(client, staff, guildId, pedidos, actuales) {
    if (!staff || staff.owner) return null; // API key o propietario del bot
    const ya = new Set((actuales || []).filter(Boolean).map(String));
    const nuevos = [...new Set((pedidos || []).filter(Boolean).map(String))].filter((id) => !ya.has(id));
    if (!nuevos.length) return null;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null; // el bot no está en ese servidor: tampoco podrá dar roles
    const roles = nuevos.map((id) => guild.roles.cache.get(id)).filter(Boolean);
    return errorJerarquiaStaff(guild, staff, { roles, repartir: true });
}

// Roles que reparte el bot según una configuración (autorol, recompensas de nivel
// y de invitaciones, verificación, miembro de la semana, cumpleaños, solicitudes):
// los que cuida la regla
// de jerarquía al importar, copiar o deshacer.
function rolesQueDaElBot(c = {}) {
    return [
        ...(c.autoRoles || []), ...(c.autoRolesBots || []),
        ...(c.recompensasNivel || []).map((r) => r && r.rolId),
        c.verificacion && c.verificacion.rolVerificadoId,
        c.embudoAB && c.embudoAB.rolVerificadoId,
        c.dinamicas && c.dinamicas.miembroSemana && c.dinamicas.miembroSemana.rolId,
        ...((c.crecimiento && c.crecimiento.invitaciones && c.crecimiento.invitaciones.recompensas) || []).map((r) => r && r.rolId),
        c.cumpleanos && c.cumpleanos.rolId,
        ...((c.solicitudes && c.solicitudes.formularios) || []).map((f) => f && f.rolId),
    ].filter((x) => typeof x === 'string' && x);
}

module.exports = { miembroPuedeModerar, errorJerarquiaStaff, errorRolesNuevos, rolesQueDaElBot };
