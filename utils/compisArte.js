// Tarjeta del compañero (1.20.0): el compañero grande, su humor, sus barras de hambre,
// alegría y energía, su nivel de afinidad y un bocadillo con lo que dice. Si se le acaba
// de cuidar, sale como GIF corto con el efecto (corazones, comida, pelota, estrellas).
const { FUENTE } = require('./fonts.js');
const K = require('./cofresNucleo.js');
const A = require('./casinoArte.js');
const SPR = require('./sprites.js');

const W = 760; const H = 380;
const FRANJA = 104; // 1.31.0: franja de abajo con misiones, racha, expediciones y recuerdos
const EFECTOS = { mimar: '2764', comer: '1f356', jugar: '1f3be', hablar: '1f4ac', vuelta: '2728', nivel: '2b50', evolucion: '2728', cura: '1f48a', juego: '1f3be' };

function barra(ctx, x, y, w, valor, color, etiqueta) {
    A.redondeado(ctx, x, y, w, 16, 8); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
    if (valor > 0) { A.redondeado(ctx, x, y, Math.max(16, (w * valor) / 100), 16, 8); ctx.fillStyle = valor < 25 ? '#ef4444' : color; ctx.fill(); }
    ctx.fillStyle = '#e2e8f0'; ctx.font = `bold 14px ${FUENTE}`; ctx.textAlign = 'left';
    ctx.fillText(etiqueta, x, y - 6);
    ctx.textAlign = 'right'; ctx.fillText(`${valor}`, x + w, y - 6);
}
// Parte el texto en líneas que quepan en `ancho`.
function lineas(ctx, texto, ancho, max = 3) {
    const out = []; let l = '';
    for (const p of String(texto).split(/\s+/)) {
        const prueba = l ? `${l} ${p}` : p;
        if (ctx.measureText(prueba).width > ancho && l) { out.push(l); l = p; } else l = prueba;
    }
    if (l) out.push(l);
    if (out.length > max) { out.length = max; out[max - 1] = `${out[max - 1].slice(0, -1)}…`; }
    return out;
}

