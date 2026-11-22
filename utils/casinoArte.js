// Animaciones del casino y de los cofres (1.16.0), con @napi-rs/canvas + gifenc:
//   · tragaperras: los tres rodillos giran y paran uno a uno; si hay premio, brilla
//   · ruleta: la rueda gira, frena y el número ganador queda arriba
//   · moneda: la moneda da vueltas en el aire y cae
//   · cofre: tiembla, se ilumina subiendo de rareza, estalla y aparece el compañero
//   · mesa de blackjack (PNG): las cartas de la banca y las tuyas
// Los GIF no se repiten (se quedan en el resultado). Si falta alguna librería,
// devuelven null y el juego sigue con texto.
const fs = require('fs');
const path = require('path');
const { FUENTE } = require('./fonts.js');
const C = require('./casinoNucleo.js');
const K = require('./cofresNucleo.js');

let canvasLib = null; let gifLib = null;
try { canvasLib = require('@napi-rs/canvas'); } catch { canvasLib = null; }
try { gifLib = require('gifenc'); } catch { gifLib = null; }
const listo = () => !!(canvasLib && gifLib);

const DIR = path.join(__dirname, '..', 'assets', 'mascota');
const imagenes = new Map();
async function imagen(svg) {
    if (imagenes.has(svg)) return imagenes.get(svg);
    const ruta = path.join(DIR, `${svg}.svg`);
    const img = fs.existsSync(ruta) ? await canvasLib.loadImage(fs.readFileSync(ruta)).catch(() => null) : null;
    imagenes.set(svg, img);
    return img;
}

// Dibujo de un compañero: el de Twemoji o, si es de un servidor, la foto que subió el admin
// (solo de /uploads, nunca de internet). Las fotos se recortan en círculo al dibujarlas.
const UPLOADS = path.join(__dirname, '..', 'api', 'uploads');
async function imagenCompanero(id) {
    const d = K.def(id);
    if (d.svg) return imagen(d.svg);
    if (!d.imagen || !String(d.imagen).startsWith('/uploads/')) return imagen('2b50');
    const clave = `foto:${d.imagen}`;
    if (imagenes.has(clave)) return imagenes.get(clave);
    const ruta = path.join(UPLOADS, path.basename(d.imagen));
    const img = fs.existsSync(ruta) ? await canvasLib.loadImage(fs.readFileSync(ruta)).catch(() => null) : null;
    imagenes.set(clave, img);
    return img;
}
// Pinta el compañero en (x, y, tam). Las fotos van en círculo con borde.
function pintarCompanero(ctx, img, id, x, y, tam, borde = null) {
    if (!img) return;
    const d = K.def(id);
    if (d.svg) { ctx.drawImage(img, x, y, tam, tam); return; }
    ctx.save(); ctx.beginPath(); ctx.arc(x + tam / 2, y + tam / 2, tam / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    const lado = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, x, y, tam, tam);
    ctx.restore();
    if (borde) { ctx.beginPath(); ctx.arc(x + tam / 2, y + tam / 2, tam / 2, 0, Math.PI * 2); ctx.strokeStyle = borde; ctx.lineWidth = Math.max(2, tam / 30); ctx.stroke(); }
}

