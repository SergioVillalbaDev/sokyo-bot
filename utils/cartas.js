// Cartas de anime (1.24.0): abrir sobres con oro (animación de 3 cartas), el álbum, ver
// una carta y usarla sobre tu mascota (eso lo hace utils/compis.js con «carta:<id>»).
// Solo en los servidores que tienen activado el Pack anime (cfg.compis.anime).
// Reglas en utils/cartasNucleo.js; dibujos en utils/cartasArte.js. Botones: crt_*.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, StringSelectMenuBuilder } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');
const S = require('./cartasNucleo.js');
const { t } = require('./i18n.js');

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const rz = (r, idioma) => `${K.RAREZAS[r].emoji} ${t(idioma, K.RAREZAS[r].es, K.RAREZAS[r].en)}`;
const activas = (cfg) => !!cfg?.compis?.anime;
const textoApagadas = (idioma) => t(idioma, '🃏 Las cartas de anime no están activadas en este servidor (panel → Diversión → Compañeros → Cartas de anime).', '🃏 Anime cards aren’t turned on on this server (panel → Fun → Companions → Anime cards).');

async function abrir({ interaction, cfg, idioma, sobre }) {
    if (!activas(cfg)) return { error: textoApagadas(idioma) };
    const def = S.SOBRES[sobre];
    if (!def) return { error: t(idioma, 'Ese sobre no existe.', 'That pack doesn’t exist.') };
    const userId = interaction.user.id;
    const economia = require('./economia.js');
    const saldo = await economia.cobrar(userId, def.precio);
    if (saldo === null) return { error: t(idioma, `No tienes 🪙 ${fmt(def.precio, idioma)} para el ${def.es.toLowerCase()}.`, `You don’t have 🪙 ${fmt(def.precio, idioma)} for the ${def.en.toLowerCase()}.`) };
    const quitados = require('./cofres.js').quitadosDe(cfg);
    let r = null; let col;
    // Se calcula sobre el álbum y se guarda solo si nadie lo ha tocado a la vez.
    for (let intento = 0; intento < 5 && !r; intento++) {
        col = await ColeccionMascotas.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, returnDocument: 'after' }).lean();
        const x = S.abrirSobre(col, sobre, undefined, quitados);
        const cartas = [...(col.cartas || [])];
        for (const c of x.cartas.filter((y) => y.id)) {
            const ya = cartas.find((y) => y.id === c.id);
            if (ya) ya.estrellas = c.estrellas; else cartas.push({ id: c.id, estrellas: 1, primera: new Date() });
        }
        const hecho = await ColeccionMascotas.updateOne({ _id: col._id, sobresAbiertos: col.sobresAbiertos || 0 },
            { $set: { cartas, sinEpicaCartas: x.sinEpica }, $inc: { sobresAbiertos: 1, gastadoSobres: def.precio } });
        if (hecho.modifiedCount) r = x;
    }
    if (!r) { await economia.darOro(userId, def.precio); return { error: t(idioma, 'Prueba otra vez.', 'Try again.') }; }
    if (r.devuelto) await economia.darOro(userId, r.devuelto);
    const AperturaCofre = require('../models/AperturaCofre.js');
    for (const c of r.cartas.filter((y) => y.id && K.RAREZAS[y.rareza].orden >= 2)) {
        await AperturaCofre.create({ guildId: interaction.guildId || null, userId, cofre: `sobre:${sobre}`, companero: c.id, rareza: c.rareza }).catch(() => {});
    }
    const gif = await require('./cartasArte.js').gifSobre(sobre, r.cartas, { idioma, color: def.color, emoji: def.emoji }).catch((e) => { console.error('GIF sobre:', e.message); return null; });
    const e = new EmbedBuilder().setColor(def.color).setTitle(`${def.emoji} ${t(idioma, def.es, def.en)}`)
        .setDescription(t(idioma, `<@${userId}> abre un ${def.es.toLowerCase()}… 🥁`, `<@${userId}> opens a ${def.en.toLowerCase()}… 🥁`));
    if (gif) e.setImage('attachment://sobre.gif');
    await interaction.editReply({ embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'sobre.gif' })] : [], components: [], allowedMentions: { parse: [] } });
    await espera(gif ? 3200 + r.cartas.length * 650 : 500);
    const lineas = r.cartas.map((c) => {
        if (c.quitada) return t(idioma, `🪙 Carta de una serie desactivada aquí → **+${c.devuelto}** de oro`, `🪙 Card from a series turned off here → **+${c.devuelto}** gold`);
        const d = K.def(c.id);
        const estado = c.nuevo ? t(idioma, '🆕', '🆕') : c.devuelto ? t(idioma, `(5★: +🪙 ${c.devuelto})`, `(5★: +🪙 ${c.devuelto})`) : `★${c.estrellas}`;
        return `${rz(c.rareza, idioma)} · **${d.es}** — ${d.serie} ${estado}`;
    });
    const divina = r.cartas.find((c) => c.rareza === 'divina');
    const fin = EmbedBuilder.from(e).setColor(divina ? '#fde68a' : def.color)
        .setDescription([
            divina ? t(idioma, '🌈🌈🌈 **¡¡CARTA DIVINA!!** 🌈🌈🌈', '🌈🌈🌈 **DIVINE CARD!!** 🌈🌈🌈') : '',
            ...lineas,
            r.piedad ? t(idioma, '🍀 ¡Sobre de la suerte! (épica asegurada)', '🍀 Lucky pack! (epic guaranteed)') : '',
            t(idioma, 'Úsalas sobre tu mascota con `/compi` → 🃏 o `/carta usar`.', 'Use them on your pet with `/companion` → 🃏 or `/card use`.'),
        ].filter(Boolean).join('\n'))
        .setFooter({ text: t(idioma, `Te quedan 🪙 ${fmt(saldo + (r.devuelto || 0), idioma)} · ${(col.sobresAbiertos || 0) + 1} sobres abiertos`, `You have 🪙 ${fmt(saldo + (r.devuelto || 0), idioma)} left · ${(col.sobresAbiertos || 0) + 1} packs opened`) });
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`crt_otro:${sobre}`).setEmoji(def.emoji).setStyle(ButtonStyle.Primary).setLabel(t(idioma, `Abrir otro (🪙 ${fmt(def.precio, idioma)})`, `Open another (🪙 ${fmt(def.precio, idioma)})`)),
        new ButtonBuilder().setCustomId('crt_album').setEmoji('📚').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Mi álbum', 'My album')),
    );
    await interaction.editReply({ embeds: [fin], components: [fila] });
    // Las legendarias o mejores se anuncian; la divina, a lo grande.
    const top = r.cartas.filter((c) => c.id && K.RAREZAS[c.rareza].orden >= 3).sort((a, b) => K.RAREZAS[b.rareza].orden - K.RAREZAS[a.rareza].orden)[0];
    if (top && cfg?.casino?.anunciosId) {
        const canal = interaction.guild?.channels.cache.get(cfg.casino.anunciosId);
        if (canal?.isTextBased() && canal.id !== interaction.channelId) {
            const d = K.def(top.id);
            await canal.send({ content: top.rareza === 'divina'
                ? t(cfg, `🌈👑 **¡¡HISTÓRICO!!** <@${userId}> ha sacado la carta DIVINA **${d.es}** (${d.serie}).`, `🌈👑 **HISTORIC!!** <@${userId}> pulled the DIVINE card **${d.en}** (${d.serie}).`)
                : t(cfg, `✨ <@${userId}> ha sacado la carta **${d.es}** (${K.RAREZAS[top.rareza].es}) de un ${def.es.toLowerCase()}.`, `✨ <@${userId}> pulled the card **${d.en}** (${K.RAREZAS[top.rareza].en}) from a ${def.en.toLowerCase()}.`), allowedMentions: { users: [userId] } }).catch(() => {});
        }
    }
    return { ok: true, r };
}

