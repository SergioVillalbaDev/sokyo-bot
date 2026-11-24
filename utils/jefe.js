// Jefe semanal del servidor (1.32.0). Cada lunes (UTC) aparece un jefe con mucha vida (según cuánta
// gente juega aquí). Todos le pegan con su compañero y su mazo: ATAQUES_JEFE_DIA ataques al día por
// persona, cada uno con su animación. Si cae, quien da el golpe final sale anunciado y se reparten los
// premios al momento; si llega el lunes sin caer, se reparte la mitad. Reglas en combateNucleo.js.
// Mensaje fijo en el canal del combate (cfg.combate.canalId, o el del casino) con el botón «Atacar».
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const JefeServidor = require('../models/JefeServidor.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const C = require('./combateNucleo.js');
const { t } = require('./i18n.js');

const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const diaDe = (ahora = Date.now()) => new Date(ahora).toISOString().slice(0, 10);
const finSemana = (semana) => new Date(Date.parse(`${semana}T00:00:00Z`) + 7 * 86400000);
const canalDe = (cfg) => cfg?.combate?.canalId || cfg?.casino?.canalId || null;
const activo = (cfg) => !!(require('./combate.js').activos(cfg) && cfg?.combate?.jefe !== false);
const ultimaEdicion = new Map(); // guildId → cuándo se rehízo la imagen del mensaje fijo

// El jefe de esta semana (lo crea si no existe). La vida depende de cuánta gente tiene mascotas aquí.
async function deEstaSemana(guildId, cfg, ahora = Date.now()) {
    const semana = C.semanaDe(ahora);
    const ya = await JefeServidor.findOne({ guildId, semana }).lean();
    if (ya) return ya;
    const jugadores = await ColeccionMascotas.countDocuments({ guildId, 'mascotas.0': { $exists: true } });
    const j = C.jefeDeSemana(`${guildId}:${semana}`, jugadores);
    try {
        return (await JefeServidor.create({ guildId, semana, clave: j.clave, max: j.vida, vida: j.vida, def: j.def, canalId: canalDe(cfg) })).toObject();
    } catch { return JefeServidor.findOne({ guildId, semana }).lean(); } // otro lo creó a la vez
}
const ranking = (j) => Object.entries(j.danios || {}).map(([userId, danio]) => ({ userId, danio })).sort((a, b) => b.danio - a.danio);

async function vista(guild, j, idioma) {
    const def = C.JEFES[j.clave];
    const r = ranking(j);
    const nombres = await Promise.all(r.slice(0, 6).map(async (x) => (await guild.members.fetch(x.userId).catch(() => null))?.displayName || '???'));
    const png = await require('./combateArte.js').tarjetaJefe({
        id: def.id, el: def.el, titulo: t(idioma, 'JEFE DE LA SEMANA', 'BOSS OF THE WEEK'), nombre: t(idioma, def.es, def.en),
        vida: j.vida, max: j.max, vidaTexto: `${fmt(Math.max(0, j.vida), idioma)} / ${fmt(j.max, idioma)}`,
        lineaFin: j.muerto ? t(idioma, '💀 ¡Derrotado! Premios repartidos.', '💀 Defeated! Rewards handed out.') : t(idioma, 'Se va el domingo a medianoche (UTC)', 'Leaves Sunday at midnight (UTC)'),
        rankingTitulo: t(idioma, '⚔️ Los que más pegan', '⚔️ Top damage'), ranking: r.slice(0, 6).map((x, i) => ({ nombre: nombres[i], danioTexto: fmt(x.danio, idioma) })),
        nadie: t(idioma, 'Nadie le ha pegado aún. ¡Sé el primero!', 'Nobody has hit it yet. Be the first!'), muerto: !!j.muerto,
    }).catch(() => null);
    const el = C.ELEMENTOS[def.el];
    const debil = Object.entries(C.GANA_A).filter(([, bs]) => bs.includes(def.el)).map(([a]) => C.ELEMENTOS[a].emoji).join(' ');
    const e = new EmbedBuilder().setColor(j.muerto ? '#64748b' : '#a21caf').setTitle(`🐉 ${t(idioma, def.es, def.en)} ${el.emoji}`)
        .setDescription([
            j.muerto ? t(idioma, `💀 **¡Derrotado!**${j.matador ? ` Golpe final de <@${j.matador}>.` : ''} El lunes llega otro.`, `💀 **Defeated!**${j.matador ? ` Final blow by <@${j.matador}>.` : ''} Another one arrives on Monday.`)
                : t(idioma, `Todo el servidor contra él: **${C.ATAQUES_JEFE_DIA} ataques al día** cada uno con tu compañero y tu mazo. Si cae antes de <t:${Math.floor(finSemana(j.semana).getTime() / 1000)}:R>, premios para todos los que le hayan pegado (y más para los que más).`, `The whole server against it: **${C.ATAQUES_JEFE_DIA} attacks a day** each with your companion and deck. If it falls before <t:${Math.floor(finSemana(j.semana).getTime() / 1000)}:R>, rewards for everyone who hit it (and more for the top hitters).`),
            debil ? t(idioma, `💡 Le hacen más daño: ${debil}`, `💡 Extra damage from: ${debil}`) : '',
            !png ? `❤️ ${fmt(j.vida, idioma)} / ${fmt(j.max, idioma)}` : '',
        ].filter(Boolean).join('\n'));
    if (png) e.setImage('attachment://jefe.png');
    const comps = j.muerto ? [] : [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`cbt_jefe:${j.semana}`).setEmoji('⚔️').setStyle(ButtonStyle.Danger).setLabel(t(idioma, '¡Atacar!', 'Attack!')))];
    return { embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'jefe.png' })] : [], components: comps, allowedMentions: { parse: [] } };
}

