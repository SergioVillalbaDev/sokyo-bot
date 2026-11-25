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

// 1.32.0: cuánto falta para la épica segura (la piedad, a la vista).
const textoPiedad = (sinEpica, idioma) => { const f = S.PIEDAD - (sinEpica || 0); return f <= 1 ? t(idioma, '🍀 ¡El próximo trae épica segura!', '🍀 Next one has a guaranteed epic!') : t(idioma, `🍀 Épica segura en ${f} sobres`, `🍀 Guaranteed epic in ${f} packs`); };
const textoDestacada = (idioma) => { const d = S.serieDestacada(require('./combateNucleo.js').semanaDe()); return d ? t(idioma, `🔥 Serie de la semana: **${d}** (sus cartas salen ×${S.SERIE_DESTACADA_X})`, `🔥 Series of the week: **${d}** (its cards drop ×${S.SERIE_DESTACADA_X})`) : ''; };

async function abrir({ interaction, cfg, idioma, sobre, ticket = null }) {
    if (!activas(cfg)) return { error: textoApagadas(idioma) };
    const def = S.SOBRES[sobre];
    if (!def) return { error: t(idioma, 'Ese sobre no existe.', 'That pack doesn’t exist.') };
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const economia = require('./economia.js').en(guildId);
    // 1.29.0: con un ticket del pase el sobre sale gratis.
    const Pase = require('./pase.js');
    if (ticket && !(await Pase.usarTicket(guildId, userId, ticket))) return { error: t(idioma, 'Ya no tienes ese ticket. Mira los tuyos con `/jugar pase`.', 'You no longer have that ticket. See yours with `/games pass`.') };
    const saldo = ticket ? (await economia.obtenerUsuario(userId)).balance : await economia.cobrar(userId, def.precio);
    if (saldo === null) return { error: t(idioma, `No tienes 🪙 ${fmt(def.precio, idioma)} para el ${def.es.toLowerCase()}.`, `You don’t have 🪙 ${fmt(def.precio, idioma)} for the ${def.en.toLowerCase()}.`) };
    const quitados = require('./cofres.js').quitadosDe(cfg);
    let r = null; let col;
    // Se calcula sobre el álbum y se guarda solo si nadie lo ha tocado a la vez.
    for (let intento = 0; intento < 5 && !r; intento++) {
        col = await ColeccionMascotas.findOneAndUpdate({ guildId, userId }, { $setOnInsert: { guildId, userId } }, { upsert: true, returnDocument: 'after' }).lean();
        const x = S.abrirSobre(col, sobre, undefined, quitados, S.serieDestacada(require('./combateNucleo.js').semanaDe()));
        const cartas = [...(col.cartas || [])];
        for (const c of x.cartas.filter((y) => y.id)) {
            const ya = cartas.find((y) => y.id === c.id);
            if (ya) ya.estrellas = c.estrellas; else cartas.push({ id: c.id, estrellas: 1, primera: new Date() });
        }
        // ¿Completa alguna serie? Premio una sola vez (1.25.0).
        const nuevas = S.nuevasSeries(cartas, col.seriesCompletas || []);
        const holos = x.cartas.filter((y) => y.id && y.holo).map((y) => y.id);
        const hecho = await ColeccionMascotas.updateOne({ _id: col._id, sobresAbiertos: col.sobresAbiertos || 0 },
            { $set: { cartas, sinEpicaCartas: x.sinEpica, seriesCompletas: [...(col.seriesCompletas || []), ...nuevas.map((n) => n.serie)] }, $inc: { sobresAbiertos: 1, gastadoSobres: def.precio, polvo: x.polvo || 0 }, ...(holos.length ? { $addToSet: { holos: { $each: holos } } } : {}) });
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
            .setFooter({ text: `${t(idioma, `Te quedan 🪙 ${fmt(saldo + (r.devuelto || 0) + oroSeries, idioma)} · ${(col.sobresAbiertos || 0) + 1} sobres abiertos`, `You have 🪙 ${fmt(saldo + (r.devuelto || 0) + oroSeries, idioma)} left · ${(col.sobresAbiertos || 0) + 1} packs opened`)} · ${textoPiedad(r.sinEpica, idioma)}` });
        // Lo que sale, también en texto oculto (‖…‖): sin destripar la animación y para quien tiene los GIF en pausa.
        const resumen = `||${r.cartas.map((c) => (c.quitada ? `🪙 +${c.devuelto}` : `${c.holo ? '🌈 ' : ''}${K.def(c.id).es} ${c.nuevo ? '🆕' : '★'.repeat(c.estrellas)}`)).join(' · ')}||`;
        e.setDescription([ticket ? t(idioma, '🎫 Abierto con un ticket del pase: ¡gratis!', '🎫 Opened with a pass ticket: free!') : '', resumen, textoDestacada(idioma)].filter(Boolean).join('\n'));
        await interaction.editReply({ embeds: [e], files: [new AttachmentBuilder(gif, { name: 'sobre.gif' })], components: [fila], allowedMentions: { parse: [] } });
        const extras = [
            r.piedad ? t(idioma, '🍀 ¡Sobre de la suerte! (épica asegurada)', '🍀 Lucky pack! (epic guaranteed)') : '',
            ...r.cartas.filter((c) => c.id && c.holo).map((c) => t(idioma, `🌈 **¡${K.def(c.id).es} te ha salido HOLOGRÁFICA!** Brilla y pega un 5 % más en combate.`, `🌈 **${K.def(c.id).en} came out HOLOGRAPHIC!** It shines and hits 5% harder in battle.`)),
            r.polvo ? t(idioma, `✨ Repetidas al máximo: +${r.polvo} de polvo (créate la carta que quieras con \`/jugar carta crear\`).`, `✨ Maxed duplicates: +${r.polvo} dust (craft any card with \`/games card craft\`).`) : '',
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
                t(idioma, 'Úsalas sobre tu mascota con `/compi` → 🃏 o `/jugar carta usar`.', 'Use them on your pet with `/companion` → 🃏 or `/games card use`.'),
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
            cartas.length ? '' : t(idioma, 'Consigue cartas con `/jugar carta abrir`.', 'Get cards with `/games card open`.'),
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
    const col = await ColeccionMascotas.findOne({ guildId, userId }).select('cartas seriesCompletas holos mazo').lean();
    const c = (col?.cartas || []).find((x) => x.id === id);
    if (!c) return { content: t(idioma, 'No tienes esa carta.', 'You don’t have that card.') };
    const d = K.def(id);
    const holo = (col.holos || []).includes(id);
    const png = await require('./cartasArte.js').tarjetaCarta(id, { estrellas: c.estrellas || 1, idioma, holo }).catch(() => null);
    const C = require('./combateNucleo.js');
    const tec = C.tecnicaDe(id, C.fuerzaCarta(id, c.estrellas || 1, holo ? 0.05 : 0));
    const f = S.faltaCarta(c);
    const e = new EmbedBuilder().setColor(K.RAREZAS[d.rareza].color).setTitle(`🃏 ${d.es}`)
        .setDescription([
            `${rz(d.rareza, idioma)} · ${d.serie} · ${'★'.repeat(c.estrellas || 1)}`,
            `${P.ARQUETIPOS[d.poder.tipo].emoji} **${t(idioma, d.poder.es, d.poder.en)}**`,
            P.textoEfecto(P.efectoCarta(id, c.estrellas || 1, null, (col.seriesCompletas || []).includes(d.serie) ? S.SINERGIA : 0), idioma),
            (col.seriesCompletas || []).includes(d.serie) ? t(idioma, `📚 Colección de ${d.serie} completa: +25 % de fuerza`, `📚 ${d.serie} collection complete: +25% power`) : '',
            t(idioma, `⚔️ **En combate:** ${tec.es} — ${C.textoTecnica(tec, 'es')}`, `⚔️ **In battle:** ${tec.en} — ${C.textoTecnica(tec, 'en')}`),
            (col.mazo || []).includes(id) ? t(idioma, '🎴 Está en tu mazo de combate.', '🎴 It’s in your battle deck.') : t(idioma, '🎴 Ponla en tu mazo con `/jugar combate mazo`.', '🎴 Put it in your deck with `/games fight deck`.'),
            holo ? t(idioma, '🌈 **Holográfica** (+5 % en combate)', '🌈 **Holographic** (+5% in battle)') : '',
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

// 1.32.0: desencantar una copia → polvo. Las legendarias o mejores piden confirmar (botón).
async function desencantar(guildId, userId, id, idioma, { confirmado = false } = {}) {
    const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
    const c = (col?.cartas || []).find((x) => x.id === id);
    if (!c) return { error: t(idioma, 'No tienes esa carta.', 'You don’t have that card.') };
    const d = K.def(id);
    if (K.RAREZAS[d.rareza].orden >= 3 && !confirmado) {
        return { confirmar: { content: t(idioma, `⚠️ ¿Seguro que quieres desencantar **${d.es}** (${K.RAREZAS[d.rareza].es})? Te da ✨ ${S.POLVO[d.rareza]} de polvo${(c.estrellas || 1) <= 1 ? ' y **la pierdes**' : ' y baja una estrella'}.`, `⚠️ Sure you want to disenchant **${d.en}** (${K.RAREZAS[d.rareza].en})? You get ✨ ${S.POLVO[d.rareza]} dust${(c.estrellas || 1) <= 1 ? ' and **lose it**' : ' and it loses a star'}.`),
            components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`crt_des:${id}`).setStyle(ButtonStyle.Danger).setLabel(t(idioma, 'Sí, desencantar', 'Yes, disenchant')).setEmoji('✨'))], flags: 64 } };
    }
    const r = S.desencantar(col.cartas, id);
    if (r.fallo) return { error: t(idioma, 'No tienes esa carta.', 'You don’t have that card.') };
    const mazo = r.ultima ? (col.mazo || []).filter((x) => x !== id) : col.mazo || [];
    const holos = r.ultima ? (col.holos || []).filter((x) => x !== id) : col.holos || [];
    const ok = await ColeccionMascotas.updateOne({ _id: col._id, cartas: col.cartas }, { $set: { cartas: r.cartas, mazo, holos }, $inc: { polvo: r.polvo } });
    if (!ok.modifiedCount) return { error: t(idioma, 'Prueba otra vez.', 'Try again.') };
    return { ok: true, texto: t(idioma, `✨ Has desencantado **${d.es}**: +${r.polvo} de polvo (tienes ${(col.polvo || 0) + r.polvo}).${r.ultima ? '' : ' Baja una estrella.'}`, `✨ You disenchanted **${d.en}**: +${r.polvo} dust (you have ${(col.polvo || 0) + r.polvo}).${r.ultima ? '' : ' It loses a star.'}`) };
}
// Crear una carta con polvo.
async function crear(guildId, userId, id, idioma) {
    const col = await ColeccionMascotas.findOneAndUpdate({ guildId, userId }, { $setOnInsert: { guildId, userId } }, { upsert: true, returnDocument: 'after' }).lean();
    const r = S.crear(col.cartas || [], id, col.polvo || 0);
    const d = K.def(id);
    if (r.fallo === 'noExiste') return { error: t(idioma, 'Esa carta no existe.', 'That card doesn’t exist.') };
    if (r.fallo === 'divina') return { error: t(idioma, 'La carta divina no se puede crear: solo sale en los sobres.', 'The divine card can’t be crafted: it only comes from packs.') };
    if (r.fallo === 'max') return { error: t(idioma, 'Ya la tienes con 5 ★.', 'You already have it at 5 ★.') };
    if (r.fallo === 'polvo') return { error: t(idioma, `Te falta polvo: cuesta ✨ ${r.coste} y tienes ${col.polvo || 0}. Desencanta repetidas con \`/jugar carta desencantar\`.`, `Not enough dust: it costs ✨ ${r.coste} and you have ${col.polvo || 0}. Disenchant duplicates with \`/games card disenchant\`.`) };
    const nuevas = S.nuevasSeries(r.cartas, col.seriesCompletas || []);
    const ok = await ColeccionMascotas.updateOne({ _id: col._id, cartas: col.cartas || [], polvo: { $gte: r.coste } }, { $set: { cartas: r.cartas, seriesCompletas: [...(col.seriesCompletas || []), ...nuevas.map((n) => n.serie)] }, $inc: { polvo: -r.coste } });
    if (!ok.modifiedCount) return { error: t(idioma, 'Prueba otra vez.', 'Try again.') };
    const oro = nuevas.reduce((a, n) => a + n.oro, 0);
    if (oro) await require('./economia.js').en(guildId).darOro(userId, oro);
    return { ok: true, id, texto: [
        t(idioma, `🪄 Has creado **${d.es}** (${K.RAREZAS[d.rareza].es}) con ✨ ${r.coste} de polvo.${r.nueva ? ' 🆕' : ' Sube una estrella.'}`, `🪄 You crafted **${d.en}** (${K.RAREZAS[d.rareza].en}) with ✨ ${r.coste} dust.${r.nueva ? ' 🆕' : ' It gains a star.'}`),
        ...nuevas.map((n) => t(idioma, `📚 ¡Colección de **${n.serie}** completa! +🪙 ${n.oro}`, `📚 **${n.serie}** collection complete! +🪙 ${n.oro}`)),
    ].join('\n') };
}
// Intercambios (1.32.0): la oferta vive 5 minutos en memoria (si el bot se reinicia, no se ha movido nada).
const ofertas = new Map();
function proponerIntercambio(interaction, idioma, destino, mia, suya) {
    if (!destino || destino.bot || destino.id === interaction.user.id) return { error: t(idioma, 'Elige a otra persona (no un bot).', 'Pick someone else (not a bot).') };
    if (mia === suya) return { error: t(idioma, 'Elige cartas distintas.', 'Pick different cards.') };
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    ofertas.set(id, { guildId: interaction.guildId, de: interaction.user.id, a: destino.id, mia, suya, hasta: Date.now() + 5 * 60000 });
    for (const [k, v] of ofertas) if (v.hasta < Date.now()) ofertas.delete(k);
    const dm = K.def(mia); const ds = K.def(suya);
    return { ok: true, msg: {
        content: t(idioma, `🔁 <@${destino.id}>, <@${interaction.user.id}> te propone un intercambio:\n➡️ Te da **${dm.es}** (${K.RAREZAS[dm.rareza].es}, ${dm.serie})\n⬅️ A cambio de tu **${ds.es}** (${K.RAREZAS[ds.rareza].es}, ${ds.serie})\n*Caduca en 5 minutos.*`, `🔁 <@${destino.id}>, <@${interaction.user.id}> offers you a trade:\n➡️ Gives you **${dm.en}** (${K.RAREZAS[dm.rareza].en}, ${dm.serie})\n⬅️ For your **${ds.en}** (${K.RAREZAS[ds.rareza].en}, ${ds.serie})\n*Expires in 5 minutes.*`),
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`crt_int:ok:${id}`).setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Aceptar', 'Accept')).setEmoji('🤝'),
            new ButtonBuilder().setCustomId(`crt_int:no:${id}`).setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Rechazar', 'Decline')),
        )],
        allowedMentions: { users: [destino.id] },
    } };
}
async function resolverIntercambio(interaction, idioma, id, acepta) {
    const o = ofertas.get(id);
    if (!o || o.hasta < Date.now()) { ofertas.delete(id); return { texto: t(idioma, '⌛ Esta oferta ha caducado.', '⌛ This offer has expired.'), cerrar: true }; }
    if (interaction.user.id !== o.a && !(interaction.user.id === o.de && !acepta)) return { error: t(idioma, 'Esta oferta no es para ti.', 'This offer isn’t for you.') };
    ofertas.delete(id);
    if (!acepta) return { texto: t(idioma, '❌ Intercambio rechazado o cancelado.', '❌ Trade declined or cancelled.'), cerrar: true };
    const dia = new Date().toISOString().slice(0, 10);
    const A = await ColeccionMascotas.findOne({ guildId: o.guildId, userId: o.de }).lean();
    const B = await ColeccionMascotas.findOne({ guildId: o.guildId, userId: o.a }).lean();
    const hoyA = A?.intercambiosHoy?.dia === dia ? A.intercambiosHoy.n || 0 : 0;
    const hoyB = B?.intercambiosHoy?.dia === dia ? B.intercambiosHoy.n || 0 : 0;
    if (hoyA >= S.INTERCAMBIOS_DIA || hoyB >= S.INTERCAMBIOS_DIA) return { texto: t(idioma, `Hoy ya se han hecho ${S.INTERCAMBIOS_DIA} intercambios. Mañana más.`, `${S.INTERCAMBIOS_DIA} trades already done today. More tomorrow.`), cerrar: true };
    const r = S.intercambiar(A?.cartas || [], B?.cartas || [], o.mia, o.suya);
    if (r.fallo) return { texto: t(idioma, '❌ Alguien ya no tiene la carta que ofrecía.', '❌ Someone no longer has the card they offered.'), cerrar: true };
    // Las dos colecciones, solo si no han cambiado; si la segunda falla, se deshace la primera.
    const quitarMazo = (col, cartas) => (col.mazo || []).filter((x) => cartas.some((c) => c.id === x));
    const okA = await ColeccionMascotas.updateOne({ _id: A._id, cartas: A.cartas }, { $set: { cartas: r.a, mazo: quitarMazo(A, r.a), intercambiosHoy: { dia, n: hoyA + 1 } }, $inc: { polvo: r.polvoA } });
    if (!okA.modifiedCount) return { texto: t(idioma, 'Prueba otra vez.', 'Try again.'), cerrar: true };
    const okB = await ColeccionMascotas.updateOne({ _id: B._id, cartas: B.cartas }, { $set: { cartas: r.b, mazo: quitarMazo(B, r.b), intercambiosHoy: { dia, n: hoyB + 1 } }, $inc: { polvo: r.polvoB } });
    if (!okB.modifiedCount) {
        await ColeccionMascotas.updateOne({ _id: A._id }, { $set: { cartas: A.cartas, mazo: A.mazo || [], intercambiosHoy: A.intercambiosHoy || { dia, n: hoyA } }, $inc: { polvo: -r.polvoA } });
        return { texto: t(idioma, 'Prueba otra vez.', 'Try again.'), cerrar: true };
    }
    // Las holográficas viajan con la carta (si era la última copia).
    for (const [de, a, carta] of [[A, B, o.mia], [B, A, o.suya]]) {
        if ((de.holos || []).includes(carta) && !(de.cartas.find((c) => c.id === carta)?.estrellas > 1)) {
            await ColeccionMascotas.updateOne({ _id: de._id }, { $pull: { holos: carta } });
            await ColeccionMascotas.updateOne({ _id: a._id }, { $addToSet: { holos: carta } });
        }
    }
    const dm = K.def(o.mia); const ds = K.def(o.suya);
    return { texto: t(idioma, `🤝 ¡Intercambio hecho! <@${o.de}> recibe **${ds.es}** y <@${o.a}> recibe **${dm.es}**.`, `🤝 Trade done! <@${o.de}> gets **${ds.en}** and <@${o.a}> gets **${dm.en}**.`), cerrar: true, ok: true };
}

