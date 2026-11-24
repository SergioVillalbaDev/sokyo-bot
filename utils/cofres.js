// Cofres de mascotas (1.16.0): abrir cofres con oro (con su animación), la colección
// de cada persona, equipar un compañero y sus ventajas (más XP, más oro en /diario y
// un poco de vuelta de lo que se pierde en el casino). Las reglas, en utils/cofresNucleo.js.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, StringSelectMenuBuilder } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const AperturaCofre = require('../models/AperturaCofre.js');
const K = require('./cofresNucleo.js');
const A = require('./casinoArte.js');
const { t } = require('./i18n.js');

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const nombre = (id, idioma) => { const c = K.def(id); return t(idioma, c.es, c.en); };
const rarezaTxt = (r, idioma) => `${K.RAREZAS[r].emoji} ${t(idioma, K.RAREZAS[r].es, K.RAREZAS[r].en)}`;
const pct = (v) => `+${Math.round(v * 1000) / 10} %`;

// Ventajas del compañero equipado (en memoria 60 s: las leen la XP, el diario y el casino).
const cache = new Map();
async function ventajasUsuario(guildId, userId) {
    if (!guildId) return { xp: 0, diario: 0, vuelta: 0, bromas: 0, liga: 0, expedicion: 0 };
    const clave = `${guildId}:${userId}`;
    const c = cache.get(clave);
    if (c && c.hasta > Date.now()) return c.v;
    const col = await ColeccionMascotas.findOne({ guildId, userId }).select('equipada mascotas buff potencia').lean();
    const eq = col?.equipada ? (col.mascotas || []).find((m) => m.id === col.equipada) : null;
    const P = require('./compisNucleo.js');
    // Una carta usada en tu mascota equipada (1.24.0) le da un empujón a todas sus ventajas un rato.
    const pot = col?.potencia && eq && col.potencia.mascota === eq.id && new Date(col.potencia.hasta) > new Date() ? col.potencia.valor || 0 : 0;
    const v = eq ? K.ventajas(eq.id, eq.estrellas, P.extraCuidado(eq) + pot) : { xp: 0, diario: 0, vuelta: 0, bromas: 0, liga: 0, expedicion: 0 };
    // Poder activo (Inspiración, Bendición): suma XP mientras dura. La caché dura poco para que se note al acabar.
    const extra = P.buffXp(col);
    if (extra) v.xp = Math.round((v.xp + extra) * 1000) / 1000;
    cache.set(clave, { v, hasta: Date.now() + 60000 });
    return v;
}
const olvidar = (guildId, userId) => cache.delete(`${guildId}:${userId}`);
// Compañeros que pueden salir en los cofres de este servidor además del catálogo: los propios
// del servidor (1.20.0) y, si lo tiene activado, el Pack anime sin las series quitadas (1.22.0).
// Mascotas que pueden salir aquí además del catálogo: las propias del servidor. `quitadosDe`
// (series del Pack anime quitadas) lo usan los sobres de cartas.
function extrasDe(guildId, cfg) {
    if (!guildId) return [];
    const propios = [...K.PERSONALIZADOS.entries()].filter(([, c]) => c.guildId === guildId && c.activo !== false).map(([id]) => id);
    // 1.24.0: el Pack anime ya no sale en los cofres de mascotas: son cartas (utils/cartas.js).
    return propios;
}
function quitadosDe(cfg) {
    const fuera = cfg?.compis?.anime ? cfg.compis.animeFuera || [] : [];
    if (!fuera.length) return null;
    const todos = new Set(K.ANIME.keys());
    for (const id of K.idsAnime(fuera)) todos.delete(id);
    return todos;
}
const coleccion = async (guildId, userId) => (await ColeccionMascotas.findOneAndUpdate({ guildId, userId }, { $setOnInsert: { guildId, userId } }, { upsert: true, returnDocument: 'after' }));

function textoVentajas(v, idioma) {
    const partes = [];
    if (v.xp) partes.push(t(idioma, `✨ ${pct(v.xp)} de XP`, `✨ ${pct(v.xp)} XP`));
    if (v.diario) partes.push(t(idioma, `🪙 ${pct(v.diario)} en /diario`, `🪙 ${pct(v.diario)} on /daily`));
    if (v.vuelta) partes.push(t(idioma, `🎰 ${pct(v.vuelta)} de vuelta en el casino`, `🎰 ${pct(v.vuelta)} casino cashback`));
    if (v.bromas) partes.push(t(idioma, `🃏 bromas −${Math.round(v.bromas * 100)} %`, `🃏 pranks −${Math.round(v.bromas * 100)}%`));
    if (v.liga) partes.push(t(idioma, `🏆 ${pct(v.liga)} en la Liga`, `🏆 ${pct(v.liga)} League`));
    if (v.expedicion) partes.push(t(idioma, `🧭 ${pct(v.expedicion)} en expediciones`, `🧭 ${pct(v.expedicion)} expeditions`));
    return partes.join(' · ') || '—';
}

