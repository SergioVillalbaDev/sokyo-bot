// Liga Sokyo (1.14.0): clasificación mensual de los servidores que la activan.
// Puntos:
//   · votos     → +10 por cada voto en top.gg de alguien del servidor
//   · impulsos  → 1 punto por cada 20 de oro que gastan sus miembros (/comunidad liga impulsar,
//                 tope de 2000 de oro al día por persona)
//   · combates  → la mascota del servidor combate cada día contra la de otro servidor
//                 de fuerza parecida (o contra una criatura salvaje): +30 si gana, +10 si pierde
// Divisiones: Bronce, Plata, Oro, Diamante y Leyenda. Al acabar el mes, el podio sale
// destacado todo el mes siguiente en el directorio /servidores y en la Red Sokyo.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const LigaServidor = require('../models/LigaServidor.js');
const LigaMes = require('../models/LigaMes.js');
const ImpulsoLiga = require('../models/ImpulsoLiga.js');
const CombateMascota = require('../models/CombateMascota.js');
const Mascota = require('../models/Mascota.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const N = require('./mascotaNucleo.js');
const { t } = require('./i18n.js');

const PUNTOS_VOTO = 10;
const ORO_POR_PUNTO = 20;
const TOPE_ORO_DIA = 2000;
const PUNTOS_VICTORIA = 30;
const PUNTOS_DERROTA = 10;
const HORA_ANUNCIO = 17; // UTC: se emparejan y se anuncian
const HORA_COMBATE = 19; // UTC: se resuelven
const MEDALLAS = ['🥇', '🥈', '🥉'];

const DIVISIONES = [
    { id: 'bronce', desde: 0, emoji: '🥉', es: 'Bronce', en: 'Bronze', color: '#b45309' },
    { id: 'plata', desde: 200, emoji: '🥈', es: 'Plata', en: 'Silver', color: '#94a3b8' },
    { id: 'oro', desde: 600, emoji: '🥇', es: 'Oro', en: 'Gold', color: '#eab308' },
    { id: 'diamante', desde: 1500, emoji: '💎', es: 'Diamante', en: 'Diamond', color: '#38bdf8' },
    { id: 'leyenda', desde: 4000, emoji: '👑', es: 'Leyenda', en: 'Legend', color: '#a855f7' },
];
function divisionDe(puntos) {
    let d = DIVISIONES[0];
    for (const x of DIVISIONES) if ((puntos || 0) >= x.desde) d = x;
    return d;
}
const siguienteDivision = (puntos) => DIVISIONES.find((d) => d.desde > (puntos || 0)) || null;

const mesAnterior = (d = new Date()) => N.mesClave(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 15)));
const finDeMes = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

async function sumarPuntos(guildId, campo, puntos, mes = N.mesClave()) {
    const n = Math.round(puntos || 0);
    if (!n) return null;
    return LigaServidor.findOneAndUpdate({ guildId, mes }, { $inc: { puntos: n, [campo]: n } }, { upsert: true, returnDocument: 'after' });
}

// Un voto en top.gg: suma para cada servidor de la Liga donde esté quien vota.
async function alVotar(client, userId) {
    const cfgs = await ServidorConfig.find({ 'liga.activo': true }).select('guildId').lean();
    let n = 0;
    for (const cfg of cfgs) {
        const guild = client.guilds.cache.get(cfg.guildId);
        if (!guild) continue;
        const m = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
        if (!m) continue;
        await sumarPuntos(guild.id, 'votos', PUNTOS_VOTO).catch(() => {});
        n++;
    }
    return n;
}

