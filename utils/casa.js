// 🏠 Casa del compañero (1.33.0). `/casa [miembro]`: tu habitación (o la de otra persona) con tu compañero equipado.
// En la tuya: «🛒 Comprar…» (casa_buy:<dueño>, muebles y papeles), «🪑 Colocar o quitar…» (casa_put:<dueño>). En la de
// otro: «❤️ Me gusta» (casa_like:<dueño>, una vez al día por casa). La comodidad sube la granja (casaNucleo.bonusGranja).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const H = require('./casaNucleo.js');
const { t } = require('./i18n.js');

const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const pct = (v) => Math.round(v * 100);
const dia = () => new Date().toISOString().slice(0, 10);

async function vista(guildId, ownerId, viewerId, idioma, { nombre = '', aviso = '' } = {}) {
    const col = await ColeccionMascotas.findOne({ guildId, userId: ownerId }).lean();
    const casa = col?.casa || {};
    const propia = ownerId === viewerId;
    const m = col?.mascotas?.find((x) => x.id === col.equipada) || col?.mascotas?.[0] || null;
    const confort = H.confort(casa);
    const bonus = H.bonusGranja(casa);
    const png = await require('./casaArte.js').dibujarCasa({
        casa, compaId: m?.id || null, compa: { variante: m?.variante || null, acc: m?.acc || null },
        titulo: t(idioma, `🏠 Casa de ${nombre}`, `🏠 ${nombre}’s house`).slice(0, 40),
        sub: t(idioma, `Comodidad ${confort} · granja +${pct(bonus)} % · ❤️ ${casa.likes || 0}`, `Comfort ${confort} · farm +${pct(bonus)}% · ❤️ ${casa.likes || 0}`),
    }).catch((e) => { console.warn('Casa:', e.message); return null; });
    const e = new EmbedBuilder().setColor('#f59e0b').setTitle(t(idioma, `🏠 Casa de ${nombre}`, `🏠 ${nombre}’s house`));
    const lineas = [];
    if (aviso) lineas.push(aviso);
    if (propia) lineas.push(t(idioma, `Compra muebles con tu oro y colócalos. Cada mueble da **comodidad**, y cada punto sube tu **granja un ${pct(H.BONUS_POR_CONFORT)} %** (hasta +${pct(H.BONUS_MAX)} %). Los demás pueden visitarla con \`/casa miembro:@tú\` y darle ❤️.`, `Buy furniture with your gold and place it. Every piece adds **comfort**, and each point boosts your **farm by ${pct(H.BONUS_POR_CONFORT)}%** (up to +${pct(H.BONUS_MAX)}%). Others can visit with \`/house member:@you\` and give it ❤️.`));
    if (!png) lineas.push(Object.entries(casa.puestos || {}).map(([, id]) => `${H.MUEBLES[id]?.emoji || ''} ${t(idioma, H.MUEBLES[id]?.es || id, H.MUEBLES[id]?.en || id)}`).join(' · ') || t(idioma, '*Aún sin muebles.*', '*No furniture yet.*'));
    if (!m) lineas.push(t(idioma, 'Sin compañero, la casa está muy sola: consigue uno con `/cofre`.', 'Without a companion the house feels empty: get one with `/chest`.'));
    e.setDescription(lineas.join('\n\n') || null);
    if (png) e.setImage('attachment://casa.png');
    const filas = [];
    if (propia) {
        const tiene = new Set(casa.muebles || []); const papeles = new Set(['crema', ...(casa.papeles || [])]);
        const compra = [
            ...Object.entries(H.MUEBLES).filter(([id]) => !tiene.has(id)).map(([id, d]) => ({ value: `m:${id}`, emoji: d.emoji, label: `${t(idioma, d.es, d.en)} · 🪙 ${fmt(d.precio, idioma)}`.slice(0, 100), description: t(idioma, `+${d.confort} de comodidad · va en ${{ suelo: 'el suelo', pared: 'la pared', alfombra: 'el suelo (alfombra)', techo: 'el techo' }[d.slot]}`, `+${d.confort} comfort · goes on the ${{ suelo: 'floor', pared: 'wall', alfombra: 'floor (rug)', techo: 'ceiling' }[d.slot]}`) })),
            ...Object.entries(H.PAPELES).filter(([id]) => !papeles.has(id)).map(([id, d]) => ({ value: `p:${id}`, emoji: d.emoji, label: t(idioma, `Papel «${d.es}» · 🪙 ${fmt(d.precio, idioma)}`, `“${d.en}” wallpaper · 🪙 ${fmt(d.precio, idioma)}`).slice(0, 100), description: t(idioma, `+${d.confort} de comodidad`, `+${d.confort} comfort`) })),
        ].slice(0, 25);
        if (compra.length) filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`casa_buy:${ownerId}`).setPlaceholder(t(idioma, '🛒 Comprar muebles o papel…', '🛒 Buy furniture or wallpaper…')).addOptions(compra)));
        const puestos = new Set(Object.values(casa.puestos || {}));
        const colocar = [
            ...[...tiene].filter((id) => H.MUEBLES[id]).map((id) => { const d = H.MUEBLES[id]; return { value: `m:${id}`, emoji: d.emoji, label: (puestos.has(id) ? t(idioma, `Quitar: ${d.es}`, `Remove: ${d.en}`) : t(idioma, `Poner: ${d.es}`, `Place: ${d.en}`)).slice(0, 100), description: puestos.has(id) ? t(idioma, 'Ahora está puesto', 'Currently placed') : t(idioma, `+${d.confort} de comodidad`, `+${d.confort} comfort`) }; }),
            ...[...papeles].filter((id) => id !== (casa.papel || 'crema')).map((id) => ({ value: `p:${id}`, emoji: H.PAPELES[id].emoji, label: t(idioma, `Poner papel «${H.PAPELES[id].es}»`, `Use “${H.PAPELES[id].en}” wallpaper`).slice(0, 100) })),
        ].slice(0, 25);
        if (colocar.length) filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`casa_put:${ownerId}`).setPlaceholder(t(idioma, '🪑 Poner o quitar…', '🪑 Place or remove…')).addOptions(colocar)));
    } else {
        filas.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`casa_like:${ownerId}`).setEmoji('❤️').setStyle(ButtonStyle.Danger).setLabel(t(idioma, `Me gusta (${casa.likes || 0})`, `Like (${casa.likes || 0})`))));
    }
    return { embeds: [e], components: filas, files: png ? [new AttachmentBuilder(png, { name: 'casa.png' })] : [], attachments: [], allowedMentions: { parse: [] } };
}

