// Sistema de niveles/XP por mensajes.
const Nivel = require('../models/Nivel.js');
const { nivelDesdeXp } = require('./helpers.js');

const COOLDOWN_MS = 60_000;

// Suma XP si ha pasado el cooldown. Devuelve { subioDe, subioA } si sube de nivel.
async function darXp(message, config) {
    const ahora = new Date();
    const registro = await Nivel.findOne({ guildId: message.guild.id, usuarioId: message.author.id });
    if (registro?.ultimoXp && ahora - registro.ultimoXp < COOLDOWN_MS) return null;

    const ganado = 15 + Math.floor(Math.random() * 11); // 15-25
    const xpTotal = (registro?.xp || 0) + ganado;
    const antes = registro?.nivel || 0;
    const { nivel } = nivelDesdeXp(xpTotal);

    await Nivel.findOneAndUpdate(
        { guildId: message.guild.id, usuarioId: message.author.id },
        { $set: { xp: xpTotal, nivel, ultimoXp: ahora, usuarioNombre: message.author.username }, $inc: { mensajes: 1 } },
        { upsert: true }
    );
    return nivel > antes ? { subioDe: antes, subioA: nivel } : null;
}

// Entrega los roles de recompensa que correspondan al nivel alcanzado.
async function entregarRecompensas(member, config, nivel) {
    const pendientes = (config?.niveles?.recompensas || []).filter(r => r.nivel <= nivel && r.rolId && !member.roles.cache.has(r.rolId));
    for (const r of pendientes) await member.roles.add(r.rolId, `Recompensa de nivel ${r.nivel}`).catch(() => {});
}

module.exports = { darXp, entregarRecompensas };
