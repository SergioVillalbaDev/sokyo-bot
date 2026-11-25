// 🏠 Dibujo de la casa del compañero (1.33.0): la habitación con su papel, los muebles colocados (dibujados aquí con
// formas, nada de emojis) y el compañero equipado en medio. Reglas en utils/casaNucleo.js.
const H = require('./casaNucleo.js');

// Posiciones de cada hueco en un lienzo de 760 × 440 (los del suelo, apoyados por abajo).
const POS = {
    techo0: [380, 0], pared0: [140, 120], pared1: [380, 96], pared2: [620, 120],
    alfombra0: [380, 372], suelo0: [118, 400], suelo1: [262, 318], suelo2: [498, 318], suelo3: [642, 400],
};
const W = 760; const ALTO = 440; const HORIZONTE = 262;

function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const sombra = (ctx, x, y, w) => { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.16, 0, 0, Math.PI * 2); ctx.fill(); };
const grad = (ctx, x0, y0, x1, y1, a, b) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };

// Cada mueble se dibuja con (x, y) = su punto de apoyo (suelo: abajo en el centro; pared y alfombra: centro; techo: arriba).
const DIBUJOS = {
    planta(ctx, x, y) {
        sombra(ctx, x, y, 34);
        ctx.fillStyle = grad(ctx, x - 26, y - 50, x + 26, y, '#ea580c', '#9a3412');
        ctx.beginPath(); ctx.moveTo(x - 28, y - 52); ctx.lineTo(x + 28, y - 52); ctx.lineTo(x + 20, y); ctx.lineTo(x - 20, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c2410c'; ctx.fillRect(x - 31, y - 58, 62, 10);
        for (const [dx, dy, r, a] of [[-26, -92, 30, -0.6], [24, -96, 30, 0.6], [0, -124, 34, 0], [-12, -76, 24, -0.3], [14, -78, 24, 0.3]]) {
            ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(a);
            ctx.fillStyle = grad(ctx, 0, -r, 0, r, '#4ade80', '#15803d'); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.42, r, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(20,83,45,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(0, r * 0.8); ctx.stroke(); ctx.restore();
        }
    },
    mesa(ctx, x, y) {
        sombra(ctx, x, y, 60);
        ctx.fillStyle = '#78350f'; for (const dx of [-44, 40]) ctx.fillRect(x + dx, y - 54, 8, 54);
        ctx.fillStyle = grad(ctx, x, y - 70, x, y - 52, '#d97706', '#92400e'); ctx.beginPath(); ctx.ellipse(x, y - 60, 64, 16, 0, 0, Math.PI * 2); ctx.fill();
        // Taza humeante
        ctx.fillStyle = '#f8fafc'; rr(ctx, x - 12, y - 90, 24, 26, 5); ctx.fill(); ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x + 14, y - 78, 7, -1.2, 1.2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; for (const dx of [-4, 4]) { ctx.beginPath(); ctx.moveTo(x + dx, y - 94); ctx.bezierCurveTo(x + dx - 6, y - 104, x + dx + 6, y - 110, x + dx, y - 120); ctx.stroke(); }
    },
    cama(ctx, x, y) {
        sombra(ctx, x, y, 74);
        ctx.fillStyle = grad(ctx, x, y - 60, x, y, '#f472b6', '#be185d'); ctx.beginPath(); ctx.ellipse(x, y - 24, 76, 30, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = grad(ctx, x, y - 50, x, y - 10, '#fdf2f8', '#fbcfe8'); ctx.beginPath(); ctx.ellipse(x, y - 30, 56, 18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f9a8d4'; ctx.beginPath(); ctx.ellipse(x - 30, y - 38, 20, 10, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - 24, 70, 25, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    },
    juguetes(ctx, x, y) {
        sombra(ctx, x, y, 58);
        // Pelota y osito asomando
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x - 22, y - 74, 18, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x - 22, y - 74, 18, 0.3, 2.8); ctx.stroke();
        ctx.fillStyle = '#a16207'; ctx.beginPath(); ctx.arc(x + 20, y - 76, 19, 0, Math.PI * 2); ctx.fill(); for (const dx of [-13, 13]) { ctx.beginPath(); ctx.arc(x + 20 + dx, y - 92, 8, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#1f2937'; for (const dx of [-6, 6]) { ctx.beginPath(); ctx.arc(x + 20 + dx, y - 79, 2.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = grad(ctx, x - 50, y - 60, x + 50, y, '#3b82f6', '#1d4ed8'); rr(ctx, x - 50, y - 60, 100, 60, 8); ctx.fill();
        ctx.fillStyle = '#fde047'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', x, y - 22);
    },
    estanteria(ctx, x, y) {
        sombra(ctx, x, y, 54);
        ctx.fillStyle = grad(ctx, x - 50, 0, x + 50, 0, '#92400e', '#78350f'); rr(ctx, x - 50, y - 170, 100, 170, 6); ctx.fill();
        ctx.fillStyle = '#451a03'; for (let i = 0; i < 3; i++) ctx.fillRect(x - 42, y - 160 + i * 52, 84, 44);
        const colores = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#14b8a6'];
        for (let i = 0; i < 3; i++) { let bx = x - 40; let k = i * 3; while (bx < x + 36) { const w = 8 + ((k * 7) % 6); ctx.fillStyle = colores[k % colores.length]; ctx.fillRect(bx, y - 160 + i * 52 + 44 - (30 + (k % 3) * 5), w, 30 + (k % 3) * 5); bx += w + 2; k++; } }
    },
    sofa(ctx, x, y) {
        sombra(ctx, x, y, 92);
        ctx.fillStyle = grad(ctx, x, y - 110, x, y - 40, '#818cf8', '#4338ca'); rr(ctx, x - 86, y - 110, 172, 70, 22); ctx.fill();
        ctx.fillStyle = grad(ctx, x, y - 56, x, y - 10, '#6366f1', '#3730a3'); rr(ctx, x - 92, y - 58, 184, 48, 14); ctx.fill();
        ctx.fillStyle = '#4f46e5'; for (const dx of [-98, 72]) { rr(ctx, x + dx, y - 80, 26, 72, 12); ctx.fill(); }
        ctx.fillStyle = '#a5b4fc'; for (const dx of [-40, 40]) { rr(ctx, x + dx - 34, y - 64, 68, 20, 8); ctx.fill(); }
        ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.ellipse(x + 40, y - 84, 18, 14, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1e1b4b'; for (const dx of [-80, 76]) ctx.fillRect(x + dx, y - 10, 6, 10);
    },
    acuario(ctx, x, y) {
        sombra(ctx, x, y, 72);
        ctx.fillStyle = '#334155'; rr(ctx, x - 66, y - 46, 132, 46, 6); ctx.fill();
        ctx.fillStyle = grad(ctx, x, y - 140, x, y - 46, '#38bdf8', '#0369a1'); rr(ctx, x - 66, y - 140, 132, 96, 8); ctx.fill();
        ctx.fillStyle = '#fde68a'; ctx.fillRect(x - 62, y - 56, 124, 10);
        ctx.fillStyle = '#22c55e'; for (const dx of [-46, -38, 44]) { ctx.beginPath(); ctx.ellipse(x + dx, y - 74, 5, 22, 0.2, 0, Math.PI * 2); ctx.fill(); }
        for (const [dx, dy, c, d] of [[-14, -104, '#f97316', 1], [22, -84, '#facc15', -1], [-30, -78, '#f472b6', 1]]) {
            ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x + dx, y + dy, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(x + dx - d * 12, y + dy); ctx.lineTo(x + dx - d * 22, y + dy - 7); ctx.lineTo(x + dx - d * 22, y + dy + 7); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(x + dx + d * 6, y + dy - 2, 1.8, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (const [dx, dy, r] of [[30, -120, 4], [34, -108, 3], [28, -98, 2]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; rr(ctx, x - 66, y - 140, 132, 96, 8); ctx.stroke();
    },
    consola(ctx, x, y) {
        sombra(ctx, x, y, 76);
        ctx.fillStyle = grad(ctx, x, y - 44, x, y, '#57534e', '#292524'); rr(ctx, x - 74, y - 44, 148, 44, 6); ctx.fill();
        ctx.fillStyle = '#e5e7eb'; rr(ctx, x - 22, y - 34, 44, 14, 3); ctx.fill();
        ctx.fillStyle = '#111827'; rr(ctx, x - 70, y - 150, 140, 100, 8); ctx.fill();
        ctx.fillStyle = grad(ctx, x - 62, y - 142, x + 62, y - 58, '#22d3ee', '#7c3aed'); rr(ctx, x - 62, y - 142, 124, 84, 4); ctx.fill();
        ctx.fillStyle = '#fef08a'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▶ PLAY', x, y - 94);
        ctx.fillStyle = '#f8fafc'; rr(ctx, x + 30, y - 14, 34, 16, 7); ctx.fill();
    },
    chimenea(ctx, x, y) {
        sombra(ctx, x, y, 86);
        ctx.fillStyle = grad(ctx, x, y - 160, x, y, '#a8a29e', '#57534e'); rr(ctx, x - 84, y - 150, 168, 150, 6); ctx.fill();
        ctx.fillStyle = '#78716c'; for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { rr(ctx, x - 80 + c * 41 + (r % 2) * 18, y - 146 + r * 24, 36, 20, 3); ctx.fill(); }
        ctx.fillStyle = '#44403c'; rr(ctx, x - 92, y - 162, 184, 16, 4); ctx.fill();
        ctx.fillStyle = '#0c0a09'; ctx.beginPath(); ctx.moveTo(x - 50, y); ctx.lineTo(x - 50, y - 70); ctx.quadraticCurveTo(x, y - 112, x + 50, y - 70); ctx.lineTo(x + 50, y); ctx.closePath(); ctx.fill();
        for (const [c, s] of [['#ef4444', 1], ['#f97316', 0.75], ['#fde047', 0.45]]) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 34 * s, y - 6); ctx.quadraticCurveTo(x - 30 * s, y - 50 * s, x - 6 * s, y - 70 * s); ctx.quadraticCurveTo(x, y - 40 * s, x + 10 * s, y - 80 * s); ctx.quadraticCurveTo(x + 36 * s, y - 40 * s, x + 34 * s, y - 6); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = 'rgba(253,186,116,0.18)'; ctx.beginPath(); ctx.ellipse(x, y - 20, 120, 50, 0, 0, Math.PI * 2); ctx.fill();
    },
    trono(ctx, x, y) {
        sombra(ctx, x, y, 72);
        ctx.fillStyle = grad(ctx, x, y - 190, x, y - 60, '#c084fc', '#7e22ce'); ctx.beginPath(); ctx.moveTo(x - 62, y - 60); ctx.lineTo(x - 62, y - 150); ctx.quadraticCurveTo(x, y - 210, x + 62, y - 150); ctx.lineTo(x + 62, y - 60); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 6; ctx.stroke();
        ctx.fillStyle = '#facc15'; ctx.beginPath(); for (const [dx, dy] of [[-22, -186], [0, -202], [22, -186]]) { ctx.moveTo(x + dx - 9, y + dy + 14); ctx.lineTo(x + dx, y + dy - 4); ctx.lineTo(x + dx + 9, y + dy + 14); } ctx.fill();
        ctx.fillStyle = grad(ctx, x, y - 76, x, y - 20, '#a855f7', '#6b21a8'); rr(ctx, x - 74, y - 76, 148, 56, 16); ctx.fill();
        ctx.fillStyle = '#e9d5ff'; rr(ctx, x - 56, y - 86, 112, 22, 10); ctx.fill();
        ctx.fillStyle = '#facc15'; for (const dx of [-66, 58]) ctx.fillRect(x + dx, y - 22, 8, 22);
    },
    cuadro(ctx, x, y) {
        ctx.fillStyle = '#92400e'; rr(ctx, x - 62, y - 46, 124, 92, 6); ctx.fill(); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = grad(ctx, x, y - 36, x, y + 36, '#7dd3fc', '#e0f2fe'); ctx.fillRect(x - 52, y - 36, 104, 72);
        ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(x + 28, y - 16, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.moveTo(x - 52, y + 36); ctx.lineTo(x - 22, y - 4); ctx.lineTo(x + 4, y + 20); ctx.lineTo(x + 26, y + 2); ctx.lineTo(x + 52, y + 36); ctx.closePath(); ctx.fill();
    },
    reloj(ctx, x, y) {
        ctx.fillStyle = '#78350f'; ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fffbeb'; ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1f2937'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 26, y + Math.sin(a) * 26, i % 3 ? 1.5 : 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = '#1f2937'; ctx.lineCap = 'round'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12, y - 10); ctx.stroke();
        ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y - 24); ctx.stroke(); ctx.lineCap = 'butt';
    },
    guirnalda(ctx, x, y) {
        ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 110, y - 30); ctx.quadraticCurveTo(x, y + 40, x + 110, y - 30); ctx.stroke();
        const colores = ['#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc', '#f472b6'];
        for (let i = 0; i <= 10; i++) {
            const tt = i / 10; const bx = (1 - tt) * (1 - tt) * (x - 110) + 2 * (1 - tt) * tt * x + tt * tt * (x + 110); const by = (1 - tt) * (1 - tt) * (y - 30) + 2 * (1 - tt) * tt * (y + 40) + tt * tt * (y - 30);
            const g = ctx.createRadialGradient(bx, by + 8, 1, bx, by + 8, 16); g.addColorStop(0, `${colores[i % 6]}cc`); g.addColorStop(1, `${colores[i % 6]}00`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by + 8, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = colores[i % 6]; ctx.beginPath(); ctx.ellipse(bx, by + 8, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
        }
    },
    trofeos(ctx, x, y) {
        ctx.fillStyle = '#78350f'; rr(ctx, x - 80, y + 14, 160, 12, 3); ctx.fill();
        for (const [dx, h, c] of [[-50, 40, '#d4d4d8'], [0, 56, '#facc15'], [50, 34, '#d97706']]) {
            ctx.fillStyle = c; ctx.fillRect(x + dx - 12, y + 14 - 8, 24, 8); ctx.fillRect(x + dx - 4, y + 14 - h * 0.45, 8, h * 0.4);
            ctx.beginPath(); ctx.moveTo(x + dx - 18, y + 14 - h); ctx.lineTo(x + dx + 18, y + 14 - h); ctx.quadraticCurveTo(x + dx + 16, y + 14 - h * 0.4, x + dx, y + 14 - h * 0.42); ctx.quadraticCurveTo(x + dx - 16, y + 14 - h * 0.4, x + dx - 18, y + 14 - h); ctx.fill();
            ctx.strokeStyle = c; ctx.lineWidth = 3; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + dx + s * 18, y + 14 - h * 0.8, 7, s < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, s < 0 ? Math.PI * 1.5 : Math.PI * 0.5); ctx.stroke(); }
        }
    },
    alfombra(ctx, x, y) {
        for (const [r, c] of [[1, '#ea580c'], [0.78, '#fb923c'], [0.55, '#fdba74'], [0.3, '#fed7aa']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, 150 * r, 42 * r, 0, 0, Math.PI * 2); ctx.fill(); }
    },
    arcoiris(ctx, x, y) {
        const colores = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6'];
        colores.forEach((c, i) => { const r = 1 - i * 0.14; ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, 160 * r, 46 * r, 0, 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = '#fff7ed'; ctx.beginPath(); ctx.ellipse(x, y, 160 * 0.2, 46 * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    },
    lampara(ctx, x, y) {
        ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 52); ctx.stroke();
        const g = ctx.createRadialGradient(x, y + 90, 4, x, y + 100, 150); g.addColorStop(0, 'rgba(254,240,138,0.55)'); g.addColorStop(1, 'rgba(254,240,138,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 30, y + 84); ctx.lineTo(x - 160, y + 260); ctx.lineTo(x + 160, y + 260); ctx.lineTo(x + 30, y + 84); ctx.closePath(); ctx.fill();
        ctx.fillStyle = grad(ctx, x - 40, y + 52, x + 40, y + 86, '#f97316', '#c2410c'); ctx.beginPath(); ctx.moveTo(x - 16, y + 52); ctx.lineTo(x + 16, y + 52); ctx.lineTo(x + 40, y + 86); ctx.lineTo(x - 40, y + 86); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.ellipse(x, y + 88, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
    },
    arana(ctx, x, y) {
        ctx.strokeStyle = '#a16207'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 40); ctx.stroke();
        const g = ctx.createRadialGradient(x, y + 70, 6, x, y + 70, 200); g.addColorStop(0, 'rgba(254,243,199,0.6)'); g.addColorStop(1, 'rgba(254,243,199,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + 70, 200, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ca8a04'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, y + 72, 70, 16, 0, 0, Math.PI); ctx.stroke();
        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(x, y + 52, 12, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 5; i++) {
            const cx = x - 60 + i * 30; const cy = y + 72 + Math.sin((i / 4) * Math.PI) * 14;
            ctx.fillStyle = '#fef3c7'; ctx.fillRect(cx - 4, cy - 22, 8, 22);
            ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.ellipse(cx, cy - 28, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#a5f3fc'; ctx.beginPath(); ctx.moveTo(cx, cy + 2); ctx.lineTo(cx - 5, cy + 12); ctx.lineTo(cx, cy + 22); ctx.lineTo(cx + 5, cy + 12); ctx.closePath(); ctx.fill();
        }
    },
};

function papel(ctx, p) {
    const d = H.PAPELES[p] || H.PAPELES.crema;
    ctx.fillStyle = grad(ctx, 0, 0, 0, HORIZONTE, d.pared[0], d.pared[1]); ctx.fillRect(0, 0, W, HORIZONTE);
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff';
    if (d.dibujo === 'rayas') for (let x = 0; x < W; x += 44) ctx.fillRect(x, 0, 18, HORIZONTE);
    else if (d.dibujo === 'puntos') for (let y = 20; y < HORIZONTE; y += 34) for (let x = (y / 34) % 2 ? 20 : 37; x < W; x += 34) { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
    else if (d.dibujo === 'corazones') { ctx.font = '20px sans-serif'; for (let y = 30; y < HORIZONTE; y += 46) for (let x = (y / 46) % 2 ? 20 : 43; x < W; x += 46) ctx.fillText('♥', x, y); }
    else if (d.dibujo === 'nubes') for (const [x, y] of [[90, 60], [300, 40], [520, 70], [690, 30], [180, 170], [620, 180]]) { ctx.globalAlpha = 0.45; for (const [dx, r] of [[-20, 16], [0, 22], [22, 15]]) { ctx.beginPath(); ctx.arc(x + dx, y, r, 0, Math.PI * 2); ctx.fill(); } }
    else if (d.dibujo === 'tablas') { ctx.globalAlpha = 0.25; ctx.strokeStyle = '#451a03'; ctx.lineWidth = 3; for (let y = 34; y < HORIZONTE; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } }
    else if (d.dibujo === 'estrellas') { ctx.globalAlpha = 0.8; ctx.fillStyle = '#fef9c3'; for (let i = 0; i < 60; i++) { const x = (i * 97) % W; const y = (i * 53) % HORIZONTE; ctx.beginPath(); ctx.arc(x, y, (i % 3) + 1, 0, Math.PI * 2); ctx.fill(); } ctx.beginPath(); ctx.arc(660, 50, 22, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // Rodapié y suelo con tablas en perspectiva
    ctx.fillStyle = grad(ctx, 0, HORIZONTE, 0, ALTO, d.suelo[0], d.suelo[1]); ctx.fillRect(0, HORIZONTE, W, ALTO - HORIZONTE);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
    for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 40, HORIZONTE); ctx.lineTo(W / 2 + i * 120, ALTO); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(0, HORIZONTE - 10, W, 10);
}

async function dibujarCasa({ casa = {}, compaId = null, compa = {}, titulo = '', sub = '' }) {
    const A = require('./casinoArte.js');
    if (!A.listo()) return null;
    const { FUENTE } = require('./fonts.js');
    const { c, ctx } = A.lienzo(W, ALTO);
    ctx.save(); rr(ctx, 0, 0, W, ALTO, 22); ctx.clip();
    papel(ctx, casa.papel);
    const puestos = casa.puestos || {};
    const pinta = (k) => { const id = puestos[k]; if (id && DIBUJOS[id] && POS[k]) DIBUJOS[id](ctx, POS[k][0], POS[k][1]); };
    // Orden: alfombra, pared, fondo, compañero, delante, techo (la luz encima de todo).
    pinta('alfombra0'); for (const k of ['pared0', 'pared1', 'pared2', 'suelo1', 'suelo2']) pinta(k);
    if (compaId) {
        const img = await A.imagenCompanero(compaId, { humor: 'feliz', ...compa }).catch(() => null);
        if (img) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(380, 392, 48, 9, 0, 0, Math.PI * 2); ctx.fill(); A.pintarCompanero(ctx, img, compaId, 380 - 70, 392 - 132, 140); }
    }
    for (const k of ['suelo0', 'suelo3', 'techo0']) pinta(k);
    ctx.restore();
    // Cartel
    if (titulo) {
        ctx.font = `900 20px ${FUENTE}`; const w1 = ctx.measureText(titulo).width;
        ctx.font = `bold 14px ${FUENTE}`; const w2 = sub ? ctx.measureText(sub).width : 0;
        ctx.fillStyle = 'rgba(15,23,42,0.75)'; rr(ctx, 14, 12, Math.min(W - 28, Math.max(w1, w2) + 30), sub ? 58 : 38, 12); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `900 20px ${FUENTE}`; ctx.textAlign = 'left'; ctx.fillText(titulo, 28, 38);
        if (sub) { ctx.fillStyle = '#fde68a'; ctx.font = `bold 14px ${FUENTE}`; ctx.fillText(sub, 28, 60); }
    }
    return c.toBuffer('image/png');
}

module.exports = { dibujarCasa, DIBUJOS, POS };
