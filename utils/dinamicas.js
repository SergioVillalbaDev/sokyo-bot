// Comunidad · Dinámicas: mini-juegos automáticos para mantener vivo el servidor.
// La CONFIGURACIÓN vive en ServidorConfig.dinamicas (la edita el panel); aquí va
// la LÓGICA. Cada dinámica reparte recompensas reusando los sistemas que ya
// existen: XP (utils/niveles.aplicarXp, que también anuncia subidas de nivel) y
// oro (utils/economia.darOro).
//
//   · Dinámicas de CHAT  -> las dispara events/messageCreate.js (procesarMensaje):
//       contador, palabra secreta, reto/racha y el "primero en responder" del QOTD.
//   · Dinámicas PROGRAMADAS/INTERACTIVAS -> las dispara el barrido del scheduler
//       (barrerDinamicas): QOTD (publicación), gota de oro, trivia, miembro de la
//       semana y los hitos de miembros del tablón de logros.
//   · Los hitos de NIVEL del tablón -> los dispara niveles.js al subir de nivel
//       (comprobarLogroNivel), por eso es event-driven y no cuesta consultas.
//
// Cada mensaje que publica una dinámica es CONFIGURABLE desde el panel (texto con
// placeholders {user}/{xp}/… + imagen o GIF por URL o subida desde el PC). Los
// helpers urlAbs/rellenar/payloadMensaje resuelven eso.
const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const RegistroMensaje = require('../models/RegistroMensaje.js');
const Contador = require('../models/Contador.js');
const TriviaPregunta = require('../models/TriviaPregunta.js');
const niveles = require('./niveles.js');
const economia = require('./economia.js');
const { getConfigCached } = require('./config.js');
const { t } = require('./i18n.js');

const COLOR = '#5865F2';

