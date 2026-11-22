// Compañeros tipo tamagotchi (1.20.0): /compi enseña tu compañero con su tarjeta
// (animada al cuidarlo) y botones para darle de comer, jugar, mimarlo, hablar con él,
// mandarlo de expedición, cambiar de compañero, equiparlo y ponerle apodo. Hay misiones
// del día y racha. Las reglas, en utils/compisNucleo.js; los compañeros, en utils/cofresNucleo.js.
// También carga los compañeros propios de cada servidor (models/CompaneroServidor.js).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const CompaneroServidor = require('../models/CompaneroServidor.js');
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');
const { t } = require('./i18n.js');

const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const nombreDe = (m, idioma) => m.apodo || t(idioma, K.def(m.id).es, K.def(m.id).en);
const corto = (m, idioma) => (m.apodo || t(idioma, K.def(m.id).es, K.def(m.id).en).split(',')[0]);
const rzTexto = (id, idioma) => { const r = K.RAREZAS[K.def(id).rareza]; return `${r.emoji} ${t(idioma, r.es, r.en)}`; };

// ---------- Compañeros de los servidores ----------
const idServidor = (c) => `s:${c.guildId}:${c.cid}`;
async function cargarPersonalizados() {
    const lista = await CompaneroServidor.find().lean();
    for (const c of lista) K.registrarPersonalizado({ ...c, id: idServidor(c) });
    return lista.length;
}

// Una acción a la vez por persona (botones pulsados muy rápido no se pisan).
const colas = new Map();
function enCola(userId, fn) {
    const antes = colas.get(userId) || Promise.resolve();
    const ahora = antes.catch(() => {}).then(fn);
    colas.set(userId, ahora);
    ahora.finally(() => { if (colas.get(userId) === ahora) colas.delete(userId); }).catch(() => {});
    return ahora;
}

const elegir = (col, compId) => {
    const l = col?.mascotas || [];
    return l.find((m) => m.id === compId) || l.find((m) => m.id === col.equipada) || l[0] || null;
};