// d = { id, nombre, rarezaTexto, estrellas, nivel, progreso (0..1), estado {hambre, alegria, energia},
//       humor {emoji, texto}, frase, fuera (texto o null), etiquetas {hambre, alegria, energia, nivel}, pie }
async function dibujar(ctx, d, f = 0, total = 1, efecto = null, imgEfecto = null, img = null) {
    const comp = K.def(d.id);
    const rz = K.RAREZAS[comp.rareza];
    const HH = d.extra ? H + FRANJA : H;
    const fondo = ctx.createLinearGradient(0, 0, W, HH);
    fondo.addColorStop(0, '#0f172a'); fondo.addColorStop(1, '#1e1b4b');
    A.redondeado(ctx, 0, 0, W, HH, 26); ctx.fillStyle = fondo; ctx.fill();
    // Halo del color de su rareza
    const halo = ctx.createRadialGradient(170, 200, 20, 170, 200, 190);
    halo.addColorStop(0, `${rz.color}88`); halo.addColorStop(1, `${rz.color}00`);
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 360, H);
    ctx.strokeStyle = rz.color; ctx.lineWidth = 4; A.redondeado(ctx, 2, 2, W - 4, HH - 4, 24); ctx.stroke();
    // El compañero: respira (sube y baja) y, si está fuera, sale medio transparente.
    const t = total > 1 ? f / total : 0;
    // 2.2.0: un truco mueve, gira y estira a la mascota (y pinta lo suyo: notas, humo, fuegos…).
    const truco = efecto && efecto.startsWith('truco:') ? efecto.slice(6) : null;
    const pose = truco ? poseTruco(truco, total > 1 ? f / (total - 1) : 1) : null;
    const salto = truco ? 0 : efecto === 'jugar' ? -Math.abs(Math.sin(t * Math.PI * 3)) * 30 : efecto === 'evolucion' ? 0 : (img && img.sprite ? 0 : Math.sin(t * Math.PI * 2) * 4);
    const tam = 210;
    // 1.32.0: si tiene dibujo propio, cada fotograma es un dibujo distinto (respira, parpadea).
    if (img && img.sprite) img = img.cuadro(f, total, pose?.humor);
    if (efecto === 'evolucion' && total > 1) { // destello que crece y se apaga
        const k = Math.sin(Math.min(1, t * 1.6) * Math.PI);
        const g = ctx.createRadialGradient(170, 205, 10, 170, 205, 200);
        g.addColorStop(0, `rgba(255,255,255,${0.95 * k})`); g.addColorStop(0.4, `rgba(253,230,138,${0.6 * k})`); g.addColorStop(1, 'rgba(253,230,138,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 360, H);
    }
    if (pose?.detras) pose.detras(ctx);
    if (d.fuera) ctx.globalAlpha = 0.35;
    if (pose) {
        ctx.save(); ctx.globalAlpha = pose.alfa ?? 1;
        ctx.translate(170 + (pose.dx || 0), 205 + (pose.dy || 0)); ctx.rotate(pose.rot || 0); ctx.scale(pose.sx ?? 1, pose.sy ?? 1);
        if ((pose.alfa ?? 1) > 0.01) A.pintarCompanero(ctx, img, d.id, -tam / 2, -tam / 2, tam, rz.color);
        ctx.restore();
    } else A.pintarCompanero(ctx, img, d.id, 170 - tam / 2, 205 - tam / 2 + salto, tam, rz.color);
    ctx.globalAlpha = 1;
    if (pose?.delante) pose.delante(ctx);
    // Efecto: dibujitos que suben y se desvanecen
    if (imgEfecto && total > 1) {
        for (let i = 0; i < 7; i++) {
            const k = ((t * 1.4 + i / 7) % 1);
            const x = 80 + ((i * 53) % 190) + Math.sin(k * 6 + i) * 10;
            const y = 300 - k * 240;
            const s = 26 + 10 * Math.sin(i + k * 3);
            ctx.globalAlpha = 1 - k; ctx.drawImage(imgEfecto, x, y, s, s);
        }
        ctx.globalAlpha = 1;
    }
    // Humor
    A.redondeado(ctx, 24, 22, 190, 34, 17); ctx.fillStyle = 'rgba(2,6,23,0.7)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold 16px ${FUENTE}`; ctx.textAlign = 'left';
    ctx.fillText(`${d.humor.emoji} ${d.humor.texto}`.slice(0, 26), 38, 45);
    // Nombre, rareza y estrellas
    const X = 350;
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 26px ${FUENTE}`; ctx.textAlign = 'left';
    ctx.fillText(String(d.nombre).slice(0, 26), X, 52);
    ctx.fillStyle = rz.color; ctx.font = `bold 15px ${FUENTE}`;
    ctx.fillText(`${d.rarezaTexto}  ${'★'.repeat(d.estrellas || 1)}${d.etapaTexto ? `  ·  ${d.etapaTexto}` : ''}${d.variante === 'brillante' ? '  ✨' : ''}`, X, 76);
    // Nivel de afinidad
    ctx.fillStyle = '#c4b5fd'; ctx.font = `bold 14px ${FUENTE}`;
    ctx.fillText(d.etiquetas.nivel, X, 104);
    A.redondeado(ctx, X, 112, 380, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
    A.redondeado(ctx, X, 112, Math.max(10, 380 * Math.min(1, d.progreso)), 10, 5); ctx.fillStyle = '#a78bfa'; ctx.fill();
    // Necesidades
    barra(ctx, X, 154, 380, d.estado.hambre, '#f59e0b', d.etiquetas.hambre);
    barra(ctx, X, 198, 380, d.estado.alegria, '#ec4899', d.etiquetas.alegria);
    barra(ctx, X, 242, 380, d.estado.energia, '#22c55e', d.etiquetas.energia);
    // Bocadillo con lo que dice (o cuándo vuelve)
    A.redondeado(ctx, X - 10, 270, 400, 86, 16); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(X - 10, 300); ctx.lineTo(X - 28, 312); ctx.lineTo(X - 10, 320); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.font = `bold 16px ${FUENTE}`; ctx.textAlign = 'left';
    const ls = lineas(ctx, d.fuera || `«${d.frase}»`, 372);
    ls.forEach((l, i) => ctx.fillText(l, X + 4, 298 + i * 22 + (3 - ls.length) * 11));
    if (d.pie) { ctx.fillStyle = '#94a3b8'; ctx.font = `13px ${FUENTE}`; ctx.textAlign = 'left'; ctx.fillText(String(d.pie).slice(0, 90), 26, H - 14); }
    if (d.extra) franja(ctx, d.extra);
}

// Franja de abajo (1.31.0): lo que antes eran campos de texto del mensaje.
// x = { misiones: [{ emoji, prog, n, hecha }], racha, exp: { n, max }, recuerdos: ['🐚', …], recTotal, poder: { emoji, listo } }
function franja(ctx, x) {
    const V = require('./arteVistas.js');
    const y = H - 2;
    ctx.fillStyle = 'rgba(2,6,23,0.55)'; A.redondeado(ctx, 14, y, W - 28, FRANJA - 14, 18); ctx.fill();
    // Misiones de hoy
    const ms = x.misiones || [];
    ms.forEach((m, i) => V.chipMision(ctx, 26 + i * 112, y + 14, 104, m));
    // Racha y expediciones
    const x0 = 26 + ms.length * 112 + 6;
    V.texto(ctx, `🔥 ${x.racha || 0}`, x0, y + 38, { tam: 22, peso: '900', color: (x.racha || 0) ? '#fdba74' : '#64748b' });
    V.texto(ctx, `🧭 ${x.exp?.n || 0}/${x.exp?.max || 0}`, x0, y + 70, { tam: 16, color: '#bae6fd' });
    // Poder listo
    if (x.poder) V.texto(ctx, `${x.poder.emoji}${x.poder.listo ? '' : '💤'}`, x0 + 94, y + 38, { tam: 22, peso: 'normal' });
    // Recuerdos (los que tiene encendidos)
    const rx = W - 26;
    V.texto(ctx, `🎒 ${(x.recuerdos || []).length}/${x.recTotal || 0}`, rx, y + 34, { tam: 15, alin: 'right', color: '#e9d5ff' });
    const recs = (x.recuerdos || []).slice(-8);
    ctx.font = `20px ${FUENTE}`;
    V.texto(ctx, recs.join('') || '·', rx, y + 68, { tam: 20, alin: 'right', peso: 'normal', color: '#64748b' });
}

// Dibujo propio (sprites.js) con su etapa, su humor y su variante: un objeto que da el dibujo de cada fotograma.
function dibujoPropio(d, efecto) {
    if (!SPR.tiene(d.id)) return null;
    const etapa = SPR.etapaDe(d.nivel || 1);
    const humor = d.fuera ? 'dormido' : efecto && efecto !== 'hablar' && efecto !== 'nivel' ? 'feliz' : (d.humorClave || 'normal');
    return { sprite: true, cuadro: (f, total, otro = null) => SPR.imagen(d.id, { etapa, humor: otro || humor, variante: d.variante || null, acc: d.acc || null, t: total > 1 ? (f % 8) / 8 : 0, parpadeo: total > 1 && f % 8 === 6 && (otro || humor) !== 'feliz' }) };
}

// 2.2.0: la postura de cada truco en el instante k (0 → 1). Centro de la mascota: (170, 205).
const sube = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
function nota(ctx, txt, x, y, a, tam = 26, color = '#f9a8d4') { ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.font = `bold ${tam}px ${FUENTE}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(15,23,42,0.7)'; ctx.strokeText(txt, x, y); ctx.fillStyle = color; ctx.fillText(txt, x, y); ctx.restore(); }
function humo(ctx, x, y, k) { ctx.save(); for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const r = 20 + sube(k) * 70; ctx.globalAlpha = 0.75 * (1 - k); ctx.fillStyle = i % 2 ? '#e2e8f0' : '#cbd5e1'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 26 - k * 10, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
function destellos(ctx, x, y, k, n = 8, color = '#fde68a') { ctx.save(); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + k * 2; const r = 40 + sube(k) * 90; ctx.globalAlpha = 1 - k; ctx.fillStyle = i % 2 ? '#ffffff' : color; ctx.beginPath(); for (let j = 0; j < 8; j++) { const b = (j * Math.PI) / 4; const rr = j % 2 ? 3 : 9; ctx.lineTo(x + Math.cos(a) * r + Math.cos(b) * rr, y + Math.sin(a) * r + Math.sin(b) * rr); } ctx.closePath(); ctx.fill(); } ctx.restore(); }
function poseTruco(id, k) {
    const PI = Math.PI;
    if (id === 'saltar') { const ph = (k * 2) % 1; const aire = Math.sin(ph * PI); return { dy: -aire * 55, sy: aire < 0.15 ? 0.9 : 1.04, sx: aire < 0.15 ? 1.08 : 0.97 }; }
    if (id === 'vuelta') return { sx: Math.cos(k * PI * 4) || 0.02, dy: -Math.sin(k * PI) * 22, delante: (ctx) => destellos(ctx, 170, 205, k, 6, '#a5f3fc') };
    if (id === 'bailar') return { dx: Math.sin(k * PI * 4) * 30, rot: Math.sin(k * PI * 8) * 0.18, dy: -Math.abs(Math.sin(k * PI * 8)) * 12,
        delante: (ctx) => { for (let i = 0; i < 4; i++) { const q = (k * 1.6 + i / 4) % 1; nota(ctx, i % 2 ? '♪' : '♫', 70 + i * 66 + Math.sin(q * 6) * 10, 300 - q * 230, 1 - q, 30); } } };
    if (id === 'saludar') return { rot: Math.sin(k * PI * 6) * 0.12, dy: -Math.abs(Math.sin(k * PI * 6)) * 8,
        delante: (ctx) => { nota(ctx, '👋', 262 + Math.sin(k * PI * 6) * 8, 150, 1, 40, '#ffffff'); for (let i = 0; i < 3; i++) { const q = (k + i / 3) % 1; nota(ctx, '💖', 110 + i * 60, 260 - q * 180, 1 - q, 22, '#ffffff'); } } };
    if (id === 'voltereta') return { dy: -Math.sin(k * PI) * 75, rot: sube(k) * PI * 2, sy: k > 0.9 ? 0.92 : 1,
        detras: (ctx) => { if (k > 0.15 && k < 0.85) { ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(170, 205 - Math.sin(k * PI) * 75, 110, k * PI * 2 - 1.2, k * PI * 2); ctx.stroke(); ctx.restore(); } } };
    if (id === 'dormido') {
        if (k < 0.22) return { rot: -sube(k / 0.22) * 1.45, dy: sube(k / 0.22) * 30 };
        if (k < 0.78) return { rot: -1.45, dy: 30, humor: 'dormido', delante: (ctx) => { for (let i = 0; i < 3; i++) { const q = ((k - 0.22) * 2 + i / 3) % 1; nota(ctx, 'z', 230 + q * 40, 190 - q * 110, 1 - q, 20 + i * 6, '#e0e7ff'); } } };
        const q = (k - 0.78) / 0.22; return { rot: -1.45 * (1 - sube(q)), dy: 30 * (1 - sube(q)) - Math.sin(q * PI) * 40, delante: (ctx) => destellos(ctx, 170, 180, q, 8) };
    }
    if (id === 'magia') {
        const sombrero = (ctx, y) => nota(ctx, '🎩', 170, y, 1, 54, '#ffffff');
        if (k < 0.3) return { rot: Math.sin(k * PI * 6) * 0.05, delante: (ctx) => { nota(ctx, '🪄', 268, 170 + Math.sin(k * 20) * 6, 1, 40, '#ffffff'); destellos(ctx, 270, 160, (k * 3) % 1, 5); } };
        if (k < 0.42) { const q = (k - 0.3) / 0.12; return { alfa: 1 - q, sx: 1 - q * 0.4, sy: 1 + q * 0.2, delante: (ctx) => humo(ctx, 170, 220, q) }; }
        if (k < 0.7) { const q = (k - 0.42) / 0.28; return { alfa: 0, delante: (ctx) => { sombrero(ctx, 300 - Math.abs(Math.sin(q * PI * 3)) * 26); nota(ctx, '❓', 240, 160 + Math.sin(q * 10) * 4, 1, 30, '#ffffff'); } }; }
        if (k < 0.82) { const q = (k - 0.7) / 0.12; return { alfa: q, sy: 0.7 + q * 0.3, dy: (1 - q) * 30, delante: (ctx) => humo(ctx, 170, 220, q) }; }
        const q = (k - 0.82) / 0.18; return { dy: -Math.sin(q * PI) * 30, delante: (ctx) => { destellos(ctx, 170, 200, q, 10); nota(ctx, '✨', 120, 120, 1 - q, 34, '#ffffff'); nota(ctx, '✨', 230, 110, 1 - q, 28, '#ffffff'); } };
    }
    if (id === 'final') {
        const fuegos = (ctx) => { const cols = ['#f472b6', '#facc15', '#4ade80', '#60a5fa', '#a78bfa']; for (let b = 0; b < 3; b++) { const q = (k * 2.2 + b / 3) % 1; const cx = 70 + b * 110; const cy = 90 + (b % 2) * 50; ctx.save(); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const r = sube(q) * 60; ctx.globalAlpha = 1 - q; ctx.fillStyle = cols[(i + b) % cols.length]; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r + q * q * 20, 4.5 * (1 - q * 0.6), 0, Math.PI * 2); ctx.fill(); } ctx.restore(); } };
        return { dy: -Math.abs(Math.sin(k * PI * 2)) * 55, sx: Math.cos(k * PI * 4) || 0.02, rot: Math.sin(k * PI * 2) * 0.1, detras: fuegos, delante: (ctx) => { if (k > 0.85) nota(ctx, '🌟', 170, 95, (k - 0.85) / 0.15, 46, '#ffffff'); } };
    }
    return {};
}