// Un ataque. Devuelve el mensaje (público) con la animación, o { error }.
async function atacar(interaction, cfg, idioma) {
    const guildId = interaction.guildId; const userId = interaction.user.id;
    if (!activo(cfg)) return { error: t(idioma, '🐉 El jefe semanal no está activado aquí.', '🐉 The weekly boss isn’t turned on here.') };
    const nombre = interaction.member?.displayName || interaction.user.username;
    const yo = await require('./combate.js').luchadorDe(guildId, userId, nombre, cfg);
    if (!yo) return { error: t(idioma, '🥚 Necesitas un compañero para atacar. Consigue uno con `/cofre abrir`.', '🥚 You need a companion to attack. Get one with `/chest open`.') };
    const j = await deEstaSemana(guildId, cfg);
    if (j.muerto) return { error: t(idioma, '💀 El jefe de esta semana ya ha caído. ¡El lunes llega otro!', '💀 This week’s boss has fallen. Another arrives on Monday!') };
    const dia = diaDe();
    const mios = j.ataques?.[userId]?.dia === dia ? j.ataques[userId].n || 0 : 0;
    if (mios >= C.ATAQUES_JEFE_DIA) return { error: t(idioma, `😮‍💨 Ya has atacado ${C.ATAQUES_JEFE_DIA} veces hoy. ¡Mañana más!`, `😮‍💨 You’ve attacked ${C.ATAQUES_JEFE_DIA} times today. More tomorrow!`) };
    const def = C.JEFES[j.clave];
    const golpe = C.atacarJefe(yo.s, yo.l.mazo, { id: def.id, el: def.el, def: j.def });
    // Gasta el ataque y quita la vida a la vez (solo si nadie lo ha matado ni has atacado a la vez).
    const filtro = { _id: j._id, muerto: null, ...(mios ? { [`ataques.${userId}.n`]: mios, [`ataques.${userId}.dia`]: dia } : { $or: [{ [`ataques.${userId}`]: { $exists: false } }, { [`ataques.${userId}.dia`]: { $ne: dia } }] }) };
    const nuevo = await JefeServidor.findOneAndUpdate(filtro, { $set: { [`ataques.${userId}`]: { dia, n: mios + 1 } }, $inc: { vida: -golpe.total, [`danios.${userId}`]: golpe.total } }, { returnDocument: 'after' }).lean();
    if (!nuevo) return { error: t(idioma, 'Prueba otra vez.', 'Try again.') };
    const vidaAntes = nuevo.vida + golpe.total;
    let finalBlow = false;
    if (nuevo.vida <= 0) {
        const r = await JefeServidor.updateOne({ _id: j._id, muerto: null }, { $set: { muerto: new Date(), matador: userId, vida: 0 } });
        finalBlow = !!r.modifiedCount;
    }
    await ColeccionMascotas.updateOne({ guildId, userId }, { $inc: { 'cbt.jefe': 1 } }).catch(() => {});
    const delPase = await require('./pase.js').registrar(guildId, userId, [['jefe', 1]], { idioma }).catch(() => []);
    const gif = await require('./combateArte.js').gifAtaqueJefe({ luchador: yo.s, nombre, jefe: { id: def.id, el: def.el, max: j.max }, jefeNombre: t(idioma, def.es, def.en), vidaAntes: Math.max(0, vidaAntes), total: golpe.total, golpes: golpe.golpes, titulo: '', idioma }).catch((e) => { console.warn('GIF jefe:', e.message); return null; });
    const lineas = golpe.golpes.map((g) => `${g.tipo === 'especial' ? g.emoji : g.tipo === 'carta' ? '🃏' : '⚔️'} ${g.nombre ? `${t(idioma, g.nombre.es, g.nombre.en)}: ` : ''}**-${fmt(g.danio, idioma)}**${g.crit ? t(idioma, ' ¡crítico!', ' critical!') : ''}${g.fe > 1 ? ' 💥' : ''}`);
    const e = new EmbedBuilder().setColor('#a21caf').setTitle(t(idioma, `⚔️ ${nombre} ataca a ${def.es}`, `⚔️ ${nombre} attacks ${def.en}`))
        .setDescription([
            ...lineas,
            t(idioma, `**Total: ${fmt(golpe.total, idioma)}** · le quedan ❤️ ${fmt(Math.max(0, nuevo.vida), idioma)} · ataques hoy ${mios + 1}/${C.ATAQUES_JEFE_DIA}`, `**Total: ${fmt(golpe.total, idioma)}** · ❤️ ${fmt(Math.max(0, nuevo.vida), idioma)} left · attacks today ${mios + 1}/${C.ATAQUES_JEFE_DIA}`),
            finalBlow ? t(idioma, `\n💀 **¡${nombre} da el GOLPE FINAL!** El jefe cae y hay premios para todos.`, `\n💀 **${nombre} lands the FINAL BLOW!** The boss falls and there are rewards for everyone.`) : '',
            ...delPase,
        ].filter(Boolean).join('\n'));
    if (gif) e.setImage('attachment://ataque.gif');
    if (finalBlow) await repartir(interaction.client, await JefeServidor.findById(j._id).lean()).catch((x) => console.error('Jefe (repartir):', x));
    else refrescar(interaction.guild, cfg).catch(() => {});
    return { embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'ataque.gif' })] : [], allowedMentions: { parse: [] } };
}

