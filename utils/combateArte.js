// Dibujos de los combates (1.32.0, animaciones rehechas en 2.2.0): la arena (PNG) con los dos
// luchadores, su vida, su energía y sus estados; la animación de cada ronda (GIF): se preparan,
// embisten dejando estela, el golpe congela un instante con destello blanco, salen chispas del
// color de su elemento y el número salta; el especial tiene su presentación y un ataque propio
// de cada elemento (bola de fuego, rayo del cielo, rocas, hojas…); las cartas aparecen, se giran
// y lanzan su técnica; la vida baja con una barra «fantasma» detrás; y si alguien cae, K.O.,
// el ganador salta y llueve confeti. La tarjeta de perfil de combate y el jefe semanal también.
// Si falta canvas, todo devuelve null y el combate sigue con texto.
const { FUENTE } = require('./fonts.js');
const A = require('./casinoArte.js');
const SPR = require('./sprites.js');
const K = require('./cofresNucleo.js');
const C = require('./combateNucleo.js');

const W = 720; const H = 400;
const ICONOS = { quema: '🔥', maldito: '💀', aturdido: '❄️', confuso: '💫', ataque: '⚔️', defensa: '🛡️', veloz: '💨', debil: '🥀', roto: '💔', lento: '🐌', regenera: '🌿', esquivar: '👻' };
const POS = { a: 175, b: 545 };   // centro de cada luchador
const PIES = 352;                  // donde pisan
const TAM = 210;                   // tamaño de un luchador (el jefe, algo más)
const PI2 = Math.PI * 2;

// Imagen de un luchador: su dibujo propio (con etapa y humor, sin la sombra: la pone la arena)
// o la foto (anime / del servidor).
async function retrato(id, { nivel = 20, humor = 'normal', variante = null } = {}) {
    if (SPR.tiene(id)) return SPR.imagen(id, { etapa: id.startsWith('jefe:') ? 2 : SPR.etapaDe(nivel), humor, variante, sombra: false });
    return A.imagenCompanero(id).catch(() => null);
}
// Capa de un luchador a su tamaño, con sus versiones en blanco (destello del golpe), en rojo
// (daño) y en azul hielo. Solo se tiñe el dibujo, no un cuadrado (antes salía un cuadrado rojo).
const capas = new WeakMap();
function capaLuchador(img, id, tam) {
    if (!img) return null;
    let m = capas.get(img);
    if (!m) { m = new Map(); capas.set(img, m); }
    if (m.has(tam)) return m.get(tam);
    const { c: base, ctx } = A.lienzo(tam, tam);
    if (img._sprite) ctx.drawImage(img, 0, 0, tam, tam);
    else A.pintarCompanero(ctx, img, id, tam * 0.16, tam * 0.2, tam * 0.68, '#ffffff');
    const tenida = (color) => {
        const { c, ctx: x } = A.lienzo(tam, tam);
        x.drawImage(base, 0, 0);
        x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, tam, tam);
        return c;
    };
    const r = { base, tam, blanco: tenida('#ffffff'), rojo: tenida('#ef4444'), hielo: tenida('#7dd3fc') };
    m.set(tam, r);
    return r;
}
// Compatibilidad: pinta un luchador centrado en (cx, cy).
function pintarLuchador(ctx, img, id, cx, cy, tam, { espejo = false, alfa = 1, rojo = 0 } = {}) {
    const capa = capaLuchador(img, id, Math.round(tam));
    if (!capa) return;
    ctx.save(); ctx.globalAlpha = alfa; ctx.translate(cx, cy); if (espejo) ctx.scale(-1, 1);
    ctx.drawImage(capa.base, -tam / 2, -tam / 2, tam, tam);
    if (rojo > 0) { ctx.globalAlpha = alfa * rojo; ctx.drawImage(capa.rojo, -tam / 2, -tam / 2, tam, tam); }
    ctx.restore();
}
function texto(ctx, s, x, y, { tam = 16, color = '#fff', alin = 'left', peso = 'bold', borde = null, max } = {}) {
    ctx.font = `${peso} ${tam}px ${FUENTE}`; ctx.textAlign = alin;
    if (borde) { ctx.lineWidth = Math.max(3, tam / 5); ctx.strokeStyle = borde; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y, max); }
    ctx.fillStyle = color; ctx.fillText(s, x, y, max);
}
const colorVida = (p) => (p > 0.5 ? '#22c55e' : p > 0.25 ? '#f59e0b' : '#ef4444');
const colorEl = (el) => C.ELEMENTOS[el]?.color || '#a78bfa';
const sube = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);   // frena al final
const entra = (t) => Math.pow(Math.max(0, Math.min(1, t)), 2);          // acelera
function azarDe(semilla) { let x = (semilla * 9301 + 49297) % 233280; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }
function hexA(c, a) {
    const h = String(c).replace('#', ''); const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6);
    return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${a})`;
}

// ---------------------------------------------------------------------------
// Fondo (se pinta una vez y se reutiliza en cada fotograma: así va rápido en la Raspberry Pi)
// ---------------------------------------------------------------------------
const fondos = new Map();
function fondoArena(elA, elB) {
    const clave = `${elA}|${elB}`;
    if (fondos.has(clave)) return fondos.get(clave);
    const { c, ctx } = A.lienzo(W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#070b1a'); g.addColorStop(0.7, '#1b1747'); g.addColorStop(1, '#0d0b24');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Estrellas fijas
    const r = azarDe(elA.length * 31 + elB.length * 7);
    for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(226,232,240,${0.15 + r() * 0.5})`; ctx.beginPath(); ctx.arc(r() * W, r() * H * 0.62, r() * 1.6 + 0.3, 0, PI2); ctx.fill(); }
    // Luz de cada elemento en su mitad
    for (const [el, x] of [[elA, 120], [elB, W - 120]]) {
        const rr = ctx.createRadialGradient(x, H * 0.66, 10, x, H * 0.66, W * 0.5);
        rr.addColorStop(0, hexA(colorEl(el), 0.42)); rr.addColorStop(1, hexA(colorEl(el), 0)); ctx.fillStyle = rr; ctx.fillRect(0, 0, W, H);
    }
    // Suelo en perspectiva con brillo en el centro
    const y0 = 292;
    const s = ctx.createLinearGradient(0, y0, 0, H); s.addColorStop(0, 'rgba(148,163,184,0.16)'); s.addColorStop(1, 'rgba(148,163,184,0.03)');
    ctx.fillStyle = s; ctx.fillRect(0, y0, W, H - y0);
    ctx.strokeStyle = 'rgba(165,180,252,0.18)'; ctx.lineWidth = 1.5;
    for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 26, y0); ctx.lineTo(W / 2 + i * 120, H); ctx.stroke(); }
    for (let j = 0; j < 5; j++) { const yy = y0 + Math.pow(j / 5, 1.7) * (H - y0); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(199,210,254,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
    // Plataformas brillantes bajo cada luchador
    for (const [el, x] of [[elA, POS.a], [elB, POS.b]]) {
        const e = ctx.createRadialGradient(x, PIES, 4, x, PIES, 110); e.addColorStop(0, hexA(colorEl(el), 0.35)); e.addColorStop(1, hexA(colorEl(el), 0));
        ctx.fillStyle = e; ctx.beginPath(); ctx.ellipse(x, PIES, 120, 24, 0, 0, PI2); ctx.fill();
        ctx.strokeStyle = hexA(colorEl(el), 0.55); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, PIES, 92, 16, 0, 0, PI2); ctx.stroke();
    }
    // Viñeta
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    fondos.set(clave, c);
    if (fondos.size > 30) fondos.delete(fondos.keys().next().value);
    return c;
}