async function verAlbum(interaction, idioma, usuario = null) {
    const quien = usuario || interaction.user;
    const col = (await ColeccionMascotas.findOne({ userId: quien.id }).select('cartas sobresAbiertos').lean()) || { cartas: [] };
    const cartas = col.cartas || [];
    const porRareza = {}; for (const c of cartas) { const r = K.def(c.id).rareza; porRareza[r] = (porRareza[r] || 0) + 1; }
    const png = await require('./cartasArte.js').album(cartas, { titulo: t(idioma, `Álbum de ${quien.username} · ${cartas.length}/${K.ANIME.size}`, `${quien.username}’s album · ${cartas.length}/${K.ANIME.size}`), idioma }).catch(() => null);
    const e = new EmbedBuilder().setColor('#8b5cf6').setTitle(t(idioma, `🃏 Álbum de ${quien.username}`, `🃏 ${quien.username}’s album`))
        .setDescription([
            t(idioma, `**${cartas.length}** de ${K.ANIME.size} cartas · ${col.sobresAbiertos || 0} sobres abiertos`, `**${cartas.length}** of ${K.ANIME.size} cards · ${col.sobresAbiertos || 0} packs opened`),
            Object.keys(K.RAREZAS).filter((r) => porRareza[r]).map((r) => `${rz(r, idioma)} ${porRareza[r]}`).join(' · '),
            cartas.length ? '' : t(idioma, 'Consigue cartas con `/carta abrir`.', 'Get cards with `/card open`.'),
        ].filter(Boolean).join('\n'));
    if (png) e.setImage('attachment://album.png');
    const comps = [];
    if (!usuario && cartas.length) {
        const mejores = [...cartas].sort((a, b) => K.RAREZAS[K.def(b.id).rareza].orden - K.RAREZAS[K.def(a.id).rareza].orden).slice(0, 25);
        comps.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('crt_ver').setPlaceholder(t(idioma, '🔍 Ver una carta…', '🔍 See a card…'))
            .addOptions(mejores.map((c) => ({ value: c.id, label: `${K.def(c.id).es} ${'★'.repeat(c.estrellas || 1)}`.slice(0, 100), description: `${t(idioma, K.RAREZAS[K.def(c.id).rareza].es, K.RAREZAS[K.def(c.id).rareza].en)} · ${K.def(c.id).serie}`.slice(0, 100) })))));
    }
    return { embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'album.png' })] : [], components: comps, allowedMentions: { parse: [] } };
}

