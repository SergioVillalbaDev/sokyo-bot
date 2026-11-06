// ============================================================================
// Opciones de la verificación (1.9.15), comunes a la verificación normal (botón o
// captcha) y a la doble bienvenida. Todo se elige en el panel → Verificación y se
// guarda en `opcionesEntrada`:
//   · Requisitos: edad mínima de la cuenta, foto de perfil y un rato de espera antes
//     de poder verificarse (si no se cumplen, no se puede y se le dice por qué).
//   · Normas que hay que aceptar antes («He leído y acepto»).
//   · Captcha: largo del código, intentos, tiempo y qué pasa si se fallan todos.
//   · Al verificarse: roles de más, quitar el rol «Sin verificar» (que se da al
//     entrar), el mensaje de «¡Listo!» y un privado de bienvenida.
//   · Quien no se verifica: recordatorio por privado y expulsión pasadas X horas.
//   · Registro: todo queda apuntado (panel y, si se quiere, un canal).
// La aprobación del staff (nunca, siempre o solo los sospechosos) está en
// `preguntasEntrada` (utils/preguntasEntrada.js), que usa `motivosRevision` de aquí.
// ============================================================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { t } = require('./i18n.js');

const DIA = 86400000;
const ACCIONES_CAPTCHA = ['esperar', 'aislar', 'expulsar'];
const ESPERA_CAPTCHA_MS = 10 * 60 * 1000; // tras fallar todos los intentos (y lo que dura el aislamiento)
const MAX_EXPULSIONES_POR_VUELTA = 25;

const DEF = {
    edadMinDias: 0, exigirAvatar: false, esperaMinutos: 0,
    normasActivo: false, normasTexto: '', normasBoton: '',
    captchaLongitud: 5, captchaIntentos: 3, captchaMinutos: 5, captchaFallo: 'esperar',
    rolesExtra: [], rolNoVerificadoId: null,
    mensajeExito: '', dmActivo: false, mensajeDM: '',
    expulsarHoras: 0, expulsarDesde: null, recordatorio: true, mensajeExpulsion: '',
    canalRegistroId: null,
};

const entero = (v, min, max, def) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const snowflake = (v) => (/^\d{5,25}$/.test(String(v || '')) ? String(v) : null);
const texto = (v, max) => String(v || '').slice(0, max);

// Las opciones del servidor, con lo de fábrica en lo que falte y dentro de sus límites.
function opciones(cfg) {
    const o = { ...DEF, ...((cfg && cfg.opcionesEntrada) || {}) };
    return {
        ...o,
        edadMinDias: entero(o.edadMinDias, 0, 365, 0),
        esperaMinutos: entero(o.esperaMinutos, 0, 1440, 0),
        captchaLongitud: entero(o.captchaLongitud, 4, 8, 5),
        captchaIntentos: entero(o.captchaIntentos, 1, 10, 3),
        captchaMinutos: entero(o.captchaMinutos, 1, 30, 5),
        captchaFallo: ACCIONES_CAPTCHA.includes(o.captchaFallo) ? o.captchaFallo : 'esperar',
        expulsarHoras: entero(o.expulsarHoras, 0, 720, 0),
        rolesExtra: (Array.isArray(o.rolesExtra) ? o.rolesExtra : []).map(snowflake).filter(Boolean).slice(0, 10),
    };
}

// Lo que llega del panel → lo que se guarda. `antes` = lo guardado (para saber desde
// cuándo cuenta la expulsión: solo a quien entre DESPUÉS de encenderla).
function sanearOpciones(b, antes = {}, ahora = new Date()) {
    b = b && typeof b === 'object' ? b : {};
    const expulsarHoras = entero(b.expulsarHoras, 0, 720, 0);
    const yaEstaba = entero(antes && antes.expulsarHoras, 0, 720, 0) > 0 && antes.expulsarDesde;
    return {
        edadMinDias: entero(b.edadMinDias, 0, 365, 0),
        exigirAvatar: !!b.exigirAvatar,
        esperaMinutos: entero(b.esperaMinutos, 0, 1440, 0),
        normasActivo: !!b.normasActivo,
        normasTexto: texto(b.normasTexto, 4000),
        normasBoton: texto(b.normasBoton, 80).trim(),
        captchaLongitud: entero(b.captchaLongitud, 4, 8, 5),
        captchaIntentos: entero(b.captchaIntentos, 1, 10, 3),
        captchaMinutos: entero(b.captchaMinutos, 1, 30, 5),
        captchaFallo: ACCIONES_CAPTCHA.includes(b.captchaFallo) ? b.captchaFallo : 'esperar',
        rolesExtra: [...new Set((Array.isArray(b.rolesExtra) ? b.rolesExtra : []).map(snowflake).filter(Boolean))].slice(0, 10),
        rolNoVerificadoId: snowflake(b.rolNoVerificadoId),
        mensajeExito: texto(b.mensajeExito, 1500),
        dmActivo: !!b.dmActivo,
        mensajeDM: texto(b.mensajeDM, 1500),
        expulsarHoras,
        expulsarDesde: expulsarHoras > 0 ? (yaEstaba ? new Date(antes.expulsarDesde) : ahora) : null,
        recordatorio: b.recordatorio !== false,
        mensajeExpulsion: texto(b.mensajeExpulsion, 1500),
        canalRegistroId: snowflake(b.canalRegistroId),
    };
}