// Junta los fotogramas en un GIF que se reproduce una vez. frames: [{ ctx, delay }]
function aGif(frames, W, H) {
    const { GIFEncoder, quantize, applyPalette } = gifLib;
    const gif = GIFEncoder();
    frames.forEach((f, i) => {
        const data = f.ctx.getImageData(0, 0, W, H).data;
        const palette = quantize(data, 256);
        const index = applyPalette(data, palette);
        gif.writeFrame(index, W, H, { palette, delay: f.delay, ...(i === 0 ? { repeat: -1 } : {}) });
    });
    gif.finish();
    return Buffer.from(gif.bytes());
}
function lienzo(W, H) { const c = canvasLib.createCanvas(W, H); return { c, ctx: c.getContext('2d') }; }
function redondeado(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const facil = (t) => 1 - Math.pow(1 - t, 3);

// ---------------------------------------------------------------------------
// 🎰 Tragaperras
// ---------------------------------------------------------------------------
async function gifTragaperras(rodillos, { mult = 0, bote = false } = {}) {
    if (!listo()) return null;
    const W = 480; const H = 250;
    const sims = await Promise.all(C.SIMBOLOS.map((s) => imagen(s.svg)));
    const img = (id) => sims[C.SIMBOLOS.findIndex((s) => s.id === id)];
    // Tiras de cada rodillo: símbolos al azar y, al final, el que sale.
    const LARGO = 22;
    const tiras = rodillos.map((fin) => [...Array(LARGO - 1)].map(() => C.simboloAlAzar(Math.random)).concat(fin));
    const PARA = [11, 15, 19];
    const TOTAL = 30;
    const SY = 96; // alto de cada símbolo
    const frames = [];
    for (let f = 0; f < TOTAL; f++) {
        const { ctx } = lienzo(W, H);
        // Cuerpo de la máquina
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#7f1d1d'); g.addColorStop(1, '#3b0a0a');
        redondeado(ctx, 0, 0, W, H, 26); ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 6; redondeado(ctx, 3, 3, W - 6, H - 6, 24); ctx.stroke();
        // Luces del borde (se encienden por turnos)
        for (let i = 0; i < 14; i++) {
            const on = (i + f) % 3 === 0;
            ctx.fillStyle = on ? '#fde68a' : '#92400e';
            ctx.beginPath(); ctx.arc(24 + i * 33, 14, 5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(24 + i * 33, H - 14, 5, 0, Math.PI * 2); ctx.fill();
        }
        // Ventanas
        for (let r = 0; r < 3; r++) {
            const x = 38 + r * 140; const y = 40; const w = 124; const h = 150;
            redondeado(ctx, x, y, w, h, 16); ctx.fillStyle = '#fafaf9'; ctx.fill();
            ctx.save(); redondeado(ctx, x, y, w, h, 16); ctx.clip();
            const fin = LARGO - 1;
            let pos;
            if (f >= PARA[r]) {
                const tras = f - PARA[r];
                pos = fin + (tras === 0 ? 0.12 : tras === 1 ? -0.05 : 0); // rebote al parar
            } else {
                pos = fin - (PARA[r] - f) * 0.85;
            }
            const centro = y + h / 2;
            for (let k = Math.floor(pos) - 1; k <= Math.ceil(pos) + 1; k++) {
                if (k < 0 || k > fin) continue;
                const yy = centro + (k - pos) * SY;
                const im = img(tiras[r][k]);
                if (!im) continue;
                if (f < PARA[r]) { ctx.globalAlpha = 0.35; ctx.drawImage(im, x + 22, yy - 40 - 18, 80, 80); }
                ctx.globalAlpha = 1;
                ctx.drawImage(im, x + 22, yy - 40, 80, 80);
            }
            // Sombra arriba y abajo (efecto de tambor)
            const s = ctx.createLinearGradient(0, y, 0, y + h);
            s.addColorStop(0, 'rgba(0,0,0,0.45)'); s.addColorStop(0.25, 'rgba(0,0,0,0)'); s.addColorStop(0.75, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,0.45)');
            ctx.fillStyle = s; ctx.fillRect(x, y, w, h);
            ctx.restore();
        }
        // Línea de premio
        const fin = f >= PARA[2];
        const brilla = fin && mult > 0 && (f - PARA[2]) % 2 === 0;
        ctx.strokeStyle = brilla ? '#fde047' : 'rgba(251,191,36,0.55)';
        ctx.lineWidth = brilla ? 6 : 3;
        ctx.beginPath(); ctx.moveTo(26, 115); ctx.lineTo(W - 26, 115); ctx.stroke();
        if (fin && mult > 0) {
            ctx.font = `bold 34px ${FUENTE}`; ctx.textAlign = 'center';
            const texto = bote ? '💎 ¡BOTE! 💎' : `×${mult}`;
            ctx.lineWidth = 6; ctx.strokeStyle = '#7c2d12'; ctx.strokeText(texto, W / 2, 228);
            ctx.fillStyle = brilla ? '#fde047' : '#fff7ed'; ctx.fillText(texto, W / 2, 228);
        }
        frames.push({ ctx, delay: f === TOTAL - 1 ? 6000 : f < PARA[2] ? 70 : 160 });
    }
    return aGif(frames, W, H);
}

// ---------------------------------------------------------------------------
// 🎡 Ruleta
// ---------------------------------------------------------------------------
let ruedaCache = null;
function rueda(R) {
    if (ruedaCache) return ruedaCache;
    const { c, ctx } = lienzo(R * 2, R * 2);
    const n = C.ORDEN_RUEDA.length; const paso = (Math.PI * 2) / n;
    ctx.translate(R, R);
    for (let i = 0; i < n; i++) {
        const num = C.ORDEN_RUEDA[i];
        const a0 = i * paso - paso / 2 - Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R - 6, a0, a0 + paso); ctx.closePath();
        ctx.fillStyle = { verde: '#15803d', rojo: '#b91c1c', negro: '#111827' }[C.colorNumero(num)]; ctx.fill();
        ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.rotate(i * paso); ctx.fillStyle = '#ffffff'; ctx.font = `bold 15px ${FUENTE}`; ctx.textAlign = 'center';
        ctx.fillText(String(num), 0, -(R - 24)); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, R - 6, 0, Math.PI * 2); ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 6; ctx.stroke();
    const centro = ctx.createRadialGradient(0, 0, 4, 0, 0, R * 0.5);
    centro.addColorStop(0, '#78350f'); centro.addColorStop(1, '#451a03');
    ctx.beginPath(); ctx.arc(0, 0, R * 0.52, 0, Math.PI * 2); ctx.fillStyle = centro; ctx.fill();
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3; ctx.stroke();
    ruedaCache = c;
    return c;
}
async function gifRuleta(numero) {
    if (!listo()) return null;
    const W = 360; const H = 360; const R = 170;
    const r = rueda(R);
    const n = C.ORDEN_RUEDA.length; const paso = (Math.PI * 2) / n;
    const idx = C.ORDEN_RUEDA.indexOf(numero);
    const final = -idx * paso; // así el número queda arriba
    const inicio = final - Math.PI * 2 * 5;
    const TOTAL = 34;
    const frames = [];
    const color = { verde: '#16a34a', rojo: '#dc2626', negro: '#111827' }[C.colorNumero(numero)];
    for (let f = 0; f < TOTAL; f++) {
        const { ctx } = lienzo(W, H);
        ctx.fillStyle = '#0b3d2e'; ctx.fillRect(0, 0, W, H);
        const t = Math.min(1, f / (TOTAL - 6));
        const ang = inicio + (final - inicio) * facil(t);
        ctx.save(); ctx.translate(W / 2, H / 2 + 6); ctx.rotate(ang); ctx.drawImage(r, -R, -R); ctx.restore();
        // La bola, arriba del todo (gira con la rueda al principio y se asienta)
        const bolaY = H / 2 + 6 - (R - 24) - (t < 1 ? 10 * Math.abs(Math.sin(f * 1.3)) : 0);
        ctx.beginPath(); ctx.arc(W / 2, bolaY - 18, 8, 0, Math.PI * 2); ctx.fillStyle = '#f8fafc'; ctx.fill();
        // Flecha
        ctx.beginPath(); ctx.moveTo(W / 2 - 12, 2); ctx.lineTo(W / 2 + 12, 2); ctx.lineTo(W / 2, 22); ctx.closePath(); ctx.fillStyle = '#fbbf24'; ctx.fill();
        if (t >= 1) {
            ctx.beginPath(); ctx.arc(W / 2, H / 2 + 6, 58, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4; ctx.stroke();
            ctx.fillStyle = '#ffffff'; ctx.font = `bold 52px ${FUENTE}`; ctx.textAlign = 'center'; ctx.fillText(String(numero), W / 2, H / 2 + 25);
        }
        frames.push({ ctx, delay: f === TOTAL - 1 ? 6000 : t < 1 ? 60 + Math.round(90 * t * t) : 200 });
    }
    return aGif(frames, W, H);
}

// ---------------------------------------------------------------------------
// 🪙 Moneda
// ---------------------------------------------------------------------------
async function gifMoneda(resultado) {
    if (!listo()) return null;
    const W = 260; const H = 260;
    const [corona, estrella] = await Promise.all([imagen('1f451'), imagen('2b50')]);
    const TOTAL = 26; const vueltas = 5;
    const frames = [];
    for (let f = 0; f < TOTAL; f++) {
        const { ctx } = lienzo(W, H);
        const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W / 1.2);
        g.addColorStop(0, '#312e81'); g.addColorStop(1, '#0f172a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const t = Math.min(1, f / (TOTAL - 5));
        // Ángulo: varias vueltas y acaba mirando a la cara que toca.
        const finalAng = resultado === 'cara' ? 0 : Math.PI;
        const ang = finalAng + Math.PI * 2 * vueltas * (1 - facil(t));
        const esc = Math.cos(ang);
        const altura = Math.sin(Math.PI * Math.min(1, t * 1.05)) * 60;
        const cy = H / 2 + 10 - altura;
        // Sombra en el suelo
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(W / 2, H - 30, 60 - altura / 3, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(W / 2, cy); ctx.scale(Math.max(0.06, Math.abs(esc)), 1);
        const oro = ctx.createLinearGradient(-80, -80, 80, 80);
        oro.addColorStop(0, '#fde68a'); oro.addColorStop(0.5, '#f59e0b'); oro.addColorStop(1, '#b45309');
        ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.fillStyle = oro; ctx.fill();
        ctx.lineWidth = 6; ctx.strokeStyle = '#92400e'; ctx.stroke();
        const cara = esc >= 0;
        const im = cara ? corona : estrella;
        if (im) ctx.drawImage(im, -46, -46, 92, 92);
        ctx.restore();
        if (t >= 1) {
            ctx.fillStyle = '#ffffff'; ctx.font = `bold 30px ${FUENTE}`; ctx.textAlign = 'center';
            ctx.fillText(resultado === 'cara' ? '👑 CARA' : '⭐ CRUZ', W / 2, 36);
        }
        frames.push({ ctx, delay: f === TOTAL - 1 ? 6000 : t < 1 ? 55 : 150 });
    }
    return aGif(frames, W, H);
}

// ---------------------------------------------------------------------------
// 🃏 Mesa de blackjack (PNG)
// ---------------------------------------------------------------------------
function carta(ctx, x, y, c, oculta = false) {
    const w = 72; const h = 100;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    redondeado(ctx, x, y, w, h, 9); ctx.fillStyle = oculta ? '#1e3a8a' : '#ffffff'; ctx.fill();
    ctx.restore();
    if (oculta) {
        ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 2; redondeado(ctx, x + 6, y + 6, w - 12, h - 12, 6); ctx.stroke();
        ctx.fillStyle = '#93c5fd'; ctx.font = `bold 30px ${FUENTE}`; ctx.textAlign = 'center'; ctx.fillText('S', x + w / 2, y + h / 2 + 10);
        return;
    }
    const palo = c.slice(-1); const val = c.slice(0, -1);
    const rojo = palo === '♥' || palo === '♦';
    ctx.fillStyle = rojo ? '#dc2626' : '#111827';
    ctx.textAlign = 'left'; ctx.font = `bold 22px ${FUENTE}`; ctx.fillText(val, x + 8, y + 26);
    ctx.font = `20px ${FUENTE}`; ctx.fillText(palo, x + 8, y + 48);
    ctx.textAlign = 'center'; ctx.font = `40px ${FUENTE}`; ctx.fillText(palo, x + w / 2 + 6, y + h - 18);
}
function mesaBlackjack({ jugador, banca, ocultar = true, textos = {} }) {
    if (!canvasLib) return null;
    const W = 640; const H = 380;
    const { c, ctx } = lienzo(W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W / 1.4);
    g.addColorStop(0, '#15803d'); g.addColorStop(1, '#052e16');
    redondeado(ctx, 0, 0, W, H, 26); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = 10; redondeado(ctx, 5, 5, W - 10, H - 10, 22); ctx.stroke();
    ctx.strokeStyle = 'rgba(253,230,138,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, -260, 470, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(253,230,138,0.55)'; ctx.font = `bold 14px ${FUENTE}`; ctx.textAlign = 'center';
    ctx.fillText(textos.lema || 'BLACKJACK PAGA 3 A 2 · LA BANCA SE PLANTA EN 17', W / 2, H / 2 + 6);
    const fila = (mano, y, ocultarSegunda) => {
        const total = mano.length * 60 + 12;
        const x0 = W / 2 - total / 2;
        mano.forEach((cc, i) => carta(ctx, x0 + i * 60, y, cc, ocultarSegunda && i === 1));
    };
    fila(banca, 28, ocultar);
    fila(jugador, 236, false);
    ctx.fillStyle = '#fef3c7'; ctx.font = `bold 18px ${FUENTE}`; ctx.textAlign = 'left';
    const pb = ocultar ? `${C.valorCarta(banca[0])} + ?` : String(C.puntos(banca).total);
    ctx.fillText(`${textos.banca || 'Banca'}: ${pb}`, 24, 30 + 6);
    ctx.fillText(`${textos.tu || 'Tú'}: ${C.puntos(jugador).total}`, 24, 236 + 6);
    return c.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// 🎁 Cofre de mascotas
// ---------------------------------------------------------------------------
const ORDEN_RAREZAS = ['comun', 'rara', 'epica', 'legendaria', 'mitica', 'divina'];
function dibujarCofre(ctx, cx, cy, s, tapa = 0, color = '#a16207', brillo = null) {
    // Base
    ctx.save(); ctx.translate(cx, cy);
    if (brillo) { ctx.shadowColor = brillo; ctx.shadowBlur = 40; }
    redondeado(ctx, -70 * s, -10 * s, 140 * s, 80 * s, 10 * s); ctx.fillStyle = color; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(-70 * s, 20 * s, 140 * s, 10 * s);
    ctx.fillRect(-8 * s, -10 * s, 16 * s, 80 * s);
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = 3 * s; redondeado(ctx, -70 * s, -10 * s, 140 * s, 80 * s, 10 * s); ctx.stroke();
    // Tapa: al abrirse sube y se inclina hacia atrás (se ve más estrecha)
    ctx.save(); ctx.translate(0, -10 * s - tapa * 34 * s); ctx.scale(1, Math.max(0.18, 1 - tapa * 0.82));
    redondeado(ctx, -72 * s, -46 * s, 144 * s, 46 * s, 18 * s); ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(-8 * s, -46 * s, 16 * s, 46 * s);
    ctx.strokeStyle = '#78350f'; redondeado(ctx, -72 * s, -46 * s, 144 * s, 46 * s, 18 * s); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -8 * s, 9 * s, 0, Math.PI * 2); ctx.fillStyle = '#fde68a'; ctx.fill();
    ctx.restore();
    ctx.restore();
}
function rayos(ctx, cx, cy, n, largo, giro, colores, alfa = 0.6) {
    for (let i = 0; i < n; i++) {
        const a = giro + (i / n) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a - 0.08) * largo, cy + Math.sin(a - 0.08) * largo);
        ctx.lineTo(cx + Math.cos(a + 0.08) * largo, cy + Math.sin(a + 0.08) * largo);
        ctx.closePath();
        ctx.globalAlpha = alfa; ctx.fillStyle = colores[i % colores.length]; ctx.fill();
    }
    ctx.globalAlpha = 1;
}
async function gifCofre(cofre, companeroId, { nombre = '', rarezaTexto = '', estrellas = 1, nuevo = true } = {}) {
    if (!listo()) return null;
    const W = 420; const H = 360;
    const comp = K.def(companeroId);
    const rareza = K.RAREZAS[comp.rareza];
    const divina = comp.rareza === 'divina';
    const color = K.COFRES[cofre].color;
    const [bicho, brillo, corona] = await Promise.all([imagenCompanero(companeroId), imagen('2728'), imagen('1f451')]);
    const ARCOIRIS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6'];
    // Fases: tiembla (0-9), sube de rareza (10-19), estalla (20-23), aparece (24-35), queda (36…)
    const subeHasta = ORDEN_RAREZAS.indexOf(comp.rareza);
    const TOTAL = divina ? 52 : 40;
    const frames = [];
    for (let f = 0; f < TOTAL; f++) {
        const { ctx } = lienzo(W, H);
        const fondo = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W);
        fondo.addColorStop(0, '#1e1b4b'); fondo.addColorStop(1, '#020617');
        ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
        const cx = W / 2; const cy = H / 2 + 50;
        if (f < 10) {
            const temblor = (f % 2 ? 1 : -1) * (2 + f * 0.6);
            dibujarCofre(ctx, cx + temblor, cy, 1, 0, color);
        } else if (f < 20) {
            // La luz sube de rareza en rareza hasta la que toca (suspense).
            const paso = Math.min(subeHasta, Math.floor(((f - 10) / 9) * (subeHasta + 0.999)));
            const col = K.RAREZAS[ORDEN_RAREZAS[paso]].color;
            const g = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy - 20, 170);
            g.addColorStop(0, `${col}cc`); g.addColorStop(1, `${col}00`);
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            dibujarCofre(ctx, cx + (f % 2 ? 3 : -3), cy, 1, 0.08 * Math.sin(f), color, col);
        } else if (f < 24) {
            const k = (f - 20) / 3;
            const col = divina ? '#ffffff' : rareza.color;
            rayos(ctx, cx, cy - 30, 16, 400, f * 0.2, divina ? ARCOIRIS : [col, '#ffffff'], 0.5 + 0.3 * k);
            dibujarCofre(ctx, cx, cy, 1, Math.min(1, k + 0.2), color, col);
            ctx.globalAlpha = 0.85 * (1 - k * 0.6); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
        } else {
            const k = Math.min(1, (f - 24) / 8);
            const by = 190 - 40 * facil(k);
            rayos(ctx, cx, by, divina ? 22 : 14, 420, f * (divina ? 0.12 : 0.07), divina ? ARCOIRIS : [rareza.color, '#ffffff'], divina ? 0.55 : 0.35);
            dibujarCofre(ctx, cx, H - 70, 0.72, 1, color);
            const tam = 140 * facil(k) * (divina ? 1.15 : 1);
            if (divina) {
                const aura = ctx.createRadialGradient(cx, by, 10, cx, by, 130);
                aura.addColorStop(0, ARCOIRIS[f % ARCOIRIS.length] + 'cc'); aura.addColorStop(1, '#00000000');
                ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, by, 130, 0, Math.PI * 2); ctx.fill();
            }
            if (bicho && tam > 2) pintarCompanero(ctx, bicho, companeroId, cx - tam / 2, by - tam / 2, tam, rareza.color);
            if (divina && corona && k >= 1) ctx.drawImage(corona, cx - 36, by - tam / 2 - 46, 72, 72);
            // Destellos
            if (brillo && k >= 0.5) {
                const n = divina ? 8 : (rareza.orden >= 3 ? 5 : 3);
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * Math.PI * 2 + f * 0.3;
                    const rr = 110 + 18 * Math.sin(f * 0.7 + i);
                    const s = 22 + 10 * Math.sin(f + i);
                    ctx.drawImage(brillo, cx + Math.cos(a) * rr - s / 2, by + Math.sin(a) * rr * 0.7 - s / 2, s, s);
                }
            }
            if (k >= 1) {
                // Cartel con el nombre y la rareza
                redondeado(ctx, 20, 12, W - 40, 58, 16); ctx.fillStyle = 'rgba(2,6,23,0.85)'; ctx.fill();
                ctx.strokeStyle = divina ? ARCOIRIS[f % ARCOIRIS.length] : rareza.color; ctx.lineWidth = 3; ctx.stroke();
                ctx.textAlign = 'center';
                ctx.fillStyle = divina ? ARCOIRIS[(f + 3) % ARCOIRIS.length] : rareza.color;
                ctx.font = `bold 16px ${FUENTE}`;
                ctx.fillText(`${rarezaTexto || rareza.es.toUpperCase()}${nuevo ? '' : `  ${'★'.repeat(estrellas)}`}`, W / 2, 36);
                ctx.fillStyle = '#ffffff'; ctx.font = `bold 21px ${FUENTE}`;
                ctx.fillText((nombre || comp.es).slice(0, 30), W / 2, 61);
            }
        }
        const ultimo = f === TOTAL - 1;
        frames.push({ ctx, delay: ultimo ? 8000 : f < 10 ? 70 : f < 20 ? 110 + (f - 10) * 12 : f < 24 ? 70 : 80 });
    }
    return aGif(frames, W, H);
}

