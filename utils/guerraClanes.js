// ⚔️ Guerra de clanes (1.33.0). Cada semana (lunes UTC, con el cierre de utils/clanes.js) los clanes se emparejan
// de dos en dos por puntos totales parecidos (`emparejar`, pura). Cada clan tiene un rival (`rivalId`): gana su guerra
// el que hace más puntos esa semana (los de siempre, por XP) y, además, cada combate ganado (/jugar combate) a alguien del
// clan rival suma PUNTOS_COMBATE (solo los que cuentan para el ELO). El ganador suma una copa y cada miembro se lleva
// `clanes.premioGuerra` de oro. Un clan nuevo a media semana se empareja al mirar `/clan guerra` si hay otro libre.
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Clan = require('../models/Clan.js');
const { t } = require('./i18n.js');

const PUNTOS_COMBATE = 300;
const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const semanaISO = () => require('./dinamicas.js').semanaISO();

// Parejas por puntos totales parecidos: [[a, b], …] y el que se queda sin rival (si son impares).
function emparejar(clanes) {
    const orden = [...clanes].sort((a, b) => (b.puntosTotal || 0) - (a.puntosTotal || 0) || String(a._id).localeCompare(String(b._id)));
    const parejas = [];
    for (let i = 0; i + 1 < orden.length; i += 2) parejas.push([orden[i], orden[i + 1]]);
    return { parejas, libre: orden.length % 2 ? orden[orden.length - 1] : null };
}
// Resultado de una guerra: 'a' | 'b' | 'empate'.
const ganadorGuerra = (a, b) => ((a.puntosSemana || 0) > (b.puntosSemana || 0) ? 'a' : (b.puntosSemana || 0) > (a.puntosSemana || 0) ? 'b' : 'empate');

async function emparejarServidor(guildId, semana) {
    const clanes = await Clan.find({ guildId, 'miembros.0': { $exists: true } }).lean();
    const { parejas, libre } = emparejar(clanes);
    for (const [a, b] of parejas) {
        await Clan.updateOne({ _id: a._id }, { $set: { rivalId: String(b._id), guerraSemana: semana } });
        await Clan.updateOne({ _id: b._id }, { $set: { rivalId: String(a._id), guerraSemana: semana } });
    }
    if (libre) await Clan.updateOne({ _id: libre._id }, { $set: { rivalId: null, guerraSemana: semana } });
    return parejas.length;
}

// Rival de un clan esta semana; si no tiene y hay otro clan libre, se emparejan ahora (de una vez, sin pisarse).
async function rivalDe(clan, semana = semanaISO()) {
    if (clan.guerraSemana === semana && clan.rivalId) {
        const rival = await Clan.findById(clan.rivalId).lean();
        if (rival) return rival;
        // El rival se ha disuelto: este clan vuelve a estar libre y se busca otro.
        await Clan.updateOne({ _id: clan._id, rivalId: clan.rivalId }, { $set: { rivalId: null } });
        clan = { ...clan, rivalId: null };
    }
    const libre = { guildId: clan.guildId, _id: { $ne: clan._id }, 'miembros.0': { $exists: true }, $or: [{ guerraSemana: { $ne: semana } }, { rivalId: null }] };
    const candidatos = await Clan.find(libre).lean();
    candidatos.sort((x, y) => Math.abs((x.puntosTotal || 0) - (clan.puntosTotal || 0)) - Math.abs((y.puntosTotal || 0) - (clan.puntosTotal || 0)));
    for (const c of candidatos) {
        const otro = await Clan.findOneAndUpdate({ _id: c._id, $or: [{ guerraSemana: { $ne: semana } }, { rivalId: null }] }, { $set: { rivalId: String(clan._id), guerraSemana: semana } }, { returnDocument: 'after' }).lean();
        if (!otro) continue;
        const yo = await Clan.updateOne({ _id: clan._id, $or: [{ guerraSemana: { $ne: semana } }, { rivalId: null }] }, { $set: { rivalId: String(c._id), guerraSemana: semana } });
        if (yo.modifiedCount) return otro;
        // Alguien emparejó a este clan a la vez: se deshace lo del otro.
        await Clan.updateOne({ _id: c._id, rivalId: String(clan._id) }, { $set: { rivalId: null } });
        const ya = await Clan.findById(clan._id).lean();
        return ya?.rivalId ? Clan.findById(ya.rivalId).lean() : null;
    }
    return null;
}

