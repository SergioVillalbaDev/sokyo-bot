// Dibujo de las cartas de anime (1.24.0): la carta (marco del color de su rareza, la foto del
// personaje, nombre, serie, su poder y estrellas; brillo holográfico de legendaria para arriba),
// la animación de abrir un sobre (tiembla, se rasga y salen 3 cartas que se dan la vuelta una a
// una) y el álbum. Usa los dibujos y la caché de fotos de utils/casinoArte.js.
const { FUENTE } = require('./fonts.js');
const K = require('./cofresNucleo.js');
const A = require('./casinoArte.js');
const SPR = require('./sprites.js');

const ARCOIRIS = ['#f472b6', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa'];

function lineas(ctx, texto, ancho, max = 2) {
    const out = []; let l = '';
    for (const p of String(texto).split(/\s+/)) {
        const prueba = l ? `${l} ${p}` : p;
        if (ctx.measureText(prueba).width > ancho && l) { out.push(l); l = p; } else l = prueba;
    }
    if (l) out.push(l);
    if (out.length > max) { out.length = max; out[max - 1] = `${out[max - 1].replace(/.$/, '')}…`; }
    return out;
}

// Dibuja la cara de una carta en (x, y) con tamaño (w, h). `brillo` (0-1) mueve el holográfico.
// 2.2.0: marco metálico del color de su rareza, nombre arriba como en las cartas de verdad, cinta
// con la serie sobre la foto, recuadro del poder, su técnica de combate y el número de colección.
const NUMERO = new Map([...K.ANIME.keys()].map((id, i) => [id, i + 1]));
function metal(ctx, x, y, w, h, color) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, SPR.aclarar(color, 0.45)); g.addColorStop(0.3, color); g.addColorStop(0.5, SPR.oscurecer(color, 0.45));
    g.addColorStop(0.7, color); g.addColorStop(1, SPR.aclarar(color, 0.35));
    return g;
}
function dibujarCarta(ctx, x, y, w, h, id, { estrellas = 1, img = null, idioma = 'es', brillo = 0.5, holo = false } = {}) {
    const d = K.def(id);
    const r = K.RAREZAS[d.rareza] || K.RAREZAS.comun;
    const divina = d.rareza === 'divina';
    const s = w / 200; // escala respecto a una carta de 200 × 300
    const en = idioma === 'en';
    ctx.save();
    // Marco
    A.redondeado(ctx, x, y, w, h, 14 * s);
    if (divina) { const g = ctx.createLinearGradient(x, y, x + w, y + h); ARCOIRIS.forEach((c, i) => g.addColorStop(i / (ARCOIRIS.length - 1), c)); ctx.fillStyle = g; } else ctx.fillStyle = metal(ctx, x, y, w, h, r.color);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.2 * s; A.redondeado(ctx, x + 2.5 * s, y + 2.5 * s, w - 5 * s, h - 5 * s, 12 * s); ctx.stroke();
    A.redondeado(ctx, x + 7 * s, y + 7 * s, w - 14 * s, h - 14 * s, 10 * s);
    const fondo = ctx.createLinearGradient(0, y, 0, y + h); fondo.addColorStop(0, '#111a33'); fondo.addColorStop(1, '#070b18');
    ctx.fillStyle = fondo; ctx.fill();
    // Cabecera: nombre y estrellas
    const nombre = String(en ? d.en || d.es : d.es);
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = `bold ${13.5 * s}px ${FUENTE}`;
    ctx.fillText(nombre.length > 22 ? `${nombre.slice(0, 21)}…` : nombre, x + 13 * s, y + 25 * s, w - 26 * s - 12 * s * Math.min(5, estrellas));
    ctx.textAlign = 'right'; ctx.fillStyle = '#fde047'; ctx.font = `bold ${11 * s}px ${FUENTE}`;
    ctx.fillText('★'.repeat(Math.max(1, Math.min(5, estrellas))), x + w - 12 * s, y + 24 * s);
    // Foto (retrato: se coge la parte de arriba)
    const fx = x + 11 * s; const fy = y + 33 * s; const fw = w - 22 * s; const fh = h * 0.5;
    ctx.save(); A.redondeado(ctx, fx, fy, fw, fh, 7 * s); ctx.clip();
    if (img) {
        const esc = Math.max(fw / img.width, fh / img.height);
        const iw = img.width * esc; const ih = img.height * esc;
        ctx.drawImage(img, fx + (fw - iw) / 2, fy - Math.max(0, (ih - fh) * 0.1), iw, ih);
    } else { const g = ctx.createLinearGradient(fx, fy, fx, fy + fh); g.addColorStop(0, '#1e293b'); g.addColorStop(1, '#0f172a'); ctx.fillStyle = g; ctx.fillRect(fx, fy, fw, fh); }
    // Sombra abajo de la foto y cinta con la serie
    const sb = ctx.createLinearGradient(0, fy + fh * 0.6, 0, fy + fh); sb.addColorStop(0, 'rgba(2,6,23,0)'); sb.addColorStop(1, 'rgba(2,6,23,0.85)');
    ctx.fillStyle = sb; ctx.fillRect(fx, fy + fh * 0.6, fw, fh * 0.4);
    if (d.serie) { ctx.fillStyle = '#e2e8f0'; ctx.font = `600 ${9 * s}px ${FUENTE}`; ctx.textAlign = 'left'; ctx.fillText(String(d.serie).slice(0, 34), fx + 7 * s, fy + fh - 7 * s, fw - 14 * s); }
    ctx.restore();
    ctx.strokeStyle = divina ? '#fde68a' : r.color; ctx.lineWidth = 2 * s; A.redondeado(ctx, fx, fy, fw, fh, 7 * s); ctx.stroke();
    // Poder
    if (d.poder) {
        const P = require('./compisNucleo.js');
        const py = fy + fh + 7 * s; const ph = y + h - 30 * s - py;
        A.redondeado(ctx, x + 11 * s, py, w - 22 * s, ph, 8 * s); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1 * s; ctx.stroke();
        const emoji = P.ARQUETIPOS[d.poder.tipo]?.emoji || '✨';
        ctx.fillStyle = `${r.color}33`; ctx.beginPath(); ctx.arc(x + 26 * s, py + 17 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = 'center'; ctx.font = `${12 * s}px ${FUENTE}`; ctx.fillStyle = '#ffffff'; ctx.fillText(emoji, x + 26 * s, py + 21.5 * s);
        ctx.textAlign = 'left'; ctx.fillStyle = r.color === '#9ca3af' ? '#e2e8f0' : divina ? '#fde68a' : SPR.aclarar(r.color, 0.25); ctx.font = `bold ${10.5 * s}px ${FUENTE}`;
        const titulo = lineas(ctx, en ? d.poder.en : d.poder.es, w - 62 * s, 2);
        titulo.forEach((l, i) => ctx.fillText(l, x + 42 * s, py + (titulo.length > 1 ? 13 : 20) * s + i * 12 * s));
        const e = P.efectoCarta(id, estrellas, null);
        if (e) {
            ctx.fillStyle = '#cbd5e1'; ctx.font = `${9 * s}px ${FUENTE}`; ctx.textAlign = 'center';
            const y0 = py + 41 * s; const hueco = Math.max(1, Math.floor((py + ph - 4 * s - y0) / (11 * s)) + 1);
            lineas(ctx, P.textoEfecto(e, idioma), w - 32 * s, Math.min(3, hueco)).forEach((l, i) => ctx.fillText(l, x + w / 2, y0 + i * 11 * s));
        }
    }
    // Pie: técnica de combate (izquierda) y número de colección (derecha)
    {
        const C = require('./combateNucleo.js');
        const tec = C.tecnicaDe(id, C.fuerzaCarta(id, estrellas, holo ? 0.05 : 0));
        const yp = y + h - 15 * s;
        ctx.textAlign = 'left'; ctx.fillStyle = '#fde68a'; ctx.font = `bold ${9.5 * s}px ${FUENTE}`;
        ctx.fillText(`⚔ ${en ? tec.en : tec.es}`, x + 13 * s, yp, w - 70 * s);
        ctx.textAlign = 'right'; ctx.fillStyle = '#94a3b8'; ctx.font = `bold ${9 * s}px ${FUENTE}`;
        ctx.fillText(`${r.emoji} #${String(NUMERO.get(id) || 0).padStart(3, '0')}`, x + w - 12 * s, yp);
    }
    // Holográfica (1.32.0): arcoíris que se mueve por toda la carta, destellos y la etiqueta HOLO.
    if (holo) {
        ctx.save(); A.redondeado(ctx, x, y, w, h, 14 * s); ctx.clip();
        ctx.globalCompositeOperation = 'overlay';
        const off = brillo * w * 2;
        const g = ctx.createLinearGradient(x - w + off, y, x + off, y + h);
        ARCOIRIS.concat(ARCOIRIS).forEach((c, i, arr) => g.addColorStop(i / (arr.length - 1), c));
        ctx.globalAlpha = 0.55; ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.9;
        for (let i = 0; i < 5; i++) { const px = x + ((i * 53 + brillo * 140) % (w - 20 * s)) + 10 * s; const py2 = y + 40 * s + ((i * 71) % (h * 0.45)); estrellita(ctx, px, py2, (3 + (i % 3) * 1.5) * s); }
        ctx.restore();
        ctx.save(); ctx.font = `900 ${9 * s}px ${FUENTE}`; ctx.textAlign = 'center';
        A.redondeado(ctx, x + w / 2 - 20 * s, fy + 5 * s, 40 * s, 14 * s, 7 * s);
        const g2 = ctx.createLinearGradient(x + w / 2 - 20 * s, 0, x + w / 2 + 20 * s, 0); ARCOIRIS.forEach((c, i) => g2.addColorStop(i / (ARCOIRIS.length - 1), c));
        ctx.fillStyle = g2; ctx.fill(); ctx.fillStyle = '#0f172a'; ctx.fillText('HOLO', x + w / 2, fy + 15.5 * s); ctx.restore();
    }
    // Legendaria, mítica y divina: una franja de luz que cruza la carta.
    if (r.orden >= 3) {
        ctx.save(); A.redondeado(ctx, x, y, w, h, 14 * s); ctx.clip();
        const bx = x - w + brillo * (w * 3);
        const g = ctx.createLinearGradient(bx, y, bx + w * 0.6, y + h);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, divina ? 'rgba(255,240,200,0.45)' : 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        ctx.restore();
    }
    ctx.restore();
}
function estrellita(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2; const rr = i % 2 ? r * 0.3 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
}

// Dorso de la carta (antes de darle la vuelta): rombos, emblema con estrella y «SOKYO».
function dibujarDorso(ctx, x, y, w, h, color) {
    const s = w / 200;
    ctx.save();
    A.redondeado(ctx, x, y, w, h, 14 * s);
    ctx.fillStyle = metal(ctx, x, y, w, h, '#a78bfa'); ctx.fill();
    A.redondeado(ctx, x + 7 * s, y + 7 * s, w - 14 * s, h - 14 * s, 10 * s);
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, color); g.addColorStop(1, '#0b1020');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(253,230,138,0.16)'; ctx.lineWidth = 1.2 * s;
    for (let i = -12; i < 24; i++) {
        ctx.beginPath(); ctx.moveTo(x + i * 18 * s, y); ctx.lineTo(x + i * 18 * s + h, y + h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + i * 18 * s, y); ctx.lineTo(x + i * 18 * s - h, y + h); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2 * s; A.redondeado(ctx, x + 13 * s, y + 13 * s, w - 26 * s, h - 26 * s, 8 * s); ctx.stroke();
    const cx = x + w / 2; const cy = y + h * 0.45;
    const e = ctx.createRadialGradient(cx, cy, 4 * s, cx, cy, 52 * s); e.addColorStop(0, 'rgba(253,230,138,0.55)'); e.addColorStop(1, 'rgba(253,230,138,0)');
    ctx.fillStyle = e; ctx.beginPath(); ctx.arc(cx, cy, 52 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.arc(cx, cy, 34 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8 - Math.PI / 2; const rr = i % 2 ? 11 * s : 28 * s; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.closePath(); const gs = ctx.createLinearGradient(cx, cy - 28 * s, cx, cy + 28 * s); gs.addColorStop(0, '#fef9c3'); gs.addColorStop(1, '#f59e0b'); ctx.fillStyle = gs; ctx.fill();
    ctx.fillStyle = '#fde68a'; ctx.textAlign = 'center'; ctx.font = `900 ${17 * s}px ${FUENTE}`;
    ctx.fillText('SOKYO', cx, y + h * 0.78);
    ctx.restore();
}

async function tarjetaCarta(id, { estrellas = 1, idioma = 'es', holo = false } = {}) {
    if (!A.listo()) return null;
    const img = await A.imagenCompanero(id);
    const W = 300; const H = 450;
    const { c, ctx } = A.lienzo(W, H);
    dibujarCarta(ctx, 0, 0, W, H, id, { estrellas, img, idioma, brillo: 0.45, holo });
    return c.toBuffer('image/png');
}

// Animación de abrir un sobre con sus cartas ([{ id, estrellas, quitada }]).
// 2.2.0: un sobre de papel metalizado que brilla y tiembla, se rasga por arriba con luz, las cartas
// suben de dentro y se abren en abanico; antes de girar, las épicas o mejores brillan del color de su
// rareza (para dar emoción) y al girarse las legendarias sueltan rayos (la divina, un destello arcoíris).
function dibujarSobre(ctx, cx, cy, color, emoji, nombre, sub, { brillo = 0, rasgado = 0, luz = 0 } = {}) {
    const PW = 230; const PH = 320; const x = cx - PW / 2; const y = cy - PH / 2;
    const corte = y + 34; // por donde se rasga
    const silueta = (desde, hasta) => {
        ctx.beginPath();
        const n = 16; const paso = PW / n;
        ctx.moveTo(x, desde === y ? y + 6 : desde);
        if (desde === y) for (let i = 0; i <= n; i++) ctx.lineTo(x + i * paso, y + (i % 2 ? 0 : 6)); else ctx.lineTo(x + PW, desde);
        if (hasta === y + PH) for (let i = n; i >= 0; i--) ctx.lineTo(x + i * paso, y + PH - (i % 2 ? 0 : 6)); else ctx.lineTo(x + PW, hasta), ctx.lineTo(x, hasta);
        ctx.closePath();
    };
    const pintar = (desde, hasta) => {
        silueta(desde, hasta);
        const g = ctx.createLinearGradient(x, y, x + PW, y + PH);
        g.addColorStop(0, SPR.aclarar(color, 0.35)); g.addColorStop(0.45, color); g.addColorStop(1, SPR.oscurecer(color, 0.6));
        ctx.fillStyle = g; ctx.fill();
        ctx.save(); ctx.clip();
        // Reflejo metalizado que cruza
        const bx = x - PW + brillo * PW * 3;
        const r = ctx.createLinearGradient(bx, y, bx + PW * 0.5, y + PH); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.5, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = r; ctx.fillRect(x, y, PW, PH);
        ctx.restore();
        ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3; ctx.stroke();
    };
    // Parte de abajo (el cuerpo) con su dibujo
    pintar(corte, y + PH);
    ctx.save(); ctx.textAlign = 'center';
    const e = ctx.createRadialGradient(cx, cy - 10, 5, cx, cy - 10, 80); e.addColorStop(0, 'rgba(255,255,255,0.35)'); e.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = e; ctx.beginPath(); ctx.arc(cx, cy - 10, 80, 0, Math.PI * 2); ctx.fill();
    ctx.font = `64px ${FUENTE}`; ctx.fillStyle = '#ffffff'; ctx.fillText(emoji, cx, cy + 8);
    ctx.font = `900 20px ${FUENTE}`; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(15,23,42,0.6)'; ctx.strokeText(nombre, cx, cy + 64, PW - 24); ctx.fillText(nombre, cx, cy + 64, PW - 24);
    ctx.font = `bold 12px ${FUENTE}`; ctx.fillStyle = '#fde68a'; ctx.fillText(sub, cx, cy + 88, PW - 24);
    ctx.restore();
    // Tira de arriba (se va al rasgarse)
    if (rasgado < 1) {
        ctx.save(); ctx.globalAlpha = 1 - rasgado;
        ctx.translate(cx + rasgado * 120, corte - rasgado * 140); ctx.rotate(rasgado * 0.7); ctx.translate(-cx, -corte);
        pintar(y, corte);
        ctx.restore();
    }
    // Luz que se escapa por el corte
    if (luz > 0) {
        ctx.save(); ctx.globalAlpha = Math.min(1, luz);
        const l = ctx.createRadialGradient(cx, corte, 4, cx, corte, 200); l.addColorStop(0, 'rgba(255,255,255,0.95)'); l.addColorStop(0.3, 'rgba(253,230,138,0.5)'); l.addColorStop(1, 'rgba(253,230,138,0)');
        ctx.fillStyle = l; ctx.fillRect(cx - 220, corte - 220, 440, 300);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 4, corte - 2, PW - 8, 4);
        ctx.restore();
    }
}
async function gifSobre(sobre, cartas, { idioma = 'es', color = '#8b5cf6', emoji = '🃏', nombre = null, sub: subtitulo = null } = {}) {
    if (!A.listo()) return null;
    const W = 720; const H = 440; const CW = 190; const CH = 285;
    const en = idioma === 'en';
    const def = require('./cartasNucleo.js').SOBRES[sobre];
    const nombrePack = nombre || (def ? (en ? def.en : def.es).toUpperCase() : (en ? 'CARD PACK' : 'SOBRE'));
    const imgs = await Promise.all(cartas.map((c) => (c.id ? A.imagenCompanero(c.id).catch(() => null) : null)));
    const huecos = cartas.map((_, i) => W / 2 - (cartas.length * CW + (cartas.length - 1) * 45) / 2 + i * (CW + 45));
    const Y = 70;
    // Fondo fijo (se pinta una vez)
    const { c: fondoC, ctx: fx } = A.lienzo(W, H);
    const fondo = fx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.75); fondo.addColorStop(0, SPR.oscurecer(color, 0.55)); fondo.addColorStop(1, '#020617');
    fx.fillStyle = fondo; fx.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) { fx.fillStyle = `rgba(226,232,240,${0.1 + ((i * 37) % 10) / 20})`; fx.beginPath(); fx.arc((i * 131) % W, (i * 71) % H, (i % 3) * 0.6 + 0.4, 0, Math.PI * 2); fx.fill(); }
    const frames = [];
    const cuadro = (pinta, delay) => { const { ctx } = A.lienzo(W, H); ctx.drawImage(fondoC, 0, 0); pinta(ctx); frames.push({ ctx, delay }); };
    const rz = (c) => (c.id ? K.RAREZAS[K.def(c.id).rareza] : K.RAREZAS.comun);
    const sub = subtitulo || (en ? `ANIME CARDS · ${cartas.length} CARDS` : `CARTAS ANIME · ${cartas.length} CARTAS`);
    // 1) El sobre brilla y tiembla cada vez más
    for (let f = 0; f < 10; f++) {
        const t = f < 4 ? 0 : (f % 2 ? 1 : -1) * (f - 3) * 1.6;
        cuadro((ctx) => { ctx.save(); ctx.translate(t, 0); ctx.translate(W / 2, H / 2 + 10); ctx.rotate(t * 0.008); ctx.translate(-W / 2, -H / 2 - 10); dibujarSobre(ctx, W / 2, H / 2 + 10, color, emoji, nombrePack, sub, { brillo: f / 9, luz: f >= 7 ? (f - 6) * 0.3 : 0 }); ctx.restore(); }, f < 4 ? 90 : 60);
    }
    // 2) Se rasga
    for (const k of [0.25, 0.55, 0.85, 1]) cuadro((ctx) => dibujarSobre(ctx, W / 2, H / 2 + 10, color, emoji, nombrePack, sub, { brillo: 1, rasgado: k, luz: 1 - k * 0.4 }), 55);
    // 3) Las cartas suben del sobre y se abren en abanico
    const pos = (i, k) => {
        const kk = A.facil(Math.max(0, Math.min(1, k)));
        const x0 = W / 2 - CW / 2; const y0 = H / 2 - 40;
        return { x: x0 + (huecos[i] - x0) * Math.max(0, (kk - 0.4) / 0.6), y: y0 + (Y - y0) * Math.min(1, kk / 0.55), rot: (i - (cartas.length - 1) / 2) * 0.12 * (1 - Math.max(0, (kk - 0.4) / 0.6)) };
    };
    for (let f = 1; f <= 7; f++) {
        const k = f / 7;
        cuadro((ctx) => {
            ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k * 1.3); ctx.translate(0, k * 140); dibujarSobre(ctx, W / 2, H / 2 + 10, color, emoji, nombrePack, sub, { rasgado: 1, luz: 0.6 * (1 - k) }); ctx.restore();
            cartas.forEach((_, i) => { const p = pos(i, k); ctx.save(); ctx.translate(p.x + CW / 2, p.y + CH / 2); ctx.rotate(p.rot); dibujarDorso(ctx, -CW / 2, -CH / 2, CW, CH, color); ctx.restore(); });
        }, 50);
    }
    // 4) Se giran una a una
    const estado = cartas.map(() => 0); // 0 dorso · 1 cara
    // Las caras que no se mueven (sin holo ni brillo de legendaria) se pintan una vez.
    const caras = cartas.map((c, i) => {
        if (!c.id || c.holo || rz(c).orden >= 3) return null;
        const { c: lz, ctx } = A.lienzo(CW, CH);
        dibujarCarta(ctx, 0, 0, CW, CH, c.id, { estrellas: c.estrellas, img: imgs[i], idioma });
        return lz;
    });
    const pintarCartas = (ctx, g, { girando = -1, giro = 0, aura = -1, auraK = 0, destello = -1, destK = 0 } = {}) => {
        cartas.forEach((c, i) => {
            const r = rz(c); const x = huecos[i]; const y = Y;
            const cx = x + CW / 2; const cy = y + CH / 2;
            // Rayos detrás de las legendarias (o mejores) ya giradas
            if (estado[i] && r.orden >= 3) {
                ctx.save(); ctx.globalAlpha = 0.25 + (destello === i ? 0.3 * (1 - destK) : 0);
                for (let a = 0; a < 14; a++) {
                    const ang = (a / 14) * Math.PI * 2 + g * 0.12;
                    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang - 0.08) * 260, cy + Math.sin(ang - 0.08) * 260); ctx.lineTo(cx + Math.cos(ang + 0.08) * 260, cy + Math.sin(ang + 0.08) * 260); ctx.closePath();
                    ctx.fillStyle = r === K.RAREZAS.divina ? ARCOIRIS[a % ARCOIRIS.length] : r.color; ctx.fill();
                }
                ctx.restore();
            }
            // Presagio: la carta aún boca abajo brilla del color de su rareza
            if (aura === i && r.orden >= 2) {
                ctx.save(); const R = 150 + 30 * Math.sin(auraK * Math.PI * 2);
                const gl = ctx.createRadialGradient(cx, cy, 20, cx, cy, R); gl.addColorStop(0, `${r === K.RAREZAS.divina ? '#fde68a' : r.color}cc`); gl.addColorStop(1, `${r.color}00`);
                ctx.fillStyle = gl; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); ctx.restore();
            }
            let escalaX = 1; let cara = !!estado[i];
            if (girando === i) { escalaX = Math.abs(Math.cos(giro * Math.PI)) || 0.03; cara = giro >= 0.5; }
            const sube2 = girando === i ? -Math.sin(giro * Math.PI) * 14 : 0;
            ctx.save(); ctx.translate(cx, y + sube2); ctx.scale(escalaX, 1);
            if (!cara) dibujarDorso(ctx, -CW / 2, 0, CW, CH, color);
            else if (c.quitada) {
                A.redondeado(ctx, -CW / 2, 0, CW, CH, 14); ctx.fillStyle = '#1f2937'; ctx.fill();
                ctx.fillStyle = '#fde047'; ctx.textAlign = 'center'; ctx.font = `900 40px ${FUENTE}`; ctx.fillText('🪙', 0, CH / 2);
                ctx.font = `bold 14px ${FUENTE}`; ctx.fillStyle = '#e2e8f0'; ctx.fillText(`+${c.devuelto}`, 0, CH / 2 + 30);
            } else if (caras[i]) ctx.drawImage(caras[i], -CW / 2, 0);
            else dibujarCarta(ctx, -CW / 2, 0, CW, CH, c.id, { estrellas: c.estrellas, img: imgs[i], idioma, brillo: ((g * 0.08) % 1.4), holo: !!c.holo });
            ctx.restore();
            if (estado[i] && !c.quitada) {
                const txt = c.nuevo ? (en ? 'NEW!' : '¡NUEVA!') : c.devuelto ? `★★★★★ +🪙${c.devuelto}` : '★'.repeat(c.estrellas);
                ctx.save(); ctx.font = `900 14px ${FUENTE}`; const tw = ctx.measureText(txt).width + 20;
                A.redondeado(ctx, cx - tw / 2, y + CH + 8, tw, 24, 12); ctx.fillStyle = c.nuevo ? '#16a34a' : 'rgba(2,6,23,0.8)'; ctx.fill();
                ctx.fillStyle = c.nuevo ? '#ffffff' : '#fde047'; ctx.textAlign = 'center'; ctx.fillText(txt, cx, y + CH + 25); ctx.restore();
            }
            if (destello === i && destK < 1) {
                ctx.save(); ctx.globalAlpha = 1 - destK;
                const gl = ctx.createRadialGradient(cx, cy, 10, cx, cy, 240); gl.addColorStop(0, '#ffffff'); gl.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = gl; ctx.fillRect(cx - 260, cy - 260, 520, 520); ctx.restore();
            }
        });
    };
    let g = 0;
    cartas.forEach((c, i) => {
        const r = rz(c);
        if (r.orden >= 2) for (let a = 0; a < 3; a++) cuadro((ctx) => pintarCartas(ctx, g++, { aura: i, auraK: a / 3 }), a === 2 ? 160 : 90);
        for (const k of [0.25, 0.5, 0.75, 1]) {
            if (k >= 0.5) estado[i] = 1;
            cuadro((ctx) => pintarCartas(ctx, g++, { girando: i, giro: k }), 55);
        }
        estado[i] = 1;
        if (r.orden >= 3) {
            for (const k of [0, 0.35, 0.7]) cuadro((ctx) => { pintarCartas(ctx, g++, { destello: i, destK: k }); if (r === K.RAREZAS.divina && k < 0.7) { ctx.save(); ctx.globalAlpha = 0.45 * (1 - k); const gg = ctx.createLinearGradient(0, 0, W, H); ARCOIRIS.forEach((cc, j) => gg.addColorStop(j / (ARCOIRIS.length - 1), cc)); ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H); ctx.restore(); } }, 60);
            cuadro((ctx) => pintarCartas(ctx, g++), 260);
        } else cuadro((ctx) => pintarCartas(ctx, g++), r.orden >= 2 ? 240 : 140);
    });
    // Brillo final (las holo y legendarias se siguen moviendo un poco) y se queda quieto
    for (let f = 0; f < 6; f++) cuadro((ctx) => pintarCartas(ctx, g++), 90);
    cuadro((ctx) => pintarCartas(ctx, g++), 9000);
    return A.aGif(frames, W, H);
}