async function tarjeta(d, efecto = null) {
    if (!A.listo()) return null;
    const propio = dibujoPropio(d, efecto);
    const img = propio || await A.imagenCompanero(d.id);
    const imgEfecto = efecto && EFECTOS[efecto] ? await A.imagen(EFECTOS[efecto]) : null;
    const HH = d.extra ? H + FRANJA : H;
    // 2.2.0: un truco: unos 1,7 s de animación y se queda en la última postura.
    if (efecto && efecto.startsWith('truco:')) {
        const TOTAL = 30; const frames = [];
        for (let f = 0; f < TOTAL; f++) {
            const { ctx } = A.lienzo(W, HH);
            await dibujar(ctx, d, f, TOTAL, efecto, null, img);
            frames.push({ ctx, delay: f === TOTAL - 1 ? 6000 : 55 });
        }
        return { buffer: await A.aGif(frames, W, HH), nombre: 'compi.gif' };
    }
    // Con dibujo propio, la tarjeta se mueve siempre (respira y parpadea, en bucle).
    if (propio && !imgEfecto) {
        const frames = [];
        for (let f = 0; f < 8; f++) {
            const { ctx } = A.lienzo(W, HH);
            await dibujar(ctx, d, f, 8, null, null, propio);
            frames.push({ ctx, delay: f === 6 ? 90 : 120 });
        }
        return { buffer: await A.aGif(frames, W, HH, { repetir: true }), nombre: 'compi.gif' };
    }
    if (!imgEfecto) {
        const { c, ctx } = A.lienzo(W, HH);
        await dibujar(ctx, d, 0, 1, null, null, img);
        return { buffer: c.toBuffer('image/png'), nombre: 'compi.png' };
    }
    const TOTAL = 18; const frames = [];
    for (let f = 0; f < TOTAL; f++) {
        const { ctx } = A.lienzo(W, HH);
        await dibujar(ctx, d, f, TOTAL, efecto, imgEfecto, img);
        frames.push({ ctx, delay: f === TOTAL - 1 ? 6000 : 70 });
    }
    return { buffer: await A.aGif(frames, W, HH), nombre: 'compi.gif' };
}

