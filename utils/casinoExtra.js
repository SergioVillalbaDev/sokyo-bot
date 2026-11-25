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
// 🎲 Dados (sic bo, 1.33.0)
// ---------------------------------------------------------------------------
const NOMBRES_DADOS = {
    grande: ['🔺', 'Grande (11-17)', 'Big (11-17)', '×2'], pequeno: ['🔻', 'Pequeño (4-10)', 'Small (4-10)', '×2'],
    par: ['2️⃣', 'Par', 'Even', '×2'], impar: ['1️⃣', 'Impar', 'Odd', '×2'],
    trio: ['🎯', 'Trío (tres iguales)', 'Triple (three of a kind)', `×${C.TRIO_PAGO}`], numero: ['🎲', 'Número', 'Number', '×2 · ×3 · ×13'],
};
const nombreDados = (apuesta, numero, idioma) => (apuesta === 'numero' ? t(idioma, `Al ${numero}`, `On ${numero}`) : t(idioma, NOMBRES_DADOS[apuesta][1], NOMBRES_DADOS[apuesta][2]));
async function dados({ interaction, client, cfg, idioma, cantidad, apuesta = 'grande', numero = null }) {
    if (!C.APUESTAS_DADOS.includes(apuesta)) apuesta = 'grande';
    if (apuesta === 'numero' && !(numero >= 1 && numero <= 6)) return { error: t(idioma, 'Para apostar a un número, elige cuál en «numero» (1-6).', 'To bet on a number, pick it in “number” (1-6).') };
    const K = casino();
    const a = await K.apostar({ guildId: interaction.guildId, canalId: interaction.channelId, userId: interaction.user.id, cfg, juego: 'dados', cantidad });
    if (a.fallo) return { error: K.textoFallo(a, idioma, cfg.casino) };
    const tirada = C.tirarDados();
    const mult = C.pagoDados(apuesta, numero, tirada);
    const premio = Math.floor(a.jugada.apuesta * mult);
    const { vuelta } = await K.cobrarJugada(null, cfg, a.jugada, premio, { apuesta, numero, dados: tirada });
    const saldo = await K.saldoDe(interaction.guildId, interaction.user.id);
    const etiqueta = `${nombreDados(apuesta, numero, idioma)} · ${NOMBRES_DADOS[apuesta][3]}`.toUpperCase();
    const gif = await A.gifDados({ dados: tirada, etiqueta, res: { premio, apuesta: a.jugada.apuesta, idioma, saldo, vuelta } }).catch((e) => { console.warn('GIF dados:', e.message); return null; });
    const caras = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const linea = `${tirada.map((d) => caras[d - 1]).join(' ')} = **${tirada.reduce((x1, y) => x1 + y, 0)}** · ${K.masMenos(premio, a.jugada.apuesta, idioma)}`;
    const e = new EmbedBuilder().setColor(premio > a.jugada.apuesta ? '#16a34a' : '#7f1d1d').setTitle(`🎲 ${t(idioma, 'Dados', 'Dice')} · ${NOMBRES_DADOS[apuesta][0]} ${nombreDados(apuesta, numero, idioma)} · 🪙 ${fmt(a.jugada.apuesta, idioma)}`)
        .setFooter({ text: K.pieSaldo(idioma, saldo, vuelta) });
    if (gif) e.setImage('attachment://dados.gif').setDescription(K.oculto(linea)); else e.setDescription(linea);
    await interaction.editReply({ embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'dados.gif' })] : [], components: [K.filaOtraVez('dados', a.jugada.apuesta, idioma, apuesta === 'numero' ? `numero-${numero}` : apuesta)], allowedMentions: { parse: [] } });
    K.anunciarDespues(gif ? 2600 : 0, client, cfg, a.jugada, premio);
    return { ok: true, premio };
}

