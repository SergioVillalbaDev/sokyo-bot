// ============================================================================
// Briefing diario (Pro): genera con IA el parte del servidor y lo entrega por
// MD al dueño (+ canal opcional). Lo usan el programador (envío automático a la
// hora fijada) y la API (botón "enviar prueba"). Consume 1 uso de la cuota de IA.
// ============================================================================
const { EmbedBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { construirAnalitica } = require('./analitica.js');
const { aplicarPieMarca } = require('./marca.js');
const ia = require('./ia.js');
const billing = require('./billing.js');

// Genera y entrega el resumen de un servidor. `prueba` no marca el día (para test).
async function enviarResumen(client, gid, { prueba = false } = {}) {
    const guild = client.guilds.cache.get(gid);
    if (!guild) return { error: 'Server not found' };
    const cfg = await ServidorConfig.findOne({ guildId: gid });
    if (!billing.esPro(cfg)) return { error: 'The daily summary is a Pro feature.' };
    if (!ia.iaDisponible()) return { error: 'The AI is not configured (missing ANTHROPIC_API_KEY).' };
    if (billing.estadoIA(cfg).restantes <= 0) return { error: 'You’ve used up your AI quota for this month.' };

    const data = await construirAnalitica(client, gid, cfg, 7);
    const texto = await ia.resumenDiario(data, guild.name);
    await billing.consumirIA(gid, cfg);

    const embed = new EmbedBuilder()
        .setTitle(`📊 Daily summary · ${guild.name}`)
        .setColor(cfg && cfg.colorEmbed ? cfg.colorEmbed : '#5865F2')
        .setDescription(String(texto).slice(0, 4096))
        .setTimestamp();
    aplicarPieMarca(embed, cfg);
    if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ size: 64 }));
    const payload = { embeds: [embed] };

    let entregado = false;
    try { const owner = await guild.fetchOwner(); await owner.send(payload); entregado = true; } catch { /* MD cerrados */ }
    const canalId = cfg && cfg.resumenDiario && cfg.resumenDiario.canalId;
    if (canalId) {
        const canal = await client.channels.fetch(canalId).catch(() => null);
        if (canal && canal.isTextBased()) { await canal.send(payload).catch(() => {}); entregado = true; }
    }

    if (!prueba) {
        await ServidorConfig.updateOne({ guildId: gid }, { $set: { 'resumenDiario.lastDia': new Date().toISOString().slice(0, 10) } });
    }
    return entregado ? { ok: true } : { error: 'Couldn’t deliver it (the owner has DMs closed and no channel is configured).' };
}

module.exports = { enviarResumen };
