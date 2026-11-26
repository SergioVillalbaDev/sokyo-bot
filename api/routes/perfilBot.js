// 🎨 Perfil del bot en el servidor (2.4.0, utils/perfilBot.js):
//   GET /api/config/:guildId/perfil-bot → lo que se ve ahora (apodo, foto, banner, descripción) y si es Pro.
//   PUT /api/config/:guildId/perfil-bot → { apodo?, avatar?, banner?, bio? } (null = volver al de Sokyo).
// Área «config» (cambia cómo se ve el bot en todo el servidor).
const express = require('express');

module.exports = function rutasPerfilBot({ client, exigeArea }) {
    const router = express.Router();
    const P = require('../../utils/perfilBot.js');
    const cfgDe = (guildId) => require('../../models/ServidorConfig.js').findOne({ guildId }).lean();

    router.get('/config/:guildId/perfil-bot', exigeArea('config'), async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'El bot no está en ese servidor.', codigo: 'sinServidor' });
            await guild.members.fetchMe?.().catch(() => null);
            res.json(P.estado(guild, await cfgDe(guild.id) || {}));
        } catch (e) { console.error('Perfil del bot (ver):', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    router.put('/config/:guildId/perfil-bot', exigeArea('config'), async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'El bot no está en ese servidor.', codigo: 'sinServidor' });
            const b = req.body || {};
            const cambios = {};
            for (const k of ['apodo', 'avatar', 'banner', 'bio']) if (k in b) cambios[k] = b[k] === null || b[k] === '' ? null : b[k];
            const cfg = await cfgDe(guild.id) || {};
            const r = await P.aplicar(guild, cfg, cambios);
            if (r.error) return res.status(r.codigo === 'pro' ? 402 : r.codigo === 'espera' ? 429 : 400).json(r);
            res.json({ ok: true, ...P.estado(guild, await cfgDe(guild.id) || {}) });
        } catch (e) { console.error('Perfil del bot (guardar):', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    return router;
};
