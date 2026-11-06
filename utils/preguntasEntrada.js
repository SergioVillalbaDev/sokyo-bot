// ============================================================================
// Preguntas al entrar (1.9.12) — una sola verificación para todo.
//
// Tras pasar la verificación (un clic, captcha o la doble bienvenida), el bot hace
// las preguntas del servidor una a una, en un mensaje que solo ve el nuevo miembro
// (o por privado, en la doble bienvenida por MD): «¿Qué edad tienes?», «¿De dónde
// eres?», «¿Quieres recibir anuncios?», «¿A qué juegas?»… Cada opción puede dar un
// rol. Al terminar se le dan esos roles y el ROL DE ACCESO: así no ve el servidor
// hasta haber respondido (con el servidor cerrado: utils/cierreServidor.js) y las
// categorías de juegos solo las de los roles que eligió.
//
// Los customId llevan el servidor (`entq:<guildId>:<n>`) para que funcione también
// por privado. Lo respondido se guarda en memoria 15 minutos (si el bot se reinicia
// a mitad, se vuelve a empezar con el botón).
// ============================================================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { t } = require('./i18n.js');
const puerta = require('./puertaEntrada.js');

const DURA_MS = 15 * 60 * 1000;
const sesiones = new Map(); // `${gid}:${uid}` -> { respuestas: { preguntaId: [opcionIds] }, origen, expira }
setInterval(() => {
    const ahora = Date.now();
    for (const [k, v] of sesiones) if (v.expira <= ahora) sesiones.delete(k);
}, 60000).unref();

// Preguntas que se pueden hacer (con texto y al menos una opción), saneadas.
function preguntasValidas(cfg) {
    const pe = cfg && cfg.preguntasEntrada;
    if (!pe || !Array.isArray(pe.preguntas)) return [];
    return pe.preguntas
        .map((q) => ({ ...q, opciones: (Array.isArray(q && q.opciones) ? q.opciones : []).filter((o) => o && String(o.etiqueta || '').trim()).slice(0, 25) }))
        .filter((q) => q && String(q.texto || '').trim() && q.opciones.length)
        .slice(0, 10);
}
const hayPreguntas = (cfg) => !!(cfg && cfg.preguntasEntrada && cfg.preguntasEntrada.activo && preguntasValidas(cfg).length);

// Rol de acceso según de dónde viene (verificación normal o doble bienvenida).
function rolAcceso(cfg, origen) {
    if (origen === 'embudo') return cfg && cfg.embudoAB && cfg.embudoAB.rolVerificadoId;
    return cfg && cfg.verificacion && cfg.verificacion.rolVerificadoId;
}

// Un emoji normal («🎮») o uno del servidor («<:nombre:id>») para el desplegable.
function emojiDe(texto) {
    const s = String(texto || '').trim();
    if (!s) return undefined;
    const m = /^<a?:(\w{2,32}):(\d{5,25})>$/.exec(s);
    if (m) return { id: m[2], name: m[1], animated: s.startsWith('<a:') };
    return s.length <= 16 ? s : undefined;
}

// La pantalla de la pregunta `idx`: el texto, en qué pregunta va y el desplegable.
function pantallaPregunta(gid, cfg, idx, elegidas = []) {
    const preguntas = preguntasValidas(cfg);
    const q = preguntas[idx];
    const total = preguntas.length;
    const embed = new EmbedBuilder()
        .setColor((cfg && cfg.colorEmbed) || '#5865F2')
        .setTitle(String(q.texto).slice(0, 256))
        .setDescription(`${q.descripcion ? `${String(q.descripcion).slice(0, 1500)}\n\n` : ''}-# ${t(cfg, `Pregunta ${idx + 1} de ${total}`, `Question ${idx + 1} of ${total}`)}${q.multiple ? t(cfg, ' · puedes elegir varias', ' · you can pick several') : ''}`);
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`entq:${gid}:${idx}`)
        .setPlaceholder(q.multiple ? t(cfg, 'Elige una o varias…', 'Pick one or more…') : t(cfg, 'Elige una opción…', 'Pick an option…'))
        .setMinValues(1)
        .setMaxValues(q.multiple ? q.opciones.length : 1)
        .addOptions(q.opciones.map((o) => {
            const op = { label: String(o.etiqueta).trim().slice(0, 100), value: String(o.id).slice(0, 100), default: elegidas.includes(String(o.id)) };
            if (String(o.descripcion || '').trim()) op.description = String(o.descripcion).trim().slice(0, 100);
            const e = emojiDe(o.emoji);
            if (e) op.emoji = e;
            return op;
        }));
    const filas = [new ActionRowBuilder().addComponents(menu)];
    const botones = [];
    if (idx > 0) botones.push(new ButtonBuilder().setCustomId(`entq_atras:${gid}:${idx}`).setLabel(t(cfg, '◀ Atrás', '◀ Back')).setStyle(ButtonStyle.Secondary));
    if (q.obligatoria === false) botones.push(new ButtonBuilder().setCustomId(`entq_saltar:${gid}:${idx}`).setLabel(t(cfg, 'Saltar', 'Skip')).setStyle(ButtonStyle.Secondary));
    if (botones.length) filas.push(new ActionRowBuilder().addComponents(...botones));
    return { content: '', embeds: [embed], components: filas };
}

