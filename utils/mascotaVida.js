// Mascota 1.15.0 — la parte de Discord de lo nuevo: entrenar, la tienda (comidas,
// accesorios, hábitats), hablar con ella, el diario, los logros y las sorpresas en
// su canal. Las reglas puras están en utils/mascotaExtras.js.
const crypto = require('crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const Mascota = require('../models/Mascota.js');
const CuidadoMascota = require('../models/CuidadoMascota.js');
const N = require('./mascotaNucleo.js');
const X = require('./mascotaExtras.js');
const { t } = require('./i18n.js');

const nombreArt = (a, idioma) => (a ? `${a.emoji || ''} ${t(idioma, a.es, a.en)}`.trim() : '?');
const sinMascota = (idioma) => ({ error: t(idioma, 'Todavía no hay mascota (o sigue en el huevo).', 'There’s no pet yet (or it’s still an egg).') });

// Apunta un recuerdo en el diario (se guardan los últimos MAX_DIARIO).
async function recordar(guildId, tipo, datos = {}) {
    await Mascota.updateOne({ guildId }, { $push: { diario: { $each: [{ tipo, fecha: new Date(), datos }], $slice: -X.MAX_DIARIO } } }).catch(() => {});
}

// Logros nuevos: se guardan, se apuntan, se anuncian y, si es «Leyenda», regala la corona.
async function comprobarLogros(client, cfg, m) {
    if (!m || m.estado !== 'viva') return [];
    const nuevos = X.logrosNuevos(m);
    if (!nuevos.length) return [];
    const r = await Mascota.findOneAndUpdate({ _id: m._id }, { $addToSet: { logros: { $each: nuevos } } }, { returnDocument: 'before' });
    const yaTenia = new Set((r && r.logros) || []);
    const reales = nuevos.filter((id) => !yaTenia.has(id));
    for (const id of reales) {
        const l = X.LOGROS.find((x) => x.id === id);
        await recordar(m.guildId, 'logro', { id, es: l.es, en: l.en });
        if (id === 'leyenda') await Mascota.updateOne({ _id: m._id }, { $addToSet: { accesorios: 'corona' } });
        if (client && cfg && cfg.mascota?.avisos !== false) {
            const { enviarAlCanal } = require('./mascota.js');
            await enviarAlCanal(client, cfg, { content: t(cfg, `🏆 **¡Logro desbloqueado!** ${l.emoji} **${l.es}** — ${m.nombre}${id === 'leyenda' ? ' y se ha ganado la 👑 corona legendaria.' : '.'}`, `🏆 **Achievement unlocked!** ${l.emoji} **${l.en}** — ${m.nombre}${id === 'leyenda' ? ' earned the 👑 legendary crown.' : '.'}`) });
        }
    }
    return reales;
}

// ---------------------------------------------------------------------------
// Entrenar
// ---------------------------------------------------------------------------
async function entrenar(client, cfg, guildId, userId, stat, idioma) {
    const m = await Mascota.findOne({ guildId, estado: 'viva' });
    if (!m) return sinMascota(idioma);
    if (m.hibernando) return { error: t(idioma, `**${m.nombre}** está hibernando: despiértala con \`/comunidad mascota alimentar\`.`, `**${m.nombre}** is hibernating: wake it up with \`/community pet feed\`.`) };
    const mes = N.mesClave();
    await CuidadoMascota.updateOne({ guildId, userId, mes }, { $setOnInsert: { puntos: 0 } }, { upsert: true }).catch(() => {});
    const doc = await CuidadoMascota.findOne({ guildId, userId, mes }).lean();
    if (doc?.ultimoEntreno && Date.now() - new Date(doc.ultimoEntreno).getTime() < X.HORAS_ENTRENO * 3600000) {
        const vuelve = Math.floor((new Date(doc.ultimoEntreno).getTime() + X.HORAS_ENTRENO * 3600000) / 1000);
        return { error: t(idioma, `Ya has entrenado con ella hace poco. Vuelve <t:${vuelve}:R>.`, `You trained with it recently. Come back <t:${vuelve}:R>.`) };
    }
    const r = X.entrenar(m, stat);
    if (r.fallo === 'energia') return { error: t(idioma, `**${m.nombre}** está agotada (energía ${m.energia}%). Necesita ${X.ENERGIA_ENTRENO}%: descansa sola o con un ⚡ batido de la tienda.`, `**${m.nombre}** is exhausted (energy ${m.energia}%). It needs ${X.ENERGIA_ENTRENO}%: it rests on its own or with an ⚡ energy shake from the shop.`) };
    if (r.fallo === 'maximo') return { error: t(idioma, `Su ${X.STATS[stat].es.toLowerCase()} ya está al máximo.`, `Its ${X.STATS[stat].en.toLowerCase()} is already maxed.`) };
    if (r.fallo) return { error: t(idioma, 'No se puede entrenar eso.', 'That can’t be trained.') };
    // Puerta: la energía no ha cambiado desde que la leímos (dos entrenos a la vez no la dejan en negativo).
    const xp = N.sumarXp(m.nivel, m.xp, 8);
    const nuevo = await Mascota.findOneAndUpdate(
        { _id: m._id, energia: { $gte: X.ENERGIA_ENTRENO } },
        { $inc: { [`stats.${stat}`]: r.sube, energia: -X.ENERGIA_ENTRENO, 'contadores.entrenos': 1 }, $set: { nivel: xp.nivel, xp: xp.xp } },
        { returnDocument: 'after' },
    );
    if (!nuevo) return { error: t(idioma, `**${m.nombre}** está agotada.`, `**${m.nombre}** is exhausted.`) };
    if (nuevo.stats[stat] > X.STAT_MAX) await Mascota.updateOne({ _id: m._id }, { $set: { [`stats.${stat}`]: X.STAT_MAX } });
    await CuidadoMascota.updateOne({ guildId, userId, mes }, { $set: { ultimoEntreno: new Date() }, $inc: { puntos: 4 } });
    require('./mascota.js').ponerCache(nuevo);
    await comprobarLogros(client, cfg, nuevo);
    return { ok: true, m: nuevo, ...r };
}

// ---------------------------------------------------------------------------
// Tienda
// ---------------------------------------------------------------------------
function embedTienda(m, idioma) {
    const linea = (id, a) => {
        const tiene = (m.accesorios || []).includes(id) || (m.habitats || []).includes(id);
        const precio = a.soloLogro ? t(idioma, '🏆 logro «Leyenda»', '🏆 “Legend” achievement') : a.precio ? `🪙 ${a.precio}` : t(idioma, 'gratis', 'free');
        return `${a.emoji || '🏞️'} **${t(idioma, a.es, a.en)}** · ${tiene ? t(idioma, '✅ ya lo tiene', '✅ owned') : precio}`;
    };
    const efecto = (c) => Object.entries(c.efecto).map(([k, v]) => `+${v} ${{ hambre: '🍖', alegria: '😊', salud: '❤️', energia: '⚡' }[k]}`).join(' ');
    return new EmbedBuilder()
        .setColor('#f59e0b')
        .setTitle(t(idioma, `🛍️ Tienda de ${m.nombre}`, `🛍️ ${m.nombre}’s shop`))
        .setDescription(t(idioma, 'Lo compras con tu oro y es para la mascota de todo el servidor. Elige abajo.', 'You buy it with your gold and it’s for the whole server’s pet. Pick below.'))
        .addFields(
            { name: t(idioma, '🍽️ Comida (se come al momento)', '🍽️ Food (eaten right away)'), value: Object.entries(X.COMIDAS).map(([, c]) => `${c.emoji} **${t(idioma, c.es, c.en)}** · 🪙 ${c.precio} · ${efecto(c)}`).join('\n') },
            { name: t(idioma, '🎩 Accesorios (para siempre)', '🎩 Accessories (forever)'), value: Object.entries(X.ACCESORIOS).map(([id, a]) => linea(id, a)).join('\n') },
            { name: t(idioma, '🏞️ Hábitats (su fondo)', '🏞️ Habitats (its background)'), value: Object.entries(X.HABITATS).map(([id, a]) => linea(id, a)).join('\n') },
        );
}
function menuTienda(m, idioma) {
    const opciones = [
        ...Object.entries(X.COMIDAS).map(([id, c]) => ({ label: `${t(idioma, c.es, c.en)} · ${c.precio}`, value: id, emoji: c.emoji, description: t(idioma, 'Comida', 'Food') })),
        ...Object.entries(X.ACCESORIOS).filter(([id, a]) => !a.soloLogro && !(m.accesorios || []).includes(id)).map(([id, a]) => ({ label: `${t(idioma, a.es, a.en)} · ${a.precio}`, value: id, emoji: a.emoji, description: t(idioma, 'Accesorio', 'Accessory') })),
        ...Object.entries(X.HABITATS).filter(([id, h]) => h.precio > 0 && !(m.habitats || []).includes(id)).map(([id, h]) => ({ label: `${t(idioma, h.es, h.en)} · ${h.precio}`, value: id, emoji: '🏞️', description: t(idioma, 'Hábitat', 'Habitat') })),
    ].slice(0, 25);
    return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('mas_comprar').setPlaceholder(t(idioma, '🛒 Comprar…', '🛒 Buy…')).addOptions(opciones));
}

