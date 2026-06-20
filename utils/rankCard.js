// Generador de la "tarjeta de rango" con @napi-rs/canvas.
// - generarTarjeta: PNG (estilo premium estático o fondo genérico del tier gratis).
// - generarTarjetaAnimada: GIF (estilos premium animados).
// Carga perezosa de las librerías: si faltan, devuelve null y el bot usa un
// embed de texto en su lugar (no se rompe).
const path = require('path');
const { ESTILOS } = require('./cardStyles.js');
const { FUENTE } = require('./fonts.js');
let canvasLib = null;
let gifLib = null;
try { canvasLib = require('@napi-rs/canvas'); } catch { canvasLib = null; }
try { gifLib = require('gifenc'); } catch { gifLib = null; }

const W = 900;
const H = 270;
const FONDO = '#1e2030';
const BARRA_BG = '#2a2d40';
const TEXTO = '#ffffff';
const SUB = '#a9b0c0';
const FRAMES = 24;     // nº de fotogramas del GIF (más = más fluido)
const DELAY = 60;      // ms por fotograma (~1.4 s de bucle)

function resolverFondo(fondoImagen) {
    if (fondoImagen && fondoImagen.startsWith('/uploads/')) {
        return path.join(__dirname, '..', 'api', 'uploads', path.basename(fondoImagen));
    }
    return fondoImagen;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
const recorta = (s, n) => { s = String(s || ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

// Convierte nombres con letras "de fantasía" (𝕊𝕠𝕜𝕠, 𝓢𝓬𝓻𝓲𝓹𝓽, fullwidth, círculos,
// gótica...) a sus equivalentes normales para que la fuente pueda dibujarlas y
// no salgan rectángulos. NFKC cubre los bloques unicode estilizados habituales.
function nombreLegible(s) {
    s = String(s || '');
    try { s = s.normalize('NFKC'); } catch { /* normalize no disponible: se deja igual */ }
    return s;
}

// Dibuja UN fotograma. Síncrona: las imágenes llegan ya cargadas en `imgs`.
// fase ∈ [0,1). opts.estilo = id de estilo premium (o null para el tier gratis).
function dibujarTarjeta(ctx, opts, imgs, fase = 0) {
    const { fondoTipo = 'color', fondoColor = FONDO, colorSecundario = null,
        nombre, nivel, rank, xpActual, xpNecesaria, estilo: estiloId = null } = opts;
    const { avatar, bg } = imgs;
    const estilo = estiloId && ESTILOS[estiloId] ? ESTILOS[estiloId] : null;
    const acento = estilo ? estilo.acento : (opts.color || '#5865F2');

    // --- Fondo (recortado al borde redondeado) ---
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 30); ctx.clip();
    if (estilo) {
        estilo.fondo(ctx, W, H, fase);
    } else {
        let dibujado = false;
        if (fondoTipo === 'imagen' && bg) {
            const escala = Math.max(W / bg.width, H / bg.height);
            const dw = bg.width * escala, dh = bg.height * escala;
            ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
            ctx.fillStyle = 'rgba(18,20,32,0.55)'; ctx.fillRect(0, 0, W, H);
            dibujado = true;
        }
        if (!dibujado && fondoTipo === 'degradado' && colorSecundario) {
            const g = ctx.createLinearGradient(0, 0, W, H);
            g.addColorStop(0, fondoColor || FONDO); g.addColorStop(1, colorSecundario);
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); dibujado = true;
        }
        if (!dibujado) { ctx.fillStyle = fondoColor || FONDO; ctx.fillRect(0, 0, W, H); }
    }
    ctx.restore();

    // --- Borde de acento (el estilo puede traer el suyo, p.ej. neón pulsante) ---
    if (estilo && estilo.borde) {
        estilo.borde(ctx, W, H, fase, acento);
    } else {
        ctx.strokeStyle = acento; ctx.lineWidth = 6; roundRect(ctx, 3, 3, W - 6, H - 6, 28); ctx.stroke();
    }

    // --- Avatar circular ---
    const ax = 50, ay = 55, size = 160;
    if (avatar) {
        ctx.save();
        ctx.beginPath(); ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        ctx.drawImage(avatar, ax, ay, size, size);
        ctx.restore();
        ctx.strokeStyle = acento; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2); ctx.stroke();
    }

    // --- Textos (con sombra si el fondo es decorado, para legibilidad) ---
    ctx.save();
    if (estilo) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1; }
    const x = 250;
    ctx.textAlign = 'left';
    ctx.fillStyle = TEXTO; ctx.font = `bold 44px ${FUENTE}`;
    ctx.fillText(recorta(nombreLegible(nombre), 16), x, 95);

    ctx.textAlign = 'right';
    ctx.fillStyle = estilo ? '#e9ecf5' : SUB; ctx.font = `bold 28px ${FUENTE}`;
    ctx.fillText(`RANK #${rank}`, W - 50, 75);
    ctx.fillStyle = acento; ctx.font = `bold 40px ${FUENTE}`;
    ctx.fillText(`NIVEL ${nivel}`, W - 50, 120);
    ctx.textAlign = 'left';

    const bx = x, by = 150, bw = W - 50 - x, bh = 40;
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = estilo ? 'rgba(0,0,0,0.4)' : BARRA_BG; roundRect(ctx, bx, by, bw, bh, 20); ctx.fill();
    const pct = Math.max(0, Math.min(1, xpNecesaria ? xpActual / xpNecesaria : 0));
    if (pct > 0) { ctx.fillStyle = acento; roundRect(ctx, bx, by, Math.max(bh, bw * pct), bh, 20); ctx.fill(); }

    if (estilo) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; }
    ctx.fillStyle = estilo ? '#cdd3e0' : SUB; ctx.font = `24px ${FUENTE}`;
    ctx.fillText(`${xpActual} / ${xpNecesaria} XP`, x, 230);
    ctx.restore();

    // --- Capa por encima de todo (scanlines, viñeta...) ---
    if (estilo && estilo.overlay) {
        ctx.save(); roundRect(ctx, 0, 0, W, H, 30); ctx.clip();
        estilo.overlay(ctx, W, H, fase); ctx.restore();
    }
}

