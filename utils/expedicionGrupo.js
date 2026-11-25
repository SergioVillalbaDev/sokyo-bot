// 🧭 Expediciones en grupo (1.33.0). `/expedicion destino:<cueva|ruinas|volcan>` abre una en el canal: durante
// UNIRSE_MS cada uno se apunta con su compañero equipado (expg_si:<id>); quien la abre puede salir antes (expg_ya:<id>)
// si ya son GRUPO.min. Al salir, cada compañero se va como en una expedición normal (compis.accion 'exp:<destino>',
// con energía, tope diario y misiones), pero con `bonus` = GRUPO.bonus(n): cuantos más, más oro trae cada uno.
// Cada uno recoge lo suyo en /compi al volver; el canal recibe un aviso cuando vuelven (si el bot no se ha reiniciado).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');
const { t } = require('./i18n.js');

const UNIRSE_MS = Number(process.env.EXPG_UNIRSE_MS) || 120000;
const grupos = new Map(); // canalId → grupo
const fmtX = (v, idioma) => (idioma === 'en' ? String(v) : String(v).replace('.', ','));
const nombreComp = (m, idioma) => m.apodo || t(idioma, K.def(m.id).es, K.def(m.id).en).split(',')[0];

async function dibujo(g, { fin = false } = {}) {
    const A = require('./casinoArte.js');
    if (!A.listo()) return null;
    const { FUENTE } = require('./fonts.js');
    const x = P.EXPEDICIONES[g.destino];
    const W = 760; const H = 300;
    const { c, ctx } = A.lienzo(W, H);
    const cielo = ctx.createLinearGradient(0, 0, 0, H); cielo.addColorStop(0, x.color[0]); cielo.addColorStop(1, x.color[1]);
    A.redondeado(ctx, 0, 0, W, H, 22); ctx.fillStyle = cielo; ctx.fill();
    // Montañas al fondo y suelo
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.moveTo(0, 190); for (let i = 0; i <= 8; i++) ctx.lineTo(i * 95, 120 + (i % 2 ? -40 : 20)); ctx.lineTo(W, 300); ctx.lineTo(0, 300); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(15,23,42,0.55)'; ctx.fillRect(0, 232, W, 68);
    ctx.fillStyle = '#fff'; ctx.font = `900 24px ${FUENTE}`; ctx.textAlign = 'left';
    ctx.fillText(`${x.emoji}  ${t(g.idioma, x.es, x.en).toUpperCase()}`, 24, 40);
    ctx.font = `bold 15px ${FUENTE}`; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const n = g.miembros.size;
    ctx.fillText(fin ? t(g.idioma, `${n} compañeros en marcha · cada uno trae ×${fmtX(P.GRUPO.bonus(n), g.idioma)} de oro`, `${n} companions on the way · each brings ×${P.GRUPO.bonus(n)} gold`) : t(g.idioma, `${n}/${P.GRUPO.max} apuntados · ahora mismo ×${fmtX(P.GRUPO.bonus(n), g.idioma)} de oro para cada uno`, `${n}/${P.GRUPO.max} joined · right now ×${P.GRUPO.bonus(n)} gold each`), 24, 66);
    const lista = [...g.miembros.values()];
    const tam = Math.min(120, Math.floor((W - 40) / Math.max(1, lista.length)) - 6);
    const fotos = await Promise.all(lista.map((mi) => A.imagenCompanero(mi.compId, { humor: 'feliz', variante: mi.variante || null, acc: mi.acc || null }).catch(() => null)));
    lista.forEach((mi, i) => {
        const cx = W / 2 + (i - (lista.length - 1) / 2) * (tam + 6);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx, 262, tam * 0.36, 8, 0, 0, Math.PI * 2); ctx.fill();
        if (fotos[i]) A.pintarCompanero(ctx, fotos[i], mi.compId, cx - tam / 2, 262 - tam - 4, tam, K.RAREZAS[K.def(mi.compId).rareza].color);
        ctx.fillStyle = '#fff'; ctx.font = `bold 13px ${FUENTE}`; ctx.textAlign = 'center';
        ctx.fillText(mi.nombre.slice(0, 12), cx, 288);
    });
    return c.toBuffer('image/png');
}

