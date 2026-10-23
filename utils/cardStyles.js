// Estilos PREMIUM de la tarjeta de rango: arte renderizado por código.
// Cada estilo tiene su propia paleta y composición (nebulosas, estrellas,
// rejillas, vetas, ondas...) que el tier gratis (degradado de 2 colores) NO
// puede reproducir. `animado: true` => se genera como GIF.
//
// Firma de los métodos: reciben (ctx, W, H, fase) con fase ∈ [0,1).
//   fondo  -> dibuja el fondo decorativo (ya viene recortado al borde).
//   borde  -> (opcional) dibuja el borde de acento; si falta, rankCard pone uno.
//   overlay-> (opcional) capa por encima de TODO (scanlines, viñeta...).

const TAU = Math.PI * 2;
// Pseudo-aleatorio determinista por índice (mismas posiciones en cada frame).
const rnd = (i, s = 1) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };

function fondoLineal(ctx, W, H, paradas, vertical = true) {
    const g = ctx.createLinearGradient(0, 0, vertical ? 0 : W, vertical ? H : 0);
    for (const [p, c] of paradas) g.addColorStop(p, c);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// Campo de estrellas que titilan con la fase.
function estrellas(ctx, W, H, fase, n, color = '#ffffff') {
    ctx.save(); ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
        const x = rnd(i, 1) * W, y = rnd(i, 2) * H;
        const tw = 0.5 + 0.5 * Math.sin(fase * TAU + i * 1.7);
        ctx.globalAlpha = 0.2 + 0.7 * tw;
        ctx.beginPath(); ctx.arc(x, y, 0.6 + 1.7 * rnd(i, 3), 0, TAU); ctx.fill();
    }
    ctx.restore();
}

// Mancha de nebulosa (resplandor radial aditivo).
function nebulosa(ctx, x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.restore();
}

