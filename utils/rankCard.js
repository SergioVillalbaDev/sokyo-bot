// Generador de la "tarjeta de rango" con @napi-rs/canvas.
// - generarTarjeta: PNG (estilo premium estático o fondo genérico del tier gratis).
// - generarTarjetaAnimada: GIF (estilos premium animados, o un fondo que es un GIF).
// Fondo con imagen o GIF: `fondoImagen` (/uploads/… o https) y, si se ajustó en el
// panel, `encuadre` (cómo se movió, amplió y giró: ver encuadreValido).
// Carga perezosa de las librerías: si faltan, devuelve null y el bot usa un
// embed de texto en su lugar (no se rompe).
const path = require('path');
const { ESTILOS } = require('./cardStyles.js');
const { FUENTE } = require('./fonts.js');
const { t } = require('./i18n.js');
const fs = require('fs');
let canvasLib = null;
let gifLib = null;
let gifLector = null;
try { canvasLib = require('@napi-rs/canvas'); } catch { canvasLib = null; }
try { gifLib = require('gifenc'); } catch { gifLib = null; }
try { gifLector = require('omggif'); } catch { gifLector = null; }

const W = 900;
const H = 270;
const FONDO = '#1e2030';
const BARRA_BG = '#2a2d40';
const TEXTO = '#ffffff';
const SUB = '#a9b0c0';
const FRAMES = 24;     // nº de fotogramas del GIF (más = más fluido)
const DELAY = 60;      // ms por fotograma (~1.4 s de bucle)
const MAX_FRAMES_FONDO = 24;            // fotogramas como mucho de un fondo GIF
const ANCHO_FRAME_MAX = W;              // se guardan como mucho al ancho de la tarjeta (memoria de la Pi)
const MAX_PIXELES_GIF = 40 * 1000 * 1000; // ancho × alto × fotogramas: más, solo el primero

function resolverFondo(fondoImagen) {
    if (fondoImagen && fondoImagen.startsWith('/uploads/')) {
        return path.join(__dirname, '..', 'api', 'uploads', path.basename(fondoImagen));
    }
    return fondoImagen;
}