async function comprar(client, cfg, guildId, userId, id, idioma, quien = null) {
    const a = X.articulo(id);
    if (!a) return { error: t(idioma, 'Eso no está en la tienda.', 'That isn’t in the shop.') };
    const m = await Mascota.findOne({ guildId, estado: 'viva' });
    if (!m) return sinMascota(idioma);
    const economia = require('./economia.js').en(guildId);
    if (a.tipo === 'comida') {
        const r = X.aplicarComida(m, id);
        if (r.fallo === 'llena') return { error: t(idioma, `A **${m.nombre}** no le hace falta ahora: lo tiene todo al máximo.`, `**${m.nombre}** doesn’t need it right now: everything is maxed.`) };
        const saldo = await economia.cobrar(userId, a.precio);
        if (saldo === null) return { error: t(idioma, `No tienes 🪙 ${a.precio}.`, `You don’t have 🪙 ${a.precio}.`) };
        const xp = N.sumarXp(m.nivel, m.xp, r.xp);
        const set = { ...r.cambio, nivel: xp.nivel, xp: xp.xp };
        const desperto = m.hibernando && (set.hambre ?? m.hambre) >= 30;
        if (desperto) { set.hibernando = false; set.hibernaDesde = null; }
        const nuevo = await Mascota.findOneAndUpdate({ _id: m._id }, { $set: set, $inc: { 'contadores.comida': a.precio, ...(desperto ? { 'contadores.despertares': 1 } : {}) } }, { returnDocument: 'after' });
        await CuidadoMascota.updateOne({ guildId, userId, mes: N.mesClave() }, { $inc: { puntos: Math.ceil(a.precio / 20), oro: a.precio } }, { upsert: true });
        if (desperto) await recordar(guildId, 'despierta', { quien: quien || null });
        require('./mascota.js').ponerCache(nuevo);
        await comprobarLogros(client, cfg, nuevo);
        return { ok: true, m: nuevo, articulo: a, saldo, desperto };
    }
    const campo = a.tipo === 'accesorio' ? 'accesorios' : 'habitats';
    const puesto = a.tipo === 'accesorio' ? 'accesorio' : 'habitat';
    if ((m[campo] || []).includes(id)) return { error: t(idioma, 'Ya lo tiene. Póselo con `/comunidad mascota vestir`.', 'It already has it. Equip it with `/community pet dress`.') };
    if (a.soloLogro) return { error: t(idioma, 'Esto no se compra: se gana con un logro.', 'This can’t be bought: it’s earned with an achievement.') };
    const saldo = await economia.cobrar(userId, a.precio);
    if (saldo === null) return { error: t(idioma, `No tienes 🪙 ${a.precio}.`, `You don’t have 🪙 ${a.precio}.`) };
    const nuevo = await Mascota.findOneAndUpdate({ _id: m._id, [campo]: { $ne: id } }, { $push: { [campo]: id }, $set: { [puesto]: id } }, { returnDocument: 'after' });
    if (!nuevo) { await economia.darOro(userId, a.precio); return { error: t(idioma, 'Alguien lo acaba de comprar.', 'Someone just bought it.') }; }
    await CuidadoMascota.updateOne({ guildId, userId, mes: N.mesClave() }, { $inc: { puntos: Math.ceil(a.precio / 25), oro: a.precio } }, { upsert: true });
    await recordar(guildId, puesto, { id, es: t('es', a.es, a.en), en: a.en, quien: quien || null });
    require('./mascota.js').ponerCache(nuevo);
    await comprobarLogros(client, cfg, nuevo);
    return { ok: true, m: nuevo, articulo: a, saldo };
}