// Hace una acción (ver, comer, jugar, mimar, hablar, exp:<tipo>) y lo guarda todo.
// Devuelve { col, m, mensajes, efecto, frase, fallo }.
async function accion(userId, compId, que, { idioma = 'es', dueno = '', ahora = Date.now() } = {}) {
    return enCola(userId, async () => {
        const col = await ColeccionMascotas.findOne({ userId }).lean();
        const m0 = elegir(col, compId);
        if (!m0) return { fallo: 'sin' };
        let m = { ...m0 };
        const set = {}; const mensajes = []; let efecto = null; let oro = 0;
        const nivelAntes = P.nivel(m.afinidad || 0);
        const dia = P.diaDe(ahora);
        let mis = col.misiones; let colSet = {};
        const sumarMision = (a) => {
            const r = P.avanzarMision(mis, a, dia);
            mis = r.mis;
            if (r.cumplida) {
                const def = P.MISIONES[r.cumplida];
                oro += P.PREMIO_MISION.oro; m.afinidad = (m.afinidad || 0) + P.PREMIO_MISION.afinidad;
                mensajes.push(t(idioma, `✅ Misión cumplida: ${def.emoji} ${def.es} → 🪙 ${P.PREMIO_MISION.oro}`, `✅ Mission done: ${def.emoji} ${def.en} → 🪙 ${P.PREMIO_MISION.oro}`));
            }
            if (r.todas) { oro += P.PREMIO_TODAS; mensajes.push(t(idioma, `🏆 ¡Todas las misiones de hoy! +🪙 ${P.PREMIO_TODAS}`, `🏆 All of today’s missions! +🪙 ${P.PREMIO_TODAS}`)); }
        };
        // Si volvió de una expedición, recoge lo que trae.
        if (P.expedicionLista(m, ahora)) {
            const b = P.botin(m);
            const x = P.EXPEDICIONES[m.exp.tipo];
            oro += b.oro; m.afinidad = (m.afinidad || 0) + b.afinidad;
            const e = P.estado({ ...m, exp: null }, ahora);
            Object.assign(m, e, { actualizado: new Date(ahora), exp: null });
            if (b.recuerdo !== null && !(m.recuerdos || []).includes(b.recuerdo)) m.recuerdos = [...(m.recuerdos || []), b.recuerdo];
            const rec = b.recuerdo !== null ? P.RECUERDOS[b.recuerdo] : null;
            mensajes.push(t(idioma, `${x.emoji} **¡Ha vuelto de «${x.es}»!** Trae 🪙 ${b.oro}${rec ? ` y un recuerdo: ${rec[0]} ${rec[1]}` : ''}.`, `${x.emoji} **Back from “${x.en}”!** Brought 🪙 ${b.oro}${rec ? ` and a souvenir: ${rec[0]} ${rec[2]}` : ''}.`));
            efecto = 'vuelta';
        }
        let frase = null; let fallo = null;
        if (que === 'comer' || que === 'jugar' || que === 'mimar') {
            const r = P.cuidar(m, que, ahora);
            if (r.fallo) fallo = r.fallo;
            else {
                Object.assign(m, { hambre: r.hambre, alegria: r.alegria, energia: r.energia, actualizado: new Date(ahora) });
                m.afinidad = (m.afinidad || 0) + r.afinidad;
                m.cuidados = (m.cuidados || 0) + 1;
                if (que === 'mimar' && r.afinidad) m.ultMimo = new Date(ahora);
                frase = P.frase(m, que, { idioma, dueno, ahora });
                efecto = que;
                sumarMision(que);
                if (r.humor === 'feliz') sumarMision('feliz');
            }
        } else if (que === 'hablar') {
            if (P.expedicionActiva(m, ahora)) fallo = 'fuera';
            else { frase = P.frase(m, 'hablar', { idioma, dueno, ahora }); efecto = 'hablar'; sumarMision('hablar'); }
        } else if (que.startsWith('exp:')) {
            const r = P.salir(m, que.slice(4), col.expHoy, dia, ahora);
            if (r.fallo) fallo = r.fallo;
            else {
                Object.assign(m, { hambre: r.hambre, alegria: r.alegria, energia: r.energia, actualizado: new Date(ahora), exp: r.exp });
                colSet.expHoy = { dia, n: r.usadas };
                const x = P.EXPEDICIONES[r.exp.tipo];
                mensajes.push(t(idioma, `${x.emoji} Se va de «${x.es}». Vuelve en ${x.horas} h: entra a verlo luego para recoger lo que traiga.`, `${x.emoji} Off on “${x.en}”. Back in ${x.horas} h: come back later to collect what it brings.`));
                sumarMision('expedicion');
            }
        }
        if (!frase && !fallo && !P.expedicionActiva(m, ahora)) frase = P.frase(m, que === 'ver' ? 'hablar' : 'saludo', { idioma, dueno, ahora });
        // Racha: cualquier cuidado cuenta (ver no).
        const cuida = !fallo && que !== 'ver';
        if (cuida) {
            const r = P.avanzarRacha(col, dia);
            if (r.nueva) {
                colSet.racha = r.racha; colSet.ultimoDiaCuidado = dia; colSet.mejorRacha = Math.max(col.mejorRacha || 0, r.racha);
                if (r.premio) { oro += r.premio; mensajes.push(t(idioma, `🔥 ¡${r.racha} días seguidos cuidándolo! +🪙 ${r.premio}`, `🔥 ${r.racha} days in a row! +🪙 ${r.premio}`)); }
            }
        }
        const nivelDespues = P.nivel(m.afinidad || 0);
        if (nivelDespues > nivelAntes) { mensajes.push(t(idioma, `⭐ **¡Sube a nivel ${nivelDespues} de afinidad!** Sus ventajas mejoran un poco.`, `⭐ **Affinity level ${nivelDespues}!** Its perks get a little better.`)); efecto = 'nivel'; }
        // Guardar (solo lo que cambia).
        for (const k of ['hambre', 'alegria', 'energia', 'actualizado', 'afinidad', 'ultMimo', 'exp', 'recuerdos', 'cuidados']) {
            if (m[k] !== m0[k]) set[`mascotas.$[m].${k}`] = m[k];
        }
        if (mis !== col.misiones) colSet.misiones = mis;
        if (oro) colSet.oroCompis = (col.oroCompis || 0) + oro;
        if (Object.keys(set).length || Object.keys(colSet).length) {
            await ColeccionMascotas.updateOne({ userId }, { $set: { ...set, ...colSet } }, Object.keys(set).length ? { arrayFilters: [{ 'm.id': m.id }] } : {});
        }
        if (oro) await require('./economia.js').darOro(userId, oro);
        if (cuida) require('./cofres.js').olvidar(userId);
        return { col: { ...col, ...colSet }, m, mensajes, efecto, frase, fallo, oro };
    });
}