// Un combate ganado (que cuenta para el ELO) a alguien del clan rival suma puntos. Devuelve el texto o null.
async function combate(guildId, ganadorId, perdedorId, idioma) {
    const semana = semanaISO();
    const [cg, cp] = await Promise.all([Clan.findOne({ guildId, miembros: ganadorId }).lean(), Clan.findOne({ guildId, miembros: perdedorId }).lean()]);
    if (!cg || !cp || cg.guerraSemana !== semana || cg.rivalId !== String(cp._id)) return null;
    await Clan.updateOne({ _id: cg._id }, { $inc: { puntosSemana: PUNTOS_COMBATE, puntosTotal: PUNTOS_COMBATE, guerraCombates: 1 } });
    return t(idioma, `⚔️ **Guerra de clanes:** ${cg.emoji} ${cg.nombre} +${PUNTOS_COMBATE} puntos contra ${cp.emoji} ${cp.nombre}.`, `⚔️ **Clan war:** ${cg.emoji} ${cg.nombre} +${PUNTOS_COMBATE} points against ${cp.emoji} ${cp.nombre}.`);
}

// Cierre (antes de poner a cero los puntos de la semana): copas, oro y el resumen para el anuncio.
async function cerrarGuerras(cfg, semana) {
    const clanes = await Clan.find({ guildId: cfg.guildId, guerraSemana: semana, rivalId: { $ne: null } }).lean();
    const porId = new Map(clanes.map((c) => [String(c._id), c]));
    const hechas = new Set(); const lineas = [];
    const premio = cfg.clanes?.premioGuerra ?? 150;
    for (const a of clanes) {
        const b = porId.get(a.rivalId);
        if (!b || b.rivalId !== String(a._id) || hechas.has(String(a._id))) continue;
        hechas.add(String(a._id)); hechas.add(String(b._id));
        // Cada guerra se cierra una sola vez (aunque el cierre se repita).
        const cierre = await Clan.updateMany({ _id: { $in: [a._id, b._id] }, guerraCerrada: { $ne: semana } }, { $set: { guerraCerrada: semana } });
        if (cierre.modifiedCount < 2) continue;
        const g = ganadorGuerra(a, b);
        if (g === 'empate') { lineas.push(t(cfg, `🤝 ${a.emoji} ${a.nombre} y ${b.emoji} ${b.nombre} empatan (${fmt(a.puntosSemana, cfg)}).`, `🤝 ${a.emoji} ${a.nombre} and ${b.emoji} ${b.nombre} tie (${fmt(a.puntosSemana, cfg)}).`)); continue; }
        const [gan, per] = g === 'a' ? [a, b] : [b, a];
        // La copa se da una sola vez aunque el cierre se repita (se apunta la semana premiada).
        const r = await Clan.updateOne({ _id: gan._id, copaSemana: { $ne: semana } }, { $inc: { copas: 1 }, $set: { copaSemana: semana } });
        if (r.modifiedCount && premio > 0) for (const u of gan.miembros) await require('./economia.js').en(cfg.guildId).darOro(u, premio).catch(() => {});
        lineas.push(t(cfg, `🏆 ${gan.emoji} **${gan.nombre}** gana a ${per.emoji} ${per.nombre} (${fmt(gan.puntosSemana, cfg)} a ${fmt(per.puntosSemana, cfg)})${premio ? ` · 🪙 ${fmt(premio, cfg)} para cada miembro` : ''}`, `🏆 ${gan.emoji} **${gan.nombre}** beats ${per.emoji} ${per.nombre} (${fmt(gan.puntosSemana, cfg)} to ${fmt(per.puntosSemana, cfg)})${premio ? ` · 🪙 ${fmt(premio, cfg)} for each member` : ''}`));
    }
    return lineas;
}

