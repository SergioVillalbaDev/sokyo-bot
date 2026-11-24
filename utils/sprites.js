// Dibujos propios de las mascotas (1.32.0): ya no son emojis. Cada compañero del catálogo,
// cada especie de la mascota del servidor y los jefes se dibujan aquí, a mano y con código
// (@napi-rs/canvas), en estilo «chibi»: cabeza grande, sombreado suave con luz de arriba a la
// izquierda, contorno oscuro del color de la piel, ojos con dos brillos y mofletes.
//
// Opciones de cada dibujo:
//   · etapa: 0 bebé · 1 joven · 2 adulto (crece con la afinidad: etapaDe(nivel))
//   · humor: feliz · normal · hambre · cansado · aburrido · enfermo · enfadado · dormido
//   · t: momento de la animación (0..1): respira, mueve la cola y las orejas
//   · parpadeo: ojos cerrados en ese fotograma
//   · variante: 'brillante' = colores alternativos (raros) con destellos
// Todo es puro dibujo: sin archivos ni internet. Si falta canvas, imagen() devuelve null.
let canvasLib = null;
try { canvasLib = require('@napi-rs/canvas'); } catch { canvasLib = null; }

const TAM = 256;
const PI2 = Math.PI * 2;

// ---------------------------------------------------------------------------
// Colores
// ---------------------------------------------------------------------------
function rgb(hex) {
    const h = String(hex).replace('#', '');
    const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
const aHex = (r, g, b) => `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
function mezclar(a, b, k) { const x = rgb(a); const y = rgb(b); return aHex(x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k); }
const aclarar = (c, k) => mezclar(c, '#ffffff', k);
const oscurecer = (c, k) => mezclar(c, '#000000', k);
function alfa(c, a) { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; }
// Gira el tono (para la variante brillante).
function girarTono(hex, grados) {
    let [r, g, b] = rgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
    let h = 0; const l = (max + min) / 2; const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d) {
        if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
        h *= 60;
    }
    h = (h + grados + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = l - c / 2;
    [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return aHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

// ---------------------------------------------------------------------------
// Pinceles
// ---------------------------------------------------------------------------
// Relleno con volumen: degradado radial con la luz arriba a la izquierda.
function volumen(ctx, color, cx, cy, r) {
    const g = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.45, r * 0.08, cx, cy, r * 1.2);
    g.addColorStop(0, aclarar(color, 0.32));
    g.addColorStop(0.5, color);
    g.addColorStop(1, oscurecer(color, 0.25));
    return g;
}
// Pinta la forma que se acaba de trazar: relleno con volumen + contorno.
function pintar(ctx, color, cx, cy, r, { linea = 4.5, sinLinea = false, plano = false } = {}) {
    ctx.fillStyle = plano ? color : volumen(ctx, color, cx, cy, r);
    ctx.fill();
    if (!sinLinea) {
        ctx.lineWidth = linea; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.strokeStyle = oscurecer(color, 0.55);
        ctx.stroke();
    }
}
function elipse(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, PI2); }
function bola(ctx, color, x, y, rx, ry, op = {}) { elipse(ctx, x, y, rx, ry, op.rot || 0); pintar(ctx, color, x, y, Math.max(rx, ry), op); }
function brillo(ctx, x, y, rx, ry, a = 0.55) { elipse(ctx, x, y, rx, ry, -0.5); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill(); }
// Triángulo redondeado (orejas, cuernos, púas).
function pico(ctx, puntos, color, op = {}) {
    ctx.beginPath();
    ctx.moveTo(puntos[0][0], puntos[0][1]);
    for (let i = 1; i < puntos.length; i++) ctx.lineTo(puntos[i][0], puntos[i][1]);
    ctx.closePath();
    const xs = puntos.map((p) => p[0]); const ys = puntos.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2; const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    pintar(ctx, color, cx, cy, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2, op);
}
function curva(ctx, pts, color, ancho, cap = 'round') {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 3) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    else if (pts.length === 4) ctx.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
    else for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.lineCap = cap; ctx.lineJoin = 'round'; ctx.stroke();
}
function estrella(ctx, x, y, r, color, puntas = 4) {
    ctx.beginPath();
    for (let i = 0; i < puntas * 2; i++) {
        const a = (i * Math.PI) / puntas - Math.PI / 2;
        const rr = i % 2 ? r * 0.38 : r;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function corazon(ctx, x, y, s, color) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.4, x, y + s * 0.35);
    ctx.fillStyle = color; ctx.fill();
}

// ---------------------------------------------------------------------------
// Cara: ojos, boca, mofletes (comunes a todos)
// ---------------------------------------------------------------------------
const OSCURO = '#241a33';
function ojo(ctx, x, y, s, { iris = '#5b3a1e', humor = 'normal', parpadeo = false, lado = 1, estilo = 'redondo' } = {}) {
    const rx = 10.5 * s; const ry = (estilo === 'anime' ? 15 : 13) * s;
    ctx.save();
    if (parpadeo || humor === 'dormido') {
        curva(ctx, [[x - rx, y], [x, y + ry * 0.55], [x + rx, y]], OSCURO, 3.6 * s);
        ctx.restore(); return;
    }
    if (humor === 'feliz') {
        curva(ctx, [[x - rx, y + ry * 0.25], [x, y - ry * 0.75], [x + rx, y + ry * 0.25]], OSCURO, 4.2 * s);
        ctx.restore(); return;
    }
    if (humor === 'enfadado') {
        elipse(ctx, x, y + 2 * s, rx * 0.95, ry * 0.8); ctx.fillStyle = OSCURO; ctx.fill();
        curva(ctx, [[x - rx * 1.2 * lado, y - ry * 1.1], [x + rx * 0.9 * lado, y - ry * 0.55]], OSCURO, 4 * s);
        brillo(ctx, x - rx * 0.3, y - ry * 0.15, rx * 0.3, ry * 0.25, 0.9);
        ctx.restore(); return;
    }
    // Ojo abierto: blanco fino, pupila grande con iris de color abajo y dos brillos.
    elipse(ctx, x, y, rx, ry); ctx.fillStyle = OSCURO; ctx.fill();
    const g = ctx.createLinearGradient(x, y - ry, x, y + ry);
    g.addColorStop(0, OSCURO); g.addColorStop(0.55, oscurecer(iris, 0.2)); g.addColorStop(1, aclarar(iris, 0.35));
    elipse(ctx, x, y + ry * 0.12, rx * 0.78, ry * 0.8); ctx.fillStyle = g; ctx.fill();
    const grande = humor === 'hambre' ? 1.25 : 1;
    brillo(ctx, x - rx * 0.32, y - ry * 0.38, rx * 0.36 * grande, ry * 0.3 * grande, 0.95);
    elipse(ctx, x + rx * 0.35, y + ry * 0.42, rx * 0.16, ry * 0.13); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    if (humor === 'hambre') { // ojitos brillantes (de súplica)
        elipse(ctx, x + rx * 0.3, y - ry * 0.05, rx * 0.12, ry * 0.1); ctx.fillStyle = '#fff'; ctx.fill();
        elipse(ctx, x, y + ry * 0.95, rx * 0.8, ry * 0.18); ctx.fillStyle = 'rgba(147,197,253,0.65)'; ctx.fill();
    }
    if (humor === 'cansado' || humor === 'aburrido' || humor === 'enfermo') {
        // Párpado a media asta
        const cierre = humor === 'aburrido' ? 0.45 : 0.6;
        ctx.beginPath(); ctx.rect(x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 2 * cierre + 2);
        ctx.save(); ctx.clip(); elipse(ctx, x, y, rx + 1, ry + 1); ctx.fillStyle = ctx._piel || '#e5c9a8'; ctx.fill(); ctx.restore();
        curva(ctx, [[x - rx, y - ry + ry * 2 * cierre], [x + rx, y - ry + ry * 2 * cierre]], OSCURO, 3 * s);
    }
    ctx.restore();
}
function ojos(ctx, x, y, sep, s, op = {}) {
    ojo(ctx, x - sep, y, s, { ...op, lado: 1 });
    ojo(ctx, x + sep, y, s, { ...op, lado: -1 });
}
function boca(ctx, x, y, s, humor = 'normal', { tipo = 'normal', colmillo = false } = {}) {
    ctx.save();
    if (humor === 'feliz') {
        ctx.beginPath(); ctx.moveTo(x - 9 * s, y - 1 * s);
        ctx.quadraticCurveTo(x, y + 15 * s, x + 9 * s, y - 1 * s); ctx.closePath();
        ctx.fillStyle = '#7f1d1d'; ctx.fill();
        elipse(ctx, x, y + 6 * s, 4.5 * s, 3 * s); ctx.fillStyle = '#fb7185'; ctx.fill();
        ctx.lineWidth = 2.6 * s; ctx.strokeStyle = OSCURO; ctx.beginPath(); ctx.moveTo(x - 9 * s, y - 1 * s);
        ctx.quadraticCurveTo(x, y + 15 * s, x + 9 * s, y - 1 * s); ctx.closePath(); ctx.stroke();
    } else if (humor === 'hambre' || humor === 'cansado') {
        elipse(ctx, x, y + 3 * s, 4.5 * s, (humor === 'hambre' ? 6 : 4) * s); ctx.fillStyle = '#7f1d1d'; ctx.fill();
        ctx.lineWidth = 2.4 * s; ctx.strokeStyle = OSCURO; ctx.stroke();
        if (humor === 'hambre') { elipse(ctx, x + 7 * s, y + 9 * s, 2.2 * s, 3.4 * s); ctx.fillStyle = 'rgba(147,197,253,0.9)'; ctx.fill(); }
    } else if (humor === 'aburrido' || humor === 'enfermo') {
        curva(ctx, [[x - 7 * s, y + 3 * s], [x, y + (humor === 'enfermo' ? 0 : 3) * s], [x + 7 * s, y + 4 * s]], OSCURO, 2.6 * s);
    } else if (humor === 'enfadado') {
        curva(ctx, [[x - 8 * s, y + 6 * s], [x, y], [x + 8 * s, y + 6 * s]], OSCURO, 3 * s);
    } else if (humor === 'dormido') {
        elipse(ctx, x, y + 3 * s, 3 * s, 2.4 * s); ctx.fillStyle = '#7f1d1d'; ctx.fill();
    } else if (tipo === 'gato') {
        curva(ctx, [[x - 8 * s, y], [x - 4 * s, y + 5 * s], [x, y]], OSCURO, 2.6 * s);
        curva(ctx, [[x, y], [x + 4 * s, y + 5 * s], [x + 8 * s, y]], OSCURO, 2.6 * s);
    } else {
        curva(ctx, [[x - 7 * s, y + 1 * s], [x, y + 7 * s], [x + 7 * s, y + 1 * s]], OSCURO, 2.8 * s);
    }
    if (colmillo && humor !== 'dormido') pico(ctx, [[x + 3 * s, y + 1 * s], [x + 8 * s, y + 1 * s], [x + 5.5 * s, y + 7 * s]], '#ffffff', { linea: 1.4 * s });
    ctx.restore();
}
function mofletes(ctx, x, y, sep, s, color = '#fb7185') {
    for (const d of [-1, 1]) {
        const g = ctx.createRadialGradient(x + d * sep, y, 0, x + d * sep, y, 11 * s);
        g.addColorStop(0, alfa(color, 0.55)); g.addColorStop(1, alfa(color, 0));
        ctx.fillStyle = g; elipse(ctx, x + d * sep, y, 12 * s, 8 * s); ctx.fill();
    }
}

// ---------------------------------------------------------------------------
// Partes de animales
// ---------------------------------------------------------------------------
function oreja(ctx, tipo, x, y, lado, c, s, mov) {
    const r = mov * lado; // pequeño giro (las orejas se mueven)
    ctx.save(); ctx.translate(x, y); ctx.rotate(r * 0.12);
    const interior = c.oreja || aclarar(c.piel, 0.45);
    if (tipo === 'punta') {
        pico(ctx, [[-18 * s * lado, 14 * s], [-4 * s * lado, -34 * s], [18 * s * lado, 8 * s]], c.piel);
        pico(ctx, [[-9 * s * lado, 8 * s], [-4 * s * lado, -18 * s], [9 * s * lado, 6 * s]], interior, { sinLinea: true, plano: true });
        if (c.puntaOreja) pico(ctx, [[-8 * s * lado, -14 * s], [-4 * s * lado, -34 * s], [3 * s * lado, -16 * s]], c.puntaOreja, { linea: 0.1, plano: true });
    } else if (tipo === 'larga') {
        bola(ctx, c.piel, 0, -38 * s, 13 * s, 40 * s, { rot: -0.12 * lado });
        elipse(ctx, 0, -36 * s, 6 * s, 30 * s, -0.12 * lado); ctx.fillStyle = interior; ctx.fill();
    } else if (tipo === 'caida') {
        bola(ctx, c.oreja || oscurecer(c.piel, 0.18), 8 * s * lado, 22 * s, 15 * s, 32 * s, { rot: 0.35 * lado });
    } else if (tipo === 'redonda' || tipo === 'grande') {
        const R = tipo === 'grande' ? 26 : 17;
        bola(ctx, c.orejaFuera || c.piel, 0, 0, R * s, R * s);
        elipse(ctx, 2 * s * lado, 3 * s, R * 0.55 * s, R * 0.55 * s); ctx.fillStyle = interior; ctx.fill();
    } else if (tipo === 'pluma') { // búho: penachos
        pico(ctx, [[-10 * s * lado, 10 * s], [4 * s * lado, -28 * s], [14 * s * lado, 6 * s]], c.piel);
    } else if (tipo === 'lobo') {
        pico(ctx, [[-17 * s * lado, 16 * s], [-2 * s * lado, -38 * s], [16 * s * lado, 10 * s]], c.piel);
        pico(ctx, [[-8 * s * lado, 10 * s], [-2 * s * lado, -20 * s], [8 * s * lado, 8 * s]], interior, { sinLinea: true, plano: true });
    }
    ctx.restore();
}
function cola(ctx, tipo, x, y, c, s, mov) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(mov * 0.25);
    if (tipo === 'fina') {
        curva(ctx, [[0, 0], [34 * s, -6 * s], [44 * s, -46 * s]], oscurecer(c.piel, 0.55), 15 * s);
        curva(ctx, [[0, 0], [34 * s, -6 * s], [44 * s, -46 * s]], c.piel, 10 * s);
        if (c.puntaCola) { elipse(ctx, 44 * s, -46 * s, 6 * s, 6 * s); ctx.fillStyle = c.puntaCola; ctx.fill(); }
    } else if (tipo === 'esponjosa') {
        bola(ctx, c.piel, 30 * s, -26 * s, 22 * s, 38 * s, { rot: 0.7 });
        elipse(ctx, 44 * s, -50 * s, 11 * s, 13 * s, 0.7); ctx.fillStyle = c.puntaCola || '#ffffff'; ctx.fill();
    } else if (tipo === 'bola') {
        bola(ctx, c.puntaCola || '#ffffff', 22 * s, -4 * s, 14 * s, 13 * s);
    } else if (tipo === 'rayada') {
        bola(ctx, c.piel, 30 * s, -24 * s, 16 * s, 36 * s, { rot: 0.6 });
        ctx.save(); elipse(ctx, 30 * s, -24 * s, 16 * s, 36 * s, 0.6); ctx.clip();
        for (let i = -3; i <= 3; i++) { ctx.fillStyle = c.raya || OSCURO; ctx.save(); ctx.translate(30 * s, -24 * s); ctx.rotate(0.6); ctx.fillRect(-20 * s, i * 12 * s - 3 * s, 40 * s, 6 * s); ctx.restore(); }
        ctx.restore();
    } else if (tipo === 'rizada') {
        ctx.beginPath(); ctx.arc(20 * s, -8 * s, 9 * s, Math.PI, Math.PI * 3.2);
        ctx.strokeStyle = oscurecer(c.piel, 0.45); ctx.lineWidth = 8 * s; ctx.lineCap = 'round'; ctx.stroke();
        ctx.strokeStyle = c.piel; ctx.lineWidth = 5 * s; ctx.stroke();
    } else if (tipo === 'leon') {
        curva(ctx, [[0, 0], [30 * s, 0], [40 * s, -34 * s]], oscurecer(c.piel, 0.55), 12 * s);
        curva(ctx, [[0, 0], [30 * s, 0], [40 * s, -34 * s]], c.piel, 8 * s);
        bola(ctx, c.melena || '#9a3412', 41 * s, -38 * s, 9 * s, 11 * s);
    } else if (tipo === 'dragon') {
        ctx.beginPath(); ctx.moveTo(0, -12 * s); ctx.quadraticCurveTo(40 * s, -4 * s, 56 * s, -36 * s);
        ctx.lineTo(48 * s, -8 * s); ctx.quadraticCurveTo(30 * s, 14 * s, 0, 12 * s); ctx.closePath();
        pintar(ctx, c.piel, 28 * s, -8 * s, 30 * s);
        pico(ctx, [[50 * s, -30 * s], [66 * s, -46 * s], [58 * s, -20 * s]], c.acento || oscurecer(c.piel, 0.2));
    } else if (tipo === 'rex') {
        ctx.beginPath(); ctx.moveTo(0, -16 * s); ctx.quadraticCurveTo(44 * s, -10 * s, 60 * s, 6 * s);
        ctx.quadraticCurveTo(36 * s, 16 * s, 0, 14 * s); ctx.closePath(); pintar(ctx, c.piel, 28 * s, 0, 30 * s);
    } else if (tipo === 'pez') {
        pico(ctx, [[0, 0], [30 * s, -24 * s], [24 * s, 0], [30 * s, 24 * s]], c.piel);
    } else if (tipo === 'llama') {
        for (let i = 0; i < 3; i++) {
            const a = -0.5 + i * 0.45;
            ctx.save(); ctx.rotate(a);
            const g = ctx.createLinearGradient(0, 0, 60 * s, 0); g.addColorStop(0, '#f97316'); g.addColorStop(0.6, '#facc15'); g.addColorStop(1, 'rgba(254,240,138,0)');
            ctx.beginPath(); ctx.moveTo(0, -8 * s); ctx.quadraticCurveTo(40 * s, -20 * s, 64 * s, -4 * s); ctx.quadraticCurveTo(40 * s, 12 * s, 0, 8 * s); ctx.closePath();
            ctx.fillStyle = g; ctx.fill(); ctx.restore();
        }
    } else if (tipo === 'pavo') {
        // Abanico de plumas con ojos
        for (let i = -4; i <= 4; i++) {
            ctx.save(); ctx.translate(-x + 128, 0); ctx.rotate(i * 0.24);
            bola(ctx, '#0f766e', 0, -110 * s, 20 * s, 60 * s, { linea: 2.5 });
            elipse(ctx, 0, -146 * s, 11 * s, 13 * s); ctx.fillStyle = '#facc15'; ctx.fill();
            elipse(ctx, 0, -146 * s, 6 * s, 7 * s); ctx.fillStyle = '#1d4ed8'; ctx.fill();
            ctx.restore();
        }
    } else if (tipo === 'perezoso') {
        // nada: no se ve
    }
    ctx.restore();
}
function alas(ctx, tipo, cx, cy, c, s, mov, etapa) {
    const k = etapa === 0 ? 0.65 : etapa === 1 ? 0.85 : 1;
    const aleteo = Math.sin(mov * Math.PI) * 0.18;
    for (const lado of [-1, 1]) {
        ctx.save(); ctx.translate(cx + lado * 40 * s, cy - 6 * s); ctx.rotate(lado * (-0.35 - aleteo)); ctx.scale(lado * k, k);
        if (tipo === 'murcielago') {
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(56 * s, -48 * s); ctx.quadraticCurveTo(58 * s, -14 * s, 64 * s, 6 * s);
            ctx.quadraticCurveTo(46 * s, -2 * s, 40 * s, 14 * s); ctx.quadraticCurveTo(26 * s, 2 * s, 16 * s, 18 * s); ctx.closePath();
            pintar(ctx, c.ala || oscurecer(c.piel, 0.15), 32 * s, -10 * s, 40 * s);
            curva(ctx, [[2 * s, 0], [40 * s, 14 * s]], alfa(oscurecer(c.piel, 0.5), 0.5), 2.5 * s);
            curva(ctx, [[2 * s, 0], [16 * s, 18 * s]], alfa(oscurecer(c.piel, 0.5), 0.5), 2.5 * s);
        } else if (tipo === 'pluma') {
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(40 * s, -50 * s, 70 * s, -34 * s);
            ctx.quadraticCurveTo(62 * s, -16 * s, 66 * s, -6 * s); ctx.quadraticCurveTo(52 * s, -6 * s, 54 * s, 8 * s);
            ctx.quadraticCurveTo(36 * s, 4 * s, 34 * s, 18 * s); ctx.quadraticCurveTo(14 * s, 14 * s, 0, 14 * s); ctx.closePath();
            pintar(ctx, c.ala || c.piel, 34 * s, -10 * s, 40 * s);
        } else if (tipo === 'fuego') {
            for (let i = 0; i < 4; i++) {
                const g = ctx.createLinearGradient(0, 0, 70 * s, -40 * s);
                g.addColorStop(0, '#dc2626'); g.addColorStop(0.5, '#f97316'); g.addColorStop(1, '#fde047');
                ctx.beginPath(); ctx.moveTo(0, i * 6 * s); ctx.quadraticCurveTo(36 * s, -40 * s + i * 10 * s, (76 - i * 8) * s, (-44 + i * 18) * s);
                ctx.quadraticCurveTo(40 * s, -8 * s + i * 10 * s, 0, 14 * s + i * 4 * s); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
            }
        } else if (tipo === 'hada' || tipo === 'mariposa') {
            const c1 = c.ala || '#a78bfa'; const c2 = c.ala2 || '#f0abfc';
            elipse(ctx, 34 * s, -30 * s, 34 * s, 28 * s, -0.5); ctx.fillStyle = alfa(c1, tipo === 'hada' ? 0.55 : 0.95); ctx.fill();
            ctx.lineWidth = 3.5 * s; ctx.strokeStyle = oscurecer(c1, 0.45); ctx.stroke();
            elipse(ctx, 26 * s, 18 * s, 22 * s, 18 * s, 0.5); ctx.fillStyle = alfa(c2, tipo === 'hada' ? 0.55 : 0.95); ctx.fill(); ctx.stroke();
            if (tipo === 'mariposa') {
                elipse(ctx, 40 * s, -34 * s, 10 * s, 9 * s); ctx.fillStyle = '#fef3c7'; ctx.fill();
                elipse(ctx, 40 * s, -34 * s, 5 * s, 5 * s); ctx.fillStyle = OSCURO; ctx.fill();
                elipse(ctx, 28 * s, 20 * s, 6 * s, 5 * s); ctx.fillStyle = '#fef3c7'; ctx.fill();
            } else { brillo(ctx, 30 * s, -38 * s, 12 * s, 7 * s, 0.6); }
        }
        ctx.restore();
    }
}
function marcas(ctx, tipo, cx, cy, r, c, s) {
    if (!tipo) return;
    ctx.save(); elipse(ctx, cx, cy, r.rx, r.ry); ctx.clip();
    ctx.fillStyle = c.raya || OSCURO;
    if (tipo === 'rayas') {
        for (const d of [-1, 1]) for (let i = 0; i < 3; i++) {
            pico(ctx, [[cx + d * r.rx, cy - r.ry * 0.5 + i * 22 * s], [cx + d * (r.rx - 26 * s), cy - r.ry * 0.45 + i * 22 * s + 5 * s], [cx + d * r.rx, cy - r.ry * 0.5 + i * 22 * s + 10 * s]], c.raya || OSCURO, { sinLinea: true, plano: true });
        }
        pico(ctx, [[cx - 8 * s, cy - r.ry], [cx, cy - r.ry + 26 * s], [cx + 8 * s, cy - r.ry]], c.raya || OSCURO, { sinLinea: true, plano: true });
    } else if (tipo === 'manchas') {
        const pts = [[-0.55, -0.35], [0.5, -0.45], [-0.7, 0.2], [0.65, 0.15], [0.05, -0.78], [-0.3, 0.6], [0.35, 0.62]];
        for (const [a, b] of pts) {
            elipse(ctx, cx + a * r.rx, cy + b * r.ry, 7 * s, 6 * s); ctx.fillStyle = c.raya || '#78350f'; ctx.fill();
            elipse(ctx, cx + a * r.rx, cy + b * r.ry, 3 * s, 2.5 * s); ctx.fillStyle = c.mancha || '#d97706'; ctx.fill();
        }
    } else if (tipo === 'antifaz') {
        elipse(ctx, cx - 26 * s, cy + 8 * s, 24 * s, 16 * s, 0.3); ctx.fill();
        elipse(ctx, cx + 26 * s, cy + 8 * s, 24 * s, 16 * s, -0.3); ctx.fill();
    } else if (tipo === 'panda') {
        elipse(ctx, cx - 24 * s, cy + 6 * s, 17 * s, 21 * s, 0.5); ctx.fill();
        elipse(ctx, cx + 24 * s, cy + 6 * s, 17 * s, 21 * s, -0.5); ctx.fill();
    } else if (tipo === 'cara') { // cara de otro color (mono, búho, koala)
        ctx.fillStyle = c.cara;
        elipse(ctx, cx - 18 * s, cy + 2 * s, 28 * s, 30 * s); ctx.fill();
        elipse(ctx, cx + 18 * s, cy + 2 * s, 28 * s, 30 * s); ctx.fill();
        elipse(ctx, cx, cy + 24 * s, 36 * s, 26 * s); ctx.fill();
    } else if (tipo === 'mascara') { // zorro, lobo, gato: mejillas y hocico claros
        ctx.fillStyle = c.vientre || '#ffffff';
        elipse(ctx, cx, cy + r.ry * 0.55, r.rx * 0.75, r.ry * 0.5); ctx.fill();
    } else if (tipo === 'calva') { // águila: cabeza blanca
        // Solo la parte de arriba (la cabeza), con el borde ondulado como plumas
        ctx.beginPath(); ctx.moveTo(cx - r.rx, cy - r.ry);
        ctx.lineTo(cx + r.rx, cy - r.ry); ctx.lineTo(cx + r.rx, cy - r.ry * 0.05);
        for (let i = 0; i <= 8; i++) { const x = cx + r.rx - (i * r.rx * 2) / 8; ctx.lineTo(x, cy - r.ry * 0.05 + (i % 2 ? 14 * s : 0)); }
        ctx.closePath(); ctx.fillStyle = c.cabeza || '#ffffff'; ctx.fill();
    }
    ctx.restore();
}
function hocico(ctx, tipo, x, y, c, s, humor) {
    if (tipo === 'nariz') {
        pico(ctx, [[x - 5 * s, y - 2 * s], [x + 5 * s, y - 2 * s], [x, y + 4 * s]], c.nariz || '#f472b6', { linea: 2 * s });
        boca(ctx, x, y + 6 * s, s, humor, { tipo: 'gato', colmillo: c.colmillo });
    } else if (tipo === 'morro') {
        bola(ctx, c.morro || aclarar(c.piel, 0.5), x, y + 6 * s, 20 * s, 15 * s, { linea: 3 * s });
        bola(ctx, c.nariz || OSCURO, x, y, 7 * s, 5 * s, { linea: 1.5 * s });
        brillo(ctx, x - 2 * s, y - 1.5 * s, 2.5 * s, 1.5 * s, 0.7);
        boca(ctx, x, y + 9 * s, s * 0.9, humor, { colmillo: c.colmillo });
    } else if (tipo === 'pico') {
        pico(ctx, [[x - 11 * s, y - 3 * s], [x + 11 * s, y - 3 * s], [x, y + 13 * s]], c.pico || '#f59e0b', { linea: 2.8 * s });
        curva(ctx, [[x - 10 * s, y + 1 * s], [x + 10 * s, y + 1 * s]], alfa(oscurecer(c.pico || '#f59e0b', 0.5), 0.7), 1.8 * s);
    } else if (tipo === 'ganchudo') {
        ctx.beginPath(); ctx.moveTo(x - 11 * s, y - 4 * s); ctx.quadraticCurveTo(x + 6 * s, y - 10 * s, x + 12 * s, y + 2 * s);
        ctx.quadraticCurveTo(x + 8 * s, y + 16 * s, x + 2 * s, y + 14 * s); ctx.quadraticCurveTo(x - 6 * s, y + 4 * s, x - 11 * s, y - 4 * s); ctx.closePath();
        pintar(ctx, c.pico || '#facc15', x, y, 14 * s, { linea: 2.8 * s });
    } else if (tipo === 'pato') {
        bola(ctx, c.pico || '#fb923c', x, y + 4 * s, 20 * s, 10 * s, { linea: 3 * s });
        curva(ctx, [[x - 16 * s, y + 5 * s], [x, y + 8 * s], [x + 16 * s, y + 5 * s]], alfa(oscurecer(c.pico || '#fb923c', 0.5), 0.8), 2 * s);
    } else if (tipo === 'cerdo') {
        bola(ctx, c.morro || oscurecer(c.piel, 0.1), x, y + 2 * s, 17 * s, 12 * s, { linea: 3 * s });
        elipse(ctx, x - 6 * s, y + 2 * s, 3 * s, 4.5 * s); ctx.fillStyle = oscurecer(c.piel, 0.5); ctx.fill();
        elipse(ctx, x + 6 * s, y + 2 * s, 3 * s, 4.5 * s); ctx.fill();
        boca(ctx, x, y + 15 * s, s * 0.85, humor);
    } else if (tipo === 'rana') {
        if (humor === 'feliz') {
            ctx.beginPath(); ctx.moveTo(x - 30 * s, y); ctx.quadraticCurveTo(x, y + 26 * s, x + 30 * s, y); ctx.closePath();
            ctx.fillStyle = '#7f1d1d'; ctx.fill(); ctx.lineWidth = 3 * s; ctx.strokeStyle = OSCURO; ctx.stroke();
            elipse(ctx, x, y + 9 * s, 10 * s, 5 * s); ctx.fillStyle = '#fb7185'; ctx.fill();
        } else curva(ctx, [[x - 30 * s, y], [x, y + 12 * s], [x + 30 * s, y]], OSCURO, 3.2 * s);
    } else if (tipo === 'dientes') { // T-Rex, tiburón: sonrisa con dientes
        ctx.beginPath(); ctx.moveTo(x - 26 * s, y); ctx.quadraticCurveTo(x, y + 22 * s, x + 26 * s, y); ctx.closePath();
        ctx.fillStyle = '#7f1d1d'; ctx.fill(); ctx.lineWidth = 3 * s; ctx.strokeStyle = OSCURO; ctx.stroke();
        for (let i = -3; i <= 3; i++) pico(ctx, [[x + i * 7 * s - 3.5 * s, y + 1 * s + Math.abs(i) * -0.3 * s], [x + i * 7 * s + 3.5 * s, y + 1 * s], [x + i * 7 * s, y + 8 * s]], '#ffffff', { linea: 1 * s });
    } else {
        boca(ctx, x, y, s, humor, { colmillo: c.colmillo });
    }
}

// ---------------------------------------------------------------------------
// Cuerpos
// ---------------------------------------------------------------------------
// Cuadrúpedo/bípedo chibi (casi todos los animales): cuerpo bajito, cabeza enorme.
function chibi(ctx, d, o) {
    const { s, t, humor } = o;
    const c = d.c;
    const resp = Math.sin(t * PI2);
    const bebe = o.etapa === 0;
    const cab = bebe ? 1.08 : 1; // los bebés, más cabezones
    const cuerpo = bebe ? 0.82 : o.etapa === 1 ? 0.92 : 1;
    const cy = 176; const hy = 108 + resp * 1.6;
    ctx._piel = c.piel;
    // Detrás: cola, alas, caparazón, púas, melena
    if (d.cola) cola(ctx, d.cola, 160, 196, c, s * (bebe ? 0.8 : 1), resp);
    if (d.alas) alas(ctx, d.alas, 128, cy - 10, c, s, (t * 2) % 1, o.etapa);
    if (d.puas) {
        for (let i = -4; i <= 4; i++) {
            const a = i * 0.36 - Math.PI / 2; const R = 64 * s * cab;
            pico(ctx, [[128 + Math.cos(a - 0.2) * R * 0.8, hy + 10 + Math.sin(a - 0.2) * R * 0.8], [128 + Math.cos(a) * (R + 22 * s), hy + 10 + Math.sin(a) * (R + 22 * s)], [128 + Math.cos(a + 0.2) * R * 0.8, hy + 10 + Math.sin(a + 0.2) * R * 0.8]], c.puas || oscurecer(c.piel, 0.35));
        }
    }
    if (d.caparazon) {
        bola(ctx, c.caparazon || '#65a30d', 128, cy - 4, 70 * s * cuerpo, 54 * s * cuerpo);
        ctx.save(); elipse(ctx, 128, cy - 4, 70 * s * cuerpo, 54 * s * cuerpo); ctx.clip();
        ctx.strokeStyle = oscurecer(c.caparazon || '#65a30d', 0.4); ctx.lineWidth = 3 * s;
        for (const [hx, hy2] of [[128, cy - 30], [96, cy - 10], [160, cy - 10], [112, cy + 20], [144, cy + 20]]) {
            ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; ctx.lineTo(hx + Math.cos(a) * 16 * s, hy2 + Math.sin(a) * 16 * s); } ctx.closePath(); ctx.stroke();
        }
        ctx.restore();
    }
    if (d.melena) {
        const n = 14; const R = 70 * s * cab;
        for (let i = 0; i < n; i++) { const a = (i / n) * PI2; bola(ctx, c.melena, 128 + Math.cos(a) * R * 0.86, hy + 6 + Math.sin(a) * R * 0.86, 20 * s, 20 * s, { linea: 3.5 }); }
    }
    // Orejas detrás de la cabeza
    if (d.orejas && d.orejas !== 'caida') {
        const ox = (d.orejas === 'grande' ? 54 : d.orejas === 'larga' ? 24 : 40) * s * cab;
        const oy = hy - (d.orejas === 'grande' ? 34 : d.orejas === 'larga' ? 44 : 46) * s * cab;
        oreja(ctx, d.orejas, 128 - ox, oy, -1, c, s * cab, resp);
        oreja(ctx, d.orejas, 128 + ox, oy, 1, c, s * cab, -resp);
    }
    // Cuerpo, patas y barriga
    const bx = 50 * s * cuerpo; const by = (40 + resp * 1.2) * s * cuerpo;
    for (const lado of [-1, 1]) bola(ctx, c.patas || c.piel, 128 + lado * 26 * s * cuerpo, 224, 18 * s * cuerpo, 11 * s * cuerpo);
    bola(ctx, c.piel, 128, cy + 10, bx, by);
    if (c.vientre) { elipse(ctx, 128, cy + 18, bx * 0.6, by * 0.62); ctx.fillStyle = c.vientre; ctx.fill(); }
    if (d.marcasCuerpo) marcas(ctx, d.marcasCuerpo, 128, cy + 10, { rx: bx, ry: by }, c, s);
    if (!d.sinBrazos) for (const lado of [-1, 1]) bola(ctx, c.patas || c.piel, 128 + lado * (bx - 4 * s), cy + 12, 12 * s * cuerpo, 15 * s * cuerpo, { rot: lado * 0.4 });
    if (d.brazitos) for (const lado of [-1, 1]) bola(ctx, c.piel, 128 + lado * 22 * s, cy + 2, 7 * s, 5 * s, { rot: lado * 0.8 });
    // Cabeza
    const hr = { rx: 66 * s * cab * (d.anchoCabeza || 1), ry: 58 * s * cab };
    bola(ctx, c.cabeza || c.piel, 128, hy, hr.rx, hr.ry);
    if (c.cabeza) ctx._piel = c.cabeza;
    if (d.marcas) marcas(ctx, d.marcas, 128, hy, hr, c, s);
    if (d.orejas === 'caida') { oreja(ctx, 'caida', 128 - hr.rx + 6 * s, hy - 30 * s, -1, c, s, resp); oreja(ctx, 'caida', 128 + hr.rx - 6 * s, hy - 30 * s, 1, c, s, -resp); }
    if (d.mofletes) { bola(ctx, c.piel, 128 - 46 * s, hy + 22 * s, 22 * s, 18 * s, { linea: 3 }); bola(ctx, c.piel, 128 + 46 * s, hy + 22 * s, 22 * s, 18 * s, { linea: 3 }); }
    brillo(ctx, 128 - hr.rx * 0.45, hy - hr.ry * 0.55, hr.rx * 0.28, hr.ry * 0.14, 0.35);
    // Cosas de la cabeza (cuerno, cuernos, cresta, mechón)
    if (d.cuerno) {
        const k = bebe ? 0.55 : o.etapa === 1 ? 0.8 : 1;
        const g = ctx.createLinearGradient(128, hy - 60 * s, 128, hy - (60 + 46 * k) * s);
        g.addColorStop(0, '#fde68a'); g.addColorStop(1, '#f9a8d4');
        ctx.beginPath(); ctx.moveTo(116 * 1, hy - 50 * s); ctx.lineTo(128, hy - (58 + 48 * k) * s); ctx.lineTo(140, hy - 50 * s); ctx.closePath();
        ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#a16207'; ctx.stroke();
        for (let i = 1; i < 4; i++) curva(ctx, [[120 + i * 1.5, hy - (52 + i * 11 * k) * s], [136 - i * 1.5, hy - (56 + i * 11 * k) * s]], '#ca8a04', 2);
    }
    if (d.cuernos) {
        const k = bebe ? 0.5 : o.etapa === 1 ? 0.78 : 1;
        for (const lado of [-1, 1]) pico(ctx, [[128 + lado * 22 * s, hy - 48 * s], [128 + lado * (40 + 6 * k) * s, hy - (52 + 40 * k) * s], [128 + lado * 40 * s, hy - 40 * s]], c.cuernos || '#fef3c7');
    }
    if (d.cresta) for (let i = 0; i < 3; i++) pico(ctx, [[118 + i * 10 - 6, hy - 54 * s + i * 2], [124 + i * 10, hy - (72 - i * 4) * s * (bebe ? 0.7 : 1)], [130 + i * 10, hy - 54 * s + i * 2]], c.acento || oscurecer(c.piel, 0.2));
    if (d.mechon) { pico(ctx, [[118, hy - 54 * s], [124, hy - 76 * s], [130, hy - 56 * s]], c.mechon || c.piel); pico(ctx, [[126, hy - 56 * s], [138, hy - 74 * s], [140, hy - 52 * s]], c.mechon || c.piel); }
    if (d.antenas) for (const lado of [-1, 1]) { curva(ctx, [[128 + lado * 14 * s, hy - 52 * s], [128 + lado * 22 * s, hy - 80 * s], [128 + lado * 34 * s, hy - 88 * s]], OSCURO, 3.5 * s); bola(ctx, c.acento || '#f472b6', 128 + lado * 34 * s, hy - 88 * s, 7 * s, 7 * s, { linea: 2.5 }); }
    if (d.bigotesDragon) for (const lado of [-1, 1]) curva(ctx, [[128 + lado * 20 * s, hy + 26 * s], [128 + lado * 62 * s, hy + 18 * s + Math.sin(t * PI2) * 4], [128 + lado * 80 * s, hy + 44 * s]], c.acento || '#f59e0b', 3.5 * s);
    // Cara
    const ey = hy + (d.ojosY || 4) * s;
    const sep = (d.sepOjos || 26) * s * cab;
    if (d.ojosArriba) { for (const lado of [-1, 1]) bola(ctx, c.piel, 128 + lado * 30 * s, hy - 46 * s, 22 * s, 20 * s); }
    ojos(ctx, 128, d.ojosArriba ? hy - 46 * s : ey, d.ojosArriba ? 30 * s : sep, s * cab * (d.ojoTam || 1), { iris: c.ojos || '#7c4a1f', humor, parpadeo: o.parpadeo });
    if (d.discoOjos) for (const lado of [-1, 1]) { elipse(ctx, 128 + lado * sep, ey, 21 * s, 21 * s); ctx.lineWidth = 3; ctx.strokeStyle = alfa(oscurecer(c.piel, 0.5), 0.6); ctx.stroke(); }
    if (!d.sinMofletes) mofletes(ctx, 128, ey + 20 * s, sep + 10 * s, s, c.mofletes);
    hocico(ctx, d.hocico || 'boca', 128, ey + (d.hocico === 'pico' || d.hocico === 'ganchudo' ? 12 : d.hocico === 'rana' ? 30 : 20) * s, c, s * cab, humor);
}

// Pájaro redondito (pollito, pingüino, búho…)
function ave(ctx, d, o) {
    const { s, t, humor } = o; const c = d.c; const resp = Math.sin(t * PI2);
    ctx._piel = c.piel;
    const bebe = o.etapa === 0;
    const cy = (d.patasLargas ? 128 : 150) + resp * 1.5;
    if (d.cola) cola(ctx, d.cola, 128, 220, c, s, resp);
    if (d.alas === 'fuego' || d.alas === 'pluma') alas(ctx, d.alas, 128, cy + 10, c, s, (t * 2) % 1, o.etapa);
    if (d.cuello) { bola(ctx, c.piel, 128, 200, 18 * s, 40 * s); }
    for (const lado of [-1, 1]) {
        if (d.patasLargas) { curva(ctx, [[128 + lado * 14 * s, 190], [128 + lado * 10 * s, 212], [128 + lado * 18 * s, 234]], oscurecer(c.patas || '#f97316', 0.4), 8 * s); curva(ctx, [[128 + lado * 14 * s, 190], [128 + lado * 10 * s, 212], [128 + lado * 18 * s, 234]], c.patas || '#f97316', 5 * s); }
        bola(ctx, c.patas || '#f97316', 128 + lado * 22 * s, d.patasLargas ? 236 : 226, 14 * s, 7 * s, { linea: 3 });
    }
    const R = (bebe ? 76 : 80) * s * (d.patasLargas ? 0.8 : 1);
    bola(ctx, c.piel, 128, cy + 20, R, R * 0.96);
    if (c.vientre) { elipse(ctx, 128, cy + 44, R * 0.62, R * 0.62); ctx.fillStyle = c.vientre; ctx.fill(); }
    if (d.marcas) marcas(ctx, d.marcas, 128, cy + 20, { rx: R, ry: R * 0.96 }, c, s);
    if (d.alas !== 'fuego' && d.alas !== 'pluma') for (const lado of [-1, 1]) {
        ctx.save(); ctx.translate(128 + lado * (R - 6 * s), cy + 36); ctx.rotate(lado * (0.25 + Math.sin(t * PI2 * 2) * 0.08));
        bola(ctx, c.ala || oscurecer(c.piel, 0.12), 0, 0, 16 * s, 34 * s); ctx.restore();
    }
    if (d.orejas) { oreja(ctx, d.orejas, 128 - 50 * s, cy - 50 * s, -1, c, s, resp); oreja(ctx, d.orejas, 128 + 50 * s, cy - 50 * s, 1, c, s, -resp); }
    if (d.mechon) for (let i = -1; i <= 1; i++) curva(ctx, [[128 + i * 6, cy - R + 24 * s], [128 + i * 12, cy - R], [128 + i * 18, cy - R - 6 * s]], c.mechon || oscurecer(c.piel, 0.2), 4 * s);
    if (d.cresta) for (let i = 0; i < 3; i++) {
        const g = ctx.createLinearGradient(0, cy - R - 30, 0, cy - R + 20); g.addColorStop(0, '#fde047'); g.addColorStop(1, '#ef4444');
        ctx.beginPath(); ctx.moveTo(112 + i * 14, cy - R + 24 * s); ctx.quadraticCurveTo(108 + i * 16, cy - R - 24 * s, 124 + i * 10, cy - R - 34 * s); ctx.quadraticCurveTo(124 + i * 12, cy - R, 136 + i * 8, cy - R + 24 * s); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    }
    if (d.corona) for (let i = -1; i <= 1; i++) { curva(ctx, [[128 + i * 10 * s, cy - R + 16 * s], [128 + i * 16 * s, cy - R - 16 * s]], '#0f766e', 2.5 * s); bola(ctx, '#1d4ed8', 128 + i * 16 * s, cy - R - 18 * s, 5 * s, 5 * s, { linea: 2 }); }
    brillo(ctx, 128 - R * 0.42, cy - R * 0.45, R * 0.26, R * 0.12, 0.35);
    const ey = cy - 8 * s; const sep = (d.sepOjos || 28) * s;
    if (d.discoOjos) for (const lado of [-1, 1]) { bola(ctx, c.cara || aclarar(c.piel, 0.4), 128 + lado * sep, ey, 26 * s, 26 * s, { linea: 3 }); }
    ojos(ctx, 128, ey, sep, s * (d.ojoTam || 1), { iris: c.ojos || '#7c4a1f', humor, parpadeo: o.parpadeo });
    mofletes(ctx, 128, ey + 22 * s, sep + 10 * s, s);
    hocico(ctx, d.hocico || 'pico', 128, ey + 16 * s, c, s, humor);
}

// Del agua (tiburón, ballena)
function acuatico(ctx, d, o) {
    const { s, t, humor } = o; const c = d.c; const resp = Math.sin(t * PI2);
    ctx._piel = c.piel;
    const cy = 150 + resp * 4; // flota
    // Burbujas
    for (let i = 0; i < 4; i++) { const k = (t + i / 4) % 1; elipse(ctx, 40 + i * 58, 230 - k * 200, 4 + i, 4 + i); ctx.strokeStyle = `rgba(186,230,253,${0.7 * (1 - k)})`; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.save(); ctx.translate(196, cy + 20); ctx.rotate(resp * 0.15); pico(ctx, [[0, 0], [44 * s, -36 * s], [34 * s, 0], [44 * s, 34 * s]], c.aleta || oscurecer(c.piel, 0.1)); ctx.restore();
    if (d.aletaDorsal) pico(ctx, [[110, cy - 56 * s], [138, cy - 112 * s], [156, cy - 52 * s]], c.piel);
    const rx = 92 * s; const ry = 68 * s;
    bola(ctx, c.piel, 128, cy + 10, rx, ry);
    if (c.vientre) { ctx.save(); elipse(ctx, 128, cy + 10, rx, ry); ctx.clip(); elipse(ctx, 128, cy + 62, rx * 0.95, ry * 0.7); ctx.fillStyle = c.vientre; ctx.fill(); if (d.rayasVientre) for (let i = -3; i <= 3; i++) curva(ctx, [[128 + i * 16, cy + 28], [128 + i * 16, cy + 80]], alfa(oscurecer(c.vientre, 0.3), 0.6), 2.5); ctx.restore(); }
    for (const lado of [-1, 1]) { ctx.save(); ctx.translate(128 + lado * 50 * s, cy + 52); ctx.rotate(lado * (0.7 + resp * 0.1)); bola(ctx, c.aleta || oscurecer(c.piel, 0.1), 0, 0, 12 * s, 24 * s); ctx.restore(); }
    if (d.branquias) for (let i = 0; i < 3; i++) curva(ctx, [[60 + i * 8, cy - 4], [56 + i * 8, cy + 14], [60 + i * 8, cy + 30]], alfa(oscurecer(c.piel, 0.5), 0.7), 2.5);
    if (d.chorro) for (let i = -1; i <= 1; i++) { const k = (t * 2) % 1; curva(ctx, [[128, cy - ry + 10], [128 + i * 20, cy - ry - 40 - k * 6], [128 + i * 38, cy - ry - 20]], alfa('#7dd3fc', 0.9), 5); }
    brillo(ctx, 128 - rx * 0.45, cy - ry * 0.4, rx * 0.26, ry * 0.14, 0.4);
    const ey = cy - 6 * s;
    ojos(ctx, 128, ey, 32 * s, s, { iris: c.ojos || '#1e3a8a', humor, parpadeo: o.parpadeo });
    mofletes(ctx, 128, ey + 22 * s, 44 * s, s);
    hocico(ctx, d.hocico || 'boca', 128, ey + 28 * s, c, s, humor);
}

// Pulpo / kraken
function pulpo(ctx, d, o) {
    const { s, t, humor } = o; const c = d.c; const resp = Math.sin(t * PI2);
    ctx._piel = c.piel;
    const cy = 120 + resp * 3;
    for (let i = 0; i < 6; i++) {
        const x0 = 70 + i * 23; const fase = t * PI2 + i;
        ctx.beginPath(); ctx.moveTo(x0 - 10, cy + 40);
        const fx = Math.sin(fase) * 14; const fx2 = Math.sin(fase + 1) * 10;
        ctx.beginPath(); ctx.moveTo(x0 - 14, cy + 40);
        ctx.bezierCurveTo(x0 - 20 + fx2, cy + 84, x0 - 8 + fx, cy + 104, x0 - 4 + fx, 222);
        ctx.quadraticCurveTo(x0 + 6 + fx, 240, x0 + 16 + fx, 226);
        ctx.bezierCurveTo(x0 + 14 + fx, cy + 100, x0 + 22 + fx2, cy + 80, x0 + 16, cy + 40); ctx.closePath();
        pintar(ctx, c.piel, x0, cy + 80, 50, { linea: 3.5 });
        for (let k = 0; k < 3; k++) { elipse(ctx, x0 + 4 + fx * (0.3 + k * 0.3), cy + 64 + k * 26, 4, 3.5); ctx.fillStyle = aclarar(c.piel, 0.55); ctx.fill(); }
    }
    bola(ctx, c.piel, 128, cy, 80 * s, 76 * s);
    for (const [a, b, r] of [[-40, -40, 8], [30, -50, 6], [50, -20, 5], [-20, -62, 5]]) { elipse(ctx, 128 + a * s, cy + b * s, r * s, r * s); ctx.fillStyle = alfa(aclarar(c.piel, 0.4), 0.7); ctx.fill(); }
    brillo(ctx, 128 - 34 * s, cy - 40 * s, 22 * s, 10 * s, 0.35);
    ojos(ctx, 128, cy + 10 * s, 30 * s, s * 1.1, { iris: c.ojos || '#facc15', humor, parpadeo: o.parpadeo });
    mofletes(ctx, 128, cy + 34 * s, 42 * s, s);
    boca(ctx, 128, cy + 36 * s, s, humor);
}

// Mariposa: cuerpecito y alas grandes
function insecto(ctx, d, o) {
    const { s, t, humor } = o; const c = d.c;
    ctx._piel = c.piel;
    const cy = 132 + Math.sin(t * PI2) * 5;
    alas(ctx, 'mariposa', 128, cy + 30, c, s * 1.2, (t * 2) % 1, o.etapa);
    bola(ctx, c.piel, 128, cy + 66, 16 * s, 44 * s);
    for (let i = 0; i < 3; i++) curva(ctx, [[114, cy + 52 + i * 16], [142, cy + 52 + i * 16]], alfa(oscurecer(c.piel, 0.5), 0.6), 2.5);
    for (const lado of [-1, 1]) { curva(ctx, [[128 + lado * 10, cy - 30], [128 + lado * 26, cy - 72], [128 + lado * 40, cy - 78]], OSCURO, 3.5); bola(ctx, c.acento || '#f472b6', 128 + lado * 40, cy - 78, 7, 7, { linea: 2.5 }); }
    bola(ctx, c.piel, 128, cy, 46 * s, 42 * s);
    brillo(ctx, 112, cy - 22, 12, 6, 0.4);
    ojos(ctx, 128, cy + 2, 18 * s, s * 0.85, { iris: c.ojos || '#6d28d9', humor, parpadeo: o.parpadeo });
    mofletes(ctx, 128, cy + 18, 26 * s, s * 0.8);
    boca(ctx, 128, cy + 20, s * 0.8, humor);
}

// Gólem (mascota del servidor): bloques de roca con musgo y ojos que brillan.
function golem(ctx, d, o) {
    const { s, t, humor } = o; const c = d.c; const resp = Math.sin(t * PI2);
    ctx._piel = c.piel;
    const cy = 170 + resp;
    const roca = (x, y, w, h, col = c.piel) => {
        ctx.beginPath(); ctx.moveTo(x - w * 0.5, y - h * 0.35); ctx.lineTo(x - w * 0.3, y - h * 0.5); ctx.lineTo(x + w * 0.35, y - h * 0.5);
        ctx.lineTo(x + w * 0.5, y - h * 0.2); ctx.lineTo(x + w * 0.45, y + h * 0.45); ctx.lineTo(x - w * 0.4, y + h * 0.5); ctx.closePath();
        pintar(ctx, col, x, y, Math.max(w, h) / 2);
    };
    for (const lado of [-1, 1]) roca(128 + lado * 30 * s, 222, 34 * s, 22 * s);
    for (const lado of [-1, 1]) roca(128 + lado * 72 * s, cy + 12, 36 * s, 54 * s);
    roca(128, cy + 10, 110 * s, 80 * s);
    roca(128, 102 + resp * 1.5, 108 * s, 92 * s);
    for (const [x, y] of [[96, 70], [150, 64], [72, cy], [178, cy + 4]]) { elipse(ctx, x, y + resp, 14 * s, 6 * s); ctx.fillStyle = '#4d7c0f'; ctx.fill(); elipse(ctx, x - 4, y - 2 + resp, 6, 3); ctx.fillStyle = '#84cc16'; ctx.fill(); }
    curva(ctx, [[104, cy - 6], [116, cy + 14], [108, cy + 34]], alfa(OSCURO, 0.4), 2.5);
    const ey = 108 + resp * 1.5;
    const brilloOjos = humor === 'dormido' || o.parpadeo ? 0 : 1;
    for (const lado of [-1, 1]) {
        if (!brilloOjos) { curva(ctx, [[128 + lado * 24 - 9, ey], [128 + lado * 24 + 9, ey]], OSCURO, 3.5); continue; }
        const g = ctx.createRadialGradient(128 + lado * 24, ey, 0, 128 + lado * 24, ey, 18);
        g.addColorStop(0, '#ecfeff'); g.addColorStop(0.35, c.ojos || '#22d3ee'); g.addColorStop(1, alfa(c.ojos || '#22d3ee', 0));
        ctx.fillStyle = g; elipse(ctx, 128 + lado * 24, ey, 18, 18); ctx.fill();
    }
    boca(ctx, 128, ey + 28, s, humor);
}

// Robot (Pixel)
function robot(ctx, d, o) {
    const { s, t, humor } = o; const c = d.c; const resp = Math.sin(t * PI2);
    const cy = 176;
    curva(ctx, [[128, 46 + resp], [128, 26 + resp]], '#475569', 4);
    bola(ctx, '#f87171', 128, 22 + resp, 8, 8, { linea: 2.5 });
    if ((t * 4) % 1 < 0.5) { ctx.fillStyle = 'rgba(248,113,113,0.35)'; elipse(ctx, 128, 22 + resp, 14, 14); ctx.fill(); }
    for (const lado of [-1, 1]) bola(ctx, '#94a3b8', 128 + lado * 26, 224, 18, 10);
    for (const lado of [-1, 1]) { ctx.save(); ctx.translate(128 + lado * 56, cy + 4); ctx.rotate(lado * (0.3 + resp * 0.08)); bola(ctx, '#94a3b8', 0, 0, 11, 22); ctx.restore(); }
    ctx.beginPath(); ctx.roundRect(78, cy - 30, 100, 76, 22); pintar(ctx, c.piel, 128, cy, 60);
    ctx.beginPath(); ctx.roundRect(110, cy - 8, 36, 22, 6); ctx.fillStyle = '#1e293b'; ctx.fill();
    for (let i = 0; i < 3; i++) { elipse(ctx, 118 + i * 10, cy + 3, 3, 3); ctx.fillStyle = ['#22c55e', '#facc15', '#f87171'][i]; ctx.fill(); }
    ctx.beginPath(); ctx.roundRect(56, 44 + resp, 144, 116, 34); pintar(ctx, c.piel, 128, 100, 80);
    ctx.beginPath(); ctx.roundRect(72, 62 + resp, 112, 78, 22); ctx.fillStyle = '#0f172a'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#334155'; ctx.stroke();
    // Cara en la pantalla (luz cian)
    const L = '#67e8f9'; ctx.save(); ctx.shadowColor = L; ctx.shadowBlur = 12;
    const ey = 96 + resp;
    for (const lado of [-1, 1]) {
        const x = 128 + lado * 24;
        if (o.parpadeo || humor === 'dormido') curva(ctx, [[x - 9, ey], [x + 9, ey]], L, 4);
        else if (humor === 'feliz') curva(ctx, [[x - 10, ey + 4], [x, ey - 8], [x + 10, ey + 4]], L, 4.5);
        else if (humor === 'cansado' || humor === 'aburrido') { ctx.fillStyle = L; ctx.fillRect(x - 10, ey - 2, 20, 6); }
        else { ctx.fillStyle = L; ctx.beginPath(); ctx.roundRect(x - 8, ey - 12, 16, 24, 6); ctx.fill(); }
    }
    if (humor === 'feliz') curva(ctx, [[112, ey + 22], [128, ey + 32], [144, ey + 22]], L, 4);
    else if (humor === 'hambre') { ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = L; ctx.textAlign = 'center'; ctx.fillText('LOW', 128, ey + 32); }
    else curva(ctx, [[116, ey + 26], [140, ey + 26]], L, 3.5);
    ctx.restore();
    mofletes(ctx, 128, ey + 22, 40, 1, '#f472b6');
}

// Fantasma (Boo)
function fantasma(ctx, d, o) {
    const { t, humor } = o; const c = d.c;
    const cy = 120 + Math.sin(t * PI2) * 8;
    elipse(ctx, 128, 236, 50 - Math.sin(t * PI2) * 6, 8); ctx.fillStyle = 'rgba(15,23,42,0.18)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(52, cy + 20);
    ctx.bezierCurveTo(52, cy - 96, 204, cy - 96, 204, cy + 20);
    ctx.lineTo(204, cy + 92);
    for (let i = 0; i < 5; i++) { const x = 204 - (i + 1) * 30.4; ctx.quadraticCurveTo(x + 15, cy + 92 + (i % 2 ? -16 : 16) + Math.sin(t * PI2 + i) * 6, x, cy + 92); }
    ctx.closePath();
    ctx.globalAlpha = 0.95; pintar(ctx, c.piel, 128, cy, 90, { linea: 4 }); ctx.globalAlpha = 1;
    for (const lado of [-1, 1]) { ctx.save(); ctx.translate(128 + lado * 76, cy + 32); ctx.rotate(lado * -0.5); bola(ctx, c.piel, 0, 0, 14, 22, { linea: 3.5 }); ctx.restore(); }
    brillo(ctx, 92, cy - 40, 22, 10, 0.6);
    ctx._piel = c.piel;
    ojos(ctx, 128, cy + 4, 26, 1, { iris: '#4c1d95', humor, parpadeo: o.parpadeo });
    mofletes(ctx, 128, cy + 26, 40, 1.1);
    boca(ctx, 128, cy + 28, 1, humor);
}

// ---------------------------------------------------------------------------
// Personajes (chibi humano): pelo, ropa y su accesorio
// ---------------------------------------------------------------------------
function pelo(ctx, estilo, color, hy, s, fase, atras) {
    const P = color;
    if (atras) {
        if (estilo === 'largo' || estilo === 'sirena' || estilo === 'princesa') {
            ctx.beginPath(); ctx.moveTo(62, hy - 10); ctx.quadraticCurveTo(48, hy + 90, 70 + Math.sin(fase) * 3, hy + 120);
            ctx.lineTo(186 + Math.sin(fase) * 3, hy + 120); ctx.quadraticCurveTo(208, hy + 90, 194, hy - 10); ctx.closePath();
            pintar(ctx, P, 128, hy + 50, 80);
        }
        if (estilo === 'coleta') { ctx.save(); ctx.translate(184, hy - 30); ctx.rotate(0.5 + Math.sin(fase) * 0.08); bola(ctx, P, 20, 30, 18, 46); ctx.restore(); }
        if (estilo === 'coletas') for (const lado of [-1, 1]) { ctx.save(); ctx.translate(128 + lado * 66, hy - 20); ctx.rotate(lado * (0.3 + Math.sin(fase) * 0.06)); bola(ctx, P, 0, 40, 18, 44); ctx.restore(); }
        if (estilo === 'moño') bola(ctx, P, 128, hy - 70, 26, 22);
        if (estilo === 'vampiro') { ctx.beginPath(); ctx.moveTo(60, hy + 20); ctx.lineTo(70, hy - 50); ctx.lineTo(186, hy - 50); ctx.lineTo(196, hy + 20); ctx.closePath(); pintar(ctx, P, 128, hy - 10, 70); }
        return;
    }
    // Delante: flequillo
    ctx.beginPath();
    ctx.moveTo(58, hy + 4);
    ctx.bezierCurveTo(52, hy - 76, 204, hy - 76, 198, hy + 4);
    if (estilo === 'puntas' || estilo === 'heroe') {
        for (let i = 0; i < 6; i++) { const x = 198 - i * 23.3; ctx.lineTo(x - 8, hy - 40 + (i % 2) * 8); ctx.lineTo(x - 23, hy - 6); }
    } else if (estilo === 'vampiro') {
        ctx.quadraticCurveTo(170, hy - 44, 128, hy - 30); ctx.lineTo(118, hy - 6); ctx.quadraticCurveTo(100, hy - 40, 58, hy + 4);
    } else {
        ctx.quadraticCurveTo(186, hy - 30, 164, hy - 16); ctx.quadraticCurveTo(150, hy - 34, 134, hy - 14);
        ctx.quadraticCurveTo(118, hy - 38, 100, hy - 14); ctx.quadraticCurveTo(84, hy - 32, 70, hy - 10);
    }
    ctx.closePath();
    pintar(ctx, P, 128, hy - 40, 70);
    brillo(ctx, 100, hy - 46, 22, 7, 0.4);
    if (estilo === 'puntas' || estilo === 'heroe') for (let i = 0; i < 5; i++) pico(ctx, [[74 + i * 27, hy - 52], [62 + i * 30, hy - 88 + (i % 2) * 10], [94 + i * 26, hy - 56]], P);
}
function humano(ctx, d, o) {
    const { t, humor } = o; const c = d.c; const fase = t * PI2; const resp = Math.sin(fase);
    const hy = 100 + resp * 1.5; const cy = 186;
    const piel = c.piel || '#fde2c8';
    ctx._piel = piel;
    if (d.alas) alas(ctx, d.alas, 128, cy - 26, c, 0.9, (t * 2) % 1, 2);
    if (d.capa) { ctx.beginPath(); ctx.moveTo(84, cy - 30); ctx.quadraticCurveTo(70 + resp * 3, 210, 66, 238); ctx.lineTo(190, 238); ctx.quadraticCurveTo(186 - resp * 3, 210, 172, cy - 30); ctx.closePath(); pintar(ctx, c.capa, 128, 200, 70); }
    pelo(ctx, d.pelo, c.pelo, hy, 1, fase, true);
    // Cuerpo (o cola de sirena / humo del genio)
    if (d.sirena) {
        ctx.beginPath(); ctx.moveTo(96, cy - 20); ctx.quadraticCurveTo(84, 220, 120, 226); ctx.quadraticCurveTo(150 + resp * 4, 232, 170, 214);
        ctx.lineTo(196, 224 + resp * 4); ctx.lineTo(188, 196); ctx.lineTo(160, 204); ctx.quadraticCurveTo(170, 180, 160, cy - 20); ctx.closePath();
        pintar(ctx, c.ropa, 128, 200, 60);
        for (let i = 0; i < 4; i++) curva(ctx, [[104 + i * 4, cy + i * 10], [128, cy + 6 + i * 10], [152 - i * 4, cy + i * 10]], alfa(aclarar(c.ropa, 0.4), 0.7), 2.5);
    } else if (d.humo) {
        const g = ctx.createLinearGradient(0, cy - 20, 0, 240); g.addColorStop(0, c.ropa); g.addColorStop(1, alfa(c.ropa, 0));
        ctx.beginPath(); ctx.moveTo(94, cy - 20); ctx.quadraticCurveTo(80, 220, 128 + resp * 10, 244); ctx.quadraticCurveTo(170, 220, 162, cy - 20); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    } else {
        for (const lado of [-1, 1]) bola(ctx, c.zapatos || '#334155', 128 + lado * 18, 228, 14, 9);
        ctx.beginPath(); ctx.moveTo(98, cy - 24); ctx.lineTo(160, cy - 24); ctx.quadraticCurveTo(176, cy + 30, 172, cy + 38); ctx.lineTo(84, cy + 38); ctx.quadraticCurveTo(80, cy + 30, 98, cy - 24); ctx.closePath();
        pintar(ctx, c.ropa, 128, cy + 6, 50);
        if (c.ropa2) { ctx.beginPath(); ctx.moveTo(118, cy - 24); ctx.lineTo(128, cy - 6); ctx.lineTo(138, cy - 24); ctx.closePath(); ctx.fillStyle = c.ropa2; ctx.fill(); }
        if (d.cinturon) { ctx.fillStyle = c.cinturon || OSCURO; ctx.fillRect(88, cy + 10, 80, 7); }
    }
    for (const lado of [-1, 1]) { ctx.save(); ctx.translate(128 + lado * 40, cy - 8); ctx.rotate(lado * (0.35 + resp * 0.05)); bola(ctx, c.ropa, 0, 12, 10, 20); bola(ctx, piel, 0, 32, 8, 8, { linea: 3 }); ctx.restore(); }
    // Objeto en la mano
    if (d.objeto) objetoMano(ctx, d.objeto, c, cy, fase);
    // Cabeza
    if (d.orejasElfo || d.orejasPunta) for (const lado of [-1, 1]) pico(ctx, [[128 + lado * 60, hy - 4], [128 + lado * 92, hy - 26], [128 + lado * 62, hy + 18]], piel);
    bola(ctx, piel, 128, hy, 68, 62);
    if (d.marcasCara === 'puntos') for (const [x, y] of [[90, hy + 30], [168, hy + 26], [150, hy - 30]]) { curva(ctx, [[x - 8, y], [x + 8, y]], '#7f1d1d', 2); for (let k = -1; k <= 1; k++) curva(ctx, [[x + k * 6, y - 4], [x + k * 6, y + 4]], '#7f1d1d', 1.5); }
    pelo(ctx, d.pelo, c.pelo, hy, 1, fase, false);
    // Cara
    const ey = hy + 14;
    if (d.mascara === 'ninja') { ctx.save(); elipse(ctx, 128, hy, 67, 61); ctx.clip(); ctx.fillStyle = c.mascara || '#1e293b'; ctx.fillRect(40, ey + 14, 180, 80); ctx.restore(); }
    if (d.antifazHeroe) { ctx.beginPath(); ctx.moveTo(78, ey - 14); ctx.quadraticCurveTo(128, ey - 26, 178, ey - 14); ctx.quadraticCurveTo(180, ey + 14, 150, ey + 14); ctx.quadraticCurveTo(128, ey + 4, 106, ey + 14); ctx.quadraticCurveTo(76, ey + 14, 78, ey - 14); ctx.closePath(); pintar(ctx, c.mascara || '#dc2626', 128, ey, 50, { linea: 3 }); }
    ojos(ctx, 128, ey, 26, 1.05, { iris: c.ojos || '#2563eb', humor, parpadeo: o.parpadeo, estilo: 'anime' });
    if (d.ojoReloj && !o.parpadeo && humor !== 'feliz' && humor !== 'dormido') { elipse(ctx, 154, ey + 2, 7, 7); ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2; ctx.stroke(); curva(ctx, [[154, ey + 2], [154, ey - 3]], '#fde047', 1.6); curva(ctx, [[154, ey + 2], [158, ey + 2]], '#fde047', 1.6); }
    if (d.mascara !== 'ninja') { mofletes(ctx, 128, ey + 22, 38, 1); boca(ctx, 128, ey + 28, 0.9, humor, { colmillo: d.colmillos }); }
    if (d.cicatrices) { curva(ctx, [[86, hy - 20], [104, hy - 10]], '#3f6212', 2.5); for (let k = 0; k < 3; k++) curva(ctx, [[90 + k * 6, hy - 22 + k * 3], [92 + k * 6, hy - 10 + k * 3]], '#3f6212', 1.8); }
    // Encima de la cabeza
    if (d.sombrero) sombrero(ctx, d.sombrero, c, hy, fase);
    if (d.cuernos) for (const lado of [-1, 1]) pico(ctx, [[128 + lado * 26, hy - 50], [128 + lado * 44, hy - 96], [128 + lado * 46, hy - 40]], c.cuernos || '#fef3c7');
    if (d.antenas) for (const lado of [-1, 1]) { curva(ctx, [[128 + lado * 16, hy - 56], [128 + lado * 30, hy - 92], [128 + lado * 40, hy - 96]], c.piel, 4); bola(ctx, c.acento || '#a3e635', 128 + lado * 40, hy - 96, 8, 8, { linea: 2.5 }); }
    if (d.casco) { elipse(ctx, 128, hy, 86, 80); ctx.fillStyle = 'rgba(186,230,253,0.22)'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#e2e8f0'; ctx.stroke(); brillo(ctx, 84, hy - 44, 22, 12, 0.6); }
}
function sombrero(ctx, tipo, c, hy, fase) {
    if (tipo === 'chef') { bola(ctx, '#ffffff', 128, hy - 74, 46, 30); bola(ctx, '#ffffff', 98, hy - 64, 24, 22); bola(ctx, '#ffffff', 158, hy - 64, 24, 22); ctx.beginPath(); ctx.roundRect(90, hy - 60, 76, 22, 6); pintar(ctx, '#f8fafc', 128, hy - 50, 40); }
    else if (tipo === 'bruja') { pico(ctx, [[70, hy - 46], [140 + Math.sin(fase) * 4, hy - 150], [186, hy - 46]], c.sombrero || '#6d28d9'); bola(ctx, c.sombrero || '#6d28d9', 128, hy - 46, 82, 14); estrella(ctx, 132, hy - 86, 10, '#fde047', 5); }
    else if (tipo === 'corona' || tipo === 'tiara') {
        const col = '#facc15'; const alto = tipo === 'corona' ? 34 : 22;
        ctx.beginPath(); ctx.moveTo(92, hy - 50); for (let i = 0; i <= 4; i++) { ctx.lineTo(92 + i * 18, hy - 50 - (i % 2 === 0 ? alto : alto * 0.4)); } ctx.lineTo(164, hy - 50); ctx.closePath(); pintar(ctx, col, 128, hy - 64, 30, { linea: 3 });
        elipse(ctx, 128, hy - 62, 6, 6); ctx.fillStyle = tipo === 'tiara' ? '#a855f7' : '#ef4444'; ctx.fill();
    } else if (tipo === 'cinta') { ctx.fillStyle = c.cinta || '#dc2626'; ctx.beginPath(); ctx.ellipse(128, hy - 36, 66, 12, 0, Math.PI, PI2); ctx.lineTo(194, hy - 30); ctx.ellipse(128, hy - 30, 66, 12, 0, 0, Math.PI, true); ctx.fill(); curva(ctx, [[190, hy - 34], [216, hy - 20 + Math.sin(fase) * 6], [226, hy - 4]], c.cinta || '#dc2626', 7); }
    else if (tipo === 'luna') { ctx.fillStyle = c.cinta || '#1e293b'; ctx.fillRect(62, hy - 44, 132, 14); ctx.beginPath(); ctx.arc(128, hy - 37, 11, 0, PI2); ctx.fillStyle = '#fde047'; ctx.fill(); ctx.beginPath(); ctx.arc(133, hy - 40, 9, 0, PI2); ctx.fillStyle = c.cinta || '#1e293b'; ctx.fill(); }
    else if (tipo === 'cascos') { for (const lado of [-1, 1]) bola(ctx, '#f472b6', 128 + lado * 68, hy + 4, 12, 18, { linea: 3 }); curva(ctx, [[60, hy], [128, hy - 92], [196, hy]], '#f472b6', 6); estrella(ctx, 172, hy - 50, 12, '#fde047', 5); }
    else if (tipo === 'turbante') { bola(ctx, c.sombrero || '#7c3aed', 128, hy - 50, 60, 26); elipse(ctx, 128, hy - 52, 9, 9); ctx.fillStyle = '#facc15'; ctx.fill(); curva(ctx, [[128, hy - 74], [124, hy - 100]], '#facc15', 3); }
}
function objetoMano(ctx, tipo, c, cy, fase) {
    const x = 174; const y = cy + 22;
    if (tipo === 'espada') { ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5); ctx.fillStyle = '#e2e8f0'; ctx.fillRect(-3, -70, 7, 66); ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2; ctx.strokeRect(-3, -70, 7, 66); ctx.fillStyle = '#a16207'; ctx.fillRect(-12, -6, 24, 6); ctx.fillRect(-3, 0, 7, 14); ctx.restore(); }
    else if (tipo === 'varita') { curva(ctx, [[x, y + 6], [x + 20, y - 40]], '#7c2d12', 5); estrella(ctx, x + 22, y - 46, 14 + Math.sin(fase * 2) * 2, '#fde047', 5); }
    else if (tipo === 'micro') { curva(ctx, [[x, y + 8], [x + 6, y - 18]], '#334155', 6); bola(ctx, '#cbd5e1', x + 7, y - 26, 10, 10, { linea: 3 }); }
    else if (tipo === 'arco') { ctx.beginPath(); ctx.arc(x - 20, y - 16, 40, -1, 1); ctx.strokeStyle = '#92400e'; ctx.lineWidth = 6; ctx.stroke(); curva(ctx, [[x - 20 + Math.cos(-1) * 40, y - 16 + Math.sin(-1) * 40], [x - 20 + Math.cos(1) * 40, y - 16 + Math.sin(1) * 40]], '#fef3c7', 1.5); }
    else if (tipo === 'sarten') { bola(ctx, '#334155', x + 8, y - 20, 18, 18); curva(ctx, [[x, y], [x - 6, y + 22]], '#78350f', 6); }
    else if (tipo === 'lampara') { bola(ctx, '#facc15', x + 4, y - 6, 18, 9); curva(ctx, [[x + 20, y - 8], [x + 32, y - 18]], '#facc15', 5); ctx.fillStyle = `rgba(196,181,253,${0.5 + Math.sin(fase) * 0.2})`; elipse(ctx, x + 36, y - 28, 8, 12); ctx.fill(); }
    else if (tipo === 'estrella') { estrella(ctx, x + 10, y - 20, 18 + Math.sin(fase * 2) * 3, '#fde047', 5); }
    else if (tipo === 'luna') { ctx.beginPath(); ctx.arc(x + 10, y - 20, 16, 0, PI2); ctx.fillStyle = '#c4b5fd'; ctx.fill(); ctx.beginPath(); ctx.arc(x + 16, y - 24, 13, 0, PI2); ctx.fillStyle = '#1e1b4b'; ctx.fill(); }
    else if (tipo === 'shuriken') { ctx.save(); ctx.translate(x + 10, y - 14); ctx.rotate(fase); estrella(ctx, 0, 0, 16, '#94a3b8', 4); elipse(ctx, 0, 0, 3, 3); ctx.fillStyle = OSCURO; ctx.fill(); ctx.restore(); }
    else if (tipo === 'maza') { curva(ctx, [[x, y + 10], [x + 12, y - 40]], '#78350f', 8); bola(ctx, '#57534e', x + 14, y - 46, 16, 18); for (let i = 0; i < 4; i++) pico(ctx, [[x + 8 + i * 4, y - 60], [x + 10 + i * 4, y - 70], [x + 14 + i * 4, y - 60]], '#e7e5e4', { linea: 1.5 }); }
}

// ---------------------------------------------------------------------------
// Catálogo de diseños
// ---------------------------------------------------------------------------
const D = (forma, c, extra = {}) => ({ forma, c, ...extra });
const DISENOS = {
    // Comunes
    gato: D('chibi', { piel: '#fbbf24', vientre: '#fff7ed', raya: '#c2410c', nariz: '#f472b6', ojos: '#16a34a', patas: '#fff7ed' }, { orejas: 'punta', cola: 'fina', hocico: 'nariz', marcas: 'rayas', sepOjos: 28 }),
    perro: D('chibi', { piel: '#f5d0a9', oreja: '#a16207', morro: '#fff7ed', vientre: '#fff7ed', ojos: '#78350f' }, { orejas: 'caida', cola: 'fina', hocico: 'morro' }),
    conejo: D('chibi', { piel: '#f8fafc', oreja: '#fbcfe8', vientre: '#ffffff', nariz: '#f472b6', ojos: '#db2777', puntaCola: '#ffffff' }, { orejas: 'larga', cola: 'bola', hocico: 'nariz' }),
    hamster: D('chibi', { piel: '#fdba74', vientre: '#fff7ed', oreja: '#fecdd3', nariz: '#f472b6', ojos: '#1f2937' }, { orejas: 'redonda', hocico: 'nariz', mofletes: true, ojoTam: 0.85, sinBrazos: false }),
    rana: D('chibi', { piel: '#4ade80', vientre: '#dcfce7', ojos: '#15803d', mofletes: '#fb7185' }, { hocico: 'rana', ojosArriba: true, anchoCabeza: 1.12 }),
    pollito: D('ave', { piel: '#fde047', vientre: '#fef9c3', pico: '#fb923c', patas: '#fb923c', ojos: '#1f2937' }, { mechon: true }),
    tortuga: D('chibi', { piel: '#86efac', vientre: '#fef3c7', caparazon: '#65a30d', ojos: '#14532d' }, { caparazon: true, hocico: 'boca' }),
    cerdito: D('chibi', { piel: '#fbcfe8', oreja: '#f9a8d4', morro: '#f9a8d4', vientre: '#fdf2f8', ojos: '#1f2937' }, { orejas: 'punta', cola: 'rizada', hocico: 'cerdo' }),
    oso: D('chibi', { piel: '#a16207', oreja: '#fcd34d', morro: '#fde68a', vientre: '#fde68a', ojos: '#1f2937' }, { orejas: 'redonda', hocico: 'morro' }),
    mono: D('chibi', { piel: '#92400e', cara: '#fcd9b6', oreja: '#fcd9b6', vientre: '#fcd9b6', ojos: '#1f2937', puntaCola: '#92400e' }, { orejas: 'grande', marcas: 'cara', cola: 'fina', hocico: 'boca' }),
    raton: D('chibi', { piel: '#cbd5e1', oreja: '#fbcfe8', vientre: '#f1f5f9', nariz: '#f472b6', ojos: '#1f2937' }, { orejas: 'grande', cola: 'fina', hocico: 'nariz' }),
    erizo: D('chibi', { piel: '#fcd9b6', puas: '#78350f', vientre: '#fff7ed', nariz: '#1f2937', ojos: '#1f2937' }, { puas: true, orejas: 'redonda', hocico: 'nariz' }),
    pato: D('ave', { piel: '#fef9c3', vientre: '#ffffff', pico: '#fb923c', patas: '#fb923c', ala: '#fde68a', ojos: '#1f2937' }, { hocico: 'pato', mechon: true }),
    pixel: D('robot', { piel: '#e2e8f0' }),
    boo: D('fantasma', { piel: '#f8fafc' }),
    // Raras
    zorro: D('chibi', { piel: '#f97316', vientre: '#fff7ed', puntaOreja: '#1f2937', puntaCola: '#ffffff', nariz: '#1f2937', ojos: '#a16207', patas: '#7c2d12' }, { orejas: 'punta', cola: 'esponjosa', marcas: 'mascara', hocico: 'nariz' }),
    panda: D('chibi', { piel: '#ffffff', raya: '#111827', orejaFuera: '#111827', oreja: '#111827', patas: '#111827', morro: '#ffffff', nariz: '#111827', ojos: '#1f2937' }, { orejas: 'redonda', marcas: 'panda', hocico: 'morro' }),
    koala: D('chibi', { piel: '#94a3b8', oreja: '#f1f5f9', vientre: '#e2e8f0', nariz: '#334155', morro: '#94a3b8', ojos: '#1f2937' }, { orejas: 'grande', hocico: 'morro' }),
    buho: D('ave', { piel: '#a16207', vientre: '#fde68a', cara: '#fef3c7', ala: '#78350f', pico: '#f59e0b', patas: '#f59e0b', ojos: '#ea580c' }, { orejas: 'pluma', discoOjos: true, ojoTam: 1.1, hocico: 'pico' }),
    pinguino: D('ave', { piel: '#1e293b', vientre: '#f8fafc', ala: '#0f172a', pico: '#f59e0b', patas: '#f59e0b', ojos: '#0ea5e9' }, {}),
    mapache: D('chibi', { piel: '#9ca3af', raya: '#1f2937', vientre: '#e5e7eb', morro: '#f3f4f6', nariz: '#111827', ojos: '#1f2937', puntaOreja: '#1f2937' }, { orejas: 'punta', marcas: 'antifaz', cola: 'rayada', hocico: 'morro' }),
    nutria: D('chibi', { piel: '#92400e', morro: '#fde68a', vientre: '#fcd34d', oreja: '#78350f', nariz: '#1f2937', ojos: '#1f2937' }, { orejas: 'redonda', hocico: 'morro', cola: 'fina' }),
    perezoso: D('chibi', { piel: '#a8a29e', raya: '#57534e', vientre: '#d6d3d1', cara: '#e7e5e4', morro: '#e7e5e4', nariz: '#44403c', ojos: '#1c1917' }, { marcas: 'antifaz', hocico: 'morro', cola: 'perezoso' }),
    flamenco: D('ave', { piel: '#f9a8d4', vientre: '#fbcfe8', ala: '#f472b6', pico: '#1f2937', patas: '#ec4899', ojos: '#1f2937' }, { patasLargas: true, hocico: 'ganchudo' }),
    mariposa: D('insecto', { piel: '#4c1d95', ala: '#38bdf8', ala2: '#c084fc', acento: '#fde047', ojos: '#7c3aed' }),
    zim: D('humano', { piel: '#86efac', pelo: '#a3e635', ropa: '#1e293b', ropa2: '#a3e635', ojos: '#7c3aed', acento: '#f472b6' }, { pelo: 'corto', antenas: true, objeto: 'estrella' }),
    kuro: D('humano', { piel: '#a3b18a', pelo: '#3f3f46', ropa: '#57534e', ojos: '#ef4444' }, { pelo: 'puntas', cicatrices: true }),
    tomo: D('humano', { piel: '#fde2c8', pelo: '#78350f', ropa: '#ffffff', ropa2: '#ef4444', ojos: '#78350f' }, { pelo: 'corto', sombrero: 'chef', objeto: 'sarten' }),
    // Épicas
    leon: D('chibi', { piel: '#fbbf24', melena: '#c2410c', vientre: '#fef3c7', morro: '#fef3c7', nariz: '#7c2d12', ojos: '#a16207' }, { melena: true, orejas: 'redonda', cola: 'leon', hocico: 'morro' }),
    tigre: D('chibi', { piel: '#fb923c', raya: '#1f2937', vientre: '#ffffff', morro: '#ffffff', nariz: '#be185d', ojos: '#16a34a' }, { orejas: 'redonda', marcas: 'rayas', marcasCuerpo: 'rayas', cola: 'rayada', hocico: 'morro' }),
    unicornio: D('chibi', { piel: '#fdf4ff', melena: '#f0abfc', vientre: '#ffffff', oreja: '#fbcfe8', morro: '#fce7f3', nariz: '#f9a8d4', ojos: '#8b5cf6', puntaCola: '#c4b5fd' }, { cuerno: true, orejas: 'punta', cola: 'esponjosa', hocico: 'morro', mechon: true, mechonColor: true }),
    lobo: D('chibi', { piel: '#64748b', vientre: '#e2e8f0', puntaCola: '#e2e8f0', nariz: '#0f172a', ojos: '#0ea5e9', oreja: '#cbd5e1' }, { orejas: 'lobo', cola: 'esponjosa', marcas: 'mascara', hocico: 'nariz', colmillo: true }),
    pavo: D('ave', { piel: '#1d4ed8', vientre: '#60a5fa', ala: '#1e40af', pico: '#f8fafc', patas: '#94a3b8', ojos: '#1f2937' }, { cola: 'pavo', corona: true }),
    leopardo: D('chibi', { piel: '#fcd34d', raya: '#78350f', mancha: '#d97706', vientre: '#fffbeb', morro: '#fffbeb', nariz: '#be185d', ojos: '#65a30d' }, { orejas: 'redonda', marcas: 'manchas', marcasCuerpo: 'manchas', cola: 'fina', hocico: 'morro' }),
    loro: D('ave', { piel: '#22c55e', vientre: '#facc15', ala: '#2563eb', pico: '#fef3c7', patas: '#64748b', ojos: '#1f2937', mechon: '#ef4444' }, { hocico: 'ganchudo', mechon: true, cola: 'esponjosa' }),
    kaede: D('humano', { piel: '#fde2c8', pelo: '#312e81', ropa: '#1e1b4b', ropa2: '#c4b5fd', mascara: '#1e293b', cinta: '#1e293b', ojos: '#a78bfa' }, { pelo: 'coleta', mascara: 'ninja', sombrero: 'luna', objeto: 'shuriken', cinturon: true }),
    lumi: D('humano', { piel: '#fde2c8', pelo: '#f0abfc', ropa: '#a7f3d0', ala: '#a5f3fc', ala2: '#f5d0fe', ojos: '#10b981' }, { pelo: 'moño', alas: 'hada', orejasPunta: true, objeto: 'varita' }),
    ren: D('humano', { piel: '#fde2c8', pelo: '#1f2937', ropa: '#1e3a8a', ropa2: '#e2e8f0', cinta: '#dc2626', ojos: '#b91c1c' }, { pelo: 'coleta', sombrero: 'cinta', objeto: 'espada', cinturon: true }),
    mika: D('humano', { piel: '#fde2c8', pelo: '#fb923c', ropa: '#6d28d9', ropa2: '#fde047', sombrero: '#5b21b6', ojos: '#16a34a' }, { pelo: 'largo', sombrero: 'bruja', objeto: 'varita' }),
    nova: D('humano', { piel: '#fde2c8', pelo: '#38bdf8', ropa: '#f1f5f9', ropa2: '#f97316', ojos: '#0369a1' }, { pelo: 'corto', casco: true, cinturon: true, objeto: 'estrella' }),
    yuki: D('humano', { piel: '#fde2c8', pelo: '#f9a8d4', ropa: '#ec4899', ropa2: '#ffffff', ojos: '#be185d' }, { pelo: 'coletas', sombrero: 'cascos', objeto: 'micro' }),
    // Legendarias
    dragon: D('chibi', { piel: '#22c55e', vientre: '#fef08a', acento: '#15803d', ala: '#16a34a', cuernos: '#fef3c7', ojos: '#ca8a04' }, { alas: 'murcielago', cuernos: true, cresta: true, cola: 'dragon', hocico: 'boca', colmillo: true }),
    aguila: D('chibi', { piel: '#78350f', cabeza: '#f8fafc', vientre: '#92400e', ala: '#5b3a1e', pico: '#facc15', patas: '#facc15', ojos: '#ca8a04' }, { alas: 'pluma', hocico: 'ganchudo', sinBrazos: true, cola: 'pez', sinMofletes: false }),
    tiburon: D('acuatico', { piel: '#64748b', vientre: '#f8fafc', aleta: '#475569', ojos: '#0f172a' }, { aletaDorsal: true, branquias: true, hocico: 'dientes' }),
    vlad: D('humano', { piel: '#f1f5f9', pelo: '#111827', ropa: '#1f2937', ropa2: '#dc2626', capa: '#7f1d1d', ojos: '#dc2626' }, { pelo: 'vampiro', capa: true, colmillos: true }),
    marina: D('humano', { piel: '#fde2c8', pelo: '#14b8a6', ropa: '#0ea5e9', ojos: '#0e7490' }, { pelo: 'sirena', sirena: true, objeto: 'micro' }),
    sylva: D('humano', { piel: '#fde2c8', pelo: '#fef08a', ropa: '#15803d', ropa2: '#a16207', ojos: '#15803d' }, { pelo: 'largo', orejasElfo: true, objeto: 'arco', cinturon: true }),
    hikari: D('humano', { piel: '#fde2c8', pelo: '#facc15', ropa: '#2563eb', ropa2: '#facc15', capa: '#dc2626', mascara: '#dc2626', ojos: '#1d4ed8' }, { pelo: 'heroe', capa: true, antifazHeroe: true, cinturon: true }),
    oni: D('humano', { piel: '#f87171', pelo: '#111827', ropa: '#1f2937', ropa2: '#facc15', cuernos: '#fef3c7', ojos: '#facc15' }, { pelo: 'puntas', cuernos: true, colmillos: true, objeto: 'maza' }),
    // Míticas
    fenix: D('ave', { piel: '#ef4444', vientre: '#fdba74', pico: '#facc15', patas: '#f59e0b', ojos: '#facc15' }, { alas: 'fuego', cresta: true, cola: 'llama' }),
    trex: D('chibi', { piel: '#65a30d', vientre: '#ecfccb', acento: '#3f6212', ojos: '#ca8a04' }, { sinBrazos: true, brazitos: true, cresta: true, cola: 'rex', hocico: 'dientes', anchoCabeza: 1.1 }),
    ballena: D('acuatico', { piel: '#2563eb', vientre: '#bfdbfe', aleta: '#1d4ed8', ojos: '#0f172a' }, { chorro: true, rayasVientre: true }),
    kraken: D('pulpo', { piel: '#9333ea', ojos: '#facc15' }),
    djinn: D('humano', { piel: '#60a5fa', pelo: '#1e1b4b', ropa: '#7c3aed', sombrero: '#7c3aed', ojos: '#fde047' }, { pelo: 'moño', humo: true, sombrero: 'turbante', objeto: 'lampara', orejasPunta: true }),
    nyx: D('humano', { piel: '#e9d5ff', pelo: '#3b0764', ropa: '#1e1b4b', ropa2: '#a855f7', capa: '#4c1d95', ojos: '#c026d3' }, { pelo: 'largo', capa: true, sombrero: 'tiara', objeto: 'luna' }),
    aurora: D('humano', { piel: '#fde2c8', pelo: '#fde68a', ropa: '#f9a8d4', ropa2: '#ffffff', ojos: '#2563eb' }, { pelo: 'princesa', sombrero: 'corona', objeto: 'estrella' }),
    // Divina
    celestial: D('chibi', { piel: '#fde68a', vientre: '#fffbeb', melena: '#c4b5fd', acento: '#f59e0b', ala: '#e0e7ff', cuernos: '#fbbf24', ojos: '#7c3aed' }, { cuernos: true, bigotesDragon: true, cola: 'dragon', melena: true, alas: 'pluma', hocico: 'boca', aura: 'arcoiris' }),
};
// Especies de la mascota del servidor (utils/mascotaNucleo.ESPECIES) y las criaturas de los combates.
const ESPECIES_SERVIDOR = {
    dragon: 'dragon',
    zorro: 'zorro',
    fenix: 'fenix',
    golem: D('golem', { piel: '#a8a29e', ojos: '#22d3ee' }),
    kraken: D('pulpo', { piel: '#a855f7', ojos: '#fde047' }),
};
const JEFES = {
    sombra: D('fantasma', { piel: '#4c1d95' }),
    golem_lava: D('golem', { piel: '#57534e', ojos: '#f97316' }),
    kraken_abismo: D('pulpo', { piel: '#1e3a8a', ojos: '#f43f5e' }),
    dragon_negro: D('chibi', { piel: '#334155', vientre: '#64748b', acento: '#dc2626', ala: '#1e293b', cuernos: '#f87171', ojos: '#ef4444' }, { alas: 'murcielago', cuernos: true, cresta: true, cola: 'dragon', hocico: 'dientes' }),
    rey_slime: D('fantasma', { piel: '#4ade80' }),
};

function diseno(id) {
    if (DISENOS[id]) return DISENOS[id];
    if (typeof id === 'string' && id.startsWith('srv:')) { const e = ESPECIES_SERVIDOR[id.slice(4)]; return typeof e === 'string' ? DISENOS[e] : e || null; }
    if (typeof id === 'string' && id.startsWith('jefe:')) return JEFES[id.slice(5)] || null;
    return null;
}
const tiene = (id) => !!diseno(id);

// Variante brillante: otros colores (giro de tono) y destellos alrededor.
function conVariante(d, variante) {
    if (variante !== 'brillante') return d;
    const giro = 150;
    const c = {};
    for (const [k, v] of Object.entries(d.c)) c[k] = typeof v === 'string' && v.startsWith('#') ? girarTono(v, giro) : v;
    return { ...d, c };
}

const ETAPAS = [{ id: 'bebe', es: 'Bebé', en: 'Baby', desde: 1 }, { id: 'joven', es: 'Joven', en: 'Young', desde: 10 }, { id: 'adulto', es: 'Adulto', en: 'Adult', desde: 20 }];
// Nivel de afinidad (1..30) → etapa 0/1/2.
function etapaDe(nivel = 1) { return nivel >= ETAPAS[2].desde ? 2 : nivel >= ETAPAS[1].desde ? 1 : 0; }
// Qué humor de dibujo corresponde al humor de compisNucleo.
const HUMOR_DIBUJO = { feliz: 'feliz', normal: 'normal', hambre: 'hambre', cansado: 'cansado', aburrido: 'aburrido', fuera: 'normal', enfermo: 'enfermo', dormido: 'dormido', enfadado: 'enfadado' };

// Dibuja en `ctx` (de TAM×TAM). Devuelve false si no hay diseño.
function dibujar(ctx, id, { etapa = 2, humor = 'normal', t = 0, parpadeo = false, variante = null, aura = true, sombra = true } = {}) {
    let d = diseno(id);
    if (!d) return false;
    d = conVariante(d, variante);
    const h = HUMOR_DIBUJO[humor] || 'normal';
    ctx.save();
    // Aura de la divina
    if (aura && d.aura === 'arcoiris') {
        const cols = ['#f87171', '#fbbf24', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6'];
        for (let i = 0; i < cols.length; i++) {
            ctx.beginPath(); ctx.arc(128, 130, 112 - i * 6, Math.PI * (1.05 + t * 0.2), Math.PI * (1.95 + t * 0.2));
            ctx.strokeStyle = alfa(cols[i], 0.45); ctx.lineWidth = 6; ctx.stroke();
        }
    }
    // Sombra en el suelo (no en los que flotan)
    if (sombra && !['fantasma', 'acuatico', 'insecto'].includes(d.forma)) {
        const g = ctx.createRadialGradient(128, 236, 4, 128, 236, 70);
        g.addColorStop(0, 'rgba(2,6,23,0.35)'); g.addColorStop(1, 'rgba(2,6,23,0)');
        ctx.fillStyle = g; elipse(ctx, 128, 236, 72, 13); ctx.fill();
    }
    // Las etapas: el bebé es más pequeño (y se dibuja más abajo, sobre el suelo).
    const k = etapa === 0 ? 0.8 : etapa === 1 ? 0.9 : 1;
    ctx.translate(128, 240); ctx.scale(k, k); ctx.translate(-128, -240);
    const o = { s: 1, t, humor: h, parpadeo, etapa };
    const f = { chibi, ave, acuatico, pulpo, insecto, golem, robot, fantasma, humano }[d.forma];
    f(ctx, d, o);
    // Detalles de humor (zzz, gotita, nota de enfermo)
    if (h === 'dormido' || h === 'cansado') {
        ctx.fillStyle = '#e0e7ff'; ctx.strokeStyle = '#312e81'; ctx.lineWidth = 3; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'left';
        const y = 40 - (t * 10) % 10;
        ctx.strokeText('z', 196, y + 20); ctx.fillText('z', 196, y + 20); ctx.font = 'bold 18px sans-serif'; ctx.strokeText('z', 216, y); ctx.fillText('z', 216, y);
    }
    if (h === 'aburrido') { ctx.save(); ctx.translate(196, 50); elipse(ctx, 0, 0, 6, 9); ctx.fillStyle = '#93c5fd'; ctx.fill(); ctx.restore(); }
    if (h === 'enfermo') { ctx.fillStyle = 'rgba(132,204,22,0.18)'; elipse(ctx, 128, 110, 70, 60); ctx.fill(); bola(ctx, '#f8fafc', 200, 50, 14, 6, { linea: 2, rot: -0.6 }); }
    if (h === 'feliz') { corazon(ctx, 206, 52 - Math.sin(t * PI2) * 6, 12, '#f43f5e'); }
    if (h === 'enfadado') { curva(ctx, [[196, 40], [208, 52]], '#ef4444', 4); curva(ctx, [[208, 40], [196, 52]], '#ef4444', 4); }
    ctx.restore();
    if (variante === 'brillante') {
        for (let i = 0; i < 6; i++) {
            const a = i * 1.05 + t * PI2 * 0.5; const r = 96 + (i % 2) * 14;
            estrella(ctx, 128 + Math.cos(a) * r, 128 + Math.sin(a) * r * 0.85, 7 + ((t * 6 + i) % 3), alfa('#fef9c3', 0.95), 4);
        }
    }
    return true;
}

// Imagen ya dibujada (en caché). Devuelve un lienzo de TAM×TAM que se puede pasar a drawImage.
const cache = new Map();
const MAX_CACHE = 220;
function imagen(id, op = {}) {
    if (!canvasLib || !tiene(id)) return null;
    const clave = `${id}|${op.etapa ?? 2}|${op.humor || 'normal'}|${Math.round((op.t || 0) * 16)}|${op.parpadeo ? 1 : 0}|${op.variante || ''}|${op.aura === false ? 0 : 1}`;
    if (cache.has(clave)) { const v = cache.get(clave); cache.delete(clave); cache.set(clave, v); return v; }
    const c = canvasLib.createCanvas(TAM, TAM);
    const ctx = c.getContext('2d');
    try { dibujar(ctx, id, op); } catch (e) { console.warn('sprites:', id, e.message); return null; }
    c._sprite = true; // casinoArte.pintarCompanero lo dibuja algo más grande (el dibujo deja margen)
    cache.set(clave, c);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    return c;
}
// Fotogramas de una animación corta en bucle (respira, parpadea en uno). n fotogramas.
function fotogramas(id, op = {}, n = 8) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(imagen(id, { ...op, t: i / n, parpadeo: i === Math.floor(n * 0.75) }));
    return out;
}
// Imagen suelta (para el panel / la web). formato: 'png' o 'webp' (pesa ~3 veces menos).
function png(id, op = {}, tam = TAM, formato = 'png') {
    if (!canvasLib || !tiene(id)) return null;
    const c = canvasLib.createCanvas(tam, tam);
    const ctx = c.getContext('2d');
    ctx.scale(tam / TAM, tam / TAM);
    dibujar(ctx, id, op);
    return formato === 'webp' ? c.toBuffer('image/webp', 90) : c.toBuffer('image/png');
}
// Huevo (para la mascota del servidor y la cría): con manchas y grietas según `grietas` (0..1).
function huevo(ctx, { color = '#fef3c7', manchas = '#a78bfa', grietas = 0, t = 0 } = {}) {
    const mov = Math.sin(t * PI2 * 2) * (grietas > 0.3 ? 0.08 : 0.03);
    const g = ctx.createRadialGradient(128, 236, 4, 128, 236, 60); g.addColorStop(0, 'rgba(2,6,23,0.35)'); g.addColorStop(1, 'rgba(2,6,23,0)');
    ctx.fillStyle = g; elipse(ctx, 128, 236, 60, 11); ctx.fill();
    ctx.save(); ctx.translate(128, 232); ctx.rotate(mov); ctx.translate(-128, -232);
    ctx.beginPath(); ctx.moveTo(128, 34); ctx.bezierCurveTo(206, 34, 214, 232, 128, 232); ctx.bezierCurveTo(42, 232, 50, 34, 128, 34); ctx.closePath();
    pintar(ctx, color, 128, 130, 100);
    ctx.save(); ctx.clip();
    for (const [x, y, r] of [[92, 100, 16], [160, 80, 12], [150, 160, 20], [96, 186, 13], [128, 130, 9]]) { elipse(ctx, x, y, r, r * 0.85); ctx.fillStyle = manchas; ctx.fill(); }
    ctx.restore();
    brillo(ctx, 98, 84, 18, 30, 0.5);
    if (grietas > 0) {
        const pts = [[86, 120], [100, 108], [112, 126], [126, 110], [140, 128], [154, 112], [170, 124]];
        const n = Math.max(2, Math.round(pts.length * Math.min(1, grietas)));
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.strokeStyle = '#3b0764'; ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.stroke();
    }
    ctx.restore();
}

// Dónde van los accesorios (gorro, gafas, bufanda) en el dibujo, en 0..1 del cuadro, según su forma y etapa.
const ANCLAS = {
    chibi: { cabeza: [128, 44], cara: [128, 112], cuello: [128, 158] },
    ave: { cabeza: [128, 78], cara: [128, 140], cuello: [128, 186] },
    pulpo: { cabeza: [128, 40], cara: [128, 130], cuello: [128, 172] },
    golem: { cabeza: [128, 48], cara: [128, 108], cuello: [128, 146] },
    acuatico: { cabeza: [128, 92], cara: [128, 144], cuello: [128, 190] },
    humano: { cabeza: [128, 36], cara: [128, 114], cuello: [128, 160] },
    robot: { cabeza: [128, 40], cara: [128, 96], cuello: [128, 156] },
    fantasma: { cabeza: [128, 48], cara: [128, 124], cuello: [128, 170] },
    insecto: { cabeza: [128, 90], cara: [128, 134], cuello: [128, 170] },
};
function anclas(id, etapa = 2) {
    const d = diseno(id);
    const a = ANCLAS[d?.forma] || ANCLAS.chibi;
    const k = etapa === 0 ? 0.8 : etapa === 1 ? 0.9 : 1;
    const out = {};
    for (const [slot, [x, y]] of Object.entries(a)) out[slot] = { x: (128 + (x - 128) * k) / TAM, y: (240 + (y - 240) * k) / TAM, k };
    return out;
}

module.exports = { anclas, TAM, DISENOS, ESPECIES_SERVIDOR, JEFES, ETAPAS, tiene, diseno, dibujar, imagen, fotogramas, png, huevo, etapaDe, girarTono, aclarar, oscurecer, mezclar, alfa };
