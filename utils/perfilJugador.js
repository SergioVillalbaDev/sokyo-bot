// /perfil (1.32.0): la tarjeta de jugador de alguien en este servidor, para presumir. Su compañero
// equipado grande (con su accesorio y si es brillante), su título y casillas con lo importante:
// oro, colección, cartas, rango de combate, torre, pase, logros y racha del diario.
const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const PerfilCombate = require('../models/PerfilCombate.js');
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');
const C = require('./combateNucleo.js');
const X = require('./paseNucleo.js');
const A = require('./casinoArte.js');
const SPR = require('./sprites.js');
const { FUENTE } = require('./fonts.js');
const { t } = require('./i18n.js');

const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));

async function datosDe(guildId, userId) {
    const [col, pf, u] = await Promise.all([
        ColeccionMascotas.findOne({ guildId, userId }).lean(),
        PerfilCombate.findOne({ guildId, userId }).lean(),
        require('./economia.js').en(guildId).obtenerUsuario(userId),
    ]);
    const c = col || {};
    const eq = (c.mascotas || []).find((m) => m.id === c.equipada) || (c.mascotas || [])[0] || null;
    const temp = X.temporadaDe();
    const pase = X.actual(c.pase, temp);
    const mejorCarta = [...(c.cartas || [])].sort((a, b) => (K.RAREZAS[K.def(b.id).rareza].orden - K.RAREZAS[K.def(a.id).rareza].orden) || (b.estrellas || 1) - (a.estrellas || 1))[0] || null;
    const titulos = [];
    if (c.tituloPase) titulos.push({ es: '🏆 Leyenda de la temporada', en: '🏆 Season Legend' });
    for (const m of c.mascotas || []) { const d = K.def(m.id); if (d.titulo) titulos.push(d.titulo); }
    for (const x of c.cartas || []) { const d = K.def(x.id); if (d.titulo) titulos.push(d.titulo); }
    return {
        eq, oro: u?.balance || 0, racha: u?.rachaDaily || 0,
        mascotas: (c.mascotas || []).length, distintas: new Set((c.mascotas || []).map((m) => m.id).filter((id) => K.COMPANEROS[id])).size,
        brillantes: (c.mascotas || []).filter((m) => m.variante === 'brillante').length,
        cartas: (c.cartas || []).length, holos: (c.holos || []).length, mejorCarta,
        logros: (c.logros || []).length, nivelPase: X.nivelDe ? X.nivelDe(pase.xp) : Math.floor((pase.xp || 0) / X.XP_NIVEL) + 1,
        elo: pf?.elo || C.ELO_INICIO, victorias: pf?.victorias || 0, derrotas: pf?.derrotas || 0,
        torre: pf?.torre?.temp === temp ? pf.torre.piso || 0 : 0, mejorTorre: pf?.torre?.mejor || 0,
        titulo: titulos[0] || null,
    };
}