module.exports = { tarjeta, EFECTOS };

// ---------------------------------------------------------------------------
// 1.32.0: minijuegos (¿dónde está la golosina? y atrapa la pelota)
// ---------------------------------------------------------------------------
const MW = 640; const MH = 330;
const XV = [170, 320, 470];
function fondoJuego(ctx, color = '#1e1b4b') {
    const g = ctx.createLinearGradient(0, 0, 0, MH); g.addColorStop(0, '#0f172a'); g.addColorStop(1, color);
    A.redondeado(ctx, 0, 0, MW, MH, 22); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(148,163,184,0.12)'; ctx.fillRect(20, 262, MW - 40, 6);
}
function vaso(ctx, x, y, levantado = 0, n = null, resaltar = null) {
    const yy = y - levantado;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x - 46, yy + 50); ctx.lineTo(x - 34, yy - 40); ctx.quadraticCurveTo(x, yy - 52, x + 34, yy - 40); ctx.lineTo(x + 46, yy + 50); ctx.closePath();
    const g = ctx.createLinearGradient(x - 46, 0, x + 46, 0); g.addColorStop(0, '#be123c'); g.addColorStop(0.45, '#fb7185'); g.addColorStop(1, '#9f1239');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = resaltar || '#4c0519'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x - 40, yy + 10, 80, 8);
    if (n !== null) { ctx.fillStyle = '#fff'; ctx.font = `900 26px ${FUENTE}`; ctx.textAlign = 'center'; ctx.fillText(String(n), x, yy - 6); }
    ctx.restore();
}
function golosina(ctx, x, y) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.moveTo(-22, -8); ctx.lineTo(-34, -18); ctx.lineTo(-34, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(22, -8); ctx.lineTo(34, -18); ctx.lineTo(34, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -8, 22, 14, 0, 0, Math.PI * 2); ctx.fillStyle = '#facc15'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#a16207'; ctx.stroke();
    ctx.restore();
}
function mascotaJuego(ctx, d, humor, x, y, tam, f = 0) {
    const img = SPR.tiene(d.id) ? SPR.imagen(d.id, { etapa: SPR.etapaDe(d.nivel || 1), humor, variante: d.variante, acc: d.acc, t: (f % 8) / 8 }) : null;
    if (img) ctx.drawImage(img, x - tam / 2, y - tam / 2, tam, tam);
}
// GIF: la golosina se esconde y los vasos se cambian de sitio. Acaba con los vasos numerados.
async function gifVasos(d, partida) {
    if (!A.listo()) return null;
    const frames = [];
    const pos = [0, 1, 2]; // pos[vaso] = hueco
    const dibuja = (extra, delay) => { const { ctx } = A.lienzo(MW, MH); fondoJuego(ctx); mascotaJuego(ctx, d, 'feliz', 70, 140, 130, frames.length); extra(ctx); frames.push({ ctx, delay }); };
    // Enseña la golosina bajo el vaso de inicio y lo baja
    for (let i = 0; i <= 8; i++) {
        const lev = i < 4 ? 70 : 70 - (i - 3) * 14;
        dibuja((ctx) => { golosina(ctx, XV[partida.inicio], 256); XV.forEach((x, k) => vaso(ctx, x, 210, k === partida.inicio ? Math.max(0, lev) : 0)); }, i < 4 ? 220 : 60);
    }
    // Cambios
    const vasoEn = (h) => pos.indexOf(h);
    for (const [a, b] of partida.cambios) {
        const va = vasoEn(a); const vb = vasoEn(b);
        const PASOS = 7;
        for (let k = 1; k <= PASOS; k++) {
            const u = k / PASOS; const s = 0.5 - Math.cos(u * Math.PI) / 2;
            dibuja((ctx) => {
                for (let v = 0; v < 3; v++) {
                    let x = XV[pos[v]]; let y = 210;
                    if (v === va) { x = XV[a] + (XV[b] - XV[a]) * s; y = 210 - Math.sin(u * Math.PI) * 34; }
                    if (v === vb) { x = XV[b] + (XV[a] - XV[b]) * s; y = 210 + Math.sin(u * Math.PI) * 16; }
                    vaso(ctx, x, y);
                }
            }, 45);
        }
        pos[va] = b; pos[vb] = a;
    }
    dibuja((ctx) => { XV.forEach((x, k) => vaso(ctx, x, 210, 0, k + 1)); }, 60000);
    return A.aGif(frames, MW, MH);
}
// PNG del resultado: los vasos levantados, dónde estaba y la cara de tu compañero.
function resultadoVasos(d, eleccion, correcta) {
    if (!A.listo()) return null;
    const { c, ctx } = A.lienzo(MW, MH);
    fondoJuego(ctx, eleccion === correcta ? '#14532d' : '#450a0a');
    mascotaJuego(ctx, d, eleccion === correcta ? 'feliz' : 'aburrido', 70, 140, 130);
    golosina(ctx, XV[correcta], 256);
    XV.forEach((x, k) => vaso(ctx, x, 210, k === correcta || k === eleccion ? 80 : 0, k + 1, k === eleccion ? (eleccion === correcta ? '#22c55e' : '#ef4444') : null));
    return c.toBuffer('image/png');
}
// PNG para elegir hacia dónde lanzar la pelota.
function inicioPelota(d) {
    if (!A.listo()) return null;
    const { c, ctx } = A.lienzo(MW, MH);
    fondoJuego(ctx, '#0c4a6e');
    mascotaJuego(ctx, d, 'feliz', MW / 2, 190, 170);
    ctx.fillStyle = '#fff'; ctx.font = `900 40px ${FUENTE}`; ctx.textAlign = 'center';
    ['⬅️', '⬆️', '➡️'].forEach((e, i) => ctx.fillText(e, XV[i] - (i - 1) * 40, 60));
    return c.toBuffer('image/png');
}
// GIF: la pelota vuela hacia donde la lanzas y tu compañero salta hacia donde cree.
async function gifPelota(d, eleccion, correcta) {
    if (!A.listo()) return null;
    const frames = []; const N = 16;
    const atrapa = eleccion === correcta;
    const xs = [MW / 2 - 170, MW / 2, MW / 2 + 170];
    for (let i = 0; i <= N; i++) {
        const u = i / N; const { ctx } = A.lienzo(MW, MH);
        fondoJuego(ctx, '#0c4a6e');
        const mx = MW / 2 + (xs[correcta] - MW / 2) * Math.min(1, u * 1.4);
        const my = 190 - Math.sin(Math.min(1, u * 1.2) * Math.PI) * 60;
        mascotaJuego(ctx, d, i === N ? (atrapa ? 'feliz' : 'aburrido') : 'feliz', mx, my, 160, i);
        const bx = MW / 2 + (xs[eleccion] - MW / 2) * u; const by = 300 - Math.sin(u * Math.PI) * 240 + (atrapa ? 0 : u * 40);
        if (!(atrapa && i === N)) { ctx.beginPath(); ctx.arc(bx, Math.min(by, 290), 16, 0, Math.PI * 2); ctx.fillStyle = '#bef264'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#3f6212'; ctx.stroke(); curva2(ctx, bx, Math.min(by, 290)); }
        if (i === N) { ctx.fillStyle = atrapa ? '#4ade80' : '#fca5a5'; ctx.font = `900 34px ${FUENTE}`; ctx.textAlign = 'center'; ctx.fillText(atrapa ? '¡ATRAPADA!' : '¡UY!', MW / 2, 50); }
        frames.push({ ctx, delay: i === N ? 60000 : 55 });
    }
    return A.aGif(frames, MW, MH);
}
function curva2(ctx, x, y) { ctx.beginPath(); ctx.arc(x - 6, y, 12, -0.9, 0.9); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }

module.exports.gifVasos = gifVasos;
module.exports.resultadoVasos = resultadoVasos;
module.exports.inicioPelota = inicioPelota;
module.exports.gifPelota = gifPelota;