const ESTILOS = {
    // ---------------- 5 ESTÁTICOS ----------------
    atardecer: {
        animado: false, acento: '#ffd166',
        fondo(ctx, W, H) {
            fondoLineal(ctx, W, H, [[0, '#2b1055'], [0.45, '#7b2d6b'], [0.72, '#ff5e62'], [1, '#ffb86c']]);
            const sx = W * 0.5, sy = H * 0.82;
            nebulosa(ctx, sx, sy, 130, 'rgba(255,228,150,0.9)');
            ctx.save(); ctx.globalAlpha = 0.1; ctx.fillStyle = '#fff';
            for (let i = 0; i < 5; i++) ctx.fillRect(0, H * 0.58 + i * 13, W, 3);
            ctx.restore();
            ctx.fillStyle = '#1a0a2e'; ctx.beginPath(); ctx.moveTo(0, H);
            ctx.lineTo(0, H * 0.84); ctx.quadraticCurveTo(W * 0.25, H * 0.72, W * 0.5, H * 0.82);
            ctx.quadraticCurveTo(W * 0.78, H * 0.92, W, H * 0.8); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
        },
    },
    oceano: {
        animado: false, acento: '#38bdf8',
        fondo(ctx, W, H) {
            fondoLineal(ctx, W, H, [[0, '#013a63'], [0.5, '#01497c'], [1, '#012a4a']]);
            nebulosa(ctx, W * 0.5, -20, 220, 'rgba(120,200,255,0.35)');
            ctx.save(); ctx.strokeStyle = 'rgba(150,220,255,0.25)'; ctx.lineWidth = 2;
            for (let c = 0; c < 4; c++) {
                ctx.beginPath();
                for (let x = 0; x <= W; x += 10) {
                    const y = H * (0.4 + c * 0.15) + Math.sin(x / 60 + c) * 10;
                    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            ctx.fillStyle = 'rgba(200,240,255,0.5)';
            for (let i = 0; i < 18; i++) { ctx.globalAlpha = 0.2 + 0.5 * rnd(i, 5); ctx.beginPath(); ctx.arc(rnd(i, 6) * W, rnd(i, 7) * H, 1 + 3 * rnd(i, 8), 0, TAU); ctx.fill(); }
            ctx.restore();
        },
    },
    bosque: {
        animado: false, acento: '#a7f432',
        fondo(ctx, W, H) {
            fondoLineal(ctx, W, H, [[0, '#0b3d2e'], [1, '#05231a']]);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = 'rgba(160,255,120,0.06)'; ctx.beginPath();
                const x0 = W * (0.1 + i * 0.12); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 60, 0); ctx.lineTo(x0 + 220, H); ctx.lineTo(x0 + 120, H); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
            ctx.fillStyle = '#04160f';
            for (let i = 0; i < 9; i++) { const x = i * (W / 8); const h = 50 + rnd(i, 9) * 40; ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 35, H - h); ctx.lineTo(x + 70, H); ctx.closePath(); ctx.fill(); }
            ctx.fillStyle = '#d9ff6b';
            for (let i = 0; i < 14; i++) { ctx.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(i)); ctx.beginPath(); ctx.arc(rnd(i, 10) * W, rnd(i, 11) * H * 0.8, 1.6, 0, TAU); ctx.fill(); }
            ctx.globalAlpha = 1;
        },
    },
    galaxia: {
        animado: false, acento: '#c8b6ff',
        fondo(ctx, W, H) {
            const g = ctx.createRadialGradient(W * 0.3, H * 0.3, 10, W * 0.3, H * 0.3, W * 0.9);
            g.addColorStop(0, '#3a1d6e'); g.addColorStop(0.5, '#160a2e'); g.addColorStop(1, '#08041a');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            nebulosa(ctx, W * 0.72, H * 0.3, 200, 'rgba(196,113,237,0.5)');
            nebulosa(ctx, W * 0.4, H * 0.8, 170, 'rgba(56,189,248,0.4)');
            nebulosa(ctx, W * 0.9, H * 0.8, 150, 'rgba(244,114,182,0.4)');
            estrellas(ctx, W, H, 0, 70, '#ffffff');
        },
    },
    oro: {
        animado: false, acento: '#ffd700',
        fondo(ctx, W, H) {
            fondoLineal(ctx, W, H, [[0, '#1a1407'], [0.55, '#0c0a05'], [1, '#000000']], false);
            ctx.save(); ctx.strokeStyle = 'rgba(255,215,0,0.1)'; ctx.lineWidth = 2;
            for (let x = -H; x < W; x += 26) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke(); }
            // veta metálica diagonal
            const sg = ctx.createLinearGradient(W * 0.2, 0, W * 0.6, H);
            sg.addColorStop(0, 'rgba(255,236,150,0)'); sg.addColorStop(0.5, 'rgba(255,236,150,0.4)'); sg.addColorStop(1, 'rgba(255,236,150,0)');
            ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#ffe9a8';
            for (let i = 0; i < 20; i++) { ctx.globalAlpha = 0.2 + 0.6 * rnd(i, 12); ctx.beginPath(); ctx.arc(rnd(i, 13) * W, rnd(i, 14) * H, 0.8 + 1.6 * rnd(i, 15), 0, TAU); ctx.fill(); }
            ctx.restore();
        },
    },

    // ---------------- 5 ANIMADOS (GIF) ----------------
    aurora: {
        animado: true, acento: '#00f5d4', glow: true,
        fondo(ctx, W, H, fase) {
            fondoLineal(ctx, W, H, [[0, '#04122b'], [1, '#071a3a']]);
            estrellas(ctx, W, H, fase, 50, '#cfe8ff');
            const cintas = [['#00f5d4', 0.0, 7], ['#43c6ac', 0.33, 9], ['#7b2ff7', 0.66, 5]];
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (const [color, off, amp] of cintas) {
                ctx.beginPath();
                for (let x = 0; x <= W; x += 8) {
                    const y = H * 0.45 + Math.sin(x / 110 + fase * TAU + off * TAU) * amp * 4 + Math.sin(x / 40 + off) * 6;
                    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
                const grad = ctx.createLinearGradient(0, H * 0.25, 0, H);
                grad.addColorStop(0, hexA(color, 0.55)); grad.addColorStop(1, hexA(color, 0));
                ctx.fillStyle = grad; ctx.fill();
            }
            ctx.restore();
        },
    },
    destello: {
        animado: true, acento: '#ffd700', glow: true,
        fondo(ctx, W, H, fase) {
            fondoLineal(ctx, W, H, [[0, '#1a1407'], [0.55, '#0c0a05'], [1, '#000000']], false);
            ctx.save(); ctx.strokeStyle = 'rgba(255,215,0,0.1)'; ctx.lineWidth = 2;
            for (let x = -H; x < W; x += 26) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke(); }
            ctx.restore();
            // destello que barre
            const cx = -150 + fase * (W + 300);
            const sg = ctx.createLinearGradient(cx - 80, 0, cx + 80, H);
            sg.addColorStop(0, 'rgba(255,240,170,0)'); sg.addColorStop(0.5, 'rgba(255,240,170,0.5)'); sg.addColorStop(1, 'rgba(255,240,170,0)');
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H); ctx.restore();
            // chispas que titilan
            ctx.save(); ctx.fillStyle = '#fff7d6';
            for (let i = 0; i < 22; i++) { const tw = 0.5 + 0.5 * Math.sin(fase * TAU * 2 + i * 2); ctx.globalAlpha = tw * 0.9; const x = rnd(i, 16) * W, y = rnd(i, 17) * H, r = 1 + 2 * tw; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
            ctx.restore();
        },
    },
    neon: {
        animado: true, acento: '#ff006e', glow: true,
        fondo(ctx, W, H, fase) {
            fondoLineal(ctx, W, H, [[0, '#170425'], [1, '#0a0118']]);
            // rejilla en perspectiva en la mitad inferior
            const hor = H * 0.55, vp = W / 2;
            ctx.save(); ctx.strokeStyle = 'rgba(0,234,255,0.5)'; ctx.lineWidth = 1.5;
            for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(vp + i * 26, hor); ctx.lineTo(vp + i * 150, H); ctx.stroke(); }
            const scroll = (fase % 1);
            for (let i = 0; i < 10; i++) {
                const t = (i + scroll) / 10; const y = hor + (H - hor) * t * t;
                ctx.globalAlpha = 0.2 + 0.6 * t; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
            }
            ctx.restore();
            nebulosa(ctx, W * 0.5, hor, 160, 'rgba(255,0,110,0.35)');
        },
        borde(ctx, W, H, fase, acento) {
            const k = (Math.sin(fase * TAU) + 1) / 2;
            ctx.save(); ctx.strokeStyle = acento; ctx.shadowColor = acento; ctx.shadowBlur = 10 + k * 28;
            ctx.lineWidth = 4 + k * 4; rr(ctx, 6, 6, W - 12, H - 12, 24); ctx.stroke(); ctx.restore();
        },
        overlay(ctx, W, H) {
            ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#000';
            for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
            ctx.restore();
        },
    },
    cosmos: {
        animado: true, acento: '#8be9fd', glow: true,
        fondo(ctx, W, H, fase) {
            fondoLineal(ctx, W, H, [[0, '#05031f'], [1, '#0a0a2b']]);
            const dx = Math.sin(fase * TAU) * 30, dy = Math.cos(fase * TAU) * 16;
            nebulosa(ctx, W * 0.3 + dx, H * 0.4 + dy, 190, 'rgba(80,120,255,0.4)');
            nebulosa(ctx, W * 0.75 - dx, H * 0.6 - dy, 160, 'rgba(0,200,220,0.35)');
            estrellas(ctx, W, H, fase, 80, '#dbefff');
            // estrella fugaz
            const sf = (fase * 1.0) % 1; if (sf < 0.4) { const p = sf / 0.4; const x = W * p, y = H * 0.2 + p * 40; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 60, y - 24); ctx.stroke(); ctx.restore(); }
        },
    },
    marea: {
        animado: true, acento: '#48cae4', glow: true,
        fondo(ctx, W, H, fase) {
            fondoLineal(ctx, W, H, [[0, '#012a4a'], [1, '#013a63']]);
            const olas = [['rgba(72,202,228,0.35)', 0.55, 16, 0], ['rgba(0,150,199,0.45)', 0.68, 13, 0.5], ['rgba(2,62,138,0.6)', 0.8, 10, 1]];
            for (const [color, yb, amp, ph] of olas) {
                ctx.beginPath(); ctx.moveTo(0, H);
                for (let x = 0; x <= W; x += 8) { const y = H * yb + Math.sin(x / 90 + fase * TAU + ph * TAU) * amp; x === 0 ? ctx.lineTo(0, y) : ctx.lineTo(x, y); }
                ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
            }
            ctx.save(); ctx.fillStyle = 'rgba(220,245,255,0.7)';
            for (let i = 0; i < 16; i++) { let by = (rnd(i, 18) - fase) % 1; by = (by < 0 ? by + 1 : by); ctx.globalAlpha = 0.2 + 0.5 * (1 - by); ctx.beginPath(); ctx.arc(rnd(i, 19) * W, H * 0.5 + by * H * 0.5, 1 + 2 * rnd(i, 20), 0, TAU); ctx.fill(); }
            ctx.restore();
        },
    },
};

// --- utilidades compartidas con rankCard ---
function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// '#rrggbb' + alpha -> 'rgba(r,g,b,a)'
function hexA(hex, a) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

module.exports = { ESTILOS };
