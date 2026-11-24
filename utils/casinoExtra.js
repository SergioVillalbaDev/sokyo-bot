// Casino 1.32.0: juegos nuevos y cosas para jugar juntos. Reglas en utils/casinoNucleo.js.
//   · 🔻 Plinko (tres riesgos) y 🎡 Rueda de la fortuna: como el resto, una jugada = un mensaje con su GIF.
//   · 🎡 Ruleta en mesa: una ruleta para todo el canal; 30 s para apostar (botones cas_mr:<id>:<a qué>
//     → ventana para la cantidad) y una sola tirada para todos.
//   · 🎟️ Lotería semanal: boletos (cas_lot:<n>) y sorteo el domingo a las 20:00 UTC (barrerLoteria).
//   · 📈 Tus números: gráfica de cómo te ha ido (cas_st).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const C = require('./casinoNucleo.js');
const A = require('./casinoArte.js');
const { t } = require('./i18n.js');

const casino = () => require('./casino.js');
const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const x = (v) => String(v).replace('.', ',');

// ---------------------------------------------------------------------------
// 🔻 Plinko
// ---------------------------------------------------------------------------
const RIESGOS = { bajo: ['🟢', 'Bajo', 'Low'], medio: ['🟠', 'Medio', 'Medium'], alto: ['🔴', 'Alto', 'High'] };
async function plinko({ interaction, client, cfg, idioma, cantidad, riesgo = 'bajo' }) {
    if (!C.PLINKO[riesgo]) riesgo = 'bajo';
    const K = casino();
    const a = await K.apostar({ guildId: interaction.guildId, canalId: interaction.channelId, userId: interaction.user.id, cfg, juego: 'plinko', cantidad });
    if (a.fallo) return { error: K.textoFallo(a, idioma, cfg.casino) };
    const tiro = C.tirarPlinko(riesgo);
    const premio = Math.floor(a.jugada.apuesta * tiro.mult);
    const { vuelta } = await K.cobrarJugada(null, cfg, a.jugada, premio, { riesgo, casilla: tiro.casilla, mult: tiro.mult });
    const saldo = await K.saldoDe(interaction.guildId, interaction.user.id);
    const gif = await A.gifPlinko({ ...tiro, mults: C.PLINKO[riesgo], res: { premio, apuesta: a.jugada.apuesta, idioma, saldo, vuelta } }).catch((e) => { console.warn('GIF plinko:', e.message); return null; });
    const e = new EmbedBuilder().setColor(premio > a.jugada.apuesta ? '#16a34a' : premio ? '#a16207' : '#7f1d1d').setTitle(`🔻 Plinko · ${RIESGOS[riesgo][0]} ${t(idioma, RIESGOS[riesgo][1], RIESGOS[riesgo][2])} · 🪙 ${fmt(a.jugada.apuesta, idioma)}`)
        .setFooter({ text: K.pieSaldo(idioma, saldo, vuelta) });
    if (gif) e.setImage('attachment://plinko.gif').setDescription(K.oculto(`×${x(tiro.mult)}  ${K.masMenos(premio, a.jugada.apuesta, idioma)}`));
    else e.setDescription(`×${x(tiro.mult)} → ${K.masMenos(premio, a.jugada.apuesta, idioma)}`);
    await interaction.editReply({ embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'plinko.gif' })] : [], components: [K.filaOtraVez('plinko', a.jugada.apuesta, idioma, riesgo)], allowedMentions: { parse: [] } });
    K.anunciarDespues(gif ? 2600 : 0, client, cfg, a.jugada, premio);
    return { ok: true, premio };
}