// Impulsar con oro (tope diario por persona, en todos los servidores juntos).
async function impulsar(guildId, userId, cfg, oro, idioma) {
    if (!cfg?.liga?.activo) return { error: t(idioma, '🏆 Este servidor no está en la Liga Sokyo.', '🏆 This server isn’t in the Sokyo League.') };
    const cantidad = Math.floor((parseInt(oro, 10) || 0) / ORO_POR_PUNTO) * ORO_POR_PUNTO;
    if (cantidad < ORO_POR_PUNTO) return { error: t(idioma, `Lo mínimo son 🪙 ${ORO_POR_PUNTO} (1 punto).`, `The minimum is 🪙 ${ORO_POR_PUNTO} (1 point).`) };
    const dia = N.diaClave();
    // Reserva del tope diario.
    await ImpulsoLiga.updateOne({ userId, dia }, { $setOnInsert: { oro: 0 } }, { upsert: true }).catch(() => {});
    const reserva = await ImpulsoLiga.findOneAndUpdate({ userId, dia, oro: { $lte: TOPE_ORO_DIA - cantidad } }, { $inc: { oro: cantidad } }, { returnDocument: 'after' });
    if (!reserva) {
        const hoy = await ImpulsoLiga.findOne({ userId, dia }).lean();
        const queda = Math.max(0, TOPE_ORO_DIA - (hoy?.oro || 0));
        return { error: t(idioma, `Hoy solo puedes impulsar 🪙 ${queda} más (tope de 🪙 ${TOPE_ORO_DIA} al día).`, `You can only boost 🪙 ${queda} more today (🪙 ${TOPE_ORO_DIA} daily cap).`) };
    }
    const saldo = await require('./economia.js').en(guildId).cobrar(userId, cantidad);
    if (saldo === null) {
        await ImpulsoLiga.updateOne({ userId, dia }, { $inc: { oro: -cantidad } });
        return { error: t(idioma, `No tienes 🪙 ${cantidad}.`, `You don’t have 🪙 ${cantidad}.`) };
    }
    // Compañero equipado (1.21.0): sus puntos extra (redondeando hacia abajo).
    const v = await require('./cofres.js').ventajasUsuario(guildId, userId).catch(() => null);
    const base = cantidad / ORO_POR_PUNTO;
    const extraCompa = v?.liga > 0 ? Math.floor(base * v.liga) : 0;
    const puntos = base + extraCompa;
    const doc = await sumarPuntos(guildId, 'impulsos', puntos);
    return { ok: true, puntos, cantidad, saldo, extraCompa, total: doc?.puntos || puntos };
}

async function posicionDe(guildId, mes = N.mesClave()) {
    const yo = await LigaServidor.findOne({ guildId, mes }).lean();
    const puntos = yo?.puntos || 0;
    const delante = await LigaServidor.countDocuments({ mes, puntos: { $gt: puntos } });
    return { puntos, posicion: delante + 1, doc: yo };
}

const datosGuild = (client, id) => {
    const g = client.guilds.cache.get(id);
    return { id, nombre: g ? g.name : '—', icono: g ? g.iconURL({ size: 64 }) : null };
};

async function clasificacion(client, mes = N.mesClave(), limite = 10) {
    const lista = await LigaServidor.find({ mes, puntos: { $gt: 0 } }).sort({ puntos: -1 }).limit(limite).lean();
    return lista.map((x, i) => ({ ...datosGuild(client, x.guildId), posicion: i + 1, puntos: x.puntos, division: divisionDe(x.puntos).id }));
}

// ¿Está destacado este mes (podio del anterior)?
async function destacados() {
    const lista = await LigaServidor.find({ destacadoHasta: { $gt: new Date() } }).select('guildId posicion').lean();
    return new Map(lista.map((x) => [x.guildId, x.posicion]));
}

