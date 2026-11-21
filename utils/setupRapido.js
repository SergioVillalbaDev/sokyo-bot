// Setup rápido (1.11.0): con un botón y unas preguntas, Sokyo queda funcionando en el
// servidor. Lo usan el panel (POST /api/config/:guildId/setup-rapido, solo admins) y
// Discord (/setup-rapido). Reglas de seguridad:
//   · nunca pisa lo que ya está configurado a mano (el automod ya activo no se toca, los
//     canales ya elegidos se reutilizan) y reutiliza los canales con el mismo nombre si se
//     repite, así que se puede volver a pasar sin duplicar nada;
//   · los canales nuevos llevan sus permisos explícitos (el de registro, privado);
//   · el automod solo borra (nunca expulsa ni banea por su cuenta);
//   · una pasada por servidor y minuto, y comprueba antes los permisos del bot.
// Al pasar por la API, el historial de cambios lo apunta todo (con «Deshacer»).
const { ChannelType, PermissionsBitField, OverwriteType } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { t } = require('./i18n.js');

const F = PermissionsBitField.Flags;
const MODULOS = ['bienvenidas', 'registro', 'niveles', 'automod', 'tickets', 'temporadas', 'cumpleanos', 'votos'];
const TIPOS = {
    gaming: ['bienvenidas', 'registro', 'niveles', 'automod', 'temporadas', 'votos'],
    comunidad: ['bienvenidas', 'registro', 'niveles', 'automod', 'temporadas', 'cumpleanos', 'votos'],
    creador: ['bienvenidas', 'registro', 'niveles', 'automod', 'votos'],
    estudio: ['bienvenidas', 'registro', 'automod', 'cumpleanos'],
    soporte: ['bienvenidas', 'registro', 'automod', 'tickets'],
};
// Canales que hacen falta según lo que se activa.
const CANALES = {
    bienvenida: ['bienvenidas'],
    registro: ['registro'],
    anuncios: ['temporadas', 'cumpleanos', 'votos'],
    soporte: ['tickets'],
};
const NOMBRES = {
    bienvenida: ['👋・welcome', '👋・bienvenida'],
    registro: ['📋・sokyo-log', '📋・registro-sokyo'],
    anuncios: ['🎉・events-and-rewards', '🎉・eventos-y-premios'],
    soporte: ['🎫・support', '🎫・soporte'],
    categoriaTickets: ['🎫 Tickets', '🎫 Tickets'],
};
const SNOWFLAKE = /^\d{17,20}$/;
const nombre = (clave, idioma) => NOMBRES[clave][idioma === 'es' ? 1 : 0];

// Lo que se activa por defecto para cada tipo de servidor.
const recomendados = (tipo) => [...(TIPOS[tipo] || TIPOS.comunidad)];

// Comprueba y limpia las respuestas (pura, la prueban los tests). { respuestas } o { error }.
function validar(body, guild) {
    const b = body || {};
    const idioma = b.idioma === 'es' ? 'es' : b.idioma === 'en' ? 'en' : null;
    if (!idioma) return { error: 'Elige el idioma del bot', codigo: 'idioma' };
    const tipo = TIPOS[b.tipo] ? b.tipo : null;
    if (!tipo) return { error: 'Elige el tipo de servidor', codigo: 'tipo' };
    const modulos = Array.isArray(b.modulos) ? [...new Set(b.modulos.filter((m) => MODULOS.includes(m)))] : recomendados(tipo);
    const canales = {};
    for (const clave of Object.keys(CANALES)) {
        // 'auto' (por defecto): el que ya esté configurado, uno con ese nombre o uno nuevo.
        // 'nuevo': uno propio (con su nombre) aunque haya otro configurado. Si no, un canal concreto.
        const v = b.canales && b.canales[clave];
        if (!v || v === 'auto' || v === 'nuevo') { canales[clave] = v === 'nuevo' ? 'nuevo' : 'auto'; continue; }
        const c = SNOWFLAKE.test(String(v)) ? guild.channels.cache.get(String(v)) : null;
        if (!c || c.type !== ChannelType.GuildText) return { error: `El canal elegido para «${clave}» no existe o no es de texto`, codigo: 'canal' };
        canales[clave] = c.id;
    }
    let rolStaffId = null;
    if (b.rolStaffId) {
        const r = SNOWFLAKE.test(String(b.rolStaffId)) ? guild.roles.cache.get(String(b.rolStaffId)) : null;
        if (!r || r.id === guild.id || r.managed) return { error: 'Ese rol de staff no existe o no se puede usar', codigo: 'rol' };
        rolStaffId = r.id;
    }
    return { respuestas: { idioma, tipo, modulos, canales, rolStaffId } };
}

