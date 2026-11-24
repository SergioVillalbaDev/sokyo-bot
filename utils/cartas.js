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

async function abrir({ interaction, cfg, idioma, sobre, ticket = null }) {
    if (!activas(cfg)) return { error: textoApagadas(idioma) };
    const def = S.SOBRES[sobre];
    if (!def) return { error: t(idioma, 'Ese sobre no existe.', 'That pack doesn’t exist.') };
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const economia = require('./economia.js').en(guildId);
    // 1.29.0: con un ticket del pase el sobre sale gratis.
    const Pase = require('./pase.js');
    if (ticket && !(await Pase.usarTicket(guildId, userId, ticket))) return { error: t(idioma, 'Ya no tienes ese ticket. Mira los tuyos con `/pase`.', 'You no longer have that ticket. See yours with `/pass`.') };
    const saldo = ticket ? (await economia.obtenerUsuario(userId)).balance : await economia.cobrar(userId, def.precio);
    if (saldo === null) return { error: t(idioma, `No tienes 🪙 ${fmt(def.precio, idioma)} para el ${def.es.toLowerCase()}.`, `You don’t have 🪙 ${fmt(def.precio, idioma)} for the ${def.en.toLowerCase()}.`) };
    const quitados = require('./cofres.js').quitadosDe(cfg);
    let r = null; let col;
    // Se calcula sobre el álbum y se guarda solo si nadie lo ha tocado a la vez.
    for (let intento = 0; intento < 5 && !r; intento++) {
        col = await ColeccionMascotas.findOneAndUpdate({ guildId, userId }, { $setOnInsert: { guildId, userId } }, { upsert: true, returnDocument: 'after' }).lean();
        const x = S.abrirSobre(col, sobre, undefined, quitados);
        const cartas = [...(col.cartas || [])];
        for (const c of x.cartas.filter((y) => y.id)) {
            const ya = cartas.find((y) => y.id === c.id);
            if (ya) ya.estrellas = c.estrellas; else cartas.push({ id: c.id, estrellas: 1, primera: new Date() });
        }
        // ¿Completa alguna serie? Premio una sola vez (1.25.0).
        const nuevas = S.nuevasSeries(cartas, col.seriesCompletas || []);
        const hecho = await ColeccionMascotas.updateOne({ _id: col._id, sobresAbiertos: col.sobresAbiertos || 0 },
            { $set: { cartas, sinEpicaCartas: x.sinEpica, seriesCompletas: [...(col.seriesCompletas || []), ...nuevas.map((n) => n.serie)] }, $inc: { sobresAbiertos: 1, gastadoSobres: def.precio } });
        if (hecho.modifiedCount) r = { ...x, series: nuevas };
    }
    if (!r) { if (ticket) await Pase.devolverTicket(guildId, userId, ticket); else await economia.darOro(userId, def.precio); return { error: t(idioma, 'Prueba otra vez.', 'Try again.') }; }
    const delPase = await Pase.registrar(guildId, userId, [['sobre', 1], ['serie', r.series.length]], { idioma }).catch(() => []);
    if (r.devuelto) await economia.darOro(userId, r.devuelto);
    const oroSeries = r.series.reduce((a, n) => a + n.oro, 0);
    if (oroSeries) await economia.darOro(userId, oroSeries);
    const AperturaCofre = require('../models/AperturaCofre.js');
    for (const c of r.cartas.filter((y) => y.id && K.RAREZAS[y.rareza].orden >= 2)) {
        await AperturaCofre.create({ guildId: interaction.guildId || null, userId, cofre: `sobre:${sobre}`, companero: c.id, rareza: c.rareza }).catch(() => {});
    }
    const gif = await require('./cartasArte.js').gifSobre(sobre, r.cartas, { idioma, color: def.color, emoji: def.emoji }).catch((e) => { console.error('GIF sobre:', e.message); return null; });
    const lineas = r.cartas.map((c) => {
        if (c.quitada) return t(idioma, `🪙 Carta de una serie desactivada aquí → **+${c.devuelto}** de oro`, `🪙 Card from a series turned off here → **+${c.devuelto}** gold`);
        const d = K.def(c.id);
        const estado = c.nuevo ? t(idioma, '🆕', '🆕') : c.devuelto ? t(idioma, `(5★: +🪙 ${c.devuelto})`, `(5★: +🪙 ${c.devuelto})`) : `★${c.estrellas}`;
        return `${rz(c.rareza, idioma)} · **${d.es}** — ${d.serie} ${estado}`;
    });
    const divina = r.cartas.find((c) => c.rareza === 'divina');
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`crt_otro:${sobre}`).setEmoji(def.emoji).setStyle(ButtonStyle.Primary).setLabel(t(idioma, `Abrir otro (🪙 ${fmt(def.precio, idioma)})`, `Open another (🪙 ${fmt(def.precio, idioma)})`)),
        new ButtonBuilder().setCustomId('crt_album').setEmoji('📚').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Mi álbum', 'My album')),
    );
    const e = new EmbedBuilder().setColor(def.color).setTitle(`${def.emoji} ${t(idioma, def.es, def.en)}`);
    if (gif) {
        // 1.31.1: UN mensaje. La animación ya enseña las cartas (nombre, rareza, ¡NUEVA! o ★); no se edita
        // después (la imagen saltaba). Las colecciones completas y los niveles del pase, en un mensaje aparte.
        e.setImage('attachment://sobre.gif')
            .setFooter({ text: t(idioma, `Te quedan 🪙 ${fmt(saldo + (r.devuelto || 0) + oroSeries, idioma)} · ${(col.sobresAbiertos || 0) + 1} sobres abiertos`, `You have 🪙 ${fmt(saldo + (r.devuelto || 0) + oroSeries, idioma)} left · ${(col.sobresAbiertos || 0) + 1} packs opened`) });
        // Lo que sale, también en texto oculto (‖…‖): sin destripar la animación y para quien tiene los GIF en pausa.
        const resumen = `||${r.cartas.map((c) => (c.quitada ? `🪙 +${c.devuelto}` : `${K.def(c.id).es} ${c.nuevo ? '🆕' : '★'.repeat(c.estrellas)}`)).join(' · ')}||`;
        e.setDescription([ticket ? t(idioma, '🎫 Abierto con un ticket del pase: ¡gratis!', '🎫 Opened with a pass ticket: free!') : '', resumen].filter(Boolean).join('\n'));
        await interaction.editReply({ embeds: [e], files: [new AttachmentBuilder(gif, { name: 'sobre.gif' })], components: [fila], allowedMentions: { parse: [] } });
        const extras = [
            r.piedad ? t(idioma, '🍀 ¡Sobre de la suerte! (épica asegurada)', '🍀 Lucky pack! (epic guaranteed)') : '',
            ...r.series.map((n) => t(idioma, `📚 **¡Colección completa: ${n.serie}!** +🪙 ${fmt(n.oro, idioma)} y sus ${n.cartas} cartas son un 25 % más fuertes.`, `📚 **Collection complete: ${n.serie}!** +🪙 ${fmt(n.oro, idioma)} and its ${n.cartas} cards are 25% stronger.`)),
            ...delPase,
        ].filter(Boolean);
        if (extras.length) {
            await espera(3200 + r.cartas.length * 650);
            await interaction.followUp({ content: extras.join('\n'), allowedMentions: { parse: [] } }).catch(() => {});
        }
    } else {
        const fin = e.setColor(divina ? '#fde68a' : def.color)
            .setDescription([
                divina ? t(idioma, '🌈🌈🌈 **¡¡CARTA DIVINA!!** 🌈🌈🌈', '🌈🌈🌈 **DIVINE CARD!!** 🌈🌈🌈') : '',
                ...lineas,
                r.piedad ? t(idioma, '🍀 ¡Sobre de la suerte! (épica asegurada)', '🍀 Lucky pack! (epic guaranteed)') : '',
                ...r.series.map((n) => t(idioma, `📚 **¡Colección completa: ${n.serie}!** +🪙 ${fmt(n.oro, idioma)} y sus ${n.cartas} cartas son un 25 % más fuertes.`, `📚 **Collection complete: ${n.serie}!** +🪙 ${fmt(n.oro, idioma)} and its ${n.cartas} cards are 25% stronger.`)),
                t(idioma, 'Úsalas sobre tu mascota con `/compi` → 🃏 o `/carta usar`.', 'Use them on your pet with `/companion` → 🃏 or `/card use`.'),
                ticket ? t(idioma, '🎫 Abierto con un ticket del pase: ¡gratis!', '🎫 Opened with a pass ticket: free!') : '',
                ...delPase,
            ].filter(Boolean).join('\n'))
            .setFooter({ text: t(idioma, `Te quedan 🪙 ${fmt(saldo + (r.devuelto || 0) + oroSeries, idioma)} · ${(col.sobresAbiertos || 0) + 1} sobres abiertos`, `You have 🪙 ${fmt(saldo + (r.devuelto || 0) + oroSeries, idioma)} left · ${(col.sobresAbiertos || 0) + 1} packs opened`) });
        await interaction.editReply({ embeds: [fin], components: [fila], allowedMentions: { parse: [] } });
    }
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
    const col = (await ColeccionMascotas.findOne({ guildId: interaction.guildId, userId: quien.id }).select('cartas sobresAbiertos seriesCompletas').lean()) || { cartas: [] };
    const cartas = col.cartas || [];
    const porRareza = {}; for (const c of cartas) { const r = K.def(c.id).rareza; porRareza[r] = (porRareza[r] || 0) + 1; }
    const png = await require('./cartasArte.js').album(cartas, { titulo: t(idioma, `Álbum de ${quien.username} · ${cartas.length}/${K.ANIME.size}`, `${quien.username}’s album · ${cartas.length}/${K.ANIME.size}`), idioma }).catch(() => null);
    const e = new EmbedBuilder().setColor('#8b5cf6').setTitle(t(idioma, `🃏 Álbum de ${quien.username}`, `🃏 ${quien.username}’s album`))
        .setDescription([
            t(idioma, `**${cartas.length}** de ${K.ANIME.size} cartas · ${col.sobresAbiertos || 0} sobres abiertos`, `**${cartas.length}** of ${K.ANIME.size} cards · ${col.sobresAbiertos || 0} packs opened`),
            Object.keys(K.RAREZAS).filter((r) => porRareza[r]).map((r) => `${rz(r, idioma)} ${porRareza[r]}`).join(' · '),
            cartas.length ? '' : t(idioma, 'Consigue cartas con `/carta abrir`.', 'Get cards with `/card open`.'),
            (col.seriesCompletas || []).length ? t(idioma, `📚 Colecciones completas (${col.seriesCompletas.length}): ${col.seriesCompletas.slice(0, 8).join(', ')}${col.seriesCompletas.length > 8 ? '…' : ''}`, `📚 Complete collections (${col.seriesCompletas.length}): ${col.seriesCompletas.slice(0, 8).join(', ')}${col.seriesCompletas.length > 8 ? '…' : ''}`) : '',
        ].filter(Boolean).join('\n'));
    const prog = S.progresoSeries(cartas, 6);
    if (prog.length) e.addFields({ name: t(idioma, '📚 Casi completas (premio y +25 % de fuerza al acabarlas)', '📚 Almost complete (reward and +25% power when finished)'), value: prog.map((x) => `${'▰'.repeat(Math.round((x.tienes / x.total) * 8))}${'▱'.repeat(8 - Math.round((x.tienes / x.total) * 8))} **${x.serie}** ${x.tienes}/${x.total}`).join('\n').slice(0, 1024) });
    if (png) e.setImage('attachment://album.png');
    const comps = [];
    if (!usuario && cartas.length) {
        const mejores = [...cartas].sort((a, b) => K.RAREZAS[K.def(b.id).rareza].orden - K.RAREZAS[K.def(a.id).rareza].orden).slice(0, 25);
        comps.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('crt_ver').setPlaceholder(t(idioma, '🔍 Ver una carta…', '🔍 See a card…'))
            .addOptions(mejores.map((c) => ({ value: c.id, label: `${K.def(c.id).es} ${'★'.repeat(c.estrellas || 1)}`.slice(0, 100), description: `${t(idioma, K.RAREZAS[K.def(c.id).rareza].es, K.RAREZAS[K.def(c.id).rareza].en)} · ${K.def(c.id).serie}`.slice(0, 100) })))));
    }
    return { embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'album.png' })] : [], components: comps, allowedMentions: { parse: [] } };
}

