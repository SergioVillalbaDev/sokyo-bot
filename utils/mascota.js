// Mascota del servidor (1.14.0). Nace de un huevo que el servidor vota (especie y
// nombre), vive en un canal, crece con lo que la cuidan (comida con oro, caricias,
// jugar) y con lo vivo que está el servidor, se pone mala si hay mucha toxicidad,
// hiberna si nadie la cuida y desbloquea ventajas para todos. Las reglas puras
// están en utils/mascotaNucleo.js; los combates y la Liga, en utils/liga.js.
const crypto = require('crypto');
const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder,
} = require('discord.js');
const Mascota = require('../models/Mascota.js');
const CuidadoMascota = require('../models/CuidadoMascota.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const N = require('./mascotaNucleo.js');
const { t } = require('./i18n.js');

const HORAS_VOTACION = 24;
const HORAS_CARICIA = 20;
const HORAS_JUEGO = 3;
const ORO_CARICIA = 25;
const ORO_JUEGO = 15;
const MAX_NOMBRES = 25;

// ---------------------------------------------------------------------------
// Lo que pasa en el servidor entre una pasada y otra (en memoria).
// ---------------------------------------------------------------------------
const actividad = new Map(); // guildId -> { mensajes, noche, incidentes, musica }
const act = (g) => { if (!actividad.has(g)) actividad.set(g, { mensajes: 0, noche: 0, incidentes: 0, musica: 0 }); return actividad.get(g); };
function registrarMensaje(guildId, fecha = new Date()) {
    const a = act(guildId);
    a.mensajes++;
    const h = fecha.getUTCHours();
    if (h >= 0 && h < 6) a.noche++;
}
const registrarIncidente = (guildId) => { act(guildId).incidentes++; };
const registrarCancion = (guildId) => { act(guildId).musica++; };
function tomarActividad(guildId) {
    const a = actividad.get(guildId) || { mensajes: 0, noche: 0, incidentes: 0, musica: 0 };
    actividad.delete(guildId);
    return a;
}

// Ventajas activas por servidor (las leen niveles.js y bromas.js sin ir a la BD).
const ventajasCache = new Map(); // guildId -> { bonusXp, descuento }
function ponerCache(m) {
    if (!m) return;
    ventajasCache.set(m.guildId, { bonusXp: N.bonusXp(m), descuento: N.descuentoBromas(m) });
}
const bonusXpServidor = (guildId) => (ventajasCache.get(guildId) || {}).bonusXp || 0;
const descuentoBromasServidor = (guildId) => (ventajasCache.get(guildId) || {}).descuento || 0;

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------
const nombreEspecie = (id, idioma) => { const e = N.ESPECIES[id]; return e ? t(idioma, e.es, e.en) : '?'; };
const emojiDe = (m) => (m && m.estado === 'viva' && N.ESPECIES[m.especie] ? N.ESPECIES[m.especie].emoji : '🥚');

function fraseAnimo(m, idioma) {
    const n = m.nombre || '?';
    switch (N.animoDe(m)) {
        case 'hibernando': return t(idioma, `💤 ${n} está hibernando porque nadie la cuidaba. Dadle de comer con \`/mascota alimentar\` para despertarla.`, `💤 ${n} is hibernating because nobody looked after it. Feed it with \`/pet feed\` to wake it up.`);
        case 'enferma': return t(idioma, `🤒 ${n} está malita: hay demasiada toxicidad en el servidor. Bien comida y con buen ambiente se recupera.`, `🤒 ${n} is sick: there’s too much toxicity on the server. Well fed and with good vibes it recovers.`);
        case 'hambrienta': return t(idioma, `🥺 ${n} tiene mucha hambre… \`/mascota alimentar\``, `🥺 ${n} is very hungry… \`/pet feed\``);
        case 'triste': return t(idioma, `😔 ${n} se aburre: el servidor está muy callado. ¡Hablad, jugad con ella!`, `😔 ${n} is bored: the server is very quiet. Chat and play with it!`);
        case 'feliz': return t(idioma, `🥰 ${n} está feliz. ¡Qué bien la cuidáis!`, `🥰 ${n} is happy. You’re taking great care of it!`);
        default: return t(idioma, `🙂 ${n} está bien.`, `🙂 ${n} is doing fine.`);
    }
}

async function tarjeta(m, idioma) {
    const buf = await require('./tarjetaMascota.js').generarTarjeta(m, idioma).catch((e) => { console.error('Tarjeta mascota:', e.message); return null; });
    return buf ? new AttachmentBuilder(buf, { name: 'mascota.png' }) : null;
}

function embedMascota(m, idioma, extra = {}) {
    const esp = N.ESPECIES[m.especie];
    const ventajas = N.ventajasDe(m);
    const e = new EmbedBuilder()
        .setColor((m.forma && N.FORMAS[m.forma].color) || (esp && esp.color) || '#a78bfa')
        .setTitle(`${emojiDe(m)} ${m.nombre || t(idioma, 'Mascota', 'Pet')}`)
        .setDescription(fraseAnimo(m, idioma))
        .addFields({
            name: t(idioma, '🎁 Ventajas para todo el servidor', '🎁 Perks for the whole server'),
            value: N.VENTAJAS.map((v) => `${ventajas.includes(v.id) ? '✅' : (m.nivel >= v.nivel ? '⏸️' : '🔒')} **${t(idioma, 'Nv', 'Lv')} ${v.nivel}** · ${v.emoji} ${t(idioma, v.es, v.en)}`).join('\n'),
        });
    const X = require('./mascotaExtras.js');
    const per = X.PERSONALIDADES[m.personalidad];
    const st = m.stats || {};
    if (per) e.addFields({ name: t(idioma, '🧬 Personalidad', '🧬 Personality'), value: `${per.emoji} **${t(idioma, per.es, per.en)}** — ${t(idioma, per.desc.es, per.desc.en)}` });
    e.addFields({ name: t(idioma, '🏋️ Entrenamiento', '🏋️ Training'), value: `${Object.entries(X.STATS).map(([k, v]) => `${v.emoji} ${st[k] || 5}`).join(' · ')} · ⚡ ${m.energia ?? 100}%`, inline: true });
    if (m.accesorio || (m.habitat && m.habitat !== 'prado')) {
        const acc = m.accesorio && X.ACCESORIOS[m.accesorio];
        const hab = X.HABITATS[m.habitat || 'prado'];
        e.addFields({ name: t(idioma, '🎨 Aspecto', '🎨 Look'), value: [acc ? `${acc.emoji} ${t(idioma, acc.es, acc.en)}` : '', hab ? `🏞️ ${t(idioma, hab.es, hab.en)}` : ''].filter(Boolean).join(' · '), inline: true });
    }
    if ((m.logros || []).length) e.addFields({ name: t(idioma, '🏆 Logros', '🏆 Achievements'), value: `${(m.logros || []).map((id) => (X.LOGROS.find((l) => l.id === id) || {}).emoji || '').join(' ')} (${m.logros.length}/${X.LOGROS.length})`, inline: true });
    const c = m.contadores || {};
    if (c.victorias || c.derrotas) e.addFields({ name: t(idioma, '⚔️ Combates', '⚔️ Battles'), value: `${c.victorias || 0} ✅ · ${c.derrotas || 0} ❌${c.racha > 1 ? ` · 🔥 ${c.racha}` : ''}`, inline: true });
    if (m.cuidadorId) e.addFields({ name: t(idioma, '🏅 Cuidador del mes', '🏅 Carer of the month'), value: `<@${m.cuidadorId}>`, inline: true });
    if (extra.imagen) e.setImage('attachment://mascota.png');
    e.setFooter({ text: t(idioma, '/mascota alimentar · acariciar · jugar · entrenar · tienda · hablar · diario', '/pet feed · pet · play · train · shop · talk · diary') });
    return e;
}

async function enviarAlCanal(client, cfg, payload) {
    const guild = client.guilds.cache.get(cfg.guildId);
    const canal = guild && cfg.mascota?.canalId ? guild.channels.cache.get(cfg.mascota.canalId) : null;
    if (!canal || !canal.isTextBased()) return null;
    return canal.send({ allowedMentions: { parse: [] }, ...payload }).catch((e) => { console.error('Mascota · enviar:', e.message); return null; });
}

// ---------------------------------------------------------------------------
// El huevo y la votación
// ---------------------------------------------------------------------------
function mensajeVotacion(m, idioma) {
    const v = m.votacion || {};
    const cuenta = {};
    for (const x of v.especies || []) cuenta[x.especie] = (cuenta[x.especie] || 0) + 1;
    const total = (v.especies || []).length;
    const lineas = Object.entries(N.ESPECIES).map(([id, e]) => {
        const n = cuenta[id] || 0;
        const lleno = total ? Math.round((n / total) * 10) : 0;
        return `${e.emoji} **${t(idioma, e.es, e.en)}** ${'▰'.repeat(lleno)}${'▱'.repeat(10 - lleno)} ${n}`;
    });
    const nombres = [...(v.nombres || [])].sort((a, b) => b.votos.length - a.votos.length).slice(0, 10);
    const e = new EmbedBuilder()
        .setColor('#a78bfa')
        .setTitle(t(idioma, '🥚 ¡Ha aparecido un huevo en el servidor!', '🥚 An egg has appeared on the server!'))
        .setDescription(t(idioma,
            `Algo se mueve dentro… Entre todos decidís **qué será** y **cómo se llamará**. Nacerá ${v.fin ? `<t:${Math.floor(new Date(v.fin).getTime() / 1000)}:R>` : 'pronto'}.\n\n${lineas.join('\n')}`,
            `Something is moving inside… Together you decide **what it will be** and **its name**. It hatches ${v.fin ? `<t:${Math.floor(new Date(v.fin).getTime() / 1000)}:R>` : 'soon'}.\n\n${lineas.join('\n')}`))
        .addFields({
            name: t(idioma, '💡 Nombres propuestos', '💡 Suggested names'),
            value: nombres.length ? nombres.map((x) => `**${x.nombre}** · ${x.votos.length} 🗳️`).join('\n') : t(idioma, 'Todavía ninguno: ¡propón el primero!', 'None yet: suggest the first one!'),
        })
        .setImage('attachment://mascota.png');
    const filaEspecies = new ActionRowBuilder().addComponents(Object.entries(N.ESPECIES).map(([id, esp]) =>
        new ButtonBuilder().setCustomId(`mas_esp:${id}`).setLabel(t(idioma, esp.es, esp.en)).setEmoji(esp.emoji).setStyle(ButtonStyle.Secondary)));
    const filaNombre = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mas_nom').setLabel(t(idioma, 'Proponer un nombre', 'Suggest a name')).setEmoji('💡').setStyle(ButtonStyle.Primary));
    const filas = [filaEspecies, filaNombre];
    if (nombres.length) {
        filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('mas_vnom')
            .setPlaceholder(t(idioma, '🗳️ Vota un nombre', '🗳️ Vote for a name'))
            .addOptions([...(v.nombres || [])].slice(0, MAX_NOMBRES).map((x, i) => ({ label: x.nombre.slice(0, 100), value: String(i), description: `${x.votos.length} 🗳️` })))));
    }
    return { embeds: [e], components: filas };
}