// Empieza las preguntas (lo llaman la verificación y la doble bienvenida en vez de
// dar el rol). Responde a la interacción con la primera pregunta, solo para él.
async function empezar(interaction, { gid, cfg, origen = 'verif' }) {
    sesiones.set(`${gid}:${interaction.user.id}`, { respuestas: {}, origen, expira: Date.now() + DURA_MS });
    const payload = { ...pantallaPregunta(gid, cfg, 0), flags: 64 };
    if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
    return interaction.reply(payload);
}

const { rolDable } = puerta; // ¿puede el bot dar este rol?

// Roles a dar según lo respondido (sin repetidos).
function rolesDeRespuestas(cfg, respuestas) {
    const ids = new Set();
    for (const q of preguntasValidas(cfg)) {
        const elegidas = (respuestas && respuestas[q.id]) || [];
        for (const o of q.opciones) if (elegidas.includes(String(o.id)) && o.rolId) ids.add(String(o.rolId));
    }
    return [...ids];
}

// Desplegable elegido, «Saltar» o «Atrás».
async function manejar(interaction, client) {
    const [tipo, gid, n] = interaction.customId.split(':');
    const idx = parseInt(n, 10) || 0;
    const cfg = await ServidorConfig.findOne({ guildId: gid });
    const preguntas = preguntasValidas(cfg);
    const clave = `${gid}:${interaction.user.id}`;
    const sesion = sesiones.get(clave);
    if (!sesion || sesion.expira <= Date.now() || !preguntas[idx]) {
        sesiones.delete(clave);
        return interaction.update({ content: t(cfg, '⏰ Ha pasado demasiado tiempo (o han cambiado las preguntas). Vuelve a pulsar el botón del canal de verificación para empezar.', '⏰ Too much time has passed (or the questions changed). Press the button in the verification channel again to start.'), embeds: [], components: [] });
    }
    sesion.expira = Date.now() + DURA_MS;
    const q = preguntas[idx];
    let siguiente = idx + 1;
    if (tipo === 'entq') sesion.respuestas[q.id] = interaction.values.map(String);
    else if (tipo === 'entq_saltar') sesion.respuestas[q.id] = [];
    else if (tipo === 'entq_atras') siguiente = Math.max(0, idx - 1);

    if (siguiente < preguntas.length) {
        return interaction.update(pantallaPregunta(gid, cfg, siguiente, sesion.respuestas[preguntas[siguiente].id] || []));
    }

    // Última respondida: si tiene que esperar al staff (siempre, o por sospechoso), a la
    // cola; si no, roles + el de acceso.
    await interaction.update({ content: t(cfg, '⏳ Un momento…', '⏳ One moment…'), embeds: [], components: [] });
    sesiones.delete(clave);
    if (requiereAprobacion(cfg, interaction.user, sesion.respuestas)) {
        const r = await solicitarAprobacion(client, { gid, cfg, user: interaction.user, respuestas: sesion.respuestas, origen: sesion.origen });
        return interaction.editReply({ content: '', embeds: [embedEspera(cfg, r)] });
    }
    const r = await concederEntrada(client, { gid, cfg, userId: interaction.user.id, respuestas: sesion.respuestas, origen: sesion.origen });
    if (!r) return interaction.editReply({ content: t(cfg, '❌ Ya no estás en ese servidor.', '❌ You’re no longer in that server.') });
    return interaction.editReply({ content: '', embeds: [embedListo(cfg, r)] });
}

