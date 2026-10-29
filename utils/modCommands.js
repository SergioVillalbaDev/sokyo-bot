// Helpers compartidos por los comandos de moderación (!ban, !kick, !timeout,
// !warn, !sancion). Comprueban el permiso del autor, resuelven al usuario y
// aplican la sanción por el motor común (moderationManager).
const { PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { aplicarSancion, duracionTexto, metaFor } = require('./moderationManager.js');
const { getConfigCached } = require('./config.js');
const { miembroPuedeModerar } = require('./permisos.js');
const { t } = require('./i18n.js');

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
        return message.reply(t(cfg, '❌ No tienes permiso para esta acción.', '❌ You don’t have permission for this action.'));
    }

    // 2. Usuario objetivo (por mención).
    const target = message.mentions.users.first();
    if (!target) return message.reply(t(cfg, '❌ Menciona a un usuario. p. ej. `!ban @usuario motivo`', '❌ Mention a user. e.g. `!ban @user reason`'));

    // 3. Banear o expulsar se confirma antes con dos botones (solo quien lo pidió).
    if (accion === 'ban' || accion === 'expulsion') {
        const { guardarPendiente } = require('./confirmaciones.js');
        const id = guardarPendiente(message.author.id, { guildId: message.guild.id, usuarioId: target.id, usuarioNombre: target.username, tipo: { nombre, accion, duracionMin, borrarMensajesHoras }, motivo });
        const etiqueta = accion === 'ban' ? t(cfg, 'banear', 'ban') : t(cfg, 'expulsar', 'kick');
        const extra = duracionMin > 0 ? t(cfg, ` durante ${duracionTexto(duracionMin, cfg)}`, ` for ${duracionTexto(duracionMin, cfg)}`) : '';
        return message.reply({
            content: t(cfg,
                `⚠️ ¿Seguro que quieres **${etiqueta}** a **${target.username}**${extra}?${motivo ? `\nMotivo: ${motivo}` : ''}`,
                `⚠️ Are you sure you want to **${etiqueta}** **${target.username}**${extra}?${motivo ? `\nReason: ${motivo}` : ''}`),
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`conf:${id}`).setStyle(ButtonStyle.Danger).setLabel(t(cfg, `Sí, ${etiqueta}`, `Yes, ${etiqueta}`)),
                new ButtonBuilder().setCustomId(`conf_no:${id}`).setStyle(ButtonStyle.Secondary).setLabel(t(cfg, 'Cancelar', 'Cancel')),
            )],
            allowedMentions: { repliedUser: false },
        });
    }

    // 4. Aplicar por el motor común (mismo registro, mod-log, MD y protecciones).
    try {
        await aplicarSancion(client, {
            guildId: message.guild.id,
            usuarioId: target.id,
            tipo: { nombre, accion, duracionMin, borrarMensajesHoras },
            motivo,
            moderador: { id: message.author.id, tag: message.author.username },
        });
        const extra = duracionMin > 0 ? `, ${duracionTexto(duracionMin, cfg)}` : '';
        const etiqueta = nombre || (metaFor(cfg)[accion] || {}).etiqueta || accion;
        return message.reply(t(cfg,
            `✅ Sanción aplicada a **${target.username}** (${etiqueta}${extra}).`,
            `✅ Sanction applied to **${target.username}** (${etiqueta}${extra}).`));
    } catch (e) {
        return message.reply(`❌ ${e.message}`);
    }
}

module.exports = { aplicarComando, parseDuracion };
