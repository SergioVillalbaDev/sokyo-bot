// Dibujos de los combates (1.32.0): la arena (PNG) con los dos luchadores, su vida, su energía y sus
// estados; la animación de cada ronda (GIF: embiste, impacto, números que suben, críticos y esquivas,
// la vida que baja poco a poco); la tarjeta de perfil de combate; y el jefe semanal con su ataque.
// Si falta canvas, todo devuelve null y el combate sigue con texto.
const { FUENTE } = require('./fonts.js');
const A = require('./casinoArte.js');
const SPR = require('./sprites.js');
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');
const C = require('./combateNucleo.js');

const W = 720; const H = 400;
const ICONOS = { quema: '🔥', maldito: '💀', aturdido: '❄️', confuso: '💫', ataque: '⚔️', defensa: '🛡️', veloz: '💨', debil: '🥀', roto: '💔', lento: '🐌', regenera: '🌿', esquivar: '👻' };

// Imagen de un luchador: su dibujo propio (con etapa y humor) o la foto (anime / del servidor).
async function retrato(id, { nivel = 20, humor = 'normal', variante = null } = {}) {
    if (SPR.tiene(id)) return SPR.imagen(id, { etapa: id.startsWith('jefe:') ? 2 : SPR.etapaDe(nivel), humor, variante });
    return A.imagenCompanero(id).catch(() => null);
}
function pintarLuchador(ctx, img, id, cx, cy, tam, { espejo = false, alfa = 1, rojo = 0 } = {}) {
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(cx, cy);
    if (espejo) ctx.scale(-1, 1);
    if (img._sprite) ctx.drawImage(img, -tam / 2, -tam / 2, tam, tam);
    else A.pintarCompanero(ctx, img, id, -tam * 0.36, -tam * 0.36, tam * 0.72, '#ffffff');
    if (rojo > 0) { // destello rojo del golpe
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = `rgba(239,68,68,${rojo})`; ctx.fillRect(-tam / 2, -tam / 2, tam, tam);
    }
    ctx.restore();
}
function texto(ctx, s, x, y, { tam = 16, color = '#fff', alin = 'left', peso = 'bold', borde = null, max } = {}) {
    ctx.font = `${peso} ${tam}px ${FUENTE}`; ctx.textAlign = alin;
    if (borde) { ctx.lineWidth = Math.max(3, tam / 5); ctx.strokeStyle = borde; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y, max); }
    ctx.fillStyle = color; ctx.fillText(s, x, y, max);
}
const colorVida = (p) => (p > 0.5 ? '#22c55e' : p > 0.25 ? '#f59e0b' : '#ef4444');

