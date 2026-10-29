// Modo ausente (/ausente [motivo]): mientras dura, si alguien te menciona el bot le
// contesta que no estás, por qué y desde cuándo. Se quita solo cuando vuelves a
// escribir en el servidor (y te dice cuánta gente te ha buscado). Opcionalmente
// pone «[Ausente]» delante de tu apodo.
// Se lleva en memoria (y en la base de datos, para los reinicios): se mira en
// cada mensaje y no puede costar una consulta cada vez.
const Ausencia = require('../models/Ausencia.js');
const { t } = require('./i18n.js');

const PREFIJO = '[AFK] ';
const cache = new Map(); // `${guildId}:${userId}` -> { motivo, desde, apodoAnterior, menciones }
let carga = null;
const avisados = new Map(); // `${canalId}:${userId}` -> momento del último aviso (para no repetirlo)
const ENTRE_AVISOS = 60 * 1000;

const clave = (guildId, userId) => `${guildId}:${userId}`;
function cargar() {
    if (!carga) {
        carga = Ausencia.find().lean().then((docs) => {
            for (const d of docs) cache.set(clave(d.guildId, d.userId), d);
        }).catch((e) => { carga = null; console.error('Ausente (cargar):', e.message); });
    }
    return carga;
}

const estaAusente = (guildId, userId) => cache.get(clave(guildId, userId)) || null;

async function ponerAusente(member, motivo, cfg) {
    await cargar();
    // Si ya estaba ausente (cambia el motivo), se conserva el apodo de antes.
    const previa = cache.get(clave(member.guild.id, member.id));
    const datos = { guildId: member.guild.id, userId: member.id, motivo: String(motivo || '').slice(0, 200), desde: new Date(), apodoAnterior: previa ? previa.apodoAnterior : null, menciones: previa ? previa.menciones || 0 : 0 };
    // El apodo solo se cambia si se ha pedido y el bot puede (no al dueño ni a roles por encima).
    if (cfg?.ausente?.cambiarApodo && member.manageable && !member.displayName.startsWith(PREFIJO)) {
        const anterior = member.nickname;
        const ok = await member.setNickname(`${PREFIJO}${member.displayName}`.slice(0, 32), 'Modo ausente').then(() => true).catch(() => false);
        if (ok) datos.apodoAnterior = anterior || '';
    }
    await Ausencia.findOneAndUpdate({ guildId: datos.guildId, userId: datos.userId }, { $set: datos }, { upsert: true });
    cache.set(clave(datos.guildId, datos.userId), datos);
    return datos;
}

async function quitarAusente(guild, userId) {
    await cargar();
    const datos = cache.get(clave(guild.id, userId));
    cache.delete(clave(guild.id, userId));
    await Ausencia.deleteOne({ guildId: guild.id, userId }).catch(() => {});
    if (datos && datos.apodoAnterior !== null && datos.apodoAnterior !== undefined) {
        const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
        if (member && member.manageable && (member.nickname || '').startsWith(PREFIJO)) {
            await member.setNickname(datos.apodoAnterior || null, 'Ha vuelto del modo ausente').catch(() => {});
        }
    }
    return datos;
}

// «hace 2 h», como texto relativo de Discord.
const relativo = (fecha) => `<t:${Math.floor(new Date(fecha).getTime() / 1000)}:R>`;

// Para cada mensaje de un servidor: quita el modo ausente a quien escribe y avisa
// de quién está ausente entre los mencionados.
async function alMensaje(message, cfg) {
    if (!message.guild || cfg?.ausente?.activo === false) return;
    await cargar();
    const guildId = message.guild.id;

    const propio = estaAusente(guildId, message.author.id);
    // Unos segundos de margen: lo que se escribe justo después de ponerlo no cuenta.
    if (propio && Date.now() - new Date(propio.desde).getTime() > 15000) {
        await quitarAusente(message.guild, message.author.id);
        const n = propio.menciones || 0;
        const extra = n > 0 ? t(cfg, ` Te han mencionado **${n}** ${n === 1 ? 'vez' : 'veces'} mientras no estabas.`, ` You were mentioned **${n}** time${n === 1 ? '' : 's'} while you were away.`) : '';
        const aviso = await message.reply({
            content: t(cfg, `👋 ¡Bienvenido de vuelta, **${message.member?.displayName || message.author.username}**! Te he quitado el modo ausente (estabas fuera desde ${relativo(propio.desde)}).${extra}`, `👋 Welcome back, **${message.member?.displayName || message.author.username}**! I removed your away status (you were away since ${relativo(propio.desde)}).${extra}`),
            allowedMentions: { parse: [], repliedUser: false },
        }).catch(() => null);
        if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 15000);
    }

    const mencionados = [...message.mentions.users.values()].filter((u) => !u.bot && u.id !== message.author.id);
    const lineas = [];
    for (const u of mencionados.slice(0, 5)) {
        const a = estaAusente(guildId, u.id);
        if (!a) continue;
        a.menciones = (a.menciones || 0) + 1;
        Ausencia.updateOne({ guildId, userId: u.id }, { $inc: { menciones: 1 } }).catch(() => {});
        const k = `${message.channelId}:${u.id}`;
        if (Date.now() - (avisados.get(k) || 0) < ENTRE_AVISOS) continue;
        avisados.set(k, Date.now());
        if (avisados.size > 5000) avisados.clear();
        const nombre = message.guild.members.cache.get(u.id)?.displayName || u.username;
        lineas.push(a.motivo
            ? t(cfg, `💤 **${nombre}** está ausente desde ${relativo(a.desde)}: ${a.motivo}`, `💤 **${nombre}** has been away since ${relativo(a.desde)}: ${a.motivo}`)
            : t(cfg, `💤 **${nombre}** está ausente desde ${relativo(a.desde)}.`, `💤 **${nombre}** has been away since ${relativo(a.desde)}.`));
    }
    if (lineas.length) {
        await message.reply({ content: lineas.join('\n').slice(0, 2000), allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});
    }
}

// Para el panel: quién está ausente ahora en un servidor.
async function ausentesDe(guildId) {
    await cargar();
    return [...cache.values()].filter((a) => a.guildId === guildId).sort((a, b) => new Date(b.desde) - new Date(a.desde));
}

module.exports = { ponerAusente, quitarAusente, estaAusente, alMensaje, ausentesDe, cargar, PREFIJO };