async function verCarta(guildId, userId, id, idioma) {
    const col = await ColeccionMascotas.findOne({ guildId, userId }).select('cartas seriesCompletas').lean();
    const c = (col?.cartas || []).find((x) => x.id === id);
    if (!c) return { content: t(idioma, 'No tienes esa carta.', 'You don’t have that card.') };
    const d = K.def(id);
    const png = await require('./cartasArte.js').tarjetaCarta(id, { estrellas: c.estrellas || 1, idioma }).catch(() => null);
    const f = S.faltaCarta(c);
    const e = new EmbedBuilder().setColor(K.RAREZAS[d.rareza].color).setTitle(`🃏 ${d.es}`)
        .setDescription([
            `${rz(d.rareza, idioma)} · ${d.serie} · ${'★'.repeat(c.estrellas || 1)}`,
            `${P.ARQUETIPOS[d.poder.tipo].emoji} **${t(idioma, d.poder.es, d.poder.en)}**`,
            P.textoEfecto(P.efectoCarta(id, c.estrellas || 1, null, (col.seriesCompletas || []).includes(d.serie) ? S.SINERGIA : 0), idioma),
            (col.seriesCompletas || []).includes(d.serie) ? t(idioma, `📚 Colección de ${d.serie} completa: +25 % de fuerza`, `📚 ${d.serie} collection complete: +25% power`) : '',
            f ? t(idioma, `⏳ Se recarga en ${Math.ceil(f / 60)} h`, `⏳ Recharges in ${Math.ceil(f / 60)} h`) : t(idioma, '✅ Lista para usar en tu mascota (`/compi` → 🃏).', '✅ Ready to use on your pet (`/companion` → 🃏).'),
        ].filter(Boolean).join('\n'));
    if (png) e.setImage('attachment://carta.png');
    return { embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'carta.png' })] : [] };
}