// Da los roles de las respuestas y el de acceso (y lo de «Al verificarse»: roles de
// más, quitar «Sin verificar», el privado y el registro). Devuelve { conseguidos, fallo }
// o null si ya no está en el servidor. `via` = cómo ha entrado (para el registro).
async function concederEntrada(client, { gid, cfg, userId, respuestas, origen, via = 'verificado', detalle = '' }) {
    const guild = client.guilds.cache.get(gid);
    const member = guild && await guild.members.fetch(userId).catch(() => null);
    if (!member) return null;
    const pedidos = rolesDeRespuestas(cfg, respuestas);
    const acceso = rolAcceso(cfg, origen);
    const dar = [...new Set([...pedidos, acceso].filter((id) => rolDable(guild, id)))];
    let fallo = dar.length < [...new Set([...pedidos, acceso].filter(Boolean))].length;
    if (dar.length) await member.roles.add(dar, 'Verificación al entrar').catch(() => { fallo = true; });
    if (origen === 'embudo') await require('./embudo.js').marcarVerificado(gid, member.id).catch(() => {});
    if (!acceso || !rolDable(guild, acceso)) fallo = true;
    // Lo de «Al verificarse» solo si de verdad tiene ya el acceso (si no, se le quitaría
    // «Sin verificar» y contaría como verificado sin poder entrar).
    const tras = acceso && member.roles.cache.has(acceso) ? await puerta.trasVerificarse(member, cfg, { via, detalle }) : { fallo: true };
    return { conseguidos: pedidos.filter((id) => dar.includes(id)), fallo: fallo || tras.fallo, guild, user: member.user };
}

function embedListo(cfg, { conseguidos, fallo, guild, user }) {
    const propio = puerta.textoExito(cfg, guild, user); // el «¡Listo!» personalizado (Verificación → Al verificarse)
    return new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(t(cfg, '✅ ¡Listo! Ya tienes acceso al servidor', '✅ Done! You now have access to the server'))
        .setDescription([
            propio || '',
            conseguidos.length ? `${t(cfg, 'Tus roles:', 'Your roles:')} ${conseguidos.map((id) => `<@&${id}>`).join(' ')}` : '',
            fallo ? t(cfg, '⚠️ Algún rol no se ha podido dar (el rol del bot tiene que estar por encima). Avisa al staff.', '⚠️ Some role couldn’t be given (the bot’s role must be higher). Let the staff know.') : '',
        ].filter(Boolean).join('\n\n') || t(cfg, '¡Bienvenido/a! 🎉', 'Welcome! 🎉'));
}

// ---------------------------------------------------------------------------
// Aprobación del staff (1.9.13): nadie entra hasta que el staff lo acepta.
// ---------------------------------------------------------------------------
const SolicitudEntrada = require('../models/SolicitudEntrada.js');

// ¿Hay aprobación? (cualquier modo menos «nunca», y con el canal del staff elegido)
const aprobacionActiva = (cfg) => !!(cfg && cfg.preguntasEntrada && cfg.preguntasEntrada.canalRevisionId && puerta.modoAprobacion(cfg) !== 'nunca');
// ¿Esta persona tiene que esperar al staff? Siempre, o solo si es sospechosa (cuenta muy
// nueva, sin foto o una respuesta marcada para revisar).
function requiereAprobacion(cfg, user, respuestas = {}) {
    if (!aprobacionActiva(cfg)) return false;
    if (puerta.modoAprobacion(cfg) === 'siempre') return true;
    return puerta.motivosRevision(cfg, user, respuestas).length > 0;
}

const RECHAZO_ENTRADA = {
    es: 'Hola {user}, tu verificación en **{server}** no ha sido aceptada.\n**Motivo:** {motivo}\n\nSi crees que es un error, puedes volver a intentarlo desde el canal de verificación.',
    en: 'Hi {user}, your verification on **{server}** wasn’t accepted.\n**Reason:** {motivo}\n\nIf you think it’s a mistake, you can try again from the verification channel.',
};
const ACEPTADA_ENTRADA = {
    es: '✅ ¡Hola {user}! El staff ha aceptado tu verificación en **{server}**: ya puedes entrar. ¡Bienvenido/a!',
    en: '✅ Hi {user}! The staff accepted your verification on **{server}**: you can come in now. Welcome!',
};
const idiomaDe = (cfg) => (cfg && cfg.idioma === 'es' ? 'es' : 'en');
// {user}, {server} y {motivo} (con función: un «$» del texto no es un patrón).
const rellenar = (texto, d) => String(texto || '')
    .replace(/\{(user|usuario)\}/gi, () => d.user || '')
    .replace(/\{(server|servidor)\}/gi, () => d.server || '')
    .replace(/\{(motivo|reason)\}/gi, () => d.motivo || '');