async function iniciarHuevo(client, cfg) {
    const idioma = cfg;
    let m;
    try {
        m = await Mascota.create({ guildId: cfg.guildId, estado: 'huevo', votacion: { fin: new Date(Date.now() + HORAS_VOTACION * 3600000), canalId: cfg.mascota.canalId } });
    } catch { return null; } // otra pasada lo creó a la vez
    const adj = await tarjeta(m, idioma);
    const msg = await enviarAlCanal(client, cfg, { ...mensajeVotacion(m, idioma), files: adj ? [adj] : [] });
    if (msg) await Mascota.updateOne({ _id: m._id }, { $set: { 'votacion.mensajeId': msg.id, 'votacion.canalId': msg.channelId } });
    return m;
}

async function refrescarVotacion(client, m, cfg) {
    const v = m.votacion || {};
    const guild = client.guilds.cache.get(m.guildId);
    const canal = guild && v.canalId ? guild.channels.cache.get(v.canalId) : null;
    if (!canal || !v.mensajeId) return;
    const msg = await canal.messages.fetch(v.mensajeId).catch(() => null);
    if (msg) await msg.edit({ ...mensajeVotacion(m, cfg), attachments: [...msg.attachments.values()] }).catch(() => {});
}

async function eclosionar(client, cfg, m) {
    const r = N.ganadoresVotacion(m.votacion);
    const ahora = new Date();
    const hecho = await Mascota.findOneAndUpdate(
        { _id: m._id, estado: 'huevo' },
        { $set: { estado: 'viva', especie: r.especie, nombre: r.nombre, nacida: ahora, ultimoTick: ahora, nivel: 1, xp: 0, hambre: 80, alegria: 85, salud: 100, energia: 100, personalidad: require('./mascotaExtras.js').personalidadAlAzar() } },
        { returnDocument: 'after' },
    );
    if (!hecho) return null;
    ponerCache(hecho);
    await require('./mascotaVida.js').recordar(hecho.guildId, 'nacio', { nombre: hecho.nombre, especie: hecho.especie });
    // El mensaje de la votación se queda sin botones.
    const guild = client.guilds.cache.get(m.guildId);
    const canal = guild && m.votacion?.canalId ? guild.channels.cache.get(m.votacion.canalId) : null;
    const msg = canal && m.votacion.mensajeId ? await canal.messages.fetch(m.votacion.mensajeId).catch(() => null) : null;
    if (msg) await msg.edit({ components: [] }).catch(() => {});
    const adj = await tarjeta(hecho, cfg);
    const esp = N.ESPECIES[hecho.especie];
    const per = require('./mascotaExtras.js').PERSONALIDADES[hecho.personalidad];
    await enviarAlCanal(client, cfg, {
        content: t(cfg,
            `🎉 **¡El huevo se ha abierto!** Ha nacido **${hecho.nombre}**, un ${esp.emoji} **${esp.es.toLowerCase()}** ${per.emoji} **${per.es.toLowerCase()}** (${per.desc.es.charAt(0).toLowerCase()}${per.desc.es.slice(1, -1)}). Cuidadla entre todos: \`/mascota alimentar\`, \`/mascota acariciar\`, \`/mascota jugar\` y \`/mascota entrenar\`. Cuanto más viva esté el servidor, más rápido crecerá.`,
            `🎉 **The egg has hatched!** Meet **${hecho.nombre}**, a ${per.emoji} **${per.en.toLowerCase()}** ${esp.emoji} **${esp.en.toLowerCase()}** (${per.desc.en.charAt(0).toLowerCase()}${per.desc.en.slice(1, -1)}). Look after it together: \`/pet feed\`, \`/pet pet\`, \`/pet play\` and \`/pet train\`. The livelier the server, the faster it grows.`),
        embeds: [embedMascota(hecho, cfg, { imagen: !!adj })],
        files: adj ? [adj] : [],
    });
    return hecho;
}