function embedClasificacion(top, idioma, { mio = null, titulo = null } = {}) {
    const fmt = (n) => Number(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
    const lineas = top.map((x) => {
        const d = DIVISIONES.find((v) => v.id === x.division) || DIVISIONES[0];
        return `${MEDALLAS[x.posicion - 1] || `**${x.posicion}.**`} **${x.nombre}** — ${fmt(x.puntos)} pts · ${d.emoji} ${t(idioma, d.es, d.en)}`;
    });
    const e = new EmbedBuilder()
        .setColor('#a855f7')
        .setTitle(titulo || t(idioma, '🏆 Liga Sokyo · este mes', '🏆 Sokyo League · this month'))
        .setDescription(lineas.join('\n') || t(idioma, 'Todavía nadie tiene puntos este mes. ¡Sed los primeros!', 'Nobody has points yet this month. Be the first!'));
    if (mio) {
        const d = divisionDe(mio.puntos);
        const sig = siguienteDivision(mio.puntos);
        e.addFields({
            name: t(idioma, '📍 Vuestro servidor', '📍 Your server'),
            value: [
                t(idioma, `**${mio.posicion}.º** con **${fmt(mio.puntos)}** puntos · ${d.emoji} ${d.es}`, `**#${mio.posicion}** with **${fmt(mio.puntos)}** points · ${d.emoji} ${d.en}`),
                sig ? t(idioma, `Faltan ${fmt(sig.desde - mio.puntos)} para ${sig.emoji} ${sig.es}`, `${fmt(sig.desde - mio.puntos)} to go for ${sig.emoji} ${sig.en}`) : '',
                mio.doc ? t(idioma, `🗳️ Votos ${fmt(mio.doc.votos)} · 🚀 Impulsos ${fmt(mio.doc.impulsos)} · ⚔️ Combates ${fmt(mio.doc.combates)}`, `🗳️ Votes ${fmt(mio.doc.votos)} · 🚀 Boosts ${fmt(mio.doc.impulsos)} · ⚔️ Battles ${fmt(mio.doc.combates)}`) : '',
            ].filter(Boolean).join('\n'),
        });
    }
    e.setFooter({ text: t(idioma, `Puntos: votar por Sokyo, /comunidad liga impulsar y los combates de la mascota · el podio sale destacado el mes siguiente · acaba ${finDeMes().toISOString().slice(0, 10)}`, `Points: vote for Sokyo, /community league boost and pet battles · the podium gets featured next month · ends ${finDeMes().toISOString().slice(0, 10)}`) });
    return e;
}

async function canalLiga(client, cfg) {
    const guild = client.guilds.cache.get(cfg.guildId);
    if (!guild) return null;
    const id = cfg.liga?.canalId || cfg.mascota?.canalId;
    const canal = id ? guild.channels.cache.get(id) : null;
    return canal?.isTextBased() ? canal : null;
}

// ---------------------------------------------------------------------------
// Cierre del mes
// ---------------------------------------------------------------------------
async function cerrarMes(client, ahora = new Date()) {
    const mes = mesAnterior(ahora);
    const participantes = await LigaServidor.find({ mes, puntos: { $gt: 0 } }).sort({ puntos: -1 }).lean();
    try { await LigaMes.create({ mes, podio: participantes.slice(0, 3).map((x) => x.guildId) }); } catch { return false; } // ya cerrado
    if (!participantes.length) return true;
    const hasta = finDeMes(ahora);
    await LigaServidor.bulkWrite(participantes.map((x, i) => ({
        updateOne: { filter: { _id: x._id }, update: { $set: { posicion: i + 1, ...(i < 3 ? { destacadoHasta: hasta } : {}) } } },
    })));
    try { require('./paginaPublica.js').olvidarDirectorio(); } catch { /* opcional */ }
    const top = participantes.slice(0, 10).map((x, i) => ({ ...datosGuild(client, x.guildId), posicion: i + 1, puntos: x.puntos, division: divisionDe(x.puntos).id }));
    const posiciones = new Map(participantes.map((x, i) => [x.guildId, { puntos: x.puntos, posicion: i + 1 }]));
    const cfgs = await ServidorConfig.find({ 'liga.activo': true }).select('guildId idioma liga mascota').lean();
    for (const cfg of cfgs) {
        const canal = await canalLiga(client, cfg);
        if (!canal) continue;
        const mio = posiciones.get(cfg.guildId);
        const d = mio ? divisionDe(mio.puntos) : null;
        const texto = mio
            ? (mio.posicion <= 3
                ? t(cfg, `🏁 **¡La Liga de ${mes} ha terminado y estáis en el podio: ${MEDALLAS[mio.posicion - 1]} ${mio.posicion}.º!** Saldréis destacados todo este mes en el directorio de servidores y en la Red Sokyo. ¡Enhorabuena!`, `🏁 **The ${mes} League is over and you made the podium: ${MEDALLAS[mio.posicion - 1]} #${mio.posicion}!** You’ll be featured all month in the server directory and the Sokyo Network. Congrats!`)
                : t(cfg, `🏁 **La Liga de ${mes} ha terminado.** Habéis quedado **${mio.posicion}.º** en ${d.emoji} **${d.es}** con ${mio.puntos} puntos. ¡Empieza un mes nuevo!`, `🏁 **The ${mes} League is over.** You finished **#${mio.posicion}** in ${d.emoji} **${d.en}** with ${mio.puntos} points. A new month starts now!`))
            : t(cfg, `🏁 **La Liga de ${mes} ha terminado.** Este mes podéis entrar: votad por Sokyo, usad \`/comunidad liga impulsar\` y cuidad a la mascota para sus combates.`, `🏁 **The ${mes} League is over.** This month you can join in: vote for Sokyo, use \`/community league boost\` and look after your pet for its battles.`);
        await canal.send({ content: texto, embeds: [embedClasificacion(top, cfg, { titulo: t(cfg, `🏆 Clasificación final · ${mes}`, `🏆 Final standings · ${mes}`) })], allowedMentions: { parse: [] } }).catch(() => {});
    }
    return true;
}

// ---------------------------------------------------------------------------
// Combates de mascotas
// ---------------------------------------------------------------------------
const nombreLado = (l, idioma) => (l.guildId ? l.nombre : t(idioma, N.SALVAJE.es, N.SALVAJE.en));
const emojiLado = (l) => (l.guildId ? (N.ESPECIES[l.especie]?.emoji || '🐾') : N.SALVAJE.emoji);
const ataqueDe = (l, idioma) => { const a = l.guildId ? N.ESPECIES[l.especie]?.ataque : N.SALVAJE.ataque; return a ? t(idioma, a.es, a.en) : '💥'; };

function anuncioCombate(combate, lado, idioma, client) {
    const yo = combate[lado];
    const otro = combate[lado === 'a' ? 'b' : 'a'];
    const servidorOtro = otro.guildId ? (client.guilds.cache.get(otro.guildId)?.name || '—') : null;
    const hora = Math.floor(new Date(combate.hora).getTime() / 1000);
    const e = new EmbedBuilder()
        .setColor('#ef4444')
        .setTitle(t(idioma, '⚔️ ¡Combate de mascotas hoy!', '⚔️ Pet battle today!'))
        .setDescription(t(idioma,
            `${emojiLado(yo)} **${yo.nombre}** (nv ${yo.nivel}) contra ${emojiLado(otro)} **${nombreLado(otro, idioma)}**${otro.nivel ? ` (nv ${otro.nivel})` : ''}${servidorOtro ? ` de **${servidorOtro}**` : ''}.\nEmpieza <t:${hora}:R>. **Cada ánimo da +2 % de fuerza** (hasta +30 %).`,
            `${emojiLado(yo)} **${yo.nombre}** (lv ${yo.nivel}) vs ${emojiLado(otro)} **${nombreLado(otro, idioma)}**${otro.nivel ? ` (lv ${otro.nivel})` : ''}${servidorOtro ? ` from **${servidorOtro}**` : ''}.\nStarts <t:${hora}:R>. **Each cheer gives +2% power** (up to +30%).`))
        .addFields({ name: t(idioma, '📣 Ánimos', '📣 Cheers'), value: String((yo.animos || []).length), inline: true }, { name: t(idioma, '💪 Fuerza', '💪 Power'), value: `${yo.poder} vs ${otro.poder}`, inline: true });
    // 1.33.0: táctica votada (piedra-papel-tijera: la que gana a la del rival da +15 % de fuerza; el rival no la ve).
    const votos = Object.values(yo.votos || {});
    const cuenta = (k) => votos.filter((v) => v === k).length;
    const va = N.tacticaElegida(yo.votos);
    e.addFields({ name: t(idioma, '🧠 Táctica (votad)', '🧠 Tactic (vote)'), value: va ? `${N.TACTICAS[va].emoji} ${t(idioma, N.TACTICAS[va].es, N.TACTICAS[va].en)}` : t(idioma, 'Ninguna aún (o empate)', 'None yet (or a tie)'), inline: true });
    e.setFooter({ text: t(idioma, `🗡️ Ataque gana a 🌀 Astucia · 🌀 Astucia gana a 🛡️ Defensa · 🛡️ Defensa gana a 🗡️ Ataque · acertar da +${Math.round(N.TACTICA_VENTAJA * 100)} %`, `🗡️ Attack beats 🌀 Cunning · 🌀 Cunning beats 🛡️ Defence · 🛡️ Defence beats 🗡️ Attack · guessing right gives +${Math.round(N.TACTICA_VENTAJA * 100)}%`) });
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`liga_animar:${combate._id}:${lado}`).setEmoji('📣').setLabel(t(idioma, '¡Animar!', 'Cheer!')).setStyle(ButtonStyle.Success),
        ...Object.entries(N.TACTICAS).map(([k, x]) => new ButtonBuilder().setCustomId(`liga_tac:${combate._id}:${lado}:${k}`).setEmoji(x.emoji).setLabel(`${t(idioma, x.es, x.en)} (${cuenta(k)})`).setStyle(va === k ? ButtonStyle.Primary : ButtonStyle.Secondary)),
    );
    return { embeds: [e], components: [fila], allowedMentions: { parse: [] } };
}