const FALLOS = {
    sin: ['Aún no tienes compañeros. Consigue el primero abriendo un cofre con `/cofre abrir`.', 'You don’t have companions yet. Get your first one by opening a chest with `/chest open`.'],
    fuera: ['Está de expedición. Vuelve cuando termine.', 'It’s on an expedition. Come back when it’s done.'],
    energia: ['Está muy cansado para eso. Deja que descanse un rato (la energía se recupera sola).', 'Too tired for that. Let it rest a while (energy comes back on its own).'],
    lleno: ['¡Está llenísimo! Prueba a jugar con él.', 'It’s completely full! Try playing with it.'],
    tope: [`Ya ha hecho ${P.EXPEDICIONES_DIA} expediciones hoy. Mañana más.`, `It already went on ${P.EXPEDICIONES_DIA} expeditions today. More tomorrow.`],
    recoger: ['Ya ha vuelto: entra a verlo para recoger lo que trae.', 'It’s back: open it to collect what it brought.'],
    tipo: ['Esa expedición no existe.', 'That expedition doesn’t exist.'],
    accion: ['No sé hacer eso.', 'I can’t do that.'],
};
const textoFallo = (f, idioma) => { const x = FALLOS[f] || FALLOS.accion; return t(idioma, x[0], x[1]); };

function tiempo(ms, idioma) {
    const min = Math.max(1, Math.ceil(ms / 60000));
    const h = Math.floor(min / 60);
    return h ? t(idioma, `${h} h ${min % 60} min`, `${h} h ${min % 60} min`) : `${min} min`;
}

