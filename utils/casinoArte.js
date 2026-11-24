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
// 1.32.0: los del catálogo tienen dibujo propio (utils/sprites.js); `op` = { etapa, humor, variante }.
async function imagenCompanero(id, op = {}) {
    const d = K.def(id);
    const SPR = require('./sprites.js');
    if (SPR.tiene(id)) { const im = SPR.imagen(id, { etapa: 2, ...op }); if (im) return im; }
    if (d.svg) return imagen(d.svg);
    if (d.imagen && String(d.imagen).startsWith('https://s4.anilist.co/')) return imagenAnime(d.imagen);
    if (!d.imagen || !String(d.imagen).startsWith('/uploads/')) return imagen('2b50');
    const clave = `foto:${d.imagen}`;
    if (imagenes.has(clave)) return imagenes.get(clave);
    const ruta = path.join(UPLOADS, path.basename(d.imagen));
    const img = fs.existsSync(ruta) ? await canvasLib.loadImage(fs.readFileSync(ruta)).catch(() => null) : null;
    imagenes.set(clave, img);
    return img;
}
// Fotos del Pack anime: se bajan de AniList la primera vez y se guardan en cache/anime (no en
// git). Solo de s4.anilist.co, como mucho 5 MB y que de verdad sean imágenes. Si falla, estrella.
const CACHE_ANIME = path.join(__dirname, '..', 'cache', 'anime');
async function imagenAnime(url) {
    const clave = `anime:${url}`;
    if (imagenes.has(clave)) return imagenes.get(clave);
    const archivo = path.join(CACHE_ANIME, path.basename(new URL(url).pathname));
    let buf = fs.existsSync(archivo) ? fs.readFileSync(archivo) : null;
    if (!buf) {
        try {
            const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
            const b = r.ok ? Buffer.from(await r.arrayBuffer()) : null;
            if (b && b.length < 5 * 1024 * 1024 && require('./imagenes.js').extensionImagen(b)) {
                buf = b;
                fs.mkdirSync(CACHE_ANIME, { recursive: true });
                fs.writeFileSync(archivo, b);
            }
        } catch { buf = null; }
    }
    const img = buf ? await canvasLib.loadImage(buf).catch(() => null) : null;
    if (!img) return imagen('2b50'); // no se guarda en memoria: se reintenta la próxima vez
    if (imagenes.size > 400) imagenes.delete(imagenes.keys().next().value);
    imagenes.set(clave, img);
    return img;
}
// Pinta el compañero en (x, y, tam). Las fotos van en círculo con borde.
function pintarCompanero(ctx, img, id, x, y, tam, borde = null) {
    if (!img) return;
    const d = K.def(id);
    if (img._sprite) { const g = tam * 1.22; ctx.drawImage(img, x + (tam - g) / 2, y + (tam - g) * 0.7, g, g); return; }
    if (d.svg) { ctx.drawImage(img, x, y, tam, tam); return; }
    ctx.save(); ctx.beginPath(); ctx.arc(x + tam / 2, y + tam / 2, tam / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    // Recorte cuadrado; en las fotos verticales (retratos) se coge la parte de arriba, donde está la cara.
    const lado = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - lado) / 2, img.height > img.width ? (img.height - lado) * 0.15 : (img.height - lado) / 2, lado, lado, x, y, tam, tam);
    ctx.restore();
    if (borde) { ctx.beginPath(); ctx.arc(x + tam / 2, y + tam / 2, tam / 2, 0, Math.PI * 2); ctx.strokeStyle = borde; ctx.lineWidth = Math.max(2, tam / 30); ctx.stroke(); }
}