async function prepararCombates(client, ahora = new Date()) {
    if (ahora.getUTCHours() < HORA_ANUNCIO || ahora.getUTCHours() >= HORA_COMBATE) return 0;
    const dia = N.diaClave(ahora);
    try { await LigaMes.create({ mes: `combates:${dia}` }); } catch { return 0; } // ya preparados hoy
    const cfgs = await ServidorConfig.find({ 'liga.activo': true, 'liga.combates': { $ne: false } }).select('guildId idioma liga mascota').lean();
    const porGuild = new Map(cfgs.map((c) => [c.guildId, c]));
    const mascotas = await Mascota.find({ guildId: { $in: cfgs.map((c) => c.guildId) }, estado: 'viva', hibernando: { $ne: true } }).lean();
    const lista = mascotas.filter((m) => client.guilds.cache.has(m.guildId)).map((m) => ({ guildId: m.guildId, poder: N.poderDe(m), m }));
    const hora = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), HORA_COMBATE));
    const lado = (x) => ({ guildId: x.guildId, nombre: x.m.nombre, especie: x.m.especie, nivel: x.m.nivel, poder: x.poder, animos: [], stats: x.m.stats || {}, accesorio: x.m.accesorio || null });
    let n = 0;
    for (const [x, y] of N.emparejar(lista)) {
        const b = y ? lado(y) : { guildId: null, nombre: null, especie: null, nivel: null, poder: N.salvajePara(x.poder).poder, animos: [] };
        const combate = await CombateMascota.create({ dia, hora, a: lado(x), b });
        n++;
        for (const l of ['a', 'b']) {
            const gid = combate[l].guildId;
            if (!gid) continue;
            const cfg = porGuild.get(gid);
            const canal = cfg ? await canalLiga(client, cfg) : null;
            if (!canal) continue;
            const msg = await canal.send(anuncioCombate(combate, l, cfg, client)).catch(() => null);
            if (msg) await CombateMascota.updateOne({ _id: combate._id }, { $set: { [`${l}.canalId`]: msg.channelId, [`${l}.mensajeId`]: msg.id } });
        }
    }
    return n;
}