// --- Utilidades de fecha (todo en UTC, como el resto del bot) ---
const hoyUTC = () => new Date().toISOString().slice(0, 10);          // 'YYYY-MM-DD'
const ayerUTC = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
// Semana ISO ('YYYY-Www') para el ranking semanal de trivia y el miembro de la semana.
function semanaISO(d = new Date()) {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
const escaparRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- Mensajes configurables: imagen absoluta + placeholders + payload ---
// Las imágenes subidas desde el panel se guardan como '/uploads/xxx' (relativa);
// Discord necesita URL absoluta, así que le anteponemos el dominio público.
function urlAbs(u) {
    if (!u || typeof u !== 'string') return null;
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('/uploads/')) return `${(process.env.FRONTEND_URL || '').replace(/\/$/, '')}${u}`;
    return null;
}
// Sustituye {clave} por su valor (deja intactos los que no conozca).
const rellenar = (texto, vars = {}) => String(texto ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

// Construye el payload de un mensaje configurable. Con imagen -> embed con la
// imagen; sin imagen -> texto plano. Devuelve null si no hay nada que enviar
// (texto vacío y sin imagen), p. ej. el "acierto" opcional del contador.
function payloadMensaje(slot, { color = COLOR, vars = {}, fallback = '', mention } = {}) {
    const texto = rellenar(slot?.texto || fallback, vars);
    const img = urlAbs(slot?.imagen);
    if (!texto && !img) return null;
    const out = {};
    if (img) {
        const embed = new EmbedBuilder().setColor(color);
        if (texto) embed.setDescription(texto);
        embed.setImage(img);
        out.embeds = [embed];
    } else {
        out.content = texto;
    }
    if (mention) out.allowedMentions = { users: [mention] };
    return out;
}

// Reparte una recompensa a un miembro: XP (con su anuncio de subida de nivel y
// los multiplicadores normales) y/o oro. `cfg` es la config del servidor (la
// necesita aplicarXp para la dificultad/anuncios). `canal` es el canal donde
// caer el anuncio de subida si no hay uno fijo configurado.
async function darRecompensa(guild, member, recompensa = {}, cfg = {}, canal = null) {
    const xp = Math.max(0, parseInt(recompensa.xp, 10) || 0);
    const oro = Math.max(0, parseInt(recompensa.oro, 10) || 0);
    try {
        if (xp > 0 && member) await niveles.aplicarXp(guild, member, xp, cfg, canal);
    } catch (e) { console.error('Dinámicas · dar XP:', e.message); }
    try {
        if (oro > 0 && member) await economia.darOro(member.id, oro);
    } catch (e) { console.error('Dinámicas · dar oro:', e.message); }
}

// ============================ CHAT (messageCreate) ============================

// Punto de entrada desde messageCreate. Devuelve `true` si el mensaje queda
// "consumido" (solo el contador, porque su canal es de uso exclusivo) y no debe
// seguir procesándose como comando.
async function procesarMensaje(message, cfg, client) {
    const d = cfg?.dinamicas;
    if (!d) return false;

    // Contador: canal dedicado -> consume el mensaje.
    if (d.contador?.activo && d.contador.canalId && d.contador.canalId === message.channel.id) {
        return await dinContador(message, d.contador, cfg);
    }

    // QOTD: primero en responder en el canal de la pregunta del día.
    if (d.qotd?.activo && d.qotd.canalId && d.qotd.canalId === message.channel.id) {
        await dinQotdRespuesta(message, d.qotd, cfg).catch((e) => console.error('Dinámica QOTD:', e.message));
    }
    // Palabra secreta / caza del tesoro.
    if (d.tesoro?.activo && d.tesoro.palabra) {
        await dinTesoro(message, d.tesoro, cfg).catch((e) => console.error('Dinámica tesoro:', e.message));
    }
    // Reto diario / racha (cuenta mensajes).
    if (d.reto?.activo) {
        await dinReto(message, d.reto, cfg, client).catch((e) => console.error('Dinámica reto:', e.message));
    }
    return false;
}

// --- Contador colaborativo ---
async function dinContador(message, c, cfg) {
    try {
        const content = (message.content || '').trim();
        // Upsert atómico para evitar choques con el índice único en mensajes a la vez.
        const doc = await Contador.findOneAndUpdate(
            { guildId: message.guildId, canalId: message.channel.id },
            { $setOnInsert: { numeroActual: 0 } },
            { upsert: true, returnDocument: 'after' },
        );
        const esperado = doc.numeroActual + 1;
        const color = cfg.colorEmbed || COLOR;

        // No es un número: el canal es solo para contar.
        if (!/^\d+$/.test(content)) {
            if (c.borrarErrores) await message.delete().catch(() => {});
            return true;
        }
        const num = parseInt(content, 10);

        // Misma persona dos veces seguidas (si no está permitido).
        if (!c.repetirUsuario && doc.ultimoUserId === message.author.id) {
            if (c.borrarErrores) await message.delete().catch(() => {});
            else await message.react('🚫').catch(() => {});
            return true;
        }

        // Número equivocado: se rompe la cuenta y vuelve a empezar.
        if (num !== esperado) {
            doc.numeroActual = 0;
            doc.ultimoUserId = null;
            await doc.save().catch(() => {});
            await message.react('❌').catch(() => {});
            const p = payloadMensaje(c.mensajes?.fallo, {
                color, vars: { user: `<@${message.author.id}>`, numero: esperado, number: esperado },
                fallback: t(cfg, '💥 ¡Se rompió la cuenta! El número correcto era **{number}**. ¡Empezad de nuevo desde **1**!', '💥 The count broke! The correct number was **{number}**. Start over from **1**!'),
            });
            if (p) await message.channel.send(p).catch(() => {});
            return true;
        }

        // Número correcto.
        doc.numeroActual = num;
        doc.ultimoUserId = message.author.id;
        const nuevoRecord = num > (doc.record || 0);
        if (nuevoRecord) { doc.record = num; doc.recordFecha = new Date(); }
        await doc.save().catch(() => {});
        await message.react(nuevoRecord ? '🏆' : '✅').catch(() => {});
        // Mensaje de acierto opcional (por defecto vacío -> solo la reacción).
        const pa = payloadMensaje(c.mensajes?.acierto, { color, vars: { user: `<@${message.author.id}>`, numero: num, number: num }, mention: message.author.id });
        if (pa) await message.channel.send(pa).catch(() => {});
        if (c.xp > 0 || c.oro > 0) await darRecompensa(message.guild, message.member, { xp: c.xp, oro: c.oro }, cfg, message.channel);
        return true;
    } catch (e) { console.error('Dinámica contador:', e.message); return true; }
}

// --- QOTD: primero en responder a la pregunta de hoy ---
async function dinQotdRespuesta(message, q, cfg) {
    if (q.lastDia !== hoyUTC() || q.ganadorHoy) return; // solo el día de hoy y si nadie ganó aún
    // Cierre atómico: solo gana quien marque el ganador primero (evita empates).
    const r = await ServidorConfig.updateOne(
        { guildId: message.guildId, 'dinamicas.qotd.ganadorHoy': null, 'dinamicas.qotd.lastDia': hoyUTC() },
        { $set: { 'dinamicas.qotd.ganadorHoy': message.author.id } },
    );
    if (!r.modifiedCount) return; // alguien respondió un instante antes
    await message.react('⭐').catch(() => {});
    await darRecompensa(message.guild, message.member, { xp: q.xp, oro: q.oro }, cfg, message.channel);
    const p = payloadMensaje(q.mensajes?.acierto, {
        color: cfg.colorEmbed || COLOR, vars: { user: `<@${message.author.id}>`, xp: q.xp },
        fallback: t(cfg, '⭐ ¡{user} ha sido el primero en responder! +{xp} XP 🎉', '⭐ {user} was the first to answer! +{xp} XP 🎉'), mention: message.author.id,
    });
    if (p) await message.reply(p).catch(() => {});
}

// --- Palabra secreta / caza del tesoro ---
async function dinTesoro(message, tesoroCfg, cfg) {
    if (tesoroCfg.unaVez && tesoroCfg.encontrada) return;
    if (tesoroCfg.canalId && message.channel.id !== tesoroCfg.canalId) return;
    const palabra = (tesoroCfg.palabra || '').trim();
    if (!palabra) return;
    // Coincidencia de palabra completa (no dentro de otra palabra).
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaparRegex(palabra)}([^\\p{L}\\p{N}]|$)`, 'iu');
    if (!re.test(message.content || '')) return;

    if (tesoroCfg.unaVez) {
        // Un único ganador: cierre atómico + se desactiva.
        const r = await ServidorConfig.updateOne(
            { guildId: message.guildId, 'dinamicas.tesoro.encontrada': false },
            { $set: { 'dinamicas.tesoro.encontrada': true, 'dinamicas.tesoro.encontradaPor': message.author.id, 'dinamicas.tesoro.activo': false } },
        );
        if (!r.modifiedCount) return; // ya la encontró otro
    } else {
        // Reusable: premia a cada quien, pero no dos veces seguidas a la misma persona.
        if (tesoroCfg.encontradaPor === message.author.id) return;
        await ServidorConfig.updateOne({ guildId: message.guildId }, { $set: { 'dinamicas.tesoro.encontradaPor': message.author.id } });
    }

    const p = payloadMensaje(tesoroCfg.mensajes?.acierto, {
        color: cfg.colorEmbed || COLOR, vars: { user: `<@${message.author.id}>`, palabra, word: palabra },
        fallback: t(cfg, '🏆 ¡{user} ha encontrado la palabra secreta!', '🏆 {user} found the secret word!'), mention: message.author.id,
    });
    if (p) await message.channel.send(p).catch(() => {});
    await darRecompensa(message.guild, message.member, { xp: tesoroCfg.xp, oro: tesoroCfg.oro }, cfg, message.channel);
}

// --- Reto diario / racha ---
async function dinReto(message, r, cfg, client) {
    if (r.canalId && message.channel.id !== r.canalId) return;
    const hoy = hoyUTC();
    const userId = message.author.id;
    const act = await ActividadUsuario.findOne({ guildId: message.guildId, userId }).select('retoDia retoConteo retoCompletado retoRacha');

    let dia = act?.retoDia || '';
    let conteo = act?.retoConteo || 0;
    let completado = act?.retoCompletado || false;
    let racha = act?.retoRacha || 0;

    // Día nuevo: reinicia el conteo y mantiene la racha solo si AYER se completó.
    if (dia !== hoy) {
        if (!(dia === ayerUTC() && completado)) racha = 0;
        dia = hoy; conteo = 0; completado = false;
    }
    if (completado) return; // ya se llevó la recompensa hoy

    conteo += 1;
    const completarAhora = conteo >= (r.objetivo || 20);
    if (completarAhora) { completado = true; racha += 1; }

    await ActividadUsuario.updateOne(
        { guildId: message.guildId, userId },
        { $set: { retoDia: dia, retoConteo: conteo, retoCompletado: completado, retoRacha: racha } },
        { upsert: true },
    );

    if (completarAhora) {
        await darRecompensa(message.guild, message.member, { xp: r.xp, oro: r.oro }, cfg, message.channel);
        let canal = message.channel;
        if (r.avisarCanalId) {
            const c = await client.channels.fetch(r.avisarCanalId).catch(() => null);
            if (c?.isTextBased()) canal = c;
        }
        const p = payloadMensaje(r.mensajes?.acierto, {
            color: cfg.colorEmbed || COLOR, vars: { user: `<@${userId}>`, xp: r.xp, racha, streak: racha },
            fallback: t(cfg, '🎯 ¡{user} ha completado el reto diario! +{xp} XP · Racha 🔥 **{streak}** día(s).', '🎯 {user} completed the daily challenge! +{xp} XP · Streak 🔥 **{streak}** day(s).'), mention: userId,
        });
        if (p) await canal.send(p).catch(() => {});
    }
}

// ============================ SCHEDULER ============================

// Barrido periódico de las dinámicas programadas. Lo llama utils/scheduler.js
// (cada 30s, junto a barrerComunidad). Solo mira los servidores con alguna
// dinámica programada activa.
async function barrerDinamicas(client) {
    const ahora = new Date();
    const hoy = hoyUTC();
    const horaUTC = ahora.getUTCHours();
    const semana = semanaISO(ahora);

    const configs = await ServidorConfig.find({
        $or: [
            { 'dinamicas.qotd.activo': true },
            { 'dinamicas.gota.activo': true },
            { 'dinamicas.trivia.activo': true },
            { 'dinamicas.miembroSemana.activo': true },
            { 'dinamicas.logros.activo': true },
        ],
    });

    for (const cfg of configs) {
        const guild = client.guilds.cache.get(cfg.guildId);
        if (!guild) continue;
        const d = cfg.dinamicas || {};
        if (d.qotd?.activo) await tickQotd(client, guild, cfg, d.qotd, hoy, horaUTC).catch((e) => console.error('Tick QOTD:', e.message));
        if (d.gota?.activo) await tickGota(client, guild, cfg, d.gota, ahora).catch((e) => console.error('Tick gota:', e.message));
        if (d.trivia?.activo) await tickTrivia(client, guild, cfg, d.trivia, hoy, horaUTC).catch((e) => console.error('Tick trivia:', e.message));
        if (d.miembroSemana?.activo) await tickMiembroSemana(client, guild, cfg, d.miembroSemana, ahora, semana, horaUTC).catch((e) => console.error('Tick miembro semana:', e.message));
        if (d.logros?.activo) await tickLogrosMiembros(client, guild, cfg, d.logros).catch((e) => console.error('Tick logros:', e.message));
    }
}

// --- QOTD: publicar la pregunta del día ---
async function tickQotd(client, guild, cfg, q, hoy, horaUTC) {
    const preguntas = (q.preguntas || []).filter((p) => p && p.trim());
    if (!q.canalId || !preguntas.length) return;
    if (q.lastDia === hoy || horaUTC < (q.hora ?? 12)) return;

    const idx = (q.idx || 0) % preguntas.length;
    const pregunta = preguntas[idx];
    // Marca el día YA (aunque falle el canal) para no reintentar en bucle.
    await ServidorConfig.updateOne({ guildId: guild.id }, {
        $set: { 'dinamicas.qotd.lastDia': hoy, 'dinamicas.qotd.idx': idx + 1, 'dinamicas.qotd.ganadorHoy': null },
    });

    const canal = await client.channels.fetch(q.canalId).catch(() => null);
    if (!canal?.isTextBased()) return;
    const pre = q.mensajes?.pregunta;
    const desc = (pre?.texto ? `${rellenar(pre.texto)}\n\n` : '') + pregunta;
    const embed = new EmbedBuilder()
        .setColor(cfg.colorEmbed || COLOR)
        .setTitle(t(cfg, '❓ Pregunta del día', '❓ Question of the day'))
        .setDescription(desc)
        .setFooter({ text: t(cfg, `El primero en responder gana ${q.xp} XP`, `First to answer wins ${q.xp} XP`) });
    const img = urlAbs(pre?.imagen);
    if (img) embed.setImage(img);
    const msg = await canal.send({
        content: q.mencionRolId ? `<@&${q.mencionRolId}>` : undefined,
        embeds: [embed],
        allowedMentions: q.mencionRolId ? { roles: [q.mencionRolId] } : undefined,
    }).catch(() => null);
    if (msg) await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { 'dinamicas.qotd.mensajeId': msg.id } });
}

// --- Gota de oro / Lluvia de XP ---
async function tickGota(client, guild, cfg, g, ahora) {
    if (!g.canalId) return;
    if (g.proxima && new Date(g.proxima) > ahora) return; // aún no toca

    // Programa la próxima ya (con un poco de aleatoriedad ±25%) para no spamear.
    const base = Math.max(1, g.cadaMin || 120);
    const jitter = base * 0.5 * (Math.random() - 0.5);
    const proxima = new Date(ahora.getTime() + (base + jitter) * 60000);
    await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { 'dinamicas.gota.proxima': proxima } });

    const canal = await client.channels.fetch(g.canalId).catch(() => null);
    if (!canal?.isTextBased()) return;
    const emoji = g.emoji || '🪙';
    const color = cfg.colorEmbed || COLOR;
    const dropEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} ${t(cfg, '¡Gota de oro!', 'Gold drop!')}`)
        .setDescription(rellenar(g.mensajes?.anuncio?.texto || t(cfg, 'Reacciona con {emoji} para llevarte **{xp} XP**!\nSolo el primero se lo lleva. ¡Rápido! ⚡', 'React with {emoji} to grab **{xp} XP**!\nOnly the first one gets it. Quick! ⚡'), { emoji, xp: g.xp }));
    const dropImg = urlAbs(g.mensajes?.anuncio?.imagen);
    if (dropImg) dropEmbed.setImage(dropImg);
    const msg = await canal.send({ embeds: [dropEmbed] }).catch(() => null);
    if (!msg) return;
    await msg.react(emoji).catch(() => {});

    const ventana = Math.max(5, g.ventanaSeg || 60) * 1000;
    const collector = msg.createReactionCollector({
        filter: (reaction, user) => !user.bot && (reaction.emoji.name === emoji || reaction.emoji.toString() === emoji),
        time: ventana,
        max: 1,
    });
    collector.on('collect', async (reaction, user) => {
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;
        await darRecompensa(guild, member, { xp: g.xp, oro: g.oro }, cfg, canal);
        const p = payloadMensaje(g.mensajes?.acierto, {
            color, vars: { user: `<@${user.id}>`, xp: g.xp, emoji },
            fallback: t(cfg, '{emoji} ¡{user} ha cogido la gota y gana **{xp} XP**! 🎉', '{emoji} {user} grabbed the drop and wins **{xp} XP**! 🎉'), mention: user.id,
        });
        if (p) await canal.send(p).catch(() => {});
        const recogida = EmbedBuilder.from(dropEmbed).setColor('#2ecc71').setDescription(t(cfg, `Recogida por <@${user.id}> 🎉`, `Collected by <@${user.id}> 🎉`)).setImage(null);
        await msg.edit({ embeds: [recogida] }).catch(() => {});
    });
    collector.on('end', async (collected) => {
        if (collected.size) return;
        const fallo = EmbedBuilder.from(dropEmbed)
            .setColor('#95a5a6')
            .setDescription(rellenar(g.mensajes?.fallo?.texto || t(cfg, 'Nadie la cogió a tiempo… 😢', 'Nobody grabbed it in time… 😢'), { emoji }))
            .setImage(urlAbs(g.mensajes?.fallo?.imagen) || null);
        await msg.edit({ embeds: [fallo] }).catch(() => {});
    });
}