// Ponerle (o quitarle) algo que ya tiene. `id` null = quitar el accesorio.
async function vestir(guildId, tipo, id) {
    const m = await Mascota.findOne({ guildId, estado: 'viva' });
    if (!m) return { fallo: 'sin' };
    if (tipo === 'accesorio') {
        if (id && !(m.accesorios || []).includes(id)) return { fallo: 'noTiene' };
        return { ok: true, m: await Mascota.findOneAndUpdate({ _id: m._id }, { $set: { accesorio: id || null } }, { returnDocument: 'after' }) };
    }
    if (!id || !(m.habitats || []).includes(id)) return { fallo: 'noTiene' };
    return { ok: true, m: await Mascota.findOneAndUpdate({ _id: m._id }, { $set: { habitat: id } }, { returnDocument: 'after' }) };
}

// ---------------------------------------------------------------------------
// Hablar, diario y logros
// ---------------------------------------------------------------------------
async function hablar(guildId, idioma) {
    const m = await Mascota.findOne({ guildId, estado: 'viva' }).lean();
    if (!m) return sinMascota(idioma);
    const recuerdos = (m.diario || []).filter((x) => ['nacio', 'forma', 'logro', 'cuidador', 'racha'].includes(x.tipo));
    const recuerdo = recuerdos.length && Math.random() < 0.35 ? X.textoRecuerdo(recuerdos[Math.floor(Math.random() * recuerdos.length)], idioma) : null;
    return { ok: true, m, texto: X.frase(m, idioma, Math.random, recuerdo) };
}