async function animar(interaction) {
    const [, id, lado] = interaction.customId.split(':');
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    const c = await CombateMascota.findById(id).catch(() => null);
    if (!c || c.estado !== 'pendiente' || !['a', 'b'].includes(lado) || c[lado].guildId !== interaction.guildId) {
        return interaction.reply({ content: t(idioma, 'Este combate ya ha terminado.', 'This battle is already over.'), flags: 64 });
    }
    const r = await CombateMascota.findOneAndUpdate({ _id: c._id, estado: 'pendiente', [`${lado}.animos`]: { $ne: interaction.user.id } }, { $addToSet: { [`${lado}.animos`]: interaction.user.id } }, { returnDocument: 'after' });
    if (!r) return interaction.reply({ content: t(idioma, '📣 ¡Ya has animado! Pídeselo a los demás.', '📣 You already cheered! Ask the others.'), flags: 64 });
    const n = r[lado].animos.length;
    await interaction.update(anuncioCombate(r, lado, cfg, interaction.client)).catch(() => {});
    await interaction.followUp({ content: t(idioma, `📣 ¡Ánimo enviado! Ya sois ${n} (+${Math.round(N.extraAnimos(n) * 100)} % de fuerza).`, `📣 Cheer sent! You’re ${n} now (+${Math.round(N.extraAnimos(n) * 100)}% power).`), flags: 64 }).catch(() => {});
    return true;
}