// Junta los fotogramas en un GIF (1.31.1: que no «se note» que es un GIF).
//   · UNA paleta para toda la animación (sacada de varios fotogramas): los colores no
//     bailan de un fotograma a otro, que era lo que más delataba al GIF.
//   · Tramado ordenado suave (Bayer 4×4, fijo por posición): sin bandas en los degradados;
//     como es fijo, lo que no se mueve sigue igual y comprime bien.
//   · Cada fotograma guarda SOLO lo que cambia (el resto, transparente sobre el anterior):
//     permite muchos más fotogramas (más fluido) sin que pese más.
// frames: [{ ctx, delay }] · `repetir`: en bucle (carteles) o una sola vez (por defecto).
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.5));
// Es asíncrona y cede el turno cada pocos fotogramas: en la Raspberry Pi, una animación larga
// (la carrera, el blackjack) bloqueaba el bot varios segundos y otros comandos no llegaban a tiempo.
const ceder = () => new Promise((r) => setImmediate(r));
async function aGif(frames, W, H, { repetir = false, tramado = 7 } = {}) {
    const { GIFEncoder, quantize, applyPalette } = gifLib;
    const fila = new Float32Array(16);
    for (let k = 0; k < 16; k++) fila[k] = BAYER4[k] * tramado * 2;
    const datos = [];
    for (let n = 0; n < frames.length; n++) {
        const d = frames[n].ctx.getImageData(0, 0, W, H).data;
        frames[n].ctx = null; // el lienzo ya no hace falta: se suelta la memoria
        if (tramado > 0) {
            for (let y = 0, i = 0; y < H; y++) {
                const by = (y & 3) * 4;
                for (let x = 0; x < W; x++, i += 4) {
                    const o = fila[by + (x & 3)];
                    d[i] += o; d[i + 1] += o; d[i + 2] += o; // Uint8ClampedArray: se recorta solo a 0..255
                }
            }
        }
        datos.push(d);
        if (n % 4 === 3) await ceder();
    }
    // Paleta común: de una muestra de hasta 10 fotogramas repartidos (siempre el primero y el último).
    const nMuestra = Math.min(datos.length, 10);
    const elegidos = [...new Set([...Array(nMuestra)].map((_, k) => Math.round((k * (datos.length - 1)) / Math.max(1, nMuestra - 1))))];
    const muestra = new Uint8Array(elegidos.length * W * H * 4);
    elegidos.forEach((k, j) => muestra.set(datos[k], j * W * H * 4));
    const paleta = quantize(muestra, 255);
    await ceder();
    const TRANSP = paleta.length; // índice libre: «este píxel no cambia»
    const paletaGif = [...paleta, [0, 0, 0]];
    const gif = GIFEncoder();
    let previo = null;
    for (let i = 0; i < datos.length; i++) {
        const index = applyPalette(datos[i], paleta);
        datos[i] = null;
        if (!previo) {
            gif.writeFrame(index, W, H, { palette: paletaGif, delay: frames[i].delay, repeat: repetir ? 0 : -1, dispose: 1 });
        } else {
            const delta = new Uint8Array(index.length);
            for (let p = 0; p < index.length; p++) delta[p] = index[p] === previo[p] ? TRANSP : index[p];
            gif.writeFrame(delta, W, H, { delay: frames[i].delay, transparent: true, transparentIndex: TRANSP, dispose: 1 });
        }
        previo = index;
        if (i % 3 === 2) await ceder();
    }
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
// Resultado dentro de la imagen (1.31.0): una pastilla grande con lo que ganas o
// pierdes, para que el mensaje no necesite frases. `res` = { premio, apuesta, idioma,
// bote, mult }. Verde si ganas, ámbar si recuperas algo, rojo si pierdes.
// ---------------------------------------------------------------------------
const cifra = (n, idioma = 'es') => Math.round(n || 0).toLocaleString(idioma === 'en' ? 'en-US' : 'es-ES');
function textoResultado(res) {
    const { premio = 0, apuesta = 0, idioma = 'es', bote = false, mult = 0, texto = null } = res || {};
    if (texto) return { texto, color: '#15803d', borde: '#86efac' };
    if (bote) return { texto: `💎 ${idioma === 'en' ? 'JACKPOT' : 'BOTE'}  +🪙 ${cifra(premio, idioma)}`, color: '#a855f7', borde: '#f0abfc' };
    if (premio > apuesta) return { texto: `${mult ? `×${String(mult).replace('.', idioma === 'en' ? '.' : ',')}  ` : ''}+🪙 ${cifra(premio, idioma)}`, color: '#15803d', borde: '#86efac' };
    if (premio > 0) return { texto: `↩ 🪙 ${cifra(premio, idioma)}`, color: '#a16207', borde: '#fde68a' };
    if (!apuesta) return { texto: '💨', color: '#475569', borde: '#94a3b8' }; // tirada gratis sin premio: no pierdes nada
    return { texto: `−🪙 ${cifra(apuesta, idioma)}`, color: '#991b1b', borde: '#fca5a5' };
}
// Pinta la pastilla centrada en (cx, cy). `brillo` (0..1) la hace latir en los GIF.
function pastillaResultado(ctx, cx, cy, res, { tam = 30, brillo = 0 } = {}) {
    const r = textoResultado(res);
    ctx.save();
    ctx.font = `900 ${tam}px ${FUENTE}`;
    const w = Math.min(ctx.measureText(r.texto).width + tam * 1.6, 1000);
    const h = tam * 1.65;
    ctx.shadowColor = r.borde; ctx.shadowBlur = 10 + 18 * brillo;
    redondeado(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = r.color; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3; ctx.strokeStyle = r.borde; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(r.texto, cx, cy + 1);
    // 1.31.1: tu oro debajo (así el mensaje no tiene que editarse al acabar para decirlo).
    if (res?.saldo != null) {
        ctx.font = `bold ${Math.round(tam * 0.5)}px ${FUENTE}`; ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.fillText(`🪙 ${cifra(res.saldo, res.idioma)}${res.vuelta ? `  ·  🐾 +${cifra(res.vuelta, res.idioma)}` : ''}`, cx, cy + h / 2 + tam * 0.55);
    }
    ctx.restore();
}

// ---------------------------------------------------------------------------
// 🎰 Tragaperras
// ---------------------------------------------------------------------------
async function gifTragaperras(rodillos, { mult = 0, bote = false, resultado = null } = {}) {
    if (!listo()) return null;
    const W = 480; const H = resultado ? 322 : 250;
    const sims = await Promise.all(C.SIMBOLOS.map((s) => imagen(s.svg)));
    const img = (id) => sims[C.SIMBOLOS.findIndex((s) => s.id === id)];
    // Tiras de cada rodillo: símbolos al azar y, al final, el que sale.
    const LARGO = 22;
    const tiras = rodillos.map((fin) => [...Array(LARGO - 1)].map(() => C.simboloAlAzar(Math.random)).concat(fin));
    // 1.31.1: el doble de fotogramas, la mitad de rápidos: giro fluido (unos 25 por segundo).
    const PARA = [22, 30, 38];
    const TOTAL = 56;
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
            const on = (i + Math.floor(f / 2)) % 3 === 0;
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
                pos = fin + ([0.14, 0.07, -0.05, -0.02][tras] || 0); // rebote al parar
            } else {
                pos = fin - (PARA[r] - f) * 0.45;
            }
            const centro = y + h / 2;
            for (let k = Math.floor(pos) - 1; k <= Math.ceil(pos) + 1; k++) {
                if (k < 0 || k > fin) continue;
                const yy = centro + (k - pos) * SY;
                const im = img(tiras[r][k]);
                if (!im) continue;
                if (f < PARA[r]) { ctx.globalAlpha = 0.3; ctx.drawImage(im, x + 22, yy - 40 - 12, 80, 80); }
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
        const brilla = fin && mult > 0 && Math.floor((f - PARA[2]) / 2) % 2 === 0;
        ctx.strokeStyle = brilla ? '#fde047' : 'rgba(251,191,36,0.55)';
        ctx.lineWidth = brilla ? 6 : 3;
        ctx.beginPath(); ctx.moveTo(26, 115); ctx.lineTo(W - 26, 115); ctx.stroke();
        if (fin && resultado) {
            pastillaResultado(ctx, W / 2, 248, { ...resultado, mult, bote }, { tam: 28, brillo: brilla ? 1 : 0 });
        } else if (fin && mult > 0) {
            ctx.font = `bold 34px ${FUENTE}`; ctx.textAlign = 'center';
            const texto = bote ? '💎 ¡BOTE! 💎' : `×${mult}`;
            ctx.lineWidth = 6; ctx.strokeStyle = '#7c2d12'; ctx.strokeText(texto, W / 2, 228);
            ctx.fillStyle = brilla ? '#fde047' : '#fff7ed'; ctx.fillText(texto, W / 2, 228);
        }
        frames.push({ ctx, delay: f === TOTAL - 1 ? 6000 : f < PARA[2] ? 40 : 90 });
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
async function gifRuleta(numero, { resultado = null } = {}) {
    if (!listo()) return null;
    const W = 360; const H = resultado ? 436 : 360; const R = 170;
    const CY = 186; // centro de la rueda (la pastilla del resultado va debajo)
    const r = rueda(R);
    const n = C.ORDEN_RUEDA.length; const paso = (Math.PI * 2) / n;
    const idx = C.ORDEN_RUEDA.indexOf(numero);
    const final = -idx * paso; // así el número queda arriba
    const inicio = final - Math.PI * 2 * 5;
    const TOTAL = 52; // 1.31.1: más fotogramas (la rueda cambia entera en cada uno: no más, por el peso)
    const frames = [];
    const color = { verde: '#16a34a', rojo: '#dc2626', negro: '#111827' }[C.colorNumero(numero)];
    for (let f = 0; f < TOTAL; f++) {
        const { ctx } = lienzo(W, H);
        ctx.fillStyle = '#0b3d2e'; ctx.fillRect(0, 0, W, H);
        const t = Math.min(1, f / (TOTAL - 8));
        const ang = inicio + (final - inicio) * facil(t);
        ctx.save(); ctx.translate(W / 2, CY); ctx.rotate(ang); ctx.drawImage(r, -R, -R); ctx.restore();
        // La bola, arriba del todo (gira con la rueda al principio y se asienta)
        const bolaY = CY - (R - 24) - (t < 1 ? 10 * (1 - t) * Math.abs(Math.sin(f * 0.65)) : 0);
        ctx.beginPath(); ctx.arc(W / 2, bolaY - 18, 8, 0, Math.PI * 2); ctx.fillStyle = '#f8fafc'; ctx.fill();
        // Flecha
        ctx.beginPath(); ctx.moveTo(W / 2 - 12, 2); ctx.lineTo(W / 2 + 12, 2); ctx.lineTo(W / 2, 22); ctx.closePath(); ctx.fillStyle = '#fbbf24'; ctx.fill();
        if (t >= 1) {
            ctx.beginPath(); ctx.arc(W / 2, CY, 58, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4; ctx.stroke();
            ctx.fillStyle = '#ffffff'; ctx.font = `bold 52px ${FUENTE}`; ctx.textAlign = 'center'; ctx.fillText(String(numero), W / 2, CY + 19);
            if (resultado) pastillaResultado(ctx, W / 2, 384, resultado, { tam: 24, brillo: Math.floor(f / 2) % 2 });
        }
        frames.push({ ctx, delay: f === TOTAL - 1 ? 6000 : t < 1 ? 30 + Math.round(70 * t * t) : 120 });
    }
    return aGif(frames, W, H, { tramado: 3 }); // poco tramado: la rueda gira entera y el tramado no comprime
}

// ---------------------------------------------------------------------------
// 🪙 Moneda
// ---------------------------------------------------------------------------
async function gifMoneda(resultado, { res = null, textos = null } = {}) {
    if (!listo()) return null;
    const W = 260; const H = res ? 322 : 260;
    const [corona, estrella] = await Promise.all([imagen('1f451'), imagen('2b50')]);
    const TOTAL = 44; const vueltas = 5; // 1.31.1: más fotogramas
    const frames = [];
    for (let f = 0; f < TOTAL; f++) {
        const { ctx } = lienzo(W, H);
        const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W / 1.2);
        g.addColorStop(0, '#312e81'); g.addColorStop(1, '#0f172a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const t = Math.min(1, f / (TOTAL - 8));
        // Ángulo: varias vueltas y acaba mirando a la cara que toca.
        const finalAng = resultado === 'cara' ? 0 : Math.PI;
        const ang = finalAng + Math.PI * 2 * vueltas * (1 - facil(t));
        const esc = Math.cos(ang);
        const altura = Math.sin(Math.PI * Math.min(1, t * 1.05)) * 60;
        const cy = 140 - altura;
        // Sombra en el suelo
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(W / 2, 230, 60 - altura / 3, 10, 0, 0, Math.PI * 2); ctx.fill();
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
            ctx.fillText(resultado === 'cara' ? (textos?.cara || '👑 CARA') : (textos?.cruz || '⭐ CRUZ'), W / 2, 36);
            if (res) pastillaResultado(ctx, W / 2, 270, res, { tam: 22, brillo: Math.floor(f / 2) % 2 });
        }
        frames.push({ ctx, delay: f === TOTAL - 1 ? 6000 : t < 1 ? 35 : 110 });
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
// Pinta la mesa en `ctx`. anim (1.31.1, para el GIF de la banca): { volteo: 0..1 de la carta
// tapada, entra: 0..1 de la última carta de la banca, huecos: cartas de la banca al final (para
// que la fila no se recoloque a saltos), puntos: los puntos que se enseñan de la banca }.
function pintarMesa(ctx, W, H, { jugador, banca, ocultar = true, textos = {}, resultado = null, anim = null }) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W / 1.4);
    g.addColorStop(0, '#15803d'); g.addColorStop(1, '#052e16');
    redondeado(ctx, 0, 0, W, H, 26); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = 10; redondeado(ctx, 5, 5, W - 10, H - 10, 22); ctx.stroke();
    ctx.strokeStyle = 'rgba(253,230,138,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, -260, 470, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
    if (!resultado) {
        ctx.fillStyle = 'rgba(253,230,138,0.55)'; ctx.font = `bold 14px ${FUENTE}`; ctx.textAlign = 'center';
        ctx.fillText(textos.lema || 'BLACKJACK PAGA 3 A 2 · LA BANCA SE PLANTA EN 17', W / 2, H / 2 + 6);
    }
    const fila = (mano, y, ocultarSegunda, huecos = mano.length, esBanca = false) => {
        const total = huecos * 60 + 12;
        const x0 = W / 2 - total / 2;
        mano.forEach((cc, i) => {
            const x = x0 + i * 60;
            const ultima = esBanca && anim?.entra != null && i === mano.length - 1;
            if (esBanca && i === 1 && anim?.volteo != null) {
                // La carta tapada se da la vuelta (se estrecha y vuelve a abrirse ya destapada).
                const k = anim.volteo; const esc = Math.max(0.04, Math.abs(Math.cos(k * Math.PI)));
                ctx.save(); ctx.translate(x + 36, y); ctx.scale(esc, 1); carta(ctx, -36, 0, cc, k < 0.5); ctx.restore();
                return;
            }
            if (ultima) {
                // Entra deslizando desde el mazo (arriba a la derecha).
                const k = facil(anim.entra);
                ctx.save(); ctx.globalAlpha = Math.min(1, 0.2 + k);
                carta(ctx, x + (1 - k) * 220, y - (1 - k) * 60, cc, false);
                ctx.restore();
                return;
            }
            carta(ctx, x, y, cc, ocultarSegunda && i === 1);
        });
    };
    fila(banca, 28, ocultar, anim?.huecos || banca.length, true);
    fila(jugador, 236, false);
    ctx.fillStyle = '#fef3c7'; ctx.font = `bold 18px ${FUENTE}`; ctx.textAlign = 'left';
    const pb = anim?.puntos != null ? String(anim.puntos) : ocultar ? `${C.valorCarta(banca[0])} + ?` : String(C.puntos(banca).total);
    ctx.fillText(`${textos.banca || 'Banca'}: ${pb}`, 24, 30 + 6);
    ctx.fillText(`${textos.tu || 'Tú'}: ${C.puntos(jugador).total}`, 24, 236 + 6);
    // Al acabar: la pastilla con lo ganado/perdido y, encima, la palabra clave (BLACKJACK, EMPATE…).
    if (resultado) {
        if (resultado.titulo) {
            ctx.font = `900 22px ${FUENTE}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fef3c7';
            ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6;
            ctx.fillText(resultado.titulo, W / 2, 158); ctx.shadowBlur = 0;
        }
        pastillaResultado(ctx, W / 2, 196, resultado, { tam: 24, brillo: 1 });
    }
}
function mesaBlackjack(opc) {
    if (!canvasLib) return null;
    const W = 640; const H = 380;
    const { c, ctx } = lienzo(W, H);
    pintarMesa(ctx, W, H, opc);
    return c.toBuffer('image/png');
}
// 1.31.1: el final de la mano en UN GIF (antes, una edición del mensaje por carta: la imagen
// saltaba cada vez). La banca destapa su carta, roba las que le tocan y sale el resultado.
// bancaInicial: sus 2 cartas; banca: todas las del final; destapar: false si ya se veían.
async function gifBlackjack({ jugador, bancaInicial, banca, textos = {}, resultado = null, destapar = true }) {
    if (!listo()) return null;
    const W = 640; const H = 380;
    const frames = [];
    const huecos = banca.length;
    const foto = (opc, delay) => { const { ctx } = lienzo(W, H); pintarMesa(ctx, W, H, { jugador, textos, ...opc, anim: { huecos, ...opc.anim } }); frames.push({ ctx, delay }); };
    foto({ banca: bancaInicial, ocultar: destapar, anim: { puntos: destapar ? `${C.valorCarta(bancaInicial[0])} + ?` : C.puntos(bancaInicial).total } }, 350);
    if (destapar) {
        for (let k = 1; k <= 10; k++) foto({ banca: bancaInicial, ocultar: false, anim: { volteo: k / 10, puntos: k < 5 ? `${C.valorCarta(bancaInicial[0])} + ?` : C.puntos(bancaInicial).total } }, 35);
        foto({ banca: bancaInicial, ocultar: false, anim: { puntos: C.puntos(bancaInicial).total } }, 450);
    }
    for (let n = bancaInicial.length + 1; n <= banca.length; n++) {
        const mano = banca.slice(0, n);
        for (let k = 1; k <= 9; k++) foto({ banca: mano, ocultar: false, anim: { entra: k / 9, puntos: C.puntos(mano.slice(0, -1)).total } }, 35);
        foto({ banca: mano, ocultar: false, anim: { puntos: C.puntos(mano).total } }, 450);
    }
    foto({ banca, ocultar: false, resultado, anim: { puntos: C.puntos(banca).total } }, 8000);
    return aGif(frames, W, H);
}

// ---------------------------------------------------------------------------
// 🚀 Crash (1.31.0): el cielo, la curva que sube, el cohete en la punta y el
// multiplicador enorme. `estado`: vuela | cobrado | boom.
// ---------------------------------------------------------------------------
function graficaCrash({ mult = 1, estado = 'vuela', punto = null, cobradoEn = null, apuesta = 0, auto = null, idioma = 'es' }) {
    if (!canvasLib) return null;
    const W = 640; const H = 320;
    const { c, ctx } = lienzo(W, H);
    const boom = estado === 'boom'; const cobrado = estado === 'cobrado';
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, boom ? '#450a0a' : cobrado ? '#052e16' : '#0b1026'); g.addColorStop(1, boom ? '#1c0606' : '#111827');
    redondeado(ctx, 0, 0, W, H, 24); ctx.fillStyle = g; ctx.fill();
    // Estrellas fijas (siempre las mismas: no parpadean entre ediciones)
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 40; i++) { const x = (i * 137) % W; const y = (i * 71) % (H - 60); ctx.fillRect(x, y, i % 3 ? 1.5 : 2.5, i % 3 ? 1.5 : 2.5); }
    // Zona del gráfico
    const X0 = 40; const Y0 = H - 34; const X1 = W - 40; const Y1 = 70;
    const hasta = Math.max(mult, cobrado && punto ? punto : mult);
    const tope = Math.max(2, hasta * 1.18);
    const yDe = (m) => Y0 - ((m - 1) / (tope - 1)) * (Y0 - Y1);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.font = `bold 12px ${FUENTE}`; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.textAlign = 'left';
    const pasoRejilla = tope > 20 ? 5 : tope > 6 ? 2 : tope > 3 ? 0.5 : 0.25;
    for (let m = 1; m <= tope; m += pasoRejilla) {
        const y = yDe(m); ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1, y); ctx.stroke();
        ctx.fillText(`×${idioma === 'en' ? Math.round(m * 100) / 100 : String(Math.round(m * 100) / 100).replace('.', ',')}`, 8, y + 4);
    }
    // Curva exponencial de 1 a `m` ocupando el ancho proporcional a su tiempo.
    const largo = (m) => Math.min(1, C.segundosHasta(m) / Math.max(C.segundosHasta(hasta), 0.001));
    const curva = (m, color, ancho, discontinua = false) => {
        const L = largo(m); const pasos = 48;
        ctx.save(); if (discontinua) ctx.setLineDash([8, 8]);
        ctx.beginPath();
        for (let i = 0; i <= pasos; i++) {
            const k = (i / pasos) * L;
            const mm = Math.exp(Math.log(hasta) * k) || 1;
            const x = X0 + k * (X1 - X0 - 30); const y = yDe(mm);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
        return { x: Math.max(X0 + 34, X0 + L * (X1 - X0 - 30)), y: Math.min(Y0 - 24, yDe(m)) };
    };
    // Relleno bajo la curva
    const color = boom ? '#ef4444' : cobrado ? '#22c55e' : mult >= 5 ? '#f59e0b' : '#38bdf8';
    let punta;
    if (cobrado && punto) {
        curva(punto, 'rgba(255,255,255,0.25)', 3, true);
        punta = curva(cobradoEn || mult, color, 6);
    } else {
        punta = curva(mult, color, 6);
    }
    // El cohete (o la explosión / el paracaídas) en la punta
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${boom ? 64 : 44}px ${FUENTE}`;
    ctx.fillText(boom ? '💥' : cobrado ? '🪂' : '🚀', punta.x, punta.y - (boom ? 0 : 6));
    if (auto && estado === 'vuela') {
        const y = yDe(Math.min(auto, tope)); ctx.save(); ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(134,239,172,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1, y); ctx.stroke(); ctx.restore();
        ctx.font = `bold 13px ${FUENTE}`; ctx.fillStyle = '#86efac'; ctx.textAlign = 'left'; ctx.fillText(`🪂 ×${auto}`, X0 + 4, y + 18);
    }
    // Multiplicador grande arriba a la izquierda
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const enorme = boom ? (punto || mult) : cobrado ? (cobradoEn || mult) : mult;
    ctx.font = `900 54px ${FUENTE}`; ctx.fillStyle = boom ? '#fca5a5' : '#ffffff';
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    const textoMult = `×${idioma === 'en' ? enorme.toFixed(2) : enorme.toFixed(2).replace('.', ',')}`;
    ctx.fillText(textoMult, 28, 62); ctx.shadowBlur = 0;
    if (boom) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(24, 44); ctx.lineTo(28 + ctx.measureText(textoMult).width + 4, 44); ctx.stroke(); }
    // Lo que te llevarías / lo que te has llevado / lo que pierdes
    const res = boom ? { premio: 0, apuesta, idioma } : { premio: Math.floor(apuesta * (cobrado ? (cobradoEn || mult) : mult)), apuesta, idioma };
    if (estado === 'vuela') {
        ctx.font = `bold 22px ${FUENTE}`; ctx.fillStyle = '#e0f2fe'; ctx.textAlign = 'right';
        ctx.fillText(`🪙 ${cifra(res.premio, idioma)}`, W - 28, 52);
    } else {
        pastillaResultado(ctx, W - 150, 48, res, { tam: 22, brillo: 1 });
    }
    return c.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// 🏇 Pista de la carrera (1.31.0): un carril por corredor, la meta a la izquierda
// (los dibujos miran a la izquierda), su cuota y el trofeo para el que gana.
// pos = { caballo: 0..1, … } (0 = salida, 1 = meta).
// ---------------------------------------------------------------------------
const CARRIL = 52;
const altoPista = () => 24 + C.CORREDORES.length * CARRIL + 14;
// Pinta la pista. `salto` (1.31.1): cuánto botan al galopar (0 = quietos); `fase` desplaza el bote de cada uno.
function pintarPista(ctx, { pos = null, ganador = null, apostados = {}, salto = 0, fase = 0 } = {}) {
    const W = 640; const H = altoPista();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3f6212'); g.addColorStop(1, '#14532d');
    redondeado(ctx, 0, 0, W, H, 22); ctx.fillStyle = g; ctx.fill();
    const META = 70; const SALIDA = W - 128; // la salida deja sitio a las cuotas
    C.CORREDORES.forEach((cor, i) => {
        const y = 24 + i * CARRIL;
        ctx.fillStyle = i % 2 ? 'rgba(120,53,15,0.55)' : 'rgba(146,64,14,0.55)';
        ctx.fillRect(META - 20, y, W - META + 6, CARRIL - 6);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(META - 20, y + CARRIL - 7, W - META + 6, 1);
        // Número del carril
        ctx.font = `bold 16px ${FUENTE}`; ctx.fillStyle = '#fef3c7'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), 22, y + CARRIL / 2 - 3);
        // Cuota y gente que le ha apostado
        ctx.font = `bold 13px ${FUENTE}`; ctx.fillStyle = '#fde68a'; ctx.textAlign = 'right';
        ctx.fillText(`×${String(C.cuota(cor.id)).replace('.', ',')}${apostados[cor.id] ? `  👤${apostados[cor.id]}` : ''}`, W - 14, y + CARRIL / 2 - 3);
        // El corredor (con su bote al galopar y una nube de polvo detrás)
        const avance = Math.max(0, Math.min(1, pos?.[cor.id] || 0));
        const x = SALIDA - avance * (SALIDA - META);
        const bote = salto ? -Math.abs(Math.sin(fase + i * 1.7)) * salto : 0;
        if (salto) {
            ctx.globalAlpha = 0.25; ctx.fillStyle = '#fde68a';
            for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + 26 + k * 9, y + CARRIL / 2 + 10 - k * 2, 5 - k, 0, Math.PI * 2); ctx.fill(); }
            ctx.globalAlpha = 1;
        }
        ctx.font = `36px ${FUENTE}`; ctx.textAlign = 'center';
        if (ganador && ganador !== cor.id) ctx.globalAlpha = 0.55;
        ctx.fillText(cor.emoji, x, y + CARRIL / 2 - 2 + bote);
        ctx.globalAlpha = 1;
        if (ganador === cor.id) { ctx.font = `28px ${FUENTE}`; ctx.fillText('🏆', x + 38, y + CARRIL / 2 - 4); }
    });
    // Meta a cuadros
    for (let yy = 24; yy < H - 14; yy += 10) {
        for (let k = 0; k < 2; k++) { ctx.fillStyle = ((yy / 10 + k) % 2 < 1) ? '#ffffff' : '#111827'; ctx.fillRect(META - 30 + k * 8, yy, 8, 10); }
    }
    ctx.textBaseline = 'alphabetic';
}
function pistaCarrera(opc = {}) {
    if (!canvasLib) return null;
    const { c, ctx } = lienzo(640, altoPista());
    pintarPista(ctx, opc);
    return c.toBuffer('image/png');
}
// 1.31.1: la carrera ENTERA en un GIF fluido (antes, 9 imágenes cambiando cada 1,3 s: saltaba).
// pasos: posiciones de utils/casinoNucleo.pasosCarrera; entre paso y paso se interpola. Al final,
// un cartel con quién gana y lo que se lleva cada uno. ganadores: [{ nombre, premio }].
async function gifCarrera({ pasos, ganador, apostados = {}, ganadores = [], idioma = 'es', textos = {} }) {
    if (!listo()) return null;
    const W = 640; const H = altoPista();
    const SUB = 9; // fotogramas entre paso y paso
    const frames = [];
    const todos = [Object.fromEntries(C.CORREDORES.map((c) => [c.id, 0])), ...pasos];
    // Salida: 3, 2, 1…
    for (const n of ['3', '2', '1']) {
        const { ctx } = lienzo(W, H);
        pintarPista(ctx, { pos: todos[0], apostados });
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
        ctx.font = `900 96px ${FUENTE}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = '#facc15'; ctx.shadowBlur = 24; ctx.fillText(n, W / 2, H / 2); ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';
        frames.push({ ctx, delay: 420 });
    }
    let fase = 0;
    for (let p = 1; p < todos.length; p++) {
        for (let k = 1; k <= SUB; k++) {
            const u = k / SUB; const pos = {};
            for (const c of C.CORREDORES) pos[c.id] = todos[p - 1][c.id] + (todos[p][c.id] - todos[p - 1][c.id]) * u;
            fase += 0.55;
            const { ctx } = lienzo(W, H);
            pintarPista(ctx, { pos, apostados, salto: 7, fase });
            frames.push({ ctx, delay: 45 });
            if (k % 3 === 0) await ceder();
        }
    }
    // Llegada: el ganador destacado y el cartel con los premios.
    const fin = todos[todos.length - 1];
    const emo = C.CORREDORES.find((c) => c.id === ganador)?.emoji || '🏆';
    const { ctx } = lienzo(W, H);
    pintarPista(ctx, { pos: fin, ganador, apostados });
    const lineas = ganadores.slice(0, 4);
    const ch = 70 + Math.max(1, lineas.length) * 26;
    redondeado(ctx, W / 2 - 190, H / 2 - ch / 2, 380, ch, 18); ctx.fillStyle = 'rgba(2,6,23,0.85)'; ctx.fill();
    ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3; ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = `900 30px ${FUENTE}`; ctx.fillStyle = '#fde047';
    ctx.fillText(`🏆 ${emo}`, W / 2, H / 2 - ch / 2 + 42);
    ctx.font = `bold 17px ${FUENTE}`;
    if (!lineas.length) { ctx.fillStyle = '#cbd5e1'; ctx.fillText(textos.nadie || '😅', W / 2, H / 2 - ch / 2 + 74); }
    lineas.forEach((l, i) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${String(l.nombre).slice(0, 18)}  +🪙 ${cifra(l.premio, idioma)}`, W / 2, H / 2 - ch / 2 + 74 + i * 26);
    });
    if (ganadores.length > 4) { ctx.font = `13px ${FUENTE}`; ctx.fillStyle = '#94a3b8'; ctx.fillText(`+${ganadores.length - 4}`, W / 2 + 170, H / 2 + ch / 2 - 10); }
    frames.push({ ctx, delay: 9000 });
    return aGif(frames, W, H);
}

