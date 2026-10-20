const { PermissionFlagsBits } = require('discord.js');

// ¿Es este miembro parte del equipo de soporte?
// Lo es si administra el servidor/canales o si tiene alguno de los roles de staff configurados.
// Acepta tanto un GuildMember como el miembro "crudo" que a veces llega en las interacciones.
function esStaff(member, config) {
    if (!member || !member.permissions) return false;

    const permisos = member.permissions;
    if (typeof permisos.has === 'function' && (
        permisos.has(PermissionFlagsBits.Administrator) ||
        permisos.has(PermissionFlagsBits.ManageGuild) ||
        permisos.has(PermissionFlagsBits.ManageChannels)
    )) return true;

    const rolesStaff = config?.rolesStaff || [];
    if (rolesStaff.length === 0) return false;
    const rolesMiembro = Array.isArray(member.roles) ? member.roles : [...(member.roles?.cache?.keys() || [])];
    return rolesStaff.some(id => rolesMiembro.includes(id));
}

module.exports = { esStaff };