// Panel de un luchador (arriba): nombre, nivel, elemento, vida (con la barra «fantasma» que se
// vacía detrás), escudo, energía y estados.
function panel(ctx, l, lado, hp, fantasma) {
    const PW = 300; const x = lado === 'a' ? 16 : W - 16 - PW; const y = 14;
    const el = C.ELEMENTOS[l.el];
    ctx.save();
    ctx.fillStyle = 'rgba(2,6,23,0.78)'; A.redondeado(ctx, x, y, PW, 84, 16); ctx.fill();
    ctx.strokeStyle = hexA(colorEl(l.el), 0.7); ctx.lineWidth = 2; A.redondeado(ctx, x + 1, y + 1, PW - 2, 82, 15); ctx.stroke();
    // Chapa del elemento
    ctx.fillStyle = hexA(colorEl(l.el), 0.25); ctx.beginPath(); ctx.arc(x + 26, y + 24, 15, 0, PI2); ctx.fill();
    texto(ctx, el?.emoji || '✨', x + 26, y + 30, { tam: 16, alin: 'center', peso: 'normal' });
    texto(ctx, String(l.nombre).slice(0, 18), x + 48, y + 30, { tam: 18, max: 190 });
    if (l.nivel) texto(ctx, `Nv ${l.nivel}`, x + PW - 14, y + 30, { tam: 14, color: '#c4b5fd', alin: 'right' });
    const bx = x + 14; const by = y + 42; const bw = PW - 28;
    const p = Math.max(0, Math.min(1, hp / l.max)); const pf = Math.max(p, Math.min(1, (fantasma ?? hp) / l.max));
    A.redondeado(ctx, bx, by, bw, 16, 8); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
    if (pf > p + 0.002) { A.redondeado(ctx, bx, by, Math.max(16, bw * pf), 16, 8); ctx.fillStyle = '#fde68a'; ctx.fill(); }
    if (p > 0) {
        A.redondeado(ctx, bx, by, Math.max(16, bw * p), 16, 8);
        const gv = ctx.createLinearGradient(0, by, 0, by + 16); gv.addColorStop(0, '#ffffff55'); gv.addColorStop(0.45, colorVida(p)); gv.addColorStop(1, colorVida(p));
        ctx.fillStyle = gv; ctx.fill();
    }
    if (l.escudo > 0) { A.redondeado(ctx, bx, by, Math.max(10, bw * Math.min(1, l.escudo / l.max)), 16, 8); ctx.fillStyle = 'rgba(147,197,253,0.6)'; ctx.fill(); }
    texto(ctx, `${Math.max(0, Math.round(hp))} / ${l.max}`, x + PW / 2, by + 13, { tam: 12, alin: 'center', borde: 'rgba(0,0,0,0.65)' });
    // Energía (rombos): dorados cuando hay para el especial
    for (let i = 0; i < C.ENERGIA_MAX; i++) {
        const ex = x + 22 + i * 18; const ey = y + 72; const lleno = i < l.energia;
        ctx.beginPath(); ctx.moveTo(ex, ey - 7); ctx.lineTo(ex + 6, ey); ctx.lineTo(ex, ey + 7); ctx.lineTo(ex - 6, ey); ctx.closePath();
        ctx.fillStyle = lleno ? (l.energia >= C.ENERGIA_ESPECIAL ? '#facc15' : '#38bdf8') : 'rgba(255,255,255,0.12)'; ctx.fill();
    }
    const est = Object.entries(l.efectos || {}).filter(([, v]) => v && v.rondas > 0).map(([k]) => ICONOS[k]).filter(Boolean);
    texto(ctx, est.join(' '), x + PW - 14, y + 78, { tam: 15, alin: 'right', peso: 'normal' });
    ctx.restore();
}