// Álbum: las mejores cartas que tiene alguien (hasta 18), en cuadrícula.
async function album(cartas, { titulo = '', idioma = 'es' } = {}) {
    if (!A.listo()) return null;
    const lista = [...cartas].sort((a, b) => K.RAREZAS[K.def(b.id).rareza].orden - K.RAREZAS[K.def(a.id).rareza].orden || (b.estrellas || 1) - (a.estrellas || 1)).slice(0, 18);
    const cols = 6; const CW = 120; const CH = 180; const gap = 12;
    const filas = Math.max(1, Math.ceil(lista.length / cols));
    const W = 30 + cols * (CW + gap); const H = 80 + filas * (CH + gap) + 10;
    const { c, ctx } = A.lienzo(W, H);
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1e1b4b'); g.addColorStop(1, '#0f172a');
    A.redondeado(ctx, 0, 0, W, H, 22); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 24px ${FUENTE}`; ctx.textAlign = 'left'; ctx.fillText(titulo, 22, 48);
    const imgs = await Promise.all(lista.map((x) => A.imagenCompanero(x.id).catch(() => null)));
    lista.forEach((x, i) => {
        dibujarCarta(ctx, 20 + (i % cols) * (CW + gap), 66 + Math.floor(i / cols) * (CH + gap), CW, CH, x.id, { estrellas: x.estrellas || 1, img: imgs[i], idioma });
    });
    if (!lista.length) { ctx.fillStyle = '#94a3b8'; ctx.font = `18px ${FUENTE}`; ctx.fillText(idioma === 'en' ? 'No cards yet.' : 'Todavía no hay cartas.', 22, 120); }
    return c.toBuffer('image/png');
}


// 2.2.0: guía de las cartas (PNG 900×560): una carta de ejemplo con lo que es cada parte, cómo se
// consiguen y para qué sirven. Los textos llegan hechos (utils/cartas.js) para que coincidan con el bot.
async function guia({ titulo, partes, fuentes, usos, idioma = 'es', ejemplo = null }) {
    if (!A.listo()) return null;
    const W = 900; const H = 560;
    const { c, ctx } = A.lienzo(W, H);
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1e1b4b'); g.addColorStop(1, '#0b1020');
    A.redondeado(ctx, 0, 0, W, H, 24); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 3; A.redondeado(ctx, 1.5, 1.5, W - 3, H - 3, 23); ctx.stroke();
    const tx = (txt, x, y, { tam = 15, color = '#fff', peso = 'bold', alin = 'left', max } = {}) => { ctx.font = `${peso} ${tam}px ${FUENTE}`; ctx.textAlign = alin; ctx.fillStyle = color; ctx.fillText(txt, x, y, max); };
    tx(titulo, 30, 46, { tam: 26, peso: '900' });
    // Carta de ejemplo con sus partes señaladas
    const id = ejemplo && K.def(ejemplo) ? ejemplo : [...K.ANIME.keys()][0];
    const img = id ? await A.imagenCompanero(id).catch(() => null) : null;
    const CX = 30; const CY = 70; const CW = 240; const CH = 360;
    if (id) dibujarCarta(ctx, CX, CY, CW, CH, id, { estrellas: 3, img, idioma, brillo: 0.4 });
    const s = CW / 200;
    const puntos = [CY + 20 * s, CY + 33 * s + CH * 0.5 - 8 * s, CY + 33 * s + CH * 0.5 + 25 * s, CY + CH - 15 * s];
    (partes || []).slice(0, 4).forEach((p, i) => {
        const y = 110 + i * 82; const yp = puntos[i];
        ctx.strokeStyle = 'rgba(253,230,138,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(CX + CW - 6, yp); ctx.lineTo(CX + CW + 18, yp); ctx.lineTo(CX + CW + 30, y - 6); ctx.stroke();
        ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(CX + CW - 6, yp, 4, 0, Math.PI * 2); ctx.fill();
        tx(p[0], CX + CW + 36, y, { tam: 15, color: '#fde68a', max: 250 });
        tx(p[1], CX + CW + 36, y + 20, { tam: 12.5, color: '#cbd5e1', peso: 'normal', max: 250 });
        if (p[2]) tx(p[2], CX + CW + 36, y + 37, { tam: 12.5, color: '#cbd5e1', peso: 'normal', max: 250 });
    });
    // Cómo se consiguen
    const X = 600;
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; A.redondeado(ctx, X - 14, 66, W - X - 16, 384, 16); ctx.fill();
    tx(fuentes.titulo, X, 96, { tam: 17, color: '#86efac', peso: '900' });
    fuentes.lista.slice(0, 9).forEach((f, i) => {
        const y = 128 + i * 35;
        ctx.fillStyle = i === 0 ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.04)'; A.redondeado(ctx, X - 4, y - 20, W - X - 28, 30, 10); ctx.fill();
        tx(f[0], X + 6, y, { tam: 16, peso: 'normal' });
        tx(f[1], X + 36, y, { tam: 13.5, color: '#f1f5f9', max: W - X - 76 });
    });
    // Para qué sirven
    tx(usos.titulo, 30, 470, { tam: 17, color: '#c4b5fd', peso: '900' });
    const ancho = (W - 60 - 2 * 14) / 3;
    usos.lista.slice(0, 3).forEach((u, i) => {
        const x = 30 + i * (ancho + 14);
        ctx.fillStyle = 'rgba(139,92,246,0.16)'; A.redondeado(ctx, x, 484, ancho, 58, 14); ctx.fill();
        tx(u[0], x + 14, 518, { tam: 22, peso: 'normal' });
        tx(u[1], x + 50, 508, { tam: 14, max: ancho - 60 });
        tx(u[2], x + 50, 528, { tam: 12, color: '#cbd5e1', peso: 'normal', max: ancho - 60 });
    });
    return c.toBuffer('image/png');
}

module.exports = { dibujarCarta, dibujarDorso, tarjetaCarta, gifSobre, album, guia };
