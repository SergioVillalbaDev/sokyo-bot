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

// Roles que el bot repartirá por su cuenta (autorol, verificación, recompensas de
// nivel, paneles de roles…). Quien los configura desde el panel solo puede elegir
// roles por debajo de su rol más alto, como en Discord; si no, un miembro del staff
// podía poner un rol de administrador en un panel o en el autorol y dárselo a sí
// mismo (o a cualquiera) a través del bot. Solo se miran los roles que se AÑADEN:
// los que ya estaban (p. ej. puestos por el dueño) no impiden guardar lo demás.
// Devuelve el mensaje de error, o null si está permitido.
async function errorRolesNuevos(client, staff, guildId, pedidos, actuales) {
    if (!staff || staff.owner) return null; // API key o propietario del bot
    const ya = new Set((actuales || []).filter(Boolean).map(String));
    const nuevos = [...new Set((pedidos || []).filter(Boolean).map(String))].filter((id) => !ya.has(id));
    if (!nuevos.length) return null;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null;
    const member = await guild.members.fetch(staff.id).catch(() => null);
    if (!member) return 'No eres miembro de ese servidor';
    if (guild.ownerId === member.id) return null;
    const altos = nuevos.map((id) => guild.roles.cache.get(id)).filter((r) => r && r.position >= member.roles.highest.position);
    if (!altos.length) return null;
    return `No puedes elegir roles que estén a tu altura o por encima de tu rol más alto: ${altos.map((r) => r.name).join(', ')}`;
}

module.exports = { miembroPuedeModerar, errorRolesNuevos };