// ---------------------------------------------------------------------------
// 🚀 Cohete en bucle (1.31.1) para el crash en directo: sin números (esos van en el texto del
// mensaje, que se actualiza sin tocar la imagen). Siempre el mismo GIF: se hace una vez y se guarda.
// ---------------------------------------------------------------------------
let coheteCache = null;
async function gifCohete() {
    if (!listo()) return null;
    if (coheteCache) return coheteCache;
    const W = 640; const H = 200; const TOTAL = 24;
    const estrellas = [...Array(70)].map((_, i) => ({ x: (i * 97) % W, y: (i * 53) % H, v: 1 + (i % 3), r: i % 5 ? 1.2 : 2.2 }));
    const frames = [];
    for (let f = 0; f < TOTAL; f++) {
        const { ctx } = lienzo(W, H);
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#0b1026'); g.addColorStop(1, '#1e1b4b');
        redondeado(ctx, 0, 0, W, H, 22); ctx.fillStyle = g; ctx.fill();
        // Estrellas que pasan (en bucle exacto: recorren un múltiplo del ancho en TOTAL fotogramas)
        for (const e of estrellas) {
            const d = (e.v * W * f) / (TOTAL * 2);
            const x = ((e.x - d) % W + W) % W; const y = ((e.y + d * 0.35) % H + H) % H;
            ctx.fillStyle = `rgba(255,255,255,${0.35 + e.v * 0.18})`;
            ctx.fillRect(x, y, e.r + e.v * 2.5, e.r);
        }
        const t = (f / TOTAL) * Math.PI * 2;
        const cx = W / 2 + Math.sin(t) * 6; const cy = H / 2 + Math.cos(t * 2) * 5;
        // Estela de fuego que late
        for (let k = 6; k >= 1; k--) {
            const l = 22 + k * 15 + Math.sin(t * 3 + k) * 6;
            ctx.beginPath(); ctx.arc(cx - l * 0.92, cy + l * 0.42, 14 - k * 1.6, 0, Math.PI * 2);
            ctx.fillStyle = k < 3 ? `rgba(253,224,71,${0.75 - k * 0.12})` : `rgba(249,115,22,${0.55 - k * 0.06})`; ctx.fill();
        }
        ctx.font = `72px ${FUENTE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🚀', cx, cy); ctx.textBaseline = 'alphabetic';
        frames.push({ ctx, delay: 50 });
    }
    coheteCache = await aGif(frames, W, H, { repetir: true });
    return coheteCache;
}

// ---------------------------------------------------------------------------
// 🎲 Dado (1.31.0): rueda por la mesa dando botes y cae en el número.
// ---------------------------------------------------------------------------
const PUNTOS_DADO = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function caraDado(ctx, cx, cy, lado, n, giro = 0) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(giro);
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
    redondeado(ctx, -lado / 2, -lado / 2, lado, lado, lado * 0.2);
    const g = ctx.createLinearGradient(-lado / 2, -lado / 2, lado / 2, lado / 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e2e8f0'); ctx.fillStyle = g; ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.stroke();
    for (const [x, y] of PUNTOS_DADO[n]) {
        ctx.beginPath(); ctx.arc(x * lado * 0.27, y * lado * 0.27, lado * 0.085, 0, Math.PI * 2);
        ctx.fillStyle = n === 1 ? '#dc2626' : '#111827'; ctx.fill();
    }
    ctx.restore();
}
async function gifDado(numeroDado) {
    if (!listo()) return null;
    const W = 300; const H = 240;
    const TOTAL = 38; const frames = []; // 1.31.1: más fotogramas; la cara cambia cada 2
    const caras = [...Array(TOTAL)].map((_, i) => (i >= TOTAL - 9 ? numeroDado : 1 + ((Math.floor(i / 2) * 5 + numeroDado) % 6)));
    for (let f = 0; f < TOTAL; f++) {
        const { ctx } = lienzo(W, H);
        const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W / 1.1);
        g.addColorStop(0, '#166534'); g.addColorStop(1, '#052e16');
        redondeado(ctx, 0, 0, W, H, 22); ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = '#a16207'; ctx.lineWidth = 6; redondeado(ctx, 3, 3, W - 6, H - 6, 20); ctx.stroke();
        const t = Math.min(1, f / (TOTAL - 9));
        const x = 50 + (W / 2 - 50) * facil(t);
        const bote = Math.abs(Math.sin(t * Math.PI * 3)) * 60 * (1 - t);
        const y = H / 2 + 20 - bote;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, H / 2 + 72, 46 - bote / 4, 9, 0, 0, Math.PI * 2); ctx.fill();
        caraDado(ctx, x, y, 96, caras[f], (1 - facil(t)) * Math.PI * 4);
        frames.push({ ctx, delay: f === TOTAL - 1 ? 6000 : t < 1 ? 32 + Math.round(40 * t) : 100 });
    }
    return aGif(frames, W, H);
}

// 🃏 Mesa de «Mayor o menor» (1.25.0): la carta actual grande, las anteriores pequeñas y lo que llevas.
function mesaHilo({ actual, historial = [], mult = 1, estado = 'juega', textos = {} }) {
    if (!canvasLib) return null;
    const W = 640; const H = 300;
    const { c, ctx } = lienzo(W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, W / 1.3);
    g.addColorStop(0, estado === 'pierde' ? '#7f1d1d' : '#1d4ed8'); g.addColorStop(1, '#0b1026');
    redondeado(ctx, 0, 0, W, H, 26); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = 8; redondeado(ctx, 4, 4, W - 8, H - 8, 22); ctx.stroke();
    // Las anteriores (las 6 últimas), pequeñas a la izquierda
    const prev = historial.slice(-6);
    prev.forEach((cc, i) => { ctx.save(); ctx.translate(28 + i * 40, 168); ctx.scale(0.6, 0.6); ctx.globalAlpha = 0.55 + i * 0.07; carta(ctx, 0, 0, cc); ctx.restore(); });
    // La actual, grande en el centro
    ctx.save(); ctx.translate(W / 2 - 54, 40); ctx.scale(1.5, 1.5); carta(ctx, 0, 0, actual); ctx.restore();
    // Multiplicador
    ctx.textAlign = 'right'; ctx.fillStyle = '#fde68a'; ctx.font = `bold 16px ${FUENTE}`;
    ctx.fillText(textos.llevas || 'Llevas', W - 30, 120);
    ctx.font = `900 44px ${FUENTE}`; ctx.fillStyle = estado === 'pierde' ? '#fca5a5' : '#ffffff';
    ctx.fillText(`×${mult}`, W - 30, 168);
    ctx.textAlign = 'center'; ctx.font = `bold 13px ${FUENTE}`; ctx.fillStyle = 'rgba(253,230,138,0.7)';
    ctx.fillText('⬆️  MAYOR  ·  MENOR  ⬇️   ·   A=1 · J=11 · Q=12 · K=13', W / 2, H - 22);
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
async function gifCofre(cofre, companeroId, { nombre = '', rarezaTexto = '', estrellas = 1, nuevo = true, textoNuevo = '¡NUEVA!', variante: opcVariante = null } = {}) {
    if (!listo()) return null;
    const W = 420; const H = 360;
    const comp = K.def(companeroId);
    const rareza = K.RAREZAS[comp.rareza];
    const divina = comp.rareza === 'divina';
    const color = K.COFRES[cofre].color;
    const [bicho, brillo, corona] = await Promise.all([imagenCompanero(companeroId, { humor: 'feliz', variante: opcVariante }), imagen('2728'), imagen('1f451')]);
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
                ctx.fillText(`${nuevo ? `✨ ${textoNuevo} · ` : ''}${rarezaTexto || rareza.es.toUpperCase()}${nuevo ? '' : `  ${'★'.repeat(estrellas)}`}`, W / 2, 36);
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
    // Del Pack anime y de servidores solo se dibujan los 40 más raros que tenga (si no, sería enorme).
    const extras = (coleccion.mascotas || []).map((m) => m.id).filter((id) => K.esExtra(id))
        .sort((a, b) => K.RAREZAS[K.def(b).rareza].orden - K.RAREZAS[K.def(a).rareza].orden).slice(0, 40);
    const ids = [...Object.keys(K.COMPANEROS), ...extras];
    const fotos = new Map(await Promise.all(ids.map(async (id) => [id, await imagenCompanero(id).catch(() => null)])));
    const W = 760; const cols = 8; const celda = 88;
    const filas = Math.ceil(ids.length / cols);
    const H = 90 + filas * (celda + 14) + 20;
    const { c, ctx } = lienzo(W, H);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1e1b4b'); g.addColorStop(1, '#0f172a');
    redondeado(ctx, 0, 0, W, H, 24); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 28px ${FUENTE}`; ctx.textAlign = 'left';
    const tiene = new Map((coleccion.mascotas || []).map((m) => [m.id, m]));
    ctx.fillText(titulo || `Colección · ${tiene.size}`, 28, 52);
    const orden = [...ids].sort((a, b) => (K.esExtra(a) - K.esExtra(b)) || (K.RAREZAS[K.def(a).rareza].orden - K.RAREZAS[K.def(b).rareza].orden));
    for (let i = 0; i < orden.length; i++) {
        const id = orden[i]; const comp = K.def(id); const r = K.RAREZAS[comp.rareza];
        const x = 28 + (i % cols) * (celda + 2); const y = 76 + Math.floor(i / cols) * (celda + 14);
        redondeado(ctx, x, y, celda - 6, celda, 14); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
        ctx.strokeStyle = tiene.has(id) ? r.color : 'rgba(255,255,255,0.12)'; ctx.lineWidth = tiene.has(id) ? 3 : 1.5; ctx.stroke();
        const im = fotos.get(id);
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

// Cartel de la entrada del casino (lobby, 1.23.0): GIF con las bombillas del marco
// encendiéndose en ola, el título de neón, los símbolos de la tragaperras y el bote.
async function bannerCasino({ titulo = 'CASINO', subtitulo = '', boteTexto = '', boteEtiqueta = 'BOTE' } = {}) {
    if (!listo()) return null;
    const W = 900; const H = 300;
    const iconos = await Promise.all(C.SIMBOLOS.map((x) => imagen(x.svg)));
    const NEON = ['#f472b6', '#facc15', '#38bdf8', '#a78bfa', '#4ade80'];
    const frames = [];
    const TOTAL = 12;
    for (let f = 0; f < TOTAL; f++) {
        const { ctx } = lienzo(W, H);
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#3b0710'); g.addColorStop(0.5, '#1c0a24'); g.addColorStop(1, '#0b1026');
        redondeado(ctx, 0, 0, W, H, 28); ctx.fillStyle = g; ctx.fill();
        // Focos de luz que se mueven
        for (let i = 0; i < 3; i++) {
            const x = (W / 4) * (i + 1) + Math.sin((f / TOTAL) * Math.PI * 2 + i) * 40;
            const luz = ctx.createRadialGradient(x, 40, 5, x, 40, 220);
            luz.addColorStop(0, `${NEON[(i + f) % NEON.length]}44`); luz.addColorStop(1, '#00000000');
            ctx.fillStyle = luz; ctx.fillRect(0, 0, W, H);
        }
        // Marco dorado con bombillas que se encienden en ola
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 6; redondeado(ctx, 10, 10, W - 20, H - 20, 22); ctx.stroke();
        const bombillas = [];
        for (let x = 30; x <= W - 30; x += 30) { bombillas.push([x, 10]); bombillas.push([x, H - 10]); }
        for (let y = 40; y <= H - 40; y += 30) { bombillas.push([10, y]); bombillas.push([W - 10, y]); }
        bombillas.forEach(([x, y], i) => {
            const on = (i + f) % 3 === 0;
            ctx.beginPath(); ctx.arc(x, y, on ? 6 : 4.5, 0, Math.PI * 2);
            ctx.fillStyle = on ? '#fff7cc' : '#92400e'; ctx.shadowColor = '#fde047'; ctx.shadowBlur = on ? 14 : 0; ctx.fill();
        });
        ctx.shadowBlur = 0;
        // Título de neón (parpadea un poco)
        ctx.textAlign = 'center';
        ctx.font = `900 76px ${FUENTE}`;
        const brillo = f % 6 === 3 ? 8 : 26;
        ctx.shadowColor = '#f472b6'; ctx.shadowBlur = brillo; ctx.fillStyle = '#ffe4f1';
        ctx.fillText(String(titulo).slice(0, 18), W / 2, 112);
        ctx.shadowBlur = 0;
        if (subtitulo) { ctx.font = `bold 20px ${FUENTE}`; ctx.fillStyle = '#fcd34d'; ctx.fillText(String(subtitulo).slice(0, 60), W / 2, 146); }
        // Símbolos de la tragaperras que saltan por turnos
        const n = iconos.length; const paso = 64; const x0 = W / 2 - ((n - 1) * paso) / 2;
        iconos.forEach((im, i) => {
            if (!im) return;
            const salto = (f % n) === i ? -10 : 0;
            ctx.drawImage(im, x0 + i * paso - 24, 168 + salto, 48, 48);
        });
        // Placa del bote
        if (boteTexto) {
            redondeado(ctx, W / 2 - 190, 228, 380, 52, 26); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
            ctx.strokeStyle = NEON[f % NEON.length]; ctx.lineWidth = 3; ctx.stroke();
            ctx.font = `bold 15px ${FUENTE}`; ctx.fillStyle = '#fde68a'; ctx.fillText(`💎 ${boteEtiqueta}`, W / 2, 249);
            ctx.font = `900 22px ${FUENTE}`; ctx.fillStyle = '#ffffff'; ctx.fillText(String(boteTexto), W / 2, 273);
        }
        frames.push({ ctx, delay: 140 });
    }
    // Este GIF sí se repite: es un cartel.
    return aGif(frames, W, H, { repetir: true });
}

// Las que se dibujan sin esperar (PNG): si algo falla al pintar, null (el juego sigue con texto).
const seguro = (fn) => (...a) => { try { return fn(...a); } catch (e) { console.error(`Arte (${fn.name}):`, e.message); return null; } };
module.exports = { mesaHilo: seguro(mesaHilo), bannerCasino, gifTragaperras, gifRuleta, gifMoneda, mesaBlackjack: seguro(mesaBlackjack), gifBlackjack, graficaCrash: seguro(graficaCrash), pistaCarrera: seguro(pistaCarrera), gifCarrera, gifCohete, gifDado, pastillaResultado, textoResultado, gifCofre, tarjetaColeccion, listo, imagen, imagenCompanero, pintarCompanero, lienzo, redondeado, aGif, facil };