// ---------------------------------------------------------------------------
// Efectos: chispas, proyectiles de cada elemento, impactos, escudo, curas y estados
// ---------------------------------------------------------------------------
// Chispas que salen de (x, y) en todas direcciones. k = 0..1.
function chispas(ctx, x, y, k, color, { n = 14, alcance = 90, tam = 5, semilla = 1, gravedad = 0 } = {}) {
    const r = azarDe(semilla);
    ctx.save();
    for (let i = 0; i < n; i++) {
        const a = r() * PI2; const v = 0.45 + r() * 0.55; const d = sube(k) * alcance * v;
        const px = x + Math.cos(a) * d; const py = y + Math.sin(a) * d + gravedad * k * k * 60;
        ctx.globalAlpha = Math.max(0, 1 - k) * (0.6 + r() * 0.4);
        ctx.fillStyle = i % 3 === 0 ? '#ffffff' : color;
        ctx.beginPath(); ctx.arc(px, py, Math.max(0.5, tam * (1 - k * 0.7) * (0.6 + r() * 0.6)), 0, PI2); ctx.fill();
    }
    ctx.restore();
}
// Estrella de impacto (picos) + anillo que se abre.
function estallido(ctx, x, y, k, color, tam = 70) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.translate(x, y); ctx.rotate(k * 0.6);
    const R = tam * (0.6 + sube(k) * 0.7);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * PI2; const rr = i % 2 ? R * 0.42 : R; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, R); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#fff7d6'); g.addColorStop(1, hexA(color, 0.15));
    ctx.fillStyle = g; ctx.fill();
    ctx.globalAlpha = Math.max(0, 0.8 - k);
    ctx.strokeStyle = color; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(0, 0, R * 1.15, 0, PI2); ctx.stroke();
    ctx.restore();
}
// Líneas de velocidad (detrás de quien embiste).
function rafaga(ctx, x, y, dir, k, color = '#ffffff') {
    ctx.save(); ctx.globalAlpha = 0.55 * (1 - k); ctx.strokeStyle = color; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const yy = y - 70 + i * 26; const L = 50 + (i % 3) * 25; ctx.lineWidth = 3 - (i % 2); ctx.beginPath(); ctx.moveTo(x - dir * (60 + (i % 2) * 20), yy); ctx.lineTo(x - dir * (60 + L + (i % 2) * 20), yy); ctx.stroke(); }
    ctx.restore();
}
// Rayo en zigzag (de arriba al objetivo).
function rayo(ctx, x, y0, y1, semilla, grosor = 6) {
    const r = azarDe(semilla);
    const pts = [[x + (r() - 0.5) * 40, y0]];
    const n = 7;
    for (let i = 1; i < n; i++) pts.push([x + (r() - 0.5) * 50, y0 + ((y1 - y0) * i) / n]);
    pts.push([x, y1]);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, col] of [[grosor * 3.2, 'rgba(250,204,21,0.35)'], [grosor, '#facc15'], [grosor * 0.4, '#ffffff']]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
    ctx.restore();
}
function hoja(ctx, x, y, rot, tam, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath(); ctx.moveTo(-tam, 0); ctx.quadraticCurveTo(0, -tam * 0.7, tam, 0); ctx.quadraticCurveTo(0, tam * 0.7, -tam, 0); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = 'rgba(20,83,45,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-tam * 0.8, 0); ctx.lineTo(tam * 0.8, 0); ctx.stroke();
    ctx.restore();
}
function roca(ctx, x, y, tam, rot, semilla) {
    const r = azarDe(semilla);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = (i / 7) * PI2; const rr = tam * (0.75 + r() * 0.35); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
    const g = ctx.createLinearGradient(-tam, -tam, tam, tam); g.addColorStop(0, '#d6a663'); g.addColorStop(1, '#713f12');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#422006'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
}
function orbe(ctx, x, y, R, color, nucleo = '#ffffff') {
    const g = ctx.createRadialGradient(x, y, 1, x, y, R * 1.8);
    g.addColorStop(0, nucleo); g.addColorStop(0.3, color); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 1.8, 0, PI2); ctx.fill();
}
// El ataque especial de cada elemento viajando de (x0) a (x1). k = 0..1.
function proyectil(ctx, el, x0, x1, y, k, semilla) {
    const col = colorEl(el); const dir = Math.sign(x1 - x0) || 1;
    const x = x0 + (x1 - x0) * entra(k);
    ctx.save();
    if (el === 'fuego') {
        for (let i = 5; i >= 0; i--) orbe(ctx, x - dir * i * 16, y + Math.sin(i + k * 9) * 5, 20 - i * 2.6, i ? '#f97316' : '#fb923c', i ? '#fdba74' : '#fff7ed');
        chispas(ctx, x - dir * 30, y, k, '#fbbf24', { n: 8, alcance: 30, tam: 3, semilla });
    } else if (el === 'agua') {
        orbe(ctx, x, y, 22, '#38bdf8', '#e0f2fe');
        for (let i = 1; i < 6; i++) { ctx.fillStyle = hexA('#7dd3fc', 0.8 - i * 0.12); ctx.beginPath(); ctx.arc(x - dir * i * 18, y + Math.sin(i * 2 + k * 8) * 10, 7 - i, 0, PI2); ctx.fill(); }
    } else if (el === 'planta') {
        for (let i = 0; i < 7; i++) { const a = k * 10 + i * 0.9; hoja(ctx, x - dir * i * 12 + Math.cos(a) * 14, y + Math.sin(a) * 22, a, 11, i % 2 ? '#4ade80' : '#86efac'); }
    } else if (el === 'luz') {
        const g = ctx.createLinearGradient(x0, 0, x, 0); g.addColorStop(0, 'rgba(254,240,138,0)'); g.addColorStop(1, 'rgba(254,249,195,0.95)');
        ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(x0 + dir * 50, y); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x0 + dir * 50, y); ctx.lineTo(x, y); ctx.stroke();
        orbe(ctx, x, y, 18, '#fde68a');
    } else if (el === 'sombra') {
        for (let i = 0; i < 3; i++) { const a = k * 12 + (i * PI2) / 3; orbe(ctx, x + Math.cos(a) * 18, y + Math.sin(a) * 18, 13, '#7c3aed', '#c4b5fd'); }
        ctx.globalAlpha = 0.5; orbe(ctx, x - dir * 26, y, 24, '#4c1d95', '#a78bfa');
    } else {
        orbe(ctx, x, y, 20, col);
    }
    ctx.restore();
}
// Lo que pasa al llegar el especial (o una carta) al objetivo.
function impacto(ctx, el, x, y, k, semilla, colorForzado = null) {
    const col = colorForzado || colorEl(el);
    if (el === 'agua') {
        ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 5;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y + 60, 30 + sube(k) * (50 + i * 25), 8 + sube(k) * (10 + i * 4), 0, 0, PI2); ctx.stroke(); }
        ctx.restore();
        chispas(ctx, x, y, k, '#38bdf8', { n: 18, alcance: 100, tam: 6, semilla, gravedad: 1.4 });
    } else if (el === 'planta') {
        const r = azarDe(semilla);
        for (let i = 0; i < 10; i++) { const a = r() * PI2; const d = sube(k) * (50 + r() * 60); ctx.save(); ctx.globalAlpha = 1 - k; hoja(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d + k * 30, a + k * 6, 10, i % 2 ? '#4ade80' : '#bbf7d0'); ctx.restore(); }
    } else if (el === 'tierra') {
        ctx.save(); ctx.globalAlpha = 0.7 * (1 - k);
        for (let i = 0; i < 6; i++) { const gx = x - 70 + i * 28; const gr = ctx.createRadialGradient(gx, y + 70, 2, gx, y + 70, 26 + k * 30); gr.addColorStop(0, 'rgba(214,166,99,0.8)'); gr.addColorStop(1, 'rgba(214,166,99,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, y + 70 - k * 20, 26 + k * 30, 0, PI2); ctx.fill(); }
        ctx.restore();
    } else if (el === 'sombra') {
        ctx.save(); ctx.globalAlpha = 0.8 * (1 - k);
        const g = ctx.createRadialGradient(x, y, 5, x, y, 40 + sube(k) * 90); g.addColorStop(0, 'rgba(76,29,149,0.9)'); g.addColorStop(1, 'rgba(76,29,149,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 40 + sube(k) * 90, 0, PI2); ctx.fill(); ctx.restore();
    } else if (el === 'luz') {
        ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(x, y); ctx.strokeStyle = '#fef9c3'; ctx.lineCap = 'round';
        for (let i = 0; i < 12; i++) { const a = (i / 12) * PI2 + k; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); ctx.lineTo(Math.cos(a) * (40 + sube(k) * 90), Math.sin(a) * (40 + sube(k) * 90)); ctx.stroke(); }
        ctx.restore();
    }
    estallido(ctx, x, y, k, col, el === 'fuego' ? 90 : 72);
    chispas(ctx, x, y, k, col, { n: 16, alcance: 110, tam: 6, semilla: semilla + 3, gravedad: el === 'fuego' ? -0.4 : 0.6 });
}
// Burbuja de escudo hexagonal.
function escudo(ctx, x, y, k, color = '#93c5fd') {
    const R = 110 * (0.7 + 0.3 * sube(Math.min(1, k * 2)));
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 3) * (k > 0.85 ? (1 - k) / 0.15 : 1);
    ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, 0, R * 0.3, 0, 0, R); g.addColorStop(0, hexA(color, 0.05)); g.addColorStop(1, hexA(color, 0.4));
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * PI2 + Math.PI / 6; ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); } ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke();
    ctx.globalAlpha *= 0.5; ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI2 + Math.PI / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); }
    ctx.restore();
}
// Brillos verdes que suben con cruces (curas).
function curacion(ctx, x, y, k, semilla) {
    const r = azarDe(semilla);
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 10, x, y, 120); g.addColorStop(0, `rgba(134,239,172,${0.4 * (1 - k)})`); g.addColorStop(1, 'rgba(134,239,172,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 130, y - 130, 260, 260);
    for (let i = 0; i < 9; i++) {
        const px = x - 70 + r() * 140; const py = y + 60 - ((k + r()) % 1) * 150; const s = 5 + r() * 6;
        ctx.globalAlpha = Math.max(0, 1 - k) * 0.9; ctx.fillStyle = i % 2 ? '#4ade80' : '#bbf7d0';
        ctx.fillRect(px - s, py - s * 0.3, s * 2, s * 0.6); ctx.fillRect(px - s * 0.3, py - s, s * 0.6, s * 2);
    }
    ctx.restore();
}
// Llamitas / calaveras / estrellitas encima de alguien (quemado, maldito, confuso).
function estado(ctx, tipo, x, y, k, semilla) {
    const r = azarDe(semilla);
    ctx.save();
    if (tipo === 'quema') {
        for (let i = 0; i < 6; i++) { const px = x - 60 + r() * 120; const py = y + 40 - ((k * 1.5 + r()) % 1) * 110; ctx.globalAlpha = 0.85 * (1 - k * 0.5); orbe(ctx, px, py, 8 + r() * 6, '#f97316', '#fde68a'); }
    } else if (tipo === 'maldicion') {
        ctx.globalAlpha = 0.6 * (1 - k); orbe(ctx, x, y, 50, '#6d28d9', '#c4b5fd'); ctx.globalAlpha = 1 - k;
        texto(ctx, '💀', x, y - 70 - k * 30, { tam: 30, alin: 'center', peso: 'normal' });
    } else if (tipo === 'confuso') {
        for (let i = 0; i < 3; i++) { const a = k * PI2 * 1.5 + (i * PI2) / 3; texto(ctx, '⭐', x + Math.cos(a) * 40, y - 95 + Math.sin(a) * 10, { tam: 20, alin: 'center', peso: 'normal' }); }
    } else if (tipo === 'regenera') {
        for (let i = 0; i < 6; i++) { ctx.globalAlpha = 1 - k; hoja(ctx, x - 60 + r() * 120, y + 50 - ((k + r()) % 1) * 120, r() * 6, 8, '#86efac'); }
    }
    ctx.restore();
}
// Bloque de hielo (congelado).
function hieloEncima(ctx, x, y, k) {
    ctx.save(); ctx.globalAlpha = 0.55 * Math.min(1, k * 2);
    ctx.beginPath(); ctx.moveTo(x - 70, y + 95); ctx.lineTo(x - 85, y - 40); ctx.lineTo(x - 30, y - 105); ctx.lineTo(x + 40, y - 100); ctx.lineTo(x + 85, y - 30); ctx.lineTo(x + 72, y + 95); ctx.closePath();
    ctx.fillStyle = '#bae6fd'; ctx.fill(); ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 3; ctx.stroke();
    ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 55, y - 40); ctx.lineTo(x - 25, y - 85); ctx.stroke();
    ctx.restore();
}
// Número que salta (crece de golpe, se asienta, sube y se apaga).
function numero(ctx, txt, x, y, k, { color = '#ffffff', borde = '#7f1d1d', tam = 38 } = {}) {
    const esc = k < 0.18 ? 0.6 + (k / 0.18) * 1.0 : 1.6 - Math.min(0.6, (k - 0.18) * 3);
    ctx.save(); ctx.globalAlpha = k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1;
    ctx.translate(x, y - sube(k) * 46); ctx.scale(esc, esc);
    texto(ctx, txt, 0, 0, { tam, alin: 'center', peso: '900', color, borde });
    ctx.restore();
}
// Cartel en el centro (nombre del especial, de la carta, «Se defiende»…).
function cartel(ctx, txt, k, color = '#fde68a') {
    if (!txt) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 4);
    ctx.font = `bold 18px ${FUENTE}`; const w = Math.min(420, ctx.measureText(txt).width + 44);
    ctx.fillStyle = 'rgba(2,6,23,0.82)'; A.redondeado(ctx, W / 2 - w / 2, 112, w, 36, 18); ctx.fill();
    ctx.strokeStyle = hexA(color, 0.8); ctx.lineWidth = 2; ctx.stroke();
    texto(ctx, txt, W / 2, 136, { tam: 18, alin: 'center', color, max: w - 24 });
    ctx.restore();
}