// ---------------------------------------------------------------------------
// Pasada periódica (cada 5 min, desde utils/scheduler.js → tickCrecimiento)
// ---------------------------------------------------------------------------
function miembrosEnVoz(guild) {
    let n = 0;
    for (const [, c] of guild.channels.cache) {
        if (!c.isVoiceBased || !c.isVoiceBased()) continue;
        const humanos = c.members ? c.members.filter((x) => !x.user.bot).size : 0;
        if (humanos >= 2) n += humanos;
    }
    return n;
}

// Lo importante queda en su diario (aunque los avisos estén apagados).
async function apuntarAvisos(m, avisos) {
    const { recordar } = require('./mascotaVida.js');
    for (const a of avisos) {
        if (a.tipo === 'nivel') {
            const antes = N.faseDe({ estado: 'viva', nivel: a.antes });
            const ahora = N.faseDe(m);
            if (antes.id !== ahora.id) await recordar(m.guildId, 'fase', { fase_es: ahora.es.toLowerCase(), fase_en: ahora.en.toLowerCase() });
            else if (Math.floor(a.nivel / 5) > Math.floor(a.antes / 5)) await recordar(m.guildId, 'nivel', { nivel: a.nivel });
        } else if (a.tipo === 'forma') {
            await recordar(m.guildId, 'forma', { forma_es: N.FORMAS[a.forma].es, forma_en: N.FORMAS[a.forma].en });
        } else if (a.tipo === 'hiberna') {
            await recordar(m.guildId, 'hiberna');
        }
    }
}

