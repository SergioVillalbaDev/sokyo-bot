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
// 1.17.0: también sugerencias, salón de la fama, contador de miembros, mascota, casino,
// bromas, Liga Sokyo y clanes. `uno: true` activa una sola cosa (los botones «Activar»
// de la lista del Inicio) sin tocar el idioma ni el rol del staff.
const MODULOS = ['bienvenidas', 'registro', 'niveles', 'automod', 'tickets', 'temporadas', 'cumpleanos', 'votos',
    'sugerencias', 'salon', 'contadores', 'mascota', 'casino', 'bromas', 'liga', 'clanes', 'tienda'];
const TIPOS = {
    gaming: ['bienvenidas', 'registro', 'niveles', 'automod', 'temporadas', 'votos', 'salon', 'contadores', 'mascota', 'casino', 'bromas', 'liga', 'clanes', 'tienda'],
    comunidad: ['bienvenidas', 'registro', 'niveles', 'automod', 'temporadas', 'cumpleanos', 'votos', 'sugerencias', 'salon', 'contadores', 'mascota', 'casino', 'bromas', 'liga', 'tienda'],
    creador: ['bienvenidas', 'registro', 'niveles', 'automod', 'votos', 'sugerencias', 'salon', 'contadores', 'mascota', 'liga'],
    estudio: ['bienvenidas', 'registro', 'automod', 'cumpleanos', 'sugerencias', 'contadores'],
    soporte: ['bienvenidas', 'registro', 'automod', 'tickets', 'sugerencias', 'contadores'],
};
// Canales que hacen falta según lo que se activa.
const CANALES = {
    bienvenida: ['bienvenidas'],
    registro: ['registro'],
    anuncios: ['temporadas', 'cumpleanos', 'votos'],
    soporte: ['tickets'],
    sugerencias: ['sugerencias'],
    salon: ['salon'],
    mascota: ['mascota', 'liga'],
    casino: ['casino'],
};
const NOMBRES = {
    bienvenida: ['👋・welcome', '👋・bienvenida'],
    registro: ['📋・sokyo-log', '📋・registro-sokyo'],
    anuncios: ['🎉・events-and-rewards', '🎉・eventos-y-premios'],
    soporte: ['🎫・support', '🎫・soporte'],
    categoriaTickets: ['🎫 Tickets', '🎫 Tickets'],
    sugerencias: ['💡・suggestions', '💡・sugerencias'],
    salon: ['⭐・hall-of-fame', '⭐・salon-de-la-fama'],
    mascota: ['🐾・pet', '🐾・mascota'],
    casino: ['🎰・casino', '🎰・casino'],
};
const SNOWFLAKE = /^\d{17,20}$/;
const nombre = (clave, idioma) => NOMBRES[clave][idioma === 'es' ? 1 : 0];

// Lo que se activa por defecto para cada tipo de servidor.
const recomendados = (tipo) => [...(TIPOS[tipo] || TIPOS.comunidad)];

// Comprueba y limpia las respuestas (pura, la prueban los tests). { respuestas } o { error }.
function validar(body, guild) {
    const b = body || {};
    const uno = b.uno === true;
    const idioma = b.idioma === 'es' ? 'es' : b.idioma === 'en' ? 'en' : (uno ? 'en' : null);
    if (!idioma) return { error: 'Elige el idioma del bot', codigo: 'idioma' };
    const tipo = TIPOS[b.tipo] ? b.tipo : (uno ? 'comunidad' : null);
    if (!tipo) return { error: 'Elige el tipo de servidor', codigo: 'tipo' };
    if (uno && (!Array.isArray(b.modulos) || b.modulos.length !== 1 || !MODULOS.includes(b.modulos[0]))) return { error: 'Acción no válida', codigo: 'modulo' };
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
    return { respuestas: { idioma, tipo, modulos, canales, rolStaffId, uno } };
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
    const crea = canalesNecesarios(respuestas).some((c) => ['auto', 'nuevo'].includes(respuestas.canales[c])) || respuestas.modulos.includes('tickets') || respuestas.modulos.includes('contadores');
    if (crea && !yo.permissions.has(F.ManageChannels)) falta.push('ManageChannels');
    if (respuestas.modulos.includes('automod') && !yo.permissions.has(F.ManageMessages)) falta.push('ManageMessages');
    if (respuestas.modulos.includes('automod') && !yo.permissions.has(F.ModerateMembers)) falta.push('ModerateMembers');
    if (respuestas.modulos.includes('tienda') && !yo.permissions.has(F.ManageRoles)) falta.push('ManageRoles');
    return falta;
}