// 1.32.0: cuánto falta para la épica segura (la piedad, a la vista).
const textoPiedad = (sinEpica, idioma) => { const f = K.PIEDAD - (sinEpica || 0); return f <= 1 ? t(idioma, '🍀 ¡El próximo trae épica segura!', '🍀 Next one has a guaranteed epic!') : t(idioma, `🍀 Épica segura en ${f} cofres`, `🍀 Guaranteed epic in ${f} chests`); };

// 1.32.0: tirada ×10 con un 10 % de descuento. Un solo cobro, un solo guardado y una animación con
// las 10 (de menos a más rara, para el final la mejor).
async function abrirDiez({ interaction, cfg, idioma, cofre }) {
    if (cfg && (cfg.casino?.cofres === false || !cfg.casino?.activo)) return { error: t(idioma, '🎁 Los cofres no están activados en este servidor (panel → Diversión → Casino).', '🎁 Chests aren’t turned on on this server (panel → Fun → Casino).') };
    const def = K.COFRES[cofre];
    if (!def) return { error: t(idioma, 'Ese cofre no existe.', 'That chest doesn’t exist.') };
    const userId = interaction.user.id; const guildId = interaction.guildId;
    const economia = require('./economia.js').en(guildId);
    const Pase = require('./pase.js');
    const precio = K.precioVarios(cofre, 10);
    const saldo = await economia.cobrar(userId, precio);
    if (saldo === null) return { error: t(idioma, `No tienes 🪙 ${fmt(precio, idioma)} para 10 cofres.`, `You don’t have 🪙 ${fmt(precio, idioma)} for 10 chests.`) };
    const SPR = require('./sprites.js'); const azarS = require('./casinoNucleo.js').azarSeguro;
    let x = null; let col;
    for (let intento = 0; intento < 5 && !x; intento++) {
        col = await coleccion(guildId, userId);
        const r = K.abrirVarios(col, cofre, 10, undefined, extrasDe(guildId, cfg), quitadosDe(cfg));
        // Brillantes: cada compañero de la tirada, como en uno a uno (y solo una vez).
        const brillan = new Set();
        for (const y of r.res) { if (!brillan.has(y.id) && SPR.tiene(y.id) && !(col.mascotas || []).some((m) => m.id === y.id && m.variante === 'brillante') && azarS() < K.PROB_BRILLANTE) { brillan.add(y.id); y.brillante = true; } }
        const set = { sinEpica: r.sinEpica }; const filtros = [];
        r.subir.forEach((u, i) => { set[`mascotas.$[m${i}].estrellas`] = u.estrellas; if (brillan.has(u.id)) set[`mascotas.$[m${i}].variante`] = 'brillante'; filtros.push({ [`m${i}.id`]: u.id }); });
        if (!col.equipada && r.res[0]) set.equipada = r.res.reduce((a, b) => (K.RAREZAS[b.rareza].orden > K.RAREZAS[a.rareza].orden ? b : a)).id;
        const upd = { $inc: { abiertos: 10, gastado: precio, divinas: r.res.filter((y) => y.rareza === 'divina').length }, $set: set };
        const nuevos = r.nuevos.map((n) => ({ id: n.id, estrellas: n.estrellas, primera: new Date(), actualizado: new Date(), ...(brillan.has(n.id) ? { variante: 'brillante' } : {}) }));
        // Subir estrellas y añadir nuevas no caben en una sola operación: van juntas en una transacción
        // (o todo o nada), y solo si nadie ha abierto otro cofre a la vez (abiertos).
        const sesion = await ColeccionMascotas.startSession();
        try {
            await sesion.withTransaction(async () => {
                const hecho = await ColeccionMascotas.updateOne({ _id: col._id, abiertos: col.abiertos }, upd, { session: sesion, ...(filtros.length ? { arrayFilters: filtros } : {}) });
                if (!hecho.modifiedCount) throw new Error('reintentar');
                if (nuevos.length) await ColeccionMascotas.updateOne({ _id: col._id }, { $push: { mascotas: { $each: nuevos } } }, { session: sesion });
            });
            x = r;
        } catch (e) { if (e.message !== 'reintentar') console.warn('Cofres ×10:', e.message); } finally { await sesion.endSession(); }
    }
    if (!x) { await economia.darOro(userId, precio); return { error: t(idioma, 'Prueba otra vez.', 'Try again.') }; }
    if (x.devuelto) await economia.darOro(userId, x.devuelto);
    olvidar(guildId, userId);
    await AperturaCofre.insertMany(x.res.map((y) => ({ guildId, userId, cofre, companero: y.id, rareza: y.rareza }))).catch(() => {});
    const G = require('./granja.js');
    const hitos = x.nuevos.length ? await G.premiarHitos(guildId, userId).catch(() => []) : [];
    const delPase = await Pase.registrar(guildId, userId, [['cofre', 10]], { idioma }).catch(() => []);
    const orden = [...x.res].sort((a, b) => K.RAREZAS[a.rareza].orden - K.RAREZAS[b.rareza].orden);
    const gif = await A.gifDiez(orden.map((y) => ({ id: y.id, rareza: y.rareza, nuevo: y.nuevo, estrellas: y.estrellas, brillante: !!y.brillante })), { color: def.color, textoNuevo: t(idioma, '¡NUEVA!', 'NEW!') }).catch((e) => { console.warn('GIF x10:', e.message); return null; });
    const mejor = orden[orden.length - 1];
    const resumen = Object.keys(K.RAREZAS).map((rz) => [rz, x.res.filter((y) => y.rareza === rz).length]).filter(([, n]) => n).map(([rz, n]) => `${K.RAREZAS[rz].emoji}×${n}`).join(' ');
    const e = new EmbedBuilder().setColor(K.RAREZAS[mejor.rareza].color).setTitle(t(idioma, `${def.emoji} 10 × ${def.es}`, `${def.emoji} 10 × ${def.en}`))
        .setDescription([
            `||${resumen} · ${t(idioma, 'nuevas', 'new')}: ${x.nuevos.length}||`,
            x.res.some((y) => y.brillante) ? t(idioma, '✨🌈 **¡Te ha salido una BRILLANTE!**', '✨🌈 **You got a SHINY one!**') : '',
            x.devuelto ? t(idioma, `↩ Repetidas al máximo: +🪙 ${fmt(x.devuelto, idioma)}`, `↩ Maxed duplicates: +🪙 ${fmt(x.devuelto, idioma)}`) : '',
        ].filter(Boolean).join('\n'))
        .setFooter({ text: `${t(idioma, `Pagado 🪙 ${fmt(precio, idioma)} (−10 %) · te quedan 🪙 ${fmt(saldo + x.devuelto, idioma)}`, `Paid 🪙 ${fmt(precio, idioma)} (−10%) · 🪙 ${fmt(saldo + x.devuelto, idioma)} left`)} · ${textoPiedad(x.sinEpica, idioma)}` });
    if (gif) e.setImage('attachment://diez.gif');
    else e.setDescription(`${e.data.description || ''}\n${orden.map((y) => `${K.RAREZAS[y.rareza].emoji} ${nombre(y.id, idioma)} ${y.nuevo ? '🆕' : '★'.repeat(y.estrellas)}`).join('\n')}`);
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cof_diez:${cofre}`).setEmoji('🔟').setStyle(ButtonStyle.Primary).setLabel(t(idioma, `Otros 10 (🪙 ${fmt(precio, idioma)})`, `Another 10 (🪙 ${fmt(precio, idioma)})`)),
        new ButtonBuilder().setCustomId(`cmp:ver:${userId}:${mejor.id}`).setEmoji('🐾').setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Ver la mejor', 'See the best')),
    );
    await interaction.editReply({ embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'diez.gif' })] : [], components: [fila], allowedMentions: { parse: [] } });
    const extras = [...G.textoHitos(hitos, idioma), ...delPase].filter(Boolean);
    if (extras.length) { await espera(6500); await interaction.followUp({ content: extras.join('\n'), allowedMentions: { parse: [] } }).catch(() => {}); }
    if ((K.RAREZAS[mejor.rareza].orden >= 3 || x.res.some((y) => y.brillante)) && cfg?.casino?.anunciosId) {
        const canal = interaction.guild?.channels.cache.get(cfg.casino.anunciosId);
        const d = K.def(mejor.id);
        if (canal?.isTextBased() && canal.id !== interaction.channelId) await canal.send({ content: t(cfg, `✨ <@${userId}> ha abierto 10 cofres y le ha salido ${d.emoji} **${d.es}** (${K.RAREZAS[mejor.rareza].es}).`, `✨ <@${userId}> opened 10 chests and got ${d.emoji} **${d.en}** (${K.RAREZAS[mejor.rareza].en}).`), allowedMentions: { users: [userId] } }).catch(() => {});
    }
    return { ok: true, r: x };
}

// Tus últimas tiradas (las épicas o mejores de cofres y sobres) y tus números.
async function historial(interaction, idioma) {
    const col = await coleccion(interaction.guildId, interaction.user.id);
    const ultimas = await AperturaCofre.find({ guildId: interaction.guildId, userId: interaction.user.id, rareza: { $in: ['epica', 'legendaria', 'mitica', 'divina'] } }).sort({ fecha: -1 }).limit(15).lean();
    const e = new EmbedBuilder().setColor('#a855f7').setTitle(t(idioma, '📜 Tus mejores tiradas', '📜 Your best pulls'))
        .setDescription([
            t(idioma, `📦 **${fmt(col.abiertos, idioma)}** cofres (🪙 ${fmt(col.gastado, idioma)}) · 🃏 **${fmt(col.sobresAbiertos, idioma)}** sobres · 🌈 ${col.divinas || 0} divinas`, `📦 **${fmt(col.abiertos, idioma)}** chests (🪙 ${fmt(col.gastado, idioma)}) · 🃏 **${fmt(col.sobresAbiertos, idioma)}** packs · 🌈 ${col.divinas || 0} divine`),
            `${textoPiedad(col.sinEpica, idioma)} · ${require('./cartas.js').textoPiedad(col.sinEpicaCartas, idioma)}`,
            '',
            ultimas.length ? ultimas.map((a) => { const d = K.def(a.companero); return `${K.RAREZAS[a.rareza].emoji} ${d.emoji} **${t(idioma, d.es, d.en)}**${String(a.cofre).startsWith('sobre:') ? ' 🃏' : ''} · <t:${Math.floor(new Date(a.fecha).getTime() / 1000)}:R>`; }).join('\n') : t(idioma, 'Aún no te ha salido nada épico. ¡Suerte!', 'Nothing epic yet. Good luck!'),
        ].join('\n'));
    return { embeds: [e], flags: 64 };
}

// Abre un cofre. Cobra, decide qué sale (con piedad), lo guarda y lo anima.
async function abrir({ interaction, client, cfg, idioma, cofre, ticket = null }) {
    if (cfg && (cfg.casino?.cofres === false || !cfg.casino?.activo)) return { error: t(idioma, '🎁 Los cofres no están activados en este servidor (panel → Diversión → Casino).', '🎁 Chests aren’t turned on on this server (panel → Fun → Casino).') };
    const def = K.COFRES[cofre];
    if (!def) return { error: t(idioma, 'Ese cofre no existe.', 'That chest doesn’t exist.') };
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const economia = require('./economia.js').en(guildId);
    // 1.29.0: con un ticket del pase el cofre sale gratis.
    const Pase = require('./pase.js');
    if (ticket && !(await Pase.usarTicket(guildId, userId, ticket))) return { error: t(idioma, 'Ya no tienes ese ticket. Mira los tuyos con `/pase`.', 'You no longer have that ticket. See yours with `/pass`.') };
    const saldo = ticket ? (await economia.obtenerUsuario(userId)).balance : await economia.cobrar(userId, def.precio);
    if (saldo === null) return { error: t(idioma, `No tienes 🪙 ${fmt(def.precio, idioma)} para el ${def.es.toLowerCase()}.`, `You don’t have 🪙 ${fmt(def.precio, idioma)} for the ${def.en.toLowerCase()}.`) };
    // Se calcula sobre la colección y se guarda solo si nadie la ha tocado a la vez.
    let r; let col;
    for (let intento = 0; intento < 5; intento++) {
        col = await coleccion(guildId, userId);
        r = K.abrir(col, cofre, undefined, extrasDe(interaction.guildId, cfg), quitadosDe(cfg));
        const tiene = (col.mascotas || []).some((m) => m.id === r.id);
        // 1.32.0: variante brillante (otros colores y destellos), 1 de cada PROB_BRILLANTE. Solo los que tienen dibujo propio.
        const yaBrilla = (col.mascotas || []).some((m) => m.id === r.id && m.variante === 'brillante');
        r.brillante = !yaBrilla && require('./sprites.js').tiene(r.id) && require('./casinoNucleo.js').azarSeguro() < K.PROB_BRILLANTE;
        const upd = {
            $inc: { abiertos: 1, gastado: def.precio, ...(r.rareza === 'divina' ? { divinas: 1 } : {}) },
            $set: { sinEpica: r.sinEpica, ...(tiene ? { 'mascotas.$[m].estrellas': r.estrellas } : {}), ...(tiene && r.brillante ? { 'mascotas.$[m].variante': 'brillante' } : {}), ...(!col.equipada ? { equipada: r.id } : {}) },
            ...(tiene ? {} : { $push: { mascotas: { id: r.id, estrellas: 1, primera: new Date(), actualizado: new Date(), ...(r.brillante ? { variante: 'brillante' } : {}) } } }),
        };
        const hecho = await ColeccionMascotas.updateOne({ _id: col._id, abiertos: col.abiertos }, upd, tiene ? { arrayFilters: [{ 'm.id': r.id }] } : {});
        if (hecho.modifiedCount) break;
        r = null;
    }
    if (!r) { if (ticket) await Pase.devolverTicket(guildId, userId, ticket); else await economia.darOro(userId, def.precio); return { error: t(idioma, 'Prueba otra vez.', 'Try again.') }; }
    if (r.devuelto) await economia.darOro(userId, r.devuelto);
    olvidar(guildId, userId);
    await AperturaCofre.create({ guildId: interaction.guildId || null, userId, cofre, companero: r.id, rareza: r.rareza }).catch(() => {});
    const comp = K.def(r.id);
    const rz = K.RAREZAS[r.rareza];
    const v = K.ventajas(r.id, r.estrellas);
    const G = require('./granja.js');
    const hitos = r.nuevo ? await G.premiarHitos(guildId, userId).catch(() => []) : [];
    const delPase = await Pase.registrar(guildId, userId, 'cofre', { idioma }).catch(() => []);
    const gif = await A.gifCofre(cofre, r.id, { nombre: nombre(r.id, idioma), rarezaTexto: `${r.brillante ? '✨ ' : ''}${t(idioma, rz.es, rz.en).toUpperCase()}`, estrellas: r.estrellas, nuevo: r.nuevo, textoNuevo: t(idioma, '¡NUEVA!', 'NEW!'), variante: r.brillante ? 'brillante' : null }).catch(() => null);
    const estado = r.nuevo
        ? t(idioma, '🆕 ¡Nuevo en tu colección!', '🆕 New in your collection!')
        : r.devuelto ? t(idioma, `Ya lo tenías con 5 ★: te devolvemos 🪙 ${fmt(r.devuelto, idioma)}.`, `You already had it at 5 ★: you get 🪙 ${fmt(r.devuelto, idioma)} back.`)
            : t(idioma, `Repetido: sube a **${'★'.repeat(r.estrellas)}**`, `Duplicate: now **${'★'.repeat(r.estrellas)}**`);
    const pie = { text: `${t(idioma, `Te quedan 🪙 ${fmt(saldo + (r.devuelto || 0), idioma)} · ${col.abiertos + 1} cofres abiertos`, `You have 🪙 ${fmt(saldo + (r.devuelto || 0), idioma)} left · ${col.abiertos + 1} chests opened`)} · ${textoPiedad(r.sinEpica, idioma)}` };
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cof_otro:${cofre}`).setEmoji(def.emoji).setStyle(ButtonStyle.Primary).setLabel(t(idioma, `Abrir otro (🪙 ${fmt(def.precio, idioma)})`, `Open another (🪙 ${fmt(def.precio, idioma)})`)),
        new ButtonBuilder().setCustomId(`cof_eq:${r.id}`).setEmoji('✅').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Equipar', 'Equip')),
        new ButtonBuilder().setCustomId(`cmp:ver:${userId}:${r.id}`).setEmoji('🐾').setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Cuidarla', 'Look after it')),
        new ButtonBuilder().setCustomId(`grj:abrir:${userId}`).setEmoji('🧺').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Granja', 'Farm')),
        new ButtonBuilder().setCustomId(`cof_diez:${cofre}`).setEmoji('🔟').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, `×10 (🪙 ${fmt(K.precioVarios(cofre, 10), idioma)})`, `×10 (🪙 ${fmt(K.precioVarios(cofre, 10), idioma)})`)),
    );
    const e = new EmbedBuilder().setColor(def.color).setTitle(`${def.emoji} ${t(idioma, def.es, def.en)}`).setFooter(pie);
    if (gif) {
        // 1.31.1: UN mensaje. La animación ya enseña qué sale (nombre, rareza, 🆕 o ★), así que no se
        // edita después (antes, al editar, la imagen saltaba). Lo que sí hay que contar va aparte.
        // Lo que sale, también en texto oculto (‖…‖): sin destripar la animación y para quien tiene los GIF en pausa.
        const resumen = `||${comp.emoji} ${nombre(r.id, idioma)} · ${rarezaTxt(r.rareza, idioma)} · ${r.nuevo ? t(idioma, '🆕 ¡nueva!', '🆕 new!') : '★'.repeat(r.estrellas)}||`;
        e.setImage('attachment://cofre.gif')
            .setDescription([ticket ? t(idioma, '🎫 Abierto con un ticket del pase: ¡gratis!', '🎫 Opened with a pass ticket: free!') : '', resumen].filter(Boolean).join('\n'));
        await interaction.editReply({ embeds: [e], files: [new AttachmentBuilder(gif, { name: 'cofre.gif' })], components: [fila], allowedMentions: { parse: [] } });
        const extras = [
            r.devuelto ? estado : '',
            r.brillante ? t(idioma, `✨🌈 **¡¡BRILLANTE!!** Tu ${nombre(r.id, idioma)} tiene colores rarísimos (1 de cada ${Math.round(1 / K.PROB_BRILLANTE)}).`, `✨🌈 **SHINY!!** Your ${nombre(r.id, idioma)} has ultra-rare colours (1 in ${Math.round(1 / K.PROB_BRILLANTE)}).`) : '',
            r.piedad ? t(idioma, '🍀 ¡La suerte del décimo cofre! (épica asegurada)', '🍀 Tenth-chest luck! (epic guaranteed)') : '',
            ...G.textoHitos(hitos, idioma), ...delPase,
        ].filter(Boolean);
        if (extras.length) {
            await espera(r.rareza === 'divina' ? 5400 : 4200);
            await interaction.followUp({ content: extras.join('\n'), allowedMentions: { parse: [] } }).catch(() => {});
        }
    } else {
        e.setColor(rz.color).setDescription([
            r.rareza === 'divina' ? t(idioma, '🌈🌈🌈 **¡¡¡DIVINA!!!** 🌈🌈🌈', '🌈🌈🌈 **DIVINE!!!** 🌈🌈🌈') : '',
            `${comp.emoji} **${nombre(r.id, idioma)}** · ${rarezaTxt(r.rareza, idioma)}${comp.serie ? `\n📺 ${comp.serie}` : ''}`,
            estado,
            r.piedad ? t(idioma, '🍀 ¡La suerte del décimo cofre! (épica asegurada)', '🍀 Tenth-chest luck! (epic guaranteed)') : '',
            K.habilidad(r.id) ? t(idioma, `🌟 Habilidad exclusiva: **${K.habilidad(r.id).es}**`, `🌟 Exclusive ability: **${K.habilidad(r.id).en}**`) : '',
            t(idioma, `Si la equipas: ${textoVentajas(v, idioma)}`, `If equipped: ${textoVentajas(v, idioma)}`),
            ...G.textoHitos(hitos, idioma),
            ticket ? t(idioma, '🎫 Abierto con un ticket del pase: ¡gratis!', '🎫 Opened with a pass ticket: free!') : '',
            ...delPase,
        ].filter(Boolean).join('\n'));
        await interaction.editReply({ embeds: [e], components: [fila], allowedMentions: { parse: [] } });
    }
    // Las legendarias o mejores se anuncian (y la divina, a lo grande).
    if ((rz.orden >= 3 || r.brillante) && cfg?.casino?.anunciosId) {
        const canal = interaction.guild?.channels.cache.get(cfg.casino.anunciosId);
        if (canal?.isTextBased() && canal.id !== interaction.channelId) {
            await canal.send({ content: r.brillante && r.rareza !== 'divina'
                ? t(cfg, `✨🌈 <@${userId}> ha sacado un ${comp.emoji} **${comp.es} BRILLANTE** (1 de cada ${Math.round(1 / K.PROB_BRILLANTE)}).`, `✨🌈 <@${userId}> pulled a **SHINY** ${comp.emoji} **${comp.en}** (1 in ${Math.round(1 / K.PROB_BRILLANTE)}).`)
                : r.rareza === 'divina'
                ? t(cfg, `🌈👑 **¡¡HISTÓRICO!!** <@${userId}> ha sacado **${comp.emoji} ${comp.es}**, la mascota DIVINA. Probabilidad: 1 entre ${Math.round(100 / K.COFRES[cofre].prob.divina).toLocaleString('es-ES')}.`, `🌈👑 **HISTORIC!!** <@${userId}> pulled **${comp.emoji} ${comp.en}**, the DIVINE pet. Odds: 1 in ${Math.round(100 / K.COFRES[cofre].prob.divina).toLocaleString('en-US')}.`)
                : t(cfg, `✨ <@${userId}> ha sacado ${comp.emoji} **${comp.es}** (${K.RAREZAS[r.rareza].es}) de un ${def.es.toLowerCase()}.`, `✨ <@${userId}> pulled ${comp.emoji} **${comp.en}** (${K.RAREZAS[r.rareza].en}) from a ${def.en.toLowerCase()}.`), allowedMentions: { users: [userId] } }).catch(() => {});
        }
    }
    return { ok: true, r };
}