// Lo respondido, en texto para el staff: «Pregunta → Respuesta, Respuesta».
function resumenRespuestas(cfg, respuestas) {
    return preguntasValidas(cfg).map((q) => {
        const elegidas = (respuestas && respuestas[q.id]) || [];
        const textos = q.opciones.filter((o) => elegidas.includes(String(o.id))).map((o) => `${o.emoji ? `${o.emoji} ` : ''}${o.etiqueta}`);
        return { pregunta: String(q.texto).slice(0, 256), respuesta: (textos.join(', ') || '—').slice(0, 1024) };
    });
}

function embedEspera(cfg, r) {
    return new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(r && r.ya ? t(cfg, '⏳ Tu verificación ya está en revisión', '⏳ Your verification is already under review') : t(cfg, '⏳ ¡Gracias! Ahora el staff revisa tu verificación', '⏳ Thanks! The staff is now reviewing your verification'))
        .setDescription(r && r.ok === false
            ? t(cfg, '⚠️ No he podido avisar al staff (falta su canal o no puedo escribir en él). Avísales tú, por favor.', '⚠️ I couldn’t notify the staff (their channel is missing or I can’t write in it). Please let them know.')
            : t(cfg, 'Te avisaré por privado en cuanto te dejen pasar. No hace falta que hagas nada más.', 'I’ll DM you as soon as they let you in. You don’t need to do anything else.'));
}

function filaRevision(cfg, id) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`entv_ok:${id}`).setLabel(t(cfg, '✅ Aceptar', '✅ Accept')).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`entv_no:${id}`).setLabel(t(cfg, '❌ Rechazar', '❌ Reject')).setStyle(ButtonStyle.Danger),
    );
}

// El canal del staff, solo si es de ESTE servidor (si no, las solicitudes acabarían en
// otro servidor y su staff podría dejar entrar a gente aquí).
function canalRevision(client, gid, cfg) {
    const guild = client.guilds.cache.get(gid);
    const canal = guild ? guild.channels.cache.get(String((cfg && cfg.preguntasEntrada && cfg.preguntasEntrada.canalRevisionId) || '')) : null;
    return canal && typeof canal.isTextBased === 'function' && canal.isTextBased() ? canal : null;
}

// Lo respondido como campos del embed, sin pasar de los límites de Discord (25 campos y
// 6000 letras en total): se deja sitio para el campo «Aceptada/Rechazada» de después.
function camposResumen(cfg, resumen) {
    const campos = [];
    let total = 0;
    for (const r of resumen || []) {
        const name = String(r.pregunta || '—').slice(0, 256);
        const value = String(r.respuesta || '—').slice(0, 1024);
        if (campos.length >= 22 || total + name.length + value.length > 4200) {
            campos.push({ name: '…', value: t(cfg, 'Hay más respuestas: míralas en el panel (Verificación).', 'There are more answers: see them in the panel (Verification).') });
            break;
        }
        campos.push({ name, value });
        total += name.length + value.length;
    }
    return campos;
}

// Manda el aviso con «Aceptar» / «Rechazar» al canal del staff. Devuelve el mensaje o null.
async function avisarStaff(client, cfg, doc, user) {
    const canal = canalRevision(client, doc.guildId, cfg);
    if (!canal) return null;
    const creada = user && user.createdTimestamp ? Math.floor(user.createdTimestamp / 1000) : null;
    const por = (doc.motivos || []).length ? `\n⚠️ **${t(cfg, 'Por qué se revisa', 'Why it’s reviewed')}:** ${puerta.textoMotivos(cfg, doc.motivos, user)}` : '';
    const embed = new EmbedBuilder()
        .setColor((cfg && cfg.colorEmbed) || '#5865F2')
        .setTitle(t(cfg, '🚪 Nueva verificación por revisar', '🚪 New verification to review'))
        .setDescription(`${t(cfg, `<@${doc.userId}> quiere entrar al servidor.`, `<@${doc.userId}> wants to join the server.`)}${creada ? `\n${t(cfg, `Cuenta creada <t:${creada}:R>`, `Account created <t:${creada}:R>`)}` : ''}${por}`.slice(0, 4000))
        .setThumbnail(user && typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL() : null)
        .setFooter({ text: `${String(doc.userTag || '').slice(0, 100)} · ${doc.userId}` })
        .setTimestamp(doc.fecha);
    const campos = camposResumen(cfg, doc.resumen);
    if (campos.length) embed.addFields(campos);
    // Con un rol de aviso, se le menciona (solo a ese rol) para que el staff se entere.
    const rolAviso = cfg && cfg.preguntasEntrada && /^\d{5,25}$/.test(String(cfg.preguntasEntrada.rolAvisoId || '')) ? String(cfg.preguntasEntrada.rolAvisoId) : null;
    return canal.send({ content: rolAviso ? `<@&${rolAviso}>` : undefined, embeds: [embed], components: [filaRevision(cfg, doc._id)], allowedMentions: { roles: rolAviso ? [rolAviso] : [] } }).catch(() => null);
}