async function vista(g, { estado = 'abierta', texto = '' } = {}) {
    const idioma = g.idioma; const x = P.EXPEDICIONES[g.destino];
    const n = g.miembros.size;
    const e = new EmbedBuilder().setColor(x.color[1]).setTitle(t(idioma, `🧭 Expedición en grupo: ${x.emoji} ${x.es}`, `🧭 Group expedition: ${x.emoji} ${x.en}`));
    const lineas = [];
    if (estado === 'abierta') {
        lineas.push(t(idioma, `**¡Apúntate con tu compañero!** Salen <t:${Math.floor(g.sale / 1000)}:R> (${x.horas} h fuera, gasta ⚡${x.energia}). Cuantos más vayan, **más oro trae cada uno** (hasta ×2).`, `**Join with your companion!** Leaving <t:${Math.floor(g.sale / 1000)}:R> (${x.horas} h away, uses ⚡${x.energia}). The more who go, **the more gold each one brings** (up to ×2).`));
        lineas.push(t(idioma, `Va tu compañero equipado. Hacen falta ${P.GRUPO.min} como mínimo.`, `Your equipped companion goes. At least ${P.GRUPO.min} are needed.`));
    } else if (estado === 'fuera') {
        lineas.push(t(idioma, `🚶 **¡Se han ido!** Vuelven <t:${Math.floor(g.vuelve / 1000)}:R>. Entonces, cada uno recoge lo suyo en \`/compi\`.`, `🚶 **They’re off!** Back <t:${Math.floor(g.vuelve / 1000)}:R>. Then everyone collects their share in \`/companion\`.`));
    } else if (estado === 'cancelada') lineas.push(t(idioma, `No se han apuntado bastantes (mínimo ${P.GRUPO.min}): expedición cancelada.`, `Not enough joined (minimum ${P.GRUPO.min}): expedition cancelled.`));
    if (texto) lineas.push(texto);
    lineas.push('', [...g.miembros.entries()].map(([u, mi]) => `${K.def(mi.compId).emoji} **${mi.nombre}** · <@${u}>`).join('\n') || t(idioma, '*Aún no se ha apuntado nadie.*', '*Nobody has joined yet.*'));
    e.setDescription(lineas.join('\n').slice(0, 4000));
    const png = estado === 'cancelada' ? null : await dibujo(g, { fin: estado === 'fuera' }).catch(() => null);
    if (png) e.setImage('attachment://expedicion.png');
    const comps = estado === 'abierta' ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`expg_si:${g.id}`).setEmoji('🎒').setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Apuntar a mi compañero', 'Join with my companion')).setDisabled(n >= P.GRUPO.max),
        new ButtonBuilder().setCustomId(`expg_no:${g.id}`).setEmoji('🚪').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Borrarme', 'Leave')),
        new ButtonBuilder().setCustomId(`expg_ya:${g.id}`).setEmoji('🚶').setStyle(ButtonStyle.Primary).setLabel(t(idioma, 'Salir ya', 'Leave now')).setDisabled(n < P.GRUPO.min),
    )] : [];
    return { embeds: [e], components: comps, files: png ? [new AttachmentBuilder(png, { name: 'expedicion.png' })] : [], attachments: [], allowedMentions: { parse: [] } };
}
// La vista se prepara antes (dibuja con await) y la fila solo la manda.
const pintar = async (g, opc) => { const v = await vista(g, opc); return require('./casino.js').editarEnFila(g, () => v); };

// ¿Puede ir? Devuelve { compId, nombre, … } o { error }.
async function comprobar(guildId, userId, destino, idioma) {
    const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
    const m = col?.mascotas?.find((x) => x.id === col.equipada) || col?.mascotas?.[0];
    if (!m) return { error: t(idioma, 'Aún no tienes compañero: consigue uno con `/cofre`.', 'You don’t have a companion yet: get one with `/chest`.') };
    const dia = P.diaDe();
    const r = P.salir(m, destino, col.expHoy, dia);
    if (r.fallo) return { error: require('./compis.js').textoFallo(r.fallo, idioma) };
    return { compId: m.id, nombre: nombreComp(m, idioma), variante: m.variante, acc: m.acc };
}

async function abrir({ interaction, idioma, destino }) {
    if (!P.EXPEDICIONES[destino]?.grupo) destino = 'cueva';
    if (grupos.has(interaction.channelId)) return { error: t(idioma, 'Ya hay una expedición en grupo en este canal: ¡apúntate a esa!', 'There’s already a group expedition in this channel: join that one!') };
    const yo = await comprobar(interaction.guildId, interaction.user.id, destino, idioma);
    if (yo.error) return { error: yo.error };
    const g = { id: require('crypto').randomBytes(5).toString('hex'), canalId: interaction.channelId, guildId: interaction.guildId, destino, anfitrion: interaction.user.id, miembros: new Map([[interaction.user.id, yo]]), sale: Date.now() + UNIRSE_MS, idioma, estado: 'abierta', client: interaction.client };
    grupos.set(g.canalId, g);
    const msg = await interaction.editReply(await vista(g));
    g.interaction = { editReply: (v) => (msg?.edit ? msg.edit(v) : interaction.editReply(v)) };
    g.canal = interaction.channel;
    g.temporizador = setTimeout(() => salir(g).catch((e) => { console.error('Expedición en grupo:', e.message); grupos.delete(g.canalId); }), UNIRSE_MS);
    return { ok: true };
}