async function equipar(guildId, userId, id) {
    const r = await ColeccionMascotas.updateOne({ guildId, userId, 'mascotas.id': id }, { $set: { equipada: id } });
    olvidar(guildId, userId);
    return r.modifiedCount > 0 || r.matchedCount > 0;
}

async function verColeccion(interaction, idioma, usuario = null) {
    const quien = usuario || interaction.user;
    const col = (await ColeccionMascotas.findOne({ guildId: interaction.guildId, userId: quien.id }).lean()) || { mascotas: [], abiertos: 0 };
    const total = Object.keys(K.COMPANEROS).length;
    const delCatalogo = col.mascotas.filter((m) => K.COMPANEROS[m.id]).length;
    const anime = col.mascotas.filter((m) => K.esAnime(m.id)).length;
    const extra = anime ? ` · 🌸 ${anime}` : '';
    const png = await A.tarjetaColeccion(col, { titulo: t(idioma, `Colección de ${quien.username} · ${delCatalogo}/${total}${extra}`, `${quien.username}’s collection · ${delCatalogo}/${total}${extra}`) }).catch(() => null);
    const eq = col.equipada ? col.mascotas.find((m) => m.id === col.equipada) : null;
    const e = new EmbedBuilder().setColor(eq ? K.RAREZAS[K.def(eq.id).rareza].color : '#6366f1')
        .setTitle(t(idioma, `🐾 Colección de ${quien.username}`, `🐾 ${quien.username}’s collection`))
        .setDescription([
            eq ? t(idioma, `Equipado: ${K.def(eq.id).emoji} **${nombre(eq.id, idioma)}** ${'★'.repeat(eq.estrellas)}\n${textoVentajas(K.ventajas(eq.id, eq.estrellas), idioma)}`, `Equipped: ${K.def(eq.id).emoji} **${nombre(eq.id, idioma)}** ${'★'.repeat(eq.estrellas)}\n${textoVentajas(K.ventajas(eq.id, eq.estrellas), idioma)}`) : t(idioma, 'Sin compañero equipado. Abre un cofre con `/cofre abrir`.', 'No companion equipped. Open a chest with `/chest open`.'),
            eq && K.def(eq.id).titulo ? `**${t(idioma, K.def(eq.id).titulo.es, K.def(eq.id).titulo.en)}**` : '',
            t(idioma, `📦 ${col.abiertos} cofres abiertos`, `📦 ${col.abiertos} chests opened`),
        ].filter(Boolean).join('\n'));
    if (png) e.setImage('attachment://coleccion.png');
    const comps = [];
    if (!usuario && col.mascotas.length) {
        comps.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('cof_sel').setPlaceholder(t(idioma, '✅ Equipar otro compañero…', '✅ Equip another companion…'))
            .addOptions([...col.mascotas].sort((a, b) => K.RAREZAS[K.def(b.id).rareza].orden - K.RAREZAS[K.def(a.id).rareza].orden).slice(0, 25)
                .map((m) => ({ label: `${nombre(m.id, idioma)} ${'★'.repeat(m.estrellas)}`.slice(0, 100), value: m.id, emoji: K.def(m.id).emoji, description: `${t(idioma, K.RAREZAS[K.def(m.id).rareza].es, K.RAREZAS[K.def(m.id).rareza].en)} · ${textoVentajas(K.ventajas(m.id, m.estrellas), idioma)}`.slice(0, 100) })))));
    }
    return { embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'coleccion.png' })] : [], components: comps, allowedMentions: { parse: [] } };
}