// 1.33.0: votar la táctica de tu servidor (se puede cambiar de voto hasta que empiece).
async function votarTactica(interaction) {
    const [, id, lado, tac] = interaction.customId.split(':');
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    if (!N.TACTICAS[tac] || !['a', 'b'].includes(lado)) return interaction.reply({ content: '❌', flags: 64 });
    const r = await CombateMascota.findOneAndUpdate({ _id: id, estado: 'pendiente', [`${lado}.guildId`]: interaction.guildId }, { $set: { [`${lado}.votos.${interaction.user.id}`]: tac } }, { returnDocument: 'after' }).catch(() => null);
    if (!r) {
        const sigue = await CombateMascota.exists({ _id: id, estado: 'pendiente' }).catch(() => null);
        return interaction.reply({ content: sigue ? t(idioma, 'Solo vota la táctica el servidor de esa mascota.', 'Only that pet’s server votes its tactic.') : t(idioma, 'Este combate ya ha terminado.', 'This battle is already over.'), flags: 64 });
    }
    await interaction.update(anuncioCombate(r, lado, cfg, interaction.client)).catch(() => {});
    const x = N.TACTICAS[tac];
    await interaction.followUp({ content: t(idioma, `🧠 Has votado ${x.emoji} **${x.es}** (${x.desc.es}). Puedes cambiarlo hasta que empiece.`, `🧠 You voted ${x.emoji} **${x.en}** (${x.desc.en}). You can change it until it starts.`), flags: 64 }).catch(() => {});
    return true;
}

// Cuenta el combate ronda a ronda desde el lado de cada servidor: quién gana la ronda,
// con qué ataque, y los golpes críticos, esquivas y habilidades especiales.
function relato(combate, lado, idioma) {
    const yo = combate[lado];
    const otro = combate[lado === 'a' ? 'b' : 'a'];
    const { ESPECIALES } = require('./mascotaExtras.js');
    const nombreDe = (l) => (l === yo ? yo.nombre : nombreLado(otro, idioma));
    const especial = (l) => { const e = ESPECIALES[l.especie]; return e ? t(idioma, e.es, e.en) : ''; };
    const detalle = (l, ev) => {
        if (ev === 'critico') return t(idioma, `💥 ¡golpe crítico de ${nombreDe(l)}!`, `💥 critical hit by ${nombreDe(l)}!`);
        if (ev === 'esquiva') return t(idioma, `💨 ${nombreDe(l)} esquiva`, `💨 ${nombreDe(l)} dodges`);
        if (ev === 'especial') return t(idioma, `🌟 ${nombreDe(l)} usa su habilidad: *${especial(l)}*`, `🌟 ${nombreDe(l)} uses its skill: *${especial(l)}*`);
        return '';
    };
    return combate.rondas.map((r, i) => {
        const ganaA = r.a >= r.b;
        const quien = (ganaA ? 'a' : 'b') === lado ? yo : otro;
        const alto = Math.max(r.a, r.b); const bajo = Math.min(r.a, r.b);
        const extras = [detalle(combate.a, r.eventoA), detalle(combate.b, r.eventoB)].filter(Boolean);
        const base = t(idioma,
            `**Ronda ${i + 1}:** ${emojiLado(quien)} ${nombreDe(quien)} gana con *${ataqueDe(quien, idioma)}* (${alto} contra ${bajo})`,
            `**Round ${i + 1}:** ${emojiLado(quien)} ${nombreDe(quien)} wins with *${ataqueDe(quien, idioma)}* (${alto} vs ${bajo})`);
        return extras.length ? `${base}\n-# ${extras.join(' · ')}` : base;
    }).join('\n');
}

async function premiarMascota(guildId, gana, rival = '?') {
    const m = await Mascota.findOne({ guildId, estado: 'viva' });
    if (!m) return null;
    const r = N.sumarXp(m.nivel, m.xp, gana ? 40 : 15);
    const racha = gana ? (m.contadores?.racha || 0) + 1 : 0;
    const nuevo = await Mascota.findOneAndUpdate({ _id: m._id }, {
        // Pelear cansa: gasta energía (más si pierde).
        $set: { nivel: r.nivel, xp: r.xp, 'contadores.racha': racha, 'contadores.mejorRacha': Math.max(racha, m.contadores?.mejorRacha || 0), energia: Math.max(0, (m.energia ?? 100) - (gana ? 10 : 20)) },
        $inc: gana ? { 'contadores.victorias': 1 } : { 'contadores.derrotas': 1 },
    }, { returnDocument: 'after' });
    require('./mascota.js').ponerCache(nuevo);
    const vida = require('./mascotaVida.js');
    await vida.recordar(guildId, 'combate', { gana, rival });
    if (gana && [3, 5, 10, 20].includes(racha)) await vida.recordar(guildId, 'racha', { n: racha });
    return nuevo;
}

