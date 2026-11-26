// Granja, álbum de mascotas y misiones semanales (1.28.0) en Discord. Reglas en utils/granjaNucleo.js.
// Botones: grj:ver:<owner> · grj:rec:<owner> · grj:alb:<owner>. Se abre desde /compi, el cofre y el lobby del casino.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');
const G = require('./granjaNucleo.js');
const { t } = require('./i18n.js');

const fmt = (n, idioma) => Math.floor(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const dec = (n, idioma) => (Math.round(n * 10) / 10).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const nombre = (m, idioma) => m.apodo || t(idioma, K.def(m.id).es, K.def(m.id).en).split(',')[0];
const nombreHito = (h, idioma) => (h.n === 'todas' ? t(idioma, 'todas', 'all') : String(h.n));

// Da los hitos del álbum alcanzados y aún no premiados (cada uno, una sola vez aunque se pulse a la vez).
async function premiarHitos(guildId, userId, col = null) {
    const c = col || await ColeccionMascotas.findOne({ guildId, userId }).lean();
    if (!c) return [];
    const dados = [];
    for (const h of G.hitosNuevos(c)) {
        const r = await ColeccionMascotas.updateOne({ guildId, userId, hitosAlbum: { $ne: String(h.n) } }, { $addToSet: { hitosAlbum: String(h.n) } });
        if (r.modifiedCount) { await require('./economia.js').en(guildId).darOro(userId, h.oro); dados.push(h); }
    }
    if (dados.length) await require('./pase.js').registrar(guildId, userId, 'hito', { n: dados.length }).catch(() => {});
    return dados;
}
const textoHitos = (hitos, idioma) => hitos.map((h) => t(idioma,
    `📖 **¡Hito del álbum: ${nombreHito(h, idioma)} mascotas distintas!** +🪙 ${fmt(h.oro, idioma)}${h.hueco ? ' y **un hueco más en la granja**' : ''}`,
    `📖 **Album milestone: ${nombreHito(h, idioma)} different pets!** +🪙 ${fmt(h.oro, idioma)}${h.hueco ? ' and **one more farm slot**' : ''}`));

// Suma a una misión semanal y paga si se cumple. Devuelve los mensajes. `col` = colección tal cual está.
function semanal(col, accion, n = 1, idioma = 'es', ahora = Date.now()) {
    const r = G.avanzarSemana(col.semana, accion, G.semanaDe(ahora), n);
    let oro = 0; const mensajes = [];
    if (r.cumplida) {
        const d = G.MISIONES_SEMANA[r.cumplida];
        oro += G.PREMIO_SEMANA;
        mensajes.push(t(idioma, `📅 **Misión semanal cumplida:** ${d.emoji} ${d.es} → 🪙 ${G.PREMIO_SEMANA}`, `📅 **Weekly mission done:** ${d.emoji} ${d.en} → 🪙 ${G.PREMIO_SEMANA}`));
    }
    if (r.todas) { oro += G.PREMIO_SEMANA_TODAS; mensajes.push(t(idioma, `🏆 **¡Todas las misiones de la semana!** +🪙 ${G.PREMIO_SEMANA_TODAS}`, `🏆 **All weekly missions!** +🪙 ${G.PREMIO_SEMANA_TODAS}`)); }
    return { sem: r.sem, oro, mensajes };
}
function textoSemana(col, idioma, ahora = Date.now()) {
    const id = G.semanaDe(ahora);
    const s = col.semana && col.semana.id === id ? col.semana : { prog: {}, hechas: [] };
    return Object.entries(G.MISIONES_SEMANA).map(([k, d]) => {
        const hecha = (s.hechas || []).includes(k);
        return `${hecha ? '✅' : '⬜'} ${d.emoji} ${t(idioma, d.es, d.en)}${hecha ? '' : ` (${Math.min(d.n, (s.prog || {})[k] || 0)}/${d.n})`}`;
    }).join('\n');
}

// Recoge lo que ha producido la granja. La primera vez solo la pone en marcha.
async function recoger(guildId, userId, idioma = 'es', ahora = Date.now()) {
    for (let intento = 0; intento < 4; intento++) {
        const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
        if (!col || !(col.mascotas || []).length) return { fallo: 'sin' };
        const a = G.acumulado(col, ahora);
        const filtro = { _id: col._id, 'granja.desde': col.granja?.desde ?? null };
        if (a.nueva) {
            const r = await ColeccionMascotas.updateOne(filtro, { $set: { granja: { desde: new Date(ahora) } } });
            if (r.modifiedCount) return { oro: 0, nueva: true, mensajes: [t(idioma, '🧺 ¡Tu granja está en marcha! Tus mascotas ya producen oro: vuelve en un rato a recogerlo.', '🧺 Your farm is up and running! Your pets are making gold now: come back in a while to collect it.')] };
            continue;
        }
        if (a.oro < 1) return { fallo: 'vacia' };
        const sem = semanal(col, 'granja', 1, idioma, ahora);
        const r = await ColeccionMascotas.updateOne(filtro, { $set: { granja: { desde: new Date(ahora) }, semana: sem.sem }, $inc: { oroGranja: a.oro } });
        if (!r.modifiedCount) continue; // alguien recogió a la vez: se recalcula
        const total = a.oro + sem.oro;
        await require('./economia.js').en(guildId).darOro(userId, total);
        const delPase = await require('./pase.js').registrar(guildId, userId, [['granja', 1], ['misionSemanal', sem.oro ? 1 : 0]], { idioma }).catch(() => []);
        return { oro: a.oro, mensajes: [...delPase, t(idioma, `🧺 Recoges **🪙 ${fmt(a.oro, idioma)}** de la granja (${dec(a.horas, idioma)} h).`, `🧺 You collect **🪙 ${fmt(a.oro, idioma)}** from the farm (${dec(a.horas, idioma)} h).`), ...sem.mensajes] };
    }
    return { fallo: 'ocupado' };
}

const FALLOS = {
    sin: ['Aún no tienes mascotas. Consigue la primera con `/jugar cofre abrir`. ¿Perdido? `/empezar` te guía.', 'You don’t have pets yet. Get your first one with `/games chest open`. Lost? `/start` guides you.'],
    vacia: ['Aún no hay nada que recoger: espera un poco.', 'Nothing to collect yet: wait a bit.'],
    ocupado: ['Prueba otra vez.', 'Try again.'],
};

function tiempo(ms, idioma) {
    const min = Math.max(1, Math.ceil(ms / 60000));
    const h = Math.floor(min / 60);
    return h ? `${h} h ${min % 60} min` : `${min} min`;
}

// Lo que antes iba siempre debajo («Cómo producir más»): ahora sale solo al pulsar ❔.
const textoAyuda = (idioma) => t(idioma,
    '**🧺 Cómo producir más**\n· Trabajan las que más producen. Más rareza, ★ y nivel = más oro.\n· Bien cuidadas producen hasta ×1,2; con hambre o tristes (😢), la mitad.\n· Las que están de expedición no producen.\n· El álbum (📖) abre más huecos.\n· El granero guarda hasta ' + G.TOPE_H + ' h: vuelve a recogerlo.',
    '**🧺 How to make more**\n· The best producers work. Higher rarity, ★ and level = more gold.\n· Well cared for, up to ×1.2; hungry or sad (😢), half.\n· Pets on an expedition don’t produce.\n· The album (📖) unlocks more slots.\n· The barn holds up to ' + G.TOPE_H + ' h: come back to collect it.');

// Datos de la imagen de la granja (utils/arteVistas.js).
function datosGranja(col, a, huecos, idioma, ahora) {
    const id = G.semanaDe(ahora);
    const s = col.semana && col.semana.id === id ? col.semana : { prog: {}, hechas: [] };
    const sig = G.siguienteHito(col);
    return {
        oro: a.oro, frac: a.nueva ? 0 : a.horas / G.TOPE_H, lleno: a.lleno, nueva: a.nueva, porHora: a.porHora, huecos, idioma,
        equipo: a.equipo.map(({ m, oroH }) => ({ id: m.id, estrellas: m.estrellas, oroH, triste: G.factorCuidado(m, ahora) < 0.8 })),
        album: { n: G.distintas(col), total: G.TOTAL(), sig: sig ? t(idioma, `Próximo: ${nombreHito(sig, idioma)}`, `Next: ${nombreHito(sig, idioma)}`) : '👑', sig2: sig ? `+🪙 ${fmt(sig.oro, idioma)}${sig.hueco ? ' +🧺' : ''}` : '' },
        semana: Object.entries(G.MISIONES_SEMANA).map(([k, d]) => ({ emoji: d.emoji, n: d.n, prog: (s.prog || {})[k] || 0, hecha: (s.hechas || []).includes(k) })),
        textos: {
            titulo: t(idioma, 'TU GRANJA', 'YOUR FARM'), porHora: '/h', album: t(idioma, 'Álbum', 'Album'), semana: t(idioma, 'Misiones de la semana', 'This week’s missions'),
            listo: t(idioma, 'para recoger', 'to collect'), lleno: t(idioma, '¡granero lleno! recógelo', 'barn full! collect it'), empezar: t(idioma, 'pulsa «Empezar»', 'press “Start”'),
        },
    };
}

async function vistaGranja(guildId, userId, idioma, mensajes = [], ahora = Date.now()) {
    const hitos = await premiarHitos(guildId, userId);
    const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
    if (!col || !(col.mascotas || []).length) return { content: t(idioma, FALLOS.sin[0], FALLOS.sin[1]), embeds: [], components: [], files: [], attachments: [] };
    const a = G.acumulado(col, ahora);
    const huecos = G.huecos(col);
    const lineas = a.equipo.map(({ m, oroH }) => `${K.def(m.id).emoji} **${nombre(m, idioma)}** ${'★'.repeat(m.estrellas || 1)} · 🪙 ${dec(oroH, idioma)}/h${G.factorCuidado(m, ahora) < 0.8 ? t(idioma, ' · 😢 cuídala y producirá más', ' · 😢 look after it to produce more') : ''}`);
    for (let i = a.equipo.length; i < huecos; i++) lineas.push(t(idioma, '▫️ *Hueco libre: consigue otra mascota*', '▫️ *Free slot: get another pet*'));
    const fuera = (col.mascotas || []).filter((m) => P.expedicionActiva(m, ahora)).length;
    const sig = G.siguienteHito(col);
    const n = G.distintas(col);
    // 1.31.0: todo en una imagen; el mensaje solo lleva lo que acaba de pasar (hitos, lo recogido…).
    const png = await require('./arteVistas.js').tarjetaGranja(datosGranja(col, a, huecos, idioma, ahora)).catch((err) => { console.error('Tarjeta granja:', err.message); return null; });
    const e = new EmbedBuilder().setColor('#16a34a').setTitle(t(idioma, '🧺 Tu granja', '🧺 Your farm'))
        .setDescription([
            ...textoHitos(hitos, idioma), ...mensajes,
            a.nueva ? t(idioma, '**Aún no está en marcha.** Pulsa «Empezar» y tus mascotas empezarán a producir oro solas.', '**Not running yet.** Press “Start” and your pets will start making gold on their own.')
                : a.lleno ? t(idioma, `**🪙 ${fmt(a.oro, idioma)} listos** · ¡el granero está lleno! Recógelo para que siga produciendo.`, `**🪙 ${fmt(a.oro, idioma)} ready** · the barn is full! Collect it so it keeps producing.`)
                    : t(idioma, `**🪙 ${fmt(a.oro, idioma)} para recoger** · se llena en ${tiempo(a.llenoEn, idioma)} (guarda ${G.TOPE_H} h).`, `**🪙 ${fmt(a.oro, idioma)} to collect** · full in ${tiempo(a.llenoEn, idioma)} (holds ${G.TOPE_H} h).`),
            t(idioma, `Producen **🪙 ${dec(a.porHora, idioma)} por hora** entre todas.`, `They make **🪙 ${dec(a.porHora, idioma)} per hour** together.`),
        ].filter(Boolean).join('\n'))
        .addFields(
            { name: t(idioma, `👷 Trabajando (${a.equipo.length}/${huecos} huecos)`, `👷 Working (${a.equipo.length}/${huecos} slots)`), value: lineas.join('\n').slice(0, 1024) || '—' },
            { name: t(idioma, '💡 Cómo producir más', '💡 How to make more'), value: t(idioma,
                `· Trabajan las que más producen. Más rareza, ★ y nivel = más oro.\n· Bien cuidadas producen hasta ×1,2; con hambre o tristes, la mitad.\n· Las que están de expedición no producen${fuera ? ` (ahora ${fuera})` : ''}.\n· El álbum abre más huecos.`,
                `· The best producers work. Higher rarity, ★ and level = more gold.\n· Well cared for, up to ×1.2; hungry or sad, half.\n· Pets on an expedition don’t produce${fuera ? ` (now ${fuera})` : ''}.\n· The album unlocks more slots.`) },
            { name: t(idioma, `📖 Álbum: ${n}/${G.TOTAL()}`, `📖 Album: ${n}/${G.TOTAL()}`), value: sig ? t(idioma, `Próximo hito: **${nombreHito(sig, idioma)}** → 🪙 ${fmt(sig.oro, idioma)}${sig.hueco ? ' + 1 hueco' : ''}`, `Next milestone: **${nombreHito(sig, idioma)}** → 🪙 ${fmt(sig.oro, idioma)}${sig.hueco ? ' + 1 slot' : ''}`) : t(idioma, '¡Álbum completo! 👑', 'Album complete! 👑'), inline: true },
            { name: t(idioma, '📅 Misiones de la semana', '📅 This week’s missions'), value: textoSemana(col, idioma, ahora), inline: true },
        )
        .setFooter({ text: t(idioma, `Llevas 🪙 ${fmt(col.oroGranja, idioma)} sacados de la granja`, `🪙 ${fmt(col.oroGranja, idioma)} earned from the farm so far`) });
    if (png) {
        // Pie corto con lo que la imagen no dice: cuándo se llena, cuántas están fuera y lo sacado en total.
        const pie = [!a.nueva && !a.lleno ? t(idioma, `⏳ lleno en ${tiempo(a.llenoEn, idioma)}`, `⏳ full in ${tiempo(a.llenoEn, idioma)}`) : '', fuera ? `🧭 ${fuera}` : '', `Σ 🪙 ${fmt(col.oroGranja, idioma)}`].filter(Boolean).join(' · ');
        e.setFields([]).setImage('attachment://granja.png').setFooter({ text: pie })
            .setDescription([...textoHitos(hitos, idioma), ...mensajes].join('\n') || null);
    }
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`grj:rec:${userId}`).setEmoji('🧺').setStyle(ButtonStyle.Success)
            .setLabel(a.nueva ? t(idioma, 'Empezar', 'Start') : t(idioma, `Recoger 🪙 ${fmt(a.oro, idioma)}`, `Collect 🪙 ${fmt(a.oro, idioma)}`)).setDisabled(!a.nueva && a.oro < 1),
        new ButtonBuilder().setCustomId(`grj:alb:${userId}`).setEmoji('📖').setStyle(ButtonStyle.Primary).setLabel(t(idioma, 'Álbum', 'Album')),
        new ButtonBuilder().setCustomId(`grj:ver:${userId}`).setEmoji('🔄').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`grj:info:${userId}`).setEmoji('❔').setStyle(ButtonStyle.Secondary),
    );
    return { content: null, embeds: [e], components: [fila], files: png ? [new AttachmentBuilder(png, { name: 'granja.png' })] : [], attachments: [], allowedMentions: { parse: [] } };
}

