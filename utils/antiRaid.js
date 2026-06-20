// ============================================================================
// antiRaid — Defensa frente a oleadas de entradas (raids) y filtrado de
// cuentas nuevas / multicuentas (alts) en el momento de entrar al servidor.
// Lo invoca events/guildMemberAdd.js. Reutiliza el motor de moderación y el
// helper de alertas del automod.
// ============================================================================
const { EmbedBuilder } = require('discord.js');
const { aplicarSancion } = require('./moderationManager.js');
const { enviarAlerta } = require('./automod.js');

// Entradas recientes por servidor (ventana deslizante en memoria).
const entradas = new Map();   // guildId -> [timestamps]
// Bloqueos activos por raid.
const lockdown = new Map();   // guildId -> expira (ms)

// Limpieza periódica de estructuras en memoria.
setInterval(() => {
    const corte = Date.now() - 120000;
    for (const [g, arr] of entradas) {
        const vivos = arr.filter((t) => t > corte);
        if (vivos.length) entradas.set(g, vivos); else entradas.delete(g);
    }
    for (const [g, hasta] of lockdown) if (hasta <= Date.now()) lockdown.delete(g);
}, 60000).unref();

function enRaid(guildId) {
    const hasta = lockdown.get(guildId);
    return !!(hasta && hasta > Date.now());
}

// Edad de la cuenta en horas.
function edadHoras(user) {
    return (Date.now() - user.createdTimestamp) / 3600000;
}

// Acción directa contra un raider (sin DM ni registro individual: en un raid
// pueden ser cientos de cuentas y saturaría logs/MD).
async function actuarRaid(member, accion, timeoutMin) {
    const motivo = 'Anti-raid: oleada de entradas detectada';
    try {
        if (accion === 'ban') return member.ban({ reason: motivo, deleteMessageSeconds: 3600 }).catch(() => {});
        if (accion === 'timeout') return member.timeout(Math.min(timeoutMin || 60, 40320) * 60000, motivo).catch(() => {});
        return member.kick(motivo).catch(() => {}); // kick por defecto
    } catch (e) { console.error('Anti-raid acción:', e.message); }
}

// Sanción individual (con registro + MD) para el filtro de cuentas nuevas.
async function sancionarMiembro(client, member, accion, motivo, timeoutMin) {
    const map = { kick: 'expulsion', ban: 'ban', timeout: 'timeout' };
    try {
        await aplicarSancion(client, {
            guildId: member.guild.id,
            usuarioId: member.id,
            tipo: { nombre: 'Automod', accion: map[accion] || 'timeout', duracionMin: accion === 'timeout' ? (timeoutMin || 60) : 0 },
            motivo: `[Automod] ${motivo}`,
            moderador: { id: client.user.id, tag: 'Automod' },
        });
    } catch (e) { console.error('Automod (cuenta nueva):', e.message); }
}

// Revisa una entrada de miembro. Devuelve true si el miembro fue gestionado
// por el anti-raid (para que guildMemberAdd no siga con el autorol normal).
async function revisarEntrada(member, cfg, client) {
    const am = cfg && cfg.automod;
    if (!am || !am.activo || member.user.bot) return false;
    const guild = member.guild;
    let gestionado = false;

    // --- Anti-raid ---
    if (am.antiRaid?.activo) {
        const r = am.antiRaid;
        const ahora = Date.now();
        const lista = (entradas.get(guild.id) || []).filter((t) => ahora - t < (r.enSegundos || 10) * 1000);
        lista.push(ahora);
        entradas.set(guild.id, lista);

        // ¿Se acaba de superar el umbral? Activamos el bloqueo y avisamos una vez.
        if (!enRaid(guild.id) && lista.length >= (r.uniones || 8)) {
            lockdown.set(guild.id, ahora + (r.lockdownMin || 10) * 60000);
            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('🚨 Posible RAID detectado')
                .setDescription(`Se han unido **${lista.length}** cuentas en ~${r.enSegundos}s.\nBloqueo activado durante **${r.lockdownMin} min** (acción: ${r.accion}).`)
                .setTimestamp();
            await enviarAlerta(client, guild, am, { embeds: [embed] });
        }

        if (enRaid(guild.id)) {
            // Filtro opcional por edad de cuenta (0 = todas).
            if (!r.edadMinHoras || edadHoras(member.user) < r.edadMinHoras) {
                await actuarRaid(member, r.accion, r.timeoutMin);
                return true; // gestionado: no seguimos con cuentas nuevas ni autorol
            }
        }
    }

    // --- Cuentas nuevas / multicuentas ---
    if (am.cuentasNuevas?.activo) {
        const c = am.cuentasNuevas;
        const edadH = edadHoras(member.user);
        const esNueva = edadH < (c.edadMinHoras || 72);
        const sinAvatar = c.sinAvatar && !member.user.avatar;

        if (esNueva || sinAvatar) {
            const razones = [];
            if (esNueva) razones.push(edadH < 1 ? `creada hace ${Math.max(1, Math.round(edadH * 60))} min` : `creada hace ${Math.round(edadH)} h`);
            if (sinAvatar) razones.push('sin avatar');
            const motivo = `Cuenta sospechosa (${razones.join(', ')})`;

            // Rol de cuarentena opcional.
            if (c.asignarRolId) {
                const rol = guild.roles.cache.get(c.asignarRolId);
                if (rol && rol.editable) await member.roles.add(rol).catch(() => {});
            }

            if (c.accion === 'alerta') {
                const embed = new EmbedBuilder()
                    .setColor(0xf1c40f)
                    .setAuthor({ name: `⚠️ ${member.user.username}`, iconURL: member.user.displayAvatarURL?.() || undefined })
                    .setDescription(`<@${member.id}> acaba de entrar. ${motivo}.`)
                    .setFooter({ text: `ID: ${member.id}` })
                    .setTimestamp();
                await enviarAlerta(client, guild, am, { embeds: [embed] });
            } else {
                await sancionarMiembro(client, member, c.accion, motivo, c.timeoutMin);
                gestionado = true;
            }
        }
    }

    return gestionado;
}

module.exports = { revisarEntrada };