function embedProbabilidades(idioma) {
    const e = new EmbedBuilder().setColor('#8b5cf6').setTitle(t(idioma, '🃏 Sobres de cartas de anime', '🃏 Anime card packs'))
        .setDescription(t(idioma, `Cada sobre trae **${S.CARTAS_POR_SOBRE} cartas**. Las cartas se usan sobre tu mascota para potenciarla (hasta ${S.CARTAS_DIA} al día; cada una se recarga en ${S.ESPERA_CARTA_H} h) o como técnicas en los combates (/jugar combate mazo). Las repetidas suben estrellas y la carta es más fuerte. Cada ${S.PIEDAD} sobres sin épica, el siguiente la trae segura.`,
            `Each pack has **${S.CARTAS_POR_SOBRE} cards**. Cards power up your pet (up to ${S.CARTAS_DIA} a day; each recharges in ${S.ESPERA_CARTA_H} h) or work as battle techniques (/games fight deck). Duplicates add stars and make the card stronger. Every ${S.PIEDAD} packs without an epic, the next one guarantees it.`));
    if (textoDestacada(idioma)) e.addFields({ name: '🔥', value: textoDestacada(idioma) });
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
    if (interaction.isButton() && id.startsWith('crt_des:')) {
        const r = await desencantar(interaction.guildId, interaction.user.id, id.slice(8), idioma, { confirmado: true });
        await interaction.update({ content: r.error ? `❌ ${r.error}` : r.texto, components: [] });
        return true;
    }
    if (interaction.isButton() && id.startsWith('crt_int:')) {
        const [, que, oid] = id.split(':');
        const r = await resolverIntercambio(interaction, idioma, oid, que === 'ok');
        if (r.error) { await interaction.reply({ content: `❌ ${r.error}`, flags: 64 }); return true; }
        await interaction.update({ content: `${interaction.message.content.split('\n')[0]}\n${r.texto}`, components: [], allowedMentions: { parse: [] } });
        return true;
    }
    if (interaction.isStringSelectMenu() && id === 'crt_ver') {
        await interaction.deferReply({ flags: 64 });
        await interaction.editReply(await verCarta(interaction.guildId, interaction.user.id, interaction.values[0], idioma));
        return true;
    }
    return false;
}

module.exports = { textoPiedad, textoDestacada, desencantar, crear, proponerIntercambio, resolverIntercambio, ofertas, mostrar, regalar, abrir, verAlbum, verCarta, embedProbabilidades, manejar, activas, textoApagadas };