// Crea la solicitud y la manda al canal del staff. Si ya tenía una pendiente, no
// repite (salvo que no llegara al staff: entonces se reintenta con lo nuevo).
// Devuelve { ok, ya, solicitud }.
const pidiendo = new Set(); // `${gid}:${uid}`: dos clics seguidos no crean dos solicitudes
async function solicitarAprobacion(client, { gid, cfg, user, respuestas = {}, origen = 'verif' }) {
    const clave = `${gid}:${user.id}`;
    if (pidiendo.has(clave)) return { ok: true, ya: true };
    pidiendo.add(clave);
    try {
        let doc = await SolicitudEntrada.findOne({ guildId: gid, userId: user.id, estado: { $in: ['pendiente', 'revisando'] } });
        if (doc && (doc.mensajeId || doc.estado !== 'pendiente')) return { ok: true, ya: true, solicitud: doc };
        const datos = { userTag: user.username, origen, respuestas, resumen: resumenRespuestas(cfg, respuestas), motivos: puerta.motivosRevision(cfg, user, respuestas) };
        if (doc) Object.assign(doc, datos);
        else doc = new SolicitudEntrada({ guildId: gid, userId: user.id, ...datos });
        const msg = await avisarStaff(client, cfg, doc, user);
        if (msg) { doc.canalId = msg.channelId || (msg.channel && msg.channel.id) || null; doc.mensajeId = msg.id; }
        const nueva = doc.isNew;
        await doc.save();
        if (nueva) await puerta.registrar(client.guilds.cache.get(gid), cfg, { user, tipo: 'pendiente', detalle: puerta.textoMotivos(cfg, datos.motivos, user) });
        return { ok: !!msg, solicitud: doc };
    } finally {
        pidiendo.delete(clave);
    }
}

