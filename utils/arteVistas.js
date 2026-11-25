// Tarjetas en imagen de la granja, el pase, los logros, la racha diaria y el ranking (1.31.0).
// Antes eran embeds llenos de líneas; ahora lo importante se VE (barras, casillas, dibujos de las
// mascotas, iconos) y el mensaje lleva muy poco texto. Reciben datos ya calculados (sin base de
// datos) para poder probarlas sin Discord. Si falta @napi-rs/canvas devuelven null y la vista
// vuelve al texto de siempre.
const { FUENTE } = require('./fonts.js');
const A = require('./casinoArte.js');
const K = require('./cofresNucleo.js');

const listo = () => A.listo();
const R = (ctx, x, y, w, h, r) => A.redondeado(ctx, x, y, w, h, r);
const cifra = (n, idioma = 'es') => (Math.round((n || 0) * 10) / 10).toLocaleString(idioma === 'en' ? 'en-US' : 'es-ES');

function fondo(ctx, W, H, c1, c2, borde) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    R(ctx, 0, 0, W, H, 26); ctx.fillStyle = g; ctx.fill();
    if (borde) { ctx.strokeStyle = borde; ctx.lineWidth = 3; R(ctx, 1.5, 1.5, W - 3, H - 3, 25); ctx.stroke(); }
}
function texto(ctx, s, x, y, { tam = 16, peso = 'bold', color = '#fff', alin = 'left', base = 'alphabetic', sombra = null, max = null } = {}) {
    ctx.font = `${peso} ${tam}px ${FUENTE}`; ctx.fillStyle = color; ctx.textAlign = alin; ctx.textBaseline = base;
    if (sombra) { ctx.shadowColor = sombra; ctx.shadowBlur = 14; }
    let t = String(s);
    if (max) while (t.length > 1 && ctx.measureText(t).width > max) t = `${t.slice(0, -2)}…`;
    ctx.fillText(t, x, y);
    ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';
    return ctx.measureText(t).width;
}
function barra(ctx, x, y, w, h, frac, color, fondoC = 'rgba(255,255,255,0.12)') {
    R(ctx, x, y, w, h, h / 2); ctx.fillStyle = fondoC; ctx.fill();
    const f = Math.max(0, Math.min(1, frac || 0));
    if (f > 0) { R(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fillStyle = color; ctx.fill(); }
}
function anillo(ctx, cx, cy, r, frac, color, grosor = 10) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = grosor; ctx.stroke();
    const f = Math.max(0, Math.min(1, frac || 0));
    if (f > 0) { ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt'; }
}
// Casilla de misión: icono, mini barra y ✓ si está hecha.
function chipMision(ctx, x, y, w, m) {
    R(ctx, x, y, w, 46, 14); ctx.fillStyle = m.hecha ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.07)'; ctx.fill();
    if (m.hecha) { ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2; ctx.stroke(); }
    texto(ctx, m.emoji, x + 10, y + 23, { tam: 22, base: 'middle', peso: 'normal' });
    if (m.hecha) texto(ctx, '✓', x + w - 12, y + 24, { tam: 20, color: '#4ade80', alin: 'right', base: 'middle', peso: '900' });
    else {
        texto(ctx, `${Math.min(m.prog, m.n)}/${m.n}`, x + w - 10, y + 18, { tam: 12, color: '#cbd5e1', alin: 'right', base: 'middle' });
        barra(ctx, x + 42, y + 29, w - 52, 7, m.prog / m.n, '#38bdf8');
    }
}