// Mensaje completo de /compi (tarjeta + botones). `ajeno`: se mira el de otra persona (sin botones).
async function vista({ ownerId, duenoNombre, idioma, res, ajeno = false }) {
    const { col, m } = res;
    const ahora = Date.now();
    const def = K.def(m.id);
    const rz = K.RAREZAS[def.rareza];
    const e = P.estado(m, ahora);
    const fuera = P.expedicionActiva(m, ahora);
    const h = fuera ? 'fuera' : P.humor(e);
    const pr = P.progresoNivel(m.afinidad || 0);
    const x = fuera ? P.EXPEDICIONES[m.exp.tipo] : null;
    const equipado = col.equipada === m.id;
    const datos = {
        id: m.id, nombre: nombreDe(m, idioma), rarezaTexto: t(idioma, rz.es, rz.en).toUpperCase(), estrellas: m.estrellas,
        nivel: pr.nivel, progreso: pr.max ? 1 : pr.actual / pr.total, estado: e,
        humor: { emoji: P.HUMOR[h].emoji, texto: t(idioma, P.HUMOR[h].es, P.HUMOR[h].en) },
        frase: res.frase || '…',
        fuera: fuera ? t(idioma, `${x.emoji} De «${x.es}». Vuelve en ${tiempo(new Date(m.exp.hasta).getTime() - ahora, idioma)}.`, `${x.emoji} On “${x.en}”. Back in ${tiempo(new Date(m.exp.hasta).getTime() - ahora, idioma)}.`) : null,
        etiquetas: {
            hambre: t(idioma, '🍖 Barriga', '🍖 Tummy'), alegria: t(idioma, '💖 Alegría', '💖 Joy'), energia: t(idioma, '⚡ Energía', '⚡ Energy'),
            nivel: pr.max ? t(idioma, `Afinidad · nivel ${pr.nivel} (máximo)`, `Affinity · level ${pr.nivel} (max)`) : t(idioma, `Afinidad · nivel ${pr.nivel} (${pr.actual}/${pr.total})`, `Affinity · level ${pr.nivel} (${pr.actual}/${pr.total})`),
        },
        pie: t(idioma, `De ${duenoNombre}${equipado ? ' · equipado' : ''} · ${(m.cuidados || 0)} cuidados`, `${duenoNombre}’s${equipado ? ' · equipped' : ''} · ${(m.cuidados || 0)} cares`),
    };
    const img = await require('./compisArte.js').tarjeta(datos, res.efecto).catch((err) => { console.error('Tarjeta compi:', err.message); return null; });
    const dia = P.diaDe(ahora);
    const mis = col.misiones && col.misiones.dia === dia ? col.misiones : { prog: {}, hechas: [] };
    const misiones = P.misionesDelDia(dia).map((id) => {
        const d = P.MISIONES[id]; const hecha = (mis.hechas || []).includes(id);
        return `${hecha ? '✅' : '⬜'} ${d.emoji} ${t(idioma, d.es, d.en)}${hecha ? '' : ` (${Math.min(d.n, (mis.prog || {})[id] || 0)}/${d.n})`}`;
    }).join('\n');
    const v = K.ventajas(m.id, m.estrellas, P.extraCuidado(m, ahora));
    const recs = (m.recuerdos || []).map((i) => P.RECUERDOS[i]?.[0]).filter(Boolean);
    const racha = col.ultimoDiaCuidado === dia || col.ultimoDiaCuidado === new Date(Date.parse(`${dia}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) ? (col.racha || 0) : 0;
    const emb = new EmbedBuilder().setColor(rz.color)
        .setTitle(`${def.emoji} ${nombreDe(m, idioma)}`)
        .setDescription([
            ...(res.mensajes || []),
            res.fallo ? `⚠️ ${textoFallo(res.fallo, idioma)}` : '',
            def.desc ? `*${def.desc}*` : '',
        ].filter(Boolean).join('\n') || null)
        .addFields(
            { name: t(idioma, '📋 Misiones de hoy', '📋 Today’s missions'), value: misiones, inline: true },
            { name: t(idioma, '🔥 Racha', '🔥 Streak'), value: t(idioma, `${racha} día${racha === 1 ? '' : 's'}\n🧭 Expediciones: ${col.expHoy?.dia === dia ? col.expHoy.n : 0}/${P.EXPEDICIONES_DIA}`, `${racha} day${racha === 1 ? '' : 's'}\n🧭 Expeditions: ${col.expHoy?.dia === dia ? col.expHoy.n : 0}/${P.EXPEDICIONES_DIA}`), inline: true },
            { name: t(idioma, `🎒 Recuerdos (${recs.length}/${P.RECUERDOS.length})`, `🎒 Souvenirs (${recs.length}/${P.RECUERDOS.length})`), value: recs.join(' ') || t(idioma, 'Tráelos de las expediciones.', 'Bring them back from expeditions.'), inline: false },
        )
        .setFooter({ text: t(idioma, `${equipado ? 'Equipado' : 'Si lo equipas'}: ${require('./cofres.js').textoVentajas(v, idioma)}`, `${equipado ? 'Equipped' : 'If equipped'}: ${require('./cofres.js').textoVentajas(v, idioma)}`).slice(0, 2000) });
    if (img) emb.setImage(`attachment://${img.nombre}`);
    const files = img ? [new AttachmentBuilder(img.buffer, { name: img.nombre })] : [];
    if (ajeno) return { embeds: [emb], files, components: [], attachments: [], allowedMentions: { parse: [] } };
    const cid = (a) => `cmp:${a}:${ownerId}:${m.id}`;
    const filas = [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(cid('comer')).setEmoji('🍖').setLabel(t(idioma, 'Dar de comer', 'Feed')).setStyle(ButtonStyle.Success).setDisabled(fuera),
        new ButtonBuilder().setCustomId(cid('jugar')).setEmoji('🎾').setLabel(t(idioma, 'Jugar', 'Play')).setStyle(ButtonStyle.Primary).setDisabled(fuera),
        new ButtonBuilder().setCustomId(cid('mimar')).setEmoji('🤗').setLabel(t(idioma, 'Mimar', 'Cuddle')).setStyle(ButtonStyle.Primary).setDisabled(fuera),
        new ButtonBuilder().setCustomId(cid('hablar')).setEmoji('💬').setLabel(t(idioma, 'Hablar', 'Talk')).setStyle(ButtonStyle.Secondary).setDisabled(fuera),
    )];
    if (!fuera) {
        filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`cmp_exp:${ownerId}:${m.id}`)
            .setPlaceholder(t(idioma, '🧭 Mandarlo de expedición…', '🧭 Send it on an expedition…'))
            .addOptions(Object.entries(P.EXPEDICIONES).map(([id, ex]) => ({
                value: id, emoji: ex.emoji, label: `${t(idioma, ex.es, ex.en)} · ${ex.horas} h`.slice(0, 100),
                description: t(idioma, `Gasta ⚡${ex.energia} · trae 🪙 ${ex.oro[0]}-${ex.oro[1]}+ y quizá un recuerdo`, `Uses ⚡${ex.energia} · brings 🪙 ${ex.oro[0]}-${ex.oro[1]}+ and maybe a souvenir`).slice(0, 100),
            })))));
    }
    const lista = [...(col.mascotas || [])].sort((a, b) => (b.id === col.equipada) - (a.id === col.equipada) || K.RAREZAS[K.def(b.id).rareza].orden - K.RAREZAS[K.def(a.id).rareza].orden).slice(0, 25);
    if (lista.length > 1) {
        filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`cmp_sel:${ownerId}`)
            .setPlaceholder(t(idioma, '🔄 Ver otro compañero…', '🔄 See another companion…'))
            .addOptions(lista.map((c) => {
                const hc = P.expedicionActiva(c, ahora) ? 'fuera' : P.humor(P.estado(c, ahora));
                return { value: c.id, emoji: K.def(c.id).emoji, label: `${corto(c, idioma)} ${'★'.repeat(c.estrellas || 1)}`.slice(0, 100), default: c.id === m.id, description: `${P.HUMOR[hc].emoji} ${t(idioma, P.HUMOR[hc].es, P.HUMOR[hc].en)} · ${t(idioma, 'nivel', 'level')} ${P.nivel(c.afinidad || 0)} · ${rzTexto(c.id, idioma)}`.slice(0, 100) };
            }))));
    }
    filas.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(cid('equipar')).setEmoji('✅').setLabel(equipado ? t(idioma, 'Equipado', 'Equipped') : t(idioma, 'Equipar', 'Equip')).setStyle(ButtonStyle.Secondary).setDisabled(equipado),
        new ButtonBuilder().setCustomId(cid('apodo')).setEmoji('✏️').setLabel(t(idioma, 'Ponerle apodo', 'Nickname')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(cid('ver')).setEmoji('🔄').setLabel(t(idioma, 'Actualizar', 'Refresh')).setStyle(ButtonStyle.Secondary),
    ));
    return { embeds: [emb], files, components: filas, attachments: [], allowedMentions: { parse: [] } };
}

