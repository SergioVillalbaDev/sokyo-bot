// API para Claude (1.23.0): ver, comprobar y cambiar la configuración de cualquier
// servidor donde está el bot. Solo entra la clave de utils/accesoClaude.js (la crea
// un propietario en Panel → Propietario → Acceso de Claude). En modo «lectura» solo
// GET. Los cambios pasan por el historial (utils/historialCambios.js) y se deshacen.
//
//   GET    /api/claude/servidores              → todos, con lo que tienen activado
//   GET    /api/claude/:guildId                → configuración, canales, roles y diagnóstico
//   GET    /api/claude/:guildId/cambios        → últimos cambios (de cualquiera)
//   PATCH  /api/claude/:guildId                → { set: { 'ruta.con.puntos': valor }, unset: ['ruta'] }
//   POST   /api/claude/:guildId/deshacer/:id   → deshace un cambio del historial
const express = require('express');
const ServidorConfig = require('../../models/ServidorConfig.js');
const { esInterno, aplanar, leerRuta } = require('../../utils/camposInternos.js');

// Qué módulos tiene encendidos (para el resumen de cada servidor).
const MODULOS = {
    tickets: (c) => !!c.categoriaTicketsId, niveles: (c) => c.nivelesActivo !== false, automod: (c) => !!c.automod?.activo,
    registro: (c) => !!c.canalLogsId, bienvenida: (c) => !!c.bienvenida?.activo, verificacion: (c) => !!c.verificacion?.activo,
    sugerencias: (c) => !!c.canalSugerencias, cumpleanos: (c) => !!c.cumpleanos?.activo, temporadas: (c) => !!c.temporadas?.activo,
    salonFama: (c) => !!c.salonFama?.activo, clanes: (c) => !!c.clanes?.activo, mascota: (c) => !!c.mascota?.activo,
    casino: (c) => !!c.casino?.activo, cofres: (c) => !!c.casino?.activo && c.casino?.cofres !== false, packAnime: (c) => !!c.compis?.anime,
    bromas: (c) => !!c.bromas?.activo, liga: (c) => !!c.liga?.activo, musica: (c) => c.musica?.activo !== false,
};

// ¿Se puede escribir en esta ruta? Tiene que existir en el esquema y no ser del bot ni de cobros.
function rutaValida(ruta) {
    if (typeof ruta !== 'string' || !/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(ruta)) return 'ruta con formato raro';
    if (esInterno(ruta)) return 'es un dato interno del bot o de cobros: no se toca';
    const s = ServidorConfig.schema;
    if (s.path(ruta) || s.pathType(ruta) === 'nested') return null;
    // Dentro de un campo libre (Mixed) o de una lista: vale si algún padre existe así.
    const partes = ruta.split('.');
    for (let i = partes.length - 1; i > 0; i--) {
        const padre = s.path(partes.slice(0, i).join('.'));
        if (padre && (padre.instance === 'Mixed' || padre.instance === 'Array' || padre.$isMongooseDocumentArray)) return null;
    }
    return 'no existe en la configuración';
}