// {user} {server} {horas} {dias} (con función: un «$» del texto no es un patrón).
const rellenar = (txt, d = {}) => String(txt || '')
    .replace(/\{(user|usuario|mention)\}/gi, () => d.user || '')
    .replace(/\{(server|servidor)\}/gi, () => d.server || '')
    .replace(/\{(horas|hours)\}/gi, () => String(d.horas ?? ''))
    .replace(/\{(dias|días|days)\}/gi, () => String(d.dias ?? ''));

// ¿Puede el bot dar (o quitar) este rol? (existe, no es de una integración y está por debajo del suyo)
function rolDable(guild, id) {
    const rol = id && guild && guild.roles.cache.get(id);
    return !!(rol && rol.id !== guild.id && !rol.managed && rol.editable);
}

// Todos los roles de acceso que hay configurados (encendidos o no): quien tiene uno ya
// se verificó alguna vez (p. ej. antes de cambiar de verificación normal a doble bienvenida).
function rolesAcceso(cfg) {
    return [cfg && cfg.verificacion && cfg.verificacion.rolVerificadoId, cfg && cfg.embudoAB && cfg.embudoAB.rolVerificadoId].filter(Boolean).map(String);
}
// El rol «Sin verificar», solo si no es uno de acceso (si no, se colaría o perdería el acceso).
function rolSinVerificar(cfg) {
    const id = opciones(cfg).rolNoVerificadoId;
    return id && !rolesAcceso(cfg).includes(String(id)) ? id : null;
}

// Rol de acceso de la puerta que está encendida (verificación normal o doble bienvenida).
function rolAccesoActivo(cfg) {
    if (cfg && cfg.verificacion && cfg.verificacion.activo && cfg.verificacion.rolVerificadoId) return cfg.verificacion.rolVerificadoId;
    if (cfg && cfg.embudoAB && cfg.embudoAB.activo && cfg.embudoAB.rolVerificadoId) return cfg.embudoAB.rolVerificadoId;
    return null;
}

// ---------------------------------------------------------------------------
// Requisitos: si no se cumplen, no se puede verificar (y se le dice cuándo podrá).
// Devuelve null o { tipo: 'edad' | 'avatar' | 'espera', texto }.
// ---------------------------------------------------------------------------
function requisitoQueFalla(member, cfg, ahora = Date.now()) {
    const o = opciones(cfg);
    const user = member && (member.user || member);
    if (!user) return null;
    if (o.edadMinDias > 0 && user.createdTimestamp && ahora - user.createdTimestamp < o.edadMinDias * DIA) {
        const cuando = Math.floor((user.createdTimestamp + o.edadMinDias * DIA) / 1000);
        return { tipo: 'edad', texto: t(cfg,
            `🕒 Para entrar, tu cuenta de Discord tiene que tener al menos **${o.edadMinDias} día${o.edadMinDias === 1 ? '' : 's'}**. Podrás verificarte <t:${cuando}:R>.`,
            `🕒 To get in, your Discord account must be at least **${o.edadMinDias} day${o.edadMinDias === 1 ? '' : 's'}** old. You’ll be able to verify <t:${cuando}:R>.`) };
    }
    if (o.exigirAvatar && !user.avatar) {
        return { tipo: 'avatar', texto: t(cfg,
            '🖼️ Para entrar necesitas una **foto de perfil** en Discord. Ponte una y vuelve a pulsar el botón.',
            '🖼️ You need a **profile picture** on Discord to get in. Set one and press the button again.') };
    }
    if (o.esperaMinutos > 0 && member.joinedTimestamp && ahora - member.joinedTimestamp < o.esperaMinutos * 60000) {
        const cuando = Math.floor((member.joinedTimestamp + o.esperaMinutos * 60000) / 1000);
        return { tipo: 'espera', texto: t(cfg,
            `📖 Tómate un momento para leer las normas: podrás verificarte <t:${cuando}:R>.`,
            `📖 Take a moment to read the rules: you’ll be able to verify <t:${cuando}:R>.`) };
    }
    return null;
}