// ---------------------------------------------------------------------------
// Escena: cada fotograma = fondo + luchadores (con su pose) + efectos + paneles
// ---------------------------------------------------------------------------
const YC = PIES - TAM * 0.45; // altura del «pecho» (donde llegan los golpes)
const humorDe = (l, ganador = null, lado = null) => (ganador && lado ? (ganador === lado ? 'feliz' : 'cansado') : l.hp <= 0 ? 'cansado' : l.hp / l.max < 0.3 ? 'enfadado' : 'normal');
const tamDe = (l) => (String(l.id).startsWith('jefe:') ? Math.round(TAM * 1.15) : TAM);

class Escena {
    constructor(c, antes, imgs, { idioma = 'es' } = {}) {
        this.c = c; this.idioma = idioma;
        this.fondo = fondoArena(c.a.el, c.b.el);
        this.capas = { a: capaLuchador(imgs.a, c.a.id, tamDe(c.a)), b: capaLuchador(imgs.b, c.b.id, tamDe(c.b)) };
        this.hp = { a: antes.a.hp, b: antes.b.hp };
        this.vis = { ...this.hp }; this.fant = { ...this.hp }; this.espera = { a: 0, b: 0 };
        this.en = { a: antes.a.energia, b: antes.b.energia };
        this.ef = { a: antes.a.efectos || {}, b: antes.b.efectos || {} };
        this.esc = { a: antes.a.escudo || 0, b: antes.b.escudo || 0 };
        this.fija = { a: {}, b: {} }; // pose que se queda (KO, caído…)
        this.n = 0; this.frames = [];
    }
    t(es, en) { return this.idioma === 'en' ? en : es; }
    danar(k, n) { this.hp[k] = Math.max(0, this.hp[k] - (n || 0)); this.espera[k] = 4; }
    curar(k, n) { this.hp[k] = Math.min(this.c[k].max, this.hp[k] + (n || 0)); this.fant[k] = Math.min(this.fant[k], this.hp[k]); }
    luchador(ctx, k, pose = {}) {
        const p = { ...this.fija[k], ...pose };
        const capa = p.capa || this.capas[k];
        if (!capa) return;
        const tam = capa.tam;
        const dir = k === 'a' ? 1 : -1;
        const x = POS[k] + (p.dx || 0);
        const respira = p.quieto ? 0 : Math.sin(this.n * 0.55 + (k === 'b' ? 1.7 : 0));
        const y = PIES + (p.dy || 0) + (p.quieto ? 0 : respira * -2);
        // Sombra en el suelo (más pequeña cuanto más alto está)
        const alto = Math.max(0, -(p.dy || 0));
        ctx.save(); ctx.globalAlpha = 0.5 * (p.alfa ?? 1) * Math.max(0.35, 1 - alto / 160);
        const g = ctx.createRadialGradient(x, PIES, 2, x, PIES, 72); g.addColorStop(0, 'rgba(2,6,23,0.85)'); g.addColorStop(1, 'rgba(2,6,23,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, PIES, 74 * Math.max(0.5, 1 - alto / 220), 14, 0, 0, PI2); ctx.fill(); ctx.restore();
        // Estela (copias que se quedan atrás al moverse rápido)
        for (const [i, fx] of (p.fantasmas || []).entries()) {
            ctx.save(); ctx.globalAlpha = 0.16 + i * 0.06; ctx.translate(POS[k] + fx, y); ctx.scale(dir === 1 ? 1 : -1, 1);
            ctx.drawImage(capa.blanco, -tam / 2, -tam * 0.9, tam, tam); ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha = p.alfa ?? 1;
        ctx.translate(x, y); ctx.rotate(p.rot || 0);
        const sy = (p.sy || 1) * (1 + respira * 0.012); const sx = (p.sx || 1) * (1 - respira * 0.006);
        ctx.scale(dir === 1 ? sx : -sx, sy);
        ctx.drawImage(capa.base, -tam / 2, -tam * 0.9, tam, tam);
        for (const [clave, capaT] of [['rojo', capa.rojo], ['hielo', capa.hielo], ['blanco', capa.blanco]]) {
            if (p[clave] > 0) { ctx.globalAlpha = (p.alfa ?? 1) * Math.min(1, p[clave]); ctx.drawImage(capaT, -tam / 2, -tam * 0.9, tam, tam); }
        }
        ctx.restore();
    }
    // Pinta un fotograma y lo guarda. op: { a, b (poses), sacudida, oscuro, encima(ctx), debajo(ctx), titulo }
    cuadro(op = {}, delay = 50) {
        const { c: lienzo, ctx } = A.lienzo(W, H);
        ctx.fillStyle = '#070b1a'; ctx.fillRect(0, 0, W, H);
        ctx.save();
        if (op.sacudida) { const r = azarDe(this.n + 7); ctx.translate((r() - 0.5) * op.sacudida * 2, (r() - 0.5) * op.sacudida); }
        ctx.drawImage(this.fondo, 0, 0);
        if (op.debajo) op.debajo(ctx);
        // El que ataca se dibuja delante
        const orden = op.delante === 'a' ? ['b', 'a'] : ['a', 'b'];
        for (const k of orden) this.luchador(ctx, k, op[k]);
        if (op.oscuro) { ctx.fillStyle = `rgba(2,6,23,${op.oscuro})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
        if (op.encima) op.encima(ctx);
        ctx.restore();
        // Vida: la barra baja rápido y la «fantasma» se queda un momento y luego la sigue.
        for (const k of ['a', 'b']) {
            this.vis[k] += (this.hp[k] - this.vis[k]) * 0.5;
            if (Math.abs(this.vis[k] - this.hp[k]) < 0.6) this.vis[k] = this.hp[k];
            if (this.fant[k] < this.vis[k]) this.fant[k] = this.vis[k];
            if (this.espera[k] > 0) this.espera[k] -= 1;
            else this.fant[k] = Math.max(this.vis[k], this.fant[k] - this.c[k].max * 0.08);
        }
        if (!op.sinPaneles) for (const k of ['a', 'b']) panel(ctx, { ...this.c[k], energia: this.en[k], efectos: this.ef[k], escudo: this.esc[k] }, k, this.vis[k], this.fant[k]);
        if (op.titulo) {
            const esc = op.tituloEsc || 1;
            ctx.save(); ctx.translate(W / 2, 168); ctx.scale(esc, esc);
            texto(ctx, op.titulo, 0, 0, { tam: 32, alin: 'center', peso: '900', color: '#fde68a', borde: '#1e1b4b' });
            ctx.restore();
        }
        if (op.final) op.final(ctx);
        this.frames.push({ ctx, delay });
        this.n += 1;
        return lienzo;
    }
    // Deja que las barras terminen de moverse.
    asentar(n = 2, op = {}) { for (let i = 0; i < n; i++) this.cuadro(op, 60); }
}

// --- Presentación del especial: franja que cruza con el luchador y el nombre del ataque
function presentacion(esc, e) {
    const k0 = e.lado; const dir = k0 === 'a' ? 1 : -1;
    const col = colorEl(esc.c[k0].el);
    const nombre = `${e.emoji || '✨'} ${esc.t(e.nombre?.es || '', e.nombre?.en || '')}`;
    const capa = esc.capas[k0];
    const dibujar = (k) => (ctx) => {
        const off = (1 - sube(k)) * W * dir * -1;
        ctx.save(); ctx.translate(off, 0);
        ctx.beginPath(); ctx.moveTo(-20, 150); ctx.lineTo(W + 20, 120); ctx.lineTo(W + 20, 250); ctx.lineTo(-20, 280); ctx.closePath();
        const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(dir === 1 ? 0 : 1, hexA(col, 0.95)); g.addColorStop(dir === 1 ? 1 : 0, 'rgba(15,23,42,0.95)');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
        ctx.save(); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
        for (let i = 0; i < 14; i++) { const yy = 125 + i * 11; const xx = ((i * 97 + esc.n * 60) % (W + 200)) - 100; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 140, yy - 6); ctx.stroke(); }
        if (capa) {
            const px = dir === 1 ? 150 : W - 150;
            ctx.save(); ctx.translate(px, 270); ctx.scale(dir === 1 ? 1 : -1, 1); ctx.drawImage(capa.base, -95, -190, 190, 190); ctx.restore();
        }
        ctx.restore();
        texto(ctx, nombre, dir === 1 ? W - 40 : 40, 205, { tam: 34, alin: dir === 1 ? 'right' : 'left', peso: '900', color: '#ffffff', borde: '#0f172a', max: 400 });
        ctx.restore();
    };
    for (const k of [0.3, 0.65, 1]) esc.cuadro({ oscuro: 0.45, encima: dibujar(k) }, 45);
    esc.cuadro({ oscuro: 0.45, encima: dibujar(1) }, 420);
}
// --- Carta: aparece encima de quien la usa, se gira y brilla
function aparecerCarta(esc, e, imgCarta) {
    const yo = e.lado; const dir = yo === 'a' ? 1 : -1; const x = POS[yo] + dir * 118; const CW = 100; const CH = 150;
    const CR = require('./cartasArte.js');
    const id = e.carta && K.def(e.carta) ? e.carta : null;
    const color = id ? (K.RAREZAS[K.def(id).rareza]?.color || '#a78bfa') : '#a78bfa';
    const nombre = `🃏 ${esc.t(e.tecnica?.es || '', e.tecnica?.en || '')}`;
    const pinta = (subida, giro, brillo) => (ctx) => {
        const y = 232 - sube(subida) * 30;
        ctx.save(); ctx.translate(x, y);
        if (brillo > 0) { const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 120); g.addColorStop(0, hexA(color, 0.6 * brillo)); g.addColorStop(1, hexA(color, 0)); ctx.fillStyle = g; ctx.fillRect(-130, -130, 260, 260); }
        ctx.save();
        const sx = Math.abs(Math.cos(giro * Math.PI)) || 0.04;
        ctx.scale(sx, 1);
        if (giro < 0.5 || !id) CR.dibujarDorso(ctx, -CW / 2, -CH / 2, CW, CH, color);
        else CR.dibujarCarta(ctx, -CW / 2, -CH / 2, CW, CH, id, { img: imgCarta, idioma: esc.idioma, brillo: 0.5 });
        ctx.restore();
        // Nombre de la técnica debajo de la carta
        ctx.globalAlpha = Math.min(1, giro * 2);
        ctx.font = `bold 15px ${FUENTE}`; const w = Math.min(260, ctx.measureText(nombre).width + 26);
        ctx.fillStyle = 'rgba(2,6,23,0.85)'; A.redondeado(ctx, -w / 2, CH / 2 + 8, w, 28, 14); ctx.fill();
        ctx.strokeStyle = hexA(color, 0.8); ctx.lineWidth = 2; ctx.stroke();
        texto(ctx, nombre, 0, CH / 2 + 28, { tam: 15, alin: 'center', color: '#fde68a', max: w - 16 });
        ctx.restore();
    };
    const pose = { [yo]: { sx: 1.04, sy: 0.97 } };
    for (const [s, g, b] of [[0.4, 0, 0], [1, 0.25, 0], [1, 0.5, 0.2], [1, 0.75, 0.5], [1, 1, 0.9]]) esc.cuadro({ ...pose, encima: pinta(s, g, b) }, 55);
    esc.cuadro({ ...pose, encima: pinta(1, 1, 0.6) }, 300);
    return color;
}


// --- Un golpe (ataque normal, especial o carta que pega)
function golpe(esc, e, imgCarta, semilla) {
    const yo = e.lado; const otro = yo === 'a' ? 'b' : 'a'; const dir = yo === 'a' ? 1 : -1;
    const el = esc.c[yo].el;
    let color = colorEl(el);
    if (e.tipo === 'especial') presentacion(esc, e);
    if (e.tipo === 'carta') color = aparecerCarta(esc, e, imgCarta);
    const cuerpo = e.tipo === 'atacar';
    // Preparación: se echa atrás y se encoge
    for (const k of [0.5, 1]) esc.cuadro({ delante: yo, [yo]: { dx: -dir * 14 * k, sx: 1 + 0.07 * k, sy: 1 - 0.08 * k } }, 55);
    const xObj = POS[otro]; const yObj = YC;
    const llegada = dir * (Math.abs(POS[otro] - POS[yo]) - 150);
    if (cuerpo) {
        // Embestida con estela
        const pasos = [0.35, 0.75, 1];
        pasos.forEach((k, i) => {
            const dx = llegada * entra(k);
            esc.cuadro({ delante: yo, [yo]: { dx, sx: 1.08, sy: 0.95, fantasmas: [llegada * entra(pasos[i - 1] || 0) * 0.6, dx - dir * 40].filter((v) => v !== undefined) }, encima: (ctx) => rafaga(ctx, POS[yo] + dx, YC, dir, k) }, 40);
        });
    } else {
        // A distancia: el ataque viaja hasta el otro (el rayo cae del cielo y las rocas, de arriba)
        const pose = { [yo]: { dx: dir * 18, sx: 1.05, sy: 0.97 } };
        if (e.tipo === 'especial' && el === 'rayo') {
            for (const k of [0, 1]) esc.cuadro({ ...pose, oscuro: 0.35, encima: (ctx) => rayo(ctx, xObj, -10, yObj + 40, semilla + k * 13, 7 - k * 2) }, 55);
        } else if (e.tipo === 'especial' && el === 'tierra') {
            for (const k of [0.3, 0.65, 1]) esc.cuadro({ ...pose, encima: (ctx) => { for (let i = 0; i < 4; i++) roca(ctx, xObj - 60 + i * 40, -40 + entra(k) * (yObj + 20 + (i % 2) * 20), 16 + (i % 2) * 6, k * 3 + i, semilla + i); } }, 50);
        } else {
            const x0 = POS[yo] + dir * 70;
            for (const k of [0.25, 0.55, 0.8, 1]) esc.cuadro({ ...pose, encima: (ctx) => (e.tipo === 'carta' ? (orbe(ctx, x0 + (xObj - x0) * entra(k), yObj, 18, color), chispas(ctx, x0 + (xObj - x0) * entra(k) - dir * 20, yObj, 0.4, color, { n: 6, alcance: 24, tam: 3, semilla: semilla + k * 10 })) : proyectil(ctx, el, x0, xObj, yObj, k, semilla)) }, 45);
        }
    }
    const vuelta = (k) => (cuerpo ? llegada * (1 - sube(k)) : dir * 18 * (1 - k));
    if (e.esquiva || !e.danio) {
        // Esquiva: el otro se aparta de un salto y deja estela
        for (let i = 0; i < 6; i++) {
            const k = i / 5; const s = Math.sin(k * Math.PI);
            esc.cuadro({ delante: otro, [yo]: { dx: vuelta(k) }, [otro]: { dx: -dir * 55 * s, dy: -40 * s, fantasmas: i < 4 ? [-dir * 25 * s] : [] }, encima: (ctx) => numero(ctx, esc.t('¡ESQUIVA!', 'DODGE!'), xObj, yObj - 70, k, { color: '#93c5fd', borde: '#1e3a8a', tam: 32 }) }, i === 5 ? 160 : 50);
        }
        return;
    }
    // Impacto: se congela un instante con destello blanco
    esc.danar(otro, e.danio);
    const sub = e.crit ? esc.t('¡CRÍTICO!', 'CRITICAL!') : e.fe > 1 ? esc.t('¡Muy eficaz!', 'Super effective!') : e.fe < 1 ? esc.t('Poco eficaz…', 'Not very effective…') : '';
    const num = (k) => (ctx) => {
        numero(ctx, `-${e.danio}`, xObj, yObj - 78, k, { color: e.crit ? '#fde047' : '#ffffff', tam: e.crit ? 50 : 40 });
        if (sub) numero(ctx, sub, xObj, yObj - 40, Math.min(1, k * 0.9), { color: e.crit ? '#fde68a' : e.fe > 1 ? '#86efac' : '#cbd5e1', borde: '#1e1b4b', tam: 18 });
    };
    const fx = (k) => (ctx) => (e.tipo === 'atacar' ? (estallido(ctx, xObj - dir * 20, yObj, k, color, e.crit ? 85 : 65), chispas(ctx, xObj, yObj, k, color, { semilla, n: e.crit ? 20 : 12 })) : impacto(ctx, e.tipo === 'carta' ? 'carta' : el, xObj, yObj, k, semilla, e.tipo === 'carta' ? color : null));
    esc.cuadro({ delante: yo, sacudida: e.crit ? 12 : 5, [yo]: { dx: vuelta(0) }, [otro]: { blanco: 0.95, sx: 0.92, sy: 1.06 }, encima: (ctx) => { fx(0.05)(ctx); num(0)(ctx); } }, e.crit ? 110 : 80);
    for (let i = 1; i <= 6; i++) {
        const k = i / 6;
        esc.cuadro({
            delante: yo, sacudida: e.crit && i < 3 ? 8 - i * 3 : 0,
            [yo]: { dx: vuelta(k) },
            [otro]: { dx: dir * 30 * Math.sin(Math.min(1, k * 1.6) * Math.PI) * (1 - k * 0.3), rojo: Math.max(0, 0.65 - k * 0.8), rot: dir * 0.12 * Math.sin(Math.min(1, k * 1.6) * Math.PI) },
            encima: (ctx) => { fx(k)(ctx); num(k)(ctx); },
        }, i === 6 ? 120 : 50);
    }
    // Lo que deja el golpe
    if (e.cura) { esc.curar(yo, e.cura); for (let i = 0; i < 4; i++) esc.cuadro({ encima: (ctx) => { curacion(ctx, POS[yo], YC, i / 3, semilla + 2); numero(ctx, `+${e.cura}`, POS[yo], YC - 80, i / 3, { color: '#4ade80', borde: '#14532d', tam: 32 }); } }, i === 3 ? 140 : 55); }
    if (e.escudo) { esc.esc[yo] = esc.c[yo].escudo; for (let i = 0; i < 4; i++) esc.cuadro({ encima: (ctx) => escudo(ctx, POS[yo], YC, 0.2 + i * 0.2) }, 55); }
    const marca = e.aturde ? ['hielo', esc.t('❄️ ¡Congelado!', '❄️ Frozen!')] : e.quema ? ['quema', esc.t('🔥 ¡Quemado!', '🔥 Burned!')] : e.maldice ? ['maldicion', esc.t('💀 ¡Maldito!', '💀 Cursed!')] : e.confunde ? ['confuso', esc.t('💫 ¡Confundido!', '💫 Confused!')] : e.debilita ? [null, esc.t('🥀 ¡Más débil!', '🥀 Weakened!')] : null;
    if (marca) {
        for (let i = 0; i < 4; i++) {
            const k = i / 3;
            esc.cuadro({ [otro]: marca[0] === 'hielo' ? { hielo: 0.45 } : {}, encima: (ctx) => { if (marca[0] === 'hielo') hieloEncima(ctx, xObj, YC, k + 0.3); else if (marca[0]) estado(ctx, marca[0], xObj, YC, k, semilla + 5); cartel(ctx, marca[1], 1, '#fde68a'); } }, i === 3 ? 260 : 60);
        }
    }
}
// --- Se defiende: escudo hexagonal
function defensa(esc, e, semilla) {
    const yo = e.lado;
    for (let i = 0; i < 5; i++) {
        const k = i / 4;
        esc.cuadro({ [yo]: { sx: 0.97, sy: 1.02 }, encima: (ctx) => { escudo(ctx, POS[yo], YC, Math.min(0.8, 0.15 + k * 0.6)); cartel(ctx, esc.t('🛡️ Se defiende', '🛡️ Defends'), 1, '#93c5fd'); if (e.cura) numero(ctx, `+${e.cura}`, POS[yo], YC - 80, k, { color: '#4ade80', borde: '#14532d', tam: 28 }); } }, i === 4 ? 200 : 55);
        if (i === 1 && e.cura) esc.curar(yo, e.cura);
    }
    void semilla;
}
// --- Carta que no pega (mejoras, curas, escudos)
function cartaApoyo(esc, e, imgCarta, semilla) {
    const yo = e.lado;
    const color = aparecerCarta(esc, e, imgCarta);
    if (e.cura) esc.curar(yo, e.cura);
    if (e.escudo) esc.esc[yo] = esc.c[yo].escudo;
    for (let i = 0; i < 5; i++) {
        const k = i / 4;
        esc.cuadro({ [yo]: { blanco: 0.25 * (1 - k), dy: -10 * Math.sin(k * Math.PI) }, encima: (ctx) => {
            const g = ctx.createRadialGradient(POS[yo], YC, 10, POS[yo], YC, 130); g.addColorStop(0, hexA(color, 0.45 * (1 - k * 0.6))); g.addColorStop(1, hexA(color, 0)); ctx.fillStyle = g; ctx.fillRect(POS[yo] - 140, YC - 140, 280, 280);
            chispas(ctx, POS[yo], YC, k, color, { semilla, n: 14, alcance: 110, gravedad: -0.6 });
            if (e.escudo) escudo(ctx, POS[yo], YC, 0.2 + k * 0.6);
            if (e.cura) { curacion(ctx, POS[yo], YC, k, semilla + 1); numero(ctx, `+${e.cura}`, POS[yo], YC - 80, k, { color: '#4ade80', borde: '#14532d', tam: 30 }); }
        } }, i === 4 ? 220 : 55);
    }
}
// --- Fin de ronda: quemadura, maldición, regeneración; y confusión (se pega a sí mismo) y congelado
function finRonda(esc, e, semilla) {
    const yo = e.lado; const x = POS[yo];
    if (e.tipo === 'aturdido') {
        for (let i = 0; i < 4; i++) esc.cuadro({ [yo]: { hielo: 0.45, quieto: true }, encima: (ctx) => { hieloEncima(ctx, x, YC, 0.4 + i * 0.2); cartel(ctx, esc.t('❄️ ¡Congelado! No puede moverse', '❄️ Frozen! Can’t move'), 1, '#7dd3fc'); } }, i === 3 ? 320 : 60);
        return;
    }
    if (e.tipo === 'regenera') {
        esc.curar(yo, e.cura);
        for (let i = 0; i < 4; i++) esc.cuadro({ encima: (ctx) => { estado(ctx, 'regenera', x, YC, i / 3, semilla); numero(ctx, `+${e.cura}`, x, YC - 80, i / 3, { color: '#4ade80', borde: '#14532d', tam: 28 }); } }, i === 3 ? 160 : 60);
        return;
    }
    esc.danar(yo, e.danio);
    const tipo = e.tipo === 'quema' ? 'quema' : e.tipo === 'maldicion' ? 'maldicion' : 'confuso';
    const color = tipo === 'quema' ? '#fdba74' : tipo === 'maldicion' ? '#d8b4fe' : '#fde68a';
    const txt = tipo === 'confuso' ? esc.t('💫 Se hace un lío y se golpea', '💫 Confused: hits itself') : null;
    for (let i = 0; i < 5; i++) {
        const k = i / 4;
        esc.cuadro({ sacudida: tipo === 'confuso' && i < 2 ? 5 : 0, [yo]: { rojo: Math.max(0, 0.5 - k * 0.5), rot: tipo === 'confuso' ? Math.sin(k * PI2) * 0.12 : 0 }, encima: (ctx) => { estado(ctx, tipo, x, YC, k, semilla); numero(ctx, `-${e.danio}`, x, YC - 80, k, { color, borde: '#450a0a', tam: 30 }); if (txt) cartel(ctx, txt, 1); } }, i === 4 ? 160 : 60);
    }
}
// --- K.O. (o se acaban las rondas) y celebración del ganador
function finCombate(esc, ganadorNombre, capasFin) {
    const g = esc.c.fin.ganador; const p = g === 'a' ? 'b' : 'a'; const dirP = p === 'a' ? -1 : 1;
    const ko = esc.hp[p] <= 0;
    if (capasFin) esc.capas = capasFin;
    if (ko) {
        for (const b of [1, 0, 0.8]) esc.cuadro({ [p]: { blanco: b } }, 60);
        for (let i = 1; i <= 5; i++) { const k = i / 5; esc.fija[p] = { rot: dirP * (Math.PI / 2.2) * sube(k), dy: 8 * k, alfa: 1 - 0.45 * k, quieto: true }; esc.cuadro({ sacudida: i === 5 ? 9 : 0 }, 55); }
    } else esc.fija[p] = { alfa: 0.6, quieto: true };
    const rotulo = ko ? 'K.O.!' : esc.t('¡TIEMPO!', 'TIME!');
    const grande = (k) => (ctx) => {
        ctx.save(); ctx.globalAlpha = 0.7 * Math.min(1, k * 2); ctx.translate(W / 2, 190);
        ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3;
        for (let i = 0; i < 18; i++) { const a = (i / 18) * PI2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 70, Math.sin(a) * 40); ctx.lineTo(Math.cos(a) * (120 + sube(k) * 120), Math.sin(a) * (70 + sube(k) * 60)); ctx.stroke(); }
        ctx.restore();
        ctx.save(); ctx.translate(W / 2, 210); const s = 2.4 - sube(k) * 1.4; ctx.scale(s, s);
        texto(ctx, rotulo, 0, 0, { tam: 64, alin: 'center', peso: '900', color: '#facc15', borde: '#7f1d1d' });
        ctx.restore();
    };
    for (const k of [0.3, 0.65, 1]) esc.cuadro({ oscuro: 0.25, encima: grande(k) }, 50);
    esc.cuadro({ oscuro: 0.25, encima: grande(1) }, 650);
    // El ganador salta y llueve confeti
    const r = azarDe(99);
    const confeti = Array.from({ length: 46 }, () => ({ x: r() * W, y: -r() * 260, v: 4 + r() * 6, c: ['#f472b6', '#facc15', '#4ade80', '#60a5fa', '#a78bfa', '#fb923c'][Math.floor(r() * 6)], g: r() * PI2 }));
    const llueve = (f) => (ctx) => { for (const q of confeti) { ctx.save(); ctx.translate(q.x + Math.sin(f * 0.5 + q.g) * 12, q.y + f * q.v * 6); ctx.rotate(q.g + f * 0.4); ctx.fillStyle = q.c; ctx.fillRect(-5, -3, 10, 6); ctx.restore(); } };
    const banner = (k) => (ctx) => {
        const y = H - 64 + (1 - sube(k)) * 90;
        const gr = ctx.createLinearGradient(0, y, 0, y + 50); gr.addColorStop(0, '#fbbf24'); gr.addColorStop(1, '#b45309');
        ctx.save(); A.redondeado(ctx, W / 2 - 200, y, 400, 50, 25); ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = '#fef3c7'; ctx.lineWidth = 3; ctx.stroke();
        texto(ctx, `🏆 ${String(ganadorNombre || esc.c[g].nombre).slice(0, 24)}`, W / 2, y + 34, { tam: 24, alin: 'center', peso: '900', borde: '#78350f' });
        ctx.restore();
    };
    for (let f = 0; f < 10; f++) {
        const salto = -Math.abs(Math.sin((f / 10) * PI2)) * 46;
        esc.cuadro({ [g]: { dy: salto, sy: salto < -30 ? 1.04 : 0.98 }, encima: llueve(f), final: banner(Math.min(1, f / 4)) }, 55);
    }
    esc.cuadro({ [g]: { quieto: true }, encima: llueve(10), final: banner(1) }, 60000);
}

// ---------------------------------------------------------------------------
// Lo que se usa desde fuera
// ---------------------------------------------------------------------------
async function imagenesDe(c, a, b, ganador = null) {
    const [ia, ib] = await Promise.all([
        retrato(c.a.id, { nivel: c.a.nivel, variante: c.a.variante, humor: humorDe(a, ganador, 'a') }),
        retrato(c.b.id, { nivel: c.b.nivel, variante: c.b.variante, humor: humorDe(b, ganador, 'b') }),
    ]);
    return { a: ia, b: ib };
}
// Foto fija de la arena. `c` = el combate (combateNucleo), `titulo` = lo de en medio («VS»).
async function arena(c, { titulo = 'VS', imgs = null, ganador = null } = {}) {
    if (!A.listo()) return null;
    const im = imgs ? { a: imgs[0], b: imgs[1] } : await imagenesDe(c, c.a, c.b);
    const esc = new Escena(c, { a: c.a, b: c.b }, im);
    for (const k of ['a', 'b']) if (c[k].hp <= 0) esc.fija[k] = { alfa: 0.5, rot: (k === 'a' ? -1 : 1) * 1.3, dy: 8, quieto: true };
    const lienzo = esc.cuadro({
        titulo: ganador ? '' : titulo,
        final: ganador ? (ctx) => {
            const gr = ctx.createLinearGradient(0, H - 70, 0, H - 20); gr.addColorStop(0, '#fbbf24'); gr.addColorStop(1, '#b45309');
            A.redondeado(ctx, W / 2 - 200, H - 70, 400, 50, 25); ctx.fillStyle = gr; ctx.fill();
            texto(ctx, `🏆 ${String(ganador).slice(0, 24)}`, W / 2, H - 37, { tam: 24, alin: 'center', peso: '900', borde: '#78350f' });
        } : null,
    });
    return lienzo.toBuffer('image/png');
}

// Animación de una ronda. `antes` = copias de los luchadores antes de la ronda, `c` = el combate ya
// con la ronda resuelta, `ev` = los sucesos de combateNucleo.ronda. `inicio` = el rótulo del principio
// («RONDA 3»), `titulo` = el del final si sigue («RONDA 4»).
async function gifRonda(c, antes, ev, { titulo = '', inicio = null, idioma = 'es', ganadorNombre = null } = {}) {
    if (!A.listo()) return null;
    const ganador = c.fin?.ganador || null;
    const [im, imFin] = await Promise.all([imagenesDe(c, antes.a, antes.b), imagenesDe(c, c.a, c.b, ganador)]);
    const cartas = new Map();
    await Promise.all(ev.filter((e) => e.tipo === 'carta' && e.carta && K.def(e.carta)).map(async (e) => { cartas.set(e.carta, await A.imagenCompanero(e.carta).catch(() => null)); }));
    const esc = new Escena(c, antes, im, { idioma });
    // Rótulo de la ronda
    if (inicio) { for (const s of [1.8, 1.25]) esc.cuadro({ titulo: inicio, tituloEsc: s }, 45); esc.cuadro({ titulo: inicio }, 380); } else esc.cuadro({}, 200);
    const visibles = ev.filter((e) => ['atacar', 'especial', 'carta', 'defender', 'quema', 'maldicion', 'regenera', 'confuso', 'aturdido'].includes(e.tipo)).slice(0, 7);
    visibles.forEach((e, i) => {
        const semilla = (c.ronda || 1) * 31 + i * 7;
        if (e.tipo === 'defender') defensa(esc, e, semilla);
        else if (e.tipo === 'atacar' || e.tipo === 'especial' || (e.tipo === 'carta' && (e.danio || e.esquiva))) golpe(esc, e, cartas.get(e.carta), semilla);
        else if (e.tipo === 'carta') cartaApoyo(esc, e, cartas.get(e.carta), semilla);
        else finRonda(esc, e, semilla);
        // Tras su jugada, ya se ve su energía y sus estados reales
        esc.en[e.lado] = c[e.lado].energia;
    });
    // Estado real del final
    for (const k of ['a', 'b']) { esc.hp[k] = c[k].hp; esc.ef[k] = c[k].efectos; esc.esc[k] = c[k].escudo; esc.en[k] = c[k].energia; }
    if (c.fin) {
        const capasFin = { a: capaLuchador(imFin.a, c.a.id, tamDe(c.a)) || esc.capas.a, b: capaLuchador(imFin.b, c.b.id, tamDe(c.b)) || esc.capas.b };
        esc.asentar(2);
        finCombate(esc, ganadorNombre, capasFin);
    } else {
        esc.capas = { a: capaLuchador(imFin.a, c.a.id, tamDe(c.a)) || esc.capas.a, b: capaLuchador(imFin.b, c.b.id, tamDe(c.b)) || esc.capas.b };
        esc.asentar(3);
        esc.cuadro({ titulo }, 60000);
    }
    return A.aGif(esc.frames, W, H);
}

// Tarjeta de perfil de combate (PNG, 760×360).
async function tarjetaPerfil(d) {
    if (!A.listo()) return null;
    const PW = 760; const PH = 360;
    const { c, ctx } = A.lienzo(PW, PH);
    const rango = C.rangoDe(d.elo);
    const g = ctx.createLinearGradient(0, 0, PW, PH); g.addColorStop(0, '#0f172a'); g.addColorStop(1, '#1e1b4b');
    A.redondeado(ctx, 0, 0, PW, PH, 26); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = rango.color; ctx.lineWidth = 4; A.redondeado(ctx, 2, 2, PW - 4, PH - 4, 24); ctx.stroke();
    if (d.luchador) {
        const el = C.ELEMENTOS[d.luchador.elemento];
        const h = ctx.createRadialGradient(150, 200, 10, 150, 200, 170); h.addColorStop(0, `${el.color}77`); h.addColorStop(1, `${el.color}00`);
        ctx.fillStyle = h; ctx.fillRect(0, 0, 320, PH);
        const img = await retrato(d.luchador.id, { nivel: d.luchador.nivel, humor: 'feliz', variante: d.variante });
        pintarLuchador(ctx, img, d.luchador.id, 150, 205, 250);
        texto(ctx, `${el.emoji} ${d.elementoTexto}`, 150, PH - 18, { tam: 16, alin: 'center', color: el.color });
    } else texto(ctx, '🥚', 150, 210, { tam: 90, alin: 'center', peso: 'normal' });
    const X = 320;
    texto(ctx, String(d.nombre).slice(0, 22), X, 50, { tam: 28 });
    texto(ctx, `${rango.emoji} ${d.rangoTexto} · ${d.elo} ELO`, X, 82, { tam: 18, color: rango.color });
    texto(ctx, d.lineaRecord, X, 110, { tam: 15, color: '#cbd5e1' });
    if (d.luchador) {
        const s = d.luchador;
        const barras = [['❤️', s.hp, 400, '#22c55e'], ['⚔️', s.atk, 90, '#f97316'], ['🛡️', s.def, 60, '#38bdf8'], ['💨', s.vel, 60, '#a78bfa']];
        barras.forEach(([e, v, max, col], i) => {
            const y = 138 + i * 30;
            texto(ctx, e, X, y + 12, { tam: 16, peso: 'normal' });
            A.redondeado(ctx, X + 30, y, 300, 14, 7); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
            A.redondeado(ctx, X + 30, y, Math.max(14, 300 * Math.min(1, v / max)), 14, 7); ctx.fillStyle = col; ctx.fill();
            texto(ctx, String(v), X + 400, y + 12, { tam: 15, alin: 'right' });
        });
        texto(ctx, `💪 ${C.poder(s)}`, PW - 26, 82, { tam: 20, alin: 'right', color: '#fde68a' });
    }
    // Mazo
    texto(ctx, d.mazoTitulo, X, 272, { tam: 14, color: '#94a3b8' });
    (d.mazo || []).slice(0, 3).forEach((m, i) => {
        const x = X + i * 140;
        ctx.fillStyle = 'rgba(255,255,255,0.07)'; A.redondeado(ctx, x, 282, 132, 54, 12); ctx.fill();
        ctx.strokeStyle = K.RAREZAS[K.def(m.id).rareza]?.color || '#64748b'; ctx.lineWidth = 2; ctx.stroke();
        texto(ctx, String(K.def(m.id).es).slice(0, 16), x + 8, 302, { tam: 12, max: 116 });
        texto(ctx, `⚔ ${m.tecnica}`.slice(0, 22), x + 8, 324, { tam: 11, color: '#fde68a', peso: 'normal', max: 116 });
    });
    if (!(d.mazo || []).length) texto(ctx, d.mazoVacio, X, 310, { tam: 14, color: '#64748b', peso: 'normal' });
    // Torre
    texto(ctx, d.lineaTorre, PW - 26, 50, { tam: 15, alin: 'right', color: '#c4b5fd' });
    return c.toBuffer('image/png');
}

// Jefe semanal (PNG 760×400): el jefe grande, su vida y los que más le han pegado.
async function tarjetaJefe(d) {
    if (!A.listo()) return null;
    const JW = 760; const JH = 400;
    const { c, ctx } = A.lienzo(JW, JH);
    const el = C.ELEMENTOS[d.el];
    const g = ctx.createLinearGradient(0, 0, 0, JH); g.addColorStop(0, '#1c0a1f'); g.addColorStop(1, '#3b0764');
    A.redondeado(ctx, 0, 0, JW, JH, 26); ctx.fillStyle = g; ctx.fill();
    const h = ctx.createRadialGradient(220, 230, 10, 220, 230, 230); h.addColorStop(0, `${el.color}88`); h.addColorStop(1, `${el.color}00`);
    ctx.fillStyle = h; ctx.fillRect(0, 0, 440, JH);
    const img = await retrato(d.id, { humor: d.muerto ? 'dormido' : 'enfadado' });
    pintarLuchador(ctx, img, d.id, 220, 220, 330, { alfa: d.muerto ? 0.5 : 1 });
    if (d.muerto) texto(ctx, '💀', 220, 120, { tam: 70, alin: 'center', peso: 'normal' });
    const X = 430;
    texto(ctx, d.titulo, X, 46, { tam: 15, color: '#f0abfc' });
    texto(ctx, `${el.emoji} ${d.nombre}`, X, 82, { tam: 28, max: 310 });
    const p = Math.max(0, d.vida / d.max);
    A.redondeado(ctx, X, 100, 300, 22, 11); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
    if (p > 0) { A.redondeado(ctx, X, 100, Math.max(22, 300 * p), 22, 11); const gv = ctx.createLinearGradient(X, 0, X + 300, 0); gv.addColorStop(0, '#dc2626'); gv.addColorStop(1, '#f97316'); ctx.fillStyle = gv; ctx.fill(); }
    texto(ctx, `${d.vidaTexto}`, X + 150, 117, { tam: 13, alin: 'center', borde: 'rgba(0,0,0,0.6)' });
    texto(ctx, d.lineaFin, X, 148, { tam: 13, color: '#e9d5ff', peso: 'normal' });
    texto(ctx, d.rankingTitulo, X, 182, { tam: 15, color: '#fde68a' });
    (d.ranking || []).slice(0, 6).forEach((r, i) => {
        const y = 210 + i * 28;
        ctx.fillStyle = i < 3 ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.05)'; A.redondeado(ctx, X, y - 18, 300, 24, 12); ctx.fill();
        texto(ctx, `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} ${String(r.nombre).slice(0, 16)}`, X + 10, y, { tam: 14, max: 200 });
        texto(ctx, r.danioTexto, X + 290, y, { tam: 14, alin: 'right', color: '#fca5a5' });
    });
    if (!(d.ranking || []).length) texto(ctx, d.nadie, X, 214, { tam: 14, color: '#c4b5fd', peso: 'normal' });
    return c.toBuffer('image/png');
}
// Tu ataque al jefe (GIF): tu luchador pega 3 veces y la vida del jefe baja.
async function gifAtaqueJefe(d) {
    if (!A.listo()) return null;
    const c = {
        a: { id: d.luchador.id, el: d.luchador.elemento, nombre: d.nombre, nivel: d.luchador.nivel, max: d.luchador.hp, hp: d.luchador.hp, energia: C.ENERGIA_ESPECIAL, efectos: {}, escudo: 0 },
        b: { id: d.jefe.id, el: d.jefe.el, nombre: d.jefeNombre, max: d.jefe.max, hp: d.vidaAntes, energia: 0, efectos: {}, escudo: 0 },
    };
    const antes = { a: { ...c.a }, b: { ...c.b } };
    c.b.hp = Math.max(0, d.vidaAntes - d.total);
    // Los golpes de la misma carta (técnicas de varios golpes) se enseñan juntos: la carta sale una vez.
    const ev = [];
    for (const g of d.golpes) {
        const ant = ev[ev.length - 1];
        if (g.tipo === 'carta' && ant?.tipo === 'carta' && ant.carta === g.carta) { ant.danio += g.danio; ant.crit = ant.crit || g.crit; ant.esquiva = !ant.danio; continue; }
        ev.push({ lado: 'a', tipo: g.tipo, danio: g.danio, crit: g.crit, fe: g.fe, esquiva: !g.danio, carta: g.carta || null, nombre: g.nombre, emoji: g.emoji || '✨', tecnica: g.nombre || { es: '', en: '' } });
    }
    // 2.2.0: si es el golpe final, el jefe cae con su K.O.
    if (c.b.hp <= 0) c.fin = { ganador: 'a', motivo: 'ko' };
    return gifRonda(c, antes, ev, { titulo: d.titulo, idioma: d.idioma, ganadorNombre: d.nombre });
}

module.exports = { arena, gifRonda, tarjetaPerfil, tarjetaJefe, gifAtaqueJefe, retrato, pintarLuchador, capaLuchador, W, H };