async function anunciarAvisos(client, cfg, m, avisos) {
    await apuntarAvisos(m, avisos).catch(() => {});
    if (cfg.mascota?.avisos === false) return;
    for (const a of avisos) {
        if (a.tipo === 'nivel') {
            const nueva = N.VENTAJAS.find((v) => v.nivel > a.antes && v.nivel <= a.nivel);
            const faseAntes = N.faseDe({ estado: 'viva', nivel: a.antes });
            const faseAhora = N.faseDe(m);
            const crece = faseAntes.id !== faseAhora.id;
            const adj = crece ? await tarjeta(m, cfg) : null;
            await enviarAlCanal(client, cfg, {
                content: [
                    crece
                        ? t(cfg, `${faseAhora.emoji} **¡${m.nombre} ha crecido!** Ahora es **${faseAhora.es.toLowerCase()}** (nivel ${a.nivel}).`, `${faseAhora.emoji} **${m.nombre} has grown!** It’s now **${faseAhora.en.toLowerCase()}** (level ${a.nivel}).`)
                        : t(cfg, `⬆️ **${m.nombre}** ha subido al **nivel ${a.nivel}**.`, `⬆️ **${m.nombre}** reached **level ${a.nivel}**.`),
                    nueva ? t(cfg, `🎁 Ventaja nueva para todos: ${nueva.emoji} **${nueva.es}**.`, `🎁 New perk for everyone: ${nueva.emoji} **${nueva.en}**.`) : '',
                ].filter(Boolean).join('\n'),
                ...(adj ? { files: [adj], embeds: [embedMascota(m, cfg, { imagen: true })] } : {}),
            });
        } else if (a.tipo === 'forma') {
            const f = N.FORMAS[a.forma];
            const adj = await tarjeta(m, cfg);
            const porque = {
                nocturna: t(cfg, 'Este servidor vive de noche.', 'This server lives at night.'),
                musical: t(cfg, 'Aquí siempre suena música.', 'There’s always music playing here.'),
                guerrera: t(cfg, 'Ha ganado muchos combates.', 'It has won many battles.'),
                social: t(cfg, 'Aquí se habla mucho y se cuida a la gente.', 'People here chat a lot and look after each other.'),
            }[a.forma];
            await enviarAlCanal(client, cfg, {
                content: t(cfg, `${f.emoji} **¡${m.nombre} se ha hecho adulta en su forma ${f.es}!** ${porque}`, `${f.emoji} **${m.nombre} became an adult in its ${f.en} form!** ${porque}`),
                embeds: [embedMascota(m, cfg, { imagen: !!adj })], files: adj ? [adj] : [],
            });
        } else if (a.tipo === 'hiberna') {
            await enviarAlCanal(client, cfg, { content: t(cfg, `💤 **${m.nombre}** se ha ido a hibernar: tenía hambre y nadie le hacía caso. Cada día que pase dormida perderá un nivel. Despertadla con \`/mascota alimentar\`.`, `💤 **${m.nombre}** went into hibernation: it was hungry and nobody paid attention. Each day asleep it loses a level. Wake it up with \`/pet feed\`.`) });
        } else if (a.tipo === 'pierde') {
            await enviarAlCanal(client, cfg, { content: t(cfg, `📉 **${m.nombre}** sigue hibernando y ha bajado al nivel ${a.nivel}.`, `📉 **${m.nombre}** is still hibernating and dropped to level ${a.nivel}.`) });
        }
    }
}

async function cerrarCuidadorDelMes(client, cfg, m) {
    const ahora = new Date();
    const anterior = N.mesClave(new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1, 15)));
    if (m.mesCuidador === anterior) return;
    const r = await Mascota.updateOne({ _id: m._id, mesCuidador: m.mesCuidador }, { $set: { mesCuidador: anterior } });
    if (!r.modifiedCount || !m.mesCuidador) return; // la primera vez solo se apunta
    const [top] = await CuidadoMascota.find({ guildId: m.guildId, mes: anterior, puntos: { $gt: 0 } }).sort({ puntos: -1 }).limit(1).lean();
    if (!top) return;
    const guild = client.guilds.cache.get(m.guildId);
    const rolId = cfg.mascota?.rolCuidadorId;
    const rol = guild && rolId ? guild.roles.cache.get(rolId) : null;
    if (rol && !require('./permisos.js').errorRolPeligroso(rol)) {
        if (m.cuidadorId && m.cuidadorId !== top.userId) {
            const antes = await guild.members.fetch(m.cuidadorId).catch(() => null);
            if (antes) await antes.roles.remove(rol, 'Cuidador del mes: nuevo ganador').catch(() => {});
        }
        const nuevo = await guild.members.fetch(top.userId).catch(() => null);
        if (nuevo) await nuevo.roles.add(rol, 'Cuidador del mes de la mascota').catch(() => {});
    }
    await Mascota.updateOne({ _id: m._id }, { $set: { cuidadorId: top.userId } });
    const quien = guild ? (await guild.members.fetch(top.userId).catch(() => null))?.displayName : null;
    await require('./mascotaVida.js').recordar(m.guildId, 'cuidador', { quien: quien || top.userId });
    await enviarAlCanal(client, cfg, {
        content: t(cfg, `🏅 **Cuidador del mes:** <@${top.userId}> ha cuidado de **${m.nombre}** más que nadie (${top.puntos} puntos). ¡Gracias!`, `🏅 **Carer of the month:** <@${top.userId}> looked after **${m.nombre}** more than anyone (${top.puntos} points). Thank you!`),
        allowedMentions: { users: [top.userId] },
    });
}

async function pasadaServidor(client, cfg) {
    const guild = client.guilds.cache.get(cfg.guildId);
    if (!guild) return;
    let m = await Mascota.findOne({ guildId: cfg.guildId });
    if (!m) { if (cfg.mascota.canalId) await iniciarHuevo(client, cfg); return; }
    if (m.estado === 'huevo') {
        if (m.votacion?.fin && new Date(m.votacion.fin) <= new Date()) await eclosionar(client, cfg, m);
        return;
    }
    ponerCache(m);
    const ahora = new Date();
    const horas = (ahora - new Date(m.ultimoTick || ahora)) / 3600000;
    if (horas >= 1) {
        const a = tomarActividad(guild.id);
        const vozMin = miembrosEnVoz(guild) * Math.min(horas, 3) * 60;
        const { cambio, avisos } = N.pasarTiempo(m, { ...a, vozMin }, Math.min(horas, 48), ahora);
        cambio.ultimoTick = ahora;
        cambio['contadores.musica'] = (m.contadores?.musica || 0) + (a.musica || 0);
        const nuevo = await Mascota.findOneAndUpdate({ _id: m._id, ultimoTick: m.ultimoTick }, { $set: cambio }, { returnDocument: 'after' });
        if (!nuevo) return;
        m = nuevo;
        ponerCache(m);
        await anunciarAvisos(client, cfg, m, avisos);
        // Aviso de hambre (como mucho cada 12 h).
        if (cfg.mascota.avisos !== false && !m.hibernando && m.hambre < 20 && (!m.ultimoAvisoHambre || ahora - new Date(m.ultimoAvisoHambre) > 12 * 3600000)) {
            await Mascota.updateOne({ _id: m._id }, { $set: { ultimoAvisoHambre: ahora } });
            await enviarAlCanal(client, cfg, { content: t(cfg, `🥺 **${m.nombre}** tiene mucha hambre (${m.hambre}%). Si no come, acabará hibernando. \`/mascota alimentar\``, `🥺 **${m.nombre}** is very hungry (${m.hambre}%). If it doesn’t eat, it’ll go into hibernation. \`/pet feed\``) });
        }
    }
    // Buenos días (una vez al día, a su hora).
    const hoy = N.diaClave(ahora);
    if (ahora.getUTCHours() === (cfg.mascota.horaSaludo ?? 10) && m.ultimoSaludo !== hoy) {
        const r = await Mascota.updateOne({ _id: m._id, ultimoSaludo: m.ultimoSaludo }, { $set: { ultimoSaludo: hoy } });
        if (r.modifiedCount) {
            const adj = await tarjeta(m, cfg);
            await enviarAlCanal(client, cfg, {
                content: t(cfg, `☀️ ¡Buenos días! Así está **${m.nombre}** hoy:`, `☀️ Good morning! Here’s how **${m.nombre}** is doing today:`),
                embeds: [embedMascota(m, cfg, { imagen: !!adj })], files: adj ? [adj] : [],
            });
        }
    }
    await cerrarCuidadorDelMes(client, cfg, m);
    const vida = require('./mascotaVida.js');
    await vida.comprobarLogros(client, cfg, m);
    await vida.pasadaEventos(client, cfg, await Mascota.findOne({ _id: m._id }), ahora);
}

