// Caché en memoria de los usos de cada invitación: guildId -> Map(code -> uses)
const cache = new Map();

async function cachearGuild(guild) {
    try {
        const invites = await guild.invites.fetch();
        cache.set(guild.id, new Map(invites.map(i => [i.code, i.uses ?? 0])));
    } catch {
        // Sin permiso "Gestionar servidor": no se pueden rastrear invitaciones
        cache.delete(guild.id);
    }
}

// Devuelve la invitación usada (o null) comparando usos antes/después
async function detectarInvitacion(guild) {
    const antes = cache.get(guild.id);
    if (!antes) return null;
    let invites;
    try { invites = await guild.invites.fetch(); } catch { return null; }

    let usada = null;
    for (const inv of invites.values()) {
        if ((inv.uses ?? 0) > (antes.get(inv.code) ?? 0)) { usada = inv; break; }
    }
    cache.set(guild.id, new Map(invites.map(i => [i.code, i.uses ?? 0])));
    return usada;
}

function registrar(guildId, code, uses = 0) {
    if (!cache.has(guildId)) cache.set(guildId, new Map());
    cache.get(guildId).set(code, uses);
}

function eliminar(guildId, code) {
    cache.get(guildId)?.delete(code);
}

module.exports = { cachearGuild, detectarInvitacion, registrar, eliminar };
