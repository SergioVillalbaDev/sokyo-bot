// Tarjeta de la mascota (imagen PNG) con @napi-rs/canvas: la criatura (dibujos de
// Twemoji en assets/mascota, CC-BY 4.0), su aura del color de su especie o forma,
// la fase, el nivel y sus tres barras. Si falta la librería, devuelve null y el
// bot usa solo el embed.
const fs = require('fs');
const path = require('path');
const { FUENTE } = require('./fonts.js');
const N = require('./mascotaNucleo.js');
const { t } = require('./i18n.js');

let canvasLib = null;
try { canvasLib = require('@napi-rs/canvas'); } catch { canvasLib = null; }

const W = 900;
const H = 340;
const DIR = path.join(__dirname, '..', 'assets', 'mascota');
const imagenes = new Map();

async function imagen(svg) {
    if (imagenes.has(svg)) return imagenes.get(svg);
    const ruta = path.join(DIR, `${svg}.svg`);
    const img = fs.existsSync(ruta) ? await canvasLib.loadImage(fs.readFileSync(ruta)).catch(() => null) : null;
    imagenes.set(svg, img);
    return img;
}

function redondeado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function barra(ctx, x, y, w, etiqueta, valor, color) {
    ctx.fillStyle = '#c7cbe0';
    ctx.font = `bold 20px ${FUENTE}`;
    ctx.fillText(etiqueta, x, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(valor)}%`, x + w, y);
    ctx.textAlign = 'left';
    redondeado(ctx, x, y + 10, w, 14, 7);
    ctx.fillStyle = '#2a2d40'; ctx.fill();
    const v = Math.max(0, Math.min(100, valor)) / 100;
    if (v > 0) {
        redondeado(ctx, x, y + 10, Math.max(14, w * v), 14, 7);
        ctx.fillStyle = color; ctx.fill();
    }
}

// Color de una barra según lo llena que esté.
const colorBarra = (v) => (v >= 60 ? '#22c55e' : v >= 30 ? '#f59e0b' : '#ef4444');

async function generarTarjeta(m, idioma = 'es') {
    if (!canvasLib) return null;
    const c = canvasLib.createCanvas(W, H);
    const ctx = c.getContext('2d');
    const esp = N.ESPECIES[m.especie] || null;
    const forma = m.forma ? N.FORMAS[m.forma] : null;
    const fase = N.faseDe(m);
    const animo = N.animoDe(m);
    const acento = (forma && forma.color) || (esp && esp.color) || '#a78bfa';

    // Fondo
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#171a2b'); g.addColorStop(1, '#22263a');
    redondeado(ctx, 0, 0, W, H, 28); ctx.fillStyle = g; ctx.fill();

    // Aura
    const cx = 170; const cy = H / 2;
    const aura = ctx.createRadialGradient(cx, cy, 20, cx, cy, 160);
    aura.addColorStop(0, `${acento}aa`); aura.addColorStop(0.6, `${acento}33`); aura.addColorStop(1, `${acento}00`);
    ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, 160, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `${acento}cc`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, 118, 0, Math.PI * 2); ctx.stroke();

    // La criatura (más grande según la fase)
    const tam = { huevo: 150, cria: 130, joven: 160, adulta: 185, legendaria: 200 }[fase.id] || 160;
    const dibujo = await imagen(m.estado === 'huevo' || !esp ? '1f95a' : esp.svg);
    if (dibujo) {
        if (animo === 'hibernando') ctx.globalAlpha = 0.45;
        ctx.drawImage(dibujo, cx - tam / 2, cy - tam / 2, tam, tam);
        ctx.globalAlpha = 1;
    }
    // Detalles: corona, forma, zzz, enferma, brillos
    const extra = async (svg, x, y, s) => { const i = await imagen(svg); if (i) ctx.drawImage(i, x, y, s, s); };
    if (fase.id === 'legendaria') await extra('1f451', cx - 36, cy - tam / 2 - 52, 72);
    if (forma) await extra(forma.svg, cx + 70, cy + 60, 52);
    if (animo === 'hibernando') await extra('1f4a4', cx + 60, cy - 110, 56);
    if (animo === 'enferma') await extra('1f912', cx + 62, cy - 100, 52);
    if (animo === 'feliz') { await extra('2728', cx - 120, cy - 100, 40); await extra('2728', cx + 85, cy - 70, 30); }

    // Textos
    const x0 = 360;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 46px ${FUENTE}`;
    const nombre = m.estado === 'huevo' ? t(idioma, 'Un huevo misterioso', 'A mysterious egg') : (m.nombre || (esp && esp.nombre) || '???');
    ctx.fillText(nombre.slice(0, 22), x0, 78);
    ctx.font = `bold 22px ${FUENTE}`;
    ctx.fillStyle = acento;
    const linea = m.estado === 'huevo'
        ? t(idioma, '🥚 Votad su especie y su nombre', '🥚 Vote for its species and name')
        : `${esp ? t(idioma, esp.es, esp.en) : ''} · ${t(idioma, fase.es, fase.en)}${forma ? ` ${t(idioma, forma.es, forma.en)}` : ''} · ${t(idioma, 'Nivel', 'Level')} ${m.nivel}`;
    ctx.fillText(linea, x0, 114);

    if (m.estado === 'huevo') {
        ctx.fillStyle = '#c7cbe0'; ctx.font = `20px ${FUENTE}`;
        ctx.fillText(t(idioma, 'Va a nacer pronto. Cuidadla entre todos.', 'It’s about to hatch. Look after it together.'), x0, 160);
    } else {
        // XP
        const necesaria = N.xpParaSubir(m.nivel);
        const w = 490;
        redondeado(ctx, x0, 132, w, 10, 5); ctx.fillStyle = '#2a2d40'; ctx.fill();
        const p = m.nivel >= N.NIVEL_MAX ? 1 : Math.min(1, (m.xp || 0) / necesaria);
        if (p > 0) { redondeado(ctx, x0, 132, Math.max(10, w * p), 10, 5); ctx.fillStyle = acento; ctx.fill(); }
        barra(ctx, x0, 186, w, `🍖 ${t(idioma, 'Comida', 'Food')}`, m.hambre, colorBarra(m.hambre));
        barra(ctx, x0, 240, w, `😊 ${t(idioma, 'Alegría', 'Joy')}`, m.alegria, colorBarra(m.alegria));
        barra(ctx, x0, 294, w, `❤️ ${t(idioma, 'Salud', 'Health')}`, m.salud, colorBarra(m.salud));
    }
    return c.toBuffer('image/png');
}

module.exports = { generarTarjeta };
