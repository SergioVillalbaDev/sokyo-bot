// ============================================================================
// moderationManager — toda la lógica de moderación del Centro de Mando.
// Aplica la acción en Discord (aviso/timeout/expulsión/ban), guarda el registro
// completo, avisa por DM al usuario, lo publica en el canal de mod-logs y
// gestiona la expiración automática de los bans temporales.
// ============================================================================
const { EmbedBuilder } = require('discord.js');
const Sancion = require('../models/Sancion.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { enviarWebhook } = require('./webhooks.js');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // límite nativo de Discord: 28 días

const META = {
    aviso: { etiqueta: 'Aviso', color: 0xf1c40f, emoji: '⚠️' },
    timeout: { etiqueta: 'Aislamiento', color: 0xe67e22, emoji: '🔇' },
    expulsion: { etiqueta: 'Expulsión', color: 0xe74c3c, emoji: '👢' },
    ban: { etiqueta: 'Ban', color: 0x992d22, emoji: '🔨' },
};

// Texto legible de la duración (para DMs y logs).
function duracionTexto(min) {
    if (!min || min <= 0) return 'permanente';
    if (min < 60) return `${min} min`;
    if (min < 1440) return `${Math.round(min / 60)} h`;
    return `${Math.round(min / 1440)} días`;
}

// Aplica una sanción completa. `tipo` puede ser un TipoSancion o un objeto suelto.
// Devuelve el documento Sancion creado.
async function aplicarSancion(client, { guildId, usuarioId, tipo, motivo = '', pruebas = [], moderador = null }) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Servidor no encontrado');

    const member = await guild.members.fetch(usuarioId).catch(() => null);
    const usuario = member ? member.user : await client.users.fetch(usuarioId).catch(() => null);
    if (!usuario) throw new Error('Usuario no encontrado');

    // Protecciones de jerarquía/seguridad.
    if (usuarioId === guild.ownerId) throw new Error('No se puede sancionar al dueño del servidor');
    if (member && !member.manageable && tipo.accion !== 'aviso') {
        throw new Error('El bot no puede sancionar a este usuario (jerarquía de roles)');
    }

    const expiraEn = tipo.duracionMin > 0 ? new Date(Date.now() + tipo.duracionMin * 60000) : null;

    // Aviso por DM (configurable). ANTES de expulsar/banear, que después ya no se puede contactar.
    const cfg = await ServidorConfig.findOne({ guildId });
    if (cfg?.dmSancion !== false) {
        await enviarDM(guild, usuario, tipo, motivo).catch(() => {});
    }

    // Acción en Discord.
    if (tipo.accion === 'timeout') {
        if (!member) throw new Error('El usuario no está en el servidor');
        const ms = Math.min((tipo.duracionMin || 0) * 60000 || 60000, MAX_TIMEOUT_MS);
        await member.timeout(ms, motivo || tipo.nombre);
    } else if (tipo.accion === 'expulsion') {
        if (!member) throw new Error('El usuario no está en el servidor');
        await member.kick(motivo || tipo.nombre);
    } else if (tipo.accion === 'ban') {
        await guild.members.ban(usuarioId, {
            reason: motivo || tipo.nombre,
            deleteMessageSeconds: Math.min((tipo.borrarMensajesHoras || 0) * 3600, 604800),
        });
    }
    // 'aviso' no hace nada en Discord: solo registro + DM.

    const sancion = await Sancion.create({
        guildId,
        usuarioId,
        usuarioTag: usuario.username,
        usuarioAvatar: usuario.displayAvatarURL?.({ size: 64 }) || null,
        moderadorId: moderador?.id || null,
        moderadorTag: moderador?.tag || 'Panel Web',
        tipoNombre: tipo.nombre || META[tipo.accion]?.etiqueta,
        accion: tipo.accion,
        motivo,
        duracionMin: tipo.duracionMin || 0,
        pruebas: Array.isArray(pruebas) ? pruebas.slice(0, 10) : [],
        expiraEn,
        activa: tipo.accion === 'ban', // los bans quedan "activos" para poder revocarlos / expirarlos
    });

    await registrarEnCanal(client, guild, sancion).catch(() => {});

    // Webhook saliente (Pro): avisa a un endpoint externo de la sanción.
    const meta = META[sancion.accion] || META.aviso;
    enviarWebhook(cfg, 'sancion', {
        text: `${meta.emoji} ${meta.etiqueta}: ${sancion.usuarioTag} (${sancion.usuarioId})${motivo ? ` — ${motivo}` : ''}`,
        data: {
            usuarioId: sancion.usuarioId, usuarioTag: sancion.usuarioTag, accion: sancion.accion,
            motivo, duracionMin: sancion.duracionMin, moderador: sancion.moderadorTag, sancionId: String(sancion._id),
        },
    }).catch(() => {});

    return sancion;
}

