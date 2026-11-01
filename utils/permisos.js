// Sistema de permisos del panel y de los comandos del bot.
//
// IDEA CLAVE: el panel web nunca "inventa" poderes de moderación.
//   · Permisos de MODERACIÓN (warn/mute/kick/ban…): salen SOLO de los permisos nativos de Discord
//     del miembro. Si no tiene "Banear miembros" en Discord, no puede banear desde el panel. Punto.
//   · Resto de permisos (tickets, métricas, config…): se heredan de permisos nativos razonables
//     (p. ej. "Gestionar canales" => gestionar tickets) y se pueden AMPLIAR por rol desde el panel.
//
// Este módulo es puro (sin discord.js) para poder testearlo fácilmente. Los "member" que recibe
// solo necesitan: id, permissions.has(nombreFlag), roles.cache (Map/Collection id -> {id,name}),
// y opcionalmente guild.ownerId.

const GRUPOS = [
    { id: 'tickets',    nombre: 'Tickets',       icono: '🎫', color: '#5865F2' },
    { id: 'moderacion', nombre: 'Moderación',    icono: '🔨', color: '#ed4245' },
    { id: 'analisis',   nombre: 'Análisis',      icono: '📊', color: '#3ba55d' },
    { id: 'comunidad',  nombre: 'Comunidad',     icono: '🌱', color: '#faa61a' },
    { id: 'config',     nombre: 'Configuración', icono: '⚙️', color: '#eb459e' }
];

// soloDiscord: true  => NO se puede conceder desde el panel; depende 100% de los permisos de Discord.
// nativos: lista "cualquiera de" de flags de Discord que otorgan el permiso.
const PERMISOS = [
    // ---- Tickets ----
    { id: 'tickets.ver',        grupo: 'tickets', icono: '👁️', nombre: 'Ver tickets',          desc: 'Ver el listado de tickets y leer las conversaciones.' },
    { id: 'tickets.responder',  grupo: 'tickets', icono: '💬', nombre: 'Responder',             desc: 'Escribir en los tickets desde el panel.' },
    { id: 'tickets.reclamar',   grupo: 'tickets', icono: '🙋', nombre: 'Reclamar / soltar',     desc: 'Hacerse cargo de un ticket libre o soltar uno propio.' },
    { id: 'tickets.reasignar',  grupo: 'tickets', icono: '🔁', nombre: 'Reasignar',             desc: 'Soltar tickets que atiende otra persona.' },
    { id: 'tickets.notas',      grupo: 'tickets', icono: '🕵️', nombre: 'Notas internas',        desc: 'Escribir apuntes privados visibles solo para el staff.' },
    { id: 'tickets.macros',     grupo: 'tickets', icono: '⚡', nombre: 'Respuestas rápidas',    desc: 'Usar plantillas de respuesta en los tickets.' },
    { id: 'tickets.cerrar',     grupo: 'tickets', icono: '🔒', nombre: 'Cerrar tickets',        desc: 'Cerrar y archivar tickets (envía transcripción y encuesta).' },
    { id: 'tickets.reabrir',    grupo: 'tickets', icono: '🔓', nombre: 'Reabrir tickets',       desc: 'Reabrir tickets archivados.' },
    { id: 'tickets.ocultar',    grupo: 'tickets', icono: '🗑️', nombre: 'Ocultar del panel',     desc: 'Retirar tickets del panel web.' },
    { id: 'tickets.exportar',   grupo: 'tickets', icono: '📥', nombre: 'Exportar',              desc: 'Descargar tickets en CSV y transcripciones.' },

    // ---- Moderación (solo Discord) ----
    { id: 'mod.historial', grupo: 'moderacion', icono: '📜', nombre: 'Ver sanciones', desc: 'Consultar el historial de sanciones de un usuario.', soloDiscord: true, nativos: ['ModerateMembers', 'KickMembers', 'BanMembers'], nativosNombre: 'Moderar, Expulsar o Banear miembros' },
    { id: 'mod.warn',      grupo: 'moderacion', icono: '⚠️', nombre: 'Avisar (warn)', desc: 'Registrar una advertencia a un usuario.',            soloDiscord: true, nativos: ['ModerateMembers', 'KickMembers', 'BanMembers'], nativosNombre: 'Moderar, Expulsar o Banear miembros' },
    { id: 'mod.mute',      grupo: 'moderacion', icono: '🔇', nombre: 'Silenciar',     desc: 'Aplicar y quitar aislamientos temporales (timeout).', soloDiscord: true, nativos: ['ModerateMembers'], nativosNombre: 'Aislar temporalmente a miembros' },
    { id: 'mod.kick',      grupo: 'moderacion', icono: '👢', nombre: 'Expulsar',      desc: 'Expulsar a un miembro del servidor.',                 soloDiscord: true, nativos: ['KickMembers'],     nativosNombre: 'Expulsar miembros' },
    { id: 'mod.ban',       grupo: 'moderacion', icono: '🔨', nombre: 'Banear',        desc: 'Banear y desbanear usuarios.',                        soloDiscord: true, nativos: ['BanMembers'],      nativosNombre: 'Banear miembros' },

    // ---- Análisis ----
    { id: 'metricas.ver', grupo: 'analisis', icono: '📈', nombre: 'Métricas del staff',   desc: 'Tiempos de respuesta, valoraciones y ranking del equipo.' },
    { id: 'usuarios.ver', grupo: 'analisis', icono: '👥', nombre: 'Registro de usuarios', desc: 'Estadísticas de tickets por usuario.' },
    { id: 'logs.ver',     grupo: 'analisis', icono: '📜', nombre: 'Logs de auditoría',    desc: 'Ver el registro de eventos del servidor y del panel.' },

    // ---- Comunidad ----
    { id: 'comunidad.sugerencias', grupo: 'comunidad', icono: '💡', nombre: 'Resolver sugerencias', desc: 'Aprobar o rechazar sugerencias de la comunidad.' },

    // ---- Configuración ----
    { id: 'config.tickets',        grupo: 'config', icono: '🛠️', nombre: 'Ajustes de incidencias', desc: 'Motivos, urgencias y límites de tickets.' },
    { id: 'config.textos',         grupo: 'config', icono: '📝', nombre: 'Textos del bot',         desc: 'Marca blanca: títulos y descripciones del panel de soporte.' },
    { id: 'config.contenido',      grupo: 'config', icono: '📚', nombre: 'Respuestas y FAQ',       desc: 'Crear y editar respuestas rápidas y artículos de ayuda.' },
    { id: 'config.automatizacion', grupo: 'config', icono: '🤖', nombre: 'Automatización',         desc: 'Cierre por inactividad y recordatorios de SLA.' },
    { id: 'config.automod',        grupo: 'config', icono: '🛡️', nombre: 'AutoMod',                desc: 'Antispam y antienlaces.' },
    { id: 'config.comunidad',      grupo: 'config', icono: '🌱', nombre: 'Comunidad',              desc: 'Auto-roles, verificación, niveles y sugerencias.' },
    { id: 'config.permisos',       grupo: 'config', icono: '🔐', nombre: 'Permisos del panel',     desc: 'Decidir qué roles acceden a cada apartado. Solo puedes dar permisos que tú mismo tienes.' }
];

