// Cumpleaños: cada uno guarda su día (sin el año) con /cumple o en «Mi cuenta», y
// vale en todos los servidores con Sokyo. A la hora elegida (UTC), cada servidor
// con los cumpleaños activados felicita a los miembros que cumplen hoy, les da el
// rol del día (si hay uno; se quita solo a las 24 h) y el regalo de oro o XP.
const Cumpleanos = require('../models/Cumpleanos.js');
const RolTemporal = require('../models/RolTemporal.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { t } = require('./i18n.js');

const MESES = {
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // febrero con el 29: se celebra el 28 los años normales
const MAX_FELICITADOS = 15; // más de esto en un día: un solo mensaje con todos

const fechaValida = (dia, mes) => Number.isInteger(dia) && Number.isInteger(mes) && mes >= 1 && mes <= 12 && dia >= 1 && dia <= DIAS_MES[mes - 1];
const textoFecha = (dia, mes, idioma) => (t(idioma, 'es', 'en') === 'es' ? `${dia} de ${MESES.es[mes - 1]}` : `${MESES.en[mes - 1]} ${dia}`);
const esBisiesto = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

async function guardarCumple(userId, dia, mes) {
    dia = parseInt(dia, 10); mes = parseInt(mes, 10);
    if (!fechaValida(dia, mes)) return { ok: false, error: 'fecha' };
    await Cumpleanos.findOneAndUpdate({ userId }, { $set: { dia, mes } }, { upsert: true });
    return { ok: true, dia, mes };
}
const borrarCumple = (userId) => Cumpleanos.deleteOne({ userId });
const cumpleDe = (userId) => Cumpleanos.findOne({ userId }).lean();

// Días que faltan para el próximo cumpleaños (0 = hoy), en UTC.
function diasHasta(dia, mes, hoy = new Date()) {
    const y = hoy.getUTCFullYear();
    const base = Date.UTC(y, hoy.getUTCMonth(), hoy.getUTCDate());
    const fecha = (anio) => Date.UTC(anio, mes - 1, mes === 2 && dia === 29 && !esBisiesto(anio) ? 28 : dia);
    let f = fecha(y);
    if (f < base) f = fecha(y + 1);
    return Math.round((f - base) / 86400000);
}

// Quién cumple hoy (UTC): los del 29 de febrero, el 28 en los años normales.
async function cumplenHoy(hoy = new Date()) {
    const dia = hoy.getUTCDate();
    const mes = hoy.getUTCMonth() + 1;
    const filtros = [{ dia, mes }];
    if (mes === 2 && dia === 28 && !esBisiesto(hoy.getUTCFullYear())) filtros.push({ dia: 29, mes: 2 });
    return Cumpleanos.find({ $or: filtros }).lean();
}

// Miembros del servidor de una lista de ids (de 100 en 100, como pide Discord).
async function miembrosDe(guild, ids) {
    const out = new Map();
    for (let i = 0; i < ids.length; i += 100) {
        const lote = ids.slice(i, i + 100);
        try {
            const col = await guild.members.fetch({ user: lote });
            col.forEach((m) => out.set(m.id, m));
        } catch {
            lote.forEach((id) => { const m = guild.members.cache.get(id); if (m) out.set(id, m); });
        }
    }
    return out;
}

// Los próximos cumpleaños de los miembros de un servidor (para /cumple lista y el panel).
// Se parte de la lista de miembros del servidor (no de todos los cumpleaños guardados).
const LISTA_COMPLETA = 20000; // en servidores más grandes, con los miembros que ya conoce el bot
async function proximos(guild, limite = 10) {
    if (guild.members.cache.size < guild.memberCount && guild.memberCount <= LISTA_COMPLETA) await guild.members.fetch().catch(() => {});
    const ids = [...guild.members.cache.keys()];
    const todos = [];
    for (let i = 0; i < ids.length; i += 5000) {
        todos.push(...await Cumpleanos.find({ userId: { $in: ids.slice(i, i + 5000) } }).select('userId dia mes').lean());
    }
    const miembros = guild.members.cache;
    return todos
        .filter((c) => miembros.has(c.userId) && !miembros.get(c.userId).user.bot)
        .map((c) => ({ ...c, faltan: diasHasta(c.dia, c.mes), member: miembros.get(c.userId) }))
        .sort((a, b) => a.faltan - b.faltan)
        .slice(0, limite);
}

function rellenar(plantilla, member, guild) {
    return String(plantilla || '')
        .replace(/{mention}/g, `<@${member.id}>`)
        .replace(/{user}/g, member.displayName || member.user.username)
        .replace(/{server}/g, guild.name);
}

// Felicita a quien cumple hoy en un servidor. `cfg` es la configuración entera.
async function felicitarServidor(client, guild, cfg, cumpleaneros) {
    const c = cfg.cumpleanos;
    const canal = c.canalId ? guild.channels.cache.get(c.canalId) : null;
    if (!canal || !canal.isTextBased()) return 0;
    const miembros = [...(await miembrosDe(guild, cumpleaneros.map((x) => x.userId))).values()].filter((m) => !m.user.bot);
    if (!miembros.length) return 0;

    const plantilla = c.mensaje || t(cfg, '🎂 ¡Feliz cumpleaños, {mention}! 🎉', '🎂 Happy birthday {mention}! 🎉');
    const regalo = [c.oro > 0 ? `🪙 ${c.oro}` : '', c.xp > 0 && cfg.nivelesActivo ? `✨ ${c.xp} XP` : ''].filter(Boolean).join(' · ');
    const lineaRegalo = regalo ? t(cfg, `\n🎁 Regalo de cumpleaños: ${regalo}`, `\n🎁 Birthday gift: ${regalo}`) : '';
    if (miembros.length <= MAX_FELICITADOS) {
        for (const m of miembros) {
            await canal.send({ content: `${rellenar(plantilla, m, guild)}${lineaRegalo}`.slice(0, 2000), allowedMentions: { users: [m.id] } }).catch(() => {});
        }
    } else {
        const lista = miembros.map((m) => `<@${m.id}>`).join(' ');
        await canal.send({ content: t(cfg, `🎂 ¡Hoy es el cumpleaños de ${miembros.length} miembros! Felicidades a ${lista} 🎉${lineaRegalo}`, `🎂 It’s ${miembros.length} members’ birthday today! Happy birthday ${lista} 🎉${lineaRegalo}`).slice(0, 2000), allowedMentions: { parse: [] } }).catch(() => {});
    }

    const rol = c.rolId ? guild.roles.cache.get(c.rolId) : null;
    const { darRecompensa } = require('./dinamicas.js');
    for (const m of miembros) {
        if (rol && !rol.managed) {
            const ok = await m.roles.add(rol, t(cfg, 'Cumpleaños', 'Birthday')).then(() => true).catch(() => false);
            if (ok) await RolTemporal.create({ guildId: guild.id, userId: m.id, roleId: rol.id, expiraEn: new Date(Date.now() + 24 * 3600 * 1000) }).catch(() => {});
        }
        if (c.oro > 0 || (c.xp > 0 && cfg.nivelesActivo)) await darRecompensa(guild, m, { oro: c.oro, xp: cfg.nivelesActivo ? c.xp : 0 }, cfg, canal).catch(() => {});
    }
    return miembros.length;
}

// Barrido del programador: una vez al día por servidor, a partir de su hora (UTC).
async function barrerCumpleanos(client) {
    const ahora = new Date();
    const hoy = ahora.toISOString().slice(0, 10);
    const cfgs = await ServidorConfig.find({ 'cumpleanos.activo': true, 'cumpleanos.lastDia': { $ne: hoy } }).lean();
    if (!cfgs.length) return;
    let cumpleaneros = null;
    for (const cfg of cfgs) {
        if (ahora.getUTCHours() < (cfg.cumpleanos.hora ?? 9)) continue;
        const guild = client.guilds.cache.get(cfg.guildId);
        if (!guild) continue;
        // Primero se apunta el día: si algo falla a medias, no se felicita dos veces.
        const r = await ServidorConfig.updateOne({ guildId: cfg.guildId, 'cumpleanos.lastDia': { $ne: hoy } }, { $set: { 'cumpleanos.lastDia': hoy } });
        if (!r.modifiedCount) continue;
        if (!cumpleaneros) cumpleaneros = await cumplenHoy(ahora);
        if (!cumpleaneros.length) continue;
        try { await felicitarServidor(client, guild, cfg, cumpleaneros); } catch (e) { console.error(`Cumpleaños ${cfg.guildId}:`, e.message); }
    }
}

module.exports = { guardarCumple, borrarCumple, cumpleDe, proximos, diasHasta, cumplenHoy, felicitarServidor, barrerCumpleanos, fechaValida, textoFecha, rellenar };
