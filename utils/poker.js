// ♠️ Póker Texas Hold'em del canal (1.33.0). Reglas en utils/pokerNucleo.js.
// `/casino poker entrada:<oro>` abre una mesa: de 2 a 6 personas se sientan pagando la entrada (pkr_sit:<id>)
// durante SENTARSE_MS o hasta que quien la abre pulsa «Empezar» (pkr_go:<id>). Las fichas son ese oro. Se
// juegan manos seguidas (ciega grande = entrada / 50) hasta que queda una persona con fichas, se llega a
// MAX_MANOS o pasa MAX_MS; al levantarse (pkr_out:<id>) o al acabar, cada uno cobra sus fichas.
// Botones de la mano: pkr_a:<id>:<retirarse|pasar|igualar|min|bote|allin>; «👀 Mis cartas» (pkr_v:<id>) en
// privado. Quien no actúa en TURNO_MS pasa (o se retira si tiene que poner algo). Ediciones en fila (sobre el
// mensaje, no la interacción: una mesa puede durar más de los 15 min que vive una interacción).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const P = require('./pokerNucleo.js');
const A = require('./casinoArte.js');
const { t } = require('./i18n.js');

const SENTARSE_MS = Number(process.env.POKER_SENTARSE_MS) || 60000;
const TURNO_MS = Number(process.env.POKER_TURNO_MS) || 30000;
const ENTRE_MANOS_MS = Number(process.env.POKER_ENTRE_MS) || 6000;
const MAX_MANOS = 25;
const MAX_MS = 25 * 60000;
const mesas = new Map(); // canalId → mesa
const casino = () => require('./casino.js');
const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const ciegaDe = (entrada) => Math.max(2, Math.floor(entrada / 50));
const buscar = (id) => [...mesas.values()].find((m) => m.id === id);

