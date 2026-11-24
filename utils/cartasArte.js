// Dibujo de las cartas de anime (1.24.0): la carta (marco del color de su rareza, la foto del
// personaje, nombre, serie, su poder y estrellas; brillo holográfico de legendaria para arriba),
// la animación de abrir un sobre (tiembla, se rasga y salen 3 cartas que se dan la vuelta una a
// una) y el álbum. Usa los dibujos y la caché de fotos de utils/casinoArte.js.
const { FUENTE } = require('./fonts.js');
const K = require('./cofresNucleo.js');
const A = require('./casinoArte.js');

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
function dibujarCarta(ctx, x, y, w, h, id, { estrellas = 1, img = null, idioma = 'es', brillo = 0.5, holo = false } = {}) {
    const d = K.def(id);
    const r = K.RAREZAS[d.rareza] || K.RAREZAS.comun;
    const divina = d.rareza === 'divina';
    const s = w / 200; // escala respecto a una carta de 200 px
    ctx.save();
    // Marco
    const marco = ctx.createLinearGradient(x, y, x + w, y + h);
    if (divina) ARCOIRIS.forEach((c, i) => marco.addColorStop(i / (ARCOIRIS.length - 1), c));
    else { marco.addColorStop(0, r.color); marco.addColorStop(1, '#0f172a'); }
    A.redondeado(ctx, x, y, w, h, 14 * s); ctx.fillStyle = marco; ctx.fill();
    A.redondeado(ctx, x + 6 * s, y + 6 * s, w - 12 * s, h - 12 * s, 10 * s); ctx.fillStyle = '#0b1020'; ctx.fill();
    // Foto (retrato: se coge la parte de arriba)
    const fx = x + 10 * s; const fy = y + 30 * s; const fw = w - 20 * s; const fh = h * 0.52;
    ctx.save(); A.redondeado(ctx, fx, fy, fw, fh, 8 * s); ctx.clip();
    if (img) {
        const esc = Math.max(fw / img.width, fh / img.height);
        const iw = img.width * esc; const ih = img.height * esc;
        ctx.drawImage(img, fx + (fw - iw) / 2, fy - Math.max(0, (ih - fh) * 0.1), iw, ih);
    } else { ctx.fillStyle = '#1e293b'; ctx.fillRect(fx, fy, fw, fh); }
    ctx.restore();
    ctx.strokeStyle = r.color; ctx.lineWidth = 2 * s; A.redondeado(ctx, fx, fy, fw, fh, 8 * s); ctx.stroke();
    // Rareza (arriba) y estrellas
    ctx.textAlign = 'left'; ctx.font = `bold ${11 * s}px ${FUENTE}`;
    ctx.fillStyle = divina ? '#fde68a' : r.color;
    ctx.fillText(`${r.emoji} ${(idioma === 'en' ? r.en : r.es).toUpperCase()}`, x + 12 * s, y + 22 * s);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fde047';
    ctx.fillText('★'.repeat(Math.max(1, estrellas)), x + w - 12 * s, y + 22 * s);
    // Nombre y serie
    const ny = fy + fh + 20 * s;
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = `bold ${15 * s}px ${FUENTE}`;
    ctx.fillText(String(d.es).slice(0, 24), x + w / 2, ny);
    ctx.fillStyle = '#94a3b8'; ctx.font = `${10 * s}px ${FUENTE}`;
    ctx.fillText(String(d.serie || '').slice(0, 34), x + w / 2, ny + 14 * s);
    // Poder
    if (d.poder) {
        const P = require('./compisNucleo.js');
        const py = ny + 22 * s;
        A.redondeado(ctx, x + 10 * s, py, w - 20 * s, h - (py - y) - 12 * s, 8 * s); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
        ctx.fillStyle = r.color === '#9ca3af' ? '#e2e8f0' : r.color; ctx.font = `bold ${11 * s}px ${FUENTE}`;
        const emoji = P.ARQUETIPOS[d.poder.tipo]?.emoji || '✨';
        lineas(ctx, `${emoji} ${idioma === 'en' ? d.poder.en : d.poder.es}`, w - 28 * s, 2).forEach((l, i) => ctx.fillText(l, x + w / 2, py + 15 * s + i * 13 * s));
        const e = P.efectoCarta(id, estrellas, null);
        if (e) {
            ctx.fillStyle = '#cbd5e1'; ctx.font = `${9.5 * s}px ${FUENTE}`;
            const hueco = Math.max(1, Math.floor((y + h - 14 * s - (py + 44 * s)) / (12 * s)) + 1);
            lineas(ctx, P.textoEfecto(e, idioma), w - 28 * s, Math.min(3, hueco)).forEach((l, i) => ctx.fillText(l, x + w / 2, py + 44 * s + i * 12 * s));
        }
    }
    // 1.32.0: la técnica de combate, en una pastilla sobre la foto.
    {
        const C = require('./combateNucleo.js');
        const tec = C.tecnicaDe(id, C.fuerzaCarta(id, estrellas, holo ? 0.05 : 0));
        const txt = `⚔ ${idioma === 'en' ? tec.en : tec.es}`;
        ctx.font = `bold ${10 * s}px ${FUENTE}`;
        const tw = Math.min(fw - 8 * s, ctx.measureText(txt).width + 14 * s);
        A.redondeado(ctx, x + w / 2 - tw / 2, fy + fh - 20 * s, tw, 16 * s, 8 * s); ctx.fillStyle = 'rgba(2,6,23,0.82)'; ctx.fill();
        ctx.fillStyle = '#fde68a'; ctx.textAlign = 'center'; ctx.fillText(txt, x + w / 2, fy + fh - 8.5 * s, tw - 8 * s);
    }
    // Holográfica (1.32.0): arcoíris que se mueve por toda la carta y la etiqueta HOLO.
    if (holo) {
        ctx.save(); A.redondeado(ctx, x, y, w, h, 14 * s); ctx.clip();
        ctx.globalCompositeOperation = 'overlay';
        const off = brillo * w * 2;
        const g = ctx.createLinearGradient(x - w + off, y, x + off, y + h);
        ARCOIRIS.concat(ARCOIRIS).forEach((c, i, arr) => g.addColorStop(i / (arr.length - 1), c));
        ctx.globalAlpha = 0.55; ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        ctx.restore();
        ctx.save(); ctx.font = `900 ${10 * s}px ${FUENTE}`; ctx.textAlign = 'center';
        A.redondeado(ctx, x + w / 2 - 22 * s, y + 9 * s, 44 * s, 16 * s, 8 * s);
        const g2 = ctx.createLinearGradient(x + w / 2 - 22 * s, 0, x + w / 2 + 22 * s, 0); ARCOIRIS.forEach((c, i) => g2.addColorStop(i / (ARCOIRIS.length - 1), c));
        ctx.fillStyle = g2; ctx.fill(); ctx.fillStyle = '#0f172a'; ctx.fillText('HOLO', x + w / 2, y + 21 * s); ctx.restore();
    }
    // Holográfico (legendaria, mítica, divina): una franja de luz que cruza la carta.
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

// Dorso de la carta (antes de darle la vuelta).
function dibujarDorso(ctx, x, y, w, h, color) {
    const s = w / 200;
    A.redondeado(ctx, x, y, w, h, 14 * s);
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, color); g.addColorStop(1, '#111827');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3 * s; A.redondeado(ctx, x + 8 * s, y + 8 * s, w - 16 * s, h - 16 * s, 10 * s); ctx.stroke();
    ctx.fillStyle = '#fde68a'; ctx.textAlign = 'center'; ctx.font = `900 ${34 * s}px ${FUENTE}`; ctx.fillText('S', x + w / 2, y + h / 2 + 12 * s);
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
async function gifSobre(sobre, cartas, { idioma = 'es', color = '#8b5cf6', emoji = '🃏' } = {}) {
    if (!A.listo()) return null;
    const W = 720; const H = 440; const CW = 190; const CH = 285;
    const imgs = await Promise.all(cartas.map((c) => (c.id ? A.imagenCompanero(c.id).catch(() => null) : null)));
    const huecos = cartas.map((_, i) => 40 + i * (CW + 45));
    const TOTAL = 12 + 8 + cartas.length * 7 + 6;
    const frames = [];
    for (let f = 0; f < TOTAL; f++) {
        const { ctx } = A.lienzo(W, H);
        const fondo = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W);
        fondo.addColorStop(0, '#1e1b4b'); fondo.addColorStop(1, '#020617');
        ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
        if (f < 12) {
            // El sobre tiembla cada vez más y al final se rasga con un destello.
            const t = (f % 2 ? 1 : -1) * (1 + f * 0.8);
            ctx.save(); ctx.translate(W / 2 + t, H / 2); ctx.rotate(t * 0.01);
            A.redondeado(ctx, -110, -150, 220, 300, 18);
            const g = ctx.createLinearGradient(-110, -150, 110, 150); g.addColorStop(0, color); g.addColorStop(1, '#0f172a');
            ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 4; ctx.stroke();
            ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = `900 54px ${FUENTE}`; ctx.fillText(emoji, 0, 10);
            ctx.font = `bold 18px ${FUENTE}`; ctx.fillText(idioma === 'en' ? 'ANIME CARDS' : 'CARTAS ANIME', 0, 70);
            if (f >= 9) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(-120, -160 + (f - 9) * 8, 240, 6); }
            ctx.restore();
            if (f === 11) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(0, 0, W, H); }
            frames.push({ ctx, delay: f < 9 ? 80 : 60 });
            continue;
        }
        const g = f - 12;
        const pos = (i) => {
            const k = Math.min(1, g / 8); const fac = 1 - Math.pow(1 - k, 3);
            return { x: W / 2 - CW / 2 + (huecos[i] - (W / 2 - CW / 2)) * fac, y: 80 + (1 - fac) * 40, p: (g - (8 + i * 7)) / 5 };
        };
        // Primero los rayos de las cartas raras (detrás de todas las cartas)
        cartas.forEach((c, i) => {
            const d = c.id ? K.def(c.id) : null;
            const rz = d ? K.RAREZAS[d.rareza] : K.RAREZAS.comun;
            const { x, y, p } = pos(i);
            if (rz.orden < 3 || p <= 0.6) return;
            const cx = x + CW / 2; const cy = y + CH / 2;
            for (let a = 0; a < 12; a++) {
                const ang = a / 12 * Math.PI * 2 + g * 0.15;
                ctx.beginPath(); ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(ang - 0.08) * 230, cy + Math.sin(ang - 0.08) * 230);
                ctx.lineTo(cx + Math.cos(ang + 0.08) * 230, cy + Math.sin(ang + 0.08) * 230);
                ctx.closePath(); ctx.globalAlpha = 0.22; ctx.fillStyle = d?.rareza === 'divina' ? ARCOIRIS[a % ARCOIRIS.length] : rz.color; ctx.fill();
            }
            ctx.globalAlpha = 1;
        });
        cartas.forEach((c, i) => {
            // Salen volando desde el centro y se dan la vuelta por turnos
            const { x, y, p } = pos(i);
            const escalaX = p <= 0 ? 1 : p < 0.5 ? 1 - p * 2 : p < 1 ? (p - 0.5) * 2 : 1;
            ctx.save(); ctx.translate(x + CW / 2, y); ctx.scale(Math.max(0.02, escalaX), 1);
            if (p < 0.5) dibujarDorso(ctx, -CW / 2, 0, CW, CH, color);
            else if (c.quitada) {
                A.redondeado(ctx, -CW / 2, 0, CW, CH, 14); ctx.fillStyle = '#1f2937'; ctx.fill();
                ctx.fillStyle = '#fde047'; ctx.textAlign = 'center'; ctx.font = `900 40px ${FUENTE}`; ctx.fillText('🪙', 0, CH / 2);
                ctx.font = `bold 14px ${FUENTE}`; ctx.fillStyle = '#e2e8f0'; ctx.fillText(`+${c.devuelto}`, 0, CH / 2 + 30);
            } else dibujarCarta(ctx, -CW / 2, 0, CW, CH, c.id, { estrellas: c.estrellas, img: imgs[i], idioma, brillo: ((g * 0.08) % 1.4), holo: !!c.holo });
            ctx.restore();
            if (p >= 1 && c.nuevo) { ctx.fillStyle = '#22c55e'; ctx.textAlign = 'center'; ctx.font = `bold 14px ${FUENTE}`; ctx.fillText(idioma === 'en' ? 'NEW!' : '¡NUEVA!', x + CW / 2, y + CH + 22); }
            else if (p >= 1 && !c.quitada) { ctx.fillStyle = '#fde047'; ctx.textAlign = 'center'; ctx.font = `bold 14px ${FUENTE}`; ctx.fillText(`★`.repeat(c.estrellas), x + CW / 2, y + CH + 22); }
        });
        const ultimo = f === TOTAL - 1;
        frames.push({ ctx, delay: ultimo ? 9000 : 85 });
    }
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

module.exports = { dibujarCarta, tarjetaCarta, gifSobre, album };