function embedProbabilidades(idioma, cfg = null) {
    const e = new EmbedBuilder().setColor('#a855f7').setTitle(t(idioma, '🎁 Cofres de mascotas', '🎁 Pet chests'))
        .setDescription(t(idioma, `Tus compañeros en este servidor. Lleva uno equipado para tener sus ventajas. Los repetidos suben estrellas (hasta 5). Cada ${K.PIEDAD} cofres sin épica, el siguiente la trae segura.`, `Your companions on this server. Equip one to get its perks. Duplicates add stars (up to 5). Every ${K.PIEDAD} chests without an epic, the next one guarantees it.`));
    for (const [, c] of Object.entries(K.COFRES)) {
        e.addFields({ name: `${c.emoji} ${t(idioma, c.es, c.en)} · 🪙 ${fmt(c.precio, idioma)}`, value: Object.entries(c.prob).filter(([, p]) => p > 0).map(([r, p]) => `${rarezaTxt(r, idioma)} ${p} %`).join(' · '), inline: false });
    }
    if (cfg?.compis?.anime) {
        const n = K.idsAnime(cfg.compis.animeFuera || []).length;
        e.addFields({ name: t(idioma, '🃏 Cartas de anime', '🃏 Anime cards'), value: t(idioma, `Los personajes de anime (${n} aquí) no salen en los cofres: son **cartas** que potencian a tu mascota. Se consiguen en sobres con \`/carta abrir\`.`, `Anime characters (${n} here) don’t drop from chests: they’re **cards** that power up your pet. Get them in packs with \`/card open\`.`) });
    }
    e.addFields({ name: t(idioma, '✨ Ventajas por rareza', '✨ Perks by rarity'), value: Object.keys(K.RAREZAS).map((r) => `${rarezaTxt(r, idioma)}: ${textoVentajas({ xp: K.RAREZAS[r].xp, diario: K.RAREZAS[r].diario, vuelta: K.RAREZAS[r].vuelta }, idioma)}`).join('\n') });
    return e;
}