async function resolverCombates(client, ahora = new Date()) {
    const pendientes = await CombateMascota.find({ estado: 'pendiente', hora: { $lte: ahora } }).limit(200);
    for (const c of pendientes) {
        // 1.33.0: la táctica votada (la salvaje elige una al azar, fija por combate).
        const tac = { a: c.a.guildId ? N.tacticaElegida(c.a.votos) : Object.keys(N.TACTICAS)[Math.floor(N.azarCon(`${c._id}t`)() * 3)], b: c.b.guildId ? N.tacticaElegida(c.b.votos) : Object.keys(N.TACTICAS)[Math.floor(N.azarCon(`${c._id}t`)() * 3)] };
        const fuerza = (l) => ({ poder: c[l].poder, animos: (c[l].animos || []).length, stats: c[l].stats || {}, especie: c[l].especie, mult: N.multTactica(tac[l], tac[l === 'a' ? 'b' : 'a']) });
        const r = N.combatir(fuerza('a'), fuerza('b'), N.azarCon(String(c._id)));
        const hecho = await CombateMascota.findOneAndUpdate({ _id: c._id, estado: 'pendiente' }, { $set: { estado: 'hecho', ganador: r.ganador, rondas: r.rondas, 'a.tactica': tac.a, 'b.tactica': tac.b } }, { returnDocument: 'after' });
        if (!hecho) continue;
        for (const l of ['a', 'b']) {
            const gid = hecho[l].guildId;
            if (!gid) continue;
            const gana = hecho.ganador === l;
            await sumarPuntos(gid, 'combates', gana ? PUNTOS_VICTORIA : PUNTOS_DERROTA).catch(() => {});
            const rivalLado = hecho[l === 'a' ? 'b' : 'a'];
            await premiarMascota(gid, gana, rivalLado.guildId ? rivalLado.nombre : (N.SALVAJE.es)).catch(() => {});
            const cfg = await ServidorConfig.findOne({ guildId: gid }).select('guildId idioma liga mascota').lean();
            const canal = cfg ? await canalLiga(client, cfg) : null;
            if (canal && hecho[l].mensajeId) {
                const msg = await canal.messages.fetch(hecho[l].mensajeId).catch(() => null);
                if (msg) await msg.edit({ components: [] }).catch(() => {});
            }
            if (!canal) continue;
            const yo = hecho[l]; const otro = hecho[l === 'a' ? 'b' : 'a'];
            const e = new EmbedBuilder()
                .setColor(gana ? '#22c55e' : '#64748b')
                .setTitle(gana
                    ? t(cfg, `🏆 ¡${yo.nombre} gana el combate!`, `🏆 ${yo.nombre} wins the battle!`)
                    : t(cfg, `💔 ${yo.nombre} ha perdido esta vez`, `💔 ${yo.nombre} lost this time`))
                .setDescription([`${emojiLado(yo)} **${yo.nombre}** vs ${emojiLado(otro)} **${nombreLado(otro, cfg)}**`, textoTacticas(hecho, l, cfg), '', relato(hecho, l, cfg)].filter((x) => x !== null).join('\n'))
                .setFooter({ text: gana
                    ? t(cfg, `+${PUNTOS_VICTORIA} puntos de Liga · +40 XP para la mascota · ${(yo.animos || []).length} ánimos`, `+${PUNTOS_VICTORIA} League points · +40 pet XP · ${(yo.animos || []).length} cheers`)
                    : t(cfg, `+${PUNTOS_DERROTA} puntos de Liga por luchar · +15 XP · mañana, revancha`, `+${PUNTOS_DERROTA} League points for fighting · +15 XP · rematch tomorrow`) });
            // 1.33.0: el combate, animado.
            const gif = await require('./ligaArte.js').gifCombateLiga(hecho, l, { idioma: cfg?.idioma === 'en' ? 'en' : 'es' }).catch((err) => { console.warn('GIF Liga:', err.message); return null; });
            if (gif) e.setImage('attachment://combate.gif');
            await canal.send({ embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'combate.gif' })] : [], allowedMentions: { parse: [] } }).catch(() => {});
        }
    }
}
// Qué táctica llevó cada uno y si acertó.
function textoTacticas(c, lado, idioma) {
    const yo = c[lado]; const otro = c[lado === 'a' ? 'b' : 'a'];
    const nom = (k) => (k ? `${N.TACTICAS[k].emoji} ${t(idioma, N.TACTICAS[k].es, N.TACTICAS[k].en)}` : t(idioma, 'sin táctica', 'no tactic'));
    const acierto = N.multTactica(yo.tactica, otro.tactica) > 1 ? t(idioma, ` · ✅ ¡acertasteis! (+${Math.round(N.TACTICA_VENTAJA * 100)} %)`, ` · ✅ good call! (+${Math.round(N.TACTICA_VENTAJA * 100)}%)`)
        : N.multTactica(otro.tactica, yo.tactica) > 1 ? t(idioma, ' · ❌ el rival os la ganó', ' · ❌ the rival countered you') : '';
    return t(idioma, `🧠 Vuestra táctica: ${nom(yo.tactica)} · la del rival: ${nom(otro.tactica)}${acierto}`, `🧠 Your tactic: ${nom(yo.tactica)} · the rival’s: ${nom(otro.tactica)}${acierto}`);
}

