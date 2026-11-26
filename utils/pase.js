// Pase de temporada, logros y tickets (1.29.0) en Discord. Reglas en utils/paseNucleo.js.
// /jugar pase (slash/pass.js) y botones pse:ver|log|tk:<ticket>:<owner>. `registrar` se llama desde
// compis, granja, cofres, cartas y el casino: suma XP, da los premios de nivel y revisa logros.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const X = require('./paseNucleo.js');
const { t } = require('./i18n.js');

const fmt = (n, idioma) => Math.floor(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const NOMBRE_TICKET = {
    sobre_normal: ['🃏', 'sobre normal', 'normal pack'], sobre_brillante: ['✨', 'sobre brillante', 'shiny pack'], sobre_legendario: ['🌟', 'sobre legendario', 'legendary pack'],
    cofre_basico: ['📦', 'cofre básico', 'basic chest'], cofre_epico: ['💜', 'cofre épico', 'epic chest'], cofre_legendario: ['👑', 'cofre legendario', 'legendary chest'],
};
const textoTickets = (tk, idioma) => Object.entries(tk || {}).filter(([, v]) => v > 0).map(([k, v]) => `${NOMBRE_TICKET[k][0]} ${v}× ${t(idioma, NOMBRE_TICKET[k][1], NOMBRE_TICKET[k][2])}`).join(' · ');

const filtroVersion = (col) => (col.paseV ? { _id: col._id, paseV: col.paseV } : { _id: col._id, paseV: { $in: [null, 0] } });

// Suma XP por una o varias acciones ([['cuidar', 1], ['mision', 1]] o 'cuidar'). Paga los niveles
// que suba y revisa logros. Devuelve los mensajes para enseñar (vacío si no ha pasado nada que contar).
async function registrar(guildId, userId, acciones, { idioma = 'es', ahora = Date.now(), logros = true } = {}) {
    if (!guildId) return [];
    const lista = (Array.isArray(acciones) ? acciones : [[acciones, 1]]).filter(([a, n]) => a && n > 0);
    if (!lista.length) return [];
    const mensajes = [];
    for (let intento = 0; intento < 5; intento++) {
        const col = await ColeccionMascotas.findOneAndUpdate({ guildId, userId }, { $setOnInsert: { guildId, userId } }, { upsert: true, returnDocument: 'after' }).lean();
        let pase = col.pase; const niveles = []; const premios = { oro: 0, tickets: {}, titulo: false };
        for (const [a, n] of lista) {
            const r = X.sumar(pase, a, { ahora, n });
            pase = r.pase; niveles.push(...r.niveles);
            premios.oro += r.premios.oro; premios.titulo = premios.titulo || r.premios.titulo;
            for (const [k, v] of Object.entries(r.premios.tickets)) premios.tickets[k] = (premios.tickets[k] || 0) + v;
        }
        const inc = { paseV: 1 };
        for (const [k, v] of Object.entries(premios.tickets)) inc[`tickets.${k}`] = v;
        const set = { pase };
        if (premios.titulo) set.tituloPase = pase.temp;
        const hecho = await ColeccionMascotas.updateOne(filtroVersion(col), { $set: set, $inc: inc });
        if (!hecho.modifiedCount) continue;
        if (premios.oro) await require('./economia.js').en(guildId).darOro(userId, premios.oro);
        if (niveles.length) {
            const tope = niveles.at(-1);
            const extra = [premios.oro ? `+🪙 ${fmt(premios.oro, idioma)}` : '', textoTickets(premios.tickets, idioma)].filter(Boolean).join(' · ');
            mensajes.push(tope > X.NIVEL_MAX
                ? t(idioma, `🎟️ **¡Nivel ${tope} del pase!** ${extra}`, `🎟️ **Pass level ${tope}!** ${extra}`)
                : t(idioma, `🎟️ **¡Nivel ${tope} del pase!** ${extra}${premios.tickets && Object.keys(premios.tickets).length ? ' (gratis, en `/jugar pase`)' : ''}`, `🎟️ **Pass level ${tope}!** ${extra}${Object.keys(premios.tickets).length ? ' (free, in `/games pass`)' : ''}`));
            if (premios.titulo) mensajes.push(t(idioma, '🏆 **¡Pase completo!** Ganas el título de Leyenda de la temporada.', '🏆 **Pass complete!** You earn the Season Legend title.'));
        }
        break;
    }
    if (logros) mensajes.push(...await revisarLogros(guildId, userId, idioma, ahora));
    return mensajes;
}

// Da los logros conseguidos que aún no tenía (cada uno, una vez).
async function revisarLogros(guildId, userId, idioma = 'es', ahora = Date.now()) {
    const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
    if (!col) return [];
    const mensajes = []; let n = 0;
    for (const l of X.logrosNuevos(col)) {
        const r = await ColeccionMascotas.updateOne({ guildId, userId, logros: { $ne: l.id } }, { $addToSet: { logros: l.id } });
        if (!r.modifiedCount) continue;
        await require('./economia.js').en(guildId).darOro(userId, l.oro);
        mensajes.push(t(idioma, `🏅 **Logro: ${l.emoji} ${l.es}** · +🪙 ${fmt(l.oro, idioma)}`, `🏅 **Achievement: ${l.emoji} ${l.en}** · +🪙 ${fmt(l.oro, idioma)}`));
        n++;
    }
    if (n) mensajes.push(...await registrar(guildId, userId, [['logro', n]], { idioma, ahora, logros: false }));
    return mensajes;
}

// Gasta un ticket (true si lo tenía). `devolver` lo repone si luego algo falla.
async function usarTicket(guildId, userId, clave) {
    if (!X.TICKETS[clave]) return false;
    const r = await ColeccionMascotas.updateOne({ guildId, userId, [`tickets.${clave}`]: { $gte: 1 } }, { $inc: { [`tickets.${clave}`]: -1 } });
    return r.modifiedCount > 0;
}
const devolverTicket = (guildId, userId, clave) => ColeccionMascotas.updateOne({ guildId, userId }, { $inc: { [`tickets.${clave}`]: 1 } });

function barra(f, largo = 12) {
    const llenos = Math.round(Math.max(0, Math.min(1, f)) * largo);
    return '🟪'.repeat(llenos) + '⬛'.repeat(largo - llenos);
}

async function vistaPase(guildId, userId, idioma, mensajes = [], ahora = Date.now()) {
    const col = await ColeccionMascotas.findOneAndUpdate({ guildId, userId }, { $setOnInsert: { guildId, userId } }, { upsert: true, returnDocument: 'after' }).lean();
    const temp = X.temporadaDe(ahora);
    const pase = X.actual(col.pase, temp);
    const nivel = X.nivelDe(pase.xp);
    const enNivel = pase.xp % X.XP_NIVEL;
    const fin = new Date(Date.UTC(new Date(ahora).getUTCFullYear(), new Date(ahora).getUTCMonth() + 1, 1));
    const proximos = [];
    for (let i = nivel + 1; i <= Math.min(X.NIVEL_MAX, nivel + 5); i++) {
        const p = X.premio(i);
        proximos.push(`${i % 5 === 0 ? '🎁' : '▫️'} **${i}** · 🪙 ${fmt(p.oro, idioma)}${Object.keys(p.tickets).length ? ` · ${textoTickets(p.tickets, idioma)}` : ''}${p.titulo ? t(idioma, ' · 🏆 título', ' · 🏆 title') : ''}`);
    }
    const tk = textoTickets(col.tickets, idioma);
    const hoyCasino = pase.casinoHoy && pase.casinoHoy.dia === new Date(ahora).toISOString().slice(0, 10) ? pase.casinoHoy.n : 0;
    const e = new EmbedBuilder().setColor('#8b5cf6')
        .setTitle(t(idioma, `🎟️ Pase de temporada · ${temp}`, `🎟️ Season pass · ${temp}`))
        .setDescription([
            ...mensajes,
            t(idioma, `**Nivel ${nivel}**${nivel >= X.NIVEL_MAX ? ' (¡completo! cada nivel extra da oro)' : ` de ${X.NIVEL_MAX}`}`, `**Level ${nivel}**${nivel >= X.NIVEL_MAX ? ' (complete! each extra level gives gold)' : ` of ${X.NIVEL_MAX}`}`),
            `${barra(enNivel / X.XP_NIVEL)} ${enNivel}/${X.XP_NIVEL} XP`,
            t(idioma, `Termina <t:${Math.floor(fin.getTime() / 1000)}:R>. Todo es gratis: se sube jugando.`, `Ends <t:${Math.floor(fin.getTime() / 1000)}:R>. It’s all free: you level up by playing.`),
            col.tituloPase ? t(idioma, `🏆 Leyenda de la temporada ${col.tituloPase}`, `🏆 Season ${col.tituloPase} Legend`) : '',
        ].filter(Boolean).join('\n'))
        .addFields(
            { name: t(idioma, '🎁 Próximos premios', '🎁 Next rewards'), value: proximos.join('\n') || t(idioma, `Cada nivel extra: 🪙 ${X.ORO_EXTRA}`, `Each extra level: 🪙 ${X.ORO_EXTRA}`), inline: false },
            { name: t(idioma, '⚡ Cómo se gana XP', '⚡ How to earn XP'), value: t(idioma,
                `🤗 Cuidar ${X.XP.cuidar} · 🧭 Expedición ${X.XP.expedicion} · 🧺 Granja ${X.XP.granja} · 🃏 Usar carta ${X.XP.carta}\n📦 Cofre ${X.XP.cofre} · 🎴 Sobre ${X.XP.sobre} · 📋 Misión ${X.XP.mision} · 📅 Semanal ${X.XP.misionSemanal}\n📖 Hito ${X.XP.hito} · 📺 Serie ${X.XP.serie} · 🏅 Logro ${X.XP.logro} · 🎰 Partida ${X.XP.casino} (${hoyCasino}/${X.TOPE_CASINO_DIA} hoy)`,
                `🤗 Care ${X.XP.cuidar} · 🧭 Expedition ${X.XP.expedicion} · 🧺 Farm ${X.XP.granja} · 🃏 Use card ${X.XP.carta}\n📦 Chest ${X.XP.cofre} · 🎴 Pack ${X.XP.sobre} · 📋 Mission ${X.XP.mision} · 📅 Weekly ${X.XP.misionSemanal}\n📖 Milestone ${X.XP.hito} · 📺 Series ${X.XP.serie} · 🏅 Achievement ${X.XP.logro} · 🎰 Game ${X.XP.casino} (${hoyCasino}/${X.TOPE_CASINO_DIA} today)`), inline: false },
            { name: t(idioma, '🎫 Tus tickets gratis', '🎫 Your free tickets'), value: tk || t(idioma, 'Ninguno aún: salen cada 5 niveles.', 'None yet: they come every 5 levels.'), inline: false },
        )
        .setFooter({ text: t(idioma, `🏅 Logros: ${(col.logros || []).length}/${X.LOGROS.length}`, `🏅 Achievements: ${(col.logros || []).length}/${X.LOGROS.length}`) });
    // 1.31.0: el pase se ve en una imagen (nivel, anillo de XP, próximos premios, tickets y logros).
    const ICONO_TK = (p) => Object.keys(p.tickets || {}).map((k) => NOMBRE_TICKET[k]?.[0]).filter(Boolean);
    const png = require('./arteVistas.js').tarjetaPase({
        nivel, max: X.NIVEL_MAX, frac: nivel >= X.NIVEL_MAX && !enNivel ? 1 : enNivel / X.XP_NIVEL, xp: enNivel, xpNivel: X.XP_NIVEL, temp, idioma, leyenda: !!col.tituloPase,
        proximos: [...Array(5)].map((_, k) => nivel + 1 + k).map((n) => { const p = X.premio(n); return { n, oro: p.oro, iconos: ICONO_TK(p), titulo: p.titulo, regalo: Object.keys(p.tickets).length > 0 || p.titulo }; }),
        tickets: Object.entries(col.tickets || {}).filter(([k, v]) => v > 0 && NOMBRE_TICKET[k]).map(([k, v]) => ({ emoji: NOMBRE_TICKET[k][0], n: v })),
        logros: { n: (col.logros || []).length, total: X.LOGROS.length }, casino: { n: hoyCasino, tope: X.TOPE_CASINO_DIA },
        textos: { nivel: t(idioma, 'NIVEL', 'LEVEL'), tickets: t(idioma, 'Tus tickets gratis', 'Your free tickets') },
    });
    if (png) {
        e.setFields([]).setImage('attachment://pase.png').setFooter(null)
            .setDescription([...mensajes, t(idioma, `⏳ Termina <t:${Math.floor(fin.getTime() / 1000)}:R>`, `⏳ Ends <t:${Math.floor(fin.getTime() / 1000)}:R>`)].join('\n'));
    }
    const botones = Object.entries(col.tickets || {}).filter(([k, v]) => v > 0 && X.TICKETS[k]).slice(0, 4)
        .map(([k, v]) => new ButtonBuilder().setCustomId(`pse:tk:${k}:${userId}`).setEmoji(NOMBRE_TICKET[k][0]).setStyle(ButtonStyle.Success)
            .setLabel(t(idioma, `Abrir ${NOMBRE_TICKET[k][1]} (${v})`, `Open ${NOMBRE_TICKET[k][2]} (${v})`).slice(0, 80)));
    const filas = [];
    if (botones.length) filas.push(new ActionRowBuilder().addComponents(botones));
    filas.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`pse:log:${userId}`).setEmoji('🏅').setStyle(ButtonStyle.Primary).setLabel(t(idioma, 'Logros', 'Achievements')),
        new ButtonBuilder().setCustomId(`grj:abrir:${userId}`).setEmoji('🧺').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Granja', 'Farm')),
        new ButtonBuilder().setCustomId(`pse:ver:${userId}`).setEmoji('🔄').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`pse:info:${userId}`).setEmoji('❔').setStyle(ButtonStyle.Secondary),
    ));
    return { content: null, embeds: [e], components: filas, files: png ? [new AttachmentBuilder(png, { name: 'pase.png' })] : [], attachments: [], allowedMentions: { parse: [] } };
}