// Acepta o rechaza una solicitud (botones de Discord y panel). Se «reserva» de golpe:
// si dos del staff pulsan a la vez, solo uno la revisa. Devuelve { ok, aviso, doc }.
// Si el bot se reinicia a mitad, la que se quedó «revisando» se puede revisar otra vez
// pasados 2 min. `guildId` = solo una solicitud de ese servidor.
const REVISANDO_MAX_MS = 2 * 60 * 1000;
async function revisarSolicitud(client, id, { guildId, aceptar, motivo = '', revisor = '' } = {}) {
    const deEse = guildId ? { guildId: String(guildId) } : {};
    const libre = { $or: [{ estado: 'pendiente' }, { estado: 'revisando', revisandoDesde: { $not: { $gt: new Date(Date.now() - REVISANDO_MAX_MS) } } }] };
    const doc = await SolicitudEntrada.findOneAndUpdate({ _id: id, ...deEse, ...libre }, { $set: { estado: 'revisando', revisandoDesde: new Date() } }, { returnDocument: 'after' });
    if (!doc) throw new Error((await SolicitudEntrada.exists({ _id: id, ...deEse })) ? 'ya-revisada' : 'not-found');
    try {
        const cfg = await ServidorConfig.findOne({ guildId: doc.guildId });
        const pe = (cfg && cfg.preguntasEntrada) || {};
        const guild = client.guilds.cache.get(doc.guildId);
        const user = await client.users.fetch(doc.userId).catch(() => null);
        const datos = { user: `<@${doc.userId}>`, server: guild ? guild.name : '', motivo: String(motivo || '').trim() || t(cfg, 'no se ha indicado', 'not given') };
        let aviso = false;
        let fallo = false;
        if (aceptar) {
            const r = await concederEntrada(client, { gid: doc.guildId, cfg, userId: doc.userId, respuestas: doc.respuestas, origen: doc.origen, via: 'aceptado', detalle: String(revisor || '') });
            if (!r) throw new Error('no-esta');
            fallo = r.fallo;
            if (user) aviso = await user.send({ content: rellenar(String(pe.mensajeAceptada || '').trim() || ACEPTADA_ENTRADA[idiomaDe(cfg)], datos).slice(0, 2000), allowedMentions: { parse: [] } }).then(() => true, () => false);
        } else if (user) {
            aviso = await user.send({ content: rellenar(String(pe.mensajeRechazo || '').trim() || RECHAZO_ENTRADA[idiomaDe(cfg)], datos).slice(0, 2000), allowedMentions: { parse: [] } }).then(() => true, () => false);
        }
        if (!aceptar && guild) await puerta.registrar(guild, cfg, { user: user || { id: doc.userId, username: doc.userTag }, tipo: 'rechazado', detalle: `${revisor ? `${revisor}: ` : ''}${String(motivo || '').trim()}` });
        doc.estado = aceptar ? 'aceptada' : 'rechazada';
        doc.motivo = aceptar ? '' : String(motivo || '').slice(0, 1000);
        doc.revisadaPor = String(revisor || '').slice(0, 100);
        doc.revisadaFecha = new Date();
        await doc.save();
        // El aviso del staff dice cómo acabó (y se le quitan los botones).
        if (doc.canalId && doc.mensajeId) {
                const canal = guild ? guild.channels.cache.get(doc.canalId) : null;
            const msg = canal?.isTextBased() ? await canal.messages.fetch(doc.mensajeId).catch(() => null) : null;
            if (msg && msg.embeds[0]) {
                const e = EmbedBuilder.from(msg.embeds[0]).setColor(aceptar ? 0x2ecc71 : 0xe74c3c).addFields(aceptar
                    ? { name: t(cfg, '✅ Aceptada', '✅ Accepted'), value: t(cfg, `por ${doc.revisadaPor || '—'}`, `by ${doc.revisadaPor || '—'}`) }
                    : { name: t(cfg, '❌ Rechazada', '❌ Rejected'), value: `${t(cfg, `por ${doc.revisadaPor || '—'}`, `by ${doc.revisadaPor || '—'}`)}\n${t(cfg, 'Motivo', 'Reason')}: ${doc.motivo || '—'}`.slice(0, 1024) });
                await msg.edit({ embeds: [e], components: [] }).catch(() => {});
            }
        }
        return { ok: true, aviso, fallo, doc };
    } catch (e) {
        await SolicitudEntrada.updateOne({ _id: doc._id, estado: 'revisando' }, { $set: { estado: 'pendiente' } }).catch(() => {});
        throw e;
    }
}

// Botones «Aceptar» / «Rechazar» del aviso del staff (y la ventana del motivo).
async function manejarRevision(interaction) {
    const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
    const { miembroPuedeModerar } = require('./permisos.js');
    const { PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
    if (!miembroPuedeModerar(interaction.member, cfg, PermissionsBitField.Flags.ModerateMembers)) {
        return interaction.reply({ content: t(cfg, '❌ Solo el staff puede revisar las verificaciones.', '❌ Only staff can review verifications.'), flags: 64 });
    }
    const [accion, id] = interaction.customId.split(':');
    if (accion === 'entv_no') {
        const modal = new ModalBuilder().setCustomId(`entv_nom:${id}`).setTitle(t(cfg, 'Rechazar verificación', 'Reject verification'));
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId('motivo').setLabel(t(cfg, 'Motivo (le llega por privado)', 'Reason (they get it by DM)'))
            .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)));
        return interaction.showModal(modal);
    }
    const aceptar = accion === 'entv_ok';
    const motivo = aceptar ? '' : (interaction.fields.getTextInputValue('motivo') || '');
    await interaction.deferReply({ flags: 64 });
    try {
        const r = await revisarSolicitud(interaction.client, id, { guildId: interaction.guildId, aceptar, motivo, revisor: interaction.user.username });
        const sinDM = !r.aviso ? t(cfg, ' (no le ha llegado el privado: los tiene cerrados)', ' (the DM didn’t reach them: their DMs are closed)') : '';
        const roles = r.fallo ? t(cfg, ' ⚠️ Algún rol no se ha podido dar (el rol del bot tiene que estar por encima).', ' ⚠️ Some role couldn’t be given (the bot’s role must be higher).') : '';
        return interaction.editReply(aceptar
            ? t(cfg, `✅ Aceptada: ya tiene acceso${sinDM}.${roles}`, `✅ Accepted: they now have access${sinDM}.${roles}`)
            : t(cfg, `❌ Rechazada. Le he enviado el motivo por privado${sinDM}.`, `❌ Rejected. I’ve sent them the reason by DM${sinDM}.`));
    } catch (e) {
        const textos = {
            'ya-revisada': t(cfg, 'ℹ️ Esta verificación ya estaba revisada.', 'ℹ️ This verification was already reviewed.'),
            'no-esta': t(cfg, '❌ Esa persona ya no está en el servidor.', '❌ That person is no longer in the server.'),
            'not-found': t(cfg, '❌ Esa solicitud ya no existe.', '❌ That request no longer exists.'),
        };
        if (!textos[e.message]) console.error('Error al revisar una verificación:', e);
        return interaction.editReply(textos[e.message] || t(cfg, '❌ No se ha podido revisar ahora. Inténtalo otra vez en un momento.', '❌ Couldn’t review it right now. Try again in a moment.'));
    }
}

