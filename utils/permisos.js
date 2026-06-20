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

module.exports = { miembroPuedeModerar };
