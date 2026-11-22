// Tarjeta del compañero (1.20.0): el compañero grande, su humor, sus barras de hambre,
// alegría y energía, su nivel de afinidad y un bocadillo con lo que dice. Si se le acaba
// de cuidar, sale como GIF corto con el efecto (corazones, comida, pelota, estrellas).
const { FUENTE } = require('./fonts.js');
const K = require('./cofresNucleo.js');
const A = require('./casinoArte.js');

const W = 760; const H = 380;
const EFECTOS = { mimar: '2764', comer: '1f356', jugar: '1f3be', hablar: '1f4ac', vuelta: '2728', nivel: '2b50' };

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
    const fondo = ctx.createLinearGradient(0, 0, W, H);
    fondo.addColorStop(0, '#0f172a'); fondo.addColorStop(1, '#1e1b4b');
    A.redondeado(ctx, 0, 0, W, H, 26); ctx.fillStyle = fondo; ctx.fill();
    // Halo del color de su rareza
    const halo = ctx.createRadialGradient(170, 200, 20, 170, 200, 190);
    halo.addColorStop(0, `${rz.color}88`); halo.addColorStop(1, `${rz.color}00`);
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 360, H);
    ctx.strokeStyle = rz.color; ctx.lineWidth = 4; A.redondeado(ctx, 2, 2, W - 4, H - 4, 24); ctx.stroke();
    // El compañero: respira (sube y baja) y, si está fuera, sale medio transparente.
    const t = total > 1 ? f / total : 0;
    const salto = efecto === 'jugar' ? -Math.abs(Math.sin(t * Math.PI * 3)) * 30 : Math.sin(t * Math.PI * 2) * 4;
    const tam = 210;
    if (d.fuera) ctx.globalAlpha = 0.35;
    A.pintarCompanero(ctx, img, d.id, 170 - tam / 2, 205 - tam / 2 + salto, tam, rz.color);
    ctx.globalAlpha = 1;
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
    ctx.fillText(`${d.rarezaTexto}  ${'★'.repeat(d.estrellas || 1)}`, X, 76);
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
}

async function tarjeta(d, efecto = null) {
    if (!A.listo()) return null;
    const img = await A.imagenCompanero(d.id);
    const imgEfecto = efecto && EFECTOS[efecto] ? await A.imagen(EFECTOS[efecto]) : null;
    if (!imgEfecto) {
        const { c, ctx } = A.lienzo(W, H);
        await dibujar(ctx, d, 0, 1, null, null, img);
        return { buffer: c.toBuffer('image/png'), nombre: 'compi.png' };
    }
    const TOTAL = 18; const frames = [];
    for (let f = 0; f < TOTAL; f++) {
        const { ctx } = A.lienzo(W, H);
        await dibujar(ctx, d, f, TOTAL, efecto, imgEfecto, img);
        frames.push({ ctx, delay: f === TOTAL - 1 ? 6000 : 70 });
    }
    return { buffer: A.aGif(frames, W, H), nombre: 'compi.gif' };
}

module.exports = { tarjeta, EFECTOS };