// Lo que hay que hacer al verificarse: preguntas (si las hay), esperar al staff (si
// hay aprobación) o nada (la verificación da ya el rol). Devuelve true si se ha
// encargado (la interacción ya está respondida).
async function siHayPreguntas(interaction, { gid, cfg, origen }) {
    if (hayPreguntas(cfg)) {
        await empezar(interaction, { gid, cfg, origen });
        return true;
    }
    if (requiereAprobacion(cfg, interaction.user, {})) {
        const r = await solicitarAprobacion(interaction.client, { gid, cfg, user: interaction.user, respuestas: {}, origen });
        const payload = { embeds: [embedEspera(cfg, r)], flags: 64 };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
        else await interaction.reply(payload);
        return true;
    }
    return false;
}

// Lo que llega del panel, saneado: límites de Discord (texto 256, opción 100, 25
// opciones), ids sin caracteres raros y sin repetir (Discord exige valores únicos).
function sanearPreguntas(lista) {
    const id = (v, defecto) => String(v || '').replace(/[^\w-]/g, '').slice(0, 40) || defecto;
    const snowflake = (v) => (/^\d{5,25}$/.test(String(v || '')) ? String(v) : null);
    const unico = (usados, base) => { let x = base; let n = 2; while (usados.has(x)) x = `${base}_${n++}`; usados.add(x); return x; };
    const idsPreguntas = new Set();
    return (Array.isArray(lista) ? lista : []).slice(0, 10).map((q, i) => {
        const idsOpciones = new Set();
        return {
            id: unico(idsPreguntas, id(q && q.id, `q${i + 1}`)),
            texto: String((q && q.texto) || '').slice(0, 256),
            descripcion: String((q && q.descripcion) || '').slice(0, 1500),
            multiple: !!(q && q.multiple),
            obligatoria: !(q && q.obligatoria === false),
            opciones: (Array.isArray(q && q.opciones) ? q.opciones : []).slice(0, 25).map((o, j) => ({
                id: unico(idsOpciones, id(o && o.id, `o${j + 1}`)),
                etiqueta: String((o && o.etiqueta) || '').slice(0, 100),
                emoji: String((o && o.emoji) || '').trim().slice(0, 64),
                descripcion: String((o && o.descripcion) || '').slice(0, 100),
                rolId: snowflake(o && o.rolId),
                categoriaId: snowflake(o && o.categoriaId),
                revisar: !!(o && o.revisar), // «solo sospechosos»: elegirla manda la verificación al staff
            })),
        };
    });
}

module.exports = {
    aprobacionActiva, requiereAprobacion, solicitarAprobacion, revisarSolicitud, manejarRevision, concederEntrada, resumenRespuestas, camposResumen, canalRevision, RECHAZO_ENTRADA, ACEPTADA_ENTRADA, rellenar,
    sanearPreguntas, preguntasValidas, hayPreguntas, pantallaPregunta, empezar, manejar, siHayPreguntas, rolesDeRespuestas, rolAcceso, emojiDe, _sesiones: sesiones };
