// ============================================================================
// Guardar la configuración de Música (PUT /config/:guildId/musica) exige el área
// «musica» de «Acceso al panel», igual que el resto de ajustes del panel: antes
// cualquier staff del servidor podía cambiarla llamando a la API directamente.
// ============================================================================
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const rutasMusica = require('../api/routes/musica.js');
const ServidorConfig = require('../models/ServidorConfig.js');

const GUILD = '900000000000000001';

describe('guardar la configuración de música', () => {
    let original;
    let guardados;
    beforeEach(() => {
        original = ServidorConfig.findOneAndUpdate;
        guardados = [];
        ServidorConfig.findOneAndUpdate = async (filtro, cambio) => { guardados.push({ filtro, cambio }); return { guildId: GUILD }; };
    });
    afterEach(() => { ServidorConfig.findOneAndUpdate = original; });

    async function guardar(tieneAreaAcceso) {
        const app = express();
        app.use(express.json());
        app.use(rutasMusica({ portalAuth: (req, res, next) => next(), client: {}, tieneAreaAcceso }));
        const s = app.listen(0);
        await new Promise((r) => s.once('listening', r));
        try {
            return await fetch(`http://127.0.0.1:${s.address().port}/config/${GUILD}/musica`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: true, volumenMax: 120 }),
            });
        } finally { s.close(); }
    }

    it('sin el área «musica» responde 403 y no guarda nada', async () => {
        const pedidas = [];
        const r = await guardar(async (req, guildId, area) => { pedidas.push([guildId, area]); return false; });
        assert.strictEqual(r.status, 403);
        assert.deepStrictEqual(pedidas, [[GUILD, 'musica']]);
        assert.deepStrictEqual(guardados, []);
    });

    it('con el área «musica» guarda', async () => {
        const r = await guardar(async () => true);
        assert.strictEqual(r.status, 200);
        assert.strictEqual(guardados.length, 1);
        assert.strictEqual(guardados[0].filtro.guildId, GUILD);
        assert.strictEqual(guardados[0].cambio.$set.musica.volumenMax, 120);
    });
});
