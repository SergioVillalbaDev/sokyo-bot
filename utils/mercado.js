// Mercado de cartas entre miembros (1.32.0). /jugar mercado vender · ver · mias. Lo que se vende es UNA copia
// (si tenías varias estrellas, bajas una). La casa se queda una COMISION (sale oro de la economía).
// Botones: mkt_comprar:<id> (desde el menú mkt_ver), mkt_quitar:<id>. Ofertas en models/OfertaMercado.js.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const OfertaMercado = require('../models/OfertaMercado.js');
const K = require('./cofresNucleo.js');
const S = require('./cartasNucleo.js');
const C = require('./combateNucleo.js');
const { t } = require('./i18n.js');

const COMISION = 0.07;
const MAX_OFERTAS = 10;
const CADUCA_DIAS = 7;
const PRECIO_MIN = 10; const PRECIO_MAX = 1000000;
const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const rz = (id) => K.RAREZAS[K.def(id).rareza];

// Pone una copia de una carta a la venta.
async function vender(guildId, userId, carta, precio, idioma) {
    precio = Math.floor(Number(precio) || 0);
    if (precio < PRECIO_MIN || precio > PRECIO_MAX) return { error: t(idioma, `El precio va de 🪙 ${fmt(PRECIO_MIN, idioma)} a 🪙 ${fmt(PRECIO_MAX, idioma)}.`, `Price must be between 🪙 ${fmt(PRECIO_MIN, idioma)} and 🪙 ${fmt(PRECIO_MAX, idioma)}.`) };
    const activas = await OfertaMercado.countDocuments({ guildId, vendedor: userId, estado: 'activa' });
    if (activas >= MAX_OFERTAS) return { error: t(idioma, `Como mucho ${MAX_OFERTAS} cartas a la venta a la vez.`, `At most ${MAX_OFERTAS} cards on sale at once.`) };
    const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
    const c = (col?.cartas || []).find((x) => x.id === carta);
    if (!c) return { error: t(idioma, 'No tienes esa carta.', 'You don’t have that card.') };
    // La copia sale del álbum (como al desencantar, pero sin polvo). Solo si el álbum no ha cambiado a la vez.
    const r = S.desencantar(col.cartas, carta);
    const holo = r.ultima && (col.holos || []).includes(carta);
    const ok = await ColeccionMascotas.updateOne({ _id: col._id, cartas: col.cartas }, { $set: { cartas: r.cartas, ...(r.ultima ? { mazo: (col.mazo || []).filter((x) => x !== carta), holos: (col.holos || []).filter((x) => x !== carta) } : {}) } });
    if (!ok.modifiedCount) return { error: t(idioma, 'Prueba otra vez.', 'Try again.') };
    const o = await OfertaMercado.create({ guildId, vendedor: userId, carta, holo, precio });
    const d = K.def(carta);
    return { ok: true, oferta: o, texto: t(idioma, `🏷️ Has puesto a la venta **${holo ? '🌈 ' : ''}${d.es}** (${rz(carta).emoji} ${rz(carta).es}) por **🪙 ${fmt(precio, idioma)}**. Cobrarás 🪙 ${fmt(Math.floor(precio * (1 - COMISION)), idioma)} (comisión del ${Math.round(COMISION * 100)} %). Caduca en ${CADUCA_DIAS} días.`, `🏷️ You put **${holo ? '🌈 ' : ''}${d.en}** (${rz(carta).emoji} ${rz(carta).en}) up for **🪙 ${fmt(precio, idioma)}**. You’ll get 🪙 ${fmt(Math.floor(precio * (1 - COMISION)), idioma)} (${Math.round(COMISION * 100)}% fee). Expires in ${CADUCA_DIAS} days.`) };
}
// Devuelve una copia al álbum de alguien (al quitarla, caducar o venderla al comprador).
async function darCarta(guildId, userId, carta, holo = false) {
    for (let i = 0; i < 5; i++) {
        const col = await ColeccionMascotas.findOneAndUpdate({ guildId, userId }, { $setOnInsert: { guildId, userId } }, { upsert: true, returnDocument: 'after' }).lean();
        const ya = (col.cartas || []).find((c) => c.id === carta);
        let cartas; let polvo = 0;
        if (!ya) cartas = [...(col.cartas || []), { id: carta, estrellas: 1, primera: new Date() }];
        else if ((ya.estrellas || 1) >= S.MAX_ESTRELLAS) { cartas = col.cartas; polvo = S.POLVO[K.def(carta).rareza] || 0; }
        else cartas = col.cartas.map((c) => (c.id === carta ? { ...c, estrellas: (c.estrellas || 1) + 1 } : c));
        const nuevas = S.nuevasSeries(cartas, col.seriesCompletas || []);
        const r = await ColeccionMascotas.updateOne({ _id: col._id, cartas: col.cartas || [] }, { $set: { cartas, seriesCompletas: [...(col.seriesCompletas || []), ...nuevas.map((n) => n.serie)] }, ...(polvo ? { $inc: { polvo } } : {}), ...(holo ? { $addToSet: { holos: carta } } : {}) });
        if (r.modifiedCount || (polvo && r.matchedCount)) {
            const oro = nuevas.reduce((a, n) => a + n.oro, 0);
            if (oro) await require('./economia.js').en(guildId).darOro(userId, oro);
            return { nueva: !ya, polvo, series: nuevas };
        }
    }
    return null;
}
async function comprar(guildId, userId, ofertaId, idioma) {
    const o = await OfertaMercado.findOne({ _id: ofertaId, guildId }).lean().catch(() => null);
    if (!o || o.estado !== 'activa') return { error: t(idioma, '⌛ Esa carta ya no está a la venta.', '⌛ That card is no longer for sale.') };
    if (o.vendedor === userId) return { error: t(idioma, 'Es tuya: quítala con `/jugar mercado mias`.', 'It’s yours: remove it with `/games market mine`.') };
    // Se reserva (nadie más la puede comprar), se cobra y se entrega. Si no llega el oro, vuelve a estar a la venta.
    const reservada = await OfertaMercado.findOneAndUpdate({ _id: o._id, estado: 'activa' }, { $set: { estado: 'vendida', comprador: userId, cerrada: new Date() } });
    if (!reservada) return { error: t(idioma, '⌛ Alguien se te ha adelantado.', '⌛ Someone beat you to it.') };
    const eco = require('./economia.js').en(guildId);
    const saldo = await eco.cobrar(userId, o.precio);
    if (saldo === null) {
        await OfertaMercado.updateOne({ _id: o._id, estado: 'vendida', comprador: userId }, { $set: { estado: 'activa', comprador: null, cerrada: null } });
        return { error: t(idioma, `No tienes 🪙 ${fmt(o.precio, idioma)}.`, `You don’t have 🪙 ${fmt(o.precio, idioma)}.`) };
    }
    const r = await darCarta(guildId, userId, o.carta, o.holo);
    if (!r) { // no se pudo guardar en su álbum: se le devuelve el oro y la carta vuelve a la venta
        await eco.darOro(userId, o.precio);
        await OfertaMercado.updateOne({ _id: o._id, estado: 'vendida', comprador: userId }, { $set: { estado: 'activa', comprador: null, cerrada: null } });
        return { error: t(idioma, 'Prueba otra vez.', 'Try again.') };
    }
    await eco.darOro(o.vendedor, Math.floor(o.precio * (1 - COMISION)));
    const d = K.def(o.carta);
    return { ok: true, oferta: o, texto: [
        t(idioma, `🛒 ¡Comprada! **${o.holo ? '🌈 ' : ''}${d.es}** por 🪙 ${fmt(o.precio, idioma)}.${r?.nueva ? ' 🆕' : r?.polvo ? ` (ya la tenías al máximo: ✨ +${r.polvo} de polvo)` : ' Sube una estrella.'}`, `🛒 Bought! **${o.holo ? '🌈 ' : ''}${d.en}** for 🪙 ${fmt(o.precio, idioma)}.${r?.nueva ? ' 🆕' : r?.polvo ? ` (already maxed: ✨ +${r.polvo} dust)` : ' It gains a star.'}`),
        ...(r?.series || []).map((n) => t(idioma, `📚 ¡Colección de **${n.serie}** completa! +🪙 ${fmt(n.oro, idioma)}`, `📚 **${n.serie}** collection complete! +🪙 ${fmt(n.oro, idioma)}`)),
    ].join('\n') };
}
async function quitar(guildId, userId, ofertaId, idioma) {
    const o = await OfertaMercado.findOneAndUpdate({ _id: ofertaId, guildId, vendedor: userId, estado: 'activa' }, { $set: { estado: 'retirada', cerrada: new Date() } }).lean().catch(() => null);
    if (!o) return { error: t(idioma, 'Esa oferta ya no está activa.', 'That listing is no longer active.') };
    await darCarta(guildId, userId, o.carta, o.holo);
    return { ok: true, texto: t(idioma, `↩️ **${K.def(o.carta).es}** vuelve a tu álbum.`, `↩️ **${K.def(o.carta).en}** is back in your album.`) };
}
// Lo que hay a la venta (lo más barato de lo más raro primero), con un menú para comprar.
async function vista(guildId, userId, idioma, { buscar = '' } = {}) {
    let ofertas = await OfertaMercado.find({ guildId, estado: 'activa' }).sort({ creada: -1 }).limit(200).lean();
    const q = String(buscar || '').toLowerCase();
    if (q) ofertas = ofertas.filter((o) => `${K.def(o.carta).es} ${K.def(o.carta).serie}`.toLowerCase().includes(q));
    ofertas.sort((a, b) => rz(b.carta).orden - rz(a.carta).orden || a.precio - b.precio);
    const lista = ofertas.slice(0, 25);
    const e = new EmbedBuilder().setColor('#0ea5e9').setTitle(t(idioma, '🏪 Mercado de cartas', '🏪 Card market'))
        .setDescription(lista.length ? lista.slice(0, 15).map((o) => {
            const d = K.def(o.carta); const tec = C.tecnicaDe(o.carta);
            return `${rz(o.carta).emoji} ${o.holo ? '🌈 ' : ''}**${d.es}** · ${d.serie} · ⚔ ${t(idioma, tec.es, tec.en)} — **🪙 ${fmt(o.precio, idioma)}** · <@${o.vendedor}>`;
        }).join('\n') + (ofertas.length > 15 ? t(idioma, `\n…y ${ofertas.length - 15} más (búscalas por nombre).`, `\n…and ${ofertas.length - 15} more (search by name).`) : '')
            : t(idioma, q ? 'No hay nada con ese nombre a la venta.' : 'No hay nada a la venta. ¡Pon tú algo con `/jugar mercado vender`!', q ? 'Nothing with that name is for sale.' : 'Nothing for sale. Put something up with `/games market sell`!'))
        .setFooter({ text: t(idioma, `Comisión del ${Math.round(COMISION * 100)} % para quien vende · las ofertas caducan en ${CADUCA_DIAS} días`, `${Math.round(COMISION * 100)}% fee for the seller · listings expire in ${CADUCA_DIAS} days`) });
    const comps = [];
    const compr = lista.filter((o) => o.vendedor !== userId);
    if (compr.length) {
        comps.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('mkt_ver').setPlaceholder(t(idioma, '🛒 Comprar una carta…', '🛒 Buy a card…'))
            .addOptions(compr.map((o) => ({ value: String(o._id), emoji: rz(o.carta).emoji, label: `${o.holo ? '🌈 ' : ''}${K.def(o.carta).es} · 🪙 ${fmt(o.precio, idioma)}`.slice(0, 100), description: `${K.def(o.carta).serie}`.slice(0, 100) })))));
    }
    return { embeds: [e], components: comps, allowedMentions: { parse: [] } };
}
async function mias(guildId, userId, idioma) {
    const ofertas = await OfertaMercado.find({ guildId, vendedor: userId, estado: 'activa' }).sort({ creada: -1 }).lean();
    const vendidas = await OfertaMercado.find({ guildId, vendedor: userId, estado: 'vendida' }).sort({ cerrada: -1 }).limit(5).lean();
    const e = new EmbedBuilder().setColor('#0ea5e9').setTitle(t(idioma, '🏷️ Tus cartas a la venta', '🏷️ Your cards for sale'))
        .setDescription([
            ofertas.length ? ofertas.map((o) => `${rz(o.carta).emoji} **${K.def(o.carta).es}** · 🪙 ${fmt(o.precio, idioma)} · ${t(idioma, 'caduca', 'expires')} <t:${Math.floor((new Date(o.creada).getTime() + CADUCA_DIAS * 86400000) / 1000)}:R>`).join('\n') : t(idioma, 'No tienes nada a la venta.', 'You have nothing for sale.'),
            vendidas.length ? `\n${t(idioma, '**Últimas vendidas:**', '**Recently sold:**')}\n${vendidas.map((o) => `✅ ${K.def(o.carta).es} → <@${o.comprador}> · 🪙 ${fmt(Math.floor(o.precio * (1 - COMISION)), idioma)}`).join('\n')}` : '',
        ].join('\n'));
    const comps = ofertas.length ? [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('mkt_quitar').setPlaceholder(t(idioma, '↩️ Quitar una del mercado…', '↩️ Remove one from the market…'))
        .addOptions(ofertas.slice(0, 25).map((o) => ({ value: String(o._id), label: `${K.def(o.carta).es} · 🪙 ${fmt(o.precio, idioma)}`.slice(0, 100) }))))] : [];
    return { embeds: [e], components: comps, flags: 64, allowedMentions: { parse: [] } };
}
// Programador: las ofertas de más de CADUCA_DIAS vuelven a su dueño.
async function barrerMercado() {
    const limite = new Date(Date.now() - CADUCA_DIAS * 86400000);
    const viejas = await OfertaMercado.find({ estado: 'activa', creada: { $lt: limite } }).limit(100).lean();
    for (const o of viejas) {
        const r = await OfertaMercado.updateOne({ _id: o._id, estado: 'activa' }, { $set: { estado: 'caducada', cerrada: new Date() } });
        if (r.modifiedCount) await darCarta(o.guildId, o.vendedor, o.carta, o.holo).catch(() => {});
    }
}
async function manejar(interaction) {
    const id = interaction.customId || '';
    if (!id.startsWith('mkt_')) return false;
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    if (interaction.isStringSelectMenu() && id === 'mkt_ver') {
        const o = await OfertaMercado.findById(interaction.values[0]).lean().catch(() => null);
        if (!o || o.estado !== 'activa') { await interaction.reply({ content: t(idioma, '⌛ Esa carta ya no está a la venta.', '⌛ That card is no longer for sale.'), flags: 64 }); return true; }
        const v = await require('./cartas.js').verCarta(o.guildId, o.vendedor, o.carta, idioma).catch(() => null);
        const d = K.def(o.carta);
        const e = new EmbedBuilder().setColor(rz(o.carta).color).setTitle(t(idioma, `🛒 ${d.es} · 🪙 ${fmt(o.precio, idioma)}`, `🛒 ${d.en} · 🪙 ${fmt(o.precio, idioma)}`))
            .setDescription(t(idioma, `La vende <@${o.vendedor}>. ¿La compras?`, `Sold by <@${o.vendedor}>. Buy it?`));
        if (v?.files?.length) e.setImage('attachment://carta.png');
        await interaction.reply({ embeds: [e], files: v?.files || [], flags: 64, allowedMentions: { parse: [] }, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`mkt_comprar:${o._id}`).setEmoji('🛒').setStyle(ButtonStyle.Success).setLabel(t(idioma, `Comprar por 🪙 ${fmt(o.precio, idioma)}`, `Buy for 🪙 ${fmt(o.precio, idioma)}`)))] });
        return true;
    }
    if (interaction.isButton() && id.startsWith('mkt_comprar:')) {
        const r = await comprar(interaction.guildId, interaction.user.id, id.split(':')[1], idioma);
        await interaction.update({ content: r.error ? `❌ ${r.error}` : r.texto, embeds: [], components: [], attachments: [] });
        if (r.ok) {
            const comprador = interaction.member?.displayName || interaction.user.username;
            const P = require('./preferencias.js');
            const v = await P.quiereDM(r.oferta.vendedor, 'anuncios') ? await interaction.client.users.fetch(r.oferta.vendedor).catch(() => null) : null;
            const iv = v ? await P.idiomaMiembro(r.oferta.vendedor, { cfg }).catch(() => 'es') : 'es';
            if (v) v.send({ content: t(iv, `💰 **${comprador}** ha comprado tu carta **${K.def(r.oferta.carta).es}** en ${interaction.guild?.name || 'el servidor'}: +🪙 ${fmt(Math.floor(r.oferta.precio * (1 - COMISION)), iv)}.`, `💰 **${comprador}** bought your card **${K.def(r.oferta.carta).en}** in ${interaction.guild?.name || 'the server'}: +🪙 ${fmt(Math.floor(r.oferta.precio * (1 - COMISION)), iv)}.`) }).catch(() => {});
        }
        return true;
    }
    if (interaction.isStringSelectMenu() && id === 'mkt_quitar') {
        const r = await quitar(interaction.guildId, interaction.user.id, interaction.values[0], idioma);
        const v = await mias(interaction.guildId, interaction.user.id, idioma);
        await interaction.update({ ...v, content: r.error ? `❌ ${r.error}` : r.texto, flags: undefined });
        return true;
    }
    return false;
}

module.exports = { COMISION, MAX_OFERTAS, CADUCA_DIAS, vender, comprar, quitar, vista, mias, barrerMercado, manejar, darCarta };