// ---------------------------------------------------------------------------
// Dibujo de la mesa
// ---------------------------------------------------------------------------
function dibujoMesa(m, idioma, { mostrar = false } = {}) {
    if (!A.listo()) return null;
    const { FUENTE } = require('./fonts.js');
    const W = 960; const H = 600;
    const { c, ctx } = A.lienzo(W, H);
    ctx.fillStyle = '#0b1020'; A.redondeado(ctx, 0, 0, W, H, 26); ctx.fill();
    // Tapete ovalado
    ctx.save(); ctx.beginPath(); ctx.ellipse(W / 2, H / 2, 350, 185, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, 400); g.addColorStop(0, '#15803d'); g.addColorStop(1, '#064e3b');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 16; ctx.strokeStyle = '#78350f'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#ca8a04'; ctx.stroke(); ctx.restore();
    const mano = m.mano;
    // Cartas comunes
    const comunes = mano?.comunes || [];
    for (let i = 0; i < 5; i++) {
        const x = W / 2 - 200 + i * 80; const y = H / 2 - 62;
        if (comunes[i]) A.carta(ctx, x, y, comunes[i]);
        else { A.redondeado(ctx, x, y, 72, 100, 9); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    const bote = mano ? mano.jugadores.reduce((a, j) => a + j.aporte, 0) : 0;
    ctx.fillStyle = '#fde68a'; ctx.font = `900 22px ${FUENTE}`; ctx.textAlign = 'center';
    ctx.fillText(mano?.resultado ? t(idioma, '🏁 FIN DE LA MANO', '🏁 HAND OVER') : `${t(idioma, 'BOTE', 'POT')} 🪙 ${fmt(bote, idioma)}`, W / 2, H / 2 + 76);
    // Asientos alrededor
    const n = m.jugadores.length;
    const turnoId = mano && mano.turno >= 0 ? mano.jugadores[mano.turno].id : null;
    m.jugadores.forEach((j, i) => {
        const ang = Math.PI / 2 + (i / n) * Math.PI * 2;
        const x = W / 2 + Math.cos(ang) * 360; const y = H / 2 + Math.sin(ang) * 232;
        const mj = mano?.jugadores.find((q) => q.id === j.userId);
        const fuera = mj?.fuera || (mano && !mj);
        ctx.save();
        if (turnoId === j.userId) { ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 26; }
        A.redondeado(ctx, x - 85, y - 34, 170, 68, 16);
        ctx.fillStyle = fuera ? 'rgba(30,41,59,0.85)' : turnoId === j.userId ? '#854d0e' : '#1e293b'; ctx.fill();
        ctx.restore();
        ctx.lineWidth = 2; ctx.strokeStyle = turnoId === j.userId ? '#fde68a' : 'rgba(148,163,184,0.5)'; A.redondeado(ctx, x - 85, y - 34, 170, 68, 16); ctx.stroke();
        ctx.textAlign = 'center'; ctx.fillStyle = fuera ? '#64748b' : '#f8fafc'; ctx.font = `bold 16px ${FUENTE}`;
        ctx.fillText(j.nombre.slice(0, 16), x, y - 8);
        ctx.fillStyle = '#fde68a'; ctx.font = `bold 15px ${FUENTE}`;
        const fichas = mj ? mj.fichas : j.fichas;
        ctx.fillText(`🪙 ${fmt(fichas, idioma)}${mj?.allin ? ' · ALL-IN' : ''}`, x, y + 16);
        // Botón del repartidor
        if (mano && mano.jugadores[mano.boton]?.id === j.userId) {
            ctx.beginPath(); ctx.arc(x + 76, y - 30, 13, 0, Math.PI * 2); ctx.fillStyle = '#f8fafc'; ctx.fill();
            ctx.fillStyle = '#0f172a'; ctx.font = `900 13px ${FUENTE}`; ctx.fillText('D', x + 76, y - 25);
        }
        // Lo apostado en esta calle, hacia el centro
        if (mj?.apuesta) {
            const bx = x + (W / 2 - x) * 0.32; const by = y + (H / 2 - y) * 0.32;
            ctx.beginPath(); ctx.arc(bx - 30, by, 9, 0, Math.PI * 2); ctx.fillStyle = '#dc2626'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = `bold 14px ${FUENTE}`; ctx.textAlign = 'left'; ctx.fillText(fmt(mj.apuesta, idioma), bx - 16, by + 5);
        }
        // Cartas al descubierto en el showdown
        if (mostrar && mj && !mj.fuera && mano.resultado?.showdown) {
            // Hacia el centro de la mesa, entre el asiento y las cartas comunes.
            const cx2 = x + (W / 2 - x) * 0.3; const cy2 = y + (H / 2 - y) * 0.36;
            ctx.save(); ctx.translate(cx2 - 50, cy2 - 35); ctx.scale(0.62, 0.62);
            A.carta(ctx, 0, 0, mj.cartas[0]); A.carta(ctx, 82, 0, mj.cartas[1]); ctx.restore();
        }
    });
    return c.toBuffer('image/png');
}
function dibujoMisCartas(cartas, comunes, idioma) {
    if (!A.listo()) return null;
    const { FUENTE } = require('./fonts.js');
    const W = 420; const H = 190;
    const { c, ctx } = A.lienzo(W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#14532d'); g.addColorStop(1, '#052e16');
    A.redondeado(ctx, 0, 0, W, H, 20); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.translate(40, 34); ctx.scale(1.2, 1.2); A.carta(ctx, 0, 0, cartas[0]); A.carta(ctx, 82, 0, cartas[1]); ctx.restore();
    if (comunes.length >= 3) {
        const mejor = P.mejorMano([...cartas, ...comunes]);
        ctx.fillStyle = '#fde68a'; ctx.font = `900 20px ${FUENTE}`; ctx.textAlign = 'left';
        ctx.fillText(P.nombreMano(mejor.categoria, idioma), 252, 92);
        ctx.fillStyle = '#d1fae5'; ctx.font = `bold 15px ${FUENTE}`; ctx.fillText(mejor.cartas.join(' '), 252, 120);
    }
    return c.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// Vista del mensaje
// ---------------------------------------------------------------------------
function vista(m, { fin = null, texto = '' } = {}) {
    const idioma = m.idioma;
    const mano = m.mano;
    const e = new EmbedBuilder().setColor(fin ? '#16a34a' : '#065f46')
        .setTitle(t(idioma, `♠️ Póker Texas Hold'em · entrada 🪙 ${fmt(m.entrada, idioma)} · ciegas ${fmt(Math.floor(m.ciega / 2), idioma)}/${fmt(m.ciega, idioma)}`, `♠️ Texas Hold'em · buy-in 🪙 ${fmt(m.entrada, idioma)} · blinds ${fmt(Math.floor(m.ciega / 2), idioma)}/${fmt(m.ciega, idioma)}`));
    const filas = [];
    let png = null;
    if (m.estado === 'sentarse') {
        e.setDescription([
            t(idioma, `**¡Siéntate a jugar!** Pagas la entrada y la recibes en fichas. De 2 a ${P.MAX_JUGADORES} personas. Empieza <t:${Math.floor(m.empieza / 1000)}:R> o cuando <@${m.anfitrion}> pulse «Empezar».`, `**Take a seat!** You pay the buy-in and get it as chips. 2 to ${P.MAX_JUGADORES} players. Starts <t:${Math.floor(m.empieza / 1000)}:R> or when <@${m.anfitrion}> presses “Start”.`),
            t(idioma, 'Al terminar (o al levantarte) cobras las fichas que tengas.', 'When it ends (or you leave) you cash out your chips.'),
            '', m.jugadores.length ? m.jugadores.map((j) => `🪑 <@${j.userId}>`).join('\n') : t(idioma, '*Mesa vacía.*', '*Empty table.*'),
        ].join('\n'));
        filas.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`pkr_sit:${m.id}`).setEmoji('🪑').setStyle(ButtonStyle.Success).setLabel(t(idioma, `Sentarme (🪙 ${fmt(m.entrada, idioma)})`, `Sit down (🪙 ${fmt(m.entrada, idioma)})`)),
            new ButtonBuilder().setCustomId(`pkr_go:${m.id}`).setEmoji('▶️').setStyle(ButtonStyle.Primary).setLabel(t(idioma, 'Empezar', 'Start')).setDisabled(m.jugadores.length < 2),
            new ButtonBuilder().setCustomId(`pkr_out:${m.id}`).setEmoji('🚪').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Levantarme', 'Leave')),
        ));
        return { embeds: [e], components: filas, files: [], attachments: [], allowedMentions: { parse: [] } };
    }
    png = dibujoMesa(m, idioma, { mostrar: !!mano?.resultado });
    const op = mano && !fin ? P.opciones(mano) : null;
    const lineas = [];
    if (texto) lineas.push(texto);
    if (op) {
        lineas.push(t(idioma, `👉 Le toca a <@${op.id}> (${op.pasar ? 'puede pasar' : `iguala 🪙 ${fmt(op.igualar, idioma)}`}) · <t:${Math.floor(m.turnoHasta / 1000)}:R>`, `👉 <@${op.id}>’s turn (${op.pasar ? 'can check' : `call 🪙 ${fmt(op.igualar, idioma)}`}) · <t:${Math.floor(m.turnoHasta / 1000)}:R>`));
        filas.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`pkr_a:${m.id}:retirarse`).setStyle(ButtonStyle.Danger).setLabel(t(idioma, 'Retirarme', 'Fold')),
            new ButtonBuilder().setCustomId(`pkr_a:${m.id}:${op.pasar ? 'pasar' : 'igualar'}`).setStyle(ButtonStyle.Primary).setLabel(op.pasar ? t(idioma, 'Pasar', 'Check') : t(idioma, `Igualar ${fmt(op.igualar, idioma)}`, `Call ${fmt(op.igualar, idioma)}`)),
            new ButtonBuilder().setCustomId(`pkr_a:${m.id}:min`).setStyle(ButtonStyle.Success).setLabel(t(idioma, `Subir a ${fmt(op.minHasta, idioma)}`, `Raise to ${fmt(op.minHasta, idioma)}`)).setDisabled(!op.puedeSubir),
            new ButtonBuilder().setCustomId(`pkr_a:${m.id}:bote`).setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Subir el bote', 'Pot raise')).setDisabled(!op.puedeSubir),
            new ButtonBuilder().setCustomId(`pkr_a:${m.id}:allin`).setStyle(ButtonStyle.Danger).setLabel('All-in'),
        ));
    }
    if (fin) lineas.push(fin);
    e.setDescription(lineas.join('\n').slice(0, 4000) || null);
    if (!fin) {
        filas.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`pkr_v:${m.id}`).setEmoji('👀').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Mis cartas', 'My cards')),
            new ButtonBuilder().setCustomId(`pkr_out:${m.id}`).setEmoji('🚪').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Levantarme', 'Leave')),
        ));
    }
    e.setFooter({ text: t(idioma, `Mano ${m.manos}/${MAX_MANOS} · la casa se lleva un ${Math.round(P.RAKE * 100)} % de los botes que llegan al flop`, `Hand ${m.manos}/${MAX_MANOS} · the house takes ${Math.round(P.RAKE * 100)}% of pots that reach the flop`) });
    if (png) e.setImage('attachment://poker.png');
    return { embeds: [e], components: filas, files: png ? [new AttachmentBuilder(png, { name: 'poker.png' })] : [], attachments: [], allowedMentions: { parse: [] } };
}
const pintar = (m, opc) => casino().editarEnFila(m, () => vista(m, opc));