function embedDiario(m, idioma) {
    const lineas = [...(m.diario || [])].reverse().slice(0, 15).map((r) => `<t:${Math.floor(new Date(r.fecha).getTime() / 1000)}:d> ${X.textoRecuerdo(r, idioma)}`);
    const logros = X.LOGROS.map((l) => `${(m.logros || []).includes(l.id) ? l.emoji : '🔒'} ${t(idioma, l.es, l.en)}`);
    return new EmbedBuilder()
        .setColor('#a78bfa')
        .setTitle(t(idioma, `📖 Diario de ${m.nombre}`, `📖 ${m.nombre}’s diary`))
        .setDescription(lineas.join('\n') || t(idioma, 'Todavía no ha pasado nada que contar.', 'Nothing to tell yet.'))
        .addFields({ name: t(idioma, `🏆 Logros (${(m.logros || []).length}/${X.LOGROS.length})`, `🏆 Achievements (${(m.logros || []).length}/${X.LOGROS.length})`), value: logros.join('\n').slice(0, 1024) });
}

// ---------------------------------------------------------------------------
// Sorpresas en el canal
// ---------------------------------------------------------------------------
function mensajeEvento(m, ev, idioma) {
    const n = m.nombre;
    const fin = Math.floor(new Date(ev.expira).getTime() / 1000);
    const textos = {
        tesoro: [t(idioma, `⛏️ **${n}** ha desenterrado algo brillante… ¡El primero que lo coja se lo queda! (🪙 ${ev.premio})`, `⛏️ **${n}** dug up something shiny… First to grab it keeps it! (🪙 ${ev.premio})`), [{ id: 'coger', e: '💰', l: t(idioma, '¡Cógelo!', 'Grab it!') }]],
        perdida: [t(idioma, `😟 **${n}** se ha perdido persiguiendo una mariposa… ¿Quién la encuentra? Si nadie la busca, se pondrá triste.`, `😟 **${n}** got lost chasing a butterfly… Who can find it? If nobody looks, it’ll get sad.`), [{ id: 'buscar', e: '🔦', l: t(idioma, 'Buscarla', 'Find it') }]],
        adivina: [t(idioma, `🤔 **${n}** está pensando un número del 1 al 5. Quien lo acierte primero gana 🪙 ${ev.premio}. ¡Solo un intento por persona!`, `🤔 **${n}** is thinking of a number from 1 to 5. First to guess it wins 🪙 ${ev.premio}. One try each!`), [1, 2, 3, 4, 5].map((x) => ({ id: String(x), e: null, l: String(x) }))],
    }[ev.tipo];
    const fila = new ActionRowBuilder().addComponents(textos[1].map((b) => {
        const btn = new ButtonBuilder().setCustomId(`mas_ev:${ev.id}:${b.id}`).setLabel(b.l).setStyle(ev.tipo === 'adivina' ? ButtonStyle.Secondary : ButtonStyle.Success);
        if (b.e) btn.setEmoji(b.e);
        return btn;
    }));
    return { content: `${textos[0]}\n-# ${t(idioma, `Se acaba <t:${fin}:R>`, `Ends <t:${fin}:R>`)}`, components: [fila] };
}