// Qué canales hay que tener (y si se crean) para lo elegido. Pura.
function canalesNecesarios(respuestas) {
    return Object.entries(CANALES)
        .filter(([, mods]) => mods.some((m) => respuestas.modulos.includes(m)))
        .map(([clave]) => clave);
}

// Permisos que le faltan al bot para lo que se va a hacer (vacío = todo bien).
function permisosQueFaltan(guild, respuestas) {
    const yo = guild.members.me;
    if (!yo) return ['ViewChannel'];
    const falta = [];
    const crea = canalesNecesarios(respuestas).some((c) => ['auto', 'nuevo'].includes(respuestas.canales[c])) || respuestas.modulos.includes('tickets');
    if (crea && !yo.permissions.has(F.ManageChannels)) falta.push('ManageChannels');
    if (respuestas.modulos.includes('automod') && !yo.permissions.has(F.ManageMessages)) falta.push('ManageMessages');
    if (respuestas.modulos.includes('automod') && !yo.permissions.has(F.ModerateMembers)) falta.push('ModerateMembers');
    return falta;
}

// Una pasada por servidor y minuto (las dos vías: panel y Discord).
const ultimaPasada = new Map();
function puedePasar(guildId, ahora = Date.now()) {
    const antes = ultimaPasada.get(guildId);
    if (antes !== undefined && ahora - antes < 60 * 1000) return false;
    ultimaPasada.set(guildId, ahora);
    if (ultimaPasada.size > 5000) ultimaPasada.clear();
    return true;
}

// Busca un canal ya configurado o con el mismo nombre; si no, lo crea con sus permisos.
async function canalDe(guild, clave, idioma, { configurado = null, privado = false, soloLectura = false, parent = null, rolStaffId = null } = {}) {
    if (configurado && guild.channels.cache.get(configurado)?.type === ChannelType.GuildText) return { canal: guild.channels.cache.get(configurado), creado: false };
    const nom = nombre(clave, idioma);
    const mismo = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === nom);
    if (mismo) return { canal: mismo, creado: false };
    const yo = guild.members.me;
    const permisos = [];
    if (privado || soloLectura) {
        permisos.push({ id: guild.id, type: OverwriteType.Role, deny: privado ? [F.ViewChannel] : [F.SendMessages] });
        permisos.push({ id: yo.id, type: OverwriteType.Member, allow: [F.ViewChannel, F.SendMessages, F.EmbedLinks, F.ReadMessageHistory] });
        if (privado && rolStaffId) permisos.push({ id: rolStaffId, type: OverwriteType.Role, allow: [F.ViewChannel, F.ReadMessageHistory] });
    }
    const canal = await guild.channels.create({ name: nom, type: ChannelType.GuildText, parent: parent || undefined, permissionOverwrites: permisos, reason: 'Setup rápido de Sokyo' });
    return { canal, creado: true };
}

