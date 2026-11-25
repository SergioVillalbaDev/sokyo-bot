// 🥚 Guardería de compañeros (1.33.0). Reglas en utils/compisNucleo.js (CRIA, rarezaCria…).
// `/mascotas guarderia` (o «🥚 Guardería» en el menú de /compi) abre en privado: dos desplegables para elegir los padres
// (grd_a:<dueño>, grd_b:<dueño>), «Criar» (grd_criar:<dueño>) y los huevos que tienes (grd_abrir:<dueño>:<uid>
// cuando ya están listos). Lo que sale del huevo entra en la colección como en un cofre (nuevo o ★).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const crypto = require('crypto');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');
const { t } = require('./i18n.js');

const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const nombre = (m, idioma) => m.apodo || t(idioma, K.def(m.id).es, K.def(m.id).en).split(',')[0];
const rz = (r, idioma) => `${K.RAREZAS[r].emoji} ${t(idioma, K.RAREZAS[r].es, K.RAREZAS[r].en)}`;
const elegidos = new Map(); // dueño:servidor → { a, b }
const clave = (guildId, userId) => `${guildId}:${userId}`;

async function vista(guildId, userId, idioma, aviso = '') {
    const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
    const ahora = Date.now();
    const mascotas = col?.mascotas || [];
    const sel = elegidos.get(clave(guildId, userId)) || {};
    const a = mascotas.find((m) => m.id === sel.a); const b = mascotas.find((m) => m.id === sel.b);
    const huevos = col?.huevos || [];
    const e = new EmbedBuilder().setColor('#f59e0b').setTitle(t(idioma, '🥚 Guardería', '🥚 Nursery'))
        .setDescription([
            aviso,
            t(idioma, `Elige **dos compañeros de nivel ${P.CRIA.nivel} o más** y tendrán un huevo. Sale de la rareza del mejor de los dos y **a veces una más** (más fácil si los dos son de la misma rareza). El huevo se abre a las **${P.CRIA.incubarH} h** y los padres descansan **${P.CRIA.descansoH / 24} días**.`,
                `Pick **two companions at level ${P.CRIA.nivel} or higher** and they’ll have an egg. It hatches at the better parent’s rarity and **sometimes one higher** (likelier if both share a rarity). The egg hatches in **${P.CRIA.incubarH} h** and the parents rest for **${P.CRIA.descansoH / 24} days**.`),
            t(idioma, `✨ Si uno de los padres es brillante, es más fácil que el bebé brille (1 de ${Math.round(1 / P.CRIA.brillantePadre)} en vez de 1 de ${Math.round(1 / P.CRIA.brillante)}).`, `✨ If a parent is shiny, the baby is likelier to shine (1 in ${Math.round(1 / P.CRIA.brillantePadre)} instead of 1 in ${Math.round(1 / P.CRIA.brillante)}).`),
        ].filter(Boolean).join('\n\n'));
    if (huevos.length) {
        e.addFields({ name: t(idioma, `Tus huevos (${huevos.length}/${P.CRIA.maxHuevos})`, `Your eggs (${huevos.length}/${P.CRIA.maxHuevos})`), value: huevos.map((h) => {
            const listo = new Date(h.listo).getTime() <= ahora;
            const padres = h.padres.map((id) => K.def(id).emoji).join(' + ');
            return `🥚 ${rz(h.rareza, idioma)} · ${padres} · ${listo ? t(idioma, '**¡listo para abrir!**', '**ready to hatch!**') : t(idioma, `se abre <t:${Math.floor(new Date(h.listo).getTime() / 1000)}:R>`, `hatches <t:${Math.floor(new Date(h.listo).getTime() / 1000)}:R>`)}`;
        }).join('\n') });
    }
    const filas = [];
    const opciones = (otro) => mascotas
        .filter((m) => m.id !== otro)
        .sort((x, y) => P.nivel(y.afinidad || 0) - P.nivel(x.afinidad || 0) || K.RAREZAS[K.def(y.id).rareza].orden - K.RAREZAS[K.def(x.id).rareza].orden)
        .slice(0, 25)
        .map((m) => {
            const motivo = P.motivoNoCria(m, ahora);
            const txtMotivo = motivo === 'nivel' ? t(idioma, `necesita nivel ${P.CRIA.nivel}`, `needs level ${P.CRIA.nivel}`)
                : motivo === 'descansa' ? t(idioma, 'descansando', 'resting') : motivo === 'fuera' ? t(idioma, 'de expedición', 'on an expedition') : t(idioma, 'puede criar', 'can breed');
            return { value: m.id, emoji: K.def(m.id).emoji, label: `${nombre(m, idioma)} ${'★'.repeat(m.estrellas || 1)}`.slice(0, 100), description: `${motivo ? '⛔' : '✅'} ${t(idioma, 'nivel', 'level')} ${P.nivel(m.afinidad || 0)} · ${t(idioma, K.RAREZAS[K.def(m.id).rareza].es, K.RAREZAS[K.def(m.id).rareza].en)} · ${txtMotivo}`.slice(0, 100), default: false };
        });
    const opsA = opciones(sel.b).map((o) => ({ ...o, default: o.value === sel.a }));
    const opsB = opciones(sel.a).map((o) => ({ ...o, default: o.value === sel.b }));
    if (opsA.length) filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`grd_a:${userId}`).setPlaceholder(t(idioma, '1.º padre…', '1st parent…')).addOptions(opsA)));
    if (opsB.length) filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`grd_b:${userId}`).setPlaceholder(t(idioma, '2.º padre…', '2nd parent…')).addOptions(opsB)));
    const botones = [];
    if (a && b) {
        const coste = P.costeCria(a, b);
        const ok = !P.motivoNoCria(a, ahora) && !P.motivoNoCria(b, ahora) && huevos.length < P.CRIA.maxHuevos;
        botones.push(new ButtonBuilder().setCustomId(`grd_criar:${userId}`).setEmoji('💞').setStyle(ButtonStyle.Success).setDisabled(!ok)
            .setLabel(t(idioma, `Criar (🪙 ${fmt(coste, idioma)})`, `Breed (🪙 ${fmt(coste, idioma)})`)));
        const r1 = P.rarezaPadre(a); const r2 = P.rarezaPadre(b);
        const base = K.RAREZAS[r1].orden >= K.RAREZAS[r2].orden ? r1 : r2;
        e.addFields({ name: t(idioma, 'Si crías a estos dos', 'If you breed these two'), value: t(idioma, `${K.def(a.id).emoji} + ${K.def(b.id).emoji} → huevo ${rz(base, idioma)}${base !== 'mitica' ? ` (${Math.round((r1 === r2 ? P.CRIA.subirIguales : P.CRIA.subir) * 100)} % de que sea mejor)` : ''}`, `${K.def(a.id).emoji} + ${K.def(b.id).emoji} → ${rz(base, idioma)} egg${base !== 'mitica' ? ` (${Math.round((r1 === r2 ? P.CRIA.subirIguales : P.CRIA.subir) * 100)}% chance of better)` : ''}`) });
    }
    for (const h of huevos.filter((x) => new Date(x.listo).getTime() <= ahora).slice(0, 4)) {
        botones.push(new ButtonBuilder().setCustomId(`grd_abrir:${userId}:${h.uid}`).setEmoji('🐣').setStyle(ButtonStyle.Primary).setLabel(t(idioma, `Abrir huevo ${t(idioma, K.RAREZAS[h.rareza].es, K.RAREZAS[h.rareza].en).toLowerCase()}`, `Hatch ${K.RAREZAS[h.rareza].en.toLowerCase()} egg`).slice(0, 80)));
    }
    if (botones.length) filas.push(new ActionRowBuilder().addComponents(botones.slice(0, 5)));
    if (!mascotas.length) e.setDescription(t(idioma, 'Aún no tienes compañeros. Consíguelos en los cofres: `/jugar cofre`.', 'You have no companions yet. Get them from chests: `/games chest`.'));
    return { embeds: [e], components: filas, files: [], attachments: [] };
}