async function lanzarEvento(client, cfg, m, ahora = new Date()) {
    const base = X.eventoAlAzar();
    const ev = { id: crypto.randomBytes(5).toString('hex'), ...base, expira: new Date(ahora.getTime() + X.MIN_EVENTO[base.tipo] * 60000), resuelto: false, fallos: [] };
    const r = await Mascota.updateOne({ _id: m._id, $or: [{ 'evento.id': null }, { 'evento.resuelto': true }] }, { $set: { evento: ev, ultimoEvento: ahora } });
    if (!r.modifiedCount) return null;
    const { enviarAlCanal } = require('./mascota.js');
    const msg = await enviarAlCanal(client, cfg, mensajeEvento(m, ev, cfg));
    if (msg) await Mascota.updateOne({ _id: m._id, 'evento.id': ev.id }, { $set: { 'evento.canalId': msg.channelId, 'evento.mensajeId': msg.id } });
    return ev;
}

async function cerrarMensajeEvento(client, m, texto) {
    const guild = client.guilds.cache.get(m.guildId);
    const canal = guild && m.evento?.canalId ? guild.channels.cache.get(m.evento.canalId) : null;
    const msg = canal && m.evento.mensajeId ? await canal.messages.fetch(m.evento.mensajeId).catch(() => null) : null;
    if (msg) await msg.edit({ content: texto, components: [] }).catch(() => {});
}

// Sorpresa sin resolver que ya ha caducado.
async function caducarEvento(client, cfg, m) {
    const r = await Mascota.findOneAndUpdate({ _id: m._id, 'evento.id': m.evento.id, 'evento.resuelto': false }, { $set: { 'evento.resuelto': true } }, { returnDocument: 'after' });
    if (!r) return;
    let texto = t(cfg, '⌛ Se acabó: nadie llegó a tiempo.', '⌛ Time’s up: nobody made it.');
    if (m.evento.tipo === 'perdida') {
        await Mascota.updateOne({ _id: m._id }, [{ $set: { alegria: { $max: [0, { $subtract: ['$alegria', 10] }] } } }], { updatePipeline: true });
        texto = t(cfg, `😢 Nadie buscó a **${m.nombre}**. Volvió sola, pero un poco triste.`, `😢 Nobody looked for **${m.nombre}**. It came back alone, a bit sad.`);
    } else if (m.evento.tipo === 'adivina') {
        texto = t(cfg, `⌛ Nadie lo acertó: era el **${m.evento.respuesta}**.`, `⌛ Nobody guessed it: it was **${m.evento.respuesta}**.`);
    }
    await cerrarMensajeEvento(client, m, texto);
}