// Fondo: cada mitad tiñe del color de su elemento, suelo con brillo.
function fondo(ctx, elA, elB) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1023'); g.addColorStop(1, '#1e1b4b');
    A.redondeado(ctx, 0, 0, W, H, 24); ctx.fillStyle = g; ctx.fill();
    ctx.save(); A.redondeado(ctx, 0, 0, W, H, 24); ctx.clip();
    for (const [el, x] of [[elA, 0], [elB, W]]) {
        const c = C.ELEMENTOS[el]?.color || '#a78bfa';
        const r = ctx.createRadialGradient(x, H * 0.62, 10, x, H * 0.62, W * 0.55);
        r.addColorStop(0, `${c}55`); r.addColorStop(1, `${c}00`); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    }
    // Suelo
    const s = ctx.createLinearGradient(0, H * 0.72, 0, H); s.addColorStop(0, 'rgba(148,163,184,0.10)'); s.addColorStop(1, 'rgba(148,163,184,0.02)');
    ctx.fillStyle = s; ctx.fillRect(0, H * 0.72, W, H);
    ctx.strokeStyle = 'rgba(148,163,184,0.18)'; ctx.lineWidth = 2;
    for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 30, H * 0.72); ctx.lineTo(W / 2 + i * 110, H); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, H * 0.72); ctx.lineTo(W, H * 0.72); ctx.stroke();
    for (const x of [175, 545]) { const e = ctx.createRadialGradient(x, H * 0.86, 4, x, H * 0.86, 100); e.addColorStop(0, 'rgba(2,6,23,0.55)'); e.addColorStop(1, 'rgba(2,6,23,0)'); ctx.fillStyle = e; ctx.beginPath(); ctx.ellipse(x, H * 0.86, 100, 18, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
}
// Panel de un luchador (arriba): nombre, elemento, vida, escudo, energía y estados.
function panel(ctx, l, lado, hp) {
    const x = lado === 'a' ? 18 : W - 18 - 300; const y = 16;
    ctx.fillStyle = 'rgba(2,6,23,0.72)'; A.redondeado(ctx, x, y, 300, 82, 16); ctx.fill();
    const el = C.ELEMENTOS[l.el];
    texto(ctx, `${el?.emoji || ''} ${String(l.nombre).slice(0, 18)}`, x + 14, y + 26, { tam: 18, max: 230 });
    if (l.nivel) texto(ctx, `Nv ${l.nivel}`, x + 286, y + 26, { tam: 14, color: '#c4b5fd', alin: 'right' });
    const p = Math.max(0, Math.min(1, hp / l.max));
    A.redondeado(ctx, x + 14, y + 36, 272, 16, 8); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
    if (p > 0) { A.redondeado(ctx, x + 14, y + 36, Math.max(16, 272 * p), 16, 8); ctx.fillStyle = colorVida(p); ctx.fill(); }
    if (l.escudo > 0) { A.redondeado(ctx, x + 14, y + 36, Math.max(10, 272 * Math.min(1, l.escudo / l.max)), 16, 8); ctx.fillStyle = 'rgba(147,197,253,0.6)'; ctx.fill(); }
    texto(ctx, `${Math.max(0, Math.round(hp))} / ${l.max}`, x + 150, y + 49, { tam: 12, alin: 'center', borde: 'rgba(0,0,0,0.6)' });
    // Energía (rombos)
    for (let i = 0; i < C.ENERGIA_MAX; i++) {
        const ex = x + 20 + i * 18; const ey = y + 67; const lleno = i < l.energia;
        ctx.beginPath(); ctx.moveTo(ex, ey - 7); ctx.lineTo(ex + 6, ey); ctx.lineTo(ex, ey + 7); ctx.lineTo(ex - 6, ey); ctx.closePath();
        ctx.fillStyle = lleno ? (l.energia >= C.ENERGIA_ESPECIAL ? '#facc15' : '#38bdf8') : 'rgba(255,255,255,0.12)'; ctx.fill();
    }
    // Estados
    const est = Object.entries(l.efectos || {}).filter(([, v]) => v && v.rondas > 0).map(([k]) => ICONOS[k]).filter(Boolean);
    texto(ctx, est.join(' '), x + 286, y + 73, { tam: 15, alin: 'right', peso: 'normal' });
}

// Foto fija de la arena. `c` = el combate (combateNucleo), `titulo` = lo de en medio («RONDA 3»).
async function arena(c, { titulo = 'VS', imgs = null, ganador = null } = {}) {
    if (!A.listo()) return null;
    const [ia, ib] = imgs || await Promise.all([retrato(c.a.id, { nivel: c.a.nivel, variante: c.a.variante, humor: humorDe(c.a) }), retrato(c.b.id, { nivel: c.b.nivel, variante: c.b.variante, humor: humorDe(c.b) })]);
    const { c: cv, ctx } = A.lienzo(W, H);
    dibujarEscena(ctx, c, { ia, ib, hpA: c.a.hp, hpB: c.b.hp, titulo, ganador });
    return cv.toBuffer('image/png');
}
const humorDe = (l, ganador = null, lado = null) => (ganador && lado ? (ganador === lado ? 'feliz' : 'cansado') : l.hp <= 0 ? 'cansado' : l.hp / l.max < 0.3 ? 'enfadado' : 'normal');
function dibujarEscena(ctx, c, { ia, ib, hpA, hpB, titulo, ganador = null, offA = 0, offB = 0, rojoA = 0, rojoB = 0, temblor = 0 }) {
    ctx.save();
    if (temblor) ctx.translate((Math.random() - 0.5) * temblor, (Math.random() - 0.5) * temblor);
    fondo(ctx, c.a.el, c.b.el);
    const tam = 210;
    pintarLuchador(ctx, ia, c.a.id, 175 + offA, 250, tam, { alfa: hpA <= 0 ? 0.45 : 1, rojo: rojoA });
    pintarLuchador(ctx, ib, c.b.id, 545 + offB, 250, c.b.id.startsWith('jefe:') ? tam * 1.15 : tam, { espejo: true, alfa: hpB <= 0 ? 0.45 : 1, rojo: rojoB });
    panel(ctx, c.a, 'a', hpA);
    panel(ctx, c.b, 'b', hpB);
    texto(ctx, titulo, W / 2, 160, { tam: 30, alin: 'center', peso: '900', color: '#fde68a', borde: '#1e1b4b' });
    if (ganador) {
        const g = ctx.createLinearGradient(0, H - 70, 0, H - 20); g.addColorStop(0, '#f59e0b'); g.addColorStop(1, '#b45309');
        A.redondeado(ctx, W / 2 - 190, H - 70, 380, 50, 25); ctx.fillStyle = g; ctx.fill();
        texto(ctx, `🏆 ${String(ganador).slice(0, 24)}`, W / 2, H - 37, { tam: 24, alin: 'center', peso: '900', borde: '#78350f' });
    }
    ctx.restore();
}

// Animación de una ronda. `antes` = { a: { hp, ... }, b: {...} } (copias de los luchadores antes de la
// ronda), `c` = el combate ya con la ronda resuelta, `ev` = los sucesos de combateNucleo.ronda.
async function gifRonda(c, antes, ev, { titulo = '', idioma = 'es', ganadorNombre = null } = {}) {
    if (!A.listo()) return null;
    const fin = !!c.fin;
    const ganador = c.fin?.ganador || null;
    const [ia, ib, iaF, ibF] = await Promise.all([
        retrato(c.a.id, { nivel: c.a.nivel, variante: c.a.variante, humor: humorDe(antes.a) }),
        retrato(c.b.id, { nivel: c.b.nivel, variante: c.b.variante, humor: humorDe(antes.b) }),
        retrato(c.a.id, { nivel: c.a.nivel, variante: c.a.variante, humor: humorDe(c.a, ganador, 'a') }),
        retrato(c.b.id, { nivel: c.b.nivel, variante: c.b.variante, humor: humorDe(c.b, ganador, 'b') }),
    ]);
    const hp = { a: antes.a.hp, b: antes.b.hp };
    const frames = [];
    const vista = (extra) => ({ ...c, a: { ...c.a, energia: extra.ea ?? antes.a.energia, efectos: antes.a.efectos, escudo: antes.a.escudo }, b: { ...c.b, energia: extra.eb ?? antes.b.energia, efectos: antes.b.efectos, escudo: antes.b.escudo } });
    const cuadro = (op, delay) => {
        const { ctx } = A.lienzo(W, H);
        dibujarEscena(ctx, op.c || vista({}), { ia: op.ia || ia, ib: op.ib || ib, hpA: op.hpA ?? hp.a, hpB: op.hpB ?? hp.b, titulo: op.titulo ?? titulo, offA: op.offA || 0, offB: op.offB || 0, rojoA: op.rojoA || 0, rojoB: op.rojoB || 0, temblor: op.temblor || 0, ganador: op.ganador || null });
        if (op.encima) op.encima(ctx);
        frames.push({ ctx, delay });
    };
    cuadro({}, 350);
    const t = (es, en) => (idioma === 'en' ? en : es);
    const importantes = ev.filter((e) => ['atacar', 'especial', 'carta', 'defender', 'quema', 'maldicion', 'regenera', 'confuso', 'aturdido'].includes(e.tipo)).slice(0, 6);
    for (const e of importantes) {
        const yo = e.lado; const otro = yo === 'a' ? 'b' : 'a';
        const dir = yo === 'a' ? 1 : -1;
        const xObj = otro === 'a' ? 175 : 545;
        const xYo = yo === 'a' ? 175 : 545;
        const color = e.tipo === 'especial' ? (C.ELEMENTOS[c[yo].el]?.color || '#facc15') : '#ffffff';
        const cartel = e.tipo === 'especial' ? `${e.emoji} ${t(e.nombre.es, e.nombre.en)}` : e.tipo === 'carta' ? `🃏 ${t(e.tecnica.es, e.tecnica.en)}` : e.tipo === 'defender' ? t('🛡️ Se defiende', '🛡️ Defends') : e.tipo === 'aturdido' ? t('❄️ ¡Congelado!', '❄️ Frozen!') : e.tipo === 'confuso' ? t('💫 Se hace un lío…', '💫 Confused…') : '';
        const banner = (ctx) => { if (!cartel) return; ctx.fillStyle = 'rgba(2,6,23,0.75)'; A.redondeado(ctx, W / 2 - 170, 112, 340, 34, 17); ctx.fill(); texto(ctx, cartel, W / 2, 136, { tam: 18, alin: 'center', color: e.tipo === 'especial' ? color : '#fde68a', max: 320 }); };
        if (['atacar', 'especial', 'carta'].includes(e.tipo) && (e.danio || e.esquiva)) {
            // Embiste
            for (const k of [0.35, 0.8]) cuadro({ [yo === 'a' ? 'offA' : 'offB']: dir * 120 * k, titulo: '', encima: banner }, 50);
            const antesHp = hp[otro];
            hp[otro] = Math.max(0, hp[otro] - (e.danio || 0));
            // Impacto
            const num = e.esquiva ? t('¡ESQUIVA!', 'DODGE!') : `-${e.danio}`;
            const sub = e.crit ? t('¡CRÍTICO!', 'CRITICAL!') : e.fe > 1 ? t('¡Muy eficaz!', 'Super effective!') : e.fe < 1 ? t('Poco eficaz…', 'Not very effective…') : '';
            for (let i = 0; i < 6; i++) {
                const k = i / 5;
                const hpVista = antesHp + (hp[otro] - antesHp) * Math.min(1, k * 1.4);
                cuadro({
                    [yo === 'a' ? 'offA' : 'offB']: dir * 120 * Math.max(0, 0.8 - k * 1.6),
                    [otro === 'a' ? 'offA' : 'offB']: e.esquiva ? -dir * 50 * Math.sin(k * Math.PI) : dir * 14 * Math.sin(k * Math.PI * 3),
                    [otro === 'a' ? 'rojoA' : 'rojoB']: e.esquiva ? 0 : Math.max(0, 0.6 - k * 0.7),
                    [otro === 'a' ? 'hpA' : 'hpB']: hpVista,
                    temblor: e.crit && i < 3 ? 10 : 0,
                    titulo: '',
                    encima: (ctx) => {
                        banner(ctx);
                        if (!e.esquiva && i < 3) { // estallido
                            ctx.save(); ctx.globalAlpha = 1 - i / 3;
                            for (let r = 0; r < 10; r++) { const a = (r / 10) * Math.PI * 2; const L = 30 + i * 22; ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(xObj + Math.cos(a) * L * 0.4, 240 + Math.sin(a) * L * 0.4); ctx.lineTo(xObj + Math.cos(a) * L, 240 + Math.sin(a) * L); ctx.stroke(); }
                            ctx.restore();
                        }
                        texto(ctx, num, xObj, 200 - k * 50, { tam: e.crit ? 44 : 36, alin: 'center', peso: '900', color: e.esquiva ? '#93c5fd' : e.crit ? '#fde047' : '#ffffff', borde: e.esquiva ? '#1e3a8a' : '#7f1d1d' });
                        if (sub) texto(ctx, sub, xObj, 232 - k * 50, { tam: 18, alin: 'center', color: '#fde68a', borde: '#1e1b4b' });
                        if (e.cura) texto(ctx, `+${e.cura}`, xYo, 190 - k * 40, { tam: 28, alin: 'center', peso: '900', color: '#4ade80', borde: '#14532d' });
                    },
                }, i === 5 ? 260 : 60);
            }
            if (e.cura) hp[yo] = Math.min(c[yo].max, hp[yo] + e.cura);
        } else if (e.tipo === 'quema' || e.tipo === 'maldicion' || e.tipo === 'confuso') {
            const antesHp = hp[yo]; hp[yo] = Math.max(0, hp[yo] - (e.danio || 0));
            for (let i = 0; i < 4; i++) cuadro({ [yo === 'a' ? 'hpA' : 'hpB']: antesHp + (hp[yo] - antesHp) * (i / 3), [yo === 'a' ? 'rojoA' : 'rojoB']: 0.35 - i * 0.08, titulo: '', encima: (ctx) => { banner(ctx); texto(ctx, `${e.tipo === 'quema' ? '🔥' : e.tipo === 'maldicion' ? '💀' : '💫'} -${e.danio}`, xYo, 200 - i * 12, { tam: 28, alin: 'center', peso: '900', color: '#fca5a5', borde: '#450a0a' }); } }, i === 3 ? 220 : 70);
        } else {
            // Curas, defensa, escudo, mejoras: brillo sobre quien lo hace.
            const cura = e.cura || 0;
            const antesHp = hp[yo]; hp[yo] = Math.min(c[yo].max, hp[yo] + cura);
            for (let i = 0; i < 4; i++) cuadro({ [yo === 'a' ? 'hpA' : 'hpB']: antesHp + (hp[yo] - antesHp) * (i / 3), titulo: '', encima: (ctx) => {
                banner(ctx);
                const g = ctx.createRadialGradient(xYo, 250, 10, xYo, 250, 120); g.addColorStop(0, `rgba(${e.tipo === 'defender' ? '147,197,253' : '134,239,172'},${0.45 - i * 0.1})`); g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g; ctx.fillRect(xYo - 130, 120, 260, 260);
                if (cura) texto(ctx, `+${cura}`, xYo, 200 - i * 12, { tam: 28, alin: 'center', peso: '900', color: '#4ade80', borde: '#14532d' });
            } }, i === 3 ? 240 : 70);
        }
    }
    // Último fotograma: el estado real (y el ganador, si acaba).
    cuadro({ c, ia: iaF, ib: ibF, hpA: c.a.hp, hpB: c.b.hp, titulo: fin ? '' : titulo, ganador: fin ? ganadorNombre : null }, 60000);
    return A.aGif(frames, W, H);
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
    const ev = d.golpes.map((g) => ({ lado: 'a', tipo: g.tipo, danio: g.danio, crit: g.crit, fe: g.fe, nombre: g.nombre, emoji: g.emoji || '✨', tecnica: g.nombre || { es: '', en: '' } }));
    return gifRonda(c, antes, ev, { titulo: d.titulo, idioma: d.idioma });
}

module.exports = { arena, gifRonda, tarjetaPerfil, tarjetaJefe, gifAtaqueJefe, retrato, W, H };
