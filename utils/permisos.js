// Quién es staff o administrador en un servidor, según los roles configurados.
const { PermissionsBitField } = require('discord.js');

function esAdmin(member) {
    if (!member) return false;
    if (member.guild && member.guild.ownerId === member.id) return true;
    return member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        member.permissions.has(PermissionsBitField.Flags.ManageGuild);
}

// Staff general del servidor. Si aún no hay roles configurados (antes de /setup),
// cuenta quien pueda gestionar canales, como hacía el bot antes.
function esStaff(member, config) {
    if (!member) return false;
    if (esAdmin(member)) return true;
    const roles = (config && config.rolesStaff) || [];
    if (roles.length === 0) return member.permissions.has(PermissionsBitField.Flags.ManageChannels);
    return member.roles.cache.some(r => roles.includes(r.id));
}

// Roles que atienden un tipo de ticket concreto (los del motivo o, si no tiene, los generales).
function rolesDeMotivo(config, motivo) {
    if (motivo && motivo.rolesStaff && motivo.rolesStaff.length > 0) return motivo.rolesStaff;
    return (config && config.rolesStaff) || [];
}

// ¿Puede este miembro atender este ticket? (mismas reglas que los permisos del canal)
function puedeAtender(member, config, motivo) {
    if (!member) return false;
    if (esAdmin(member)) return true;
    if (motivo && motivo.rolesStaff && motivo.rolesStaff.length > 0) {
        return member.roles.cache.some(r => motivo.rolesStaff.includes(r.id));
    }
    return esStaff(member, config);
}

module.exports = { esAdmin, esStaff, rolesDeMotivo, puedeAtender };
