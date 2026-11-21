// Votos en top.gg (1.10.0). top.gg avisa de cada voto por un webhook
// (POST /api/topgg/voto, ver api/server.js) con la clave TOPGG_WEBHOOK_AUTH. Por cada
// voto: oro (global, de la economía; el doble en fin de semana) y, en cada servidor
// con «Crecimiento → Votos» activo donde esté quien vota, un rol temporal, XP y un
// mensaje de gracias. Con TOPGG_TOKEN, además, se publica en top.gg cuántos
// servidores tiene el bot (sale en la ficha y ayuda a subir en la lista).
const crypto = require('crypto');
const Voto = require('../models/Voto.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const RolTemporal = require('../models/RolTemporal.js');
const RecordatorioVoto = require('../models/RecordatorioVoto.js');
const { t } = require('./i18n.js');

const HORAS_ENTRE_VOTOS = 12; // lo que deja top.gg
const ORO_POR_VOTO = () => Math.max(0, parseInt(process.env.ORO_POR_VOTO, 10) || 300);

const urlVoto = (botId) => `https://top.gg/bot/${botId}/vote`;
const urlFicha = (botId) => `https://top.gg/bot/${botId}`;
const webhookConfigurado = () => !!process.env.TOPGG_WEBHOOK_AUTH;

// ¿La cabecera Authorization del webhook es la nuestra? (tiempo constante)
function autorizacionValida(cabecera) {
    const esperada = process.env.TOPGG_WEBHOOK_AUTH || '';
    if (!esperada || typeof cabecera !== 'string') return false;
    const a = crypto.createHash('sha256').update(cabecera).digest();
    const b = crypto.createHash('sha256').update(esperada).digest();
    return crypto.timingSafeEqual(a, b);
}

// Valida el cuerpo del webhook de top.gg. Devuelve { userId, finde, prueba } o null.
function leerVoto(cuerpo) {
    const b = cuerpo || {};
    const userId = String(b.user || '');
    if (!/^\d{17,20}$/.test(userId)) return null;
    return { userId, finde: b.isWeekend === true, prueba: b.type === 'test' };
}

// Último voto y cuándo puede volver a votar.
async function estadoVoto(userId) {
    const ultimo = await Voto.findOne({ userId }).sort({ fecha: -1 }).lean();
    const proximo = ultimo ? new Date(ultimo.fecha.getTime() + HORAS_ENTRE_VOTOS * 3600 * 1000) : null;
    return { ultimo, proximo: proximo && proximo > new Date() ? proximo : null, total: await Voto.countDocuments({ userId }) };
}

function rellenar(plantilla, datos) {
    return String(plantilla || '')
        .replaceAll('{mention}', `<@${datos.userId}>`)
        .replaceAll('{user}', datos.nombre)
        .replaceAll('{gold}', datos.oro.toLocaleString('es-ES'))
        .replaceAll('{extra}', datos.extra)
        .replaceAll('{next}', `<t:${Math.floor(datos.proximo.getTime() / 1000)}:R>`)
        .replaceAll('{server}', datos.servidor);
}

// Premios en un servidor concreto: rol temporal, XP y gracias en su canal.
async function premiarEnServidor(client, cfg, userId, oro, proximo) {
    const v = cfg.crecimiento?.votos;
    const guild = client.guilds.cache.get(cfg.guildId);
    if (!v?.activo || !guild) return false;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member || member.user.bot) return false;

    const extras = [];
    // Oro de más que da este servidor (además del global del voto).
    const oroExtra = Math.max(0, Math.min(100000, v.oroExtra || 0));
    if (oroExtra > 0) await require('./economia.js').darOro(userId, oroExtra).catch((e) => console.error('Votos · oro extra:', e.message));
    // El rol se comprueba también ahora: si alguien le añadió permisos de staff, no se da.
    const rolVoto = v.rolId ? guild.roles.cache.get(v.rolId) : null;
    if (rolVoto && require('./permisos.js').errorRolPeligroso(rolVoto)) {
        console.error(`Votos · ${guild.id}: el rol ${rolVoto.id} tiene permisos de staff, no se reparte.`);
    } else if (rolVoto) {
        const ok = await member.roles.add(v.rolId, 'Ha votado por el bot en top.gg').then(() => true).catch(() => false);
        if (ok) {
            const horas = Math.max(1, Math.min(168, v.horasRol || 12));
            await RolTemporal.findOneAndUpdate(
                { guildId: guild.id, userId, roleId: v.rolId },
                { $set: { expiraEn: new Date(Date.now() + horas * 3600 * 1000) } },
                { upsert: true },
            );
            extras.push(t(cfg, `el rol **${guild.roles.cache.get(v.rolId).name}** ${horas} h`, `the **${guild.roles.cache.get(v.rolId).name}** role for ${horas} h`));
        }
    }
    if (v.xp > 0 && cfg.nivelesActivo) {
        const canal = v.canalId ? guild.channels.cache.get(v.canalId) : null;
        await require('./niveles.js').aplicarXp(guild, member, v.xp, cfg, canal).catch((e) => console.error('Votos · XP:', e.message));
        extras.push(`${v.xp} XP`);
    }
    if (v.canalId) {
        const canal = guild.channels.cache.get(v.canalId);
        if (canal?.isTextBased()) {
            const extra = extras.length ? t(cfg, ` y ${extras.join(' y ')}`, ` and ${extras.join(' and ')}`) : '';
            const texto = rellenar(v.mensaje, { userId, nombre: member.displayName, oro: oro + oroExtra, extra, proximo, servidor: guild.name });
            await canal.send({ content: texto.slice(0, 2000), allowedMentions: { users: v.mencionar === false ? [] : [userId] } }).catch(() => {});
        }
    }
    return true;
}

