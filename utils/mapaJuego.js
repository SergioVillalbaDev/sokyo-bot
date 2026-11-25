// 🗺️ Mapa del juego (1.34.0): cómo encaja todo en una imagen. El oro entra (diario, granja, expediciones, combates,
// casino) y se gasta (cofres, sobres, muebles, casino); las mascotas son el centro; el pase lo premia todo. Lo que
// está apagado en el servidor sale en gris. Lo enseñan /menu (🗺️), /empezar, la web /ayuda y el panel.
const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const C = require('./catalogo.js');
const { t } = require('./i18n.js');

// Filas del ciclo: [id, emoji, es, en, módulo, ¿lo hacen tus mascotas?]
const ENTRA = [['diario', '📅', 'Diario', 'Daily', 'oro', false], ['granja', '🧺', 'Granja', 'Farm', 'mascotas', true], ['expedicion', '🧭', 'Expediciones', 'Expeditions', 'mascotas', true],
    ['combates', '⚔️', 'Combates', 'Battles', 'combates', true], ['casino', '🎰', 'Casino', 'Casino', 'casino', false]];
const SALE = [['cofres', '🎁', 'Cofres', 'Chests', 'cofres'], ['cartas', '🃏', 'Sobres de cartas', 'Card packs', 'cartas'], ['casa', '🏠', 'Muebles', 'Furniture', 'mascotas'], ['tienda', '🛒', 'Tienda', 'Shop', 'oro']];
const LADOS = [['guarderia', '🥚', 'Guardería', 'Nursery', 'mascotas', 'crían', 'breed'], ['clanes', '🛡️', 'Clanes y Liga', 'Clans & League', 'clanes', 'compiten', 'compete']];
const NODOS = [...ENTRA, ...SALE, ...LADOS];