async function vistaLogros(guildId, userId, idioma) {
    const col = await ColeccionMascotas.findOne({ guildId, userId }).lean() || {};
    const ya = new Set(col.logros || []);
    const lineas = X.LOGROS.map((l) => `${ya.has(l.id) ? l.emoji : '🔒'} ${ya.has(l.id) ? `**${t(idioma, l.es, l.en)}**` : t(idioma, l.es, l.en)} · 🪙 ${fmt(l.oro, idioma)}`);
    const mitad = Math.ceil(lineas.length / 2);
    const e = new EmbedBuilder().setColor('#f59e0b').setTitle(t(idioma, `🏅 Logros · ${ya.size}/${X.LOGROS.length}`, `🏅 Achievements · ${ya.size}/${X.LOGROS.length}`));
    // 1.31.0: insignias dibujadas (encendidas o con candado) en vez de dos columnas de texto.
    const png = require('./arteVistas.js').tarjetaLogros({ titulo: t(idioma, '🏅 Logros', '🏅 Achievements'), idioma, logros: X.LOGROS.map((l) => ({ emoji: l.emoji, nombre: t(idioma, l.es, l.en), oro: l.oro, tiene: ya.has(l.id) })) });
    if (png) e.setImage('attachment://logros.png');
    else e.addFields({ name: '​', value: lineas.slice(0, mitad).join('\n'), inline: true }, { name: '​', value: lineas.slice(mitad).join('\n'), inline: true });
    const fila = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`pse:ver:${userId}`).setEmoji('🎟️').setStyle(ButtonStyle.Primary).setLabel(t(idioma, 'Pase', 'Pass')));
    return { content: null, embeds: [e], components: [fila], files: png ? [new AttachmentBuilder(png, { name: 'logros.png' })] : [], attachments: [], allowedMentions: { parse: [] } };
}