async function comprar(guildId, userId, valor, idioma) {
    const [tipo, id] = String(valor).split(':');
    const d = tipo === 'm' ? H.MUEBLES[id] : tipo === 'p' ? H.PAPELES[id] : null;
    if (!d) return { error: t(idioma, 'Eso no está en la tienda.', 'That’s not in the shop.') };
    const campo = tipo === 'm' ? 'casa.muebles' : 'casa.papeles';
    const col = await ColeccionMascotas.findOne({ guildId, userId }).select('casa').lean();
    if ((tipo === 'm' ? col?.casa?.muebles : col?.casa?.papeles)?.includes(id) || (tipo === 'p' && id === 'crema')) return { error: t(idioma, 'Ya lo tienes.', 'You already have it.') };
    const eco = require('./economia.js').en(guildId);
    if ((await eco.cobrar(userId, d.precio)) === null) return { error: t(idioma, `No tienes 🪙 ${fmt(d.precio, idioma)}.`, `You don’t have 🪙 ${fmt(d.precio, idioma)}.`) };
    // Solo si aún no lo tenía (dos clics a la vez: uno compra).
    const r = await ColeccionMascotas.updateOne({ guildId, userId, [campo]: { $ne: id } }, { $addToSet: { [campo]: id } }, { upsert: false });
    if (!r.modifiedCount) {
        const existe = await ColeccionMascotas.exists({ guildId, userId });
        if (!existe) { await ColeccionMascotas.create({ guildId, userId, casa: { [tipo === 'm' ? 'muebles' : 'papeles']: [id] } }).catch(() => null); }
        else { await eco.darOro(userId, d.precio); return { error: t(idioma, 'Ya lo tienes.', 'You already have it.') }; }
    }
    // Lo nuevo se pone solo (si es un mueble y hay hueco libre; el papel, siempre).
    let puesto = false;
    if (tipo === 'p') { await ColeccionMascotas.updateOne({ guildId, userId }, { $set: { 'casa.papel': id } }); puesto = true; }
    else {
        const c2 = await ColeccionMascotas.findOne({ guildId, userId }).select('casa').lean();
        const libre = H.clavesSlot(d.slot).find((k) => !c2.casa?.puestos?.[k]);
        if (libre) { await ColeccionMascotas.updateOne({ guildId, userId, [`casa.puestos.${libre}`]: { $exists: false } }, { $set: { [`casa.puestos.${libre}`]: id } }); puesto = true; }
    }
    return { ok: true, d, puesto };
}

