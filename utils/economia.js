// 2.0.0: el oro solo se GANA jugando (diario, votos, granja, misiones, pase, casino…) y se
// gasta en el propio juego o en la tienda del servidor (utils/tiendaServidor.js). Nadie puede
// «dar oro» a mano: ni los admins (se quitó /daroro) ni nadie desde la web.
// 1.30.0: el oro es POR SERVIDOR (models/Monedero.js). Todo se usa con `economia.en(guildId)`:
//   const eco = require('./economia.js').en(guildId); await eco.darOro(userId, 50);
// Sin servidor no hay economía (lanza un error en vez de dar oro en un sitio cualquiera).
const Usuario = require('../models/Monedero.js');

// Devuelve el usuario, creándolo si es la primera vez que aparece (upsert).
async function obtenerUsuario(guildId, discordId) {
    return Usuario.findOneAndUpdate(
        { guildId, discordId },
        { $setOnInsert: { guildId, discordId } },
        { upsert: true, returnDocument: 'after' }
    );
}

// Da (o quita, si es negativo) oro a un usuario. Nunca deja el saldo por debajo de 0.
// Usa una pipeline de actualización para clampear el resultado en la propia BD.
async function darOro(guildId, discordId, cantidad) {
    cantidad = parseInt(cantidad, 10) || 0;
    await obtenerUsuario(guildId, discordId);
    const u = await Usuario.findOneAndUpdate(
        { guildId, discordId },
        [{ $set: { balance: { $max: [0, { $add: ['$balance', cantidad] }] } } }],
        // Mongoose 9 rechaza los pipelines (arrays) si no se pide expresamente.
        { returnDocument: 'after', updatePipeline: true }
    );
    return u.balance;
}

// Cobra oro solo si hay bastante (puerta atómica: dos cobros a la vez no dejan el saldo
// en negativo). Devuelve el saldo que queda, o null si no llega.
async function cobrar(guildId, discordId, cantidad) {
    cantidad = Math.max(0, Math.floor(cantidad || 0));
    if (!cantidad) { const u = await obtenerUsuario(guildId, discordId); return u.balance; }
    const u = await Usuario.findOneAndUpdate(
        { guildId, discordId, balance: { $gte: cantidad } },
        { $inc: { balance: -cantidad } },
        { returnDocument: 'after' },
    );
    return u ? u.balance : null;
}

// Recompensa diaria con racha. Se puede reclamar cada ~20h; si pasan más de 48h
// sin reclamar, la racha se reinicia. Cada 7 días seguidos hay premio gordo.
// (La web de "Mi cuenta" usa las mismas horas para su cuenta atrás.)
const HORAS_DAILY = 20;
const HORAS_RACHA = 48;
// 1.32.0: regalos por racha del diario (un ticket del pase: sobre o cofre gratis).
const REGALOS_RACHA = { 3: 'sobre_normal', 7: 'cofre_basico', 14: 'sobre_brillante', 21: 'cofre_basico', 30: 'cofre_epico' };
async function reclamarDaily(guildId, discordId) {
    const u = await obtenerUsuario(guildId, discordId);
    const ahora = new Date();
    let racha;
    if (u.ultimoDaily) {
        const horas = (ahora - new Date(u.ultimoDaily)) / 3600000;
        if (horas < HORAS_DAILY) return { ok: false, esperaHoras: HORAS_DAILY - horas };
        racha = horas <= HORAS_RACHA ? (u.rachaDaily || 0) + 1 : 1; // dentro de 48h continúa; si no, reinicia
    } else {
        racha = 1;
    }
    const base = 100;
    const bonus = Math.min(racha, 7) * 25;          // hasta +175 según racha
    const jackpot = (racha % 7 === 0) ? 500 : 0;    // premio gordo cada 7 días
    let total = base + bonus + jackpot;
    // Compañero equipado de los cofres (1.16.0): más oro en el diario.
    const compa = await require('./cofres.js').ventajasUsuario(guildId, discordId).catch(() => null);
    const extraCompa = compa?.diario > 0 ? Math.round(total * compa.diario) : 0;
    total += extraCompa;
    // 1.32.0: evento de temporada (más oro) y regalos por racha (tickets de sobres/cofres gratis).
    // 2.0.0: el clan campeón de la semana pasada cobra un 15 % más.
    const campeon = await require('../models/Clan.js').exists({ guildId, miembros: discordId, campeonHasta: { $gt: ahora } }).catch(() => null);
    const extraClan = campeon ? Math.round((base + bonus + jackpot) * 0.15) : 0;
    total += extraClan;
    const evento = require('./eventos.js').eventoActivo(ahora.getTime());
    const extraEvento = evento ? Math.round((base + bonus + jackpot) * evento.bonusDiario) : 0;
    total += extraEvento;
    let regalo = REGALOS_RACHA[racha] || (racha > 30 && racha % 30 === 0 ? REGALOS_RACHA[30] : null);
    // Sin cartas de anime en el servidor, un sobre no sirve: va un cofre.
    if (regalo && regalo.startsWith('sobre')) {
        const cfgS = await require('../models/ServidorConfig.js').findOne({ guildId }).select('compis').lean().catch(() => null);
        if (!cfgS?.compis?.anime) regalo = regalo === 'sobre_brillante' ? 'cofre_epico' : 'cofre_basico';
    }

    // Puerta atómica: solo se aplica si `ultimoDaily` sigue siendo el mismo que
    // acabamos de leer. Si dos /daily llegan a la vez (doble clic, reintento de
    // Discord), la segunda encuentra el documento ya cambiado y esta condición
    // falla, así que no duplica el premio.
    const actualizado = await Usuario.findOneAndUpdate(
        { guildId, discordId, ultimoDaily: u.ultimoDaily ?? null },
        { $set: { ultimoDaily: ahora, rachaDaily: racha }, $inc: { balance: total } },
        { returnDocument: 'after' }
    );
    if (!actualizado) return { ok: false, esperaHoras: HORAS_DAILY }; // otra petición ganó la carrera justo antes
    if (regalo) await require('../models/ColeccionMascotas.js').updateOne({ guildId, userId: discordId }, { $inc: { [`tickets.${regalo}`]: 1 } }, { upsert: true }).catch(() => {});
    const delPase = await require('./pase.js').registrar(guildId, discordId, [['diarioLogin', 1]]).catch(() => []);
    return { ok: true, total, racha, jackpot, extraCompa, extraClan, extraEvento, evento, regalo, delPase, balance: actualizado.balance };
}

// Ranking de los usuarios con más oro.
async function topRicos(guildId, limite = 10) {
    return Usuario.find({ guildId, balance: { $gt: 0 } }).sort({ balance: -1 }).limit(limite).select('discordId balance');
}

// La economía de un servidor. Sin servidor, error: el oro siempre es de algún servidor.
function en(guildId) {
    if (!guildId || typeof guildId !== 'string') throw new Error('economía sin servidor');
    return {
        guildId,
        obtenerUsuario: (discordId) => obtenerUsuario(guildId, discordId),
        darOro: (discordId, cantidad) => darOro(guildId, discordId, cantidad),
        cobrar: (discordId, cantidad) => cobrar(guildId, discordId, cantidad),
        reclamarDaily: (discordId) => reclamarDaily(guildId, discordId),
        topRicos: (limite) => topRicos(guildId, limite),
    };
}

module.exports = { en, HORAS_DAILY, HORAS_RACHA, Monedero: Usuario };