// ---------------------------------------------------------------------------
// 🎡 Rueda de la fortuna
// ---------------------------------------------------------------------------
const COLORES_RUEDA = Object.fromEntries(C.RUEDA.map((r) => [r.n, r.color]));
async function rueda({ interaction, client, cfg, idioma, cantidad, numero = 1 }) {
    if (!C.RUEDA.some((r) => r.n === numero)) numero = 1;
    const K = casino();
    const a = await K.apostar({ guildId: interaction.guildId, canalId: interaction.channelId, userId: interaction.user.id, cfg, juego: 'rueda', cantidad });
    if (a.fallo) return { error: K.textoFallo(a, idioma, cfg.casino) };
    const giro = C.girarRueda();
    const mult = C.pagoRueda(numero, giro.numero);
    const premio = Math.floor(a.jugada.apuesta * mult);
    const { vuelta } = await K.cobrarJugada(null, cfg, a.jugada, premio, { numero, sale: giro.numero });
    const saldo = await K.saldoDe(interaction.guildId, interaction.user.id);
    const gif = await A.gifRueda({ casillas: C.CASILLAS_RUEDA, colores: COLORES_RUEDA, indice: giro.indice, res: { premio, apuesta: a.jugada.apuesta, idioma, saldo, vuelta, mult } }).catch((e) => { console.warn('GIF rueda:', e.message); return null; });
    const pago = C.RUEDA.find((r) => r.n === numero).paga;
    const e = new EmbedBuilder().setColor(premio ? '#16a34a' : '#7f1d1d').setTitle(t(idioma, `🎡 Rueda · al ${numero} (×${x(pago)}) · 🪙 ${fmt(a.jugada.apuesta, idioma)}`, `🎡 Wheel · on ${numero} (×${pago}) · 🪙 ${fmt(a.jugada.apuesta, idioma)}`))
        .setFooter({ text: K.pieSaldo(idioma, saldo, vuelta) });
    if (gif) e.setImage('attachment://rueda.gif').setDescription(K.oculto(`${t(idioma, 'Sale', 'It lands on')} **${giro.numero}** · ${K.masMenos(premio, a.jugada.apuesta, idioma)}`));
    else e.setDescription(`${t(idioma, 'Sale', 'It lands on')} **${giro.numero}** · ${K.masMenos(premio, a.jugada.apuesta, idioma)}`);
    await interaction.editReply({ embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'rueda.gif' })] : [], components: [K.filaOtraVez('rueda', a.jugada.apuesta, idioma, String(numero))], allowedMentions: { parse: [] } });
    K.anunciarDespues(gif ? 3600 : 0, client, cfg, a.jugada, premio);
    return { ok: true, premio };
}