async function barrerLiga(client) {
    const ahora = new Date();
    try { await cerrarMes(client, ahora); } catch (e) { console.error('Liga · cierre:', e.message); }
    try { await prepararCombates(client, ahora); } catch (e) { console.error('Liga · combates:', e.message); }
    try { await resolverCombates(client, ahora); } catch (e) { console.error('Liga · resolver:', e.message); }
}

// Para el panel y /comunidad liga.
async function estado(client, guildId) {
    const mes = N.mesClave();
    const mio = await posicionDe(guildId, mes);
    const top = await clasificacion(client, mes, 10);
    const total = await LigaServidor.countDocuments({ mes, puntos: { $gt: 0 } });
    const combates = await CombateMascota.find({ $or: [{ 'a.guildId': guildId }, { 'b.guildId': guildId }] }).sort({ hora: -1 }).limit(7).lean();
    const anterior = await LigaServidor.findOne({ guildId, mes: mesAnterior() }).lean();
    const d = divisionDe(mio.puntos);
    const sig = siguienteDivision(mio.puntos);
    return {
        mes, fin: finDeMes(), diasRestantes: Math.max(0, Math.ceil((finDeMes() - Date.now()) / 86400000)), total,
        puntos: mio.puntos, posicion: mio.puntos > 0 ? mio.posicion : null,
        desglose: { votos: mio.doc?.votos || 0, impulsos: mio.doc?.impulsos || 0, combates: mio.doc?.combates || 0 },
        division: d.id, siguiente: sig ? { id: sig.id, faltan: sig.desde - mio.puntos } : null,
        top,
        anterior: anterior ? { mes: anterior.mes, posicion: anterior.posicion, puntos: anterior.puntos, destacado: !!(anterior.destacadoHasta && new Date(anterior.destacadoHasta) > new Date()) } : null,
        combates: combates.map((c) => {
            const lado = c.a.guildId === guildId ? 'a' : 'b';
            const otro = c[lado === 'a' ? 'b' : 'a'];
            return {
                id: String(c._id), dia: c.dia, hora: c.hora, estado: c.estado, gana: c.estado === 'hecho' ? c.ganador === lado : null,
                yo: { nombre: c[lado].nombre, especie: c[lado].especie, animos: (c[lado].animos || []).length, poder: c[lado].poder },
                rival: { nombre: otro.guildId ? otro.nombre : null, especie: otro.especie, servidor: otro.guildId ? (client.guilds.cache.get(otro.guildId)?.name || '—') : null, poder: otro.poder },
            };
        }),
        reglas: { puntosVoto: PUNTOS_VOTO, oroPorPunto: ORO_POR_PUNTO, topeOroDia: TOPE_ORO_DIA, victoria: PUNTOS_VICTORIA, derrota: PUNTOS_DERROTA, horaCombate: HORA_COMBATE, divisiones: DIVISIONES.map((x) => ({ id: x.id, desde: x.desde })) },
    };
}

module.exports = {
    DIVISIONES, PUNTOS_VOTO, ORO_POR_PUNTO, TOPE_ORO_DIA, PUNTOS_VICTORIA, PUNTOS_DERROTA, HORA_ANUNCIO, HORA_COMBATE,
    divisionDe, siguienteDivision, mesAnterior, finDeMes, sumarPuntos, alVotar, impulsar, posicionDe, clasificacion,
    destacados, embedClasificacion, cerrarMes, prepararCombates, animar, votarTactica, textoTacticas, resolverCombates, barrerLiga, estado, anuncioCombate,
};
