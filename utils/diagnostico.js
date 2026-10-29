// Diagnóstico «¿Algo no funciona?» del panel: repasa lo que suele fallar sin
// que nadie lo note (permisos del bot, canales o roles borrados, roles que el bot
// no puede dar, módulos a medio configurar, la música) y dice cómo arreglarlo.
// Algunos problemas se arreglan con un botón (quitar un canal que ya no existe,
// volver a invitar al bot con los permisos que le faltan).
const { PermissionsBitField, ChannelType } = require('discord.js');
const { t } = require('./i18n.js');

const P = PermissionsBitField.Flags;

// Permisos que usa el bot y para qué (si le falta uno, lo que deja de ir).
const PERMISOS = [
    ['ViewChannel', 'Ver canales', 'View channels', 'todo', 'everything'],
    ['SendMessages', 'Enviar mensajes', 'Send messages', 'responder y avisar', 'replying and notices'],
    ['EmbedLinks', 'Insertar enlaces', 'Embed links', 'los mensajes con formato', 'formatted messages'],
    ['AttachFiles', 'Adjuntar archivos', 'Attach files', 'las tarjetas de nivel y las transcripciones', 'level cards and transcripts'],
    ['ReadMessageHistory', 'Leer el historial', 'Read message history', 'los tickets y las encuestas', 'tickets and polls'],
    ['ManageChannels', 'Gestionar canales', 'Manage channels', 'crear tickets y salas de voz', 'creating tickets and voice rooms'],
    ['ManageRoles', 'Gestionar roles', 'Manage roles', 'dar roles (autorol, niveles, verificación)', 'giving roles (autorole, levels, verification)'],
    ['ManageMessages', 'Gestionar mensajes', 'Manage messages', 'que el automod borre mensajes', 'the automod deleting messages'],
    ['ModerateMembers', 'Aislar miembros', 'Timeout members', 'aislar', 'timeouts'],
    ['KickMembers', 'Expulsar miembros', 'Kick members', 'expulsar', 'kicks'],
    ['BanMembers', 'Banear miembros', 'Ban members', 'banear', 'bans'],
    ['ManageGuild', 'Gestionar servidor', 'Manage server', 'contar las invitaciones', 'tracking invites'],
    ['ViewAuditLog', 'Ver el registro de auditoría', 'View audit log', 'saber quién borró o cambió algo en los logs', 'knowing who deleted or changed things in logs'],
    ['Connect', 'Conectar (voz)', 'Connect (voice)', 'la música', 'music'],
    ['Speak', 'Hablar (voz)', 'Speak (voice)', 'la música', 'music'],
    ['MoveMembers', 'Mover miembros', 'Move members', 'las salas de voz temporales', 'temporary voice rooms'],
    ['AddReactions', 'Añadir reacciones', 'Add reactions', 'las reacciones de las sugerencias', 'suggestion reactions'],
];