// ---------------------------------------------------------------------------
// 🂠 Baccarat (1.33.0)
// ---------------------------------------------------------------------------
const NOMBRES_BACCARAT = { jugador: ['🔵', 'Jugador', 'Player', '×2'], banca: ['🔴', 'Banca', 'Banker', '×1,95'], empate: ['🟢', 'Empate', 'Tie', '×9'] };
async function baccarat({ interaction, client, cfg, idioma, cantidad, apuesta = 'jugador' }) {
    if (!C.APUESTAS_BACCARAT[apuesta]) apuesta = 'jugador';
    const K = casino();
    const a = await K.apostar({ guildId: interaction.guildId, canalId: interaction.channelId, userId: interaction.user.id, cfg, juego: 'baccarat', cantidad });
    if (a.fallo) return { error: K.textoFallo(a, idioma, cfg.casino) };
    const r = C.repartirBaccarat(C.baraja(undefined, 8));
    const mult = C.pagoBaccarat(apuesta, r.ganador);
    const premio = Math.floor(a.jugada.apuesta * mult);
    const { vuelta } = await K.cobrarJugada(null, cfg, a.jugada, premio, { apuesta, jugador: r.jugador, banca: r.banca, ganador: r.ganador });
    const saldo = await K.saldoDe(interaction.guildId, interaction.user.id);
    const textos = { jugador: t(idioma, 'JUGADOR', 'PLAYER'), banca: t(idioma, 'BANCA', 'BANKER'), empate: t(idioma, 'EMPATE', 'TIE'), ganaJugador: t(idioma, 'GANA EL JUGADOR', 'PLAYER WINS'), ganaBanca: t(idioma, 'GANA LA BANCA', 'BANKER WINS') };
    const gif = await A.gifBaccarat({ ...r, apuesta, textos, res: { premio, apuesta: a.jugada.apuesta, idioma, saldo, vuelta } }).catch((e) => { console.warn('GIF baccarat:', e.message); return null; });
    const linea = `${textos.jugador} **${r.pj}** · ${textos.banca} **${r.pb}** → ${r.ganador === 'empate' ? textos.empate : r.ganador === 'jugador' ? textos.ganaJugador : textos.ganaBanca} · ${K.masMenos(premio, a.jugada.apuesta, idioma)}`;
    const n = NOMBRES_BACCARAT[apuesta];
    const e = new EmbedBuilder().setColor('#1e3a8a').setTitle(`🂠 Baccarat · ${n[0]} ${t(idioma, n[1], n[2])} (${idioma === 'en' ? n[3].replace(',', '.') : n[3]}) · 🪙 ${fmt(a.jugada.apuesta, idioma)}`)
        .setFooter({ text: K.pieSaldo(idioma, saldo, vuelta) });
    if (gif) e.setImage('attachment://baccarat.gif').setDescription(K.oculto(linea)); else e.setDescription(linea);
    await interaction.editReply({ embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'baccarat.gif' })] : [], components: [K.filaOtraVez('baccarat', a.jugada.apuesta, idioma, apuesta)], allowedMentions: { parse: [] } });
    K.anunciarDespues(gif ? 3500 : 0, client, cfg, a.jugada, premio);
    return { ok: true, premio };
}