async function salir(g, texto = '') {
    if (g.estado !== 'abierta') return;
    g.estado = 'saliendo';
    clearTimeout(g.temporizador);
    grupos.delete(g.canalId);
    const idioma = g.idioma;
    // Se vuelve a mirar a cada uno (puede haber gastado energía mientras tanto) y solo cuentan los que pueden.
    const fallan = [];
    for (const [u] of [...g.miembros]) {
        const r = await comprobar(g.guildId, u, g.destino, idioma);
        if (r.error) { fallan.push(`<@${u}>: ${r.error}`); g.miembros.delete(u); } else g.miembros.set(u, { ...g.miembros.get(u), ...r });
    }
    if (g.miembros.size < P.GRUPO.min) { g.estado = 'cancelada'; await pintar(g, { estado: 'cancelada', texto: fallan.join('\n') }); return; }
    const bonus = P.GRUPO.bonus(g.miembros.size);
    const compis = require('./compis.js');
    for (const [u, mi] of [...g.miembros]) {
        const r = await compis.accion(g.guildId, u, mi.compId, `exp:${g.destino}`, { idioma, expGrupo: { bonus, grupo: g.id } }).catch((e) => ({ fallo: 'accion', e }));
        if (r.fallo) { fallan.push(`<@${u}>: ${compis.textoFallo(r.fallo, idioma)}`); g.miembros.delete(u); }
    }
    g.estado = 'fuera';
    g.vuelve = Date.now() + P.EXPEDICIONES[g.destino].horas * 3600000;
    await pintar(g, { estado: 'fuera', texto: [texto, ...fallan].filter(Boolean).join('\n') });
    // Aviso al volver (en memoria: si el bot se reinicia, cada uno lo verá igual en /compi).
    const ids = [...g.miembros.keys()];
    const aviso = setTimeout(() => {
        g.canal?.send({ content: t(idioma, `${P.EXPEDICIONES[g.destino].emoji} **¡La expedición a «${P.EXPEDICIONES[g.destino].es}» ha vuelto!** ${ids.map((u) => `<@${u}>`).join(' ')}: recoged lo que traen con \`/compi\`.`, `${P.EXPEDICIONES[g.destino].emoji} **The “${P.EXPEDICIONES[g.destino].en}” expedition is back!** ${ids.map((u) => `<@${u}>`).join(' ')}: collect what they brought with \`/companion\`.`), allowedMentions: { users: ids } }).catch(() => {});
    }, g.vuelve - Date.now());
    aviso.unref?.();
}

async function manejar(interaction) {
    const id = interaction.customId || '';
    if (!id.startsWith('expg_')) return false;
    const [tipo, gid] = id.split(':');
    const g = [...grupos.values()].find((x) => x.id === gid);
    const { idiomaInteraccion } = require('./preferencias.js');
    const idioma = await idiomaInteraccion(interaction, null).catch(() => g?.idioma || 'es');
    const responder = (content) => interaction.reply({ content, flags: 64 }).catch(() => {});
    if (!g || g.estado !== 'abierta') { await responder(t(idioma, '⌛ Esta expedición ya ha salido.', '⌛ This expedition has already left.')); return true; }
    const yo = interaction.user.id;
    if (tipo === 'expg_si') {
        if (g.miembros.has(yo)) { await responder(t(idioma, 'Ya estás apuntado.', 'You’ve already joined.')); return true; }
        if (g.miembros.size >= P.GRUPO.max) { await responder(t(idioma, 'El grupo está lleno.', 'The group is full.')); return true; }
        const r = await comprobar(g.guildId, yo, g.destino, idioma);
        if (r.error) { await responder(r.error); return true; }
        if (g.estado !== 'abierta' || g.miembros.size >= P.GRUPO.max) { await responder(t(idioma, '⌛ Justo se ha llenado o ha salido.', '⌛ It just filled up or left.')); return true; }
        g.miembros.set(yo, r);
        await responder(t(idioma, `🎒 ${K.def(r.compId).emoji} **${r.nombre}** se apunta. ¡Buen viaje!`, `🎒 ${K.def(r.compId).emoji} **${r.nombre}** joins. Have a good trip!`));
        await pintar(g);
        return true;
    }
    if (tipo === 'expg_no') {
        if (!g.miembros.has(yo)) { await responder(t(idioma, 'No estás apuntado.', 'You haven’t joined.')); return true; }
        g.miembros.delete(yo);
        if (yo === g.anfitrion) g.anfitrion = g.miembros.keys().next().value || null;
        await responder(t(idioma, 'Te has borrado.', 'You’ve left.'));
        if (!g.miembros.size) { g.estado = 'cancelada'; clearTimeout(g.temporizador); grupos.delete(g.canalId); await pintar(g, { estado: 'cancelada' }); } else await pintar(g);
        return true;
    }
    if (tipo === 'expg_ya') {
        if (yo !== g.anfitrion) { await responder(t(idioma, 'Solo quien la ha abierto puede adelantar la salida.', 'Only whoever opened it can leave early.')); return true; }
        if (g.miembros.size < P.GRUPO.min) { await responder(t(idioma, `Hacen falta ${P.GRUPO.min} como mínimo.`, `At least ${P.GRUPO.min} are needed.`)); return true; }
        await interaction.deferUpdate().catch(() => {});
        await salir(g);
        return true;
    }
    return false;
}

module.exports = { abrir, salir, manejar, grupos, vista };