async function manejar(interaction, client) {
    const id = interaction.customId || '';
    if (!id.startsWith('cof_')) return false;
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    if (interaction.isButton() && id.startsWith('cof_diez:')) {
        await interaction.deferReply();
        const r = await abrirDiez({ interaction, cfg, idioma, cofre: id.split(':')[1] });
        if (r.error) { await interaction.deleteReply().catch(() => {}); await interaction.followUp({ content: `❌ ${r.error}`, flags: 64 }); }
        return true;
    }
    if (interaction.isButton() && id.startsWith('cof_otro:')) {
        await interaction.deferReply();
        const r = await abrir({ interaction, client, cfg, idioma, cofre: id.split(':')[1] });
        if (r.error) await interaction.editReply({ content: `❌ ${r.error}` });
        return true;
    }
    if ((interaction.isButton() && id.startsWith('cof_eq:')) || (interaction.isStringSelectMenu() && id === 'cof_sel')) {
        const comp = interaction.isStringSelectMenu() ? interaction.values[0] : id.split(':')[1];
        const ok = await equipar(interaction.guildId, interaction.user.id, comp);
        await interaction.reply({ content: ok ? t(idioma, `✅ Ahora te acompaña ${K.def(comp).emoji} **${nombre(comp, idioma)}**.`, `✅ ${K.def(comp).emoji} **${nombre(comp, idioma)}** is now with you.`) : t(idioma, 'Ese compañero no es tuyo.', 'That companion isn’t yours.'), flags: 64 });
        return true;
    }
    return false;
}