// --- Trivia diaria con botones + ranking semanal ---
async function tickTrivia(client, guild, cfg, triviaCfg, hoy, horaUTC) {
    if (!triviaCfg.canalId || triviaCfg.lastDia === hoy || horaUTC < (triviaCfg.hora ?? 18)) return;
    const banco = await TriviaPregunta.find({ guildId: guild.id });
    if (!banco.length) return; // sin preguntas: no marcamos el día, se lanzará en cuanto haya

    await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { 'dinamicas.trivia.lastDia': hoy } });
    const canal = await client.channels.fetch(triviaCfg.canalId).catch(() => null);
    if (!canal?.isTextBased()) return;

    const q = banco[Math.floor(Math.random() * banco.length)];
    const opciones = (q.opciones || []).slice(0, 4);
    const color = cfg.colorEmbed || COLOR;
    const pre = triviaCfg.mensajes?.pregunta;
    const desc = (pre?.texto ? `${rellenar(pre.texto)}\n\n` : '') + q.pregunta;
    const embed = new EmbedBuilder().setColor(color).setTitle(t(cfg, '🧠 Trivia', '🧠 Trivia')).setDescription(desc).setFooter({ text: t(cfg, `Tienes ${triviaCfg.segundos}s · +${triviaCfg.xp} XP por acertar`, `You have ${triviaCfg.segundos}s · +${triviaCfg.xp} XP for a correct answer`) });
    const preImg = urlAbs(pre?.imagen);
    if (preImg) embed.setImage(preImg);
    const fila = new ActionRowBuilder().addComponents(
        opciones.map((op, i) => new ButtonBuilder().setCustomId(`trivia_ans:${i}`).setLabel(String(op).slice(0, 80)).setStyle(ButtonStyle.Secondary)),
    );
    const msg = await canal.send({ embeds: [embed], components: [fila] }).catch(() => null);
    if (!msg) return;

    const respondieron = new Set();
    const aciertos = [];
    const collector = msg.createMessageComponentCollector({ time: Math.max(5, triviaCfg.segundos || 30) * 1000 });
    collector.on('collect', async (i) => {
        if (!i.customId.startsWith('trivia_ans:')) return;
        if (respondieron.has(i.user.id)) { await i.reply({ content: t(cfg, 'Ya has respondido 😉', 'You already answered 😉'), ephemeral: true }).catch(() => {}); return; }
        respondieron.add(i.user.id);
        const elegido = parseInt(i.customId.split(':')[1], 10);
        if (elegido === q.correcta) {
            aciertos.push(i.user.id);
            const member = await guild.members.fetch(i.user.id).catch(() => null);
            if (member) { await darRecompensa(guild, member, { xp: triviaCfg.xp, oro: triviaCfg.oro }, cfg, canal); await sumarPuntoTrivia(guild.id, i.user.id); }
            const p = payloadMensaje(triviaCfg.mensajes?.acierto, { color, vars: { user: `<@${i.user.id}>`, xp: triviaCfg.xp }, fallback: t(cfg, '✅ ¡Correcto! +{xp} XP', '✅ Correct! +{xp} XP') });
            await i.reply({ ...(p || { content: t(cfg, '✅ ¡Correcto!', '✅ Correct!') }), ephemeral: true }).catch(() => {});
        } else {
            const p = payloadMensaje(triviaCfg.mensajes?.fallo, { color, vars: { user: `<@${i.user.id}>` }, fallback: t(cfg, '❌ Respuesta incorrecta. ¡Mejor suerte la próxima vez!', '❌ Wrong answer. Better luck next time!') });
            await i.reply({ ...(p || { content: t(cfg, '❌ Incorrecto', '❌ Incorrect') }), ephemeral: true }).catch(() => {});
        }
    });
    collector.on('end', async () => {
        try { q.vecesUsada = (q.vecesUsada || 0) + 1; await q.save(); } catch { /* da igual */ }
        const cerrado = EmbedBuilder.from(embed).addFields({ name: t(cfg, '✔️ Respuesta correcta', '✔️ Correct answer'), value: `**${opciones[q.correcta] ?? '—'}**` });
        if (aciertos.length) cerrado.addFields({ name: t(cfg, `Acertaron (${aciertos.length})`, `Got it right (${aciertos.length})`), value: aciertos.slice(0, 15).map((id) => `<@${id}>`).join(', ') });
        const top = await topTriviaSemana(guild.id, 5);
        if (top.length) cerrado.addFields({ name: t(cfg, '🏆 Ranking semanal', '🏆 Weekly leaderboard'), value: top.map((u, i) => `**${i + 1}.** <@${u.userId}> — ${u.triviaPuntos} pts`).join('\n') });
        const filaFinal = new ActionRowBuilder().addComponents(
            opciones.map((op, idx) => new ButtonBuilder().setCustomId(`trivia_done:${idx}`).setLabel(String(op).slice(0, 80)).setStyle(idx === q.correcta ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(true)),
        );
        await msg.edit({ embeds: [cerrado], components: [filaFinal] }).catch(() => {});
    });
}

