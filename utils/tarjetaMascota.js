// Tarjeta de la mascota (imagen PNG) con @napi-rs/canvas: su hábitat de fondo, la
// criatura (dibujos de Twemoji en assets/mascota, CC-BY 4.0) con su accesorio, su aura
// del color de su especie o forma, la fase, la personalidad, el nivel, sus cuatro barras
// y sus atributos. Si falta la librería, devuelve null y el bot usa solo el embed.
const fs = require('fs');
const path = require('path');
const { FUENTE } = require('./fonts.js');
const N = require('./mascotaNucleo.js');
const X = require('./mascotaExtras.js');
const { t } = require('./i18n.js');

let canvasLib = null;
try { canvasLib = require('@napi-rs/canvas'); } catch { canvasLib = null; }

const W = 960;
const H = 400;
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

const colorBarra = (v) => (v >= 60 ? '#22c55e' : v >= 30 ? '#f59e0b' : '#ef4444');

function barra(ctx, x, y, w, etiqueta, valor, color) {
    ctx.fillStyle = '#d4d8ec';
    ctx.font = `bold 19px ${FUENTE}`;
    ctx.textAlign = 'left';
    ctx.fillText(etiqueta, x, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(valor)}%`, x + w, y);
    ctx.textAlign = 'left';
    redondeado(ctx, x, y + 9, w, 12, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
    const v = Math.max(0, Math.min(100, valor)) / 100;
    if (v > 0) { redondeado(ctx, x, y + 9, Math.max(12, w * v), 12, 6); ctx.fillStyle = color; ctx.fill(); }
}

function pastilla(ctx, x, y, texto, fondo) {
    ctx.font = `bold 17px ${FUENTE}`;
    const w = ctx.measureText(texto).width + 22;
    redondeado(ctx, x, y, w, 30, 15);
    ctx.fillStyle = fondo; ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(texto, x + 11, y + 21);
    return w;
}

async function generarTarjeta(m, idioma = 'es') {
    if (!canvasLib) return null;
    const c = canvasLib.createCanvas(W, H);
    const ctx = c.getContext('2d');
    const esp = N.ESPECIES[m.especie] || null;
    const forma = m.forma ? N.FORMAS[m.forma] : null;
    const fase = N.faseDe(m);
    const animo = N.animoDe(m);
    const acento = (forma && forma.color) || (esp && esp.color) || '#a78bfa';
    const hab = X.HABITATS[m.habitat || 'prado'] || X.HABITATS.prado;

    // Fondo: el hábitat a la izquierda, oscuro a la derecha para leer bien.
    redondeado(ctx, 0, 0, W, H, 28);
    ctx.save(); ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, hab.fondo[0]); g.addColorStop(1, hab.fondo[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const velo = ctx.createLinearGradient(300, 0, W, 0);
    velo.addColorStop(0, 'rgba(15,17,30,0)'); velo.addColorStop(0.25, 'rgba(15,17,30,0.88)'); velo.addColorStop(1, 'rgba(15,17,30,0.96)');
    ctx.fillStyle = velo; ctx.fillRect(0, 0, W, H);
    // Decoración del hábitat
    const [d1, d2] = await Promise.all(hab.decor.map(imagen));
    ctx.globalAlpha = 0.9;
    if (d1) ctx.drawImage(d1, 14, H - 104, 90, 90);
    if (d2) ctx.drawImage(d2, 250, 22, 54, 54);
    if (d2) ctx.drawImage(d2, 270, H - 80, 38, 38);
    ctx.globalAlpha = 1;
    ctx.restore();

    // Aura
    const cx = 175; const cy = H / 2 + 6;
    const aura = ctx.createRadialGradient(cx, cy, 20, cx, cy, 165);
    aura.addColorStop(0, `${acento}99`); aura.addColorStop(0.6, `${acento}2a`); aura.addColorStop(1, `${acento}00`);
    ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, 165, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `${acento}cc`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, 128, 0, Math.PI * 2); ctx.stroke();

    // La criatura, con su accesorio
    const tam = { huevo: 160, cria: 140, joven: 170, adulta: 195, legendaria: 210 }[fase.id] || 170;
    const x0 = cx - tam / 2; const y0 = cy - tam / 2;
    // 1.32.0: dibujo propio de cada especie (utils/sprites.js), con su etapa y su humor; el huevo también.
    const SPR = require('./sprites.js');
    const propio = m.estado !== 'huevo' && esp && SPR.tiene(`srv:${m.especie}`);
    if (m.estado === 'huevo' || !esp) {
        const hc = canvasLib.createCanvas(SPR.TAM, SPR.TAM);
        SPR.huevo(hc.getContext('2d'), { color: '#fef3c7', manchas: '#c4b5fd', grietas: m.estado === 'huevo' ? 0.5 : 0 });
        ctx.drawImage(hc, cx - 95, cy - 100, 190, 190);
    } else if (propio) {
        const etapa = { cria: 0, joven: 1, adulta: 2, legendaria: 2 }[fase.id] ?? 1;
        const humor = { hibernando: 'dormido', enferma: 'enfermo', feliz: 'feliz', hambrienta: 'hambre', triste: 'aburrido', cansada: 'cansado' }[animo] || 'normal';
        const s = Math.round(tam * 1.25);
        ctx.drawImage(SPR.imagen(`srv:${m.especie}`, { etapa, humor, variante: m.variante || null }), cx - s / 2, cy - s / 2 - 8, s, s);
    } else {
        const dibujo = await imagen(esp.svg);
        if (dibujo) {
            if (animo === 'hibernando') ctx.globalAlpha = 0.45;
            ctx.drawImage(dibujo, x0, y0, tam, tam);
            ctx.globalAlpha = 1;
        }
    }
    const extra = async (svg, x, y, s) => { const i = await imagen(svg); if (i) ctx.drawImage(i, x, y, s, s); };
    const acc = m.estado === 'viva' && m.accesorio ? X.ACCESORIOS[m.accesorio] : null;
    if (acc && esp && propio) {
        const etapa = { cria: 0, joven: 1, adulta: 2, legendaria: 2 }[fase.id] ?? 1;
        const S = Math.round(tam * 1.25); const a = SPR.anclas(`srv:${m.especie}`, etapa)[acc.slot];
        const sz = S * X.TAM_ACCESORIO[acc.slot] * 0.75 * a.k;
        await extra(acc.svg, cx - S / 2 + S * a.x - sz / 2, cy - S / 2 - 8 + S * a.y - sz / 2, sz);
    } else if (acc && esp) {
        const pos = (X.POSICIONES[m.especie] || X.POSICIONES.zorro)[acc.slot];
        const s = tam * X.TAM_ACCESORIO[acc.slot];
        await extra(acc.svg, x0 + tam * pos.x - s / 2, y0 + tam * pos.y - s / 2, s);
    } else if (fase.id === 'legendaria' && propio) {
        const S = Math.round(tam * 1.25); const a = SPR.anclas(`srv:${m.especie}`, 2).cabeza;
        await extra('1f451', cx - S / 2 + S * a.x - 32, cy - S / 2 - 8 + S * a.y - 40, 64);
    } else if (fase.id === 'legendaria') {
        await extra('1f451', cx - 36, y0 - 44, 72);
    }
    if (forma) await extra(forma.svg, cx + 78, cy + 66, 50);
    if (!propio && animo === 'hibernando') await extra('1f4a4', cx + 66, cy - 120, 54);
    if (!propio && animo === 'enferma') await extra('1f912', cx + 70, cy - 112, 50);
    if (animo === 'feliz') { await extra('2728', cx - 128, cy - 104, 38); await extra('2728', cx + 92, cy - 76, 28); }

    // Textos
    const tx = 380;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 46px ${FUENTE}`;
    const nombre = m.estado === 'huevo' ? t(idioma, 'Un huevo misterioso', 'A mysterious egg') : (m.nombre || (esp && esp.nombre) || '???');
    ctx.fillText(nombre.slice(0, 20), tx, 70);
    ctx.font = `bold 21px ${FUENTE}`;
    ctx.fillStyle = acento;
    const linea = m.estado === 'huevo'
        ? t(idioma, '🥚 Votad su especie y su nombre', '🥚 Vote for its species and name')
        : `${esp ? t(idioma, esp.es, esp.en) : ''} · ${t(idioma, fase.es, fase.en)}${forma ? ` ${t(idioma, forma.es, forma.en)}` : ''} · ${t(idioma, 'Nivel', 'Level')} ${m.nivel}`;
    ctx.fillText(linea, tx, 104);

    if (m.estado === 'huevo') {
        ctx.fillStyle = '#c7cbe0'; ctx.font = `20px ${FUENTE}`;
        ctx.fillText(t(idioma, 'Va a nacer pronto. Cuidadla entre todos.', 'It’s about to hatch. Look after it together.'), tx, 150);
        return c.toBuffer('image/png');
    }
    // Personalidad y logros
    let px = tx;
    const per = X.PERSONALIDADES[m.personalidad];
    if (per) px += pastilla(ctx, px, 120, `${per.emoji} ${t(idioma, per.es, per.en)}`, 'rgba(255,255,255,0.12)') + 8;
    if ((m.logros || []).length) pastilla(ctx, px, 120, `🏆 ${(m.logros || []).length}/${X.LOGROS.length}`, 'rgba(245,158,11,0.30)');

    // XP
    const w = 540;
    const necesaria = N.xpParaSubir(m.nivel);
    redondeado(ctx, tx, 164, w, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
    const p = m.nivel >= N.NIVEL_MAX ? 1 : Math.min(1, (m.xp || 0) / necesaria);
    if (p > 0) { redondeado(ctx, tx, 164, Math.max(8, w * p), 8, 4); ctx.fillStyle = acento; ctx.fill(); }

    // Cuatro barras (2×2)
    const bw = 258;
    barra(ctx, tx, 214, bw, `🍖 ${t(idioma, 'Comida', 'Food')}`, m.hambre, colorBarra(m.hambre));
    barra(ctx, tx + bw + 24, 214, bw, `😊 ${t(idioma, 'Alegría', 'Joy')}`, m.alegria, colorBarra(m.alegria));
    barra(ctx, tx, 270, bw, `❤️ ${t(idioma, 'Salud', 'Health')}`, m.salud, colorBarra(m.salud));
    barra(ctx, tx + bw + 24, 270, bw, `⚡ ${t(idioma, 'Energía', 'Energy')}`, m.energia ?? 100, '#38bdf8');

    // Atributos
    const st = m.stats || {};
    let sx = tx;
    for (const [k, v] of Object.entries(X.STATS)) {
        sx += pastilla(ctx, sx, 328, `${v.emoji} ${t(idioma, v.es, v.en)} ${st[k] || 5}`, 'rgba(255,255,255,0.10)') + 8;
    }
    pastilla(ctx, sx, 328, `💪 ${N.poderDe(m)}`, `${acento}88`);
    return c.toBuffer('image/png');
}

module.exports = { generarTarjeta };
