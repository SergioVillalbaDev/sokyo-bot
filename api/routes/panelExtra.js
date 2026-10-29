// ============================================================================
// Comodidades del panel: diagnóstico «¿Algo no funciona?» (con arreglos de un
// clic) e historial de cambios con «volver a como estaba».
// ============================================================================
const express = require('express');
const ServidorConfig = require('../../models/ServidorConfig.js');
const { diagnosticar, arreglar } = require('../../utils/diagnostico.js');
const { listarCambios, deshacerCambio } = require('../../utils/historialCambios.js');

// Área de permisos que hace falta para deshacer cada campo (la misma que su sección).
const AREA_DE = { automod: 'moderacion', canalModLogId: 'moderacion', dmSancion: 'moderacion', autoRespuestas: 'mensajes', autoRoles: 'roles', autoRolesBots: 'roles' };
// Valores que no se enseñan en el historial (llevan claves de acceso).
const OCULTOS = new Set(['webhooksSalientes']);

module.exports = ({ client, exigeArea, tieneAreaAcceso, idiomaPanel }) => {
    const router = express.Router();

    // --- Novedades de la versión (ventana «Novedades» del panel) ---
    router.get('/novedades', (req, res) => {
        const { version } = require('../../package.json');
        const { NOVEDADES, novedadesDe } = require('../../utils/novedades.js');
        const idioma = idiomaPanel(req, null);
        // Las últimas versiones con novedades, de la más nueva a la más vieja.
        const versiones = Object.keys(NOVEDADES).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).slice(0, 4);
        res.json({ version, versiones: versiones.map((v) => ({ version: v, novedades: novedadesDe(v, idioma) })) });
    });

    // --- Diagnóstico ---
    router.get('/diagnostico', async (req, res) => {
        try {
            const { guildId } = req.query;
            if (!guildId) return res.status(400).json({ error: 'Indica un servidor' });
            const cfg = await ServidorConfig.findOne({ guildId }).lean();
            res.json(await diagnosticar(client, guildId, cfg || {}, idiomaPanel(req, cfg)));
        } catch (e) {
            console.error('Diagnóstico:', e);
            res.status(500).json({ error: 'No se pudo hacer el diagnóstico' });
        }
    });

    router.post('/diagnostico/arreglar', exigeArea('config'), async (req, res) => {
        try {
            const r = await arreglar(req.body.guildId, req.body.arreglo);
            if (!r.ok) return res.status(400).json({ error: 'Ese arreglo no se puede hacer desde aquí' });
            res.json({ success: true });
        } catch (e) {
            console.error('Arreglo del diagnóstico:', e);
            res.status(500).json({ error: 'No se pudo arreglar' });
        }
    });

    // --- Historial de cambios ---
    router.get('/cambios', exigeArea('config'), async (req, res) => {
        try {
            const lista = await listarCambios(req.query.guildId, { limite: Number(req.query.limite) || 40, antesDe: req.query.antes || null });
            res.json(lista.map((c) => ({
                id: String(c._id), fecha: c.fecha, usuarioId: c.usuarioId, usuarioNombre: c.usuarioNombre,
                secciones: c.secciones, claves: c.claves, deshaceA: c.deshaceA ? String(c.deshaceA) : null,
                deshechoPor: c.deshechoPor, deshechoEn: c.deshechoEn,
                antes: Object.fromEntries(Object.entries(c.antes || {}).map(([k, v]) => [k, OCULTOS.has(k) ? '••••' : v])),
                despues: Object.fromEntries(Object.entries(c.despues || {}).map(([k, v]) => [k, OCULTOS.has(k) ? '••••' : v])),
            })));
        } catch (e) {
            console.error('Historial de cambios:', e);
            res.status(500).json({ error: 'No se pudo cargar el historial' });
        }
    });

    // El cambio puede ser de otro servidor de los suyos (p. ej. al copiar la
    // configuración a otro): se mira el acceso en el servidor del cambio.
    router.post('/cambios/:id/deshacer', async (req, res) => {
        try {
            const CambioPanel = require('../../models/CambioPanel.js');
            const c = await CambioPanel.findById(req.params.id).select('guildId claves').lean().catch(() => null);
            if (!c) return res.status(404).json({ error: 'Ese cambio no existe', codigo: 'no_existe' });
            for (const area of new Set(['config', ...c.claves.map((k) => AREA_DE[k]).filter(Boolean)])) {
                if (!(await tieneAreaAcceso(req, c.guildId, area))) return res.status(403).json({ error: 'No tienes acceso a esta sección del panel' });
            }
            const r = await deshacerCambio(req.params.id, req.staff || null, { forzar: !!req.body.forzar });
            if (!r.ok) return res.status(r.codigo === 'cambiado_despues' ? 409 : 400).json({ error: r.codigo, codigo: r.codigo, claves: r.claves || [] });
            res.json({ success: true, id: r.id, claves: r.claves, omitidas: r.omitidas });
        } catch (e) {
            console.error('Deshacer cambio:', e);
            res.status(500).json({ error: 'No se pudo deshacer' });
        }
    });

    return router;
};
