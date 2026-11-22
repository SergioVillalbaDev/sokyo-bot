// 1.30.0: en la web personal el oro, el diario y la tienda son de UN servidor (el que se elija).
// Solo vale un servidor donde está el bot y la persona es miembro.
const Monedero = require('../models/Monedero.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');

async function esMiembro(client, guildId, userId) {
    const guild = guildId && client?.guilds?.cache.get(String(guildId));
    if (!guild) return null;
    if (guild.members.cache.has(userId)) return guild;
    const m = await guild.members.fetch(userId).catch(() => null);
    return m ? guild : null;
}

// Servidores donde puede tener oro: donde tiene monedero o actividad, y está con el bot.
async function servidoresDe(client, userId) {
    const [monederos, actividad] = await Promise.all([
        Monedero.find({ discordId: userId }).select('guildId balance').lean(),
        ActividadUsuario.find({ userId }).select('guildId xp').lean(),
    ]);
    const oro = new Map(monederos.map((m) => [m.guildId, m.balance || 0]));
    const xp = new Map(actividad.map((a) => [a.guildId, a.xp || 0]));
    const ids = [...new Set([...oro.keys(), ...xp.keys()])].filter((id) => client?.guilds?.cache.has(id));
    return ids.map((id) => {
        const g = client.guilds.cache.get(id);
        return { id, nombre: g.name, icono: g.iconURL ? g.iconURL({ size: 64 }) : null, oro: oro.get(id) || 0, xp: xp.get(id) || 0 };
    }).sort((a, b) => b.oro - a.oro || b.xp - a.xp).slice(0, 25);
}

// El servidor pedido (si vale) o, si no, el primero de su lista. null si no tiene ninguno.
async function elegir(client, userId, pedido) {
    if (pedido) return (await esMiembro(client, pedido, userId))?.id || null;
    const lista = await servidoresDe(client, userId);
    return lista[0]?.id || null;
}

module.exports = { esMiembro, servidoresDe, elegir };