// ---------------------------------------------------------------------------
// Aprobación del staff: 'nunca' (entran al momento), 'siempre' o 'sospechosos'
// (solo si la cuenta es muy nueva, no tiene foto o eligió una respuesta marcada
// para revisar). Antes de 1.9.15 era un sí/no (`aprobacion`).
// ---------------------------------------------------------------------------
const MODOS_APROBACION = ['nunca', 'siempre', 'sospechosos'];
function modoAprobacion(cfg) {
    const pe = (cfg && cfg.preguntasEntrada) || {};
    if (MODOS_APROBACION.includes(pe.aprobacionModo)) return pe.aprobacionModo;
    return pe.aprobacion ? 'siempre' : 'nunca';
}

// Por qué habría que revisarlo: ['cuenta', 'avatar', 'respuesta'] (vacío = nada raro).
function motivosRevision(cfg, user, respuestas = {}, ahora = Date.now()) {
    const pe = (cfg && cfg.preguntasEntrada) || {};
    const motivos = [];
    const dias = entero(pe.revisarCuentaDias, 0, 365, 7);
    if (dias > 0 && user && user.createdTimestamp && ahora - user.createdTimestamp < dias * DIA) motivos.push('cuenta');
    if (pe.revisarSinAvatar !== false && user && !user.avatar) motivos.push('avatar');
    const marcadas = new Set();
    for (const q of Array.isArray(pe.preguntas) ? pe.preguntas : []) {
        for (const op of (q && Array.isArray(q.opciones) ? q.opciones : [])) if (op && op.revisar) marcadas.add(`${q.id}:${op.id}`);
    }
    const elegida = Object.entries(respuestas || {}).some(([qid, ops]) => (ops || []).some((oid) => marcadas.has(`${qid}:${oid}`)));
    if (elegida) motivos.push('respuesta');
    return motivos;
}

function textoMotivos(cfg, motivos, user) {
    const dias = user && user.createdTimestamp ? Math.max(0, Math.floor((Date.now() - user.createdTimestamp) / DIA)) : null;
    const nombres = {
        cuenta: t(cfg, `cuenta nueva (${dias ?? '?'} día${dias === 1 ? '' : 's'})`, `new account (${dias ?? '?'} day${dias === 1 ? '' : 's'})`),
        avatar: t(cfg, 'sin foto de perfil', 'no profile picture'),
        respuesta: t(cfg, 'eligió una respuesta marcada para revisar', 'picked an answer marked for review'),
    };
    return (motivos || []).map((m) => nombres[m] || m).join(' · ');
}

// ---------------------------------------------------------------------------
// Normas que hay que aceptar antes (verificación normal).
// ---------------------------------------------------------------------------
const normasAceptadas = new Map(); // `${gid}:${uid}` -> expira
setInterval(() => { const a = Date.now(); for (const [k, v] of normasAceptadas) if (v <= a) normasAceptadas.delete(k); }, 60000).unref();
const hayNormas = (cfg) => { const o = opciones(cfg); return o.normasActivo && !!o.normasTexto.trim(); };
const yaAceptoNormas = (gid, uid) => (normasAceptadas.get(`${gid}:${uid}`) || 0) > Date.now();
const aceptarNormas = (gid, uid) => normasAceptadas.set(`${gid}:${uid}`, Date.now() + 15 * 60000);