async function vistaAlbum(guildId, userId, idioma) {
    const hitos = await premiarHitos(guildId, userId);
    const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
    if (!col) return { content: t(idioma, FALLOS.sin[0], FALLOS.sin[1]), embeds: [], components: [], files: [], attachments: [] };
    const tengo = new Set((col.mascotas || []).map((m) => m.id));
    const pr = G.porRareza(col);
    const n = G.distintas(col);
    const orden = Object.entries(K.RAREZAS).sort((a, b) => a[1].orden - b[1].orden);
    const e = new EmbedBuilder().setColor('#a855f7').setTitle(t(idioma, `📖 Álbum de mascotas · ${n}/${G.TOTAL()}`, `📖 Pet album · ${n}/${G.TOTAL()}`))
        .setDescription([...textoHitos(hitos, idioma), t(idioma, 'Las que te faltan salen como ❔. Consíguelas en los cofres (`/jugar cofre abrir`).', 'Missing ones show as ❔. Get them from chests (`/games chest open`).')].join('\n'));
    for (const [r, R] of orden) {
        if (!pr[r]) continue;
        const ids = Object.entries(K.COMPANEROS).filter(([, d]) => d.rareza === r).map(([id]) => id);
        e.addFields({ name: `${R.emoji} ${t(idioma, R.es, R.en)} · ${pr[r].tienes}/${pr[r].total}${pr[r].tienes === pr[r].total ? ' ✅' : ''}`, value: ids.map((id) => (tengo.has(id) ? K.COMPANEROS[id].emoji : '❔')).join(' ').slice(0, 1024) });
    }
    const ya = new Set((col.hitosAlbum || []).map(String));
    // 1.31.0: la colección dibujada (las que faltan, en sombra) en vez de filas de emojis.
    const png = await require('./casinoArte.js').tarjetaColeccion({ mascotas: (col.mascotas || []).filter((m) => !K.esExtra(m.id)), equipada: col.equipada }, { titulo: t(idioma, `📖 Álbum · ${n}/${G.TOTAL()}`, `📖 Album · ${n}/${G.TOTAL()}`) }).catch(() => null);
    if (png) e.setFields([]).setImage('attachment://album.png').setDescription(textoHitos(hitos, idioma).join('\n') || null);
    e.addFields({ name: t(idioma, '🎯 Hitos', '🎯 Milestones'), value: png
        ? G.HITOS.map((h) => `${ya.has(String(h.n)) ? '✅' : n >= G.nHito(h) ? '🎁' : '⬜'}${nombreHito(h, idioma)}`).join(' ')
        : G.HITOS.map((h) => `${ya.has(String(h.n)) ? '✅' : n >= G.nHito(h) ? '🎁' : '⬜'} ${nombreHito(h, idioma)} → 🪙 ${fmt(h.oro, idioma)}${h.hueco ? t(idioma, ' + 🧺 hueco', ' + 🧺 slot') : ''}`).join('\n') });
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`grj:ver:${userId}`).setEmoji('🧺').setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Granja', 'Farm')),
        new ButtonBuilder().setCustomId('cof_otro:basico').setEmoji(K.COFRES.basico.emoji).setStyle(ButtonStyle.Secondary).setLabel(t(idioma, `Abrir cofre (🪙 ${fmt(K.COFRES.basico.precio, idioma)})`, `Open chest (🪙 ${fmt(K.COFRES.basico.precio, idioma)})`)),
    );
    return { content: null, embeds: [e], components: [fila], files: png ? [new AttachmentBuilder(png, { name: 'album.png' })] : [], attachments: [], allowedMentions: { parse: [] } };
}

