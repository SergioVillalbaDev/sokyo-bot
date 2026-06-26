// Rutas del panel para la sección Comunidad (sorteos, eventos, encuestas,
// sugerencias, presentaciones). Se montan desde api/server.js con
// montarRutasComunidad(app, client), DESPUÉS del middleware de auth (req.staff)
// y ANTES del fallback SPA. El frontend las consume desde src/hooks/useDashboard.js.
const ServidorConfig = require('../models/ServidorConfig.js');
const Encuesta = require('../models/Encuesta.js');
const Sorteo = require('../models/Sorteo.js');
const Evento = require('../models/Evento.js');
const Sugerencia = require('../models/Sugerencia.js');
const Presentacion = require('../models/Presentacion.js');
const TriviaPregunta = require('../models/TriviaPregunta.js');
const comunidad = require('../utils/comunidad.js');

module.exports = function montarRutasComunidad(app, client) {
    // Filtro por servidor respetando el alcance del staff (igual que /api/anuncios).
    const filtroGuild = (req) => {
        const filtro = {};
        const { guildId } = req.query;
        if (guildId) filtro.guildId = guildId;
        else if (req.staff && !req.staff.owner) filtro.guildId = { $in: req.staff.guilds || [] };
        return filtro;
    };
    // ¿Tiene el staff permiso sobre este servidor? (para PUT/DELETE por id).
    const puedeGestionar = (req, gid) =>
        !req.staff || req.staff.owner || (req.staff.guilds || []).includes(gid);

    const fechaFutura = (v) => {
        const f = new Date(v);
        return !isNaN(f.getTime()) && f.getTime() > Date.now() - 60000 ? f : null;
    };

    // ===================== SORTEOS =====================
    app.get('/api/sorteos', async (req, res) => {
        try { res.json(await Sorteo.find(filtroGuild(req)).sort({ creadoFecha: -1 }).limit(100)); }
        catch (e) { console.error('GET sorteos:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.post('/api/sorteos', async (req, res) => {
        try {
            const b = req.body || {};
            const guildId = String(b.guildId || '');
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            if (!guild.channels.cache.get(String(b.canalId))) return res.status(400).json({ error: 'Canal no válido' });
            const fecha = fechaFutura(b.fechaFin);
            if (!fecha) return res.status(400).json({ error: 'La fecha debe ser futura' });
            if (!b.nombre || !b.premio) return res.status(400).json({ error: 'Faltan datos del sorteo' });

            const doc = await Sorteo.create({
                guildId,
                canalId: String(b.canalId),
                nombre: String(b.nombre).slice(0, 100),
                premio: String(b.premio).slice(0, 200),
                ganadores: Math.min(20, Math.max(1, parseInt(b.ganadores, 10) || 1)),
                nivelMin: Math.max(0, parseInt(b.nivelMin, 10) || 0),
                rolRequerido: b.rolRequerido || null,
                imagen: b.imagen || null,
                multiplicadores: (Array.isArray(b.multiplicadores) ? b.multiplicadores : [])
                    .filter((m) => m && m.rolId)
                    .map((m) => ({ rolId: String(m.rolId), multiplicador: Math.max(1, Math.min(100, parseInt(m.multiplicador, 10) || 1)) }))
                    .slice(0, 10),
                fechaFin: fecha,
                creadoPor: (req.staff && req.staff.username) || 'Panel Web',
            });
            await comunidad.publicarSorteo(client, doc);
            res.json({ success: true, sorteo: doc });
        } catch (e) { console.error('POST sorteo:', e.message); res.status(400).json({ error: 'No se pudo crear' }); }
    });

    app.post('/api/sorteos/:id/terminar', async (req, res) => {
        try {
            const s = await Sorteo.findById(req.params.id);
            if (!s) return res.status(404).json({ error: 'No encontrado' });
            if (!puedeGestionar(req, s.guildId)) return res.status(403).json({ error: 'Sin permiso' });
            if (!s.activo) return res.status(400).json({ error: 'Ya ha terminado' });
            await comunidad.finalizarSorteo(client, s);
            res.json({ success: true });
        } catch (e) { console.error('Terminar sorteo:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.post('/api/sorteos/:id/reroll', async (req, res) => {
        try {
            const s = await Sorteo.findById(req.params.id);
            if (!s) return res.status(404).json({ error: 'No encontrado' });
            if (!puedeGestionar(req, s.guildId)) return res.status(403).json({ error: 'Sin permiso' });
            if (!s.participantes.length) return res.status(400).json({ error: 'No hubo participantes' });
            await comunidad.finalizarSorteo(client, s, { reroll: true });
            res.json({ success: true });
        } catch (e) { console.error('Reroll sorteo:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    // Lista de participantes de un sorteo, resolviendo los IDs a nombres/avatares.
    app.get('/api/sorteos/:id/participantes', async (req, res) => {
        try {
            const s = await Sorteo.findById(req.params.id);
            if (!s) return res.status(404).json({ error: 'No encontrado' });
            if (!puedeGestionar(req, s.guildId)) return res.status(403).json({ error: 'Sin permiso' });
            const guild = client.guilds.cache.get(s.guildId);
            const ids = (s.participantes || []).slice(0, 1000);

            // Resolver en bloque (más rápido que uno a uno); con respaldo a la caché.
            const miembros = new Map();
            if (guild && ids.length) {
                try {
                    const col = await guild.members.fetch({ user: ids });
                    col.forEach((m) => miembros.set(m.id, m));
                } catch {
                    ids.forEach((uid) => { const m = guild.members.cache.get(uid); if (m) miembros.set(uid, m); });
                }
            }
            const out = ids.map((uid) => {
                const m = miembros.get(uid);
                return { id: uid, tag: m?.user?.tag || uid, avatar: m?.user?.displayAvatarURL?.({ size: 64 }) || null };
            });
            res.json(out);
        } catch (e) { console.error('GET participantes sorteo:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.delete('/api/sorteos/:id', async (req, res) => {
        try {
            const s = await Sorteo.findById(req.params.id);
            if (!s) return res.status(404).json({ error: 'No encontrado' });
            if (!puedeGestionar(req, s.guildId)) return res.status(403).json({ error: 'Sin permiso' });
            await s.deleteOne();
            res.json({ success: true });
        } catch (e) { console.error('DELETE sorteo:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    // ===================== EVENTOS =====================
    app.get('/api/eventos', async (req, res) => {
        try { res.json(await Evento.find(filtroGuild(req)).sort({ fechaInicio: 1 }).limit(100)); }
        catch (e) { console.error('GET eventos:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.post('/api/eventos', async (req, res) => {
        try {
            const b = req.body || {};
            const guildId = String(b.guildId || '');
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            if (!guild.channels.cache.get(String(b.canalId))) return res.status(400).json({ error: 'Canal no válido' });
            const fecha = fechaFutura(b.fechaInicio);
            if (!fecha) return res.status(400).json({ error: 'La fecha debe ser futura' });
            if (!b.titulo) return res.status(400).json({ error: 'Falta el título' });

            const doc = await Evento.create({
                guildId,
                canalId: String(b.canalId),
                titulo: String(b.titulo).slice(0, 100),
                descripcion: String(b.descripcion || '').slice(0, 500),
                tipo: ['voz', 'escenario', 'externo'].includes(b.tipo) ? b.tipo : 'voz',
                portada: b.portada || null,
                fechaInicio: fecha,
                recordatorio: Math.max(0, parseInt(b.recordatorio, 10) || 0),
                creadoPor: (req.staff && req.staff.username) || 'Panel Web',
            });
            await comunidad.publicarEvento(client, doc);
            res.json({ success: true, evento: doc });
        } catch (e) { console.error('POST evento:', e.message); res.status(400).json({ error: 'No se pudo crear' }); }
    });

    app.delete('/api/eventos/:id', async (req, res) => {
        try {
            const e = await Evento.findById(req.params.id);
            if (!e) return res.status(404).json({ error: 'No encontrado' });
            if (!puedeGestionar(req, e.guildId)) return res.status(403).json({ error: 'Sin permiso' });
            await e.deleteOne();
            res.json({ success: true });
        } catch (e) { console.error('DELETE evento:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    // ===================== ENCUESTAS =====================
    app.get('/api/encuestas', async (req, res) => {
        try { res.json(await Encuesta.find(filtroGuild(req)).sort({ creadoFecha: -1 }).limit(100)); }
        catch (e) { console.error('GET encuestas:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.post('/api/encuestas', async (req, res) => {
        try {
            const b = req.body || {};
            const guildId = String(b.guildId || '');
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            if (!guild.channels.cache.get(String(b.canalId))) return res.status(400).json({ error: 'Canal no válido' });
            const fecha = fechaFutura(b.fechaFin);
            if (!fecha) return res.status(400).json({ error: 'La fecha debe ser futura' });
            const opciones = (Array.isArray(b.opciones) ? b.opciones : [])
                .map((o) => String(o).trim()).filter(Boolean).slice(0, 10);
            if (!b.pregunta || opciones.length < 2) return res.status(400).json({ error: 'Pon una pregunta y al menos 2 opciones' });

            const doc = await Encuesta.create({
                guildId,
                canalId: String(b.canalId),
                pregunta: String(b.pregunta).slice(0, 200),
                opciones: opciones.map((texto) => ({ texto })),
                multiple: !!b.multiple,
                anonima: !!b.anonima,
                fechaFin: fecha,
                creadoPor: (req.staff && req.staff.username) || 'Panel Web',
            });
            await comunidad.publicarEncuesta(client, doc);
            res.json({ success: true, encuesta: doc });
        } catch (e) { console.error('POST encuesta:', e.message); res.status(400).json({ error: 'No se pudo crear' }); }
    });

    app.delete('/api/encuestas/:id', async (req, res) => {
        try {
            const enc = await Encuesta.findById(req.params.id);
            if (!enc) return res.status(404).json({ error: 'No encontrado' });
            if (!puedeGestionar(req, enc.guildId)) return res.status(403).json({ error: 'Sin permiso' });
            await enc.deleteOne();
            res.json({ success: true });
        } catch (e) { console.error('DELETE encuesta:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    // ===================== SUGERENCIAS =====================
    app.get('/api/sugerencias', async (req, res) => {
        try { res.json(await Sugerencia.find(filtroGuild(req)).sort({ creadoFecha: -1 }).limit(200)); }
        catch (e) { console.error('GET sugerencias:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.put('/api/sugerencias/:id', async (req, res) => {
        try {
            const sug = await Sugerencia.findById(req.params.id);
            if (!sug) return res.status(404).json({ error: 'No encontrado' });
            if (!puedeGestionar(req, sug.guildId)) return res.status(403).json({ error: 'Sin permiso' });
            const estado = req.body?.estado;
            if (['pendiente', 'revision', 'aceptada', 'rechazada'].includes(estado)) {
                sug.estado = estado;
                await sug.save();
                await comunidad.refrescarSugerencia(client, sug).catch(() => {});
            }
            res.json({ success: true, sugerencia: sug });
        } catch (e) { console.error('PUT sugerencia:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.delete('/api/sugerencias/:id', async (req, res) => {
        try {
            const sug = await Sugerencia.findById(req.params.id);
            if (!sug) return res.status(404).json({ error: 'No encontrado' });
            if (!puedeGestionar(req, sug.guildId)) return res.status(403).json({ error: 'Sin permiso' });
            await sug.deleteOne();
            res.json({ success: true });
        } catch (e) { console.error('DELETE sugerencia:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.put('/api/config/:guildId/sugerencias', async (req, res) => {
        try {
            const b = req.body || {};
            const set = { canalSugerencias: b.canalSugerencias || null };
            if (b.sugerenciasModo !== undefined) set.sugerenciasModo = ['mensaje', 'formulario'].includes(b.sugerenciasModo) ? b.sugerenciasModo : 'mensaje';
            if (b.sugerenciasPlantilla !== undefined) set.sugerenciasPlantilla = String(b.sugerenciasPlantilla || '').slice(0, 1000);
            if (b.sugerenciasMinLong !== undefined) set.sugerenciasMinLong = Math.max(0, parseInt(b.sugerenciasMinLong, 10) || 0);
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId }, { $set: set }, { returnDocument: 'after', upsert: true },
            );
            // Si es modo formulario, publica el panel y bloquea el canal.
            if (config.sugerenciasModo === 'formulario') {
                await comunidad.publicarPanelSugerencias(client, req.params.guildId, config).catch(() => {});
            }
            res.json({ success: true, config });
        } catch (e) { console.error('Config sugerencias:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });

    // ===================== PRESENTACIONES =====================
    app.get('/api/presentaciones', async (req, res) => {
        try { res.json(await Presentacion.find(filtroGuild(req)).sort({ creadoFecha: -1 }).limit(200)); }
        catch (e) { console.error('GET presentaciones:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.delete('/api/presentaciones/:id', async (req, res) => {
        try {
            const p = await Presentacion.findById(req.params.id);
            if (!p) return res.status(404).json({ error: 'No encontrado' });
            if (!puedeGestionar(req, p.guildId)) return res.status(403).json({ error: 'Sin permiso' });
            await p.deleteOne();
            res.json({ success: true });
        } catch (e) { console.error('DELETE presentacion:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.put('/api/config/:guildId/presentaciones', async (req, res) => {
        try {
            const b = req.body || {};
            const set = {
                'presentaciones.activo': true,
                'presentaciones.canalIntro': b.canalIntro || null,
                'presentaciones.canalStaff': b.canalStaff || null,
                'presentaciones.modo': ['preguntas', 'plantilla'].includes(b.modo) ? b.modo : 'preguntas',
                'presentaciones.plantilla': String(b.plantilla || '').slice(0, 1500),
                'presentaciones.preguntas': Array.isArray(b.preguntas) ? b.preguntas.slice(0, 10) : [],
                'presentaciones.filtros': Array.isArray(b.filtros) ? b.filtros.slice(0, 20) : [],
            };
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId }, { $set: set }, { returnDocument: 'after', upsert: true },
            );
            // Publicar/refrescar el panel de presentación en el canal de intro.
            await comunidad.publicarPanelPresentacion(client, req.params.guildId, config).catch(() => {});
            res.json({ success: true, config });
        } catch (e) { console.error('Config presentaciones:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });

    // ===================== DINÁMICAS =====================
    // Esquema de campos EDITABLES por dinámica (los de estado interno —idx, lastDia,
    // proxima, encontrada…— se omiten a propósito para que el panel no los pise).
    //   bool: activo/flags · int: [min,max,def] · str: texto (o null) · strArr / numArr.
    const DINAMICAS_CAMPOS = {
        qotd: { activo: 'bool', canalId: 'str', hora: [0, 23, 12], xp: [0, 100000, 50], oro: [0, 1000000, 0], mencionRolId: 'str', preguntas: 'strArr' },
        gota: { activo: 'bool', canalId: 'str', cadaMin: [1, 10080, 120], ventanaSeg: [5, 3600, 60], xp: [0, 100000, 75], oro: [0, 1000000, 0], emoji: 'str' },
        contador: { activo: 'bool', canalId: 'str', repetirUsuario: 'bool', xp: [0, 100000, 1], borrarErrores: 'bool' },
        trivia: { activo: 'bool', canalId: 'str', hora: [0, 23, 18], xp: [0, 100000, 30], oro: [0, 1000000, 0], segundos: [5, 600, 30] },
        reto: { activo: 'bool', canalId: 'str', objetivo: [1, 100000, 20], xp: [0, 100000, 40], oro: [0, 1000000, 0], avisarCanalId: 'str' },
        tesoro: { activo: 'bool', canalId: 'str', palabra: 'str', xp: [0, 100000, 60], oro: [0, 1000000, 0], mensajeExito: 'str', unaVez: 'bool' },
        miembroSemana: { activo: 'bool', canalId: 'str', rolId: 'str', dia: [0, 6, 1], hora: [0, 23, 12], xp: [0, 100000, 200], oro: [0, 1000000, 0] },
        logros: { activo: 'bool', canalId: 'str', hitosMiembros: 'numArr', hitosNivel: 'numArr' },
    };

    function sanearCampo(tipo, valor) {
        if (tipo === 'bool') return !!valor;
        if (tipo === 'str') return (valor === '' || valor == null) ? null : String(valor).slice(0, 1000);
        if (tipo === 'strArr') return (Array.isArray(valor) ? valor : []).map((v) => String(v).trim()).filter(Boolean).slice(0, 200);
        if (tipo === 'numArr') return (Array.isArray(valor) ? valor : []).map((v) => parseInt(v, 10)).filter((n) => Number.isFinite(n) && n > 0).slice(0, 50);
        if (Array.isArray(tipo)) { const [min, max, def] = tipo; const n = parseInt(valor, 10); return Number.isNaN(n) ? def : Math.min(max, Math.max(min, n)); }
        return valor;
    }

    // Guarda la configuración de una o varias dinámicas. Acepta { qotd:{...}, ... }.
    app.put('/api/config/:guildId/dinamicas', async (req, res) => {
        try {
            if (!puedeGestionar(req, req.params.guildId)) return res.status(403).json({ error: 'Sin permiso' });
            const b = req.body || {};
            const set = {};
            for (const [dyn, campos] of Object.entries(DINAMICAS_CAMPOS)) {
                const entrada = b[dyn];
                if (!entrada || typeof entrada !== 'object') continue;
                for (const [campo, tipo] of Object.entries(campos)) {
                    if (entrada[campo] === undefined) continue;
                    set[`dinamicas.${dyn}.${campo}`] = sanearCampo(tipo, entrada[campo]);
                }
                // Si cambian la palabra secreta o reactivan el tesoro, reiniciamos la caza.
                if (dyn === 'tesoro' && (entrada.palabra !== undefined || entrada.activo === true)) {
                    set['dinamicas.tesoro.encontrada'] = false;
                    set['dinamicas.tesoro.encontradaPor'] = null;
                }
            }
            if (!Object.keys(set).length) return res.status(400).json({ error: 'Nada que guardar' });
            const config = await ServidorConfig.findOneAndUpdate(
                { guildId: req.params.guildId }, { $set: set }, { returnDocument: 'after', upsert: true },
            );
            res.json({ success: true, config });
        } catch (e) { console.error('Config dinámicas:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });

    // ----- Banco de preguntas de Trivia -----
    app.get('/api/trivia', async (req, res) => {
        try { res.json(await TriviaPregunta.find(filtroGuild(req)).sort({ creadoFecha: -1 }).limit(500)); }
        catch (e) { console.error('GET trivia:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.post('/api/trivia', async (req, res) => {
        try {
            const b = req.body || {};
            const guildId = String(b.guildId || '');
            if (!puedeGestionar(req, guildId)) return res.status(403).json({ error: 'Sin permiso' });
            const opciones = (Array.isArray(b.opciones) ? b.opciones : []).map((o) => String(o).trim()).filter(Boolean).slice(0, 4);
            const correcta = parseInt(b.correcta, 10) || 0;
            if (!b.pregunta || opciones.length < 2) return res.status(400).json({ error: 'Pon una pregunta y al menos 2 opciones' });
            if (correcta < 0 || correcta >= opciones.length) return res.status(400).json({ error: 'Marca cuál es la opción correcta' });
            const doc = await TriviaPregunta.create({
                guildId,
                pregunta: String(b.pregunta).slice(0, 300),
                opciones,
                correcta,
                categoria: String(b.categoria || '').slice(0, 50),
                creadoPor: (req.staff && req.staff.username) || 'Panel Web',
            });
            res.json({ success: true, pregunta: doc });
        } catch (e) { console.error('POST trivia:', e.message); res.status(400).json({ error: 'No se pudo crear' }); }
    });

    app.delete('/api/trivia/:id', async (req, res) => {
        try {
            const p = await TriviaPregunta.findById(req.params.id);
            if (!p) return res.status(404).json({ error: 'No encontrado' });
            if (!puedeGestionar(req, p.guildId)) return res.status(403).json({ error: 'Sin permiso' });
            await p.deleteOne();
            res.json({ success: true });
        } catch (e) { console.error('DELETE trivia:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });
};