// Una pasada por servidor y minuto (las dos vías: panel y Discord). Activar una sola cosa
// («uno») tiene su propio freno, de 3 s por cosa.
const ultimaPasada = new Map();
function puedePasar(guildId, ahora = Date.now(), modulo = null) {
    const k = modulo ? `${guildId}:${modulo}` : guildId;
    const antes = ultimaPasada.get(k);
    if (antes !== undefined && ahora - antes < (modulo ? 3000 : 60 * 1000)) return false;
    ultimaPasada.set(k, ahora);
    if (ultimaPasada.size > 5000) ultimaPasada.clear();
    return true;
}

// Busca un canal ya configurado o con el mismo nombre; si no, lo crea con sus permisos.
// Categorías (1.26.0): los canales del bot no quedan sueltos arriba del todo, sino ordenados.
const CATEGORIAS = {
    comunidad: ['📢 COMMUNITY', '📢 COMUNIDAD'], diversion: ['🎮 FUN', '🎮 DIVERSIÓN'], soporte: ['🎫 SUPPORT', '🎫 SOPORTE'],
    staff: ['🛡️ STAFF', '🛡️ STAFF'], stats: ['📊 STATS', '📊 ESTADÍSTICAS'],
};
const GRUPO_CANAL = { bienvenida: 'comunidad', anuncios: 'comunidad', sugerencias: 'comunidad', salon: 'comunidad', mascota: 'diversion', casino: 'diversion', soporte: 'soporte', registro: 'staff', contador: 'stats' };
// La categoría de ese grupo (la busca por nombre en los dos idiomas; si no, la crea).
// La de staff es privada: solo el bot y el rol de staff la ven.
async function categoriaDe(guild, grupo, idioma, rolStaffId = null) {
    const nombres = CATEGORIAS[grupo];
    if (!nombres) return null;
    const ya = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && nombres.includes(c.name));
    if (ya) return ya;
    const permisos = [];
    if (grupo === 'staff') {
        permisos.push({ id: guild.id, type: OverwriteType.Role, deny: [F.ViewChannel] });
        permisos.push({ id: guild.members.me.id, type: OverwriteType.Member, allow: [F.ViewChannel, F.SendMessages, F.EmbedLinks, F.ReadMessageHistory] });
        if (rolStaffId) permisos.push({ id: rolStaffId, type: OverwriteType.Role, allow: [F.ViewChannel, F.ReadMessageHistory] });
    }
    return guild.channels.create({ name: nombres[idioma === 'en' ? 0 : 1], type: ChannelType.GuildCategory, permissionOverwrites: permisos, reason: 'Setup rápido de Sokyo' });
}
// Mete en su categoría los canales del bot que estén SUELTOS (sin categoría). Lo que alguien ya
// haya colocado en otra categoría no se toca. No cambia permisos. Devuelve los movidos.
async function organizarCanales(guild, cfg, idioma = 'es') {
    const c = cfg || {};
    const lista = [
        ['bienvenida', c.bienvenida?.canalId], ['registro', c.canalLogsId], ['anuncios', c.temporadas?.canalId], ['anuncios', c.cumpleanos?.canalId],
        ['sugerencias', c.canalSugerencias], ['salon', c.salonFama?.canalId], ['mascota', c.mascota?.canalId], ['casino', c.casino?.canalId],
        ['soporte', c.panelTickets?.canalId], ...(c.contadoresCanal || []).map((x) => ['contador', x.canalId]),
    ];
    const movidos = []; const vistos = new Set();
    for (const [clave, id] of lista) {
        const canal = id && guild.channels.cache.get(String(id));
        if (!canal || vistos.has(canal.id) || canal.parentId || canal.type === ChannelType.GuildCategory) continue;
        vistos.add(canal.id);
        const cat = await categoriaDe(guild, GRUPO_CANAL[clave], idioma, c.rolStaffId);
        if (!cat) continue;
        await canal.setParent(cat.id, { lockPermissions: false, reason: 'Sokyo · ordenar canales' }).then(() => movidos.push({ canal: canal.name, categoria: cat.name })).catch(() => {});
    }
    return movidos;
}

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
    // Nuevo: dentro de su categoría (la de staff ya es privada).
    const cat = parent ? null : await categoriaDe(guild, GRUPO_CANAL[clave], idioma, rolStaffId).catch(() => null);
    const canal = await guild.channels.create({ name: nom, type: ChannelType.GuildText, parent: parent || cat?.id || undefined, permissionOverwrites: permisos, reason: 'Setup rápido de Sokyo' });
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

    // 1. Idioma (y los textos de fábrica pasan a ese idioma). Activando una sola cosa, no se toca.
    if (!respuestas.uno) await paso('idioma', 'config-textos', async () => {
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

    // 11. Sugerencias: un canal donde lo que se escribe se convierte en sugerencia con votos.
    if (mods.has('sugerencias')) await paso('sugerencias', 'com-sugerencias', async () => {
        const canal = await usar('sugerencias', { configurado: cfg.canalSugerencias });
        await set({ canalSugerencias: canal.id });
        return { detalle: `#${canal.name}` };
    });

    // 12. Salón de la fama: los mensajes con 3 ⭐ se copian a su canal (solo lectura).
    if (mods.has('salon')) await paso('salon', 'com-salon', async () => {
        const canal = await usar('salon', { configurado: cfg.salonFama?.canalId, soloLectura: true });
        await set({ 'salonFama.activo': true, 'salonFama.canalId': canal.id });
        return { detalle: `#${canal.name} · ${cfg.salonFama?.emoji || '⭐'} ×${cfg.salonFama?.minimo || 3}` };
    });

    // 13. Contador de miembros arriba del todo (canal de voz cerrado).
    if (mods.has('contadores')) await paso('contadores', 'crec-contadores', async () => {
        if ((cfg.contadoresCanal || []).some((c) => c.tipo === 'miembros' && guild.channels.cache.has(c.canalId))) return { omitido: true, detalle: tx('Ya había uno.', 'There was one already.') };
        const cc = require('./contadoresCanal.js');
        const canal = await cc.crearCanal(guild, { tipo: 'miembros' }, idioma);
        creados.push({ id: canal.id, nombre: canal.name });
        await ServidorConfig.updateOne({ guildId: guild.id }, { $push: { contadoresCanal: { canalId: canal.id, tipo: 'miembros', plantilla: cc.plantillaPorDefecto('miembros', idioma) } } });
        return { detalle: canal.name };
    });

    // 14. Mascota del servidor: su canal y el huevo para votar (sale ya).
    let canalMascota = null;
    if (mods.has('mascota')) await paso('mascota', 'com-mascota', async () => {
        canalMascota = await usar('mascota', { configurado: cfg.mascota?.canalId });
        await set({ 'mascota.activo': true, 'mascota.canalId': canalMascota.id });
        const Mascota = require('../models/Mascota.js');
        if (!(await Mascota.exists({ guildId: guild.id }))) {
            const fresco = (await ServidorConfig.findOne({ guildId: guild.id })).toObject();
            await require('./mascota.js').iniciarHuevo(client, fresco).catch(() => {});
        }
        return { detalle: `#${canalMascota.name}` };
    });

    // 15. Liga Sokyo (los combates salen en el canal de la mascota).
    if (mods.has('liga')) await paso('liga', 'crec-liga', async () => {
        if (!canalMascota && cfg.mascota?.canalId) canalMascota = guild.channels.cache.get(cfg.mascota.canalId) || null;
        if (!canalMascota) canalMascota = await usar('mascota', { configurado: cfg.liga?.canalId });
        await set({ 'liga.activo': true, ...(cfg.liga?.canalId ? {} : { 'liga.canalId': canalMascota.id }) });
        return { detalle: `#${canalMascota.name}` };
    });

    // 16. Casino: su canal (los juegos solo ahí) y el lobby con todos los juegos publicado y fijado.
    if (mods.has('casino')) await paso('casino', 'com-casino', async () => {
        const yaActivo = !!cfg.casino?.activo;
        const canal = await usar('casino', { configurado: cfg.casino?.canalId });
        await set({ 'casino.activo': true, 'casino.canalId': canal.id, ...(cfg.casino?.anunciosId ? {} : { 'casino.anunciosId': canal.id }) });
        // 1.23.0: el lobby (desplegable con todos los juegos, bote y premios) fijado en el canal.
        if (!yaActivo || !cfg.casino?.lobby?.mensajeId) {
            await require('./casinoLobby.js').publicar(guild.client, guild.id, canal.id).catch(() => {});
        }
        return { detalle: `#${canal.name}` };
    });

    // 17. Bromas (sin rol de payaso hasta que el staff elija uno) y clanes.
    if (mods.has('bromas')) await paso('bromas', 'com-bromas', async () => {
        await set({ 'bromas.activo': true, ...(cfg.bromas?.rolPayasoId ? {} : { 'bromas.tipos.payaso.activo': false }) });
        return { detalle: tx('Apodo, reacción y loro (el payaso, cuando elijas su rol).', 'Nickname, reaction and parrot (the clown once you pick its role).') };
    });
    if (mods.has('clanes')) await paso('clanes', 'com-clanes', async () => {
        if (cfg.clanes?.activo) return { omitido: true, detalle: tx('Ya estaban activados.', 'Already on.') };
        await set({ 'clanes.activo': true, ...(cfg.nivelesActivo || mods.has('niveles') ? {} : { nivelesActivo: true }) });
        return {};
    });

    // 18. Tienda del servidor (2.0.1): dos roles de color a la venta para que el oro sirva desde el primer día.
    //     Roles nuevos, sin ningún permiso (solo color), justo debajo del de Sokyo.
    if (mods.has('tienda')) await paso('tienda', 'com-tienda', async () => {
        if (cfg.tienda?.activo && (cfg.tienda?.productos || []).length) return { omitido: true, detalle: tx('Ya tenía productos.', 'It already had products.') };
        const muestras = [
            { emoji: '🌟', nombre: tx('Nombre dorado', 'Golden name'), rol: tx('✨ Dorado', '✨ Golden'), color: 0xF5B942, precio: 2000, descripcion: tx('Tu nombre en dorado en todo el servidor.', 'Your name in gold across the server.') },
            { emoji: '💜', nombre: tx('Nombre violeta', 'Violet name'), rol: tx('💜 Violeta', '💜 Violet'), color: 0xA855F7, precio: 2000, descripcion: tx('Tu nombre en violeta en todo el servidor.', 'Your name in violet across the server.') },
        ];
        const productos = [];
        for (const [i, m] of muestras.entries()) {
            const rol = guild.roles.cache.find((r) => r.name === m.rol) || await guild.roles.create({ name: m.rol, color: m.color, permissions: [], reason: 'Sokyo: tienda del servidor (setup rápido)' });
            productos.push({ id: `rapido${i + 1}`, nombre: m.nombre, descripcion: m.descripcion, emoji: m.emoji, rolId: rol.id, horas: 0, precio: m.precio, stock: null, activo: true });
        }
        await set({ 'tienda.activo': true, 'tienda.productos': productos });
        return { detalle: tx('2 colores a la venta (🪙 2.000 cada uno). Cámbialos en el panel.', '2 colours for sale (🪙 2,000 each). Change them in the panel.') };
    });

    // Al final, lo que haya quedado suelto (p. ej. el contador) va a su categoría.
    try {
        const doc = await ServidorConfig.findOne({ guildId: guild.id });
        await organizarCanales(guild, doc?.toObject ? doc.toObject() : doc, idioma);
    } catch { /* ordenar es un extra: si falla, el setup ya está hecho */ }
    require('./config.js').invalidateConfig(guild.id);
    return { pasos, creados };
}

// Resumen para Discord (una línea por paso).
const ICONO = { ok: '✅', omitido: '⏭️', error: '❌' };
const NOMBRE_PASO = {
    idioma: ['Idioma del bot', 'Bot language'], staff: ['Rol del staff', 'Staff role'], registro: ['Canal de registro (privado)', 'Log channel (private)'],
    bienvenidas: ['Bienvenidas', 'Welcome messages'], niveles: ['Niveles y XP', 'Levels & XP'], automod: ['Automod básico', 'Basic automod'],
    tickets: ['Tickets', 'Tickets'], temporadas: ['Temporadas', 'Seasons'], cumpleanos: ['Cumpleaños', 'Birthdays'], votos: ['Premios por votar', 'Vote rewards'],
    sugerencias: ['Sugerencias', 'Suggestions'], salon: ['Salón de la fama', 'Hall of fame'], contadores: ['Contador de miembros', 'Member counter'],
    mascota: ['Mascota del servidor', 'Server pet'], casino: ['Casino y cofres', 'Casino & chests'], bromas: ['Bromas', 'Pranks'],
    liga: ['Liga Sokyo', 'Sokyo League'], clanes: ['Clanes', 'Clans'], tienda: ['Tienda del servidor', 'Server shop'],
};
function resumenTexto(idioma, resultado) {
    return resultado.pasos.map((p) => `${ICONO[p.estado]} **${t(idioma, ...NOMBRE_PASO[p.id])}**${p.detalle ? ` · ${p.detalle}` : ''}`).join('\n');
}

module.exports = {
    CATEGORIAS, GRUPO_CANAL, categoriaDe, organizarCanales,
    MODULOS, TIPOS, CANALES, NOMBRES, recomendados, validar, canalesNecesarios, permisosQueFaltan, puedePasar, canalDe, aplicar, resumenTexto, NOMBRE_PASO,
    _reiniciarLimite: () => ultimaPasada.clear(),
};