// Suma un acierto al ranking semanal de trivia del usuario (reinicia al cambiar de semana).
async function sumarPuntoTrivia(guildId, userId) {
    const semana = semanaISO();
    const act = await ActividadUsuario.findOne({ guildId, userId }).select('triviaSemana');
    if (act?.triviaSemana === semana) {
        await ActividadUsuario.updateOne({ guildId, userId }, { $inc: { triviaPuntos: 1 } });
    } else {
        await ActividadUsuario.updateOne({ guildId, userId }, { $set: { triviaSemana: semana, triviaPuntos: 1 } }, { upsert: true });
    }
}
async function topTriviaSemana(guildId, limite = 5) {
    return ActividadUsuario.find({ guildId, triviaSemana: semanaISO(), triviaPuntos: { $gt: 0 } })
        .sort({ triviaPuntos: -1 }).limit(limite).select('userId triviaPuntos');
}

// --- Miembro de la semana (el más activo por mensajes en los últimos 7 días) ---
async function tickMiembroSemana(client, guild, cfg, m, ahora, semana, horaUTC) {
    if (!m.canalId || m.lastSemana === semana) return;
    if (ahora.getUTCDay() !== (m.dia ?? 1) || horaUTC < (m.hora ?? 12)) return;

    // Marca la semana ya para no repetir el premio.
    await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { 'dinamicas.miembroSemana.lastSemana': semana } });

    const desde = new Date(ahora.getTime() - 7 * 86400000);
    const agg = await RegistroMensaje.aggregate([
        { $match: { guildId: guild.id, fecha: { $gte: desde } } },
        { $group: { _id: '$userId', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 1 },
    ]);
    if (!agg.length) return;
    const ganadorId = agg[0]._id;
    const member = await guild.members.fetch(ganadorId).catch(() => null);
    if (!member) return;

    // Rol temporal: quítaselo al anterior ganador y dáselo al nuevo.
    if (m.rolId) {
        const rol = guild.roles.cache.get(m.rolId);
        if (rol && rol.editable) {
            if (m.ultimoGanador && m.ultimoGanador !== ganadorId) {
                const prev = await guild.members.fetch(m.ultimoGanador).catch(() => null);
                if (prev) await prev.roles.remove(rol).catch(() => {});
            }
            await member.roles.add(rol).catch(() => {});
        }
    }
    await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { 'dinamicas.miembroSemana.ultimoGanador': ganadorId } });
    await darRecompensa(guild, member, { xp: m.xp, oro: m.oro }, cfg, null);

    const canal = await client.channels.fetch(m.canalId).catch(() => null);
    if (!canal?.isTextBased()) return;
    const detalle = [
        m.xp ? t(cfg, `🎁 Recompensa: **${m.xp} XP**`, `🎁 Reward: **${m.xp} XP**`) : '',
        m.rolId ? t(cfg, '🎖️ Rol especial concedido', '🎖️ Special role granted') : '',
    ].filter(Boolean).join('\n');
    const an = m.mensajes?.anuncio;
    const desc = rellenar(an?.texto || t(cfg, '¡Enhorabuena {user}! Has sido el miembro más activo de la semana con **{messages}** mensajes.', 'Congrats {user}! You were the most active member of the week with **{messages}** messages.'), { user: `<@${ganadorId}>`, xp: m.xp, mensajes: agg[0].n, messages: agg[0].n });
    const embed = new EmbedBuilder()
        .setColor(cfg.colorEmbed || COLOR)
        .setTitle(t(cfg, '👑 Miembro de la semana', '👑 Member of the week'))
        .setDescription(`${desc}${detalle ? `\n\n${detalle}` : ''}`)
        .setThumbnail(member.user.displayAvatarURL());
    const anImg = urlAbs(an?.imagen);
    if (anImg) embed.setImage(anImg);
    await canal.send({ content: `<@${ganadorId}>`, embeds: [embed], allowedMentions: { users: [ganadorId] } }).catch(() => {});
}