// ---------------------------------------------------------------------------
// Abrir, sentarse, empezar
// ---------------------------------------------------------------------------
async function abrir({ interaction, client, cfg, idioma, cantidad }) {
    const c = cfg?.casino; const K = casino(); const C = require('./casinoNucleo.js');
    if (!c?.activo) return { error: K.textoFallo({ fallo: 'apagado' }, idioma) };
    if (c.juegos?.poker === false) return { error: K.textoFallo({ fallo: 'juego' }, idioma) };
    if (c.canalId && c.canalId !== interaction.channelId) return { error: K.textoFallo({ fallo: 'canal' }, idioma, c) };
    if (mesas.has(interaction.channelId)) return { error: t(idioma, 'Ya hay una mesa de póker en este canal: ¡siéntate en esa!', 'There’s already a poker table in this channel: sit at that one!') };
    const ok = C.comprobarApuesta(cantidad || Math.min(c.apuestaMax ?? 5000, Math.max(c.apuestaMin ?? 10, 1000)), { ...c, limiteDiario: 0 }, {});
    if (ok.fallo) return { error: K.textoFallo(ok, idioma, c) };
    const m = { id: require('crypto').randomBytes(5).toString('hex'), canalId: interaction.channelId, guildId: interaction.guildId, anfitrion: interaction.user.id, entrada: ok.cantidad, ciega: ciegaDe(ok.cantidad),
        jugadores: [], estado: 'sentarse', empieza: Date.now() + SENTARSE_MS, abierta: Date.now(), manos: 0, boton: -1, cfg, idioma, client };
    mesas.set(m.canalId, m);
    // El que abre se sienta solo; si no puede (oro, límite, pausa, aviso…), la mesa no se abre.
    const s = await sentar(m, interaction.user.id, interaction.member?.displayName || interaction.user.globalName || interaction.user.username).catch(() => ({ motivo: 'error' }));
    if (!s?.ok) { mesas.delete(m.canalId); return { error: s?.fallo ? K.textoFallo(s.fallo, idioma, c) : t(idioma, 'No se ha podido abrir la mesa: prueba otra vez.', 'The table couldn’t be opened: try again.') }; }
    // Las ediciones van al mensaje (la interacción caduca a los 15 min), en un hilo propio si se puede (1.34.0).
    const pub = await require('./hilos.js').publicar(interaction, cfg, t(idioma, '♠️ Póker', '♠️ Poker'), vista(m), idioma);
    m.interaction = { editReply: pub.editar };
    m.temporizador = setTimeout(() => empezar(m).catch((e) => { console.error('Póker:', e.message); cerrar(m).catch(() => {}); }), SENTARSE_MS);
    return { ok: true };
}
async function sentar(m, userId, nombre) {
    const K = casino();
    if (m.jugadores.some((j) => j.userId === userId)) return { motivo: 'ya' };
    if (m.jugadores.length >= P.MAX_JUGADORES) return { motivo: 'llena' };
    m.jugadores.push({ userId, nombre, fichas: 0, jugada: null }); // reserva el sitio
    const a = await K.apostar({ guildId: m.guildId, canalId: m.canalId, userId, cfg: m.cfg, juego: 'poker', cantidad: m.entrada });
    if (a.fallo) { m.jugadores = m.jugadores.filter((j) => j.userId !== userId); return { motivo: 'fallo', fallo: a }; }
    const j = m.jugadores.find((x) => x.userId === userId);
    if (!j || m.estado !== 'sentarse') {
        await K.devolverJugada(a.jugada).catch(() => {});
        return { motivo: 'tarde' };
    }
    j.jugada = a.jugada; j.fichas = a.jugada.apuesta;
    return { ok: true };
}
async function empezar(m) {
    if (m.estado !== 'sentarse') return;
    clearTimeout(m.temporizador);
    m.jugadores = m.jugadores.filter((j) => j.jugada);
    if (m.jugadores.length < 2) {
        m.estado = 'fin';
        await cerrar(m, t(m.idioma, '♠️ No se ha sentado nadie más: mesa cerrada y entrada devuelta.', '♠️ Nobody else sat down: table closed and buy-in refunded.'), true);
        return;
    }
    m.estado = 'juega';
    await nuevaMano(m);
}
async function nuevaMano(m, texto = '') {
    const activos = m.jugadores.filter((j) => j.fichas > 0 && !j.seVa);
    if (activos.length < 2 || m.manos >= MAX_MANOS || Date.now() - m.abierta > MAX_MS) return cerrar(m);
    m.manos += 1;
    m.boton = (m.boton + 1) % activos.length;
    m.mano = P.nuevaMano({ jugadores: activos.map((j) => ({ id: j.userId, fichas: j.fichas })), boton: m.boton, ciega: m.ciega });
    await siguienteTurno(m, texto);
}
// Tras cada acción: o termina la mano, o se espera al siguiente (con su temporizador).
async function siguienteTurno(m, texto = '') {
    clearTimeout(m.temporizador);
    const mano = m.mano;
    if (mano.calle === 'fin') return finMano(m);
    const op = P.opciones(mano);
    const quien = m.jugadores.find((j) => j.userId === op.id);
    // Quien se ha levantado se retira solo al llegarle el turno.
    if (quien?.seVa) { P.actuar(mano, op.id, 'abandonar'); return siguienteTurno(m, texto); }
    m.turnoHasta = Date.now() + TURNO_MS;
    const turno = `${mano.calle}:${mano.log.length}`;
    const agotado = async () => {
        if (m.mano !== mano || `${mano.calle}:${mano.log.length}` !== turno || m.estado !== 'juega') return;
        if (m.ocupada) { m.temporizador = setTimeout(agotado, 1500); return; } // alguien está pulsando justo ahora
        m.ocupada = true;
        try {
            P.actuar(mano, op.id, 'retirarse'); // pasa si puede, si no se retira
            // Dos turnos seguidos sin jugar: se levanta solo al acabar la mano.
            if (quien) { quien.ausencias = (quien.ausencias || 0) + 1; if (quien.ausencias >= 2) quien.seVa = true; }
            await siguienteTurno(m, t(m.idioma, `⏰ <@${op.id}> ha tardado demasiado${quien?.seVa ? ' y se levanta' : ''}.`, `⏰ <@${op.id}> took too long${quien?.seVa ? ' and leaves' : ''}.`));
        } catch (e) { console.error('Póker:', e.message); } finally { m.ocupada = false; }
    };
    m.temporizador = setTimeout(agotado, TURNO_MS);
    await pintar(m, { texto });
}
async function finMano(m) {
    const mano = m.mano; const idioma = m.idioma;
    for (const mj of mano.jugadores) { const j = m.jugadores.find((x) => x.userId === mj.id); if (j) j.fichas = mj.fichas; }
    const r = mano.resultado;
    const lineas = r.botes.filter((b) => b.monto > 0).map((b, i) => {
        const quien = b.ganadores.map((u) => `<@${u}>`).join(', ');
        const mano2 = b.categoria !== null && r.showdown ? ` · ${P.nombreMano(b.categoria, idioma)}` : '';
        return `${i === 0 ? '🏆' : '🥈'} ${quien} ${t(idioma, 'se lleva', 'wins')} 🪙 ${fmt(b.monto, idioma)}${mano2}`;
    });
    // Se va quien se ha quedado sin fichas o ha pedido levantarse: cobra lo que tenga.
    for (const j of m.jugadores.filter((x) => x.jugada && (x.fichas <= 0 || x.seVa))) await cobrar(m, j);
    await pintar(m, { texto: lineas.join('\n') });
    m.temporizador = setTimeout(() => nuevaMano(m, lineas.join('\n')).catch((e) => console.error('Póker:', e.message)), ENTRE_MANOS_MS);
}
async function cobrar(m, j, { devolver = false } = {}) {
    if (!j.jugada) return;
    const jugada = j.jugada; j.jugada = null;
    // Sin haber jugado ninguna mano (o al cerrarse sin gente) se devuelve sin contar como partida.
    if (devolver || m.manos === 0) { j.cobrado = jugada.apuesta; await casino().devolverJugada(jugada).catch((e) => console.error('Póker devolución:', e.message)); return; }
    j.cobrado = j.fichas;
    await casino().cobrarJugada(m.client, m.cfg, jugada, j.fichas, { poker: true, manos: m.manos }).catch((e) => console.error('Póker cobro:', e.message));
}
async function cerrar(m, texto = null, devolver = false) {
    clearTimeout(m.temporizador);
    m.estado = 'fin';
    mesas.delete(m.canalId);
    const idioma = m.idioma;
    for (const j of m.jugadores) await cobrar(m, j, { devolver });
    const resumen = m.jugadores.filter((j) => j.cobrado !== undefined).map((j) => `<@${j.userId}> · 🪙 ${fmt(j.cobrado, idioma)} (${j.cobrado >= m.entrada ? '+' : '−'}${fmt(Math.abs(j.cobrado - m.entrada), idioma)})`);
    await pintar(m, { fin: texto || [t(idioma, '🏁 **Mesa cerrada.** Cada uno cobra sus fichas:', '🏁 **Table closed.** Everyone cashes out their chips:'), ...resumen].join('\n') });
}

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------
async function manejar(interaction) {
    const id = interaction.customId || '';
    if (!id.startsWith('pkr_')) return false;
    const [tipo, mesaId, accion] = id.split(':');
    const m = buscar(mesaId);
    const { idiomaInteraccion } = require('./preferencias.js');
    const idioma = m?.idioma || await idiomaInteraccion(interaction, null).catch(() => 'es');
    const yo = interaction.user.id;
    const responder = (content) => interaction.reply({ content, flags: 64 }).catch(() => {});
    if (!m || m.estado === 'fin') { await responder(t(idioma, '⌛ Esta mesa ya está cerrada.', '⌛ This table is closed.')); return true; }
    if (tipo === 'pkr_sit') {
        if (m.estado !== 'sentarse') { await responder(t(idioma, 'La partida ya ha empezado: espera a la próxima mesa.', 'The game has started: wait for the next table.')); return true; }
        await interaction.deferReply({ flags: 64 });
        const r = await sentar(m, yo, interaction.member?.displayName || interaction.user.globalName || interaction.user.username);
        const K = casino();
        const txt = r.ok ? t(idioma, `✅ Te has sentado con 🪙 ${fmt(m.entrada, idioma)} en fichas. ¡Suerte!`, `✅ You sat down with 🪙 ${fmt(m.entrada, idioma)} in chips. Good luck!`)
            : r.motivo === 'ya' ? t(idioma, 'Ya estás sentado.', 'You’re already seated.') : r.motivo === 'llena' ? t(idioma, 'La mesa está llena.', 'The table is full.')
                : r.motivo === 'tarde' ? t(idioma, '⌛ Ya había empezado: te devolvemos el oro.', '⌛ It had already started: your gold is refunded.') : K.textoFallo(r.fallo, idioma, m.cfg.casino);
        await interaction.editReply({ content: txt });
        if (r.ok) await pintar(m);
        return true;
    }
    if (tipo === 'pkr_go') {
        if (yo !== m.anfitrion) { await responder(t(idioma, 'Solo quien ha abierto la mesa puede empezarla antes de tiempo.', 'Only whoever opened the table can start it early.')); return true; }
        if (m.estado !== 'sentarse') { await interaction.deferUpdate().catch(() => {}); return true; }
        if (m.jugadores.filter((j) => j.jugada).length < 2) { await responder(t(idioma, 'Hacen falta al menos 2 personas sentadas.', 'At least 2 seated players are needed.')); return true; }
        await interaction.deferUpdate().catch(() => {});
        await empezar(m);
        return true;
    }
    if (tipo === 'pkr_out') {
        const j = m.jugadores.find((x) => x.userId === yo && x.jugada);
        if (!j) { await responder(t(idioma, 'No estás sentado en esta mesa.', 'You’re not seated at this table.')); return true; }
        if (m.estado === 'sentarse') {
            // Antes de empezar: se devuelve la entrada entera.
            m.jugadores = m.jugadores.filter((x) => x !== j);
            await cobrar(m, j);
            await responder(t(idioma, '🚪 Te has levantado: entrada devuelta.', '🚪 You left: buy-in refunded.'));
            if (yo === m.anfitrion && m.jugadores[0]) m.anfitrion = m.jugadores[0].userId;
            if (!m.jugadores.length) await cerrar(m, t(idioma, '♠️ Mesa cerrada: se han ido todos.', '♠️ Table closed: everyone left.'));
            else await pintar(m);
            return true;
        }
        j.seVa = true;
        // En mitad de una mano (aunque ya se haya retirado) sus fichas de verdad están en la mano: se cobra al acabarla.
        const enMano = !!m.mano && m.mano.calle !== 'fin' && m.mano.jugadores.some((q) => q.id === yo);
        await responder(enMano ? t(idioma, '🚪 Te levantarás al acabar esta mano (si te toca, te retiras) y cobrarás tus fichas.', '🚪 You’ll leave when this hand ends (folding when it’s your turn) and cash out your chips.') : t(idioma, '🚪 Te levantas: cobras tus fichas.', '🚪 You leave: chips cashed out.'));
        if (!enMano) await cobrar(m, j);
        else if (P.opciones(m.mano)?.id === yo && !m.ocupada) { m.ocupada = true; try { P.actuar(m.mano, yo, 'abandonar'); await siguienteTurno(m); } finally { m.ocupada = false; } }
        if (m.jugadores.filter((x) => x.jugada && !x.seVa && x.fichas > 0).length < 2 && m.mano?.calle === 'fin') await cerrar(m);
        return true;
    }
    if (tipo === 'pkr_v') {
        const mj = m.mano?.jugadores.find((q) => q.id === yo);
        if (!mj) { await responder(t(idioma, 'No tienes cartas en esta mano.', 'You have no cards in this hand.')); return true; }
        const png = dibujoMisCartas(mj.cartas, m.mano.comunes, idioma);
        await interaction.reply({ content: png ? undefined : `🂠 ${mj.cartas.join(' ')}`, files: png ? [new AttachmentBuilder(png, { name: 'cartas.png' })] : [], flags: 64 }).catch(() => {});
        return true;
    }
    if (tipo === 'pkr_a') {
        const op = m.mano ? P.opciones(m.mano) : null;
        if (!op || op.id !== yo) { await responder(op ? t(idioma, `Ahora le toca a <@${op.id}>.`, `It’s <@${op.id}>’s turn.`) : t(idioma, 'Espera a la siguiente mano.', 'Wait for the next hand.')); return true; }
        if (m.ocupada) { await interaction.deferUpdate().catch(() => {}); return true; }
        m.ocupada = true;
        try {
            await interaction.deferUpdate().catch(() => {});
            let hasta = 0; let acc = accion;
            if (accion === 'min') { acc = 'subir'; hasta = op.minHasta; }
            if (accion === 'bote') { acc = 'subir'; hasta = m.mano.apuestaMax + op.bote + op.igualar; } // subir lo que hay en el bote (contando lo que igualas)
            P.actuar(m.mano, yo, acc, hasta);
            const yoJ = m.jugadores.find((x) => x.userId === yo); if (yoJ) yoJ.ausencias = 0;
            const ult = m.mano.log[m.mano.log.length - 1];
            const nombres = { retirarse: t(idioma, 'se retira', 'folds'), pasar: t(idioma, 'pasa', 'checks'), igualar: t(idioma, 'iguala', 'calls'), subir: t(idioma, 'sube a', 'raises to'), allin: t(idioma, 'va all-in con', 'goes all-in with') };
            const dijo = ult && ult[0] === yo ? `<@${yo}> ${nombres[ult[1]]}${ult[2] && ult[1] !== 'igualar' ? ` ${fmt(ult[2], idioma)}` : ''}` : '';
            await siguienteTurno(m, dijo);
        } finally { m.ocupada = false; }
        return true;
    }
    return false;
}

module.exports = { abrir, manejar, mesas, empezar, cerrar, vista, dibujoMesa, ciegaDe, TURNO_MS };