async function barrerMascotas(client) {
    const cfgs = await ServidorConfig.find({ 'mascota.activo': true }).select('guildId idioma mascota').lean();
    for (const cfg of cfgs) {
        try { await pasadaServidor(client, cfg); } catch (e) { console.error(`Mascota ${cfg.guildId}:`, e.message); }
    }
}

// Carga las ventajas de todas las mascotas al arrancar (para el bonus de XP).
async function cargarCache() {
    const lista = await Mascota.find({ estado: 'viva' }).select('guildId estado nivel salud hibernando').lean();
    for (const m of lista) ponerCache(m);
}

// ---------------------------------------------------------------------------
// Cuidados (los usan /mascota y los botones)
// ---------------------------------------------------------------------------
async function cuidado(guildId, userId, set = {}, inc = {}) {
    return CuidadoMascota.findOneAndUpdate(
        { guildId, userId, mes: N.mesClave() },
        { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(inc).length ? { $inc: inc } : {}) },
        { upsert: true, returnDocument: 'after' },
    );
}
const viva = async (guildId) => Mascota.findOne({ guildId, estado: 'viva' });

async function alimentar(guildId, userId, oro, idioma, quien = null) {
    const m = await viva(guildId);
    if (!m) return { error: t(idioma, 'Todavía no hay mascota (o sigue en el huevo).', 'There’s no pet yet (or it’s still an egg).') };
    const c = N.comida(m, oro);
    c.xp = Math.round(c.xp * (require('./mascotaExtras.js').pers(m).xpComida || 1));
    if (c.usado <= 0) return { error: t(idioma, `**${m.nombre}** está llena: no le cabe nada más ahora.`, `**${m.nombre}** is full: it can’t eat anything else right now.`) };
    const economia = require('./economia.js');
    const saldo = await economia.cobrar(userId, c.usado);
    if (saldo === null) return { error: t(idioma, `No tienes 🪙 ${c.usado}.`, `You don’t have 🪙 ${c.usado}.`) };
    const r = N.sumarXp(m.nivel, m.xp, c.xp);
    const desperto = N.despierta(m, c.hambre);
    // $inc del hambre real (otro puede haber comido a la vez): se calcula en la BD con un tope de 100.
    const nuevo = await Mascota.findOneAndUpdate(
        { _id: m._id },
        [{ $set: { hambre: { $min: [100, { $add: ['$hambre', c.usado / 10] }] }, nivel: r.nivel, xp: r.xp, ...(desperto ? { hibernando: false, hibernaDesde: null, 'contadores.despertares': { $add: [{ $ifNull: ['$contadores.despertares', 0] }, 1] } } : {}), 'contadores.comida': { $add: [{ $ifNull: ['$contadores.comida', 0] }, c.usado] } } }],
        { returnDocument: 'after', updatePipeline: true },
    );
    await cuidado(guildId, userId, {}, { puntos: c.cuidado, oro: c.usado });
    ponerCache(nuevo);
    if (desperto) await require('./mascotaVida.js').recordar(guildId, 'despierta', { quien: quien || null });
    return { ok: true, m: nuevo, usado: c.usado, saldo, subio: r.subidos > 0, desperto };
}

async function acariciar(guildId, userId, idioma) {
    const m = await viva(guildId);
    if (!m) return { error: t(idioma, 'Todavía no hay mascota (o sigue en el huevo).', 'There’s no pet yet (or it’s still an egg).') };
    const hace = new Date(Date.now() - HORAS_CARICIA * 3600000);
    const mes = N.mesClave();
    await CuidadoMascota.updateOne({ guildId, userId, mes }, { $setOnInsert: { puntos: 0 } }, { upsert: true }).catch(() => {});
    const c = await CuidadoMascota.findOneAndUpdate(
        { guildId, userId, mes, $or: [{ ultimaCaricia: null }, { ultimaCaricia: { $lt: hace } }] },
        { $set: { ultimaCaricia: new Date() }, $inc: { puntos: 5 } },
        { returnDocument: 'after' },
    );
    if (!c) {
        const doc = await CuidadoMascota.findOne({ guildId, userId, mes: N.mesClave() }).lean();
        const vuelve = doc?.ultimaCaricia ? new Date(new Date(doc.ultimaCaricia).getTime() + HORAS_CARICIA * 3600000) : new Date();
        return { error: t(idioma, `Ya la has acariciado hace poco. Vuelve <t:${Math.floor(vuelve.getTime() / 1000)}:R>.`, `You petted it recently. Come back <t:${Math.floor(vuelve.getTime() / 1000)}:R>.`) };
    }
    const r = N.sumarXp(m.nivel, m.xp, 10);
    const nuevo = await Mascota.findOneAndUpdate({ _id: m._id }, [{ $set: { alegria: { $min: [100, { $add: ['$alegria', 4 * (require('./mascotaExtras.js').pers(m).caricia || 1)] }] }, nivel: r.nivel, xp: r.xp, 'contadores.caricias': { $add: [{ $ifNull: ['$contadores.caricias', 0] }, 1] } } }], { returnDocument: 'after', updatePipeline: true });
    let oro = 0;
    if (N.ventajasDe(m).includes('caricia')) { oro = ORO_CARICIA; await require('./economia.js').darOro(userId, oro); }
    ponerCache(nuevo);
    return { ok: true, m: nuevo, oro };
}

