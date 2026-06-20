// Helpers compartidos por los comandos de moderación (!ban, !kick, !timeout,
// !warn, !sancion). Comprueban el permiso del autor, resuelven al usuario y
// aplican la sanción por el motor común (moderationManager).
const { PermissionsBitField } = require('discord.js');
const { aplicarSancion, duracionTexto } = require('./moderationManager.js');
const { getConfigCached } = require('./config.js');
const { miembroPuedeModerar } = require('./permisos.js');

// Permiso de Discord requerido para cada acción.
const PERMISO = { ban: 'BanMembers', expulsion: 'KickMembers', timeout: 'ModerateMembers', aviso: 'ModerateMembers' };

// Convierte "30m" / "2h" / "7d" / "1w" a minutos. Devuelve null si no es válido.
const UNIDADES = { m: 1, min: 1, mins: 1, h: 60, hora: 60, horas: 60, d: 1440, dia: 1440, dias: 1440, w: 10080, semana: 10080, semanas: 10080 };
function parseDuracion(str) {
    if (!str) return null;
    const m = /^(\d+)\s*([a-zñ]+)$/i.exec(str.trim());
    if (!m) return null;
    const factor = UNIDADES[m[2].toLowerCase()];
    return factor != null ? parseInt(m[1], 10) * factor : null;
}

// Aplica una sanción lanzada desde un comando. Hace el reply de éxito/error.
async function aplicarComando(message, client, { accion, duracionMin = 0, borrarMensajesHoras = 0, motivo = '', nombre = null }) {
    // 1. Permiso del autor: admin, permiso nativo de la acción, o rol de moderación configurado.
    const cfg = await getConfigCached(message.guild.id);
    const flag = PermissionsBitField.Flags[PERMISO[accion]];
    if (!miembroPuedeModerar(message.member, cfg, flag)) {
        return message.reply('❌ No tienes permiso para esta acción.');
    }

    // 2. Usuario objetivo (por mención).
    const target = message.mentions.users.first();
    if (!target) return message.reply('❌ Menciona a un usuario. Ej: `!ban @usuario motivo`');

    // 3. Aplicar por el motor común (mismo registro, mod-log, MD y protecciones).
    try {
        await aplicarSancion(client, {
            guildId: message.guild.id,
            usuarioId: target.id,
            tipo: { nombre, accion, duracionMin, borrarMensajesHoras },
            motivo,
            moderador: { id: message.author.id, tag: message.author.username },
        });
        const extra = duracionMin > 0 ? `, ${duracionTexto(duracionMin)}` : '';
        return message.reply(`✅ Sanción aplicada a **${target.username}** (${nombre || accion}${extra}).`);
    } catch (e) {
        return message.reply(`❌ ${e.message}`);
    }
}

module.exports = { aplicarComando, parseDuracion };