async function pasadaEventos(client, cfg, m, ahora = new Date()) {
    if (m.evento?.id && !m.evento.resuelto && m.evento.expira && new Date(m.evento.expira) <= ahora) {
        await caducarEvento(client, cfg, m);
        return;
    }
    const porDia = cfg.mascota?.eventos === false ? 0 : (cfg.mascota?.eventosPorDia ?? 2);
    if (X.tocaEvento(m, porDia, ahora)) await lanzarEvento(client, cfg, m, ahora);
}

async function responderEvento(interaction, client, cfg, idioma) {
    const [, evId, opcion] = interaction.customId.split(':');
    const uid = interaction.user.id;
    const m = await Mascota.findOne({ guildId: interaction.guildId, 'evento.id': evId });
    if (!m || m.evento.resuelto || new Date(m.evento.expira) <= new Date()) {
        return interaction.reply({ content: t(idioma, '⌛ Esta sorpresa ya ha terminado.', '⌛ This surprise is already over.'), flags: 64 });
    }
    if (m.evento.tipo === 'adivina') {
        if ((m.evento.fallos || []).includes(uid)) return interaction.reply({ content: t(idioma, 'Ya has probado: ¡un intento por persona!', 'You already tried: one try each!'), flags: 64 });
        if (parseInt(opcion, 10) !== m.evento.respuesta) {
            await Mascota.updateOne({ _id: m._id, 'evento.id': evId }, { $addToSet: { 'evento.fallos': uid } });
            return interaction.reply({ content: t(idioma, `❌ No era el ${opcion}. ¡Mala suerte!`, `❌ It wasn’t ${opcion}. Bad luck!`), flags: 64 });
        }
    }
    // El primero que llega (puerta atómica).
    const gana = await Mascota.findOneAndUpdate({ _id: m._id, 'evento.id': evId, 'evento.resuelto': false }, { $set: { 'evento.resuelto': true }, $inc: { 'contadores.eventos': 1 } }, { returnDocument: 'after' });
    if (!gana) return interaction.reply({ content: t(idioma, '¡Uy! Alguien ha sido más rápido.', 'Oops! Someone was faster.'), flags: 64 });
    const economia = require('./economia.js').en(m.guildId);
    const premio = m.evento.tipo === 'perdida' ? 50 : m.evento.premio;
    await economia.darOro(uid, premio);
    await CuidadoMascota.updateOne({ guildId: m.guildId, userId: uid, mes: N.mesClave() }, { $inc: { puntos: m.evento.tipo === 'perdida' ? 15 : 5 } }, { upsert: true });
    if (m.evento.tipo === 'perdida') await Mascota.updateOne({ _id: m._id }, [{ $set: { alegria: { $min: [100, { $add: ['$alegria', 10] }] } } }], { updatePipeline: true });
    const nombre = interaction.member?.displayName || interaction.user.username;
    const textos = {
        tesoro: [`💰 **${nombre}** se ha llevado el tesoro de ${m.nombre}: 🪙 ${premio}.`, `💰 **${nombre}** grabbed ${m.nombre}’s treasure: 🪙 ${premio}.`],
        perdida: [`🔦 **${nombre}** ha encontrado a ${m.nombre} escondida detrás de un árbol. ¡Qué alegría! (+🪙 ${premio})`, `🔦 **${nombre}** found ${m.nombre} hiding behind a tree. So happy! (+🪙 ${premio})`],
        adivina: [`🎯 **${nombre}** lo ha acertado: era el **${m.evento.respuesta}** (🪙 ${premio}).`, `🎯 **${nombre}** guessed it: it was **${m.evento.respuesta}** (🪙 ${premio}).`],
    }[m.evento.tipo];
    await interaction.update({ content: t(cfg, textos[0], textos[1]), components: [], allowedMentions: { parse: [] } }).catch(() => {});
    await recordar(m.guildId, 'evento', { es: textos[0].replace(/\*\*/g, ''), en: textos[1].replace(/\*\*/g, '') });
    await comprobarLogros(client, cfg, gana);
    return true;
}

module.exports = {
    recordar, comprobarLogros, entrenar, embedTienda, menuTienda, comprar, vestir, hablar, embedDiario,
    mensajeEvento, lanzarEvento, caducarEvento, pasadaEventos, responderEvento, nombreArt,
};
