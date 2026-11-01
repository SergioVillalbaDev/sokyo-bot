// Moderación centralizada. La usan los comandos "/" y la API del panel, así que las reglas
// (permisos, jerarquía de roles, auditoría) son EXACTAMENTE las mismas en los dos sitios.
const { EmbedBuilder } = require('discord.js');
const Sancion = require('../models/Sancion.js');
const Log = require('../models/Log.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { calcularPermisos } = require('./permisos.js');
const { formatDuracion } = require('./helpers.js');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // límite de Discord
const PERMISO_POR_TIPO = { warn: 'mod.warn', mute: 'mod.mute', unmute: 'mod.mute', kick: 'mod.kick', ban: 'mod.ban', unban: 'mod.ban' };
const META = {
    warn:   { emoji: '⚠️', texto: 'Aviso',        color: '#f1c40f' },
    mute:   { emoji: '🔇', texto: 'Silenciado',   color: '#e67e22' },
    unmute: { emoji: '🔊', texto: 'Silencio retirado', color: '#2ecc71' },
    kick:   { emoji: '👢', texto: 'Expulsado',    color: '#e67e22' },
    ban:    { emoji: '🔨', texto: 'Baneado',      color: '#e74c3c' },
    unban:  { emoji: '🕊️', texto: 'Desbaneado',   color: '#2ecc71' }
};

async function registrar({ guild, tipo, objetivo, razon, moderadorId, moderadorNombre, origen, duracionMs }) {
    await Sancion.create({
        guildId: guild.id,
        usuarioId: objetivo.id,
        usuarioNombre: objetivo.username || objetivo.user?.username || 'Desconocido',
        tipo, razon, moderadorId, moderadorNombre, origen, duracionMs: duracionMs ?? null
    });
    const m = META[tipo];
    await Log.create({
        guildId: guild.id,
        categoria: 'Moderación',
        accion: `${m.emoji} ${m.texto}`,
        usuario: moderadorNombre,
        detalles: `Objetivo: ${objetivo.username || objetivo.user?.username || objetivo.id} (${objetivo.id})\nRazón: ${razon}${duracionMs ? `\nDuración: ${formatDuracion(duracionMs)}` : ''}\nOrigen: ${origen}`,
        color: m.color
    }).catch(() => {});
}

async function avisarPorMd(user, guild, tipo, razon, duracionMs) {
    const m = META[tipo];
    const embed = new EmbedBuilder()
        .setColor(m.color)
        .setTitle(`${m.emoji} ${m.texto} en ${guild.name}`)
        .addFields({ name: 'Razón', value: razon.slice(0, 1000) });
    if (duracionMs) embed.addFields({ name: 'Duración', value: formatDuracion(duracionMs) });
    await user.send({ embeds: [embed] }).catch(() => {});
}

// Ejecuta una sanción en nombre de `actorMember` (GuildMember). Devuelve { ok, error? , sancion? }.
async function ejecutarSancion(client, { guildId, tipo, actorMember, objetivoId, razon, duracionMs, origen = 'discord', diasBorrar = 0 }) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return { ok: false, error: 'El bot no está en ese servidor.' };
    if (!PERMISO_POR_TIPO[tipo]) return { ok: false, error: 'Acción de moderación desconocida.' };
    if (!actorMember) return { ok: false, error: 'No se pudo identificar a quien ejecuta la acción en este servidor.' };

    // 1) PERMISOS: salen de los permisos nativos de Discord del moderador (nunca del panel).
    const config = await ServidorConfig.findOne({ guildId });
    const calculo = calcularPermisos(actorMember, config);
    if (!calculo.permisos.has(PERMISO_POR_TIPO[tipo])) {
        return { ok: false, error: `No tienes permiso para esta acción. Necesitas el permiso de Discord correspondiente (${PERMISO_POR_TIPO[tipo]}).` };
    }

    razon = (razon || 'Sin razón especificada').toString().slice(0, 400);
    if (objetivoId === actorMember.id) return { ok: false, error: 'No puedes sancionarte a ti mismo.' };
    if (objetivoId === client.user.id) return { ok: false, error: 'No puedo sancionarme a mí mismo.' };
    if (objetivoId === guild.ownerId) return { ok: false, error: 'No se puede sancionar al propietario del servidor.' };

    const actorNombre = actorMember.user?.username || 'Desconocido';
    const razonAudit = `${razon} | por ${actorNombre}${origen === 'panel' ? ' (panel web)' : ''}`;
    const objetivoMember = await guild.members.fetch(objetivoId).catch(() => null);

    // 2) JERARQUÍA: no puedes sancionar a alguien con rol igual o superior al tuyo (salvo el propietario).
    if (objetivoMember && guild.ownerId !== actorMember.id) {
        if (objetivoMember.roles.highest.position >= actorMember.roles.highest.position) {
            return { ok: false, error: 'No puedes sancionar a alguien con un rol igual o superior al tuyo.' };
        }
    }

    try {
        let objetivoUser = objetivoMember?.user || null;
        switch (tipo) {
            case 'warn':
                if (!objetivoMember) return { ok: false, error: 'Ese usuario no está en el servidor.' };
                await avisarPorMd(objetivoMember.user, guild, 'warn', razon);
                break;
            case 'mute': {
                if (!objetivoMember) return { ok: false, error: 'Ese usuario no está en el servidor.' };
                if (!duracionMs || duracionMs < 1000) return { ok: false, error: 'Indica una duración válida (p. ej. 10m, 2h, 1d).' };
                if (duracionMs > MAX_TIMEOUT_MS) return { ok: false, error: 'Discord solo permite silenciar hasta 28 días.' };
                if (!objetivoMember.moderatable) return { ok: false, error: 'No puedo silenciar a ese usuario (jerarquía del bot o permisos).' };
                await objetivoMember.timeout(duracionMs, razonAudit);
                await avisarPorMd(objetivoMember.user, guild, 'mute', razon, duracionMs);
                break;
            }
            case 'unmute':
                if (!objetivoMember) return { ok: false, error: 'Ese usuario no está en el servidor.' };
                await objetivoMember.timeout(null, razonAudit);
                break;
            case 'kick':
                if (!objetivoMember) return { ok: false, error: 'Ese usuario no está en el servidor.' };
                if (!objetivoMember.kickable) return { ok: false, error: 'No puedo expulsar a ese usuario (jerarquía del bot o permisos).' };
                await avisarPorMd(objetivoMember.user, guild, 'kick', razon);
                await objetivoMember.kick(razonAudit);
                break;
            case 'ban':
                if (objetivoMember && !objetivoMember.bannable) return { ok: false, error: 'No puedo banear a ese usuario (jerarquía del bot o permisos).' };
                if (objetivoMember) await avisarPorMd(objetivoMember.user, guild, 'ban', razon);
                if (!objetivoUser) objetivoUser = await client.users.fetch(objetivoId).catch(() => null);
                await guild.members.ban(objetivoId, { reason: razonAudit, deleteMessageSeconds: Math.min(7, Math.max(0, Number(diasBorrar) || 0)) * 86400 });
                break;
            case 'unban':
                objetivoUser = await client.users.fetch(objetivoId).catch(() => null);
                await guild.bans.remove(objetivoId, razonAudit);
                break;
        }
        await registrar({
            guild, tipo, razon,
            objetivo: objetivoUser || { id: objetivoId, username: objetivoId },
            moderadorId: actorMember.id, moderadorNombre: actorNombre, origen, duracionMs
        });
        return { ok: true, tipo, objetivo: objetivoUser?.username || objetivoId };
    } catch (error) {
        console.error(`Error ejecutando ${tipo}:`, error);
        return { ok: false, error: error?.code === 10026 ? 'Ese usuario no está baneado.' : 'Discord rechazó la acción (¿IDs o permisos del bot incorrectos?).' };
    }
}

// Sanción interna del AutoMod (no la dispara un humano, por eso no pasa por la comprobación de permisos).
async function sancionAutomatica(guild, member, { tipo = 'mute', razon, duracionMs }) {
    try {
        if (tipo === 'mute' && member.moderatable) await member.timeout(duracionMs, `AutoMod: ${razon}`);
        await registrar({ guild, tipo, razon, objetivo: member.user, moderadorId: guild.client.user.id, moderadorNombre: 'AutoMod', origen: 'automod', duracionMs });
        return true;
    } catch (e) { console.error('Error en sanción automática:', e); return false; }
}

async function listarSanciones(guildId, usuarioId, limite = 25) {
    const filtro = { guildId };
    if (usuarioId) filtro.usuarioId = usuarioId;
    return Sancion.find(filtro).sort({ fecha: -1 }).limit(limite);
}

module.exports = { ejecutarSancion, sancionAutomatica, listarSanciones, META, MAX_TIMEOUT_MS, PERMISO_POR_TIPO };