module.exports = ({ client }) => {
    const router = express.Router();
    const guildDe = (req, res) => {
        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild) res.status(404).json({ error: 'El bot no está en ese servidor' });
        return guild;
    };

    router.get('/claude/servidores', async (req, res) => {
        const cfgs = new Map((await ServidorConfig.find({}).lean()).map((c) => [c.guildId, c]));
        const lista = client.guilds.cache.map((g) => {
            const c = cfgs.get(g.id) || {};
            return {
                id: g.id, nombre: g.name, miembros: g.memberCount, idioma: c.idioma || null, plan: c.plan || 'free',
                activos: Object.entries(MODULOS).filter(([, f]) => { try { return f(c); } catch { return false; } }).map(([k]) => k),
                tieneConfig: cfgs.has(g.id),
            };
        }).sort((a, b) => b.miembros - a.miembros);
        res.json({ total: lista.length, servidores: lista });
    });

    router.get('/claude/:guildId', async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await ServidorConfig.findOne({ guildId: guild.id }).lean();
            const canales = {}; guild.channels.cache.forEach((c) => { canales[c.id] = { nombre: c.name, tipo: c.type, padre: c.parentId || null }; });
            const roles = {}; guild.roles.cache.forEach((r) => { if (r.id !== guild.id) roles[r.id] = { nombre: r.name, posicion: r.position, gestionado: r.managed }; });
            const diagnostico = await require('../../utils/diagnostico.js').diagnosticar(client, guild.id, cfg || {}, 'es').catch((e) => ({ error: e.message }));
            const me = guild.members.me;
            res.json({
                servidor: { id: guild.id, nombre: guild.name, miembros: guild.memberCount, dueno: guild.ownerId, botAdmin: !!me?.permissions.has('Administrator'), permisosBot: me ? me.permissions.toArray() : [] },
                activos: cfg ? Object.entries(MODULOS).filter(([, f]) => { try { return f(cfg); } catch { return false; } }).map(([k]) => k) : [],
                configuracion: cfg ? aplanar(cfg) : null, canales, roles, diagnostico,
            });
        } catch (e) { console.error('claude GET:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    router.get('/claude/:guildId/cambios', async (req, res) => {
        const guild = guildDe(req, res); if (!guild) return;
        const { listarCambios } = require('../../utils/historialCambios.js');
        res.json(await listarCambios(guild.id, { limite: Math.min(100, parseInt(req.query.limite, 10) || 20) }));
    });

    router.patch('/claude/:guildId', async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const set = req.body?.set && typeof req.body.set === 'object' ? req.body.set : {};
            const unset = Array.isArray(req.body?.unset) ? req.body.unset : [];
            const rutas = [...Object.keys(set), ...unset];
            if (!rutas.length) return res.status(400).json({ error: 'No hay nada que cambiar' });
            if (rutas.length > 50) return res.status(400).json({ error: 'Demasiados cambios de una vez' });
            const malas = rutas.map((r) => [r, rutaValida(r)]).filter(([, e]) => e);
            if (malas.length) return res.status(400).json({ error: 'Rutas no válidas', fallo: Object.fromEntries(malas) });
            const antes = await ServidorConfig.findOne({ guildId: guild.id }).lean();
            const upd = {};
            if (Object.keys(set).length) upd.$set = set;
            if (unset.length) upd.$unset = Object.fromEntries(unset.map((r) => [r, 1]));
            const despues = await ServidorConfig.findOneAndUpdate({ guildId: guild.id }, upd, { returnDocument: 'after', upsert: true, runValidators: true }).lean();
            require('../../utils/config.js').invalidateConfig?.(guild.id);
            res.json({ success: true, cambios: rutas.map((r) => ({ ruta: r, antes: leerRuta(antes || {}, r) ?? null, ahora: leerRuta(despues, r) ?? null })) });
        } catch (e) {
            console.error('claude PATCH:', e.message);
            res.status(400).json({ error: 'No se pudo guardar', detalle: e.message });
        }
    });

    router.post('/claude/:guildId/deshacer/:id', async (req, res) => {
        const guild = guildDe(req, res); if (!guild) return;
        const { deshacerCambio } = require('../../utils/historialCambios.js');
        const CambioPanel = require('../../models/CambioPanel.js');
        const c = await CambioPanel.findById(req.params.id).lean().catch(() => null);
        if (!c || c.guildId !== guild.id) return res.status(404).json({ error: 'No encontrado' });
        try {
            res.json(await deshacerCambio(req.params.id, req.staff, { forzar: !!req.body?.forzar }));
        } catch (e) { res.status(400).json({ error: 'No se pudo guardar', detalle: e.message }); }
    });

    return router;
};

module.exports.rutaValida = rutaValida;