// Tarjeta de la guerra: los dos clanes, sus puntos y la barra.
async function dibujo(a, b, idioma, fin) {
    const A = require('./casinoArte.js');
    if (!A.listo()) return null;
    const { FUENTE } = require('./fonts.js');
    const W = 760; const H = 280;
    const { c, ctx } = A.lienzo(W, H);
    const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#1d4ed8'); g.addColorStop(0.5, '#0f172a'); g.addColorStop(1, '#b91c1c');
    A.redondeado(ctx, 0, 0, W, H, 22); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(W / 2 - 10 + i * 3, 0); ctx.lineTo(W / 2 + 30 - i * 6, H); ctx.lineTo(W / 2 + 34 - i * 6, H); ctx.lineTo(W / 2 - 6 + i * 3, 0); ctx.fill(); }
    ctx.fillStyle = '#fde68a'; ctx.font = `900 46px ${FUENTE}`; ctx.textAlign = 'center'; ctx.fillText('VS', W / 2, 128);
    const lado = (cl, x, color) => {
        ctx.font = `64px ${FUENTE}`; ctx.fillText(cl.emoji || '🛡️', x, 96);
        ctx.fillStyle = '#fff'; ctx.font = `900 24px ${FUENTE}`; ctx.fillText(cl.nombre.slice(0, 18), x, 140);
        ctx.fillStyle = color; ctx.font = `900 34px ${FUENTE}`; ctx.fillText(fmt(cl.puntosSemana, idioma), x, 182);
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `bold 14px ${FUENTE}`; ctx.fillText(t(idioma, `${cl.miembros.length} miembros · 🏆 ${cl.copas || 0} copas`, `${cl.miembros.length} members · 🏆 ${cl.copas || 0} cups`), x, 206);
    };
    lado(a, W / 4, '#93c5fd'); ctx.fillStyle = '#fff'; lado(b, (3 * W) / 4, '#fca5a5');
    const total = (a.puntosSemana || 0) + (b.puntosSemana || 0);
    const k = total ? (a.puntosSemana || 0) / total : 0.5;
    A.redondeado(ctx, 40, 228, W - 80, 22, 11); ctx.fillStyle = '#ef4444'; ctx.fill();
    ctx.save(); A.redondeado(ctx, 40, 228, W - 80, 22, 11); ctx.clip(); ctx.fillStyle = '#3b82f6'; ctx.fillRect(40, 228, (W - 80) * k, 22); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = `bold 13px ${FUENTE}`; ctx.fillText(fin, W / 2, 268);
    return c.toBuffer('image/png');
}

async function vista(guildId, userId, idioma) {
    const clan = await Clan.findOne({ guildId, miembros: userId }).lean();
    if (!clan) return { content: t(idioma, 'No estás en ningún clan. Únete con `/clan unirme` o funda uno con `/clan crear`.', 'You’re not in a clan. Join one with `/clan join` or found one with `/clan create`.'), flags: 64 };
    const rival = await rivalDe(clan);
    const e = new EmbedBuilder().setColor('#b91c1c').setTitle(t(idioma, '⚔️ Guerra de clanes de esta semana', '⚔️ This week’s clan war'));
    const lunes = (() => { const d = new Date(); const dia = d.getUTCDay() || 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 8 - dia); })();
    if (!rival) {
        e.setDescription(t(idioma, `${clan.emoji} **${clan.nombre}** no tiene rival esta semana (no hay otro clan libre). En cuanto haya otro clan, os emparejaréis.`, `${clan.emoji} **${clan.nombre}** has no rival this week (no other clan is free). As soon as there’s another clan, you’ll be paired.`));
        return { embeds: [e], flags: 64 };
    }
    const yo = await Clan.findById(clan._id).lean();
    const png = await dibujo(yo, rival, idioma, t(idioma, `Termina el lunes · cada combate ganado a un rival: +${PUNTOS_COMBATE}`, `Ends on Monday · every fight won against a rival: +${PUNTOS_COMBATE}`)).catch(() => null);
    e.setDescription([
        t(idioma, `${yo.emoji} **${yo.nombre}** contra ${rival.emoji} **${rival.nombre}** · acaba <t:${Math.floor(lunes / 1000)}:R>.`, `${yo.emoji} **${yo.nombre}** vs ${rival.emoji} **${rival.nombre}** · ends <t:${Math.floor(lunes / 1000)}:R>.`),
        t(idioma, `**Cómo se suman puntos:** cada XP que ganáis cuenta 1 y cada combate (\`/jugar combate\`) que ganéis a alguien de ${rival.nombre}, **+${PUNTOS_COMBATE}**. El clan que gane se lleva una 🏆 copa y oro para cada miembro.`, `**How to score:** every XP you earn counts 1 and every fight (\`/games fight\`) you win against someone from ${rival.nombre}, **+${PUNTOS_COMBATE}**. The winning clan gets a 🏆 cup and gold for each member.`),
        png ? '' : `${fmt(yo.puntosSemana, idioma)} — ${fmt(rival.puntosSemana, idioma)}`,
    ].filter(Boolean).join('\n\n'));
    if (png) e.setImage('attachment://guerra.png');
    return { embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'guerra.png' })] : [] };
}

module.exports = { PUNTOS_COMBATE, emparejar, ganadorGuerra, emparejarServidor, rivalDe, combate, cerrarGuerras, vista, dibujo };