async function tarjeta(d, { nombre, avatarUrl = null, idioma = 'es' }) {
    if (!A.listo()) return null;
    const W = 900; const H = 470;
    const { c, ctx } = A.lienzo(W, H);
    const rango = C.rangoDe(d.elo);
    const rz = d.eq ? K.RAREZAS[K.def(d.eq.id).rareza] : K.RAREZAS.comun;
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0f172a'); g.addColorStop(0.6, '#1e1b4b'); g.addColorStop(1, '#3b0764');
    A.redondeado(ctx, 0, 0, W, H, 28); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = rz.color; ctx.lineWidth = 4; A.redondeado(ctx, 2, 2, W - 4, H - 4, 26); ctx.stroke();
    // Compañero
    const h = ctx.createRadialGradient(180, 260, 10, 180, 260, 210); h.addColorStop(0, `${rz.color}88`); h.addColorStop(1, `${rz.color}00`);
    ctx.fillStyle = h; ctx.fillRect(0, 0, 380, H);
    if (d.eq) {
        const img = SPR.tiene(d.eq.id) ? SPR.imagen(d.eq.id, { etapa: SPR.etapaDe(P.nivel(d.eq.afinidad || 0)), humor: 'feliz', variante: d.eq.variante, acc: d.eq.acc }) : await A.imagenCompanero(d.eq.id).catch(() => null);
        if (img) { if (img._sprite) ctx.drawImage(img, 30, 90, 300, 300); else A.pintarCompanero(ctx, img, d.eq.id, 70, 140, 220, rz.color); }
        const dn = K.def(d.eq.id);
        ctx.fillStyle = '#fff'; ctx.font = `bold 20px ${FUENTE}`; ctx.textAlign = 'center';
        ctx.fillText(`${d.eq.apodo || (idioma === 'en' ? dn.en : dn.es).split(',')[0]}${d.eq.variante === 'brillante' ? ' ✨' : ''}`.slice(0, 26), 180, 420);
        ctx.fillStyle = rz.color; ctx.font = `bold 14px ${FUENTE}`;
        ctx.fillText(`${rz.emoji} ${(idioma === 'en' ? rz.en : rz.es).toUpperCase()} · ${'★'.repeat(d.eq.estrellas || 1)} · ${idioma === 'en' ? 'Lv' : 'Nv'} ${P.nivel(d.eq.afinidad || 0)}`, 180, 444);
    } else {
        ctx.fillStyle = '#94a3b8'; ctx.font = `bold 18px ${FUENTE}`; ctx.textAlign = 'center';
        ctx.fillText(idioma === 'en' ? 'No companion yet' : 'Aún sin compañero', 180, 250);
    }
    // Avatar y nombre
    const X0 = 380;
    if (avatarUrl) {
        const av = await require('@napi-rs/canvas').loadImage(avatarUrl).catch(() => null);
        if (av) { ctx.save(); ctx.beginPath(); ctx.arc(X0 + 34, 58, 30, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(av, X0 + 4, 28, 60, 60); ctx.restore(); ctx.beginPath(); ctx.arc(X0 + 34, 58, 30, 0, Math.PI * 2); ctx.strokeStyle = rango.color; ctx.lineWidth = 3; ctx.stroke(); }
    }
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `bold 30px ${FUENTE}`;
    ctx.fillText(String(nombre).slice(0, 22), X0 + 78, 56, W - X0 - 110);
    ctx.font = `bold 16px ${FUENTE}`; ctx.fillStyle = d.titulo ? '#fde68a' : '#94a3b8';
    ctx.fillText(d.titulo ? (idioma === 'en' ? d.titulo.en : d.titulo.es) : `${rango.emoji} ${idioma === 'en' ? rango.en : rango.es}`, X0 + 78, 82);
    // Casillas
    const casillas = [
        ['🪙', fmt(d.oro, idioma), idioma === 'en' ? 'Gold' : 'Oro'],
        ['🐾', `${d.distintas}/${Object.keys(K.COMPANEROS).length}`, idioma === 'en' ? 'Pets' : 'Mascotas'],
        ['🃏', `${d.cartas}${d.holos ? ` · 🌈${d.holos}` : ''}`, idioma === 'en' ? 'Cards' : 'Cartas'],
        [rango.emoji, String(d.elo), `${idioma === 'en' ? 'ELO' : 'ELO'} · ${d.victorias}${idioma === 'en' ? 'W' : 'V'}`],
        ['🗼', String(d.torre), idioma === 'en' ? `Tower (best ${d.mejorTorre})` : `Torre (mejor ${d.mejorTorre})`],
        ['🎟️', String(d.nivelPase), idioma === 'en' ? 'Pass level' : 'Nivel del pase'],
        ['🏅', `${d.logros}/${X.LOGROS.length}`, idioma === 'en' ? 'Achievements' : 'Logros'],
        ['🔥', String(d.racha), idioma === 'en' ? 'Daily streak' : 'Racha diaria'],
        ['✨', String(d.brillantes), idioma === 'en' ? 'Shiny' : 'Brillantes'],
    ];
    const cw = 158; const ch = 92;
    casillas.forEach(([e, v, l], i) => {
        const x = X0 + (i % 3) * (cw + 12); const y = 112 + Math.floor(i / 3) * (ch + 12);
        ctx.fillStyle = 'rgba(255,255,255,0.07)'; A.redondeado(ctx, x, y, cw, ch, 16); ctx.fill();
        ctx.font = `24px ${FUENTE}`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText(e, x + 12, y + 34);
        ctx.font = `900 22px ${FUENTE}`; ctx.fillText(v, x + 48, y + 34, cw - 56);
        ctx.font = `bold 13px ${FUENTE}`; ctx.fillStyle = '#94a3b8'; ctx.fillText(l, x + 12, y + 70, cw - 20);
    });
    return c.toBuffer('image/png');
}

async function vista(interaction, idioma, usuario = null) {
    const quien = usuario || interaction.user;
    const member = usuario ? await interaction.guild.members.fetch(quien.id).catch(() => null) : interaction.member;
    const nombre = member?.displayName || quien.globalName || quien.username;
    const d = await datosDe(interaction.guildId, quien.id);
    const png = await tarjeta(d, { nombre, avatarUrl: quien.displayAvatarURL?.({ extension: 'png', size: 128 }) || null, idioma }).catch((e) => { console.warn('Perfil:', e.message); return null; });
    const e = new EmbedBuilder().setColor(C.rangoDe(d.elo).color).setTitle(t(idioma, `🪪 Perfil de ${nombre}`, `🪪 ${nombre}’s profile`));
    if (png) e.setImage('attachment://perfil.png');
    else e.setDescription([`🪙 ${fmt(d.oro, idioma)} · 🐾 ${d.distintas} · 🃏 ${d.cartas}`, `${C.rangoDe(d.elo).emoji} ${d.elo} ELO · 🗼 ${d.torre} · 🏅 ${d.logros}`].join('\n'));
    if (d.mejorCarta) e.setFooter({ text: t(idioma, `Mejor carta: ${K.def(d.mejorCarta.id).es} ${'★'.repeat(d.mejorCarta.estrellas || 1)}`, `Best card: ${K.def(d.mejorCarta.id).en} ${'★'.repeat(d.mejorCarta.estrellas || 1)}`) });
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cmp:ver:${quien.id}:${d.eq?.id || 'x'}`).setEmoji('🐾').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Compañero', 'Companion')).setDisabled(!d.eq || !!usuario),
        new ButtonBuilder().setCustomId(`cbt_perfil:${quien.id}`).setEmoji('⚔️').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Combate', 'Battle')).setDisabled(!!usuario),
    );
    return { embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'perfil.png' })] : [], components: [fila], allowedMentions: { parse: [] } };
}

module.exports = { datosDe, tarjeta, vista };
