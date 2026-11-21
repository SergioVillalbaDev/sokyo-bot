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
const nombre = (id, idioma) => { const c = K.COMPANEROS[id]; return c ? t(idioma, c.es, c.en) : id; };
const rarezaTxt = (r, idioma) => `${K.RAREZAS[r].emoji} ${t(idioma, K.RAREZAS[r].es, K.RAREZAS[r].en)}`;
const pct = (v) => `+${Math.round(v * 1000) / 10} %`;

// Ventajas del compañero equipado (en memoria 60 s: las leen la XP, el diario y el casino).
const cache = new Map();
async function ventajasUsuario(userId) {
    const c = cache.get(userId);
    if (c && c.hasta > Date.now()) return c.v;
    const col = await ColeccionMascotas.findOne({ userId }).select('equipada mascotas').lean();
    const eq = col?.equipada ? (col.mascotas || []).find((m) => m.id === col.equipada) : null;
    const v = eq ? K.ventajas(eq.id, eq.estrellas) : { xp: 0, diario: 0, vuelta: 0 };
    cache.set(userId, { v, hasta: Date.now() + 60000 });
    return v;
}
const olvidar = (userId) => cache.delete(userId);
const coleccion = async (userId) => (await ColeccionMascotas.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, returnDocument: 'after' }));

function textoVentajas(v, idioma) {
    const partes = [];
    if (v.xp) partes.push(t(idioma, `✨ ${pct(v.xp)} de XP`, `✨ ${pct(v.xp)} XP`));
    if (v.diario) partes.push(t(idioma, `🪙 ${pct(v.diario)} en /diario`, `🪙 ${pct(v.diario)} on /daily`));
    if (v.vuelta) partes.push(t(idioma, `🎰 ${pct(v.vuelta)} de vuelta en el casino`, `🎰 ${pct(v.vuelta)} casino cashback`));
    return partes.join(' · ') || '—';
}

