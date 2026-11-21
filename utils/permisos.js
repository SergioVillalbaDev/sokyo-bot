const { PermissionsBitField } = require('discord.js');

// ¿Es staff de soporte? Administrador, "Gestionar canales" o el rol de staff configurado.
function esStaff(member, config) {
    if (!member) return false;
    const p = member.permissions;
    if (p?.has(PermissionsBitField.Flags.Administrator) || p?.has(PermissionsBitField.Flags.ManageChannels)) return true;
    return !!(config?.rolStaffId && member.roles?.cache?.has(config.rolStaffId));
}

module.exports = { esStaff };