const TODOS = PERMISOS.map(p => p.id);
const POR_ID = Object.fromEntries(PERMISOS.map(p => [p.id, p]));
const SOLO_DISCORD = new Set(PERMISOS.filter(p => p.soloDiscord).map(p => p.id));
const CONCEDIBLES = PERMISOS.filter(p => !p.soloDiscord).map(p => p.id);

const delGrupo = (g) => PERMISOS.filter(p => p.grupo === g).map(p => p.id);
const TICKETS = delGrupo('tickets');
const ANALISIS = delGrupo('analisis');
const CONFIG_SIN_PERMISOS = delGrupo('config').filter(id => id !== 'config.permisos');

// Qué permisos del panel (no de moderación) concede cada flag nativo de Discord por defecto.
const HEREDADOS = {
    Administrator:  CONCEDIBLES,
    ManageGuild:    [...TICKETS, ...ANALISIS, 'comunidad.sugerencias', ...CONFIG_SIN_PERMISOS],
    ManageChannels: [...TICKETS.filter(id => id !== 'tickets.ocultar'), 'usuarios.ver'],
    ManageMessages: ['tickets.ver', 'tickets.responder', 'tickets.reclamar', 'tickets.notas', 'tickets.macros', 'comunidad.sugerencias']
};
const NOMBRE_FLAG = {
    Administrator: 'Administrador',
    ManageGuild: 'Gestionar servidor',
    ManageChannels: 'Gestionar canales',
    ManageMessages: 'Gestionar mensajes',
    ModerateMembers: 'Aislar temporalmente a miembros',
    KickMembers: 'Expulsar miembros',
    BanMembers: 'Banear miembros'
};

// Secciones del panel y qué permiso(s) hacen falta (cualquiera de la lista) para entrar.
const SECCIONES = [
    { id: 'tickets-gestion',     icono: '📋', nombre: 'Gestión de tickets',     requiere: ['tickets.ver'] },
    { id: 'tickets-usuarios',    icono: '👥', nombre: 'Registro de usuarios',   requiere: ['usuarios.ver'] },
    { id: 'metricas',            icono: '📈', nombre: 'Métricas del staff',     requiere: ['metricas.ver'] },
    { id: 'moderacion',          icono: '🔨', nombre: 'Moderación',             requiere: ['mod.historial', 'mod.warn', 'mod.mute', 'mod.kick', 'mod.ban'] },
    { id: 'logs',                icono: '📜', nombre: 'Logs de auditoría',      requiere: ['logs.ver'] },
    { id: 'tickets-config',      icono: '🛠️', nombre: 'Ajustes de incidencias', requiere: ['config.tickets'] },
    { id: 'config-textos',       icono: '📝', nombre: 'Textos del bot',         requiere: ['config.textos'] },
    { id: 'contenido',           icono: '📚', nombre: 'Respuestas y FAQ',       requiere: ['config.contenido'] },
    { id: 'automatizacion',      icono: '🤖', nombre: 'Automatización',         requiere: ['config.automatizacion'] },
    { id: 'automod',             icono: '🛡️', nombre: 'AutoMod',                requiere: ['config.automod'] },
    { id: 'comunidad',           icono: '🌱', nombre: 'Comunidad',              requiere: ['config.comunidad'] },
    { id: 'permisos-admin',      icono: '🔐', nombre: 'Roles y permisos',       requiere: ['config.permisos'] }
];