// Canales y roles que guarda la configuración: [ruta, tipo, pestaña, nombre es, nombre en, ¿solo si…?].
// tipo: 'texto' (un canal donde escribe), 'categoria' o 'rol' / 'rolDar' (un rol que el bot da).
const activo = (ruta) => (cfg) => !!leer(cfg, ruta);
const REFERENCIAS = [
    ['categoriaTicketsId', 'categoria', 'tickets-config', 'la categoría de los tickets', 'the tickets category'],
    ['rolStaffId', 'rol', 'tickets-config', 'el rol del staff de tickets', 'the ticket staff role'],
    ['rolSoporteId', 'rol', 'tickets-config', 'el rol al que se avisa de tickets nuevos', 'the role pinged for new tickets', activo('pingSoporte')],
    ['canalLogsId', 'texto', 'logs-todos', 'el canal de logs', 'the logs channel'],
    ['canalModLogId', 'texto', 'mod-registro', 'el canal del registro de sanciones', 'the sanctions log channel'],
    ['canalNivelesId', 'texto', 'config-niveles', 'el canal de las subidas de nivel', 'the level-up channel', activo('nivelesActivo')],
    ['musica.canalMusicaId', 'texto', 'musica', 'el canal de la música', 'the music channel'],
    ['musica.djRolId', 'rol', 'musica', 'el rol de DJ', 'the DJ role'],
    ['automod.canalAlertasId', 'texto', 'mod-automod', 'el canal de alertas del automod', 'the automod alerts channel', activo('automod.activo')],
    ['automod.cuentasNuevas.asignarRolId', 'rolDar', 'mod-automod', 'el rol de cuarentena', 'the quarantine role', activo('automod.cuentasNuevas.activo')],
    ['verificacion.canalId', 'texto', 'seg-verificacion', 'el canal de verificación', 'the verification channel', activo('verificacion.activo')],
    ['verificacion.rolVerificadoId', 'rolDar', 'seg-verificacion', 'el rol de verificado', 'the verified role', activo('verificacion.activo')],
    ['embudoAB.canalId', 'texto', 'seg-verificacion', 'el canal de la bienvenida guiada', 'the guided welcome channel', activo('embudoAB.activo')],
    ['embudoAB.rolVerificadoId', 'rolDar', 'seg-verificacion', 'el rol de la bienvenida guiada', 'the guided welcome role', activo('embudoAB.activo')],
    ['bienvenida.canalId', 'texto', 'prod-bienvenidas', 'el canal de bienvenidas', 'the welcome channel', activo('bienvenida.activo')],
    ['despedida.canalId', 'texto', 'prod-bienvenidas', 'el canal de despedidas', 'the goodbye channel', activo('despedida.activo')],
    ['reportes.canalId', 'texto', 'mod-reportes', 'el canal de reportes', 'the reports channel', activo('reportes.activo')],
    ['canalSugerencias', 'texto', 'com-sugerencias', 'el canal de sugerencias', 'the suggestions channel'],
    ['presentaciones.canalIntro', 'texto', 'com-presentaciones', 'el canal de presentaciones', 'the intros channel', activo('presentaciones.activo')],
    ['presentaciones.canalStaff', 'texto', 'com-presentaciones', 'el canal del staff de presentaciones', 'the intros staff channel', activo('presentaciones.activo')],
    ['resumenDiario.canalId', 'texto', 'datos-resumen', 'el canal del resumen diario', 'the daily summary channel', activo('resumenDiario.activo')],
    ['vozTemporal.panelCanalId', 'texto', 'voz-temporal', 'el canal del panel de salas de voz', 'the voice rooms panel channel', activo('vozTemporal.activo')],
    ['crecimiento.invitaciones.canalAvisosId', 'texto', 'crec-invitaciones', 'el canal de avisos de invitaciones', 'the invites notice channel', activo('crecimiento.invitaciones.activo')],
    ['crecimiento.bump.canalId', 'texto', 'crec-bump', 'el canal del aviso de bump', 'the bump reminder channel', activo('crecimiento.bump.activo')],
    ['crecimiento.directos.canalId', 'texto', 'crec-directos', 'el canal de avisos de directos', 'the live alerts channel', activo('crecimiento.directos.activo')],
];
// Listas de roles que el bot da: [ruta de la lista, campo del id (o null), pestaña, nombre es, nombre en].
const LISTAS_ROLES = [
    ['autoRoles', null, 'roles-autorol', 'un rol del autorol', 'an autorole role'],
    ['autoRolesBots', null, 'roles-autorol', 'un rol del autorol de bots', 'a bot autorole role'],
    ['recompensasNivel', 'rolId', 'config-niveles', 'un rol de recompensa por nivel', 'a level reward role'],
    ['crecimiento.invitaciones.recompensas', 'rolId', 'crec-invitaciones', 'un rol de recompensa por invitar', 'an invite reward role'],
];