// Encuadre de un fondo, tal y como se ajusta en el panel (lib/recorte.js): el ancho de
// la tarjeta vale 1; `escala` = unidades de tarjeta por píxel de la imagen; (x, y) =
// cuánto se movió el centro; `giro` en grados. null si no hay o no vale.
function encuadreValido(e) {
    if (!e || typeof e !== 'object') return null;
    const escala = Number(e.escala);
    const x = Number(e.x);
    const y = Number(e.y);
    if (!(escala > 0) || !Number.isFinite(escala) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    const giro = [0, 90, 180, 270].includes(Number(e.giro)) ? Number(e.giro) : 0;
    return { escala, x, y, giro };
}

// Dibuja el fondo: con su encuadre si lo tiene; si no, cubriendo la tarjeta entera.
// `tam` = tamaño ORIGINAL de la imagen (el encuadre va por píxel original; los
// fotogramas de un GIF se guardan más pequeños).
function dibujarFondo(ctx, bg, encuadre, tam) {
    const e = encuadreValido(encuadre);
    const ow = (tam && tam.w) || bg.width;
    const oh = (tam && tam.h) || bg.height;
    if (e) {
        const w = ow * e.escala * W;
        const h = oh * e.escala * W;
        ctx.save();
        ctx.translate(W / 2 + e.x * W, H / 2 + e.y * W);
        ctx.rotate((e.giro * Math.PI) / 180);
        ctx.drawImage(bg, -w / 2, -h / 2, w, h);
        ctx.restore();
        return;
    }
    const escala = Math.max(W / bg.width, H / bg.height);
    const dw = bg.width * escala, dh = bg.height * escala;
    ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

// Fotogramas de un GIF ya montados (cada uno con lo que deja el anterior), como
// lienzos listos para dibujar. Se quedan como mucho MAX_FRAMES_FONDO repartidos en
// el tiempo, con la duración ajustada para que el bucle dure lo mismo, y como mucho
// al ancho de la tarjeta. Devuelve { frames: [{ img, delay }], w, h } (tamaño original).
function leerFotogramasGif(buffer) {
    const lector = new gifLector.GifReader(new Uint8Array(buffer));
    const w = lector.width, h = lector.height, n = lector.numFrames();
    if (n < 2 || w * h * n > MAX_PIXELES_GIF) return null;
    const retrasos = [];
    for (let i = 0; i < n; i++) retrasos.push(Math.max(2, lector.frameInfo(i).delay || 10) * 10); // centésimas → ms
    const total = retrasos.reduce((a, b) => a + b, 0);
    const salen = Math.min(n, MAX_FRAMES_FONDO);
    // Qué fotogramas se guardan: el que se ve en cada instante repartido en el bucle.
    const elegidos = new Set();
    for (let k = 0; k < salen; k++) {
        const instante = (k / salen) * total;
        let acumulado = 0;
        for (let i = 0; i < n; i++) { acumulado += retrasos[i]; if (acumulado > instante) { elegidos.add(i); break; } }
    }
    const pixeles = new Uint8ClampedArray(w * h * 4);
    const fotogramas = [];
    // Lienzo de paso a tamaño original y, si es más ancho que la tarjeta, copia reducida.
    const reduccion = Math.min(1, ANCHO_FRAME_MAX / w);
    const sw = Math.max(1, Math.round(w * reduccion));
    const sh = Math.max(1, Math.round(h * reduccion));
    const paso = canvasLib.createCanvas(w, h);
    const ctxPaso = paso.getContext('2d');
    for (let i = 0; i < n; i++) {
        const info = lector.frameInfo(i);
        const previo = info.disposal === 3 ? pixeles.slice() : null;
        lector.decodeAndBlitFrameRGBA(i, pixeles);
        if (elegidos.has(i)) {
            const datos = ctxPaso.createImageData(w, h);
            datos.data.set(pixeles);
            ctxPaso.putImageData(datos, 0, 0);
            const lienzo = canvasLib.createCanvas(sw, sh);
            lienzo.getContext('2d').drawImage(paso, 0, 0, sw, sh);
            fotogramas.push({ img: lienzo, i });
        }
        if (info.disposal === 2) {
            for (let fy = info.y; fy < Math.min(h, info.y + info.height); fy++) {
                pixeles.fill(0, (fy * w + info.x) * 4, (fy * w + Math.min(w, info.x + info.width)) * 4);
            }
        } else if (previo) pixeles.set(previo);
    }
    // Cada fotograma guardado dura lo que hay hasta el siguiente guardado.
    const frames = fotogramas.map((f, k) => {
        const hasta = k + 1 < fotogramas.length ? fotogramas[k + 1].i : n;
        let delay = 0;
        for (let i = f.i; i < hasta; i++) delay += retrasos[i];
        return { img: f.img, delay: Math.max(20, delay) };
    });
    return { frames, w, h };
}

// Caché de los GIF ya leídos (por archivo y fecha): leerlos cuesta y en una subida de
// nivel se pide la misma tarjeta varias veces.
const cacheGif = new Map();
function fotogramasFondo(fondoImagen) {
    if (!gifLector || !canvasLib || !fondoImagen || !/^\/uploads\/[\w.-]+\.gif$/i.test(fondoImagen)) return null;
    try {
        const ruta = resolverFondo(fondoImagen);
        const fecha = fs.statSync(ruta).mtimeMs;
        const clave = `${ruta}:${fecha}`;
        if (cacheGif.has(clave)) return cacheGif.get(clave);
        const frames = leerFotogramasGif(fs.readFileSync(ruta));
        if (cacheGif.size >= 2) cacheGif.delete(cacheGif.keys().next().value);
        cacheGif.set(clave, frames);
        return frames;
    } catch (e) {
        console.error('No se pudo leer el GIF del fondo de la tarjeta:', e.message);
        return null;
    }
}

// ¿El fondo es un GIF que se puede animar? (solo los subidos al panel).
const fondoEsGif = (opts) => !!(opts && opts.fondoTipo === 'imagen' && !opts.estilo
    && typeof opts.fondoImagen === 'string' && /^\/uploads\/[\w.-]+\.gif$/i.test(opts.fondoImagen));

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
        nombre, nivel, rank, xpActual, xpNecesaria, estilo: estiloId = null, idioma = null } = opts;
    const { avatar, bg } = imgs;
    const estilo = estiloId && ESTILOS[estiloId] ? ESTILOS[estiloId] : null;
    const acento = estilo ? estilo.acento : (opts.color || '#5865F2');

    // --- Fondo (recortado al borde redondeado) ---
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 30); ctx.clip();
    if (estilo) {
        estilo.fondo(ctx, W, H, fase);
    } else {
        // Primero el color (también debajo de una imagen: rellena lo que no cubre).
        if (fondoTipo === 'degradado' && colorSecundario) {
            const g = ctx.createLinearGradient(0, 0, W, H);
            g.addColorStop(0, fondoColor || FONDO); g.addColorStop(1, colorSecundario);
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        } else {
            ctx.fillStyle = fondoColor || FONDO; ctx.fillRect(0, 0, W, H);
        }
        if (fondoTipo === 'imagen' && bg) {
            dibujarFondo(ctx, bg, opts.encuadre, imgs.bgTam);
            // Un velo suave para que el texto se lea (además de la sombra del texto).
            ctx.fillStyle = 'rgba(18,20,32,0.38)'; ctx.fillRect(0, 0, W, H);
        }

        // Animación genérica para diseños personalizados animados (sin arte de
        // fábrica): un barrido de luz diagonal que recorre la tarjeta. La fase va
        // de 0 a 1, así que el barrido entra y sale fuera del lienzo y el bucle es
        // continuo.
        if (opts.animado) {
            const cx = -150 + fase * (W + 300);
            const sheen = ctx.createLinearGradient(cx - 130, 0, cx + 130, H);
            sheen.addColorStop(0, 'rgba(255,255,255,0)');
            sheen.addColorStop(0.5, 'rgba(255,255,255,0.16)');
            sheen.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = sheen; ctx.fillRect(0, 0, W, H);
        }
    }
    ctx.restore();

    // --- Borde de acento (el estilo puede traer el suyo, p.ej. neón pulsante) ---
    if (estilo && estilo.borde) {
        estilo.borde(ctx, W, H, fase, acento);
    } else {
        // En diseños personalizados animados, el borde late suavemente.
        ctx.strokeStyle = acento;
        ctx.lineWidth = opts.animado ? 6 + 2 * Math.sin(fase * Math.PI * 2) : 6;
        roundRect(ctx, 3, 3, W - 6, H - 6, 28); ctx.stroke();
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

    // --- Textos (con sombra si el fondo es decorado o una imagen, para legibilidad) ---
    const conSombra = !!estilo || (fondoTipo === 'imagen' && !!bg);
    ctx.save();
    if (conSombra) { ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 1; }
    const x = 250;
    ctx.textAlign = 'left';
    ctx.fillStyle = TEXTO; ctx.font = `bold 44px ${FUENTE}`;
    ctx.fillText(recorta(nombreLegible(nombre), 16), x, 95);

    ctx.textAlign = 'right';
    ctx.fillStyle = conSombra ? '#e9ecf5' : SUB; ctx.font = `bold 28px ${FUENTE}`;
    ctx.fillText(`${t(idioma, 'RANGO', 'RANK')} #${rank}`, W - 50, 75);
    ctx.fillStyle = acento; ctx.font = `bold 40px ${FUENTE}`;
    ctx.fillText(`${t(idioma, 'NIVEL', 'LEVEL')} ${nivel}`, W - 50, 120);
    ctx.textAlign = 'left';

    const bx = x, by = 150, bw = W - 50 - x, bh = 40;
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = conSombra ? 'rgba(0,0,0,0.45)' : BARRA_BG; roundRect(ctx, bx, by, bw, bh, 20); ctx.fill();
    const pct = Math.max(0, Math.min(1, xpNecesaria ? xpActual / xpNecesaria : 0));
    if (pct > 0) { ctx.fillStyle = acento; roundRect(ctx, bx, by, Math.max(bh, bw * pct), bh, 20); ctx.fill(); }

    if (conSombra) { ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8; }
    ctx.fillStyle = conSombra ? '#dfe3ec' : SUB; ctx.font = `24px ${FUENTE}`;
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
        // Con un GIF de fondo, un fotograma de la tarjeta por cada uno suyo (y su duración).
        const gifFondo = fondoEsGif(opts) ? fotogramasFondo(opts.fondoImagen) : null;
        const fondo = gifFondo && gifFondo.frames.length > 1 ? gifFondo.frames : null;
        const pasos = fondo ? fondo.length : FRAMES;
        const gif = GIFEncoder();
        for (let i = 0; i < pasos; i++) {
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#0b0b14'; ctx.fillRect(0, 0, W, H); // backdrop de las esquinas
            dibujarTarjeta(ctx, opts, fondo ? { ...imgs, bg: fondo[i].img, bgTam: { w: gifFondo.w, h: gifFondo.h } } : imgs, i / pasos);
            const { data } = ctx.getImageData(0, 0, W, H);
            const palette = quantize(data, 256);
            const index = applyPalette(data, palette);
            gif.writeFrame(index, W, H, { palette, delay: fondo ? fondo[i].delay : DELAY });
        }
        gif.finish();
        return Buffer.from(gif.bytes());
    } catch (e) {
        console.error('Error generando tarjeta animada:', e.message);
        return null;
    }
}

module.exports = { generarTarjeta, generarTarjetaAnimada, ESTILOS, fondoEsGif, encuadreValido };