// --- Tablón de logros: hitos de miembros (el de nivel va en comprobarLogroNivel) ---
async function tickLogrosMiembros(client, guild, cfg, l) {
    if (!l.canalId) return;
    const count = guild.memberCount || 0;
    const anunciados = l.anunciados || [];
    const nuevos = (l.hitosMiembros || []).filter((h) => count >= h && !anunciados.includes(`m:${h}`));
    if (!nuevos.length) return;

    const canal = await client.channels.fetch(l.canalId).catch(() => null);
    const claves = [];
    for (const h of nuevos) {
        claves.push(`m:${h}`);
        // Solo anuncia si se acaba de cruzar (margen de 50); si el server ya estaba
        // muy por encima (p. ej. activan la dinámica tarde), lo marca en silencio.
        if ((count - h) <= 50 && canal?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor(cfg.colorEmbed || COLOR)
                .setTitle(t(cfg, '🎉 ¡Nuevo hito!', '🎉 New milestone!'))
                .setDescription(rellenar(l.mensajes?.miembros?.texto || t(cfg, '¡Ya somos **{members}** miembros en **{server}**! Gracias por estar aquí 💜', 'We’re now **{members}** members in **{server}**! Thanks for being here 💜'), { miembros: h, servidor: guild.name, members: h, server: guild.name }));
            const img = urlAbs(l.mensajes?.miembros?.imagen);
            if (img) embed.setImage(img);
            await canal.send({ embeds: [embed] }).catch(() => {});
        }
    }
    if (claves.length) await ServidorConfig.updateOne({ guildId: guild.id }, { $addToSet: { 'dinamicas.logros.anunciados': { $each: claves } } });
}