// Rehace la imagen del mensaje fijo (como mucho una vez cada 30 s).
async function refrescar(guild, cfg, forzar = false) {
    const j = await JefeServidor.findOne({ guildId: guild.id, semana: C.semanaDe() }).lean();
    if (!j?.mensajeId || !j.canalId) return;
    if (!forzar && Date.now() - (ultimaEdicion.get(guild.id) || 0) < 30000) return;
    ultimaEdicion.set(guild.id, Date.now());
    const canal = guild.channels.cache.get(j.canalId);
    const msg = canal?.isTextBased() ? await canal.messages.fetch(j.mensajeId).catch(() => null) : null;
    if (msg) await msg.edit({ ...await vista(guild, j, t(cfg, 'es', 'en')), attachments: [] }).catch(() => {});
}

// Premios: oro según el daño, tickets a todos si cae y extra al podio. Una sola vez (repartido).
async function repartir(client, j) {
    const r = await JefeServidor.updateOne({ _id: j._id, repartido: false }, { $set: { repartido: true } });
    if (!r.modifiedCount) return;
    const premios = C.premiosJefe(ranking(j), !!j.muerto, j.max);
    const eco = require('./economia.js').en(j.guildId);
    for (const p of premios) {
        await eco.darOro(p.userId, p.oro).catch(() => {});
        const inc = {};
        for (const [k, v] of Object.entries(p.tickets)) inc[`tickets.${k}`] = v;
        if (Object.keys(inc).length) await ColeccionMascotas.updateOne({ guildId: j.guildId, userId: p.userId }, { $inc: inc }).catch(() => {});
    }
    const guild = client.guilds.cache.get(j.guildId);
    const cfg = await ServidorConfig.findOne({ guildId: j.guildId }).lean().catch(() => null);
    const canal = guild?.channels.cache.get(j.canalId || canalDe(cfg));
    if (!guild || !canal?.isTextBased()) return;
    const idioma = t(cfg, 'es', 'en');
    const def = C.JEFES[j.clave];
    const podio = premios.slice(0, 3).map((p, i) => `${['🥇', '🥈', '🥉'][i]} <@${p.userId}> · ⚔️ ${fmt(j.danios[p.userId], idioma)} · 🪙 ${fmt(p.oro, idioma)}`).join('\n');
    await canal.send({ content: [
        j.muerto ? t(idioma, `💀 **¡${def.es} ha caído!**${j.matador ? ` Golpe final de <@${j.matador}>.` : ''}`, `💀 **${def.en} has fallen!**${j.matador ? ` Final blow by <@${j.matador}>.` : ''}`) : t(idioma, `🌫️ **${def.es} se ha marchado** sin caer. Premios a medias para quien le pegó.`, `🌫️ **${def.en} left** without falling. Half rewards for those who hit it.`),
        podio,
        premios.length > 3 ? t(idioma, `…y premio para los otros ${premios.length - 3}. 🎫 Los tickets están en \`/pase\`.`, `…and rewards for the other ${premios.length - 3}. 🎫 Tickets are in \`/pass\`.`) : (premios.length ? t(idioma, '🎫 Los tickets están en `/pase`.', '🎫 Tickets are in `/pass`.') : ''),
    ].filter(Boolean).join('\n'), allowedMentions: { users: premios.slice(0, 3).map((p) => p.userId) } }).catch(() => {});
    await refrescar(guild, cfg, true).catch(() => {});
}

