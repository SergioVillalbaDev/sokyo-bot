// ============================================================================
// Briefing diario (Pro): arma el PARTE DE ESTADÍSTICAS del servidor (crecimiento,
// actividad, tickets, moderación, niveles e ideas de crecimiento) y lo entrega
// por MD al dueño —o al destinatario configurado en el panel— y, opcionalmente,
// a un canal. Lo usan el programador (envío a la hora fijada) y la API (botón
// "enviar prueba"). NO usa IA: son los números directos de la analítica.
// ============================================================================
const { EmbedBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { construirAnalitica } = require('./analitica.js');
const { aplicarPieMarca } = require('./marca.js');
const billing = require('./billing.js');

const n = (v) => (v === null || v === undefined ? '—' : String(v));
const signo = (v) => (typeof v === 'number' && v > 0 ? `+${v}` : n(v));

// Construye el embed de estadísticas a partir de la analítica de `dias` días.
function construirEmbed(data, guild, cfg) {
    const r = data.resumen || {};
    const s = data.servidor || {};
    const c = data.comunidad || {};
    const tk = (data.tickets && data.tickets.totales) || {};
    const mod = data.moderacion || {};
    const niv = data.niveles || {};
    const act = data.actividad || {};

    const embed = new EmbedBuilder()
        .setTitle(`📊 Server report · ${guild.name}`)
        .setColor(cfg && cfg.colorEmbed ? cfg.colorEmbed : '#5865F2')
        .setDescription(`Stats from the last **${data.dias} days**.`)
        .addFields(
            { name: '👥 Members', value: `${n(s.miembros)}${s.boosts ? ` · 🚀 ${s.boosts} boosts` : ''}`, inline: true },
            { name: '📈 Growth', value: `${signo(c.neto)} net\n↗ ${n(c.totalEntradas)} joined · ↘ ${n(c.totalSalidas)} left`, inline: true },
            { name: '💬 Activity', value: `${n(act.total)} messages\n${n(r.activos)} active${r.pctActivos != null ? ` (${r.pctActivos}%)` : ''}${act.horaPico ? ` · peak ${act.horaPico}` : ''}`, inline: true },
            { name: '🔊 Voice', value: `${n(r.vozActivos)} active`, inline: true },
            { name: '🎫 Tickets', value: `${n(tk.total)} total\n🟢 ${n(tk.abiertos)} open · 🔒 ${n(tk.cerrados)} closed${tk.csat != null ? `\n⭐ CSAT ${tk.csat}` : ''}`, inline: true },
            { name: '🛡️ Moderation', value: `${n(mod.total)} sanctions${mod.automod != null ? ` · ${mod.automod} automod` : ''}${mod.reportesPendientes ? `\n⚠ ${mod.reportesPendientes} reports pending` : ''}`, inline: true },
            { name: '🏆 Levels', value: `${n(niv.conXp)}/${n(niv.total)} with XP · avg lvl ${n(niv.nivelMedio)}`, inline: true },
        )
        .setTimestamp();

    // Ideas de crecimiento (las 3 primeras), si las hay.
    const insights = Array.isArray(data.insights) ? data.insights.slice(0, 3) : [];
    if (insights.length) {
        const linea = insights.map((i) => {
            const icono = i.tipo === 'warn' ? '⚠️' : i.tipo === 'ok' ? '✅' : '💡';
            return `${icono} **${i.titulo}** — ${i.texto}`;
        }).join('\n\n').slice(0, 1024);
        embed.addFields({ name: '🌱 Growth tips', value: linea, inline: false });
    }

    aplicarPieMarca(embed, cfg);
    if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ size: 64 }));
    return embed;
}

// Genera y entrega el parte de un servidor. `prueba` no marca el día (para test).
async function enviarResumen(client, gid, { prueba = false } = {}) {
    const guild = client.guilds.cache.get(gid);
    if (!guild) return { error: 'Server not found' };
    const cfg = await ServidorConfig.findOne({ guildId: gid });
    if (!billing.esPro(cfg)) return { error: 'The daily report is a Pro feature.' };

    const data = await construirAnalitica(client, gid, cfg, 7);
    const embed = construirEmbed(data, guild, cfg);
    const payload = { embeds: [embed] };

    let entregado = false;

    // Destinatario del MD: el configurado en el panel, o el dueño del servidor.
    const destinatarioId = cfg && cfg.resumenDiario && cfg.resumenDiario.destinatarioId;
    try {
        let destino = null;
        if (destinatarioId) destino = await client.users.fetch(destinatarioId).catch(() => null);
        if (!destino) destino = await guild.fetchOwner().catch(() => null);
        if (destino) { await destino.send(payload); entregado = true; }
    } catch { /* MD cerrados o usuario no encontrado */ }

    // Canal opcional, además del MD.
    const canalId = cfg && cfg.resumenDiario && cfg.resumenDiario.canalId;
    if (canalId) {
        const canal = await client.channels.fetch(canalId).catch(() => null);
        if (canal && canal.isTextBased()) { await canal.send(payload).catch(() => {}); entregado = true; }
    }

    if (!prueba) {
        await ServidorConfig.updateOne({ guildId: gid }, { $set: { 'resumenDiario.lastDia': new Date().toISOString().slice(0, 10) } });
    }
    return entregado ? { ok: true } : { error: 'Couldn’t deliver it (the recipient has DMs closed and no channel is configured).' };
}

module.exports = { enviarResumen };
