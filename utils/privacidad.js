const { PermissionsBitField } = require('discord.js');

// Solo registramos contenido de canales que cualquiera del servidor puede ver.
// Los canales privados (tickets, staff, etc.) NO se guardan en los logs de auditoría.
function esCanalPublico(message) {
    try {
        const canal = message.channel;
        const guild = message.guild;
        if (!canal || !guild || typeof canal.permissionsFor !== 'function') return false;
        const permisos = canal.permissionsFor(guild.roles.everyone);
        return !!permisos && permisos.has(PermissionsBitField.Flags.ViewChannel);
    } catch { return false; }
}

const recortar = (txt, max = 1000) => (txt && txt.length > max ? `${txt.slice(0, max)}…` : txt);

module.exports = { esCanalPublico, recortar };