async function colocar(guildId, userId, valor, idioma) {
    const [tipo, id] = String(valor).split(':');
    const col = await ColeccionMascotas.findOne({ guildId, userId }).select('casa').lean();
    const casa = col?.casa || {};
    if (tipo === 'p') {
        if (!H.PAPELES[id] || (id !== 'crema' && !(casa.papeles || []).includes(id))) return { error: t(idioma, 'No tienes ese papel.', 'You don’t own that wallpaper.') };
        await ColeccionMascotas.updateOne({ guildId, userId }, { $set: { 'casa.papel': id } });
        return { ok: true, texto: t(idioma, `🖌️ Papel «${H.PAPELES[id].es}» puesto.`, `🖌️ “${H.PAPELES[id].en}” wallpaper on.`) };
    }
    const r = H.colocar(casa, id);
    if (r.fallo) return { error: r.fallo === 'noTiene' ? t(idioma, 'Aún no tienes ese mueble.', 'You don’t own that yet.') : t(idioma, 'Ese mueble no existe.', 'That piece doesn’t exist.') };
    await ColeccionMascotas.updateOne({ guildId, userId }, { $set: { 'casa.puestos': r.puestos } });
    const d = H.MUEBLES[id];
    return { ok: true, texto: r.quitado ? t(idioma, `📦 ${d.es} guardado.`, `📦 ${d.en} put away.`) : r.sustituido ? t(idioma, `🪑 ${d.es} puesto (en lugar de ${H.MUEBLES[r.sustituido].es}).`, `🪑 ${d.en} placed (replacing ${H.MUEBLES[r.sustituido].en}).`) : t(idioma, `🪑 ${d.es} puesto.`, `🪑 ${d.en} placed.`) };
}

async function darLike(guildId, dueno, visitante, idioma) {
    if (dueno === visitante) return { error: t(idioma, 'No puedes darte «me gusta» a ti mismo 😄', 'You can’t like your own house 😄') };
    const hoy = dia();
    // Con upsert: la casa de alguien que aún no tiene nada aquí también se puede «gustar». Si ya le dio hoy, el filtro no
    // encaja, se intenta crear otra y el índice único lo impide (E11000): eso es «ya le has dado».
    const r = await ColeccionMascotas.updateOne({ guildId, userId: dueno, [`casa.likeDe.${visitante}`]: { $ne: hoy } }, { $inc: { 'casa.likes': 1 }, $set: { [`casa.likeDe.${visitante}`]: hoy } }, { upsert: true }).catch((e) => (e.code === 11000 ? { modifiedCount: 0, upsertedCount: 0 } : Promise.reject(e)));
    if (!r.modifiedCount && !r.upsertedCount) return { error: t(idioma, 'Ya le has dado «me gusta» hoy. ¡Vuelve mañana!', 'You already liked it today. Come back tomorrow!') };
    return { ok: true };
}

async function manejar(interaction) {
    const id = interaction.customId || '';
    if (!id.startsWith('casa_')) return false;
    const [tipo, owner] = id.split(':');
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    const nombreDe = async (uid) => { const mm = await interaction.guild?.members.fetch(uid).catch(() => null); return mm?.displayName || mm?.user?.username || '…'; };
    if (tipo === 'casa_like') {
        const r = await darLike(interaction.guildId, owner, interaction.user.id, idioma);
        if (r.error) { await interaction.reply({ content: r.error, flags: 64 }); return true; }
        await interaction.update(await vista(interaction.guildId, owner, interaction.user.id, idioma, { nombre: await nombreDe(owner), aviso: t(idioma, `❤️ ${interaction.user.displayName || interaction.user.username} le ha dado «me gusta».`, `❤️ ${interaction.user.displayName || interaction.user.username} liked it.`) }));
        return true;
    }
    if (interaction.user.id !== owner) { await interaction.reply({ content: t(idioma, '🏠 Esta casa no es tuya: mira la tuya con `/casa`.', '🏠 This isn’t your house: see yours with `/house`.'), flags: 64 }); return true; }
    await interaction.deferUpdate();
    const valor = interaction.values?.[0];
    const r = tipo === 'casa_buy' ? await comprar(interaction.guildId, owner, valor, idioma) : await colocar(interaction.guildId, owner, valor, idioma);
    const aviso = r.error ? `⚠️ ${r.error}` : tipo === 'casa_buy'
        ? t(idioma, `🛒 Has comprado **${r.d.es}**${r.puesto ? ' y ya está puesto' : ' (no cabe: quita algo con «Poner o quitar»)'}.`, `🛒 You bought **${r.d.en}**${r.puesto ? ' and it’s in place' : ' (no room: remove something with “Place or remove”)'}.`)
        : r.texto;
    await interaction.editReply(await vista(interaction.guildId, owner, owner, idioma, { nombre: await nombreDe(owner), aviso }));
    return true;
}

module.exports = { vista, comprar, colocar, darLike, manejar };