async function cargarImagenes(opts) {
    const { loadImage } = canvasLib;
    const imgs = { avatar: null, bg: null };
    if (opts.avatarURL) imgs.avatar = await loadImage(opts.avatarURL).catch(() => null);
    if (opts.fondoTipo === 'imagen' && opts.fondoImagen && !opts.estilo) {
        imgs.bg = await loadImage(resolverFondo(opts.fondoImagen)).catch(() => null);
    }
    return imgs;
}

// PNG. Devuelve un Buffer o null si no hay canvas.
async function generarTarjeta(opts) {
    if (!canvasLib) return null;
    try {
        const canvas = canvasLib.createCanvas(W, H);
        const ctx = canvas.getContext('2d');
        const imgs = await cargarImagenes(opts);
        dibujarTarjeta(ctx, opts, imgs, 0);
        return canvas.toBuffer('image/png');
    } catch (e) {
        console.error('Error generando tarjeta de rango:', e.message);
        return null;
    }
}

// GIF animado. Solo tiene sentido con un estilo `animado`. Buffer o null.
async function generarTarjetaAnimada(opts) {
    if (!canvasLib || !gifLib) return null;
    try {
        const { GIFEncoder, quantize, applyPalette } = gifLib;
        const canvas = canvasLib.createCanvas(W, H);
        const ctx = canvas.getContext('2d');
        const imgs = await cargarImagenes(opts);
        const gif = GIFEncoder();
        for (let i = 0; i < FRAMES; i++) {
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#0b0b14'; ctx.fillRect(0, 0, W, H); // backdrop de las esquinas
            dibujarTarjeta(ctx, opts, imgs, i / FRAMES);
            const { data } = ctx.getImageData(0, 0, W, H);
            const palette = quantize(data, 256);
            const index = applyPalette(data, palette);
            gif.writeFrame(index, W, H, { palette, delay: DELAY });
        }
        gif.finish();
        return Buffer.from(gif.bytes());
    } catch (e) {
        console.error('Error generando tarjeta animada:', e.message);
        return null;
    }
}

module.exports = { generarTarjeta, generarTarjetaAnimada, ESTILOS };