// Juego de los vasos: se esconde una golosina debajo de uno.
const juegos = new Map(); // clave -> { guildId, userId, premio, exp }
async function empezarJuego(guildId, userId, idioma) {
    const m = await viva(guildId);
    if (!m) return { error: t(idioma, 'Todavía no hay mascota (o sigue en el huevo).', 'There’s no pet yet (or it’s still an egg).') };
    if (m.hibernando) return { error: t(idioma, `**${m.nombre}** está hibernando. Despiértala con \`/mascota alimentar\`.`, `**${m.nombre}** is hibernating. Wake it up with \`/pet feed\`.`) };
    const doc = await CuidadoMascota.findOne({ guildId, userId, mes: N.mesClave() }).lean();
    if (doc?.ultimoJuego && Date.now() - new Date(doc.ultimoJuego).getTime() < HORAS_JUEGO * 3600000) {
        const vuelve = new Date(new Date(doc.ultimoJuego).getTime() + HORAS_JUEGO * 3600000);
        return { error: t(idioma, `**${m.nombre}** está cansada de jugar. Vuelve <t:${Math.floor(vuelve.getTime() / 1000)}:R>.`, `**${m.nombre}** is tired of playing. Come back <t:${Math.floor(vuelve.getTime() / 1000)}:R>.`) };
    }
    await cuidado(guildId, userId, { ultimoJuego: new Date() });
    const clave = crypto.randomBytes(6).toString('hex');
    juegos.set(clave, { guildId, userId, premio: crypto.randomInt(3), exp: Date.now() + 5 * 60000 });
    for (const [k, j] of juegos) if (j.exp < Date.now()) juegos.delete(k);
    const fila = new ActionRowBuilder().addComponents([0, 1, 2].map((i) =>
        new ButtonBuilder().setCustomId(`mas_vaso:${clave}:${i}`).setEmoji('🥤').setLabel(`${i + 1}`).setStyle(ButtonStyle.Secondary)));
    return {
        ok: true,
        payload: {
            content: t(idioma, `${emojiDe(m)} **${m.nombre}** ha escondido una golosina debajo de un vaso. ¿Dónde está?`, `${emojiDe(m)} **${m.nombre}** hid a treat under a cup. Where is it?`),
            components: [fila],
        },
    };
}

async function resolverJuego(interaction, clave, eleccion, idioma) {
    const j = juegos.get(clave);
    if (!j || j.exp < Date.now()) return interaction.update({ content: t(idioma, '⌛ Este juego ha caducado. Juega otra vez con `/mascota jugar`.', '⌛ This game expired. Play again with `/pet play`.'), components: [] });
    if (j.userId !== interaction.user.id) return interaction.reply({ content: t(idioma, 'Este juego es de otra persona: empieza el tuyo con `/mascota jugar`.', 'This game belongs to someone else: start yours with `/pet play`.'), flags: 64 });
    juegos.delete(clave);
    const m = await viva(j.guildId);
    if (!m) return interaction.update({ content: '?', components: [] });
    const acierto = eleccion === j.premio;
    const r = N.sumarXp(m.nivel, m.xp, acierto ? 15 : 5);
    const nuevo = await Mascota.findOneAndUpdate({ _id: m._id }, [{ $set: { alegria: { $min: [100, { $add: ['$alegria', (acierto ? 7 : 3) * (require('./mascotaExtras.js').pers(m).juego || 1)] }] }, nivel: r.nivel, xp: r.xp } }], { returnDocument: 'after', updatePipeline: true });
    await cuidado(j.guildId, j.userId, {}, { puntos: acierto ? 6 : 3 });
    if (acierto) await require('./economia.js').darOro(j.userId, ORO_JUEGO);
    ponerCache(nuevo);
    const vasos = [0, 1, 2].map((i) => (i === j.premio ? '🍬' : (i === eleccion ? '❌' : '🥤'))).join(' ');
    return interaction.update({
        content: acierto
            ? t(idioma, `${vasos}\n🎉 ¡La has encontrado! **${m.nombre}** está encantada (+🪙 ${ORO_JUEGO}).`, `${vasos}\n🎉 You found it! **${m.nombre}** loves it (+🪙 ${ORO_JUEGO}).`)
            : t(idioma, `${vasos}\n😅 ¡Casi! **${m.nombre}** se ha reído igual. Vuelve a jugar en ${HORAS_JUEGO} h.`, `${vasos}\n😅 So close! **${m.nombre}** had fun anyway. Play again in ${HORAS_JUEGO} h.`),
        components: [],
    });
}

// Ventaja de nivel 15: protege a alguien de las bromas 6 h (una vez al día por servidor).
async function proteger(guildId, userId, objetivoId, idioma) {
    const m = await viva(guildId);
    if (!m) return { error: t(idioma, 'Todavía no hay mascota (o sigue en el huevo).', 'There’s no pet yet (or it’s still an egg).') };
    if (!N.ventajasDe(m).includes('proteger')) return { error: t(idioma, `**${m.nombre}** aún no sabe proteger (nivel 15, y tiene que estar sana y despierta).`, `**${m.nombre}** can’t protect yet (level 15, and it must be healthy and awake).`) };
    const hoy = N.diaClave();
    const r = await Mascota.updateOne({ _id: m._id, ultimoProteger: { $ne: hoy } }, { $set: { ultimoProteger: hoy } });
    if (!r.modifiedCount) return { error: t(idioma, `**${m.nombre}** ya ha protegido a alguien hoy. Mañana más.`, `**${m.nombre}** already protected someone today. Try tomorrow.`) };
    const hasta = new Date(Date.now() + 6 * 3600000);
    await require('../models/PerfilBroma.js').updateOne({ guildId, userId: objetivoId }, { $max: { escudoHasta: hasta } }, { upsert: true });
    await cuidado(guildId, userId, {}, { puntos: 2 });
    return { ok: true, m, hasta };
}