// Tarjeta (PNG) de la colección de alguien: sus compañeros por rareza.
async function tarjetaColeccion(coleccion, { titulo = '' } = {}) {
    if (!canvasLib) return null;
    // Los del catálogo y, al final, los de servidores que tenga.
    const ids = [...Object.keys(K.COMPANEROS), ...(coleccion.mascotas || []).map((m) => m.id).filter((id) => K.esPersonalizado(id))];
    const W = 760; const cols = 8; const celda = 88;
    const filas = Math.ceil(ids.length / cols);
    const H = 90 + filas * (celda + 14) + 20;
    const { c, ctx } = lienzo(W, H);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1e1b4b'); g.addColorStop(1, '#0f172a');
    redondeado(ctx, 0, 0, W, H, 24); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 28px ${FUENTE}`; ctx.textAlign = 'left';
    const tiene = new Map((coleccion.mascotas || []).map((m) => [m.id, m]));
    ctx.fillText(titulo || `Colección · ${tiene.size}/${ids.length}`, 28, 52);
    const orden = [...ids].sort((a, b) => (K.esPersonalizado(a) - K.esPersonalizado(b)) || (K.RAREZAS[K.def(a).rareza].orden - K.RAREZAS[K.def(b).rareza].orden));
    for (let i = 0; i < orden.length; i++) {
        const id = orden[i]; const comp = K.def(id); const r = K.RAREZAS[comp.rareza];
        const x = 28 + (i % cols) * (celda + 2); const y = 76 + Math.floor(i / cols) * (celda + 14);
        redondeado(ctx, x, y, celda - 6, celda, 14); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
        ctx.strokeStyle = tiene.has(id) ? r.color : 'rgba(255,255,255,0.12)'; ctx.lineWidth = tiene.has(id) ? 3 : 1.5; ctx.stroke();
        const im = await imagenCompanero(id);
        if (im) {
            if (!tiene.has(id)) { ctx.globalAlpha = 0.12; }
            pintarCompanero(ctx, im, id, x + 13, y + 8, 56);
            ctx.globalAlpha = 1;
        }
        if (!tiene.has(id)) { ctx.fillStyle = '#94a3b8'; ctx.font = `bold 26px ${FUENTE}`; ctx.textAlign = 'center'; ctx.fillText('?', x + (celda - 6) / 2, y + 46); }
        if (tiene.has(id)) {
            ctx.fillStyle = '#fde047'; ctx.font = `bold 13px ${FUENTE}`; ctx.textAlign = 'center';
            ctx.fillText('★'.repeat(tiene.get(id).estrellas || 1), x + (celda - 6) / 2, y + celda - 8);
        }
        if (coleccion.equipada === id) { ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(x + celda - 14, y + 8, 7, 0, Math.PI * 2); ctx.fill(); }
    }
    return c.toBuffer('image/png');
}

module.exports = { gifTragaperras, gifRuleta, gifMoneda, mesaBlackjack, gifCofre, tarjetaColeccion, listo, imagen, imagenCompanero, pintarCompanero, lienzo, redondeado, aGif, facil };
