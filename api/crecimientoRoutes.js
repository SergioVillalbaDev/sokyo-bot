// Rutas del panel para la sección Crecimiento (invitaciones, bump de DISBOARD,
// página pública y avisos de directos). Se montan desde api/server.js DESPUÉS del
// middleware de auth: al ir bajo /api/config/:guildId, el staff solo llega a sus
// servidores, y exigeArea('crecimiento') respeta "quién ve cada sección".
const ServidorConfig = require('../models/ServidorConfig.js');
const FuenteDirecto = require('../models/FuenteDirecto.js');
const Bump = require('../models/Bump.js');
const { errorRolesNuevos } = require('../utils/permisos.js');
const invitaciones = require('../utils/invitaciones.js');
const bump = require('../utils/bump.js');
const pagina = require('../utils/paginaPublica.js');
const directos = require('../utils/directos.js');

const entero = (v, min, max, defecto) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defecto;
};
const texto = (v, max) => String(v ?? '').slice(0, max);

module.exports = function montarRutasCrecimiento(app, client, { exigeArea }) {
    const area = exigeArea('crecimiento');
    const ruta = (r) => `/api/config/:guildId/crecimiento/${r}`;

    // Canal de texto / rol del servidor, o null. `undefined` si no se envía.
    const canalDe = (guild, id) => {
        if (id === undefined) return undefined;
        if (!id) return null;
        const c = guild.channels.cache.get(String(id));
        return c && c.isTextBased() ? c.id : false;
    };
    const rolDe = (guild, id) => {
        if (id === undefined) return undefined;
        if (!id) return null;
        const r = guild.roles.cache.get(String(id));
        return r && r.id !== guild.id && !r.managed ? r.id : false;
    };
    const guildDe = (req, res) => {
        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild) res.status(404).json({ error: 'Servidor no encontrado' });
        return guild;
    };
    const cfgDe = async (guildId) => (await ServidorConfig.findOne({ guildId })) || ServidorConfig.create({ guildId });
    const usuario = async (id) => {
        const u = id ? await client.users.fetch(id).catch(() => null) : null;
        return u ? { id: u.id, nombre: u.globalName || u.username, avatar: u.displayAvatarURL({ size: 64 }) } : { id, nombre: '', avatar: null };
    };

    // ============================ INVITACIONES ============================
    app.get(ruta('invitaciones'), area, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await cfgDe(guild.id);
            const [resumen, top, ultimas] = await Promise.all([
                invitaciones.resumen(guild.id, 30),
                invitaciones.ranking(guild.id, 10),
                invitaciones.recientes(guild.id, 20),
            ]);
            res.json({
                config: cfg.crecimiento.invitaciones,
                permiso: invitaciones.puedeVerInvitaciones(guild),
                resumen,
                ranking: await Promise.all(top.map(async (f) => {
                    const u = await usuario(f.userId);
                    return { ...f, ...u, nombre: u.nombre || f.tag };
                })),
                recientes: ultimas.map((r) => ({
                    id: String(r._id), invitado: r.invitadoTag, invitadoId: r.invitadoId, invitador: r.invitadorTag, invitadorId: r.invitadorId,
                    fuente: r.fuente, estado: r.estado, fecha: r.fechaEntrada, seFue: r.seFue,
                })),
            });
        } catch (e) { console.error('GET invitaciones:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.put(ruta('invitaciones'), area, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const cfg = await cfgDe(guild.id);
            const actual = cfg.crecimiento.invitaciones;
            const set = {};
            if (b.activo !== undefined) set['crecimiento.invitaciones.activo'] = !!b.activo;
            const canal = canalDe(guild, b.canalAvisosId);
            if (canal === false) return res.status(400).json({ error: 'Ese canal no existe o no es de texto' });
            if (canal !== undefined) set['crecimiento.invitaciones.canalAvisosId'] = canal;
            if (b.mensaje !== undefined) set['crecimiento.invitaciones.mensaje'] = texto(b.mensaje, 500).trim() || actual.mensaje;
            if (b.horasConfirmacion !== undefined) set['crecimiento.invitaciones.horasConfirmacion'] = entero(b.horasConfirmacion, 0, 168, 24);
            if (b.diasCuentaMin !== undefined) set['crecimiento.invitaciones.diasCuentaMin'] = entero(b.diasCuentaMin, 0, 365, 7);
            if (b.oroPorInvitacion !== undefined) set['crecimiento.invitaciones.oroPorInvitacion'] = entero(b.oroPorInvitacion, 0, 10000, 50);
            if (b.xpPorInvitacion !== undefined) set['crecimiento.invitaciones.xpPorInvitacion'] = entero(b.xpPorInvitacion, 0, 100000, 0);
            if (Array.isArray(b.recompensas)) {
                const vistos = new Set();
                const recompensas = b.recompensas
                    .map((r) => ({ invitaciones: entero(r && r.invitaciones, 1, 10000, 0), rolId: rolDe(guild, r && r.rolId) }))
                    .filter((r) => r.invitaciones > 0 && r.rolId && !vistos.has(r.rolId) && vistos.add(r.rolId))
                    .sort((a, b2) => a.invitaciones - b2.invitaciones)
                    .slice(0, 20);
                // Los roles los da el bot: misma regla de jerarquía que en el resto del panel.
                // Cuenta como nuevo un rol que no estaba o que ahora se da con MENOS invitaciones.
                const antes = {};
                for (const r of actual.recompensas || []) antes[r.rolId] = Math.min(antes[r.rolId] ?? Infinity, r.invitaciones);
                const nuevos = recompensas.filter((r) => !(r.invitaciones >= (antes[r.rolId] ?? Infinity))).map((r) => r.rolId);
                const err = await errorRolesNuevos(client, req.staff, guild.id, nuevos, []);
                if (err) return res.status(403).json({ error: err });
                set['crecimiento.invitaciones.recompensas'] = recompensas;
            }
            const nueva = await ServidorConfig.findOneAndUpdate({ guildId: guild.id }, { $set: set }, { returnDocument: 'after' });
            let permiso = true;
            if (nueva.crecimiento.invitaciones.activo) permiso = await invitaciones.cargarInvitaciones(guild);
            res.json({ success: true, config: nueva.crecimiento.invitaciones, permiso });
        } catch (e) { console.error('PUT invitaciones:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });

    // ================================ BUMP ================================
    app.get(ruta('bump'), area, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await cfgDe(guild.id);
            const c = cfg.crecimiento.bump;
            const hace30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
            const [mes, total, disboard] = await Promise.all([
                bump.rankingBumps(guild.id, { desde: hace30, limite: 10 }),
                Bump.countDocuments({ guildId: guild.id }),
                guild.members.fetch(bump.DISBOARD_ID).then(() => true).catch(() => false),
            ]);
            res.json({
                config: {
                    activo: c.activo, canalId: c.canalId, rolId: c.rolId, oroPorBump: c.oroPorBump,
                    mensajeRecordatorio: c.mensajeRecordatorio, mensajeGracias: c.mensajeGracias,
                },
                estado: { proximoBump: c.proximoBump, recordado: c.recordado, ultimoBumpPor: await usuario(c.ultimoBumpPor), ultimoBumpFecha: c.ultimoBumpFecha, ultimoCanalId: c.ultimoCanalId },
                disboard,
                total,
                ranking: await Promise.all(mes.map(async (f) => ({ ...f, ...(await usuario(f.userId)) }))),
            });
        } catch (e) { console.error('GET bump:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.put(ruta('bump'), area, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const cfg = await cfgDe(guild.id);
            const actual = cfg.crecimiento.bump;
            const set = {};
            if (b.activo !== undefined) set['crecimiento.bump.activo'] = !!b.activo;
            const canal = canalDe(guild, b.canalId);
            if (canal === false) return res.status(400).json({ error: 'Ese canal no existe o no es de texto' });
            if (canal !== undefined) set['crecimiento.bump.canalId'] = canal;
            const rol = rolDe(guild, b.rolId);
            if (rol === false) return res.status(400).json({ error: 'Ese rol no existe o no se puede mencionar' });
            if (rol !== undefined) set['crecimiento.bump.rolId'] = rol;
            if (b.oroPorBump !== undefined) set['crecimiento.bump.oroPorBump'] = entero(b.oroPorBump, 0, 10000, 25);
            if (b.mensajeRecordatorio !== undefined) set['crecimiento.bump.mensajeRecordatorio'] = texto(b.mensajeRecordatorio, 500).trim() || actual.mensajeRecordatorio;
            if (b.mensajeGracias !== undefined) set['crecimiento.bump.mensajeGracias'] = texto(b.mensajeGracias, 500).trim() || actual.mensajeGracias;
            const nueva = await ServidorConfig.findOneAndUpdate({ guildId: guild.id }, { $set: set }, { returnDocument: 'after' });
            res.json({ success: true, config: nueva.crecimiento.bump });
        } catch (e) { console.error('PUT bump:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });

    // =========================== PÁGINA PÚBLICA ===========================
    // Dirección sugerida: el nombre del servidor, siempre válida y sin usar.
    const sugerirSlug = async (guild) => {
        const base = pagina.slugDe(guild.name);
        const opciones = [base, `${base}-${guild.id.slice(-4)}`, `servidor-${guild.id.slice(-6)}`].filter(pagina.slugValido);
        for (const s of opciones) {
            if (!(await ServidorConfig.exists({ 'crecimiento.pagina.slug': s, guildId: { $ne: guild.id } }))) return s;
        }
        return `servidor-${guild.id.slice(-8)}`;
    };
    const datosPagina = async (req, guild, p) => ({
        config: {
            activo: p.activo, slug: p.slug, descripcion: p.descripcion, etiquetas: p.etiquetas, listado: p.listado,
            mostrarRanking: p.mostrarRanking, mostrarEventos: p.mostrarEventos, canalInvitacionId: p.canalInvitacionId,
        },
        url: p.slug ? `${pagina.urlBase(req)}/s/${p.slug}` : null,
        base: `${pagina.urlBase(req)}/s/`,
        directorio: `${pagina.urlBase(req)}/servidores`,
        sugerido: p.slug ? null : await sugerirSlug(guild),
        invitacion: p.invitacionCodigo ? `https://discord.gg/${p.invitacionCodigo}` : null,
        visitas: p.visitas || 0,
        descripcionDiscord: guild.description || '',
    });

    app.get(ruta('pagina'), area, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await cfgDe(guild.id);
            res.json(await datosPagina(req, guild, cfg.crecimiento.pagina));
        } catch (e) { console.error('GET página pública:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.put(ruta('pagina'), area, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            await cfgDe(guild.id);
            const set = {};
            if (b.slug !== undefined) {
                const slug = String(b.slug || '').trim().toLowerCase();
                if (slug && !pagina.slugValido(slug)) {
                    return res.status(400).json({ error: 'La dirección debe tener entre 3 y 32 caracteres: letras minúsculas, números y guiones (sin guion al principio ni al final)' });
                }
                if (slug && await ServidorConfig.exists({ 'crecimiento.pagina.slug': slug, guildId: { $ne: guild.id } })) {
                    return res.status(409).json({ error: 'Esa dirección ya la usa otro servidor. Prueba con otra.' });
                }
                set['crecimiento.pagina.slug'] = slug || null;
            }
            if (b.descripcion !== undefined) set['crecimiento.pagina.descripcion'] = texto(b.descripcion, 1000).trim();
            if (b.etiquetas !== undefined) set['crecimiento.pagina.etiquetas'] = pagina.limpiarEtiquetas(b.etiquetas);
            for (const k of ['activo', 'listado', 'mostrarRanking', 'mostrarEventos']) if (b[k] !== undefined) set[`crecimiento.pagina.${k}`] = !!b[k];
            const canal = canalDe(guild, b.canalInvitacionId);
            if (canal === false) return res.status(400).json({ error: 'Ese canal no existe o no es de texto' });
            if (canal !== undefined) set['crecimiento.pagina.canalInvitacionId'] = canal;

            let nueva = await ServidorConfig.findOneAndUpdate({ guildId: guild.id }, { $set: set }, { returnDocument: 'after' });
            const p = nueva.crecimiento.pagina;
            if (p.activo && !p.slug) {
                await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { 'crecimiento.pagina.activo': false } });
                return res.status(400).json({ error: 'Elige una dirección para la página antes de publicarla' });
            }
            let aviso = null;
            if (p.activo) {
                const codigo = await pagina.asegurarInvitacion(client, guild, nueva, { forzar: true }).catch(() => null);
                if (!codigo) aviso = 'Página guardada, pero no he podido crear la invitación: dale al bot el permiso «Crear invitación» en algún canal de texto.';
                nueva = await ServidorConfig.findOne({ guildId: guild.id });
            }
            pagina.olvidarDirectorio();
            res.json({ success: true, aviso, ...(await datosPagina(req, guild, nueva.crecimiento.pagina)) });
        } catch (e) {
            if (e && e.code === 11000) return res.status(409).json({ error: 'Esa dirección ya la usa otro servidor. Prueba con otra.' });
            console.error('PUT página pública:', e.message);
            res.status(500).json({ error: 'No se pudo guardar' });
        }
    });

    // ============================== DIRECTOS ==============================
    const fuenteJson = (f) => ({
        id: String(f._id), tipo: f.tipo, externoId: f.externoId, nombre: f.nombre, url: f.url, avatar: f.avatar,
        enDirecto: f.enDirecto, ultimoAviso: f.ultimoAviso, ultimoError: f.ultimoError, pendientes: (f.pendientes || []).length,
    });

    app.get(ruta('directos'), area, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await cfgDe(guild.id);
            const fuentes = await FuenteDirecto.find({ guildId: guild.id }).sort({ creadoFecha: 1 });
            res.json({
                config: cfg.crecimiento.directos,
                fuentes: fuentes.map(fuenteJson),
                modoTwitch: directos.modoTwitch(),
                youtubeApi: !!process.env.YOUTUBE_API_KEY,
                max: directos.MAX_FUENTES,
            });
        } catch (e) { console.error('GET directos:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.put(ruta('directos'), area, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const cfg = await cfgDe(guild.id);
            const actual = cfg.crecimiento.directos;
            const set = {};
            if (b.activo !== undefined) set['crecimiento.directos.activo'] = !!b.activo;
            if (b.incluirShorts !== undefined) set['crecimiento.directos.incluirShorts'] = !!b.incluirShorts;
            const canal = canalDe(guild, b.canalId);
            if (canal === false) return res.status(400).json({ error: 'Ese canal no existe o no es de texto' });
            if (canal !== undefined) set['crecimiento.directos.canalId'] = canal;
            const rol = rolDe(guild, b.rolId);
            if (rol === false) return res.status(400).json({ error: 'Ese rol no existe o no se puede mencionar' });
            if (rol !== undefined) set['crecimiento.directos.rolId'] = rol;
            if (b.mensaje !== undefined) set['crecimiento.directos.mensaje'] = texto(b.mensaje, 500).trim() || actual.mensaje;
            if (b.mensajeVideo !== undefined) set['crecimiento.directos.mensajeVideo'] = texto(b.mensajeVideo, 500).trim() || actual.mensajeVideo;
            if (b.mensajePost !== undefined) set['crecimiento.directos.mensajePost'] = texto(b.mensajePost, 500).trim() || actual.mensajePost;
            const nueva = await ServidorConfig.findOneAndUpdate({ guildId: guild.id }, { $set: set }, { returnDocument: 'after' });
            if (nueva.crecimiento.directos.activo && !nueva.crecimiento.directos.canalId) {
                return res.json({ success: true, config: nueva.crecimiento.directos, aviso: 'Elige el canal donde publicar los avisos: sin él no se avisa de nada.' });
            }
            res.json({ success: true, config: nueva.crecimiento.directos });
        } catch (e) { console.error('PUT directos:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });

    app.post(ruta('directos/fuentes'), area, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const f = await directos.anadirFuente(guild.id, b.tipo, texto(b.entrada, 500), (req.staff && req.staff.username) || 'Panel Web');
            res.json({ success: true, fuente: fuenteJson(f) });
        } catch (e) {
            if (e && e.code === 11000) return res.status(409).json({ error: 'Ya está en la lista' });
            res.status(400).json({ error: e.message || 'No se pudo añadir' });
        }
    });

    app.delete(ruta('directos/fuentes/:id'), area, async (req, res) => {
        try {
            const r = await FuenteDirecto.deleteOne({ _id: req.params.id, guildId: req.params.guildId }).catch(() => ({ deletedCount: 0 }));
            if (!r.deletedCount) return res.status(404).json({ error: 'No encontrado' });
            res.json({ success: true });
        } catch (e) { console.error('DELETE fuente:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    app.post(ruta('directos/fuentes/:id/probar'), area, async (req, res) => {
        try {
            const f = await FuenteDirecto.findOne({ _id: req.params.id, guildId: req.params.guildId }).catch(() => null);
            if (!f) return res.status(404).json({ error: 'No encontrado' });
            await directos.probarFuente(client, f);
            res.json({ success: true });
        } catch (e) { res.status(400).json({ error: e.message || 'No se pudo enviar' }); }
    });
};