// Para el panel: aperturas del servidor y cuántas divinas hay en el mundo.
async function resumenServidor(client, guildId) {
    const guild = client.guilds.cache.get(guildId);
    const persona = (id) => { const m = guild?.members.cache.get(id); return { id, nombre: m?.displayName || id, avatar: m?.user.displayAvatarURL({ size: 64 }) || null }; };
    const [ultimas, porRareza, divinasMundo, abiertos] = await Promise.all([
        AperturaCofre.find({ guildId, rareza: { $in: ['epica', 'legendaria', 'mitica', 'divina'] } }).sort({ fecha: -1 }).limit(12).lean(),
        AperturaCofre.aggregate([{ $match: { guildId } }, { $group: { _id: '$rareza', n: { $sum: 1 } } }]),
        ColeccionMascotas.countDocuments({ 'mascotas.id': 'celestial' }),
        AperturaCofre.countDocuments({ guildId }),
    ]);
    return {
        abiertos, divinasMundo,
        porRareza: Object.fromEntries(porRareza.map((x) => [x._id, x.n])),
        ultimas: ultimas.map((a) => ({ ...persona(a.userId), cofre: a.cofre, companero: a.companero, rareza: a.rareza, fecha: a.fecha,
            ...(K.esExtra(a.companero) ? { custom: { nombre: K.def(a.companero).es, imagen: K.def(a.companero).imagen, serie: K.def(a.companero).serie || null } } : {}) })),
    };
}

module.exports = { abrirDiez, historial, textoPiedad, extrasDe, quitadosDe, ventajasUsuario, abrir, equipar, verColeccion, embedProbabilidades, manejar, resumenServidor, textoVentajas, olvidar };