// ---------------------------------------------------------------------------
// 🎱 Bingo del canal (1.33.0): BINGO_VENTA_MS para comprar cartones (cas_bg:<id>:<n>), luego salen bolas
// (3 cada BINGO_PASO_MS) hasta que alguien canta bingo. «🎫 Mis cartones» (cas_bgv:<id>) los enseña en
// privado con lo que ya ha salido. Línea = LINEA_BINGO del bote; bingo = el resto. Ediciones en fila.
// ---------------------------------------------------------------------------
const BINGO_VENTA_MS = 45000;
const BINGO_PASO_MS = Number(process.env.BINGO_PASO_MS) || 3000;
const BOLAS_POR_PASO = 3;
const bingos = new Map(); // canalId → partida
const cartonesDe = (b, userId) => b.cartones.filter((c) => c.userId === userId);
function vistaBingo(b, idioma, { salidas = [], estado = 'venta', lineas = [] } = {}) {
    const jugadores = [...new Set(b.cartones.map((c) => c.userId))];
    const vendido = b.cartones.length * b.precio;
    const cab = estado === 'venta'
        ? t(idioma, `**¡Compra tus cartones!** Cada uno cuesta 🪙 ${fmt(b.precio, idioma)} (hasta ${C.MAX_CARTONES}). Empieza <t:${Math.floor(b.empieza / 1000)}:R>.\nLas bolas salen solas y tus cartones se tachan solos: 🟩 **línea** = ${Math.round(C.LINEA_BINGO * 100)} % del bote · 🎉 **bingo** (cartón entero) = el resto.`, `**Buy your cards!** Each costs 🪙 ${fmt(b.precio, idioma)} (up to ${C.MAX_CARTONES}). Starts <t:${Math.floor(b.empieza / 1000)}:R>.\nBalls are drawn automatically and your cards mark themselves: 🟩 **line** = ${Math.round(C.LINEA_BINGO * 100)}% of the pot · 🎉 **bingo** (full card) = the rest.`)
        : estado === 'juega' ? t(idioma, `Bola **${salidas.length}** de ${C.BOLAS_BINGO}`, `Ball **${salidas.length}** of ${C.BOLAS_BINGO}`)
            : t(idioma, '🏁 **¡Bingo terminado!**', '🏁 **Bingo over!**');
    const e = new EmbedBuilder().setColor(estado === 'fin' ? '#16a34a' : '#4338ca').setTitle(t(idioma, `🎱 Bingo · bote 🪙 ${fmt(C.boteBingo(vendido), idioma)}`, `🎱 Bingo · pot 🪙 ${fmt(C.boteBingo(vendido), idioma)}`))
        .setDescription([cab, '', ...lineas, lineas.length ? '' : null,
            jugadores.length ? jugadores.map((u) => `🎫 <@${u}> ×${cartonesDe(b, u).length}`).join(' · ') : t(idioma, '*Aún no ha comprado nadie.*', '*Nobody has bought yet.*')].filter((l) => l !== null).join('\n').slice(0, 4000));
    const comps = [];
    if (estado === 'venta') {
        comps.push(new ActionRowBuilder().addComponents(
            ...[1, 2, 4].map((n) => new ButtonBuilder().setCustomId(`cas_bg:${b.id}:${n}`).setEmoji('🎫').setStyle(n === 1 ? ButtonStyle.Success : ButtonStyle.Primary).setLabel(t(idioma, `${n} ${n === 1 ? 'cartón' : 'cartones'} (🪙 ${fmt(b.precio * n, idioma)})`, `${n} card${n === 1 ? '' : 's'} (🪙 ${fmt(b.precio * n, idioma)})`))),
            new ButtonBuilder().setCustomId(`cas_bgv:${b.id}`).setEmoji('👀').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Mis cartones', 'My cards'))));
    } else if (estado === 'juega') {
        comps.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`cas_bgv:${b.id}`).setEmoji('👀').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Mis cartones', 'My cards'))));
    }
    const png = estado === 'venta' ? null : A.tableroBingo({ salidas, total: C.BOLAS_BINGO, titulo: '🎱 BINGO', sub: estado === 'fin' ? t(idioma, `Terminado en la bola ${salidas.length}`, `Finished on ball ${salidas.length}`) : t(idioma, `Bola ${salidas.length}`, `Ball ${salidas.length}`) });
    if (png) e.setImage('attachment://bingo.png');
    return { embeds: [e], components: comps, files: png ? [new AttachmentBuilder(png, { name: 'bingo.png' })] : [], attachments: [], allowedMentions: { parse: [] } };
}
async function bingo({ interaction, client, cfg, idioma, cantidad }) {
    const c = cfg?.casino; const K = casino();
    if (!c?.activo) return { error: K.textoFallo({ fallo: 'apagado' }, idioma) };
    if (c.juegos?.bingo === false) return { error: K.textoFallo({ fallo: 'juego' }, idioma) };
    if (c.canalId && c.canalId !== interaction.channelId) return { error: K.textoFallo({ fallo: 'canal' }, idioma, c) };
    if (bingos.has(interaction.channelId)) return { error: t(idioma, 'Ya hay un bingo en este canal: ¡compra cartones en ese!', 'There’s already a bingo in this channel: buy cards in that one!') };
    // El precio del cartón tiene que valer como apuesta en este servidor (mínimo y máximo).
    const ok = C.comprobarApuesta(cantidad || Math.max(c.apuestaMin ?? 10, 100), { ...c, limiteDiario: 0 }, {});
    if (ok.fallo) return { error: K.textoFallo(ok, idioma, c) };
    const precio = ok.cantidad;
    const b = { id: require('crypto').randomBytes(5).toString('hex'), canalId: interaction.channelId, guildId: interaction.guildId, precio, empieza: Date.now() + BINGO_VENTA_MS, cartones: [], jugadas: new Map(), cfg, idioma, interaction, estado: 'venta' };
    bingos.set(interaction.channelId, b);
    await interaction.editReply(vistaBingo(b, idioma));
    setTimeout(() => jugarBingoCanal(client, b).catch((e) => { console.error('Bingo:', e.message); bingos.delete(b.canalId); }), BINGO_VENTA_MS);
    return { ok: true };
}
async function comprarCartones(interaction, client) {
    const [, id, nTxt] = interaction.customId.split(':');
    const b = [...bingos.values()].find((y) => y.id === id);
    const idioma = b?.idioma || 'es'; const K = casino();
    if (!b || b.estado !== 'venta') return interaction.reply({ content: t(idioma, '⌛ La venta de cartones ya ha cerrado.', '⌛ Card sales are closed.'), flags: 64 });
    if (b.comprando?.has(interaction.user.id)) return interaction.deferUpdate().catch(() => {});
    const tiene = cartonesDe(b, interaction.user.id).length;
    const n = Math.min(parseInt(nTxt, 10) || 1, C.MAX_CARTONES - tiene);
    if (n <= 0) return interaction.reply({ content: t(idioma, `Ya tienes ${C.MAX_CARTONES} cartones: es el máximo.`, `You already have ${C.MAX_CARTONES} cards: that’s the max.`), flags: 64 });
    b.comprando = b.comprando || new Set(); b.comprando.add(interaction.user.id);
    try {
        const a = await K.apostar({ guildId: b.guildId, canalId: b.canalId, userId: interaction.user.id, cfg: b.cfg, juego: 'bingo', cantidad: b.precio * n });
        if (a.fallo) return interaction.reply({ content: K.textoFallo(a, idioma, b.cfg.casino), flags: 64 });
        if (b.estado !== 'venta') {
            await K.cobrarJugada(client, b.cfg, a.jugada, a.jugada.apuesta, { bingo: 'tarde' }).catch(() => {});
            return interaction.reply({ content: t(idioma, '⌛ Ya había empezado: te devolvemos el oro.', '⌛ It had already started: your gold is refunded.'), flags: 64 });
        }
        // Si apostar ajustó la cantidad (p. ej. por el máximo), solo se dan los cartones que se han pagado.
        const pagados = Math.floor(a.jugada.apuesta / b.precio);
        const sobra = a.jugada.apuesta - pagados * b.precio;
        if (sobra > 0) await require('./economia.js').en(b.guildId).darOro(interaction.user.id, sobra);
        const lista = b.jugadas.get(interaction.user.id) || [];
        lista.push(a.jugada); b.jugadas.set(interaction.user.id, lista);
        for (let i = 0; i < pagados; i++) b.cartones.push({ id: `${interaction.user.id}:${b.cartones.length}`, userId: interaction.user.id, filas: C.cartonBingo() });
        await interaction.reply({ ...verCartones(b, interaction.user.id, idioma, [], t(idioma, `✅ Tienes **${tiene + pagados}** ${tiene + pagados === 1 ? 'cartón' : 'cartones'}. ¡Suerte!`, `✅ You have **${tiene + pagados}** card${tiene + pagados === 1 ? '' : 's'}. Good luck!`)), flags: 64 });
        await K.editarEnFila(b, () => (b.estado === 'venta' ? vistaBingo(b, idioma) : null));
    } finally { b.comprando.delete(interaction.user.id); }
    return undefined;
}
function verCartones(b, userId, idioma, salidas, texto = '') {
    const mios = cartonesDe(b, userId);
    if (!mios.length) return { content: t(idioma, 'No tienes cartones en este bingo.', 'You have no cards in this bingo.') };
    const png = A.cartonesBingo({ cartones: mios, salidas, titulo: t(idioma, `Tus cartones · ${salidas.length} bolas`, `Your cards · ${salidas.length} balls`) });
    if (!png) return { content: `${texto}\n${mios.map((c, i) => `#${i + 1}: ${c.filas.map((f) => f.map((n) => (salidas.includes(n) ? `~~${n}~~` : n)).join(' ')).join(' | ')}`).join('\n')}` };
    return { content: texto || undefined, files: [new AttachmentBuilder(png, { name: 'cartones.png' })] };
}
async function jugarBingoCanal(client, b) {
    const K = casino(); const idioma = b.idioma;
    b.estado = 'juega';
    if (!b.cartones.length) {
        bingos.delete(b.canalId);
        await K.editarEnFila(b, () => ({ embeds: [new EmbedBuilder().setColor('#475569').setDescription(t(idioma, '🎱 Nadie ha comprado cartones: bingo cancelado.', '🎱 Nobody bought cards: bingo cancelled.'))], components: [], files: [], attachments: [] }));
        return;
    }
    const bolas = C.bolasBingo();
    const res = C.jugarBingo(b.cartones, bolas);
    const dueño = (id) => b.cartones.find((c) => c.id === id).userId;
    const quien = (ids) => [...new Set(ids.map(dueño))].map((u) => `<@${u}>`).join(', ');
    const vendido = b.cartones.length * b.precio;
    const premios = C.repartoBingo(vendido, res);
    const bote = C.boteBingo(vendido);
    const lineaTxt = () => t(idioma, `🟩 **¡Línea!** ${quien(res.linea.ganadores)} · 🪙 ${fmt(Math.floor(bote * C.LINEA_BINGO), idioma)}`, `🟩 **Line!** ${quien(res.linea.ganadores)} · 🪙 ${fmt(Math.floor(bote * C.LINEA_BINGO), idioma)}`);
    const fin = res.bingo.bola + 1;
    for (let n = BOLAS_POR_PASO; n < fin + BOLAS_POR_PASO; n += BOLAS_POR_PASO) {
        const hasta = Math.min(n, fin);
        b.salidas = bolas.slice(0, hasta);
        if (hasta >= fin) break;
        const lineas = res.linea && res.linea.bola < hasta ? [lineaTxt()] : [];
        const salidas = b.salidas;
        K.editarEnFila(b, () => vistaBingo(b, idioma, { salidas, estado: 'juega', lineas }));
        await new Promise((r) => setTimeout(r, BINGO_PASO_MS));
    }
    // Se cobra todo y luego se enseña el final.
    b.estado = 'fin';
    bingos.delete(b.canalId);
    const porPersona = {};
    for (const [id, oro] of Object.entries(premios)) { const u = dueño(id); porPersona[u] = (porPersona[u] || 0) + oro; }
    for (const [u, jugadas] of b.jugadas) {
        let premio = porPersona[u] || 0;
        for (const j of jugadas) {
            // El premio va a la primera jugada de cada persona; las demás quedan en 0.
            await K.cobrarJugada(client, b.cfg, j, premio, { bingo: true, cartones: cartonesDe(b, u).length }).catch(() => {});
            premio = 0;
        }
    }
    const lineas = [res.linea ? lineaTxt() : null, t(idioma, `🎉 **¡BINGO!** ${quien(res.bingo.ganadores)} · 🪙 ${fmt(bote - Math.floor(bote * C.LINEA_BINGO), idioma)}`, `🎉 **BINGO!** ${quien(res.bingo.ganadores)} · 🪙 ${fmt(bote - Math.floor(bote * C.LINEA_BINGO), idioma)}`)].filter(Boolean);
    const salidas = bolas.slice(0, fin);
    await K.editarEnFila(b, () => ({ ...vistaBingo(b, idioma, { salidas, estado: 'fin', lineas }), allowedMentions: { users: Object.keys(porPersona) } }));
    // Los premios gordos (bote grande) se anuncian como los demás.
    for (const [u, oro] of Object.entries(porPersona)) { const j = b.jugadas.get(u)?.[0]; if (j) K.anunciarDespues(0, client, b.cfg, { ...j.toObject?.() || j, apuesta: jugadasTotal(b, u) }, oro); }
}
const jugadasTotal = (b, u) => (b.jugadas.get(u) || []).reduce((a, j) => a + j.apuesta, 0);
async function botonVerCartones(interaction) {
    const id = interaction.customId.split(':')[1];
    const b = [...bingos.values()].find((y) => y.id === id);
    const { idiomaInteraccion } = require('./preferencias.js');
    const idioma = await idiomaInteraccion(interaction, null).catch(() => b?.idioma || 'es');
    if (!b) return interaction.reply({ content: t(idioma, '⌛ Este bingo ya ha terminado.', '⌛ This bingo is over.'), flags: 64 });
    return interaction.reply({ ...verCartones(b, interaction.user.id, idioma, b.salidas || []), flags: 64 });
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
// 🚀 Cohete del canal (crash compartido, 1.33.0): 20 s para subirse (cas_ck:<id> → ventana con la
// cantidad y, si quieres, retiro automático), luego UN cohete para todos; cada uno se retira cuando
// quiere con «🪂 Retirarme» (cas_ckr:<id>). Al explotar, quien siga dentro pierde. Ediciones en fila.
// ---------------------------------------------------------------------------
const COHETE_MS = 20000;
const cohetes = new Map(); // canalId → cohete
function vistaCohete(k, idioma, { mult = 1, estado = 'apuestas' } = {}) {
    const lista = [...k.jugadores.values()].filter((j) => j.jugada);
    const fila = (j) => {
        if (j.cobradoEn) return `🪂 <@${j.userId}> ×${x(j.cobradoEn.toFixed(2))} → **+🪙 ${fmt(j.premio, idioma)}**`;
        if (estado === 'boom') return `💥 <@${j.userId}> −🪙 ${fmt(j.cantidad, idioma)}`;
        return `🚀 <@${j.userId}> · 🪙 ${fmt(j.cantidad, idioma)}${j.auto ? ` · 🎯 ×${x(j.auto)}` : ''}${estado === 'vuela' ? ` → 🪙 ${fmt(Math.floor(j.cantidad * mult), idioma)}` : ''}`;
    };
    const cab = estado === 'apuestas' ? t(idioma, `**¡Súbete al cohete!** Sale <t:${Math.floor(k.sale / 1000)}:R>. Cada uno se retira cuando quiere; si explota antes, pierde.`, `**Hop on the rocket!** Launching <t:${Math.floor(k.sale / 1000)}:R>. Everyone cashes out when they want; if it blows up first, they lose.`)
        : estado === 'vuela' ? `# 🚀 ×${x(mult.toFixed(2))}` : `# 💥 ×${x(k.punto.toFixed(2))}`;
    const e = new EmbedBuilder().setColor(estado === 'boom' ? '#7f1d1d' : estado === 'vuela' ? '#0ea5e9' : '#7c3aed').setTitle(t(idioma, '🚀 Cohete del canal', '🚀 Channel rocket'))
        .setDescription([cab, '', lista.length ? lista.map(fila).join('\n') : t(idioma, '*Aún no se ha subido nadie.*', '*Nobody on board yet.*')].join('\n').slice(0, 4000));
    const comps = estado === 'apuestas'
        ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`cas_ck:${k.id}`).setEmoji('🚀').setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Subirme', 'Hop on')))]
        : estado === 'vuela' ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`cas_ckr:${k.id}`).setEmoji('🪂').setStyle(ButtonStyle.Danger).setLabel(t(idioma, 'Retirarme', 'Cash out')))] : [];
    return { embeds: [e], components: comps, allowedMentions: { parse: [] } };
}
async function cohete({ interaction, client, cfg, idioma }) {
    const c = cfg?.casino; const K = casino();
    if (!c?.activo) return { error: K.textoFallo({ fallo: 'apagado' }, idioma) };
    if (c.juegos?.crash === false) return { error: K.textoFallo({ fallo: 'juego' }, idioma) };
    if (c.canalId && c.canalId !== interaction.channelId) return { error: K.textoFallo({ fallo: 'canal' }, idioma, c) };
    if (cohetes.has(interaction.channelId)) return { error: t(idioma, 'Ya hay un cohete en este canal: ¡súbete a ese!', 'There’s already a rocket in this channel: hop on that one!') };
    const k = { id: require('crypto').randomBytes(5).toString('hex'), canalId: interaction.channelId, guildId: interaction.guildId, sale: Date.now() + COHETE_MS, jugadores: new Map(), cfg, idioma, interaction, estado: 'apuestas' };
    cohetes.set(interaction.channelId, k);
    await interaction.editReply(vistaCohete(k, idioma));
    setTimeout(() => despegar(client, k).catch((e) => { console.error('Cohete:', e.message); cohetes.delete(k.canalId); }), COHETE_MS);
    return { ok: true };
}
async function botonCohete(interaction) {
    const id = interaction.customId.split(':')[1];
    const k = [...cohetes.values()].find((y) => y.id === id);
    const idioma = k?.idioma || 'es';
    if (!k || k.estado !== 'apuestas') return interaction.reply({ content: t(idioma, '⌛ El cohete ya ha salido.', '⌛ The rocket has already launched.'), flags: 64 });
    if (k.jugadores.has(interaction.user.id)) return interaction.reply({ content: t(idioma, 'Ya estás dentro de este cohete.', 'You’re already on this rocket.'), flags: 64 });
    return interaction.showModal(new ModalBuilder().setCustomId(`cas_ckm:${id}`).setTitle(t(idioma, '🚀 Subirme al cohete', '🚀 Hop on the rocket')).addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cantidad').setLabel(t(idioma, 'Cuánto oro', 'How much gold')).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(9)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('auto').setLabel(t(idioma, 'Retiro automático en ×… (opcional, p. ej. 2)', 'Auto cash-out at ×… (optional, e.g. 2)')).setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(6)),
    ));
}
async function modalCohete(interaction, client) {
    const id = interaction.customId.split(':')[1];
    const k = [...cohetes.values()].find((y) => y.id === id);
    const idioma = k?.idioma || 'es'; const K = casino();
    if (!k || k.estado !== 'apuestas') return interaction.reply({ content: t(idioma, '⌛ El cohete ya ha salido.', '⌛ The rocket has already launched.'), flags: 64 });
    if (k.jugadores.has(interaction.user.id)) return interaction.reply({ content: t(idioma, 'Ya estás dentro de este cohete.', 'You’re already on this rocket.'), flags: 64 });
    const cantidad = parseInt(interaction.fields.getTextInputValue('cantidad').replace(/\D/g, ''), 10);
    const autoTxt = String(interaction.fields.getTextInputValue('auto') || '').replace(',', '.').replace(/[^\d.]/g, '');
    const auto = autoTxt ? Math.round(Math.min(100, Math.max(1.01, parseFloat(autoTxt) || 0)) * 100) / 100 : null;
    k.jugadores.set(interaction.user.id, { userId: interaction.user.id, cantidad: 0, jugada: null }); // reserva
    const a = await K.apostar({ guildId: k.guildId, canalId: k.canalId, userId: interaction.user.id, cfg: k.cfg, juego: 'crash', cantidad });
    if (a.fallo) { k.jugadores.delete(interaction.user.id); return interaction.reply({ content: K.textoFallo(a, idioma, k.cfg.casino), flags: 64 }); }
    if (k.estado !== 'apuestas') {
        await K.cobrarJugada(client, k.cfg, a.jugada, a.jugada.apuesta, { cohete: 'tarde' }).catch(() => {});
        return interaction.reply({ content: t(idioma, '⌛ Ya había salido: te devolvemos el oro.', '⌛ It had already launched: your gold is refunded.'), flags: 64 });
    }
    k.jugadores.set(interaction.user.id, { userId: interaction.user.id, cantidad: a.jugada.apuesta, jugada: a.jugada, auto });
    await interaction.reply({ content: t(idioma, `🚀 ¡Dentro! 🪙 ${fmt(a.jugada.apuesta, idioma)}${auto ? ` · te bajas solo en ×${x(auto)}` : ''}. Pulsa «🪂 Retirarme» cuando quieras.`, `🚀 You’re in! 🪙 ${fmt(a.jugada.apuesta, idioma)}${auto ? ` · auto cash-out at ×${auto}` : ''}. Press “🪂 Cash out” whenever you want.`), flags: 64 });
    await K.editarEnFila(k, () => (k.estado === 'apuestas' ? vistaCohete(k, idioma) : null));
}
async function retirarCohete(client, k, j, multFijo = null) {
    if (j.cobradoEn || j.cerrado) return false;
    const mult = multFijo ?? C.multCrash((Date.now() - k.inicio) / 1000);
    if (mult >= k.punto) return false;
    j.cerrado = true; j.cobradoEn = mult; j.premio = Math.floor(j.cantidad * mult);
    await casino().cobrarJugada(client, k.cfg, j.jugada, j.premio, { punto: k.punto, cobrado: mult, cohete: true });
    return true;
}
async function botonRetirarCohete(interaction, client) {
    const id = interaction.customId.split(':')[1];
    const k = [...cohetes.values()].find((y) => y.id === id);
    const idioma = k?.idioma || 'es';
    const j = k?.jugadores.get(interaction.user.id);
    if (!k || k.estado !== 'vuela') return interaction.reply({ content: t(idioma, '⌛ Este cohete ya ha terminado.', '⌛ This rocket is over.'), flags: 64 });
    if (!j?.jugada) return interaction.reply({ content: t(idioma, 'No te subiste a este cohete. Espera al próximo: `/casino cohete`.', 'You didn’t board this rocket. Wait for the next one: `/casino rocket`.'), flags: 64 });
    if (j.cobradoEn) return interaction.reply({ content: t(idioma, `Ya te retiraste en ×${x(j.cobradoEn.toFixed(2))}.`, `You already cashed out at ×${j.cobradoEn.toFixed(2)}.`), flags: 64 });
    const ok = await retirarCohete(client, k, j);
    return interaction.reply({ content: ok ? t(idioma, `🪂 ¡Retirado en ×${x(j.cobradoEn.toFixed(2))}! +🪙 ${fmt(j.premio, idioma)}`, `🪂 Cashed out at ×${j.cobradoEn.toFixed(2)}! +🪙 ${fmt(j.premio, idioma)}`) : t(idioma, '💥 ¡Demasiado tarde!', '💥 Too late!'), flags: 64 });
}
async function despegar(client, k) {
    const idioma = k.idioma; const K = casino();
    k.estado = 'cerrado';
    const lista = [...k.jugadores.values()].filter((j) => j.jugada);
    if (!lista.length) { cohetes.delete(k.canalId); await K.editarEnFila(k, () => ({ embeds: [new EmbedBuilder().setColor('#475569').setDescription(t(idioma, '🚀 Nadie se ha subido: cohete cancelado.', '🚀 Nobody boarded: rocket cancelled.'))], components: [] })); return; }
    k.punto = C.puntoCrash(); k.inicio = Date.now() + 1000; k.estado = 'vuela';
    await K.editarEnFila(k, () => vistaCohete(k, idioma, { mult: 1, estado: 'vuela' }));
    while (k.estado === 'vuela') {
        await new Promise((r) => setTimeout(r, 1500));
        const mult = C.multCrash((Date.now() - k.inicio) / 1000);
        for (const j of lista) if (j.auto && !j.cobradoEn && j.auto < k.punto && mult >= j.auto) await retirarCohete(client, k, j, j.auto);
        if (mult >= k.punto || lista.every((j) => j.cobradoEn)) {
            k.estado = 'fin';
            for (const j of lista) if (!j.cobradoEn && !j.cerrado) { j.cerrado = true; await K.cobrarJugada(client, k.cfg, j.jugada, 0, { punto: k.punto, cohete: true }); }
            cohetes.delete(k.canalId);
            // Si todos se retiraron antes, el cohete sigue hasta su punto (se enseña dónde habría explotado).
            await K.editarEnFila(k, () => vistaCohete(k, idioma, { estado: 'boom' }));
            const mejor = lista.filter((j) => j.premio).sort((a, b) => b.premio - a.premio)[0];
            if (mejor && mejor.premio >= 1000 && mejor.premio >= mejor.cantidad * 10) K.anunciarDespues(0, client, k.cfg, mejor.jugada, mejor.premio);
            return;
        }
        await K.editarEnFila(k, () => (k.estado === 'vuela' ? vistaCohete(k, idioma, { mult, estado: 'vuela' }) : null));
    }
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
    if (interaction.isButton() && id.startsWith('cas_ck:')) { await botonCohete(interaction); return true; }
    if (interaction.isButton() && id.startsWith('cas_bg:')) { await comprarCartones(interaction, client); return true; }
    if (interaction.isButton() && id.startsWith('cas_bgv:')) { await botonVerCartones(interaction); return true; }
    if (interaction.isModalSubmit() && id.startsWith('cas_ckm:')) { await modalCohete(interaction, client); return true; }
    if (interaction.isButton() && id.startsWith('cas_ckr:')) { await botonRetirarCohete(interaction, client); return true; }
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

module.exports = { dados, baccarat, bingo, bingos, jugarBingoCanal, NOMBRES_DADOS, NOMBRES_BACCARAT, cohete, cohetes, despegar, retirarCohete, RIESGOS, APUESTAS_MESA, plinko, rueda, mesa, loteria, comprarBoletos, vistaLoteria, barrerLoteria, estadisticas, graficaNeto, manejar, mesas, girarMesa, loteriaDe };