async function rankingCuidadores(guildId, limite = 10) {
    return CuidadoMascota.find({ guildId, mes: N.mesClave(), puntos: { $gt: 0 } }).sort({ puntos: -1 }).limit(limite).lean();
}

// Susto (anti-raid): la mascota avisa de que algo raro pasa. Una vez cada hora como mucho.
const sustos = new Map();
async function susto(client, guildId) {
    if (Date.now() - (sustos.get(guildId) || 0) < 3600000) return;
    sustos.set(guildId, Date.now());
    const cfg = await ServidorConfig.findOne({ guildId }).select('guildId idioma mascota').lean();
    if (!cfg?.mascota?.activo || cfg.mascota.avisos === false) return;
    const m = await viva(guildId);
    if (!m) return;
    await Mascota.updateOne({ _id: m._id }, [{ $set: { alegria: { $max: [0, { $subtract: ['$alegria', 10] }] } } }], { updatePipeline: true });
    await enviarAlCanal(client, cfg, { content: t(cfg, `😨 **${m.nombre}** se ha escondido: está entrando muchísima gente de golpe. El staff ya está avisado.`, `😨 **${m.nombre}** is hiding: lots of people are joining at once. The staff has been alerted.`) });
}

// Saludo a quien entra (como mucho uno cada 2 minutos, para no llenar el canal).
const saludos = new Map();
async function saludarNuevo(client, member, cfg) {
    if (!cfg?.mascota?.activo || cfg.mascota.saludarNuevos === false || member.user.bot) return;
    if (Date.now() - (saludos.get(member.guild.id) || 0) < 120000) return;
    const m = await viva(member.guild.id);
    if (!m || m.hibernando) return;
    saludos.set(member.guild.id, Date.now());
    const frases = t(cfg,
        [`${emojiDe(m)} **${m.nombre}** se acerca a <@${member.id}> y le olfatea con curiosidad. ¡Bienvenido!`, `${emojiDe(m)} **${m.nombre}** da saltitos de alegría: ¡ha llegado <@${member.id}>!`, `${emojiDe(m)} **${m.nombre}** le trae un regalo a <@${member.id}>: una piedra muy bonita. ¡Bienvenido!`],
        [`${emojiDe(m)} **${m.nombre}** walks up to <@${member.id}> and sniffs curiously. Welcome!`, `${emojiDe(m)} **${m.nombre}** hops around happily: <@${member.id}> is here!`, `${emojiDe(m)} **${m.nombre}** brings <@${member.id}> a gift: a very pretty rock. Welcome!`]);
    await enviarAlCanal(client, cfg, { content: frases[crypto.randomInt(frases.length)], allowedMentions: { users: [member.id] } });
}