// Aplica el setup. Devuelve { pasos: [{ id, estado: 'ok'|'omitido'|'error', detalle, tab }], creados }.
// `idiomaTextos`: idioma de los detalles del resultado (el del panel que lo pide; en Discord,
// el elegido). Los canales nuevos se llaman en el idioma del bot.
async function aplicar(client, guild, respuestas, { idiomaTextos = respuestas.idioma } = {}) {
    const { idioma } = respuestas;
    const tx = (es, en) => t(idiomaTextos, es, en);
    const pasos = [];
    const creados = [];
    const paso = async (id, tab, fn) => {
        try {
            const r = await fn();
            pasos.push({ id, tab, estado: r?.omitido ? 'omitido' : 'ok', detalle: r?.detalle || '' });
        } catch (e) {
            pasos.push({ id, tab, estado: 'error', detalle: e.code === 50013 ? tx('Al bot le falta un permiso para esto.', 'The bot is missing a permission for this.') : (e.message || 'Error') });
        }
    };
    const set = (cambios) => ServidorConfig.updateOne({ guildId: guild.id }, { $set: cambios }, { upsert: true });
    let cfg = (await ServidorConfig.findOne({ guildId: guild.id })) || await ServidorConfig.create({ guildId: guild.id });
    const mods = new Set(respuestas.modulos);
    const usar = async (clave, opciones) => {
        const v = respuestas.canales[clave];
        const configurado = v === 'nuevo' ? null : v === 'auto' ? opciones.configurado : v;
        const r = await canalDe(guild, clave, idioma, { ...opciones, configurado });
        if (r.creado) creados.push({ id: r.canal.id, nombre: r.canal.name });
        return r.canal;
    };

    // 1. Idioma (y los textos de fábrica pasan a ese idioma).
    await paso('idioma', 'config-textos', async () => {
        await set({ idioma });
        await require('./textosPorDefecto.js').adaptarTextosAlIdioma(guild.id, idioma);
        return { detalle: idioma === 'es' ? 'Español' : 'English' };
    });

    // 2. Rol del staff (tickets y canal de registro).
    if (respuestas.rolStaffId) await paso('staff', 'tickets-config', async () => { await set({ rolStaffId: respuestas.rolStaffId }); return { detalle: `@${guild.roles.cache.get(respuestas.rolStaffId)?.name}` }; });

    // 3. Canal de registro privado (entradas, salidas, mensajes borrados, sanciones).
    let canalRegistro = null;
    if (mods.has('registro')) await paso('registro', 'logs-todos', async () => {
        canalRegistro = await usar('registro', { configurado: cfg.canalLogsId, privado: true, rolStaffId: respuestas.rolStaffId || cfg.rolStaffId });
        const cambios = { canalLogsId: canalRegistro.id };
        if (!cfg.canalModLogId) cambios.canalModLogId = canalRegistro.id;
        await set(cambios);
        return { detalle: `#${canalRegistro.name}` };
    });

    // 4. Bienvenidas.
    if (mods.has('bienvenidas')) await paso('bienvenidas', 'prod-bienvenidas', async () => {
        const canal = await usar('bienvenida', { configurado: cfg.bienvenida?.canalId || guild.systemChannelId });
        await set({ 'bienvenida.activo': true, 'bienvenida.canalId': canal.id });
        return { detalle: `#${canal.name}` };
    });

    // 5. Niveles.
    if (mods.has('niveles')) await paso('niveles', 'config-niveles', async () => {
        if (cfg.nivelesActivo) return { omitido: true, detalle: tx('Ya estaban activados.', 'Already on.') };
        await set({ nivelesActivo: true });
        return {};
    });

    // 6. Automod básico: solo si nadie lo ha configurado ya (no se pisa lo hecho a mano).
    if (mods.has('automod')) await paso('automod', 'mod-automod', async () => {
        if (cfg.automod?.activo) return { omitido: true, detalle: tx('Ya estaba configurado: no se ha tocado.', 'Already set up: left untouched.') };
        const cambios = {
            'automod.activo': true, 'automod.preset': 'setup-rapido', 'automod.avisarEnCanal': true,
            'automod.spam.activo': true, 'automod.spam.accion': 'timeout', 'automod.spam.timeoutMin': 5,
            'automod.invitaciones.activo': true, 'automod.invitaciones.accion': 'borrar',
            'automod.menciones.activo': true, 'automod.menciones.accion': 'borrar',
            'automod.estafas.activo': true, 'automod.estafas.accion': 'borrar',
        };
        if (canalRegistro) cambios['automod.canalAlertasId'] = canalRegistro.id;
        await set(cambios);
        return { detalle: tx('Antispam, invitaciones, menciones masivas y estafas (solo borra).', 'Anti-spam, invites, mass mentions and scams (delete only).') };
    });

    // 7. Tickets: categoría, canal de soporte (solo lectura) y su panel publicado.
    if (mods.has('tickets')) await paso('tickets', 'tickets-config', async () => {
        let categoria = cfg.categoriaTicketsId ? guild.channels.cache.get(cfg.categoriaTicketsId) : null;
        if (!categoria) {
            const nomCat = nombre('categoriaTickets', idioma);
            categoria = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === nomCat)
                || await guild.channels.create({ name: nomCat, type: ChannelType.GuildCategory, reason: 'Setup rápido de Sokyo' }).then((c) => { creados.push({ id: c.id, nombre: c.name }); return c; });
        }
        await set({ categoriaTicketsId: categoria.id });
        const canal = await usar('soporte', { configurado: cfg.panelTickets?.canalId, soloLectura: true });
        const fresco = await ServidorConfig.findOne({ guildId: guild.id });
        await require('./panelTickets.js').publicarPanelTickets(canal, fresco);
        return { detalle: `#${canal.name}` };
    });

    // 8-10. Lo que publica en el canal de anuncios: temporadas, cumpleaños y votos.
    let canalAnuncios = null;
    const anuncios = async () => {
        canalAnuncios ||= await usar('anuncios', { configurado: cfg.temporadas?.canalId || cfg.cumpleanos?.canalId || cfg.crecimiento?.votos?.canalId });
        return canalAnuncios;
    };
    if (mods.has('temporadas')) await paso('temporadas', 'com-temporadas', async () => {
        const canal = await anuncios();
        await set({ 'temporadas.activo': true, 'temporadas.canalId': canal.id });
        if (!cfg.nivelesActivo && !mods.has('niveles')) await set({ nivelesActivo: true }); // la temporada cuenta la XP
        cfg = await ServidorConfig.findOne({ guildId: guild.id });
        if (!cfg.temporadas.fin) await require('./temporadas.js').iniciarTemporada(guild.id, cfg.temporadas.duracion, Math.max(1, cfg.temporadas.numero || 1), { guild });
        return { detalle: `#${canal.name}` };
    });
    if (mods.has('cumpleanos')) await paso('cumpleanos', 'com-cumpleanos', async () => {
        const canal = await anuncios();
        await set({ 'cumpleanos.activo': true, 'cumpleanos.canalId': canal.id });
        return { detalle: `#${canal.name}` };
    });
    if (mods.has('votos')) await paso('votos', 'crec-votos', async () => {
        const canal = await anuncios();
        await set({ 'crecimiento.votos.activo': true, 'crecimiento.votos.canalId': canal.id });
        return { detalle: `#${canal.name}` };
    });

    require('./config.js').invalidateConfig(guild.id);
    return { pasos, creados };
}