// Abre un cofre. Cobra, decide qué sale (con piedad), lo guarda y lo anima.
async function abrir({ interaction, client, cfg, idioma, cofre }) {
    if (cfg && (cfg.casino?.cofres === false || !cfg.casino?.activo)) return { error: t(idioma, '🎁 Los cofres no están activados en este servidor (panel → Diversión → Casino).', '🎁 Chests aren’t turned on on this server (panel → Fun → Casino).') };
    const def = K.COFRES[cofre];
    if (!def) return { error: t(idioma, 'Ese cofre no existe.', 'That chest doesn’t exist.') };
    const userId = interaction.user.id;
    const economia = require('./economia.js');
    const saldo = await economia.cobrar(userId, def.precio);
    if (saldo === null) return { error: t(idioma, `No tienes 🪙 ${fmt(def.precio, idioma)} para el ${def.es.toLowerCase()}.`, `You don’t have 🪙 ${fmt(def.precio, idioma)} for the ${def.en.toLowerCase()}.`) };
    // Se calcula sobre la colección y se guarda solo si nadie la ha tocado a la vez.
    let r; let col;
    for (let intento = 0; intento < 5; intento++) {
        col = await coleccion(userId);
        r = K.abrir(col, cofre);
        const tiene = (col.mascotas || []).some((m) => m.id === r.id);
        const upd = {
            $inc: { abiertos: 1, gastado: def.precio, ...(r.rareza === 'divina' ? { divinas: 1 } : {}) },
            $set: { sinEpica: r.sinEpica, ...(tiene ? { 'mascotas.$[m].estrellas': r.estrellas } : {}), ...(!col.equipada ? { equipada: r.id } : {}) },
            ...(tiene ? {} : { $push: { mascotas: { id: r.id, estrellas: 1, primera: new Date() } } }),
        };
        const hecho = await ColeccionMascotas.updateOne({ _id: col._id, abiertos: col.abiertos }, upd, tiene ? { arrayFilters: [{ 'm.id': r.id }] } : {});
        if (hecho.modifiedCount) break;
        r = null;
    }
    if (!r) { await economia.darOro(userId, def.precio); return { error: t(idioma, 'Prueba otra vez.', 'Try again.') }; }
    if (r.devuelto) await economia.darOro(userId, r.devuelto);
    olvidar(userId);
    await AperturaCofre.create({ guildId: interaction.guildId || null, userId, cofre, companero: r.id, rareza: r.rareza }).catch(() => {});
    const comp = K.COMPANEROS[r.id];
    const rz = K.RAREZAS[r.rareza];
    const gif = await A.gifCofre(cofre, r.id, { nombre: nombre(r.id, idioma), rarezaTexto: t(idioma, rz.es, rz.en).toUpperCase(), estrellas: r.estrellas, nuevo: r.nuevo }).catch(() => null);
    const e = new EmbedBuilder().setColor(def.color).setTitle(`${def.emoji} ${t(idioma, def.es, def.en)}`)
        .setDescription(t(idioma, `<@${userId}> abre un ${def.es.toLowerCase()}… 🥁`, `<@${userId}> opens a ${def.en.toLowerCase()}… 🥁`));
    if (gif) e.setImage('attachment://cofre.gif');
    await interaction.editReply({ embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'cofre.gif' })] : [], allowedMentions: { parse: [] } });
    await espera(gif ? (r.rareza === 'divina' ? 5200 : 4000) : 600);
    const v = K.ventajas(r.id, r.estrellas);
    const estado = r.nuevo
        ? t(idioma, '🆕 ¡Nuevo en tu colección!', '🆕 New in your collection!')
        : r.devuelto ? t(idioma, `Ya lo tenías con 5 ★: te devolvemos 🪙 ${fmt(r.devuelto, idioma)}.`, `You already had it at 5 ★: you get 🪙 ${fmt(r.devuelto, idioma)} back.`)
            : t(idioma, `Repetido: sube a **${'★'.repeat(r.estrellas)}**`, `Duplicate: now **${'★'.repeat(r.estrellas)}**`);
    const fin = EmbedBuilder.from(e).setColor(rz.color)
        .setDescription([
            r.rareza === 'divina' ? t(idioma, '🌈🌈🌈 **¡¡¡DIVINA!!!** 🌈🌈🌈', '🌈🌈🌈 **DIVINE!!!** 🌈🌈🌈') : '',
            `${comp.emoji} **${nombre(r.id, idioma)}** · ${rarezaTxt(r.rareza, idioma)}`,
            estado,
            r.piedad ? t(idioma, '🍀 ¡La suerte del décimo cofre! (épica asegurada)', '🍀 Tenth-chest luck! (epic guaranteed)') : '',
            t(idioma, `Si lo equipas: ${textoVentajas(v, idioma)}`, `If equipped: ${textoVentajas(v, idioma)}`),
        ].filter(Boolean).join('\n'))
        .setFooter({ text: t(idioma, `Te quedan 🪙 ${fmt(saldo + (r.devuelto || 0), idioma)} · ${col.abiertos + 1} cofres abiertos`, `You have 🪙 ${fmt(saldo + (r.devuelto || 0), idioma)} left · ${col.abiertos + 1} chests opened`) });
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cof_otro:${cofre}`).setEmoji(def.emoji).setStyle(ButtonStyle.Primary).setLabel(t(idioma, `Abrir otro (🪙 ${fmt(def.precio, idioma)})`, `Open another (🪙 ${fmt(def.precio, idioma)})`)),
        new ButtonBuilder().setCustomId(`cof_eq:${r.id}`).setEmoji('✅').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Equipar', 'Equip')),
    );
    await interaction.editReply({ embeds: [fin], components: [fila] });
    // Las legendarias o mejores se anuncian (y la divina, a lo grande).
    if (rz.orden >= 3 && cfg?.casino?.anunciosId) {
        const canal = interaction.guild?.channels.cache.get(cfg.casino.anunciosId);
        if (canal?.isTextBased() && canal.id !== interaction.channelId) {
            await canal.send({ content: r.rareza === 'divina'
                ? t(cfg, `🌈👑 **¡¡HISTÓRICO!!** <@${userId}> ha sacado **${comp.emoji} ${comp.es}**, la mascota DIVINA. Probabilidad: 1 entre ${Math.round(100 / K.COFRES[cofre].prob.divina).toLocaleString('es-ES')}.`, `🌈👑 **HISTORIC!!** <@${userId}> pulled **${comp.emoji} ${comp.en}**, the DIVINE pet. Odds: 1 in ${Math.round(100 / K.COFRES[cofre].prob.divina).toLocaleString('en-US')}.`)
                : t(cfg, `✨ <@${userId}> ha sacado ${comp.emoji} **${comp.es}** (${K.RAREZAS[r.rareza].es}) de un ${def.es.toLowerCase()}.`, `✨ <@${userId}> pulled ${comp.emoji} **${comp.en}** (${K.RAREZAS[r.rareza].en}) from a ${def.en.toLowerCase()}.`), allowedMentions: { users: [userId] } }).catch(() => {});
        }
    }
    return { ok: true, r };
}

async function equipar(userId, id) {
    const r = await ColeccionMascotas.updateOne({ userId, 'mascotas.id': id }, { $set: { equipada: id } });
    olvidar(userId);
    return r.modifiedCount > 0 || r.matchedCount > 0;
}

async function verColeccion(interaction, idioma, usuario = null) {
    const quien = usuario || interaction.user;
    const col = (await ColeccionMascotas.findOne({ userId: quien.id }).lean()) || { mascotas: [], abiertos: 0 };
    const total = Object.keys(K.COMPANEROS).length;
    const png = await A.tarjetaColeccion(col, { titulo: t(idioma, `Colección de ${quien.username} · ${col.mascotas.length}/${total}`, `${quien.username}’s collection · ${col.mascotas.length}/${total}`) }).catch(() => null);
    const eq = col.equipada ? col.mascotas.find((m) => m.id === col.equipada) : null;
    const e = new EmbedBuilder().setColor(eq ? K.RAREZAS[K.COMPANEROS[eq.id].rareza].color : '#6366f1')
        .setTitle(t(idioma, `🐾 Colección de ${quien.username}`, `🐾 ${quien.username}’s collection`))
        .setDescription([
            eq ? t(idioma, `Equipado: ${K.COMPANEROS[eq.id].emoji} **${nombre(eq.id, idioma)}** ${'★'.repeat(eq.estrellas)}\n${textoVentajas(K.ventajas(eq.id, eq.estrellas), idioma)}`, `Equipped: ${K.COMPANEROS[eq.id].emoji} **${nombre(eq.id, idioma)}** ${'★'.repeat(eq.estrellas)}\n${textoVentajas(K.ventajas(eq.id, eq.estrellas), idioma)}`) : t(idioma, 'Sin compañero equipado. Abre un cofre con `/cofre abrir`.', 'No companion equipped. Open a chest with `/chest open`.'),
            eq && K.COMPANEROS[eq.id].titulo ? `**${t(idioma, K.COMPANEROS[eq.id].titulo.es, K.COMPANEROS[eq.id].titulo.en)}**` : '',
            t(idioma, `📦 ${col.abiertos} cofres abiertos`, `📦 ${col.abiertos} chests opened`),
        ].filter(Boolean).join('\n'));
    if (png) e.setImage('attachment://coleccion.png');
    const comps = [];
    if (!usuario && col.mascotas.length) {
        comps.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('cof_sel').setPlaceholder(t(idioma, '✅ Equipar otro compañero…', '✅ Equip another companion…'))
            .addOptions([...col.mascotas].sort((a, b) => K.RAREZAS[K.COMPANEROS[b.id].rareza].orden - K.RAREZAS[K.COMPANEROS[a.id].rareza].orden).slice(0, 25)
                .map((m) => ({ label: `${nombre(m.id, idioma)} ${'★'.repeat(m.estrellas)}`.slice(0, 100), value: m.id, emoji: K.COMPANEROS[m.id].emoji, description: `${t(idioma, K.RAREZAS[K.COMPANEROS[m.id].rareza].es, K.RAREZAS[K.COMPANEROS[m.id].rareza].en)} · ${textoVentajas(K.ventajas(m.id, m.estrellas), idioma)}`.slice(0, 100) })))));
    }
    return { embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'coleccion.png' })] : [], components: comps, allowedMentions: { parse: [] } };
}

function embedProbabilidades(idioma) {
    const e = new EmbedBuilder().setColor('#a855f7').setTitle(t(idioma, '🎁 Cofres de mascotas', '🎁 Pet chests'))
        .setDescription(t(idioma, `Compañeros para ti (en todos los servidores). Lleva uno equipado para tener sus ventajas. Los repetidos suben estrellas (hasta 5). Cada ${K.PIEDAD} cofres sin épica, el siguiente la trae segura.`, `Companions for you (across all servers). Equip one to get its perks. Duplicates add stars (up to 5). Every ${K.PIEDAD} chests without an epic, the next one guarantees it.`));
    for (const [, c] of Object.entries(K.COFRES)) {
        e.addFields({ name: `${c.emoji} ${t(idioma, c.es, c.en)} · 🪙 ${fmt(c.precio, idioma)}`, value: Object.entries(c.prob).filter(([, p]) => p > 0).map(([r, p]) => `${rarezaTxt(r, idioma)} ${p} %`).join(' · '), inline: false });
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
    if (interaction.isButton() && id.startsWith('cof_otro:')) {
        await interaction.deferReply();
        const r = await abrir({ interaction, client, cfg, idioma, cofre: id.split(':')[1] });
        if (r.error) await interaction.editReply({ content: `❌ ${r.error}` });
        return true;
    }
    if ((interaction.isButton() && id.startsWith('cof_eq:')) || (interaction.isStringSelectMenu() && id === 'cof_sel')) {
        const comp = interaction.isStringSelectMenu() ? interaction.values[0] : id.split(':')[1];
        const ok = await equipar(interaction.user.id, comp);
        await interaction.reply({ content: ok ? t(idioma, `✅ Ahora te acompaña ${K.COMPANEROS[comp].emoji} **${nombre(comp, idioma)}**.`, `✅ ${K.COMPANEROS[comp].emoji} **${nombre(comp, idioma)}** is now with you.`) : t(idioma, 'Ese compañero no es tuyo.', 'That companion isn’t yours.'), flags: 64 });
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
        ultimas: ultimas.map((a) => ({ ...persona(a.userId), cofre: a.cofre, companero: a.companero, rareza: a.rareza, fecha: a.fecha })),
    };
}

module.exports = { ventajasUsuario, abrir, equipar, verColeccion, embedProbabilidades, manejar, resumenServidor, textoVentajas, olvidar };