// Cría: cobra, pone a descansar a los padres y deja un huevo. Todo o nada.
async function criar(guildId, userId, idioma, cfg) {
    const sel = elegidos.get(clave(guildId, userId)) || {};
    if (!sel.a || !sel.b || sel.a === sel.b) return { error: t(idioma, 'Elige dos compañeros distintos.', 'Pick two different companions.') };
    const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
    const a = col?.mascotas.find((m) => m.id === sel.a); const b = col?.mascotas.find((m) => m.id === sel.b);
    if (!a || !b) return { error: t(idioma, 'Ya no tienes uno de esos compañeros.', 'You no longer have one of those companions.') };
    const ahora = Date.now();
    for (const m of [a, b]) {
        const mot = P.motivoNoCria(m, ahora);
        if (mot) return { error: mot === 'nivel' ? t(idioma, `${nombre(m, idioma)} necesita nivel ${P.CRIA.nivel} (cuídalo con \`/compi\`).`, `${nombre(m, idioma)} needs level ${P.CRIA.nivel} (look after it with \`/companion\`).`) : mot === 'descansa' ? t(idioma, `${nombre(m, idioma)} está descansando: podrá <t:${Math.floor(new Date(m.criaHasta).getTime() / 1000)}:R>.`, `${nombre(m, idioma)} is resting: ready <t:${Math.floor(new Date(m.criaHasta).getTime() / 1000)}:R>.`) : t(idioma, `${nombre(m, idioma)} está de expedición.`, `${nombre(m, idioma)} is on an expedition.`) };
    }
    if ((col.huevos || []).length >= P.CRIA.maxHuevos) return { error: t(idioma, `Ya tienes ${P.CRIA.maxHuevos} huevos: abre alguno antes.`, `You already have ${P.CRIA.maxHuevos} eggs: hatch one first.`) };
    const coste = P.costeCria(a, b);
    const eco = require('./economia.js').en(guildId);
    if ((await eco.cobrar(userId, coste)) === null) return { error: t(idioma, `No tienes 🪙 ${fmt(coste, idioma)}.`, `You don’t have 🪙 ${fmt(coste, idioma)}.`) };
    const huevo = { uid: crypto.randomBytes(5).toString('hex'), rareza: P.rarezaCria(a, b, require('./casinoNucleo.js').azarSeguro), padres: [a.id, b.id], listo: new Date(ahora + P.CRIA.incubarH * 3600000), creado: new Date(ahora), brillo: P.probBrillanteCria(a, b) };
    const hasta = new Date(ahora + P.CRIA.descansoH * 3600000);
    // Solo si los dos siguen pudiendo criar y caben más huevos (dos clics a la vez: uno solo cría).
    const libre = { $or: [{ criaHasta: { $exists: false } }, { criaHasta: null }, { criaHasta: { $lte: new Date(ahora) } }] };
    const r = await ColeccionMascotas.updateOne(
        { _id: col._id, [`huevos.${P.CRIA.maxHuevos - 1}`]: { $exists: false }, mascotas: { $elemMatch: { id: a.id, ...libre } }, $and: [{ mascotas: { $elemMatch: { id: b.id, ...libre } } }] },
        { $push: { huevos: huevo }, $set: { 'mascotas.$[p].criaHasta': hasta }, $inc: { 'mascotas.$[p].hijos': 1, criados: 1 } },
        { arrayFilters: [{ 'p.id': { $in: [a.id, b.id] } }] },
    );
    if (!r.modifiedCount) { await eco.darOro(userId, coste); return { error: t(idioma, 'No se ha podido: prueba otra vez.', 'It didn’t work: try again.') }; }
    elegidos.delete(clave(guildId, userId));
    return { ok: true, huevo, coste, a, b };
}