function pantallaNormas(cfg, guild) {
    const o = opciones(cfg);
    const { mencionarCanales } = require('./mencionesCanal.js');
    const embed = new EmbedBuilder()
        .setColor((cfg && cfg.colorEmbed) || '#5865F2')
        .setTitle(t(cfg, '📜 Normas del servidor', '📜 Server rules'))
        .setDescription(`${mencionarCanales(o.normasTexto, guild).slice(0, 3900)}\n\n-# ${t(cfg, 'Para seguir tienes que aceptarlas.', 'You have to accept them to continue.')}`);
    const boton = new ButtonBuilder().setCustomId('verif_normas').setStyle(ButtonStyle.Success)
        .setLabel((o.normasBoton || t(cfg, '✅ He leído y acepto', '✅ I’ve read them and accept')).slice(0, 80));
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(boton)], flags: 64 };
}

// ---------------------------------------------------------------------------
// Captcha: intentos y qué pasa al fallarlos todos.
// ---------------------------------------------------------------------------
const fallosCaptcha = new Map(); // `${gid}:${uid}` -> { n, hasta, ultimo }
const FALLOS_DURAN_MS = 60 * 60 * 1000; // los intentos fallados se olvidan a la hora
setInterval(() => {
    const a = Date.now();
    for (const [k, v] of fallosCaptcha) if (v.hasta <= a && (!v.n || (v.ultimo || 0) < a - FALLOS_DURAN_MS)) fallosCaptcha.delete(k);
}, 60000).unref();
// Hasta cuándo no puede volver a intentarlo (0 = puede).
function captchaEsperaHasta(gid, uid) {
    const f = fallosCaptcha.get(`${gid}:${uid}`);
    return f && f.hasta > Date.now() ? f.hasta : 0;
}
// Un código mal: cuenta el intento. Devuelve cuántos le quedan (0 = se acabaron: ya no
// puede probar en 10 min y toca la acción de `castigarCaptcha`).
function contarFalloCaptcha(gid, uid, cfg) {
    const o = opciones(cfg);
    const clave = `${gid}:${uid}`;
    const previo = fallosCaptcha.get(clave);
    const f = previo && (previo.ultimo || 0) >= Date.now() - FALLOS_DURAN_MS ? previo : { n: 0, hasta: 0 };
    f.n += 1;
    f.ultimo = Date.now();
    if (f.n < o.captchaIntentos) { fallosCaptcha.set(clave, f); return { quedan: o.captchaIntentos - f.n }; }
    fallosCaptcha.set(clave, { n: 0, hasta: Date.now() + ESPERA_CAPTCHA_MS, ultimo: Date.now() });
    return { quedan: 0 };
}
// Lo que de verdad se le puede hacer (si el bot no puede aislar o expulsar, esperar).
function accionCaptcha(member, cfg) {
    const a = opciones(cfg).captchaFallo;
    if (a === 'aislar' && !member.moderatable) return 'esperar';
    if (a === 'expulsar' && !member.kickable) return 'esperar';
    return a;
}
// Se acabaron los intentos: aislar o expulsar (si se eligió) y apuntarlo. Llamar
// DESPUÉS de contestarle (tras expulsar ya no se le puede responder).
async function castigarCaptcha(member, cfg) {
    let accion = accionCaptcha(member, cfg);
    const motivo = t(cfg, 'Ha fallado el captcha de la verificación', 'Failed the verification captcha');
    if (accion === 'aislar') {
        if (!(await member.timeout(ESPERA_CAPTCHA_MS, motivo).then(() => true, () => false))) accion = 'esperar';
    } else if (accion === 'expulsar') {
        await member.send({ content: t(cfg, `👋 Has salido de **${member.guild.name}** por fallar el captcha de la verificación demasiadas veces. Puedes volver a entrar cuando quieras.`, `👋 You were removed from **${member.guild.name}** for failing the verification captcha too many times. You can join again whenever you like.`), allowedMentions: { parse: [] } }).catch(() => {});
        if (!(await member.kick(motivo).then(() => true, () => false))) accion = 'esperar';
    }
    await registrar(member.guild, cfg, { user: member.user, tipo: 'captcha_fallido', detalle: accion });
    return accion;
}
const limpiarCaptcha = (gid, uid) => fallosCaptcha.delete(`${gid}:${uid}`);