// «Cómo se gana XP» (antes, siempre debajo del pase): ahora con el botón ❔.
function textoXp(idioma) {
    return t(idioma,
        `**⚡ Cómo se gana XP del pase** (${X.XP_NIVEL} XP = 1 nivel, todo gratis)\n🤗 Cuidar ${X.XP.cuidar} · 🧭 Expedición ${X.XP.expedicion} · 🧺 Granja ${X.XP.granja} · 🃏 Usar carta ${X.XP.carta}\n📦 Cofre ${X.XP.cofre} · 🎴 Sobre ${X.XP.sobre} · 📋 Misión ${X.XP.mision} · 📅 Semanal ${X.XP.misionSemanal}\n📖 Hito ${X.XP.hito} · 📺 Serie ${X.XP.serie} · 🏅 Logro ${X.XP.logro} · 🎰 Partida ${X.XP.casino} (hasta ${X.TOPE_CASINO_DIA} al día)\n🎁 Cada 5 niveles, un ticket gratis.`,
        `**⚡ How to earn pass XP** (${X.XP_NIVEL} XP = 1 level, all free)\n🤗 Care ${X.XP.cuidar} · 🧭 Expedition ${X.XP.expedicion} · 🧺 Farm ${X.XP.granja} · 🃏 Use card ${X.XP.carta}\n📦 Chest ${X.XP.cofre} · 🎴 Pack ${X.XP.sobre} · 📋 Mission ${X.XP.mision} · 📅 Weekly ${X.XP.misionSemanal}\n📖 Milestone ${X.XP.hito} · 📺 Series ${X.XP.serie} · 🏅 Achievement ${X.XP.logro} · 🎰 Game ${X.XP.casino} (up to ${X.TOPE_CASINO_DIA} a day)\n🎁 A free ticket every 5 levels.`);
}