// Abre un huevo listo: sale un compañero al azar de su rareza (nuevo o ★; con 5 ★, una parte del coste en oro).
async function eclosionar(guildId, userId, uid, idioma, cfg) {
    const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
    const h = (col?.huevos || []).find((x) => x.uid === uid);
    if (!h) return { error: t(idioma, 'Ese huevo ya no está.', 'That egg is gone.') };
    if (new Date(h.listo).getTime() > Date.now()) return { error: t(idioma, `Aún no: se abre <t:${Math.floor(new Date(h.listo).getTime() / 1000)}:R>.`, `Not yet: it hatches <t:${Math.floor(new Date(h.listo).getTime() / 1000)}:R>.`) };
    const C = require('./cofres.js');
    const azar = require('./casinoNucleo.js').azarSeguro;
    const id = K.companeroAlAzar(h.rareza, azar, C.extrasDe(guildId, cfg), C.quitadosDe(cfg));
    const previa = col.mascotas.find((m) => m.id === id);
    const brillante = previa?.variante !== 'brillante' && require('./sprites.js').tiene(id) && azar() < (h.brillo || P.CRIA.brillante);
    const estrellas = previa ? Math.min(K.MAX_ESTRELLAS, (previa.estrellas || 1) + 1) : 1;
    const devuelto = previa && (previa.estrellas || 1) >= K.MAX_ESTRELLAS ? Math.floor(P.CRIA.coste[h.rareza] * K.DEVOLUCION_REPETIDO) : 0;
    const upd = previa
        ? { $pull: { huevos: { uid } }, $set: { ...(estrellas !== previa.estrellas ? { 'mascotas.$[m].estrellas': estrellas } : {}), ...(brillante ? { 'mascotas.$[m].variante': 'brillante' } : {}) } }
        : { $pull: { huevos: { uid } }, $push: { mascotas: { id, estrellas: 1, primera: new Date(), actualizado: new Date(), ...(brillante ? { variante: 'brillante' } : {}) } }, ...(!col.equipada ? { $set: { equipada: id } } : {}) };
    if (upd.$set && !Object.keys(upd.$set).length) delete upd.$set;
    // El filtro por el huevo hace que dos clics no lo abran dos veces.
    const r = await ColeccionMascotas.updateOne({ _id: col._id, 'huevos.uid': uid, ...(previa ? {} : { 'mascotas.id': { $ne: id } }) }, upd, previa && upd.$set ? { arrayFilters: [{ 'm.id': id }] } : {});
    if (!r.modifiedCount) {
        const sigue = await ColeccionMascotas.exists({ _id: col._id, 'huevos.uid': uid });
        return { error: sigue ? t(idioma, 'No se ha podido abrir: prueba otra vez.', 'It couldn’t hatch: try again.') : t(idioma, 'Ese huevo ya se ha abierto.', 'That egg has already hatched.') };
    }
    if (devuelto) await require('./economia.js').en(guildId).darOro(userId, devuelto);
    C.olvidar(guildId, userId);
    const hitos = !previa ? await require('./granja.js').premiarHitos(guildId, userId).catch(() => []) : [];
    return { ok: true, id, nuevo: !previa, estrellas, brillante, devuelto, rareza: K.def(id).rareza, hitos };
}