// Programador (cada 5 min): reparte los de semanas pasadas y saca el de esta semana en los servidores activos.
async function barrerJefes(client) {
    const semana = C.semanaDe();
    for (const j of await JefeServidor.find({ repartido: false, semana: { $lt: semana } }).lean()) await repartir(client, j).catch((e) => console.error('Jefe (repartir):', e.message));
    const cfgs = await ServidorConfig.find({ 'casino.activo': true, 'combate.activo': { $ne: false }, 'combate.jefe': { $ne: false } }).lean();
    for (const cfg of cfgs) {
        const guild = client.guilds.cache.get(cfg.guildId);
        const canalId = canalDe(cfg);
        if (!guild || !canalId) continue;
        const j = await deEstaSemana(cfg.guildId, cfg);
        if (j.mensajeId) continue;
        const canal = guild.channels.cache.get(canalId);
        if (!canal?.isTextBased()) continue;
        const idioma = t(cfg, 'es', 'en');
        const msg = await canal.send(await vista(guild, j, idioma)).catch(() => null);
        if (msg) await JefeServidor.updateOne({ _id: j._id, mensajeId: null }, { $set: { mensajeId: msg.id, canalId } });
    }
}

module.exports = { deEstaSemana, vista, atacar, refrescar, repartir, barrerJefes, ranking, activo };