// ---------------------------------------------------------------------------
// Botones y ventanas (mas_*)
// ---------------------------------------------------------------------------
async function manejar(interaction, client) {
    const id = interaction.customId || '';
    if (!id.startsWith('mas_')) return false;
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);

    if (interaction.isButton() && id.startsWith('mas_ev:')) {
        await require('./mascotaVida.js').responderEvento(interaction, client, cfg, idioma);
        return true;
    }
    if (interaction.isStringSelectMenu() && id === 'mas_comprar') {
        const vida = require('./mascotaVida.js');
        const r = await vida.comprar(client, cfg, interaction.guildId, interaction.user.id, interaction.values[0], idioma, interaction.member?.displayName || interaction.user.username);
        if (r.error) { await interaction.reply({ content: `❌ ${r.error}`, flags: 64 }); return true; }
        const a = r.articulo;
        await interaction.reply({
            content: a.tipo === 'comida'
                ? t(idioma, `${a.emoji} <@${interaction.user.id}> le ha dado **${a.es}** a **${r.m.nombre}** (🪙 ${a.precio}).${r.desperto ? ' ¡Y se ha despertado! ☀️' : ''}`, `${a.emoji} <@${interaction.user.id}> gave **${r.m.nombre}** some **${a.en}** (🪙 ${a.precio}).${r.desperto ? ' And it woke up! ☀️' : ''}`)
                : t(idioma, `🎁 <@${interaction.user.id}> le ha regalado ${a.emoji || '🏞️'} **${a.es}** a **${r.m.nombre}** (🪙 ${a.precio}). ¡Ya lo lleva puesto!`, `🎁 <@${interaction.user.id}> gave **${r.m.nombre}** ${a.emoji || '🏞️'} **${a.en}** (🪙 ${a.precio}). It’s wearing it now!`),
            allowedMentions: { parse: [] },
        });
        return true;
    }
    if (interaction.isButton() && id.startsWith('mas_vaso:')) {
        const [, clave, i] = id.split(':');
        await resolverJuego(interaction, clave, parseInt(i, 10), idioma);
        return true;
    }
    const m = await Mascota.findOne({ guildId: interaction.guildId, estado: 'huevo' });
    if (!m) { await interaction.reply({ content: t(idioma, 'Esta votación ya ha terminado.', 'This vote has already ended.'), flags: 64 }); return true; }
    const uid = interaction.user.id;

    if (interaction.isButton() && id.startsWith('mas_esp:')) {
        const especie = id.split(':')[1];
        if (!N.ESPECIES[especie]) return true;
        await Mascota.updateOne({ _id: m._id }, { $pull: { 'votacion.especies': { userId: uid } } });
        const nuevo = await Mascota.findOneAndUpdate({ _id: m._id }, { $push: { 'votacion.especies': { userId: uid, especie } } }, { returnDocument: 'after' });
        await interaction.reply({ content: t(idioma, `🗳️ Has votado por **${nombreEspecie(especie, idioma)}** ${N.ESPECIES[especie].emoji}. Puedes cambiar tu voto cuando quieras.`, `🗳️ You voted for **${nombreEspecie(especie, idioma)}** ${N.ESPECIES[especie].emoji}. You can change it any time.`), flags: 64 });
        await refrescarVotacion(client, nuevo, cfg);
        return true;
    }
    if (interaction.isButton() && id === 'mas_nom') {
        const modal = new ModalBuilder().setCustomId('mas_nommodal').setTitle(t(idioma, 'Propón un nombre', 'Suggest a name'))
            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nombre')
                .setLabel(t(idioma, 'Nombre (2-20 letras)', 'Name (2-20 letters)')).setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(20).setRequired(true)));
        await interaction.showModal(modal);
        return true;
    }
    if (interaction.isModalSubmit() && id === 'mas_nommodal') {
        const nombre = interaction.fields.getTextInputValue('nombre').trim();
        const { palabraProhibida } = require('./confesiones.js');
        if (!N.nombreValido(nombre) || (palabraProhibida && palabraProhibida(nombre, cfg))) {
            await interaction.reply({ content: t(idioma, '❌ Ese nombre no vale: 2-20 letras, sin menciones, enlaces ni palabras prohibidas.', '❌ That name isn’t allowed: 2-20 letters, no mentions, links or banned words.'), flags: 64 });
            return true;
        }
        const lista = (m.votacion.nombres || []).filter((x) => x.userId !== uid);
        if (lista.some((x) => x.nombre.toLowerCase() === nombre.toLowerCase())) {
            await interaction.reply({ content: t(idioma, 'Ese nombre ya está propuesto: vótalo en el menú.', 'That name is already suggested: vote for it in the menu.'), flags: 64 });
            return true;
        }
        if (lista.length >= MAX_NOMBRES) {
            await interaction.reply({ content: t(idioma, 'Ya hay demasiados nombres propuestos: vota uno de los que hay.', 'There are too many suggestions already: vote for one of them.'), flags: 64 });
            return true;
        }
        lista.push({ userId: uid, nombre, votos: [uid] });
        const nuevo = await Mascota.findOneAndUpdate({ _id: m._id }, { $set: { 'votacion.nombres': lista } }, { returnDocument: 'after' });
        await interaction.reply({ content: t(idioma, `💡 Has propuesto **${nombre}** (y le has dado tu voto).`, `💡 You suggested **${nombre}** (and voted for it).`), flags: 64 });
        await refrescarVotacion(client, nuevo, cfg);
        return true;
    }
    if (interaction.isStringSelectMenu() && id === 'mas_vnom') {
        const i = parseInt(interaction.values[0], 10);
        const lista = (m.votacion.nombres || []).map((x) => ({ userId: x.userId, nombre: x.nombre, votos: (x.votos || []).filter((v) => v !== uid) }));
        if (!lista[i]) return true;
        lista[i].votos.push(uid);
        const nuevo = await Mascota.findOneAndUpdate({ _id: m._id }, { $set: { 'votacion.nombres': lista } }, { returnDocument: 'after' });
        await interaction.reply({ content: t(idioma, `🗳️ Has votado el nombre **${lista[i].nombre}**.`, `🗳️ You voted for the name **${lista[i].nombre}**.`), flags: 64 });
        await refrescarVotacion(client, nuevo, cfg);
        return true;
    }
    return false;
}

// Para el panel.
async function resumen(client, guildId) {
    const m = await Mascota.findOne({ guildId }).lean();
    const guild = client.guilds.cache.get(guildId);
    const persona = (id) => {
        const mem = guild?.members.cache.get(id);
        return { id, nombre: mem?.displayName || id, avatar: mem?.user.displayAvatarURL({ size: 64 }) || null };
    };
    const cuidadores = (await rankingCuidadores(guildId, 10)).map((c) => ({ ...persona(c.userId), puntos: c.puntos, oro: c.oro }));
    if (!m) return { mascota: null, cuidadores };
    const votos = {};
    for (const x of m.votacion?.especies || []) votos[x.especie] = (votos[x.especie] || 0) + 1;
    return {
        mascota: {
            estado: m.estado, especie: m.especie, nombre: m.nombre, nivel: m.nivel, xp: m.xp, xpNecesaria: N.xpParaSubir(m.nivel),
            hambre: m.hambre, alegria: m.alegria, salud: m.salud, forma: m.forma, hibernando: m.hibernando,
            fase: N.faseDe(m).id, animo: N.animoDe(m), ventajas: N.ventajasDe(m), poder: N.poderDe(m),
            nacida: m.nacida, contadores: m.contadores, cuidador: m.cuidadorId ? persona(m.cuidadorId) : null,
            personalidad: m.personalidad, energia: m.energia ?? 100, stats: m.stats || {}, accesorio: m.accesorio, accesorios: m.accesorios || [],
            habitat: m.habitat || 'prado', habitats: m.habitats || ['prado'], logros: m.logros || [],
            diario: [...(m.diario || [])].reverse().slice(0, 30).map((r) => ({ tipo: r.tipo, fecha: r.fecha, es: require('./mascotaExtras.js').textoRecuerdo(r, 'es'), en: require('./mascotaExtras.js').textoRecuerdo(r, 'en') })),
            votacion: m.estado === 'huevo' ? { fin: m.votacion?.fin, especies: votos, nombres: (m.votacion?.nombres || []).map((x) => ({ nombre: x.nombre, votos: x.votos.length })) } : null,
        },
        cuidadores,
    };
}

module.exports = {
    enviarAlCanal,
    registrarMensaje, registrarIncidente, registrarCancion, tomarActividad,
    bonusXpServidor, descuentoBromasServidor, ponerCache, cargarCache,
    iniciarHuevo, eclosionar, barrerMascotas, pasadaServidor, mensajeVotacion,
    alimentar, acariciar, empezarJuego, resolverJuego, proteger, rankingCuidadores,
    embedMascota, tarjeta, fraseAnimo, susto, saludarNuevo, manejar, resumen, emojiDe,
    HORAS_CARICIA, HORAS_JUEGO, ORO_CARICIA, ORO_JUEGO, _juegos: juegos, _actividad: actividad,
};