// ---------------------------------------------------------------------------
// Al verificarse (lo llaman todas las formas de dar el acceso).
// ---------------------------------------------------------------------------
async function trasVerificarse(member, cfg, { via = 'verificado', detalle = '' } = {}) {
    const o = opciones(cfg);
    const guild = member.guild;
    let fallo = false;
    const extra = o.rolesExtra.filter((id) => !member.roles.cache.has(id));
    const dables = extra.filter((id) => rolDable(guild, id));
    if (dables.length < extra.length) fallo = true;
    if (dables.length) await member.roles.add(dables, 'Verificación: roles de más').catch(() => { fallo = true; });
    const sinVerificar = rolSinVerificar(cfg);
    if (sinVerificar && member.roles.cache.has(sinVerificar)) {
        if (rolDable(guild, sinVerificar)) await member.roles.remove(sinVerificar, 'Se ha verificado').catch(() => { fallo = true; });
        else fallo = true;
    }
    if (o.dmActivo) {
        const fabrica = t(cfg, '🎉 ¡Ya estás dentro de **{server}**, {user}! Pásate por los canales y preséntate.', '🎉 You’re in **{server}** now, {user}! Have a look around the channels and say hi.');
        await member.send({ content: rellenar(o.mensajeDM.trim() || fabrica, { user: `<@${member.id}>`, server: guild.name }).slice(0, 2000), allowedMentions: { parse: [] } }).catch(() => {});
    }
    limpiarCaptcha(guild.id, member.id);
    await registrar(guild, cfg, { user: member.user, tipo: via, detalle });
    return { fallo };
}

// El «¡Listo!» que ve al verificarse (personalizable).
function textoExito(cfg, guild, user) {
    const o = opciones(cfg);
    if (o.mensajeExito.trim()) return rellenar(o.mensajeExito, { user: user ? `<@${user.id}>` : '', server: guild ? guild.name : '' }).slice(0, 2000);
    return null;
}

// Al entrar: el rol «Sin verificar» (si hay verificación y se ha elegido).
async function alEntrar(member, cfg) {
    const id = rolSinVerificar(cfg);
    if (!id || member.user.bot || !rolAccesoActivo(cfg)) return false;
    if (!rolDable(member.guild, id)) return false;
    return member.roles.add(id, 'Aún no se ha verificado').then(() => true, () => false);
}

// ---------------------------------------------------------------------------
// Registro (panel y canal opcional).
// ---------------------------------------------------------------------------
const COLORES = {
    verificado: 0x2ecc71, aceptado: 0x2ecc71, manual: 0x2ecc71, pendiente: 0xf1c40f,
    rechazado: 0xe74c3c, captcha_fallido: 0xe67e22, bloqueado: 0x95a5a6, expulsado: 0xe74c3c,
};
function tituloRegistro(cfg, tipo) {
    const es = { verificado: '✅ Se ha verificado', aceptado: '✅ El staff le ha dejado entrar', manual: '✅ Verificado a mano', pendiente: '⏳ Esperando al staff', rechazado: '❌ El staff le ha rechazado', captcha_fallido: '🧩 Ha fallado el captcha', bloqueado: '🚧 No cumple los requisitos', expulsado: '👢 Expulsado por no verificarse' };
    const en = { verificado: '✅ Verified', aceptado: '✅ Let in by the staff', manual: '✅ Verified manually', pendiente: '⏳ Waiting for the staff', rechazado: '❌ Rejected by the staff', captcha_fallido: '🧩 Failed the captcha', bloqueado: '🚧 Doesn’t meet the requirements', expulsado: '👢 Kicked for not verifying' };
    return t(cfg, es[tipo] || tipo, en[tipo] || tipo);
}
function detalleLegible(cfg, tipo, detalle) {
    const d = String(detalle || '');
    if (tipo === 'bloqueado') return { edad: t(cfg, 'Cuenta demasiado nueva', 'Account too new'), avatar: t(cfg, 'Sin foto de perfil', 'No profile picture'), espera: t(cfg, 'Aún no ha pasado el rato de espera', 'The waiting time hasn’t passed yet') }[d] || d;
    if (tipo === 'captcha_fallido') return { esperar: t(cfg, 'Tendrá que esperar 10 min', 'Has to wait 10 min'), aislar: t(cfg, 'Aislado 10 min', 'Timed out for 10 min'), expulsar: t(cfg, 'Expulsado', 'Kicked') }[d] || d;
    return d;
}
// Un «no cumple los requisitos» se apunta una vez por hora y persona (si no, cada
// clic en el botón llenaría el registro).
const bloqueosVistos = new Map(); // `${gid}:${uid}:${tipo}` -> hasta
setInterval(() => { const a = Date.now(); for (const [k, v] of bloqueosVistos) if (v <= a) bloqueosVistos.delete(k); }, 10 * 60000).unref();
async function registrarBloqueo(guild, cfg, user, tipo) {
    const k = `${guild && guild.id}:${user && user.id}:${tipo}`;
    if ((bloqueosVistos.get(k) || 0) > Date.now()) return;
    bloqueosVistos.set(k, Date.now() + 3600000);
    await registrar(guild, cfg, { user, tipo: 'bloqueado', detalle: tipo });
}