// Un voto que llega de top.gg. Devuelve qué se hizo (para el registro y los tests).
async function procesarVoto(client, { userId, finde, prueba }) {
    if (prueba) return { estado: 'prueba' };
    // top.gg reintenta el webhook si tardamos: un voto de la misma persona en las
    // últimas horas es el mismo (no se puede votar más de una vez cada 12 h).
    const hace = new Date(Date.now() - (HORAS_ENTRE_VOTOS - 1) * 3600 * 1000);
    if (await Voto.exists({ userId, fecha: { $gt: hace } })) return { estado: 'repetido' };

    const oro = ORO_POR_VOTO() * (finde ? 2 : 1);
    await Voto.create({ userId, finde, oro });
    if (oro > 0) await require('./economia.js').darOro(userId, oro).catch((e) => console.error('Votos · oro:', e.message));

    const proximo = new Date(Date.now() + HORAS_ENTRE_VOTOS * 3600 * 1000);
    const cfgs = await ServidorConfig.find({ 'crecimiento.votos.activo': true });
    let servidores = 0;
    for (const cfg of cfgs) {
        if (await premiarEnServidor(client, cfg, userId, oro, proximo).catch((e) => { console.error('Votos · servidor:', e.message); return false; })) servidores++;
    }
    // «Recordarme votar»: el aviso sale cuando se pueda volver a votar.
    await RecordatorioVoto.updateOne({ userId, activo: true }, { $set: { proximoAviso: proximo } }).catch(() => {});
    return { estado: 'ok', oro, servidores };
}

// /votar recordar: activa o quita el aviso. Si ya puede votar, el primero sale enseguida.
async function ponerRecordatorio(userId, activo) {
    if (!activo) { await RecordatorioVoto.deleteOne({ userId }); return false; }
    const { proximo } = await estadoVoto(userId);
    await RecordatorioVoto.updateOne({ userId }, { $set: { activo: true, proximoAviso: proximo || null } }, { upsert: true });
    return true;
}
const tieneRecordatorio = async (userId) => !!(await RecordatorioVoto.exists({ userId, activo: true }));

// Programador: privado a quien pidió que le recordaran votar y ya puede.
async function avisarRecordatorios(client) {
    if (!client.user) return;
    const vencidos = await RecordatorioVoto.find({ activo: true, proximoAviso: { $ne: null, $lte: new Date() } }).limit(100);
    const { idiomaMiembro } = require('./preferencias.js');
    for (const r of vencidos) {
        // Se marca antes de enviar: nunca se manda dos veces el mismo aviso.
        const ok = await RecordatorioVoto.updateOne({ _id: r._id, proximoAviso: r.proximoAviso }, { $set: { proximoAviso: null } });
        if (!ok.modifiedCount) continue;
        const user = await client.users.fetch(r.userId).catch(() => null);
        if (!user) continue;
        const idioma = await idiomaMiembro(r.userId, {}).catch(() => 'en');
        await user.send(t(idioma,
            `🗳️ ¡Ya puedes volver a votar por Sokyo y ganar oro! ${urlVoto(client.user.id)}
-# Para no recibir más avisos: \`/votar recordar:no\``,
            `🗳️ You can vote for Sokyo again and earn gold! ${urlVoto(client.user.id)}
-# To stop these reminders: \`/vote remind:no\``)).catch(() => {});
        await new Promise((res) => setTimeout(res, 250));
    }
}

// Publica en top.gg el número de servidores (si hay TOPGG_TOKEN).
async function publicarEstadisticas(client) {
    const token = process.env.TOPGG_TOKEN;
    if (!token || !client.user) return false;
    const r = await fetch(`https://top.gg/api/bots/${client.user.id}/stats`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_count: client.guilds.cache.size }),
        signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`top.gg respondió ${r.status}`);
    return true;
}

// Para el panel: votos de los miembros de este servidor en los últimos 30 días.
async function resumenServidor(guild) {
    const hace = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const votos = await Voto.find({ fecha: { $gt: hace } }).sort({ fecha: -1 }).limit(2000).select('userId fecha').lean();
    const aqui = votos.filter((v) => guild.members.cache.has(v.userId));
    const porPersona = new Map();
    for (const v of aqui) porPersona.set(v.userId, (porPersona.get(v.userId) || 0) + 1);
    const top = [...porPersona.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([id, n]) => { const m = guild.members.cache.get(id); return { userId: id, nombre: m?.displayName || id, avatar: m?.user.displayAvatarURL({ size: 64 }) || null, votos: n }; });
    return { total30d: aqui.length, top };
}

module.exports = {
    HORAS_ENTRE_VOTOS, ORO_POR_VOTO, urlVoto, urlFicha, webhookConfigurado,
    autorizacionValida, leerVoto, estadoVoto, rellenar, procesarVoto, publicarEstadisticas, resumenServidor,
    ponerRecordatorio, tieneRecordatorio, avisarRecordatorios,
};