function dibujar(cfg, idioma) {
    const A = require('./casinoArte.js');
    if (!A.listo()) return null;
    const { FUENTE } = require('./fonts.js');
    const W = 900; const H = 620;
    const { c, ctx } = A.lienzo(W, H);
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1e1b4b'); g.addColorStop(1, '#0f172a');
    A.redondeado(ctx, 0, 0, W, H, 24); ctx.fillStyle = g; ctx.fill();
    const on = (mod) => { const m = C.modulo(mod); return !m || m.activo(cfg || {}); };
    const flecha = (x1, y1, x2, y2, activa = true, texto = '') => {
        ctx.strokeStyle = activa ? 'rgba(253,230,138,0.8)' : 'rgba(100,116,139,0.35)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const ang = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 11 * Math.cos(ang - 0.45), y2 - 11 * Math.sin(ang - 0.45)); ctx.lineTo(x2 - 11 * Math.cos(ang + 0.45), y2 - 11 * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill();
        if (texto && activa) {
            ctx.font = `bold 12px ${FUENTE}`; const w = ctx.measureText(texto).width + 12; const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2;
            ctx.fillStyle = 'rgba(15,23,42,0.95)'; A.redondeado(ctx, mx - w / 2, my - 10, w, 20, 10); ctx.fill();
            ctx.fillStyle = '#fde68a'; ctx.textAlign = 'center'; ctx.fillText(texto, mx, my + 4);
        }
    };
    const caja = (x, y, w, h, emoji, texto, activa, { color = '#312e81', grande = false, mascota = false } = {}) => {
        ctx.save(); if (activa && grande) { ctx.shadowColor = color; ctx.shadowBlur = 26; }
        A.redondeado(ctx, x - w / 2, y - h / 2, w, h, 16); ctx.fillStyle = activa ? color : '#1e293b'; ctx.fill(); ctx.restore();
        ctx.lineWidth = 2.5; ctx.strokeStyle = activa ? 'rgba(253,230,138,0.9)' : '#475569'; A.redondeado(ctx, x - w / 2, y - h / 2, w, h, 16); ctx.stroke();
        ctx.globalAlpha = activa ? 1 : 0.45; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.font = `${grande ? 30 : 22}px ${FUENTE}`; ctx.fillText(emoji, x - (grande ? 70 : 0), y + (grande ? 10 : -4));
        ctx.font = `900 ${grande ? 26 : 13}px ${FUENTE}`; ctx.fillText(texto, x + (grande ? 20 : 0), y + (grande ? 10 : 20));
        if (mascota) { ctx.font = `16px ${FUENTE}`; ctx.fillText('🐾', x + w / 2 - 14, y - h / 2 + 18); }
        ctx.globalAlpha = 1;
    };
    const rotulo = (texto, y) => { ctx.fillStyle = 'rgba(199,210,254,0.85)'; ctx.font = `900 13px ${FUENTE}`; ctx.textAlign = 'left'; ctx.fillText(texto, 32, y); };
    ctx.fillStyle = '#fde68a'; ctx.font = `900 24px ${FUENTE}`; ctx.textAlign = 'left';
    ctx.fillText(t(idioma, '🗺️ CÓMO ENCAJA TODO', '🗺️ HOW IT ALL FITS'), 28, 42);
    // 1) De dónde sale el oro
    rotulo(t(idioma, 'CONSIGUES ORO CON…', 'YOU EARN GOLD FROM…'), 82);
    const xsE = ENTRA.map((_, i) => 110 + i * 170);
    ENTRA.forEach((n, i) => { caja(xsE[i], 125, 150, 62, n[1], t(idioma, n[2], n[3]), on(n[4]), { mascota: n[5] }); flecha(xsE[i], 158, xsE[i], 200, on(n[4])); });
    // 2) El oro
    caja(450, 232, 740, 60, '🪙', t(idioma, 'TU ORO', 'YOUR GOLD'), true, { color: '#a16207', grande: true });
    // 3) En qué se gasta
    rotulo(t(idioma, 'Y LO GASTAS EN…', 'AND SPEND IT ON…'), 296);
    const xsS = [180, 360, 540, 720];
    SALE.forEach((n, i) => { flecha(xsS[i], 263, xsS[i], 310, on(n[4])); caja(xsS[i], 342, 160, 58, n[1], t(idioma, n[2], n[3]), on(n[4])); });
    // 4) Las mascotas, en el centro de todo
    caja(450, 500, 300, 72, '🐾', t(idioma, 'MASCOTAS', 'PETS'), on('mascotas'), { color: '#15803d', grande: true });
    flecha(180, 372, 360, 464, on('cofres'), t(idioma, 'salen', 'drop'));
    flecha(360, 372, 420, 464, on('cartas'), t(idioma, 'poderes', 'powers'));
    flecha(540, 372, 480, 464, on('mascotas'), t(idioma, 'su casa', 'their home'));
    const [gu, cl] = LADOS;
    caja(120, 500, 170, 60, gu[1], t(idioma, gu[2], gu[3]), on(gu[4])); flecha(205, 500, 298, 500, on(gu[4]), t(idioma, gu[5], gu[6]));
    caja(780, 500, 170, 60, cl[1], t(idioma, cl[2], cl[3]), on(cl[4])); flecha(602, 500, 693, 500, on(cl[4]), t(idioma, cl[5], cl[6]));
    // Leyenda
    ctx.fillStyle = 'rgba(226,232,240,0.8)'; ctx.font = `bold 13px ${FUENTE}`; ctx.textAlign = 'center';
    ctx.fillText(t(idioma, '🐾 = lo hacen tus mascotas  ·  🎟️ todo lo que haces da XP del pase (más premios)  ·  en gris, lo apagado aquí', '🐾 = done by your pets  ·  🎟️ everything you do gives pass XP (more rewards)  ·  in grey, what’s off here'), W / 2, 585);
    return c.toBuffer('image/png');
}

async function vista(cfg, idioma, userId = '') {
    const png = dibujar(cfg, idioma);
    const e = new EmbedBuilder().setColor('#a855f7').setTitle(t(idioma, '🗺️ El mapa del juego', '🗺️ The game map'))
        .setDescription(t(idioma,
            '**El oro** entra por el diario, la granja, las expediciones, los combates y el casino, y se gasta en cofres, sobres y muebles.\n**Tus mascotas** son el centro: trabajan en la granja, viajan, pelean y tienen huevos. Y **todo da XP del pase**, que regala más cosas.',
            '**Gold** comes in from the daily reward, the farm, expeditions, battles and the casino, and is spent on chests, packs and furniture.\n**Your pets** are the centre: they work on the farm, travel, fight and have eggs. And **everything gives pass XP**, which gives more rewards.'));
    if (png) e.setImage('attachment://mapa.png');
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`menu:abrir:${userId}`).setEmoji('🏠').setLabel(t(idioma, 'Mi menú', 'My menu')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`menu:ayuda:${userId}`).setEmoji('❔').setLabel(t(idioma, 'Cómo funciona cada cosa', 'How each thing works')).setStyle(ButtonStyle.Secondary));
    return { embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'mapa.png' })] : [], components: [fila], attachments: [] };
}

module.exports = { NODOS, dibujar, vista };