// Hito de NIVEL del tablón de logros. Lo llama niveles.js cuando alguien sube de
// nivel; celebra al PRIMERO que alcanza cada nivel-hito (una sola vez).
async function comprobarLogroNivel(guild, member, nivelNuevo, cfg, canalFallback) {
    const l = cfg?.dinamicas?.logros;
    if (!l?.activo || !l.canalId) return;
    if (!(l.hitosNivel || []).includes(nivelNuevo)) return;
    const clave = `n:${nivelNuevo}`;
    // Atómico: solo el primero en alcanzarlo lo anuncia.
    const r = await ServidorConfig.updateOne(
        { guildId: guild.id, 'dinamicas.logros.anunciados': { $ne: clave } },
        { $addToSet: { 'dinamicas.logros.anunciados': clave } },
    );
    if (!r.modifiedCount) return;
    const canal = guild.channels.cache.get(l.canalId) || canalFallback;
    if (!canal?.isTextBased?.()) return;
    const embed = new EmbedBuilder()
        .setColor(cfg.colorEmbed || COLOR)
        .setTitle(t(cfg, '🏅 ¡Logro de nivel!', '🏅 Level achievement!'))
        .setDescription(rellenar(l.mensajes?.nivel?.texto || t(cfg, '¡{user} es el primero en llegar al **nivel {level}**! 🚀', '{user} is the first to reach **level {level}**! 🚀'), { user: `<@${member.id}>`, nivel: nivelNuevo, level: nivelNuevo }));
    const img = urlAbs(l.mensajes?.nivel?.imagen);
    if (img) embed.setImage(img);
    await canal.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { darRecompensa, procesarMensaje, barrerDinamicas, comprobarLogroNivel };