// Aplica la MISMA sanción a varios usuarios a la vez (limpieza de raids, oleadas
// de spam, etc.). Reutiliza aplicarSancion por cada uno, así cada acción queda
// registrada por separado en el historial (auditoría completa). No se corta al
// primer fallo: devuelve el resumen de aplicadas y fallidas.
async function aplicarSancionMasiva(client, { guildId, usuarioIds = [], tipo, motivo = '', moderador = null }) {
    const unicos = [...new Set((usuarioIds || []).map((s) => String(s).trim()).filter(Boolean))];
    const aplicadas = [];
    const fallidas = [];
    for (const usuarioId of unicos) {
        try {
            const s = await aplicarSancion(client, { guildId, usuarioId, tipo, motivo, moderador });
            aplicadas.push({ usuarioId, sancionId: String(s._id) });
        } catch (e) {
            fallidas.push({ usuarioId, error: e.message || 'Error' });
        }
    }
    return { aplicadas, fallidas, total: unicos.length };
}

// Revoca una sanción: quita el ban / levanta el timeout y marca el registro.
async function revocarSancion(client, sancionId, moderador = null) {
    const s = await Sancion.findById(sancionId);
    if (!s) throw new Error('Sanción no encontrada');
    if (s.revocada) throw new Error('Esta sanción ya fue revocada');

    const guild = client.guilds.cache.get(s.guildId);
    if (guild) {
        if (s.accion === 'ban') {
            await guild.members.unban(s.usuarioId, `Revocada por ${moderador?.tag || 'Panel Web'}`).catch(() => {});
        } else if (s.accion === 'timeout') {
            const m = await guild.members.fetch(s.usuarioId).catch(() => null);
            if (m) await m.timeout(null).catch(() => {});
        }
    }

    s.activa = false;
    s.revocada = true;
    s.revocadaPor = moderador?.tag || 'Panel Web';
    s.revocadaFecha = new Date();
    await s.save();
    return s;
}

// Barredor: desbanea los bans temporales que ya expiraron. Lo llama ready.js.
async function barrerSancionesVencidas(client) {
    const vencidas = await Sancion.find({ accion: 'ban', activa: true, expiraEn: { $ne: null, $lte: new Date() } }).limit(50);
    for (const s of vencidas) {
        try {
            const guild = client.guilds.cache.get(s.guildId);
            if (guild) await guild.members.unban(s.usuarioId, 'Ban temporal expirado').catch(() => {});
        } catch (e) { console.error('Error desbaneando (expiración):', e.message); }
        s.activa = false;
        await s.save();
    }
}

// --- Helpers ---

async function enviarDM(guild, usuario, tipo, motivo) {
    const meta = META[tipo.accion] || META.aviso;
    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setTitle(`${meta.emoji} Has recibido una sanción en ${guild.name}`)
        .addFields(
            { name: 'Tipo', value: tipo.nombre || meta.etiqueta, inline: true },
            { name: 'Acción', value: meta.etiqueta, inline: true },
            ...(tipo.duracionMin ? [{ name: 'Duración', value: duracionTexto(tipo.duracionMin), inline: true }] : []),
            { name: 'Motivo', value: motivo || '_Sin motivo especificado_' },
        )
        .setTimestamp();
    await usuario.send({ embeds: [embed] });
}

async function registrarEnCanal(client, guild, sancion) {
    const cfg = await ServidorConfig.findOne({ guildId: guild.id });
    if (!cfg?.canalModLogId) return;
    const canal = guild.channels.cache.get(cfg.canalModLogId);
    if (!canal) return;

    const meta = META[sancion.accion] || META.aviso;
    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setAuthor({ name: `${meta.emoji} ${meta.etiqueta} · ${sancion.tipoNombre || ''}`.trim() })
        .setThumbnail(sancion.usuarioAvatar || null)
        .addFields(
            { name: 'Usuario', value: `<@${sancion.usuarioId}> (\`${sancion.usuarioId}\`)`, inline: false },
            { name: 'Moderador', value: sancion.moderadorTag || 'Panel Web', inline: true },
            { name: 'Duración', value: duracionTexto(sancion.duracionMin), inline: true },
            { name: 'Motivo', value: sancion.motivo || '_Sin motivo_' },
        )
        .setFooter({ text: `ID: ${sancion._id}` })
        .setTimestamp(sancion.fecha);
    if (sancion.pruebas?.length) {
        // Discord solo puede enlazar URLs públicas; las pruebas subidas (rutas
        // relativas) se ven en el panel web. Aquí enlazamos solo las absolutas.
        const enlazables = sancion.pruebas.filter((p) => /^https?:\/\//i.test(p));
        const valor = enlazables.length
            ? enlazables.map((p, i) => `[Prueba ${i + 1}](${p})`).join(' · ')
            : `${sancion.pruebas.length} adjunta(s) — ver en el panel`;
        embed.addFields({ name: 'Pruebas', value: valor });
    }
    await canal.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { aplicarSancion, aplicarSancionMasiva, revocarSancion, barrerSancionesVencidas, duracionTexto };