async function verCarta(userId, id, idioma) {
    const col = await ColeccionMascotas.findOne({ userId }).select('cartas').lean();
    const c = (col?.cartas || []).find((x) => x.id === id);
    if (!c) return { content: t(idioma, 'No tienes esa carta.', 'You don’t have that card.') };
    const d = K.def(id);
    const png = await require('./cartasArte.js').tarjetaCarta(id, { estrellas: c.estrellas || 1, idioma }).catch(() => null);
    const f = S.faltaCarta(c);
    const e = new EmbedBuilder().setColor(K.RAREZAS[d.rareza].color).setTitle(`🃏 ${d.es}`)
        .setDescription([
            `${rz(d.rareza, idioma)} · ${d.serie} · ${'★'.repeat(c.estrellas || 1)}`,
            `${P.ARQUETIPOS[d.poder.tipo].emoji} **${t(idioma, d.poder.es, d.poder.en)}**`,
            P.textoEfecto(P.efectoCarta(id, c.estrellas || 1, null), idioma),
            f ? t(idioma, `⏳ Se recarga en ${Math.ceil(f / 60)} h`, `⏳ Recharges in ${Math.ceil(f / 60)} h`) : t(idioma, '✅ Lista para usar en tu mascota (`/compi` → 🃏).', '✅ Ready to use on your pet (`/companion` → 🃏).'),
        ].join('\n'));
    if (png) e.setImage('attachment://carta.png');
    return { embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'carta.png' })] : [] };
}

function embedProbabilidades(idioma) {
    const e = new EmbedBuilder().setColor('#8b5cf6').setTitle(t(idioma, '🃏 Sobres de cartas de anime', '🃏 Anime card packs'))
        .setDescription(t(idioma, `Cada sobre trae **${S.CARTAS_POR_SOBRE} cartas**. Las cartas se usan sobre tu mascota para potenciarla (hasta ${S.CARTAS_DIA} al día; cada una se recarga en ${S.ESPERA_CARTA_H} h). Las repetidas suben estrellas y la carta es más fuerte. Cada ${S.PIEDAD} sobres sin épica, el siguiente la trae segura.`,
            `Each pack has **${S.CARTAS_POR_SOBRE} cards**. Cards are used on your pet to power it up (up to ${S.CARTAS_DIA} a day; each recharges in ${S.ESPERA_CARTA_H} h). Duplicates add stars and make the card stronger. Every ${S.PIEDAD} packs without an epic, the next one guarantees it.`));
    for (const [, s] of Object.entries(S.SOBRES)) {
        e.addFields({ name: `${s.emoji} ${t(idioma, s.es, s.en)} · 🪙 ${fmt(s.precio, idioma)}`, value: Object.entries(s.prob).filter(([, p]) => p > 0).map(([r, p]) => `${rz(r, idioma)} ${p} %`).join(' · ') + (s.garantia ? t(idioma, `\nLa última carta, ${K.RAREZAS[s.garantia].es.toLowerCase()} o mejor.`, `\nThe last card is ${K.RAREZAS[s.garantia].en.toLowerCase()} or better.`) : '') });
    }
    return e;
}

async function manejar(interaction) {
    const id = interaction.customId || '';
    if (!id.startsWith('crt_')) return false;
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    if (interaction.isButton() && id.startsWith('crt_otro:')) {
        await interaction.deferReply();
        const r = await abrir({ interaction, cfg, idioma, sobre: id.split(':')[1] });
        if (r.error) { await interaction.deleteReply().catch(() => {}); await interaction.followUp({ content: `❌ ${r.error}`, flags: 64 }); }
        return true;
    }
    if (interaction.isButton() && id === 'crt_album') {
        await interaction.deferReply({ flags: 64 });
        await interaction.editReply(await verAlbum(interaction, idioma));
        return true;
    }
    if (interaction.isStringSelectMenu() && id === 'crt_ver') {
        await interaction.deferReply({ flags: 64 });
        await interaction.editReply(await verCarta(interaction.user.id, interaction.values[0], idioma));
        return true;
    }
    return false;
}

module.exports = { abrir, verAlbum, verCarta, embedProbabilidades, manejar, activas, textoApagadas };