async function manejar(interaction) {
    const id = interaction.customId || '';
    if (!id.startsWith('grd_')) return false;
    const [tipo, owner, uid] = id.split(':');
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    if (interaction.user.id !== owner) { await interaction.reply({ content: t(idioma, '🥚 Esta guardería no es tuya: abre la tuya con `/mascotas guarderia`.', '🥚 This nursery isn’t yours: open yours with `/pets nursery`.'), flags: 64 }); return true; }
    const k = clave(interaction.guildId, owner);
    if (tipo === 'grd_a' || tipo === 'grd_b') {
        const sel = elegidos.get(k) || {};
        sel[tipo === 'grd_a' ? 'a' : 'b'] = interaction.values[0];
        elegidos.set(k, sel);
        await interaction.update(await vista(interaction.guildId, owner, idioma));
        return true;
    }
    if (tipo === 'grd_criar') {
        await interaction.deferUpdate();
        const r = await criar(interaction.guildId, owner, idioma, cfg);
        const aviso = r.error ? `⚠️ ${r.error}` : t(idioma, `💞 **¡${nombre(r.a, idioma)} y ${nombre(r.b, idioma)} han tenido un huevo!** ${rz(r.huevo.rareza, idioma)} · se abre <t:${Math.floor(r.huevo.listo.getTime() / 1000)}:R> (−🪙 ${fmt(r.coste, idioma)}).`, `💞 **${nombre(r.a, idioma)} and ${nombre(r.b, idioma)} had an egg!** ${rz(r.huevo.rareza, idioma)} · hatches <t:${Math.floor(r.huevo.listo.getTime() / 1000)}:R> (−🪙 ${fmt(r.coste, idioma)}).`);
        await interaction.editReply(await vista(interaction.guildId, owner, idioma, aviso));
        return true;
    }
    if (tipo === 'grd_abrir') {
        await interaction.deferUpdate();
        const r = await eclosionar(interaction.guildId, owner, uid, idioma, cfg);
        if (r.error) { await interaction.editReply(await vista(interaction.guildId, owner, idioma, `⚠️ ${r.error}`)); return true; }
        const d = K.def(r.id);
        const nom = t(idioma, d.es, d.en);
        const gif = await require('./casinoArte.js').gifEclosion(r.id, { rareza: r.rareza, nombre: nom, rarezaTexto: `${r.brillante ? '✨ ' : ''}${t(idioma, K.RAREZAS[r.rareza].es, K.RAREZAS[r.rareza].en).toUpperCase()}`, nuevo: r.nuevo, estrellas: r.estrellas, textoNuevo: t(idioma, '¡NUEVO!', 'NEW!'), variante: r.brillante ? 'brillante' : null }).catch(() => null);
        const texto = [
            `||${d.emoji} ${nom} · ${rz(r.rareza, idioma)} · ${r.nuevo ? t(idioma, '🆕 ¡nuevo!', '🆕 new!') : r.devuelto ? t(idioma, `ya tenía 5 ★: +🪙 ${fmt(r.devuelto, idioma)}`, `already 5 ★: +🪙 ${fmt(r.devuelto, idioma)}`) : '★'.repeat(r.estrellas)}${r.brillante ? ' · ✨' : ''}||`,
            ...require('./granja.js').textoHitos(r.hitos || [], idioma),
        ].join('\n');
        const e = new EmbedBuilder().setColor(K.RAREZAS[r.rareza].color).setTitle(t(idioma, '🐣 ¡El huevo se abre!', '🐣 The egg hatches!')).setDescription(texto);
        if (gif) e.setImage('attachment://huevo.gif');
        // La eclosión se ve en el canal (es un momento para presumir); la guardería sigue en privado.
        await interaction.followUp({ content: `<@${owner}>`, embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'huevo.gif' })] : [], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`cmp:ver:${owner}:${r.id}`).setEmoji('🐾').setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Cuidarlo', 'Look after it')))], allowedMentions: { parse: [] } }).catch(() => {});
        await interaction.editReply(await vista(interaction.guildId, owner, idioma)).catch(() => {});
        return true;
    }
    return false;
}

module.exports = { vista, criar, eclosionar, manejar, elegidos };