// ---------------------------------------------------------------------------
// 🧺 Granja
// d = { oro, frac (0..1 lleno del granero), lleno, nueva, porHora, equipo: [{ id, estrellas, oroH, triste, fuera }],
//       huecos, album: { n, total, sig }, semana: [{ emoji, prog, n, hecha }], idioma, textos: { titulo, porHora, listo,
//       lleno, empezar, hueco, album, semana, sig } }
// ---------------------------------------------------------------------------
async function tarjetaGranja(d) {
    if (!listo()) return null;
    const W = 800; const H = 470;
    const { c, ctx } = A.lienzo(W, H);
    fondo(ctx, W, H, '#0c4a6e', '#14532d', '#4ade80');
    // Colinas
    ctx.fillStyle = 'rgba(34,197,94,0.25)';
    ctx.beginPath(); ctx.moveTo(0, 150); ctx.quadraticCurveTo(200, 95, 420, 150); ctx.quadraticCurveTo(620, 200, 800, 130); ctx.lineTo(800, 470); ctx.lineTo(0, 470); ctx.closePath(); ctx.fill();
    const T = d.textos || {};
    // Cabecera: oro listo y granero
    texto(ctx, `🧺 ${T.titulo || 'GRANJA'}`, 28, 42, { tam: 18, color: '#bbf7d0' });
    texto(ctx, `🪙 ${cifra(d.oro, d.idioma)}`, 28, 96, { tam: 50, peso: '900', sombra: '#facc15' });
    const etiqueta = d.nueva ? (T.empezar || '▶') : d.lleno ? (T.lleno || '¡LLENO!') : (T.listo || 'para recoger');
    texto(ctx, etiqueta, 30, 122, { tam: 15, color: d.lleno ? '#fde047' : '#d1fae5' });
    // Granero (barra vertical a la derecha)
    texto(ctx, `🪙 ${cifra(d.porHora, d.idioma)} ${T.porHora || '/h'}`, W - 28, 44, { tam: 22, alin: 'right', peso: '900', color: '#fef08a' });
    barra(ctx, W - 320, 64, 292, 18, d.frac, d.lleno ? '#facc15' : '#22c55e');
    texto(ctx, '🏚️', W - 346, 73, { tam: 22, base: 'middle', peso: 'normal' });
    texto(ctx, `${Math.round((d.frac || 0) * 100)} %`, W - 28, 104, { tam: 13, alin: 'right', color: '#d1fae5' });
    // Huecos de la granja con sus mascotas trabajando
    const n = Math.max(d.huecos || 3, (d.equipo || []).length);
    const hueco = Math.min(118, Math.floor((W - 56 - (n - 1) * 10) / n));
    const x0 = (W - (n * hueco + (n - 1) * 10)) / 2; const y0 = 150;
    const fotos = await Promise.all((d.equipo || []).map((m) => A.imagenCompanero(m.id).catch(() => null)));
    for (let i = 0; i < n; i++) {
        const x = x0 + i * (hueco + 10);
        const m = d.equipo?.[i];
        R(ctx, x, y0, hueco, 150, 18);
        if (!m) {
            ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
            ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
            texto(ctx, '+', x + hueco / 2, y0 + 78, { tam: 40, alin: 'center', base: 'middle', color: 'rgba(255,255,255,0.45)', peso: '300' });
            continue;
        }
        const rz = K.RAREZAS[K.def(m.id).rareza] || K.RAREZAS.comun;
        ctx.fillStyle = 'rgba(2,6,23,0.55)'; ctx.fill();
        ctx.strokeStyle = rz.color; ctx.lineWidth = 3; ctx.stroke();
        const tam = Math.min(76, hueco - 24);
        A.pintarCompanero(ctx, fotos[i], m.id, x + (hueco - tam) / 2, y0 + 12, tam, rz.color);
        if (m.triste) texto(ctx, '😢', x + hueco - 8, y0 + 22, { tam: 20, alin: 'right', base: 'middle', peso: 'normal' });
        texto(ctx, '★'.repeat(m.estrellas || 1), x + hueco / 2, y0 + tam + 32, { tam: 13, alin: 'center', color: '#fde047' });
        texto(ctx, `🪙 ${cifra(m.oroH, d.idioma)}/h`, x + hueco / 2, y0 + 136, { tam: 14, alin: 'center', peso: '900', max: hueco - 8 });
    }
    // Álbum (anillo) y misiones de la semana
    const yb = 330;
    R(ctx, 24, yb, 230, 116, 18); ctx.fillStyle = 'rgba(2,6,23,0.5)'; ctx.fill();
    anillo(ctx, 80, yb + 58, 36, d.album.n / d.album.total, '#a855f7', 9);
    texto(ctx, String(d.album.n), 80, yb + 54, { tam: 22, alin: 'center', base: 'middle', peso: '900' });
    texto(ctx, `/${d.album.total}`, 80, yb + 76, { tam: 12, alin: 'center', base: 'middle', color: '#cbd5e1' });
    texto(ctx, `📖 ${T.album || 'Álbum'}`, 130, yb + 38, { tam: 16 });
    if (d.album.sig) texto(ctx, d.album.sig, 130, yb + 64, { tam: 13, color: '#e9d5ff', max: 118 });
    if (d.album.sig2) texto(ctx, d.album.sig2, 130, yb + 86, { tam: 13, color: '#fde68a', max: 118 });
    R(ctx, 268, yb, W - 292, 116, 18); ctx.fillStyle = 'rgba(2,6,23,0.5)'; ctx.fill();
    texto(ctx, `📅 ${T.semana || 'Semana'}`, 284, yb + 26, { tam: 14, color: '#bae6fd' });
    const ms = d.semana || [];
    const anchoM = Math.floor((W - 292 - 32 - (ms.length - 1) * 10) / Math.max(1, ms.length));
    ms.forEach((m, i) => chipMision(ctx, 284 + i * (anchoM + 10), yb + 46, anchoM, m));
    return c.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// 🎟️ Pase de temporada
// d = { nivel, max, frac, xp, xpNivel, temp, proximos: [{ n, oro, iconos: ['🃏', …], titulo, regalo }],
//       tickets: [{ emoji, n }], logros: { n, total }, casino: { n, tope }, leyenda, idioma, textos: { nivel, tickets, logros } }
// ---------------------------------------------------------------------------
function tarjetaPase(d) {
    if (!listo()) return null;
    const W = 800; const H = 360;
    const { c, ctx } = A.lienzo(W, H);
    fondo(ctx, W, H, '#2e1065', '#0f172a', '#a78bfa');
    const T = d.textos || {};
    // Insignia del nivel con el anillo de XP
    const cx = 120; const cy = 150;
    const halo = ctx.createRadialGradient(cx, cy, 10, cx, cy, 120);
    halo.addColorStop(0, 'rgba(167,139,250,0.55)'); halo.addColorStop(1, 'rgba(167,139,250,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 20, 260, 260);
    anillo(ctx, cx, cy, 78, d.frac, '#c084fc', 14);
    texto(ctx, T.nivel || 'NIVEL', cx, cy - 34, { tam: 14, alin: 'center', color: '#ddd6fe' });
    texto(ctx, String(d.nivel), cx, cy + 14, { tam: 58, alin: 'center', peso: '900', sombra: '#a78bfa' });
    texto(ctx, `${d.xp}/${d.xpNivel} XP`, cx, cy + 48, { tam: 13, alin: 'center', color: '#c4b5fd' });
    texto(ctx, `🎟️ ${d.temp}${d.leyenda ? '  🏆' : ''}`, cx, 268, { tam: 15, alin: 'center', color: '#e9d5ff' });
    // Pista de premios: los próximos niveles
    const px = 250; const pw = W - px - 24;
    texto(ctx, `${d.nivel}/${d.max}`, W - 26, 44, { tam: 16, alin: 'right', color: '#ddd6fe' });
    barra(ctx, px, 30, pw - 70, 10, d.nivel / d.max, '#8b5cf6');
    const lista = d.proximos || [];
    const tw = Math.floor((pw - (lista.length - 1) * 10) / Math.max(1, lista.length));
    lista.forEach((p, i) => {
        const x = px + i * (tw + 10); const y = 62;
        R(ctx, x, y, tw, 150, 16);
        ctx.fillStyle = p.regalo ? 'rgba(250,204,21,0.16)' : 'rgba(255,255,255,0.07)'; ctx.fill();
        ctx.strokeStyle = p.regalo ? '#facc15' : i === 0 ? '#c084fc' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = p.regalo || i === 0 ? 2.5 : 1.5; ctx.stroke();
        texto(ctx, String(p.n), x + tw / 2, y + 28, { tam: 20, alin: 'center', peso: '900', color: p.regalo ? '#fde047' : '#fff' });
        const iconos = [...(p.iconos || [])].slice(0, 3);
        texto(ctx, iconos.length ? iconos.join('') : (p.titulo ? '🏆' : '🪙'), x + tw / 2, y + 76, { tam: iconos.length > 1 ? 24 : 32, alin: 'center', base: 'middle', peso: 'normal' });
        texto(ctx, `🪙 ${cifra(p.oro, d.idioma)}`, x + tw / 2, y + 128, { tam: 14, alin: 'center', color: '#fef3c7', max: tw - 6 });
    });
    // Abajo: tickets, logros y partidas del casino de hoy
    const y = 238;
    R(ctx, px, y, pw, 96, 16); ctx.fillStyle = 'rgba(2,6,23,0.5)'; ctx.fill();
    texto(ctx, `🎫 ${T.tickets || 'Tickets'}`, px + 16, y + 28, { tam: 14, color: '#c4b5fd' });
    let tx = px + 16;
    if (!(d.tickets || []).length) texto(ctx, '—', tx, y + 68, { tam: 22, color: '#64748b' });
    for (const tk of d.tickets || []) {
        R(ctx, tx, y + 44, 74, 38, 12); ctx.fillStyle = 'rgba(34,197,94,0.2)'; ctx.fill(); ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1.5; ctx.stroke();
        texto(ctx, tk.emoji, tx + 10, y + 63, { tam: 20, base: 'middle', peso: 'normal' });
        texto(ctx, `×${tk.n}`, tx + 64, y + 64, { tam: 16, alin: 'right', base: 'middle', peso: '900' });
        tx += 84;
        if (tx > px + pw - 250) break;
    }
    texto(ctx, `🏅 ${d.logros.n}/${d.logros.total}`, W - 40, y + 46, { tam: 20, alin: 'right', peso: '900' });
    texto(ctx, `🎰 ${d.casino.n}/${d.casino.tope}`, W - 40, y + 78, { tam: 16, alin: 'right', color: '#cbd5e1' });
    return c.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// 🏅 Logros: insignias encendidas o con candado
// d = { logros: [{ emoji, nombre, oro, tiene }], titulo }
// ---------------------------------------------------------------------------
function tarjetaLogros(d) {
    if (!listo()) return null;
    const cols = 6; const celda = 124; const alto = 118;
    const filas = Math.ceil(d.logros.length / cols);
    const W = 24 * 2 + cols * celda; const H = 74 + filas * alto + 16;
    const { c, ctx } = A.lienzo(W, H);
    fondo(ctx, W, H, '#451a03', '#0f172a', '#f59e0b');
    const tienen = d.logros.filter((l) => l.tiene).length;
    texto(ctx, d.titulo || '🏅', 26, 46, { tam: 24, peso: '900' });
    barra(ctx, W - 250, 30, 224, 12, tienen / d.logros.length, '#f59e0b');
    texto(ctx, `${tienen}/${d.logros.length}`, W - 260, 42, { tam: 16, alin: 'right', color: '#fde68a' });
    d.logros.forEach((l, i) => {
        const x = 24 + (i % cols) * celda; const y = 66 + Math.floor(i / cols) * alto;
        const cx = x + celda / 2; const cy = y + 36;
        ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        if (l.tiene) {
            const g = ctx.createRadialGradient(cx, cy - 8, 4, cx, cy, 32);
            g.addColorStop(0, '#fde68a'); g.addColorStop(1, '#b45309');
            ctx.fillStyle = g; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
            texto(ctx, l.emoji, cx, cy + 2, { tam: 28, alin: 'center', base: 'middle', peso: 'normal' });
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
            ctx.globalAlpha = 0.3; texto(ctx, l.emoji, cx, cy + 2, { tam: 26, alin: 'center', base: 'middle', peso: 'normal' }); ctx.globalAlpha = 1;
            texto(ctx, '🔒', cx + 20, cy + 22, { tam: 14, alin: 'center', base: 'middle', peso: 'normal' });
        }
        texto(ctx, l.nombre, cx, y + 86, { tam: 12, alin: 'center', color: l.tiene ? '#fff' : '#94a3b8', max: celda - 8 });
        texto(ctx, `🪙 ${cifra(l.oro, d.idioma)}`, cx, y + 104, { tam: 11, alin: 'center', color: l.tiene ? '#fde68a' : '#64748b' });
    });
    return c.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// 🔥 Recompensa diaria: el oro, la racha y la semana en casillas (el premio gordo, cada 7 días)
// d = { total, racha, extra, bote, saldo, idioma, textos: { dia, racha, saldo } }
// ---------------------------------------------------------------------------
function tarjetaDiario(d) {
    if (!listo()) return null;
    const W = 720; const H = 300;
    const { c, ctx } = A.lienzo(W, H);
    fondo(ctx, W, H, '#78350f', '#1c1917', '#f59e0b');
    const T = d.textos || {};
    texto(ctx, `+🪙 ${cifra(d.total, d.idioma)}`, W / 2, 86, { tam: 58, alin: 'center', peso: '900', sombra: '#facc15' });
    const extras = [d.bote ? `🎉 +${cifra(d.bote, d.idioma)}` : '', d.extra ? `🐾 +${cifra(d.extra, d.idioma)}` : ''].filter(Boolean).join('   ');
    if (extras) texto(ctx, extras, W / 2, 120, { tam: 18, alin: 'center', color: '#fde68a' });
    // Semana de la racha: 7 casillas; la 7.ª lleva el premio gordo
    const enSemana = ((d.racha - 1) % 7) + 1;
    const cw = 78; const x0 = (W - (7 * cw + 6 * 12)) / 2; const y = 146;
    for (let i = 1; i <= 7; i++) {
        const x = x0 + (i - 1) * (cw + 12);
        const hecho = i <= enSemana; const hoy = i === enSemana;
        R(ctx, x, y, cw, 86, 16);
        ctx.fillStyle = hoy ? 'rgba(250,204,21,0.35)' : hecho ? 'rgba(249,115,22,0.28)' : 'rgba(255,255,255,0.07)'; ctx.fill();
        ctx.strokeStyle = hoy ? '#facc15' : hecho ? '#fb923c' : 'rgba(255,255,255,0.14)'; ctx.lineWidth = hoy ? 3 : 1.5; ctx.stroke();
        texto(ctx, i === 7 ? '🎁' : hecho ? '🔥' : '·', x + cw / 2, y + 40, { tam: i === 7 || hecho ? 30 : 30, alin: 'center', base: 'middle', peso: 'normal', color: '#64748b' });
        texto(ctx, `${T.dia || 'Día'} ${i}`, x + cw / 2, y + 74, { tam: 12, alin: 'center', color: hecho ? '#fff' : '#94a3b8' });
    }
    texto(ctx, `🔥 ${d.racha} ${T.racha || ''}`.trim(), 28, H - 26, { tam: 20, peso: '900', color: '#fdba74' });
    texto(ctx, `${T.saldo || ''} 🪙 ${cifra(d.saldo, d.idioma)}`.trim(), W - 28, H - 26, { tam: 18, alin: 'right', color: '#fef3c7' });
    return c.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// 🏆 Ranking de niveles: podio con fotos para los 3 primeros y filas con barra para el resto
// d = { titulo, filas: [{ nombre, avatar (URL o null), nivel, xp }], textos: { nivel } }
// ---------------------------------------------------------------------------
async function cargarAvatar(url) {
    if (!url) return null;
    try {
        const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (!r.ok) return null;
        return await require('@napi-rs/canvas').loadImage(Buffer.from(await r.arrayBuffer()));
    } catch { return null; }
}
function avatar(ctx, img, cx, cy, r, borde, inicial = '?') {
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
    if (img) { ctx.clip(); ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2); } else { ctx.fillStyle = '#334155'; ctx.fill(); }
    ctx.restore();
    if (!img) texto(ctx, inicial.toUpperCase(), cx, cy + 2, { tam: r * 0.9, alin: 'center', base: 'middle', peso: '900' });
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = borde; ctx.lineWidth = Math.max(3, r / 9); ctx.stroke();
}
async function tarjetaRanking(d) {
    if (!listo()) return null;
    const filas = d.filas.slice(0, 10);
    const resto = filas.slice(3);
    const W = 760; const H = 370 + resto.length * 46 + (resto.length ? 16 : 0);
    const { c, ctx } = A.lienzo(W, H);
    fondo(ctx, W, H, '#1e1b4b', '#0f172a', '#facc15');
    texto(ctx, d.titulo || '🏆', W / 2, 44, { tam: 22, alin: 'center', peso: '900', max: W - 60 });
    const fotos = await Promise.all(filas.map((f) => cargarAvatar(f.avatar)));
    // Podio: 2.º a la izquierda, 1.º en medio (más alto), 3.º a la derecha
    const COL = ['#facc15', '#cbd5e1', '#f97316'];
    const sitios = [{ i: 1, x: W / 2 - 200, alto: 70 }, { i: 0, x: W / 2, alto: 100 }, { i: 2, x: W / 2 + 200, alto: 50 }];
    const suelo = 340;
    for (const s of sitios) {
        const f = filas[s.i];
        if (!f) continue;
        R(ctx, s.x - 80, suelo - s.alto, 160, s.alto, 12);
        const g = ctx.createLinearGradient(0, suelo - s.alto, 0, suelo);
        g.addColorStop(0, `${COL[s.i]}aa`); g.addColorStop(1, `${COL[s.i]}22`);
        ctx.fillStyle = g; ctx.fill();
        texto(ctx, ['🥇', '🥈', '🥉'][s.i], s.x, suelo - s.alto / 2 + 2, { tam: 34, alin: 'center', base: 'middle', peso: 'normal' });
        const r = s.i === 0 ? 50 : 42;
        const cy = suelo - s.alto - r - 44;
        avatar(ctx, fotos[s.i], s.x, cy, r, COL[s.i], f.nombre?.[0] || '?');
        if (s.i === 0) texto(ctx, '👑', s.x, cy - r - 4, { tam: 30, alin: 'center', peso: 'normal' });
        texto(ctx, f.nombre, s.x, suelo - s.alto - 22, { tam: 16, alin: 'center', max: 170 });
        texto(ctx, `${d.textos?.nivel || 'Nv.'} ${f.nivel} · ${cifra(f.xp, d.idioma)} XP`, s.x, suelo - s.alto - 4, { tam: 13, alin: 'center', color: COL[s.i], max: 170 });
    }
    // Del 4.º al 10.º
    const maxXp = Math.max(1, ...filas.map((f) => f.xp || 0));
    resto.forEach((f, k) => {
        const y = suelo + 18 + k * 46;
        R(ctx, 24, y, W - 48, 38, 12); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
        texto(ctx, String(k + 4), 46, y + 20, { tam: 16, alin: 'center', base: 'middle', peso: '900', color: '#94a3b8' });
        avatar(ctx, fotos[k + 3], 84, y + 19, 15, '#475569', f.nombre?.[0] || '?');
        texto(ctx, f.nombre, 108, y + 20, { tam: 15, base: 'middle', max: 240 });
        barra(ctx, 340, y + 14, 220, 10, (f.xp || 0) / maxXp, '#818cf8');
        texto(ctx, `${d.textos?.nivel || 'Nv.'} ${f.nivel}`, W - 40, y + 20, { tam: 15, alin: 'right', base: 'middle', peso: '900' });
        texto(ctx, `${cifra(f.xp, d.idioma)} XP`, 574, y + 20, { tam: 12, base: 'middle', color: '#a5b4fc' });
    });
    return c.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// 🎰 Guía del casino (1.34.1): el mapa con todos los juegos de un vistazo.
// d = { titulo, sub, pasos: [texto×3], grupos: [{ titulo, juegos: [{ emoji, nombre, facil, apagado }] }],
//       pie: [texto…], textos: { facil } }
// ---------------------------------------------------------------------------
function tarjetaGuiaCasino(d) {
    if (!listo()) return null;
    const W = 920; const COLS = 6; const TW = 138; const TH = 104; const GAP = 10;
    const filasDe = (n) => Math.ceil(n / COLS);
    const altoGrupos = d.grupos.reduce((a, g) => a + 46 + filasDe(g.juegos.length) * (TH + GAP), 0);
    const H = 196 + altoGrupos + 70;
    const { c, ctx } = A.lienzo(W, H);
    fondo(ctx, W, H, '#3b0710', '#0b1026', '#f59e0b');
    // Luces de cabecera
    for (let i = 0; i < 3; i++) {
        const x = (W / 4) * (i + 1);
        const g = ctx.createRadialGradient(x, 30, 5, x, 30, 260);
        g.addColorStop(0, ['#f472b655', '#facc1544', '#38bdf844'][i]); g.addColorStop(1, '#00000000');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, 200);
    }
    texto(ctx, d.titulo, W / 2, 64, { tam: 44, alin: 'center', peso: '900', sombra: '#f472b6' });
    if (d.sub) texto(ctx, d.sub, W / 2, 94, { tam: 16, alin: 'center', color: '#fde68a' });
    // Tres pasos
    const pw = 270; const px0 = (W - (3 * pw + 2 * 22)) / 2;
    d.pasos.forEach((p, i) => {
        const x = px0 + i * (pw + 22); const y = 116;
        R(ctx, x, y, pw, 52, 26); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
        ctx.strokeStyle = 'rgba(253,230,138,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(x + 26, y + 26, 16, 0, Math.PI * 2); ctx.fillStyle = '#f59e0b'; ctx.fill();
        texto(ctx, String(i + 1), x + 26, y + 27, { tam: 18, alin: 'center', base: 'middle', peso: '900', color: '#1c1917' });
        texto(ctx, p, x + 52, y + 27, { tam: 16, base: 'middle', max: pw - 62 });
        if (i < 2) texto(ctx, '›', x + pw + 11, y + 27, { tam: 26, alin: 'center', base: 'middle', color: '#fde68a' });
    });
    // Grupos de juegos
    let y = 196;
    for (const g of d.grupos) {
        texto(ctx, g.titulo, 30, y + 26, { tam: 17, color: '#fde68a' });
        ctx.fillStyle = 'rgba(253,230,138,0.25)'; ctx.fillRect(30 + ctx.measureText(g.titulo).width + 14, y + 20, W - 60 - ctx.measureText(g.titulo).width - 14, 1.5);
        y += 46;
        const x0 = (W - (COLS * TW + (COLS - 1) * GAP)) / 2;
        g.juegos.forEach((j, i) => {
            const x = x0 + (i % COLS) * (TW + GAP); const yy = y + Math.floor(i / COLS) * (TH + GAP);
            R(ctx, x, yy, TW, TH, 16);
            ctx.fillStyle = j.apagado ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)'; ctx.fill();
            ctx.strokeStyle = j.facil && !j.apagado ? '#4ade80' : 'rgba(255,255,255,0.14)'; ctx.lineWidth = j.facil && !j.apagado ? 2.5 : 1.2; ctx.stroke();
            ctx.globalAlpha = j.apagado ? 0.3 : 1;
            texto(ctx, j.emoji, x + TW / 2, yy + 40, { tam: 38, alin: 'center', base: 'middle', peso: 'normal' });
            texto(ctx, j.nombre, x + TW / 2, yy + 84, { tam: 14, alin: 'center', max: TW - 10 });
            ctx.globalAlpha = 1;
            if (j.apagado) texto(ctx, '🚫', x + TW - 12, yy + 16, { tam: 16, alin: 'right', base: 'middle', peso: 'normal' });
            else if (j.facil) {
                R(ctx, x + 6, yy + 6, 58, 20, 10); ctx.fillStyle = '#16a34a'; ctx.fill();
                texto(ctx, d.textos?.facil || 'fácil', x + 35, yy + 17, { tam: 11, alin: 'center', base: 'middle', peso: '900' });
            }
        });
        y += filasDe(g.juegos.length) * (TH + GAP);
    }
    // Pie con lo importante
    R(ctx, 24, H - 58, W - 48, 40, 20); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
    texto(ctx, d.pie.join('   ·   '), W / 2, H - 37, { tam: 15, alin: 'center', base: 'middle', color: '#fef3c7', max: W - 80 });
    return c.toBuffer('image/png');
}

// Icono de un juego para la ficha de la guía: el emoji grande en un cuadrado con brillo.
const iconos = new Map();
function iconoJuego(emoji, color = '#f59e0b') {
    if (!listo()) return null;
    const clave = `${emoji}|${color}`;
    if (iconos.has(clave)) return iconos.get(clave);
    const T = 160;
    const { c, ctx } = A.lienzo(T, T);
    const g = ctx.createRadialGradient(T / 2, T / 3, 10, T / 2, T / 2, T * 0.75);
    g.addColorStop(0, `${color}cc`); g.addColorStop(1, '#0b1026');
    R(ctx, 0, 0, T, T, 34); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 4; R(ctx, 2, 2, T - 4, T - 4, 32); ctx.stroke();
    texto(ctx, emoji, T / 2, T / 2 + 4, { tam: 86, alin: 'center', base: 'middle', peso: 'normal' });
    const b = c.toBuffer('image/png');
    iconos.set(clave, b);
    return b;
}

// Si algo falla al pintar, null: la vista vuelve al texto (en /diario el oro ya está dado, así que nunca debe romper la respuesta).
const seguro = (fn) => (...a) => { try { return fn(...a); } catch (e) { console.error(`Arte (${fn.name}):`, e.message); return null; } };
const seguroAsync = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { console.error(`Arte (${fn.name}):`, e.message); return null; } };
module.exports = {
    tarjetaGranja: seguroAsync(tarjetaGranja), tarjetaPase: seguro(tarjetaPase), tarjetaLogros: seguro(tarjetaLogros),
    tarjetaDiario: seguro(tarjetaDiario), tarjetaRanking: seguroAsync(tarjetaRanking), tarjetaGuiaCasino: seguro(tarjetaGuiaCasino), iconoJuego: seguro(iconoJuego), chipMision, barra, anillo, texto,
};