// Enseñar una carta en el canal (1.25.0).
async function mostrar(interaction, id, idioma) {
    const v = await verCarta(interaction.guildId, interaction.user.id, id, idioma);
    if (!v.embeds) return v;
    v.embeds[0].setTitle(t(idioma, `🃏 ${interaction.user.displayName || interaction.user.username} enseña: ${K.def(id).es}`, `🃏 ${interaction.user.displayName || interaction.user.username} shows: ${K.def(id).en}`));
    v.embeds[0].setDescription(v.embeds[0].data.description.split('\n').filter((l) => !l.startsWith('⏳') && !l.startsWith('✅')).join('\n'));
    return { ...v, allowedMentions: { parse: [] } };
}

// Regalar una copia de una carta a otra persona (1.25.0). Hasta REGALOS_DIA al día.
async function regalar(interaction, idioma, destino, id) {
    if (!destino || destino.bot || destino.id === interaction.user.id) return { error: t(idioma, 'Elige a otra persona (no un bot).', 'Pick someone else (not a bot).') };
    const dia = new Date().toISOString().slice(0, 10);
    const yo = await ColeccionMascotas.findOne({ guildId: interaction.guildId, userId: interaction.user.id }).lean();
    if (!yo || !(yo.cartas || []).some((c) => c.id === id)) return { error: t(idioma, 'No tienes esa carta.', 'You don’t have that card.') };
    const hoy = yo.regalosHoy?.dia === dia ? yo.regalosHoy.n || 0 : 0;
    if (hoy >= S.REGALOS_DIA) return { error: t(idioma, `Ya has regalado ${S.REGALOS_DIA} cartas hoy. Mañana más.`, `You’ve already gifted ${S.REGALOS_DIA} cards today. More tomorrow.`) };
    const suyo = await ColeccionMascotas.findOneAndUpdate({ guildId: interaction.guildId, userId: destino.id }, { $setOnInsert: { guildId: interaction.guildId, userId: destino.id } }, { upsert: true, returnDocument: 'after' }).lean();
    const r = S.regalar(yo.cartas, suyo.cartas || [], id);
    if (r.fallo) return { error: t(idioma, 'No tienes esa carta.', 'You don’t have that card.') };
    // Solo si mis cartas no han cambiado a la vez (evita regalar dos veces la misma copia).
    const yoOk = await ColeccionMascotas.updateOne({ _id: yo._id, cartas: yo.cartas }, { $set: { cartas: r.de, regalosHoy: { dia, n: hoy + 1 } } });
    if (!yoOk.modifiedCount) return { error: t(idioma, 'Prueba otra vez.', 'Try again.') };
    const nuevas = S.nuevasSeries(r.a, suyo.seriesCompletas || []);
    await ColeccionMascotas.updateOne({ _id: suyo._id }, { $set: { cartas: r.a, seriesCompletas: [...(suyo.seriesCompletas || []), ...nuevas.map((n) => n.serie)] } });
    const oro = r.devuelto + nuevas.reduce((a, n) => a + n.oro, 0);
    if (oro) await require('./economia.js').en(interaction.guildId).darOro(destino.id, oro);
    const d = K.def(id);
    return { ok: true, texto: [
        t(idioma, `🎁 <@${interaction.user.id}> le regala a <@${destino.id}> la carta **${d.es}** (${K.RAREZAS[d.rareza].es}).`, `🎁 <@${interaction.user.id}> gifts <@${destino.id}> the card **${d.en}** (${K.RAREZAS[d.rareza].en}).`),
        r.nueva ? t(idioma, '🆕 ¡Es nueva en su álbum!', '🆕 It’s new in their album!') : r.devuelto ? t(idioma, `Ya la tenía al máximo: le llegan 🪙 ${r.devuelto}.`, `They already had it maxed: they get 🪙 ${r.devuelto}.`) : t(idioma, 'Ya la tenía: sube una estrella.', 'They already had it: it gains a star.'),
        ...nuevas.map((n) => t(idioma, `📚 ¡Y completa la colección de **${n.serie}**! +🪙 ${n.oro}`, `📚 And completes the **${n.serie}** collection! +🪙 ${n.oro}`)),
    ].join('\n'), destino: destino.id };
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
        await interaction.editReply(await verCarta(interaction.guildId, interaction.user.id, interaction.values[0], idioma));
        return true;
    }
    return false;
}

module.exports = { mostrar, regalar, abrir, verAlbum, verCarta, embedProbabilidades, manejar, activas, textoApagadas };
