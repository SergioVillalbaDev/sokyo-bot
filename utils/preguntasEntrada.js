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

// ¿Puede el bot dar este rol? (existe, no es de una integración y está por debajo del suyo)
function rolDable(guild, id) {
    const rol = id && guild.roles.cache.get(id);
    return !!(rol && rol.id !== guild.id && !rol.managed && rol.editable);
}

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

    // Última respondida: roles de las respuestas + el de acceso.
    await interaction.update({ content: t(cfg, '⏳ Un momento…', '⏳ One moment…'), embeds: [], components: [] });
    sesiones.delete(clave);
    const guild = client.guilds.cache.get(gid);
    const member = guild && await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) return interaction.editReply({ content: t(cfg, '❌ Ya no estás en ese servidor.', '❌ You’re no longer in that server.') });
    const pedidos = rolesDeRespuestas(cfg, sesion.respuestas);
    const acceso = rolAcceso(cfg, sesion.origen);
    const dar = [...new Set([...pedidos, acceso].filter((id) => rolDable(guild, id)))];
    let fallo = dar.length < [...new Set([...pedidos, acceso].filter(Boolean))].length;
    if (dar.length) await member.roles.add(dar, 'Preguntas al entrar').catch(() => { fallo = true; });
    if (sesion.origen === 'embudo') await require('./embudo.js').marcarVerificado(gid, member.id).catch(() => {});
    if (!acceso || !rolDable(guild, acceso)) fallo = true;

    const conseguidos = pedidos.filter((id) => dar.includes(id));
    const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(t(cfg, '✅ ¡Listo! Ya tienes acceso al servidor', '✅ Done! You now have access to the server'))
        .setDescription([
            conseguidos.length ? `${t(cfg, 'Tus roles:', 'Your roles:')} ${conseguidos.map((id) => `<@&${id}>`).join(' ')}` : '',
            fallo ? t(cfg, '⚠️ Algún rol no se ha podido dar (el rol del bot tiene que estar por encima). Avisa al staff.', '⚠️ Some role couldn’t be given (the bot’s role must be higher). Let the staff know.') : '',
        ].filter(Boolean).join('\n\n') || t(cfg, '¡Bienvenido/a! 🎉', 'Welcome! 🎉'));
    return interaction.editReply({ content: '', embeds: [embed] });
}

// Lo que hay que hacer al verificarse: preguntas (si las hay) o dar ya el rol.
// Devuelve true si ha empezado las preguntas (la interacción ya está respondida).
async function siHayPreguntas(interaction, { gid, cfg, origen }) {
    if (!hayPreguntas(cfg)) return false;
    await empezar(interaction, { gid, cfg, origen });
    return true;
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
            })),
        };
    });
}

module.exports = { sanearPreguntas, preguntasValidas, hayPreguntas, pantallaPregunta, empezar, manejar, siHayPreguntas, rolesDeRespuestas, rolAcceso, emojiDe, _sesiones: sesiones };