async function manejar(interaction) {
    const [, que, owner] = (interaction.customId || '').split(':');
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    if (que === 'info') { await interaction.reply({ content: textoAyuda(idioma), flags: 64 }); return true; }
    // «abrir», desde un mensaje de otra persona o desde el lobby (sin dueño): la tuya, en un mensaje solo para ti.
    if (que === 'abrir' || !owner || owner !== interaction.user.id) {
        await interaction.reply({ ...(await (que === 'alb' ? vistaAlbum : vistaGranja)(interaction.guildId, interaction.user.id, idioma)), flags: 64 });
        return true;
    }
    await interaction.deferUpdate();
    if (que === 'rec') {
        const r = await recoger(interaction.guildId, owner, idioma);
        const msj = r.fallo ? [`⚠️ ${t(idioma, FALLOS[r.fallo][0], FALLOS[r.fallo][1])}`] : r.mensajes;
        await interaction.editReply(await vistaGranja(interaction.guildId, owner, idioma, msj));
    } else if (que === 'alb') await interaction.editReply(await vistaAlbum(interaction.guildId, owner, idioma));
    else await interaction.editReply(await vistaGranja(interaction.guildId, owner, idioma));
    return true;
}

module.exports = { FALLOS, premiarHitos, textoHitos, semanal, textoSemana, recoger, vistaGranja, vistaAlbum, manejar, datosGranja, textoAyuda };