// Resumen para Discord (una línea por paso).
const ICONO = { ok: '✅', omitido: '⏭️', error: '❌' };
const NOMBRE_PASO = {
    idioma: ['Idioma del bot', 'Bot language'], staff: ['Rol del staff', 'Staff role'], registro: ['Canal de registro (privado)', 'Log channel (private)'],
    bienvenidas: ['Bienvenidas', 'Welcome messages'], niveles: ['Niveles y XP', 'Levels & XP'], automod: ['Automod básico', 'Basic automod'],
    tickets: ['Tickets', 'Tickets'], temporadas: ['Temporadas', 'Seasons'], cumpleanos: ['Cumpleaños', 'Birthdays'], votos: ['Premios por votar', 'Vote rewards'],
};
function resumenTexto(idioma, resultado) {
    return resultado.pasos.map((p) => `${ICONO[p.estado]} **${t(idioma, ...NOMBRE_PASO[p.id])}**${p.detalle ? ` · ${p.detalle}` : ''}`).join('\n');
}

module.exports = {
    MODULOS, TIPOS, CANALES, NOMBRES, recomendados, validar, canalesNecesarios, permisosQueFaltan, puedePasar, canalDe, aplicar, resumenTexto, NOMBRE_PASO,
    _reiniciarLimite: () => ultimaPasada.clear(),
};