// ---------------------------------------------------------------------------
// 🎡 Ruleta en mesa (todo el canal, una tirada)
// ---------------------------------------------------------------------------
const MESA_MS = 30000;
const mesas = new Map(); // canalId → mesa
const APUESTAS_MESA = [
    { id: 'rojo', emoji: '🔴', es: 'Rojo', en: 'Red' }, { id: 'negro', emoji: '⚫', es: 'Negro', en: 'Black' },
    { id: 'par', emoji: '2️⃣', es: 'Par', en: 'Even' }, { id: 'impar', emoji: '1️⃣', es: 'Impar', en: 'Odd' },
    { id: 'verde', emoji: '🟢', es: 'El 0 (×36)', en: 'Zero (×36)' },
];
const pagoMesa = (apuesta, sale) => (apuesta === 'verde' ? C.pagoRuleta('numero', 0, sale) : C.pagoRuleta(apuesta, null, sale));
function vistaMesa(m, idioma, { cerrada = false } = {}) {
    const lista = [...m.apuestas.values()].filter((a) => a.jugada);
    const e = new EmbedBuilder().setColor('#16a34a').setTitle(t(idioma, '🎡 Ruleta en mesa', '🎡 Table roulette'))
        .setDescription([
            cerrada ? t(idioma, '🛑 **No va más.** ¡Gira la ruleta!', '🛑 **No more bets.** Spinning!') : t(idioma, `Una tirada para todo el canal. **Apuesta antes de <t:${Math.floor(m.cierra / 1000)}:R>** (una apuesta por persona).`, `One spin for the whole channel. **Bet before <t:${Math.floor(m.cierra / 1000)}:R>** (one bet per person).`),
            '',
            lista.length ? lista.map((a) => `${APUESTAS_MESA.find((b) => b.id === a.apuesta).emoji} <@${a.userId}> · 🪙 ${fmt(a.cantidad, idioma)}`).join('\n') : t(idioma, '*Aún no ha apostado nadie.*', '*No bets yet.*'),
        ].join('\n'))
        .setFooter({ text: t(idioma, 'Rojo, negro, par e impar pagan ×2 · el 0 paga ×36', 'Red, black, even and odd pay ×2 · zero pays ×36') });
    const comps = cerrada ? [] : [new ActionRowBuilder().addComponents(APUESTAS_MESA.map((b) => new ButtonBuilder().setCustomId(`cas_mr:${m.id}:${b.id}`).setEmoji(b.emoji).setLabel(t(idioma, b.es, b.en)).setStyle(b.id === 'rojo' ? ButtonStyle.Danger : b.id === 'verde' ? ButtonStyle.Success : ButtonStyle.Secondary)))];
    return { embeds: [e], components: comps, allowedMentions: { parse: [] } };
}
async function mesa({ interaction, client, cfg, idioma }) {
    const c = cfg?.casino;
    const K = casino();
    if (!c?.activo) return { error: K.textoFallo({ fallo: 'apagado' }, idioma) };
    if (c.juegos?.ruleta === false) return { error: K.textoFallo({ fallo: 'juego' }, idioma) };
    if (c.canalId && c.canalId !== interaction.channelId) return { error: K.textoFallo({ fallo: 'canal' }, idioma, c) };
    if (mesas.has(interaction.channelId)) return { error: t(idioma, 'Ya hay una ruleta en mesa en este canal: ¡apuesta en ella!', 'There’s already a table roulette here: bet on it!') };
    const m = { id: require('crypto').randomBytes(5).toString('hex'), canalId: interaction.channelId, guildId: interaction.guildId, cierra: Date.now() + MESA_MS, apuestas: new Map(), cfg, idioma, interaction };
    mesas.set(interaction.channelId, m);
    await interaction.editReply(vistaMesa(m, idioma));
    setTimeout(() => girarMesa(client, m).catch((e) => { console.error('Ruleta en mesa:', e.message); mesas.delete(m.canalId); }), MESA_MS);
    return { ok: true };
}
async function botonMesa(interaction) {
    const [, id, apuesta] = interaction.customId.split(':');
    const m = [...mesas.values()].find((x2) => x2.id === id);
    const idioma = m?.idioma || 'es';
    if (!m || Date.now() > m.cierra) return interaction.reply({ content: t(idioma, '⌛ Las apuestas ya están cerradas.', '⌛ Bets are closed.'), flags: 64 });
    if (m.apuestas.has(interaction.user.id)) return interaction.reply({ content: t(idioma, 'Ya has apostado en esta tirada.', 'You already bet on this spin.'), flags: 64 });
    const b = APUESTAS_MESA.find((y) => y.id === apuesta);
    if (!b) return interaction.reply({ content: '❌', flags: 64 });
    return interaction.showModal(new ModalBuilder().setCustomId(`cas_mrm:${id}:${apuesta}`).setTitle(t(idioma, `Apostar a ${b.es}`, `Bet on ${b.en}`))
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cantidad').setLabel(t(idioma, 'Cuánto oro', 'How much gold')).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(9))));
}
async function modalMesa(interaction, client) {
    const [, id, apuesta] = interaction.customId.split(':');
    const m = [...mesas.values()].find((y) => y.id === id);
    const idioma = m?.idioma || 'es';
    const K = casino();
    if (!m || Date.now() > m.cierra) return interaction.reply({ content: t(idioma, '⌛ Las apuestas ya están cerradas.', '⌛ Bets are closed.'), flags: 64 });
    if (m.apuestas.has(interaction.user.id)) return interaction.reply({ content: t(idioma, 'Ya has apostado en esta tirada.', 'You already bet on this spin.'), flags: 64 });
    const cantidad = parseInt(interaction.fields.getTextInputValue('cantidad').replace(/\D/g, ''), 10);
    m.apuestas.set(interaction.user.id, { userId: interaction.user.id, apuesta, cantidad: 0, jugada: null }); // reserva
    const a = await K.apostar({ guildId: m.guildId, canalId: m.canalId, userId: interaction.user.id, cfg: m.cfg, juego: 'ruleta', cantidad });
    if (a.fallo) { m.apuestas.delete(interaction.user.id); return interaction.reply({ content: K.textoFallo(a, idioma, m.cfg.casino), flags: 64 }); }
    if (m.girando || !mesas.has(m.canalId)) {
        await K.cobrarJugada(client, m.cfg, a.jugada, a.jugada.apuesta, { mesa: 'tarde' }).catch(() => {});
        return interaction.reply({ content: t(idioma, '⌛ Ya estaba girando: te devolvemos el oro.', '⌛ It was already spinning: your gold is refunded.'), flags: 64 });
    }
    m.apuestas.set(interaction.user.id, { userId: interaction.user.id, apuesta, cantidad: a.jugada.apuesta, jugada: a.jugada });
    await interaction.reply({ content: t(idioma, `✅ Apuestas 🪙 ${fmt(a.jugada.apuesta, idioma)} a ${APUESTAS_MESA.find((b) => b.id === apuesta).emoji}. ¡Suerte!`, `✅ You bet 🪙 ${fmt(a.jugada.apuesta, idioma)} on ${APUESTAS_MESA.find((b) => b.id === apuesta).emoji}. Good luck!`), flags: 64 });
    await K.editarEnFila(m, () => (m.girando ? null : vistaMesa(m, idioma)));
}
async function girarMesa(client, m) {
    const idioma = m.idioma; const K = casino();
    m.girando = true;
    const lista = [...m.apuestas.values()].filter((a) => a.jugada);
    mesas.delete(m.canalId);
    if (!lista.length) {
        await K.editarEnFila(m, () => ({ embeds: [new EmbedBuilder().setColor('#475569').setDescription(t(idioma, '🎡 Nadie ha apostado: ruleta cerrada.', '🎡 Nobody bet: table closed.'))], components: [] }));
        return;
    }
    const sale = C.girarRuleta();
    const lineas = [];
    for (const a of lista) {
        const premio = Math.floor(a.cantidad * pagoMesa(a.apuesta, sale));
        await K.cobrarJugada(client, m.cfg, a.jugada, premio, { mesa: true, apuesta: a.apuesta, sale });
        lineas.push(`${APUESTAS_MESA.find((b) => b.id === a.apuesta).emoji} <@${a.userId}> ${premio ? `**+🪙 ${fmt(premio, idioma)}**` : `−🪙 ${fmt(a.cantidad, idioma)}`}`);
    }
    const gif = await A.gifRuleta(sale, {}).catch(() => null);
    const color = C.colorNumero(sale) === 'rojo' ? '🔴' : C.colorNumero(sale) === 'negro' ? '⚫' : '🟢';
    const v = vistaMesa(m, idioma, { cerrada: true });
    v.embeds[0].setDescription(`${t(idioma, 'Ha salido', 'It landed on')} ${K.oculto(`${color} **${sale}**`)}\n\n${K.oculto(lineas.join('\n'))}`).setFooter(null);
    if (gif) v.embeds[0].setImage('attachment://ruleta.gif');
    await K.editarEnFila(m, () => ({ ...v, files: gif ? [new AttachmentBuilder(gif, { name: 'ruleta.gif' })] : [], attachments: [] }));
}

// ---------------------------------------------------------------------------
// 🎟️ Lotería semanal
// ---------------------------------------------------------------------------
const LoteriaSemana = () => require('../models/LoteriaSemana.js');
async function loteriaDe(guildId, semana = require('./combateNucleo.js').semanaDe()) {
    return LoteriaSemana().findOneAndUpdate({ guildId, semana }, { $setOnInsert: { guildId, semana } }, { upsert: true, returnDocument: 'after' }).lean();
}
function vistaLoteria(l, userId, idioma) {
    const mios = l.boletos?.[userId] || 0;
    const bote = C.boteLoteria(l.total || 0);
    const sorteo = Math.floor(C.sorteoDe(l.semana).getTime() / 1000);
    const e = new EmbedBuilder().setColor('#f59e0b').setTitle(t(idioma, '🎟️ Lotería de la semana', '🎟️ Weekly lottery'))
        .setDescription([
            t(idioma, `💰 **Bote: 🪙 ${fmt(bote, idioma)}** · ${fmt(l.total || 0, idioma)} boletos vendidos`, `💰 **Pot: 🪙 ${fmt(bote, idioma)}** · ${fmt(l.total || 0, idioma)} tickets sold`),
            t(idioma, `🗓️ Sorteo <t:${sorteo}:F> (<t:${sorteo}:R>)`, `🗓️ Draw <t:${sorteo}:F> (<t:${sorteo}:R>)`),
            t(idioma, `🥇 70 % · 🥈 20 % · 🥉 10 % (cada persona gana uno como mucho)`, '🥇 70% · 🥈 20% · 🥉 10% (one prize per person at most)'),
            t(idioma, `🎫 Tus boletos: **${mios}** de ${C.MAX_BOLETOS} · ${mios && l.total ? `${Math.round((mios / l.total) * 1000) / 10} % de que te toque algo grande` : 'cada uno cuesta 🪙 ' + C.PRECIO_BOLETO}`, `🎫 Your tickets: **${mios}** of ${C.MAX_BOLETOS} · ${mios && l.total ? `${Math.round((mios / l.total) * 1000) / 10}% chance at a big one` : `each costs 🪙 ${C.PRECIO_BOLETO}`}`),
        ].join('\n'))
        .setFooter({ text: t(idioma, 'El oro es virtual. Juega con cabeza 💛', 'Gold is virtual. Play smart 💛') });
    const quedan = C.MAX_BOLETOS - mios;
    const comps = l.sorteado || quedan <= 0 ? [] : [new ActionRowBuilder().addComponents([1, 5, 10].filter((n) => n <= quedan).map((n) => new ButtonBuilder().setCustomId(`cas_lot:${n}`).setEmoji('🎫').setStyle(ButtonStyle.Primary).setLabel(t(idioma, `${n} boleto${n > 1 ? 's' : ''} · 🪙 ${fmt(n * C.PRECIO_BOLETO, idioma)}`, `${n} ticket${n > 1 ? 's' : ''} · 🪙 ${fmt(n * C.PRECIO_BOLETO, idioma)}`))))];
    return { embeds: [e], components: comps, allowedMentions: { parse: [] } };
}
async function comprarBoletos(guildId, userId, n, cfg, idioma) {
    if (!cfg?.casino?.activo || cfg.casino.juegos?.loteria === false) return { error: t(idioma, '🎟️ La lotería no está activada aquí.', '🎟️ The lottery isn’t turned on here.') };
    n = Math.max(1, Math.min(C.MAX_BOLETOS, Math.floor(n || 1)));
    const PerfilCasino = require('../models/PerfilCasino.js');
    const perfil = await PerfilCasino.findOne({ guildId, userId }).lean();
    if (perfil?.pausaHasta && new Date(perfil.pausaHasta) > new Date()) return { error: casino().textoFallo({ fallo: 'pausa' }, idioma) };
    const l = await loteriaDe(guildId);
    if (l.sorteado || Date.now() >= C.sorteoDe(l.semana).getTime()) return { error: t(idioma, '⌛ El sorteo de esta semana ya ha pasado.', '⌛ This week’s draw is over.') };
    const mios = l.boletos?.[userId] || 0;
    if (mios + n > C.MAX_BOLETOS) return { error: t(idioma, `Como mucho ${C.MAX_BOLETOS} boletos por semana (tienes ${mios}).`, `${C.MAX_BOLETOS} tickets a week at most (you have ${mios}).`) };
    const eco = require('./economia.js').en(guildId);
    const coste = n * C.PRECIO_BOLETO;
    const saldo = await eco.cobrar(userId, coste);
    if (saldo === null) return { error: t(idioma, `No tienes 🪙 ${fmt(coste, idioma)}.`, `You don’t have 🪙 ${fmt(coste, idioma)}.`) };
    // Solo si nadie ha comprado a la vez por encima del tope y aún no se ha sorteado.
    const r = await LoteriaSemana().findOneAndUpdate({ _id: l._id, sorteado: false, $or: [{ [`boletos.${userId}`]: { $exists: false } }, { [`boletos.${userId}`]: { $lte: C.MAX_BOLETOS - n } }] }, { $inc: { [`boletos.${userId}`]: n, total: n } }, { returnDocument: 'after' }).lean();
    if (!r) { await eco.darOro(userId, coste); return { error: t(idioma, 'Prueba otra vez.', 'Try again.') }; }
    return { ok: true, l: r, texto: t(idioma, `🎫 ¡${n} boleto${n > 1 ? 's' : ''} comprado${n > 1 ? 's' : ''}! Tienes ${r.boletos[userId]}. Bote: 🪙 ${fmt(C.boteLoteria(r.total), idioma)}.`, `🎫 ${n} ticket${n > 1 ? 's' : ''} bought! You have ${r.boletos[userId]}. Pot: 🪙 ${fmt(C.boteLoteria(r.total), idioma)}.`) };
}
async function loteria({ interaction, cfg, idioma, boletos = 0 }) {
    if (!cfg?.casino?.activo || cfg.casino.juegos?.loteria === false) return { error: t(idioma, '🎟️ La lotería no está activada aquí.', '🎟️ The lottery isn’t turned on here.') };
    if (boletos > 0) {
        const r = await comprarBoletos(interaction.guildId, interaction.user.id, boletos, cfg, idioma);
        if (r.error) return r;
        const v = vistaLoteria(r.l, interaction.user.id, idioma);
        await interaction.editReply({ ...v, content: r.texto });
        return { ok: true };
    }
    await interaction.editReply(vistaLoteria(await loteriaDe(interaction.guildId), interaction.user.id, idioma));
    return { ok: true };
}
// Programador: sortea las loterías cuya hora ha pasado (una sola vez cada una).
async function barrerLoteria(client) {
    const ahora = Date.now();
    const pend = await LoteriaSemana().find({ sorteado: false }).lean();
    for (const l of pend) {
        if (ahora < C.sorteoDe(l.semana).getTime()) continue;
        const res = C.sortearLoteria(l.boletos || {});
        const hecho = await LoteriaSemana().updateOne({ _id: l._id, sorteado: false }, { $set: { sorteado: true, bote: res.bote, ganadores: res.ganadores } });
        if (!hecho.modifiedCount) continue;
        const eco = require('./economia.js').en(l.guildId);
        for (const g of res.ganadores) await eco.darOro(g.userId, g.premio).catch(() => {});
        if (!res.ganadores.length) continue;
        const cfg = await require('../models/ServidorConfig.js').findOne({ guildId: l.guildId }).lean().catch(() => null);
        const guild = client.guilds.cache.get(l.guildId);
        const canal = guild?.channels.cache.get(cfg?.casino?.anunciosId || cfg?.casino?.canalId);
        if (!canal?.isTextBased()) {
            // Sin canal donde anunciarlo: a cada ganador se le avisa por privado (si quiere privados).
            const Pref = require('./preferencias.js');
            for (const g of res.ganadores) {
                if (!await Pref.quiereDM(g.userId, 'anuncios').catch(() => true)) continue;
                const u = await client.users.fetch(g.userId).catch(() => null);
                const iu = await Pref.idiomaMiembro(g.userId, { cfg }).catch(() => 'es');
                if (u) await u.send({ content: t(iu, `🎟️ **¡Te ha tocado la lotería${guild ? ` de ${guild.name}` : ''}!** ${['🥇', '🥈', '🥉'][g.puesto - 1]} +🪙 ${fmt(g.premio, iu)}`, `🎟️ **You won the lottery${guild ? ` in ${guild.name}` : ''}!** ${['🥇', '🥈', '🥉'][g.puesto - 1]} +🪙 ${fmt(g.premio, iu)}`) }).catch(() => {});
            }
            continue;
        }
        await canal.send({ content: [
            t(cfg, `🎟️ **¡Sorteo de la lotería!** Bote: 🪙 ${fmt(res.bote, cfg)} (${fmt(l.total, cfg)} boletos)`, `🎟️ **Lottery draw!** Pot: 🪙 ${fmt(res.bote, cfg)} (${fmt(l.total, cfg)} tickets)`),
            ...res.ganadores.map((g) => `${['🥇', '🥈', '🥉'][g.puesto - 1]} <@${g.userId}> · 🪙 ${fmt(g.premio, cfg)}`),
            t(cfg, 'La de esta semana ya está abierta: `/casino loteria`', 'This week’s is already open: `/casino lottery`'),
        ].join('\n'), allowedMentions: { users: res.ganadores.map((g) => g.userId) } }).catch(() => {});
    }
}

// ---------------------------------------------------------------------------
// 📈 Tus números (con gráfica)
// ---------------------------------------------------------------------------
async function estadisticas(guildId, userId, idioma) {
    const JugadaCasino = require('../models/JugadaCasino.js');
    const jugadas = await JugadaCasino.find({ guildId, userId, estado: 'hecha' }).sort({ _id: -1 }).limit(300).select('juego apuesta premio').lean();
    jugadas.reverse();
    const porJuego = {};
    let neto = 0; const serie = [0]; let ganadas = 0;
    for (const j of jugadas) {
        const d = (j.premio || 0) - (j.apuesta || 0);
        neto += d; serie.push(neto); if (d > 0) ganadas++;
        const p = (porJuego[j.juego] = porJuego[j.juego] || { n: 0, neto: 0 });
        p.n++; p.neto += d;
    }
    const J = casino().JUEGOS;
    const png = await graficaNeto(serie, idioma).catch(() => null);
    const fav = Object.entries(porJuego).sort((a, b) => b[1].n - a[1].n)[0];
    const e = new EmbedBuilder().setColor(neto >= 0 ? '#16a34a' : '#b91c1c').setTitle(t(idioma, '📈 Tus números en el casino', '📈 Your casino numbers'))
        .setDescription(jugadas.length ? [
            t(idioma, `Últimas **${jugadas.length}** partidas: **${neto >= 0 ? '+' : '−'}🪙 ${fmt(Math.abs(neto), idioma)}** · ganadas ${Math.round((ganadas / jugadas.length) * 100)} %`, `Last **${jugadas.length}** games: **${neto >= 0 ? '+' : '−'}🪙 ${fmt(Math.abs(neto), idioma)}** · won ${Math.round((ganadas / jugadas.length) * 100)}%`),
            fav ? t(idioma, `❤️ Tu juego favorito: ${J[fav[0]]?.emoji || '🎲'} ${J[fav[0]]?.es || fav[0]} (${fav[1].n})`, `❤️ Your favourite: ${J[fav[0]]?.emoji || '🎲'} ${J[fav[0]]?.en || fav[0]} (${fav[1].n})`) : '',
            '',
            ...Object.entries(porJuego).sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([j, p]) => `${J[j]?.emoji || '🎲'} ${t(idioma, J[j]?.es || j, J[j]?.en || j)} · ${p.n} · ${p.neto >= 0 ? '+' : '−'}🪙 ${fmt(Math.abs(p.neto), idioma)}`),
        ].filter((l) => l !== null).join('\n') : t(idioma, 'Aún no has jugado. ¡Prueba con `/casino menu`!', 'You haven’t played yet. Try `/casino menu`!'))
        .setFooter({ text: t(idioma, 'A la larga el casino siempre se queda un poco. /casino pausa si necesitas un descanso 💛', 'In the long run the casino always keeps a little. /casino pause if you need a break 💛') });
    if (png) e.setImage('attachment://numeros.png');
    return { embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'numeros.png' })] : [], flags: 64 };
}
async function graficaNeto(serie, idioma) {
    if (!A.listo() || serie.length < 3) return null;
    const W = 720; const H = 300; const P = 46;
    const { c, ctx } = A.lienzo(W, H);
    A.redondeado(ctx, 0, 0, W, H, 20); ctx.fillStyle = '#0f172a'; ctx.fill();
    const min = Math.min(0, ...serie); const max = Math.max(0, ...serie); const rango = max - min || 1;
    const X = (i) => P + (i / (serie.length - 1)) * (W - 2 * P);
    const Y = (v) => H - P - ((v - min) / rango) * (H - 2 * P);
    // Línea del cero
    ctx.strokeStyle = 'rgba(148,163,184,0.35)'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(P, Y(0)); ctx.lineTo(W - P, Y(0)); ctx.stroke(); ctx.setLineDash([]);
    // Relleno y línea (verde por encima del cero, rojo por debajo)
    for (const [signo, color] of [[1, '#22c55e'], [-1, '#ef4444']]) {
        ctx.save(); ctx.beginPath();
        if (signo > 0) ctx.rect(0, 0, W, Y(0)); else ctx.rect(0, Y(0), W, H);
        ctx.clip();
        ctx.beginPath(); ctx.moveTo(X(0), Y(0)); serie.forEach((v, i) => ctx.lineTo(X(i), Y(v))); ctx.lineTo(X(serie.length - 1), Y(0)); ctx.closePath();
        ctx.fillStyle = `${color}33`; ctx.fill();
        ctx.beginPath(); serie.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
    }
    const { FUENTE } = require('./fonts.js');
    ctx.fillStyle = '#cbd5e1'; ctx.font = `bold 13px ${FUENTE}`; ctx.textAlign = 'right';
    ctx.fillText(`+${fmt(max, idioma)}`, P - 6, Y(max) + 4); if (min < 0) ctx.fillText(`−${fmt(-min, idioma)}`, P - 6, Y(min) + 4);
    ctx.textAlign = 'left'; ctx.fillText(t(idioma, `Tu oro en las últimas ${serie.length - 1} partidas`, `Your gold over the last ${serie.length - 1} games`), P, 26);
    const ult = serie[serie.length - 1];
    ctx.beginPath(); ctx.arc(X(serie.length - 1), Y(ult), 6, 0, Math.PI * 2); ctx.fillStyle = ult >= 0 ? '#22c55e' : '#ef4444'; ctx.fill();
    return c.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------
async function manejar(interaction, client) {
    const id = interaction.customId || '';
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    if (interaction.isButton() && id.startsWith('cas_mr:')) { await botonMesa(interaction); return true; }
    if (interaction.isModalSubmit() && id.startsWith('cas_mrm:')) { await modalMesa(interaction, client); return true; }
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    if (interaction.isButton() && id.startsWith('cas_lot:')) {
        const r = await comprarBoletos(interaction.guildId, interaction.user.id, parseInt(id.split(':')[1], 10) || 1, cfg, idioma);
        if (r.error) { await interaction.reply({ content: `❌ ${r.error}`, flags: 64 }); return true; }
        await interaction.reply({ ...vistaLoteria(r.l, interaction.user.id, idioma), content: r.texto, flags: 64 });
        return true;
    }
    if (interaction.isButton() && id === 'cas_st') { await interaction.deferReply({ flags: 64 }); await interaction.editReply(await estadisticas(interaction.guildId, interaction.user.id, idioma)); return true; }
    return false;
}

module.exports = { RIESGOS, APUESTAS_MESA, plinko, rueda, mesa, loteria, comprarBoletos, vistaLoteria, barrerLoteria, estadisticas, graficaNeto, manejar, mesas, girarMesa, loteriaDe };