// Devuelve un Set con los permisos que concede una función `has(flag)` (permisos nativos de un miembro o rol).
function heredados(has) {
    const set = new Set();
    for (const [flag, perms] of Object.entries(HEREDADOS)) if (has(flag)) perms.forEach(p => set.add(p));
    for (const p of PERMISOS) if (p.soloDiscord && p.nativos.some(f => has(f))) set.add(p.id);
    return set;
}

// Fuente legible de un permiso heredado de un flag concreto (para la UI).
function flagsQueLoDan(permisoId, has) {
    const out = [];
    const def = POR_ID[permisoId];
    if (def?.soloDiscord) {
        for (const f of def.nativos) if (has(f)) out.push(f);
        return out;
    }
    for (const [flag, perms] of Object.entries(HEREDADOS)) if (perms.includes(permisoId) && has(flag)) out.push(flag);
    return out;
}

// Texto corto para mostrar de dónde viene un permiso: el Administrador lo resume todo; si hay muchos, "A, B y 2 más".
function resumenFlags(flags) {
    if (flags.includes('Administrator')) return NOMBRE_FLAG.Administrator;
    const nombres = flags.map(f => NOMBRE_FLAG[f] || f);
    if (nombres.length === 0) return 'Permisos de Discord';
    return nombres.length <= 2 ? nombres.join(', ') : `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más`;
}

function concesionesDeRol(config, rolId) {
    const entrada = (config?.rolesPermisos || []).find(r => r.rolId === rolId);
    return (entrada?.permisos || []).filter(p => CONCEDIBLES.includes(p));
}

// Calcula los permisos efectivos de un miembro de un servidor.
// Devuelve { permisos:Set, fuentes:{permisoId:[{tipo,...}]}, rango }.
function calcularPermisos(member, config) {
    const fuentes = {};
    const add = (id, fuente) => { (fuentes[id] ||= []).push(fuente); };
    if (!member) return { permisos: new Set(), fuentes, rango: 'Sin acceso' };

    const has = (flag) => { try { return !!member.permissions?.has(flag); } catch { return false; } };
    const esDueno = !!member.guild?.ownerId && member.guild.ownerId === member.id;

    if (esDueno) {
        TODOS.forEach(id => add(id, { tipo: 'dueno', detalle: 'Propietario del servidor' }));
    } else {
        // 1) Heredados de los permisos nativos del miembro (incluye los de todos sus roles).
        for (const id of heredados(has)) {
            add(id, { tipo: 'discord', detalle: resumenFlags(flagsQueLoDan(id, has)) });
        }
        // 2) Concedidos desde el panel por rol (solo permisos no-moderación).
        const roles = member.roles?.cache ? Array.from(member.roles.cache.values()) : [];
        for (const rol of roles) {
            for (const id of concesionesDeRol(config, rol.id)) add(id, { tipo: 'rol', rolId: rol.id, detalle: `Rol @${rol.name}` });
        }
    }

    const permisos = new Set(Object.keys(fuentes));
    let rango = 'Sin acceso';
    if (esDueno) rango = 'Propietario';
    else if (has('Administrator')) rango = 'Administrador';
    else if (permisos.has('config.permisos') || CONFIG_SIN_PERMISOS.filter(p => permisos.has(p)).length >= 4) rango = 'Gestor';
    else if (['mod.ban', 'mod.kick', 'mod.mute', 'mod.warn'].some(p => permisos.has(p))) rango = 'Moderador';
    else if (permisos.size > 0) rango = 'Soporte';

    return { permisos, fuentes, rango };
}

const tienePermiso = (calculo, id) => calculo.permisos.has(id);
const tieneAlguno = (calculo, ids) => ids.some(id => calculo.permisos.has(id));

// Filtra una lista pedida de permisos para guardarla en un rol:
//  - solo ids válidos y concedibles (jamás moderación),
//  - anti-escalada: solo puedes dar permisos que tú tienes.
function sanitizarConcesion(pedidos, permisosActor) {
    const limpios = [...new Set((Array.isArray(pedidos) ? pedidos : []).filter(p => CONCEDIBLES.includes(p)))];
    const permitidos = limpios.filter(p => permisosActor.has(p));
    const rechazados = limpios.filter(p => !permisosActor.has(p));
    return { permitidos, rechazados };
}

module.exports = {
    GRUPOS, PERMISOS, TODOS, CONCEDIBLES, SOLO_DISCORD, SECCIONES, HEREDADOS, NOMBRE_FLAG,
    heredados, flagsQueLoDan, resumenFlags, concesionesDeRol, calcularPermisos, tienePermiso, tieneAlguno, sanitizarConcesion
};