async function registrar(guild, cfg, { user, tipo, detalle = '' }) {
    if (!guild || !user) return;
    const RegistroEntrada = require('../models/RegistroEntrada.js');
    await RegistroEntrada.create({ guildId: guild.id, userId: user.id, userTag: user.username || user.tag || '', tipo, detalle: String(detalle || '').slice(0, 300) }).catch(() => {});
    const o = opciones(cfg);
    const canal = o.canalRegistroId ? guild.channels.cache.get(o.canalRegistroId) : null;
    if (!canal || typeof canal.isTextBased !== 'function' || !canal.isTextBased()) return;
    const d = detalleLegible(cfg, tipo, detalle);
    const embed = new EmbedBuilder().setColor(COLORES[tipo] || 0x5865f2).setTitle(tituloRegistro(cfg, tipo))
        .setDescription([`<@${user.id}> · ${user.username || ''}`, d, user.createdTimestamp ? t(cfg, `Cuenta creada <t:${Math.floor(user.createdTimestamp / 1000)}:R>`, `Account created <t:${Math.floor(user.createdTimestamp / 1000)}:R>`) : ''].filter(Boolean).join('\n').slice(0, 4000))
        .setFooter({ text: user.id }).setTimestamp(new Date());
    await canal.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Quien no se verifica: recordatorio a mitad de tiempo y expulsión al acabarse.
// Solo cuenta a quien entró DESPUÉS de encender la opción (si no, se iría la gente de
// siempre que nunca se verificó), nunca al staff ni a quien espera al staff.
// ---------------------------------------------------------------------------
const recordados = new Map(); // `${gid}:${uid}:${joinedTimestamp}` -> cuándo se le avisó
const VUELTA_MS = 15 * 60000;
setInterval(() => { const a = Date.now() - 31 * DIA; for (const [k, v] of recordados) if (v < a) recordados.delete(k); }, 3600000).unref();
const PERMISOS_STAFF = [PermissionsBitField.Flags.Administrator, PermissionsBitField.Flags.ManageGuild, PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.ModerateMembers];

// `excluir`: quien espera al staff o ya se verificó (según el registro), aunque ahora no
// tenga el rol de acceso de la puerta encendida (p. ej. tras cambiar de verificación).
function quienesSinVerificar(miembros, cfg, { ahora = Date.now(), pendientes = new Set() } = {}) {
    const o = opciones(cfg);
    const accesos = rolesAcceso(cfg);
    const desde = o.expulsarDesde ? new Date(o.expulsarDesde).getTime() : null;
    const expulsar = [];
    const recordar = [];
    if (!o.expulsarHoras || !rolAccesoActivo(cfg) || !desde) return { expulsar, recordar };
    const plazo = o.expulsarHoras * 3600000;
    for (const m of miembros) {
        if (!m || !m.user || m.user.bot || !m.joinedTimestamp || m.joinedTimestamp < desde) continue;
        if (accesos.some((r) => m.roles.cache.has(r)) || pendientes.has(m.id)) continue;
        if (m.permissions && PERMISOS_STAFF.some((p) => m.permissions.has(p))) continue;
        const dentro = ahora - m.joinedTimestamp;
        if (dentro >= plazo) expulsar.push(m);
        // El aviso, solo en su ventana (la mitad del plazo + dos vueltas): así un
        // reinicio del bot no lo repite a quien ya pasó de la mitad hace rato.
        else if (o.recordatorio && dentro >= plazo / 2 && dentro < plazo / 2 + 2 * VUELTA_MS && !recordados.has(`${m.guild.id}:${m.id}:${m.joinedTimestamp}`)) recordar.push(m);
    }
    return { expulsar: expulsar.slice(0, MAX_EXPULSIONES_POR_VUELTA), recordar };
}

// La lista entera de miembros se pide a Discord como mucho una vez por hora y servidor
// (es pesado); entre medias vale la caché, a la que se suma cada uno que entra.
const ultimaListaEntera = new Map(); // guildId -> cuándo
async function miembrosDe(guild) {
    if ((ultimaListaEntera.get(guild.id) || 0) > Date.now() - 3600000 && guild.members.cache.size) return [...guild.members.cache.values()];
    const todos = await guild.members.fetch().catch(() => null);
    if (!todos) return [...guild.members.cache.values()];
    ultimaListaEntera.set(guild.id, Date.now());
    return [...todos.values()];
}

async function barrerSinVerificar(client) {
    const ServidorConfig = require('../models/ServidorConfig.js');
    const SolicitudEntrada = require('../models/SolicitudEntrada.js');
    const RegistroEntrada = require('../models/RegistroEntrada.js');
    const configs = await ServidorConfig.find({ 'opcionesEntrada.expulsarHoras': { $gt: 0 } });
    for (const cfg of configs) {
        try {
            const guild = client.guilds.cache.get(cfg.guildId);
            if (!guild || !rolAccesoActivo(cfg)) continue;
            const o = opciones(cfg);
            const miembros = await miembrosDe(guild);
            const [pend, hechos] = await Promise.all([
                SolicitudEntrada.find({ guildId: guild.id, estado: { $in: ['pendiente', 'revisando'] } }).select('userId').lean(),
                RegistroEntrada.find({ guildId: guild.id, tipo: { $in: ['verificado', 'aceptado', 'manual'] }, fecha: { $gte: new Date(o.expulsarDesde || 0) } }).select('userId').lean(),
            ]);
            const excluir = new Set([...pend, ...hechos].map((p) => p.userId));
            const { expulsar, recordar } = quienesSinVerificar(miembros, cfg, { pendientes: excluir });
            for (const m of recordar) {
                recordados.set(`${guild.id}:${m.id}:${m.joinedTimestamp}`, Date.now());
                const cuando = Math.floor((m.joinedTimestamp + o.expulsarHoras * 3600000) / 1000);
                await m.send({ content: t(cfg, `⏰ Aún no te has verificado en **${guild.name}**. Hazlo desde el canal de verificación: si no, saldrás del servidor <t:${cuando}:R>.`, `⏰ You haven’t verified on **${guild.name}** yet. Do it from the verification channel, or you’ll be removed from the server <t:${cuando}:R>.`), allowedMentions: { parse: [] } }).catch(() => {});
            }
            for (const m of expulsar) {
                if (!m.kickable) continue;
                const fabrica = t(cfg, '👋 Has salido de **{server}** porque no te verificaste en {horas} h. Puedes volver a entrar cuando quieras y verificarte.', '👋 You were removed from **{server}** because you didn’t verify within {horas} h. You can join again whenever you like and verify.');
                await m.send({ content: rellenar(o.mensajeExpulsion.trim() || fabrica, { user: `<@${m.id}>`, server: guild.name, horas: o.expulsarHoras }).slice(0, 2000), allowedMentions: { parse: [] } }).catch(() => {});
                const ok = await m.kick(t(cfg, `No se ha verificado en ${o.expulsarHoras} h`, `Didn’t verify within ${o.expulsarHoras} h`)).then(() => true, () => false);
                if (ok) await registrar(guild, cfg, { user: m.user, tipo: 'expulsado', detalle: `${o.expulsarHoras} h` });
            }
        } catch (e) { console.error(`Barrido de verificación en ${cfg.guildId}:`, e.message); }
    }
}

function iniciarBarrido(client) {
    const vuelta = () => barrerSinVerificar(client).catch((e) => console.error('Barrido de verificación:', e.message));
    setTimeout(vuelta, 60000).unref();
    setInterval(vuelta, VUELTA_MS).unref();
}

module.exports = {
    DEF, opciones, sanearOpciones, rellenar, rolDable, rolAccesoActivo, rolesAcceso, rolSinVerificar,
    requisitoQueFalla, modoAprobacion, motivosRevision, textoMotivos, MODOS_APROBACION,
    hayNormas, yaAceptoNormas, aceptarNormas, pantallaNormas,
    captchaEsperaHasta, contarFalloCaptcha, accionCaptcha, castigarCaptcha, limpiarCaptcha, registrarBloqueo,
    trasVerificarse, textoExito, alEntrar, registrar, tituloRegistro, detalleLegible,
    quienesSinVerificar, barrerSinVerificar, iniciarBarrido,
    _fallosCaptcha: fallosCaptcha, _recordados: recordados, _ultimaListaEntera: ultimaListaEntera,
};
