// ⚔️ Combate animado de la Liga (1.33.0): las dos mascotas frente a frente con sus barras; en cada ronda se
// lanzan una contra otra, salen los golpes (con crítico, esquiva o habilidad) y la que pierde la ronda pierde media
// barra (al mejor de 3). Al final, el cartel del ganador. Datos de CombateMascota (utils/liga.js).
const { t } = require('./i18n.js');

async function gifCombateLiga(c, lado, { idioma = 'es', nombres = {} } = {}) {
    const A = require('./casinoArte.js');
    if (!A.listo()) return null;
    const SPR = require('./sprites.js');
    const N = require('./mascotaNucleo.js');
    const { FUENTE } = require('./fonts.js');
    const W = 640; const H = 330;
    const sprite = (l) => (l.guildId ? SPR.imagen(`srv:${l.especie}`, { etapa: 2, humor: 'feliz' }) : SPR.imagen('jefe:sombra', { etapa: 2 }));
    const lados = { a: c.a, b: c.b };
    const img = { a: sprite(c.a), b: sprite(c.b) };
    const nombre = (l) => (lados[l].guildId ? lados[l].nombre : t(idioma, N.SALVAJE.es, N.SALVAJE.en));
    const tactica = (l) => { const x = N.TACTICAS[lados[l].tactica]; return x ? `${x.emoji} ${t(idioma, x.es, x.en)}` : ''; };
    const frames = [];
    const vida = { a: 1, b: 1 };
    const pinta = (ctx, { off = { a: 0, b: 0 }, golpe = null, rotulo = '', destello = 0 } = {}) => {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1e1b4b'); g.addColorStop(1, '#7c2d12');
        A.redondeado(ctx, 0, 0, W, H, 22); ctx.fillStyle = g; ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(W / 2, 268, 290, 40, 0, 0, Math.PI * 2); ctx.fill();
        for (const [l, x, dir] of [['a', 160, 1], ['b', 480, -1]]) {
            const px = x + off[l] * dir;
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px, 262, 60, 11, 0, 0, Math.PI * 2); ctx.fill();
            if (img[l]) {
                ctx.save(); ctx.translate(px, 0); if (dir < 0) ctx.scale(-1, 1);
                if (golpe === l) { ctx.globalAlpha = 0.55; }
                ctx.drawImage(img[l], -80, 102, 160, 160); ctx.restore();
            }
            // Nombre, táctica y barra
            const bx = l === 'a' ? 24 : W - 24 - 250;
            ctx.fillStyle = 'rgba(15,23,42,0.8)'; A.redondeado(ctx, bx, 16, 250, 62, 12); ctx.fill();
            ctx.fillStyle = l === lado ? '#fde68a' : '#f8fafc'; ctx.font = `900 17px ${FUENTE}`; ctx.textAlign = 'left';
            ctx.fillText(nombre(l).slice(0, 18), bx + 12, 38);
            ctx.fillStyle = '#c7d2fe'; ctx.font = `bold 12px ${FUENTE}`; ctx.textAlign = 'right'; ctx.fillText(tactica(l), bx + 238, 38);
            A.redondeado(ctx, bx + 12, 50, 226, 16, 8); ctx.fillStyle = '#334155'; ctx.fill();
            const v = Math.max(0, vida[l]);
            if (v > 0) { A.redondeado(ctx, bx + 12, 50, Math.max(16, 226 * v), 16, 8); ctx.fillStyle = v > 0.5 ? '#22c55e' : v > 0.25 ? '#f59e0b' : '#ef4444'; ctx.fill(); }
        }
        if (destello) { ctx.fillStyle = `rgba(255,255,255,${0.5 * destello})`; ctx.fillRect(0, 0, W, H); }
        if (rotulo) {
            ctx.font = `900 22px ${FUENTE}`; const w = ctx.measureText(rotulo).width + 36;
            ctx.fillStyle = 'rgba(15,23,42,0.85)'; A.redondeado(ctx, W / 2 - w / 2, 96, w, 40, 20); ctx.fill();
            ctx.fillStyle = '#fde68a'; ctx.textAlign = 'center'; ctx.fillText(rotulo, W / 2, 124);
        }
    };
    // Presentación
    for (let f = 0; f < 6; f++) { const { ctx } = A.lienzo(W, H); pinta(ctx, { rotulo: f > 1 ? 'VS' : '' }); frames.push({ ctx, delay: f === 5 ? 500 : 80 }); }
    const evento = (ev) => (ev === 'critico' ? t(idioma, '💥 ¡CRÍTICO!', '💥 CRITICAL!') : ev === 'esquiva' ? t(idioma, '💨 ¡ESQUIVA!', '💨 DODGE!') : ev === 'especial' ? t(idioma, '🌟 ¡HABILIDAD!', '🌟 SKILL!') : '');
    c.rondas.forEach((r, i) => {
        const gana = r.a >= r.b ? 'a' : 'b'; const pierde = gana === 'a' ? 'b' : 'a';
        const ev = evento(gana === 'a' ? r.eventoA : r.eventoB) || evento(pierde === 'a' ? r.eventoA : r.eventoB);
        // Se acercan
        for (let f = 0; f < 6; f++) { const k = f / 5; const { ctx } = A.lienzo(W, H); pinta(ctx, { off: { a: 120 * k, b: 120 * k }, rotulo: t(idioma, `RONDA ${i + 1}`, `ROUND ${i + 1}`) }); frames.push({ ctx, delay: 50 }); }
        // Choque
        const antes = vida[pierde];
        vida[pierde] = Math.max(0, antes - 0.5);
        for (let f = 0; f < 5; f++) {
            const { ctx } = A.lienzo(W, H);
            const k = f / 4;
            const v0 = vida[pierde]; vida[pierde] = antes - (antes - v0) * k;
            pinta(ctx, { off: { a: 120, b: 120 }, golpe: f % 2 ? pierde : null, destello: f === 0 ? 1 : 0, rotulo: ev || `${r.a} — ${r.b}` });
            vida[pierde] = v0;
            frames.push({ ctx, delay: f === 4 ? 420 : 60 });
        }
        // Vuelven
        for (let f = 0; f < 4; f++) { const k = 1 - f / 3; const { ctx } = A.lienzo(W, H); pinta(ctx, { off: { a: 120 * k, b: 120 * k }, rotulo: `${r.a} — ${r.b}` }); frames.push({ ctx, delay: 50 }); }
    });
    // Al final, el que pierde se pone triste.
    const perdedor = c.ganador === 'a' ? 'b' : 'a';
    const triste = lados[perdedor].guildId ? SPR.imagen(`srv:${lados[perdedor].especie}`, { etapa: 2, humor: 'cansado' }) : SPR.imagen('jefe:sombra', { etapa: 2, humor: 'cansado' });
    if (triste) img[perdedor] = triste;
    const { ctx } = A.lienzo(W, H);
    pinta(ctx, { rotulo: c.ganador === lado ? t(idioma, `🏆 ¡GANA ${nombre(lado).toUpperCase()}!`, `🏆 ${nombre(lado).toUpperCase()} WINS!`).slice(0, 34) : t(idioma, `💔 GANA ${nombre(c.ganador).toUpperCase()}`, `💔 ${nombre(c.ganador).toUpperCase()} WINS`).slice(0, 34) });
    frames.push({ ctx, delay: 60000 });
    void nombres;
    return A.aGif(frames, W, H);
}

module.exports = { gifCombateLiga };