function leer(obj, ruta) {
    return ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function urlInvitar(guildId, permisos) {
    const id = process.env.DISCORD_CLIENT_ID;
    if (!id) return null;
    const p = new URLSearchParams({ client_id: id, scope: 'bot applications.commands', permissions: String(permisos), guild_id: guildId, disable_guild_select: 'true' });
    return `https://discord.com/oauth2/authorize?${p}`;
}

// Todos los permisos que pide el bot (para reinvitarlo con lo que le falte).
const TODOS = PERMISOS.reduce((acc, [k]) => acc | P[k], 0n);

// Devuelve { comprobados, problemas: [{ id, nivel, titulo, detalle, solucion, tab, arreglo }] }.
async function diagnosticar(client, guildId, cfg, idioma) {
    const guild = client.guilds.cache.get(guildId);
    const problemas = [];
    let comprobados = 0;
    const add = (p) => problemas.push(p);
    if (!guild) {
        add({ id: 'sin-servidor', nivel: 'error', titulo: t(idioma, 'El bot no está en este servidor', 'The bot isn’t on this server'), detalle: t(idioma, 'Puede que lo hayan expulsado.', 'It may have been kicked.'), solucion: t(idioma, 'Vuelve a invitarlo.', 'Invite it again.'), tab: null, arreglo: urlInvitar(guildId, TODOS) ? { accion: 'invitar', url: urlInvitar(guildId, TODOS) } : null });
        return { comprobados: 1, problemas };
    }
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const perms = me?.permissions;
    const admin = !!perms?.has(P.Administrator);

    // 1) Permisos generales del bot.
    comprobados++;
    if (!admin && perms) {
        const faltan = PERMISOS.filter(([k]) => !perms.has(P[k]));
        if (faltan.length) {
            add({
                id: 'permisos', nivel: faltan.some(([k]) => ['ViewChannel', 'SendMessages'].includes(k)) ? 'error' : 'aviso',
                titulo: t(idioma, `Al bot le faltan ${faltan.length} permisos`, `The bot is missing ${faltan.length} permissions`),
                detalle: faltan.map(([, es, en, paraEs, paraEn]) => `• ${t(idioma, es, en)} — ${t(idioma, `para ${paraEs}`, `for ${paraEn}`)}`).join('\n'),
                solucion: t(idioma, 'Pulsa «Dar los permisos»: Discord te pedirá confirmarlo y el bot los tendrá al momento. (O dáselos a su rol en Ajustes del servidor → Roles.)', 'Press “Grant permissions”: Discord will ask you to confirm and the bot will have them right away. (Or give them to its role in Server settings → Roles.)'),
                tab: null, arreglo: urlInvitar(guildId, TODOS) ? { accion: 'invitar', url: urlInvitar(guildId, TODOS) } : null,
            });
        }
    }

    // 2) Canales y roles guardados que ya no existen o no se pueden usar.
    const tope = me?.roles?.highest?.position ?? 0;
    const revisarRol = (rolId, ruta, tab, nombreEs, nombreEn, dar, quitar) => {
        comprobados++;
        const rol = guild.roles.cache.get(rolId);
        if (!rol) {
            add({ id: `falta:${ruta}:${rolId}`, nivel: 'error', titulo: t(idioma, `No existe ${nombreEs}`, `${nombreEn[0].toUpperCase()}${nombreEn.slice(1)} no longer exists`), detalle: t(idioma, 'Se borró en Discord, pero la configuración lo sigue usando.', 'It was deleted in Discord, but the settings still use it.'), solucion: t(idioma, 'Quítalo (con el botón) o elige otro en su sección.', 'Remove it (with the button) or pick another one in its section.'), tab, arreglo: quitar });
        } else if (dar && (rol.managed || rol.position >= tope)) {
            add({ id: `alto:${ruta}:${rolId}`, nivel: 'error', titulo: t(idioma, `El bot no puede dar el rol «${rol.name}»`, `The bot can’t give the “${rol.name}” role`), detalle: rol.managed ? t(idioma, 'Es un rol de una integración (otro bot o un booster): nadie puede darlo a mano.', 'It’s an integration role (another bot or boosters): nobody can give it manually.') : t(idioma, `Está por encima del rol del bot (o a su misma altura). Lo usas para ${nombreEs}.`, `It’s above the bot’s role (or at the same height). You use it for ${nombreEn}.`), solucion: rol.managed ? t(idioma, 'Elige otro rol en su sección.', 'Pick another role in its section.') : t(idioma, 'En Discord: Ajustes del servidor → Roles, arrastra el rol de Sokyo por encima de este.', 'In Discord: Server settings → Roles, drag Sokyo’s role above this one.'), tab, arreglo: null });
        }
    };
    for (const [ruta, tipo, tab, es, en, cond] of REFERENCIAS) {
        const id = leer(cfg, ruta);
        if (!id || (cond && !cond(cfg))) continue;
        const quitar = { accion: 'quitar', ruta };
        if (tipo === 'rol' || tipo === 'rolDar') { revisarRol(id, ruta, tab, es, en, tipo === 'rolDar', quitar); continue; }
        comprobados++;
        const canal = guild.channels.cache.get(id);
        if (!canal) {
            add({ id: `falta:${ruta}`, nivel: 'error', titulo: t(idioma, `No existe ${es}`, `${en[0].toUpperCase()}${en.slice(1)} no longer exists`), detalle: t(idioma, 'Se borró en Discord, pero la configuración lo sigue usando.', 'It was deleted in Discord, but the settings still use it.'), solucion: t(idioma, 'Quítalo (con el botón) o elige otro en su sección.', 'Remove it (with the button) or pick another one in its section.'), tab, arreglo: quitar });
            continue;
        }
        const pc = canal.permissionsFor(me);
        if (tipo === 'categoria') {
            if (canal.type !== ChannelType.GuildCategory) continue;
            if (!admin && !pc?.has([P.ViewChannel, P.ManageChannels])) add({ id: `permcanal:${ruta}`, nivel: 'error', titulo: t(idioma, `El bot no puede crear canales en «${canal.name}»`, `The bot can’t create channels in “${canal.name}”`), detalle: t(idioma, `Es ${es}. Sin «Ver canal» y «Gestionar canales» ahí, no se pueden abrir tickets.`, `It’s ${en}. Without “View channel” and “Manage channels” there, tickets can’t be opened.`), solucion: t(idioma, 'En Discord: clic derecho en la categoría → Editar categoría → Permisos, y dale esos dos al rol de Sokyo.', 'In Discord: right-click the category → Edit category → Permissions, and give Sokyo’s role those two.'), tab, arreglo: null });
        } else if (!admin && !pc?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])) {
            add({ id: `permcanal:${ruta}`, nivel: 'error', titulo: t(idioma, `El bot no puede escribir en #${canal.name}`, `The bot can’t write in #${canal.name}`), detalle: t(idioma, `Es ${es}. Necesita «Ver canal», «Enviar mensajes» e «Insertar enlaces» ahí.`, `It’s ${en}. It needs “View channel”, “Send messages” and “Embed links” there.`), solucion: t(idioma, 'En Discord: clic derecho en el canal → Editar canal → Permisos, y dale esos permisos al rol de Sokyo.', 'In Discord: right-click the channel → Edit channel → Permissions, and give Sokyo’s role those permissions.'), tab, arreglo: null });
        }
    }
    for (const [ruta, campo, tab, es, en] of LISTAS_ROLES) {
        const lista = leer(cfg, ruta) || [];
        for (const item of lista) {
            const rolId = campo ? item?.[campo] : item;
            if (rolId) revisarRol(rolId, ruta, tab, es, en, true, { accion: 'quitarDeLista', ruta, campo, valor: rolId });
        }
    }

    // 3) Módulos encendidos pero a medio configurar.
    const medio = (cond, id, tab, es, en, solEs, solEn) => { comprobados++; if (cond) add({ id, nivel: 'aviso', titulo: t(idioma, es, en), detalle: '', solucion: t(idioma, solEs, solEn), tab, arreglo: null }); };
    medio(cfg?.bienvenida?.activo && !cfg?.bienvenida?.canalId, 'medio:bienvenida', 'prod-bienvenidas', 'La bienvenida está encendida pero sin canal', 'Welcomes are on but have no channel', 'Elige en qué canal se da la bienvenida.', 'Choose which channel welcomes go to.');
    medio(cfg?.verificacion?.activo && !cfg?.verificacion?.rolVerificadoId, 'medio:verificacion', 'seg-verificacion', 'La verificación está encendida pero no da ningún rol', 'Verification is on but gives no role', 'Elige el rol que se da al verificarse.', 'Choose the role given on verification.');
    medio(cfg?.reportes?.activo && !cfg?.reportes?.canalId, 'medio:reportes', 'mod-reportes', 'Los reportes están encendidos pero no llegan a ningún canal', 'Reports are on but go to no channel', 'Elige el canal del staff donde llegan.', 'Choose the staff channel where they arrive.');
    medio(cfg?.presentaciones?.activo && !cfg?.presentaciones?.canalIntro, 'medio:presentaciones', 'com-presentaciones', 'Las presentaciones están encendidas pero sin canal', 'Intros are on but have no channel', 'Elige el canal donde se presenta la gente.', 'Choose the channel where people introduce themselves.');
    medio(cfg?.crecimiento?.directos?.activo && !cfg?.crecimiento?.directos?.canalId, 'medio:directos', 'crec-directos', 'Los avisos de directos están encendidos pero sin canal', 'Live alerts are on but have no channel', 'Elige dónde avisar de los directos.', 'Choose where to post live alerts.');
    medio(!cfg?.rolStaffId, 'medio:staff', 'tickets-config', 'Los tickets no tienen rol de staff', 'Tickets have no staff role', 'Elige qué rol atiende los tickets (si no, solo los que pueden «Gestionar canales»).', 'Choose which role handles tickets (otherwise, only those who can “Manage channels”).');

    // 4) La música (el servidor de música lo pone en marcha el dueño del bot).
    comprobados++;
    try {
        const { estadoServidorMusica } = require('./musica.js');
        const m = estadoServidorMusica();
        if (cfg?.musica?.activo !== false && client.lavalink) {
            if (!m.conectado) add({ id: 'musica:apagada', nivel: 'aviso', titulo: t(idioma, 'El servidor de música no está conectado', 'The music server isn’t connected'), detalle: t(idioma, 'La música no sonará hasta que vuelva.', 'Music won’t play until it’s back.'), solucion: t(idioma, 'No depende de ti: avisa al dueño del bot (suele volver solo en unos minutos).', 'Not up to you: tell the bot owner (it usually comes back on its own in a few minutes).'), tab: 'musica', arreglo: null });
            else if (m.desactualizado || m.vozRechazada) add({ id: 'musica:vieja', nivel: 'aviso', titulo: t(idioma, 'Discord está rechazando el audio', 'Discord is rejecting the audio'), detalle: t(idioma, 'El servidor de música necesita actualizarse (audio cifrado de Discord).', 'The music server needs an update (Discord’s encrypted audio).'), solucion: t(idioma, 'Avisa al dueño del bot.', 'Tell the bot owner.'), tab: 'musica', arreglo: null });
        }
    } catch { /* sin música en este proceso */ }

    // 5) El rol del bot muy abajo: no podrá dar casi ningún rol.
    comprobados++;
    const rolesNormales = guild.roles.cache.filter((r) => !r.managed && r.id !== guild.id).size;
    if (!admin && rolesNormales >= 3 && tope <= 1) {
        add({ id: 'rol-bajo', nivel: 'aviso', titulo: t(idioma, 'El rol del bot está abajo del todo', 'The bot’s role is at the very bottom'), detalle: t(idioma, 'Solo puede dar o quitar roles que estén por debajo del suyo.', 'It can only give or remove roles below its own.'), solucion: t(idioma, 'En Discord: Ajustes del servidor → Roles, arrastra «Sokyo» hacia arriba (por encima de los roles que deba dar).', 'In Discord: Server settings → Roles, drag “Sokyo” up (above the roles it should give).'), tab: 'roles-gestion', arreglo: null });
    }

    const orden = { error: 0, aviso: 1 };
    problemas.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
    return { comprobados, problemas };
}

// Arreglos con un botón: quitar de la configuración algo que ya no existe.
async function arreglar(guildId, arreglo) {
    const ServidorConfig = require('../models/ServidorConfig.js');
    const rutasValidas = new Set([...REFERENCIAS.map((r) => r[0]), ...LISTAS_ROLES.map((r) => r[0])]);
    if (!arreglo || !rutasValidas.has(arreglo.ruta)) return { ok: false };
    if (arreglo.accion === 'quitar') {
        await ServidorConfig.updateOne({ guildId }, { $set: { [arreglo.ruta]: null } });
        return { ok: true };
    }
    if (arreglo.accion === 'quitarDeLista' && typeof arreglo.valor === 'string') {
        const lista = LISTAS_ROLES.find((r) => r[0] === arreglo.ruta);
        const pull = lista[1] ? { [arreglo.ruta]: { [lista[1]]: arreglo.valor } } : { [arreglo.ruta]: arreglo.valor };
        await ServidorConfig.updateOne({ guildId }, { $pull: pull });
        return { ok: true };
    }
    return { ok: false };
}

module.exports = { diagnosticar, arreglar, PERMISOS, REFERENCIAS, urlInvitar };
