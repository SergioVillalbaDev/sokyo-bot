// ============================================================================
// Rutas de la API de CANALES DE VOZ TEMPORALES (panel de admin).
//   • /config/:id/voztemporal        → leer/guardar configuración
//   • /config/:id/voztemporal/panel  → publicar/reeditar el panel de control
//   • /config/:id/voztemporal/activos→ listar / cerrar salas activas en vivo
// El middleware global de server.js ya acota por servidor. Recibe el cliente.
// ============================================================================
const express = require('express');
const ServidorConfig = require('../../models/ServidorConfig.js');
const CanalVozTemporal = require('../../models/CanalVozTemporal.js');
const { publicarPanel } = require('../../utils/vozTemporal.js');

module.exports = ({ client }) => {
    const router = express.Router();

    const num = (n, min, max, def) => {
        const v = Number(n);
        return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def;
    };

    // Defaults para devolver algo coherente aunque el servidor no tenga config.
    const VOZ_DEF = {
        activo: false, generadores: [], panelCanalId: null, panelMensajeId: null,
        panelTitulo: '🔊 Tu canal de voz',
        panelDescripcion: 'Entra al canal generador para crear tu sala. Luego usa estos botones para gestionarla.',
        panelColor: '#5865F2',
        panelBloquearCanal: false,
        controles: {
            renombrar: true, limite: true, bloquear: true, ocultar: true, bitrate: true,
            invitar: true, expulsar: true, reclamar: true, transferir: true, eliminar: true,
        },
        maxPorUsuario: 1,
    };

    // Leer configuración de voz temporal.
    router.get('/config/:guildId/voztemporal', async (req, res) => {
        try {
            const cfg = await ServidorConfig.findOne({ guildId: req.params.guildId });
            res.json(cfg?.vozTemporal || VOZ_DEF);
        } catch (e) {
            console.error('voztemporal GET:', e.message);
            res.status(500).json({ error: 'No se pudo leer la configuración.' });
        }
    });

    // Guardar configuración. Devuelve el documento de config completo.
    router.put('/config/:guildId/voztemporal', async (req, res) => {
        try {
            const b = req.body || {};
            const generadores = Array.isArray(b.generadores) ? b.generadores
                .filter((g) => g && g.canalId)
                .slice(0, 10)
                .map((g) => ({
                    canalId: String(g.canalId),
                    nombre: String(g.nombre || '🔊 {user}').slice(0, 100),
                    categoriaId: g.categoriaId ? String(g.categoriaId) : null,
                    limite: num(g.limite, 0, 99, 0),
                    bitrate: num(g.bitrate, 8, 384, 64),
                    bloqueadoPorDefecto: !!g.bloqueadoPorDefecto,
                    ocultoPorDefecto: !!g.ocultoPorDefecto,
                })) : [];

            const c = b.controles || {};
            const vozTemporal = {
                activo: !!b.activo,
                generadores,
                panelCanalId: b.panelCanalId ? String(b.panelCanalId) : null,
                panelTitulo: String(b.panelTitulo || VOZ_DEF.panelTitulo).slice(0, 100),
                panelDescripcion: String(b.panelDescripcion || VOZ_DEF.panelDescripcion).slice(0, 500),
                panelColor: /^#[0-9a-fA-F]{6}$/.test(b.panelColor) ? b.panelColor : '#5865F2',
                panelBloquearCanal: !!b.panelBloquearCanal,
                controles: {
                    renombrar: c.renombrar !== false,
                    limite: c.limite !== false,
                    bloquear: c.bloquear !== false,
                    ocultar: c.ocultar !== false,
                    bitrate: c.bitrate !== false,
                    invitar: c.invitar !== false,
                    expulsar: c.expulsar !== false,
                    reclamar: c.reclamar !== false,
                    transferir: c.transferir !== false,
                    eliminar: c.eliminar !== false,
                },
                maxPorUsuario: num(b.maxPorUsuario, 1, 10, 1),
            };

            // Conservar el id del panel ya publicado (campo interno) si existía.
            const previo = await ServidorConfig.findOne({ guildId: req.params.guildId });
            vozTemporal.panelMensajeId = previo?.vozTemporal?.panelMensajeId || null;
            // Si cambia el canal del panel, olvidamos el mensaje antiguo.
            if (previo?.vozTemporal?.panelCanalId !== vozTemporal.panelCanalId) vozTemporal.panelMensajeId = null;

            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId },
                { $set: { vozTemporal } },
                { new: true, upsert: true },
            );
            res.json({ success: true, config });
        } catch (e) {
            console.error('voztemporal PUT:', e.message);
            res.status(500).json({ error: 'No se pudo guardar la configuración.' });
        }
    });

    // Publicar (o reeditar) el panel de control en el canal configurado.
    router.post('/config/:guildId/voztemporal/panel', async (req, res) => {
        try {
            const id = await publicarPanel(client, req.params.guildId);
            res.json({ success: true, mensajeId: id });
        } catch (e) {
            console.error('voztemporal panel publicar:', e.message);
            const map = {
                'sin-canal': 'Elige primero un canal de texto para el panel y guarda.',
                'canal-invalido': 'El canal del panel no es válido o el bot no puede escribir en él.',
            };
            res.status(400).json({ error: map[e.message] || `No se pudo publicar el panel: ${e.message}` });
        }
    });

    // Listar las salas temporales activas (en vivo) de este servidor.
    router.get('/config/:guildId/voztemporal/activos', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            const docs = await CanalVozTemporal.find({ guildId: req.params.guildId }).sort({ creadoEn: -1 });
            const activos = docs.map((d) => {
                const canal = guild?.channels.cache.get(d.canalId);
                const dueno = guild?.members.cache.get(d.ownerId);
                return {
                    canalId: d.canalId,
                    nombre: canal?.name || d.nombre,
                    existe: !!canal,
                    miembros: canal ? canal.members.filter((m) => !m.user.bot).size : 0,
                    dueno: dueno ? { id: dueno.id, nombre: dueno.displayName, avatar: dueno.user.displayAvatarURL({ size: 64 }) } : { id: d.ownerId, nombre: 'Desconocido' },
                    bloqueado: d.bloqueado,
                    oculto: d.oculto,
                    limite: d.limite,
                    creadoEn: d.creadoEn,
                };
            });
            res.json(activos);
        } catch (e) {
            console.error('voztemporal activos:', e.message);
            res.status(500).json({ error: 'No se pudieron listar las salas.' });
        }
    });

    // Cerrar (borrar) una sala temporal concreta desde el panel.
    router.delete('/config/:guildId/voztemporal/activos/:canalId', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            const canal = guild?.channels.cache.get(req.params.canalId);
            if (canal) await canal.delete('Cerrado desde el panel web').catch(() => {});
            await CanalVozTemporal.deleteOne({ canalId: req.params.canalId });
            res.json({ success: true });
        } catch (e) {
            console.error('voztemporal cerrar:', e.message);
            res.status(500).json({ error: 'No se pudo cerrar la sala.' });
        }
    });

    return router;
};