async function manejar(interaction, client) {
    const partes = (interaction.customId || '').split(':');
    const que = partes[1];
    const owner = que === 'tk' ? partes[3] : partes[2];
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    const userId = interaction.user.id;
    if (que === 'info') { await interaction.reply({ content: textoXp(idioma, userId), flags: 64 }); return true; }
    if (que === 'tk') {
        if (owner !== userId) { await interaction.reply({ content: t(idioma, 'Esos tickets no son tuyos. Mira los tuyos con `/jugar pase`.', 'Those tickets aren’t yours. See yours with `/games pass`.'), flags: 64 }); return true; }
        const def = X.TICKETS[partes[2]];
        if (!def) return false;
        // 2.5.0: desde tu pase (privado) se abre ahí mismo; desde un mensaje tuyo, en ese mensaje (utils/ventana.js).
        const V = require('./ventana.js');
        const modo = await V.responderJuego(interaction);
        const r = def.tipo === 'sobre'
            ? await require('./cartas.js').abrir({ interaction, cfg, idioma, sobre: def.id, ticket: partes[2] })
            : await require('./cofres.js').abrir({ interaction, client, cfg, idioma, cofre: def.id, ticket: partes[2] });
        if (r?.error) await V.falloJuego(interaction, modo, `❌ ${r.error}`);
        return true;
    }
    // «abrir», sin dueño o de otra persona: el tuyo, solo para ti.
    if (que === 'abrir' || !owner || owner !== userId) {
        await interaction.reply({ ...(await (que === 'log' ? vistaLogros : vistaPase)(interaction.guildId, userId, idioma)), flags: 64 });
        return true;
    }
    await interaction.deferUpdate();
    await interaction.editReply(await (que === 'log' ? vistaLogros : vistaPase)(interaction.guildId, userId, idioma));
    return true;
}

module.exports = { registrar, revisarLogros, usarTicket, devolverTicket, vistaPase, vistaLogros, manejar, textoTickets, NOMBRE_TICKET };