// Botones y menús (cmp:…, cmp_exp:…, cmp_sel:…, cmp_apodo:…).
async function manejar(interaction) {
    const id = interaction.customId || '';
    if (!id.startsWith('cmp')) return false;
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    const partes = id.split(':');
    let que; let owner; let comp;
    if (partes[0] === 'cmp') { que = partes[1]; owner = partes[2]; comp = partes.slice(3).join(':'); }
    else if (partes[0] === 'cmp_exp') { owner = partes[1]; comp = partes.slice(2).join(':'); que = `exp:${interaction.values[0]}`; }
    else if (partes[0] === 'cmp_sel') { owner = partes[1]; comp = interaction.values[0]; que = 'ver'; }
    else if (partes[0] === 'cmp_apodo') { owner = partes[1]; comp = partes.slice(2).join(':'); que = 'apodo_guardar'; }
    else return false;
    if (interaction.user.id !== owner) {
        await interaction.reply({ content: t(idioma, '🐾 Este compañero no es tuyo. Mira el tuyo con `/compi`.', '🐾 This companion isn’t yours. See yours with `/companion`.'), flags: 64 });
        return true;
    }
    if (que === 'apodo') {
        const modal = new ModalBuilder().setCustomId(`cmp_apodo:${owner}:${comp}`).setTitle(t(idioma, 'Apodo de tu compañero', 'Your companion’s nickname'))
            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('apodo').setLabel(t(idioma, 'Apodo (vacío para quitarlo)', 'Nickname (empty to remove)')).setStyle(TextInputStyle.Short).setMaxLength(24).setRequired(false)));
        await interaction.showModal(modal);
        return true;
    }
    await interaction.deferUpdate();
    let res;
    if (que === 'equipar') {
        await require('./cofres.js').equipar(owner, comp);
        res = await accion(owner, comp, 'ver', { idioma, dueno: interaction.user.displayName || interaction.user.username });
        if (!res.fallo) res.mensajes.unshift(t(idioma, `✅ Ahora te acompaña ${K.def(comp).emoji} **${corto(res.m, idioma)}**: sus ventajas ya cuentan.`, `✅ ${K.def(comp).emoji} **${corto(res.m, idioma)}** is now with you: its perks are active.`));
    } else if (que === 'apodo_guardar') {
        const apodo = String(interaction.fields.getTextInputValue('apodo') || '').replace(/[\n\r@#<>`*_~|]/g, '').trim().slice(0, 24);
        await ColeccionMascotas.updateOne({ userId: owner }, apodo ? { $set: { 'mascotas.$[m].apodo': apodo } } : { $unset: { 'mascotas.$[m].apodo': 1 } }, { arrayFilters: [{ 'm.id': comp }] });
        res = await accion(owner, comp, 'ver', { idioma, dueno: interaction.user.displayName || interaction.user.username });
        if (!res.fallo) res.mensajes.unshift(apodo ? t(idioma, `✏️ Ahora se llama **${apodo}**.`, `✏️ It’s now called **${apodo}**.`) : t(idioma, '✏️ Apodo quitado.', '✏️ Nickname removed.'));
    } else {
        res = await accion(owner, comp, que, { idioma, dueno: interaction.user.displayName || interaction.user.username });
    }
    if (res.fallo === 'sin') { await interaction.followUp({ content: textoFallo('sin', idioma), flags: 64 }); return true; }
    await interaction.editReply(await vista({ ownerId: owner, duenoNombre: interaction.user.displayName || interaction.user.username, idioma, res }));
    return true;
}

// Para el panel: cómo van los compañeros de la gente del servidor.
async function resumenServidor(client, guildId) {
    const guild = client.guilds.cache.get(guildId);
    const ids = guild ? [...guild.members.cache.keys()] : [];
    const cols = ids.length ? await ColeccionMascotas.find({ userId: { $in: ids }, 'mascotas.0': { $exists: true } }).select('userId mascotas equipada racha').lean() : [];
    const top = cols.map((c) => {
        const eq = elegir(c, c.equipada);
        return { id: c.userId, nombre: guild.members.cache.get(c.userId)?.displayName || c.userId, avatar: guild.members.cache.get(c.userId)?.user.displayAvatarURL({ size: 64 }) || null, companero: eq?.id, apodo: eq?.apodo || null, nivel: P.nivel(eq?.afinidad || 0), racha: c.racha || 0, total: c.mascotas.length };
    }).sort((a, b) => b.nivel - a.nivel || b.total - a.total).slice(0, 10);
    return { personas: cols.length, top };
}

module.exports = { cargarPersonalizados, idServidor, accion, vista, manejar, resumenServidor, textoFallo };
