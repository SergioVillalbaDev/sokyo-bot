// ============================================================================
// Rutas del panel para las funciones de la 1.9.0: cumpleaños, salón de la fama,
// buscar grupo, clanes, confesiones, solicitudes, modo ausente, mensajes fijos y
// canales con contadores. Todas van bajo /api/config/:guildId/modulos/…: así el
// staff solo llega a sus servidores (middleware de api/server.js).
// ============================================================================
const express = require('express');
const ServidorConfig = require('../../models/ServidorConfig.js');
const Grupo = require('../../models/Grupo.js');
const Clan = require('../../models/Clan.js');
const Confesion = require('../../models/Confesion.js');
const Solicitud = require('../../models/Solicitud.js');
const MensajeFijo = require('../../models/MensajeFijo.js');
const Log = require('../../models/Log.js');
const { errorRolesNuevos } = require('../../utils/permisos.js');

const MAX_FIJOS = 15;
const MAX_CONTADORES = 6;
const MAX_FORMULARIOS = 10;

const entero = (v, min, max, defecto) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defecto;
};
const texto = (v, max) => String(v ?? '').slice(0, max);

module.exports = ({ client, exigeArea, tieneAreaAcceso }) => {
    const router = express.Router();
    const ruta = (r) => `/config/:guildId/modulos/${r}`;

    const guildDe = (req, res) => {
        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild) res.status(404).json({ error: 'Servidor no encontrado' });
        return guild;
    };
    const cfgDe = async (guildId) => (await ServidorConfig.findOne({ guildId })) || ServidorConfig.create({ guildId });
    // Canal de texto / categoría / rol del servidor, o null. `undefined` si no se envía; `false` si no vale.
    const canalDe = (guild, id) => {
        if (id === undefined) return undefined;
        if (!id) return null;
        const c = guild.channels.cache.get(String(id));
        return c && c.isTextBased() && !c.isThread() ? c.id : false;
    };
    const categoriaDe = (guild, id) => {
        if (id === undefined) return undefined;
        if (!id) return null;
        const c = guild.channels.cache.get(String(id));
        return c && c.type === 4 ? c.id : false; // 4 = categoría
    };
    const rolDe = (guild, id) => {
        if (id === undefined) return undefined;
        if (!id) return null;
        const r = guild.roles.cache.get(String(id));
        return r && r.id !== guild.id && !r.managed ? r.id : false;
    };
    const usuario = async (guild, id) => {
        const m = guild.members.cache.get(id) || await guild.members.fetch(id).catch(() => null);
        const u = m ? m.user : await client.users.fetch(id).catch(() => null);
        return { id, nombre: (m && m.displayName) || (u && (u.globalName || u.username)) || id, avatar: u ? u.displayAvatarURL({ size: 64 }) : null };
    };
    // Aplica `set` (rutas con puntos) y devuelve la config nueva.
    const guardar = (guildId, set) => ServidorConfig.findOneAndUpdate({ guildId }, { $set: set }, { returnDocument: 'after', upsert: true });
    // Errores de validación comunes: canal que no vale, rol que no vale.
    const ponerCanal = (set, clave, guild, valor, res) => {
        const c = canalDe(guild, valor);
        if (c === false) { res.status(400).json({ error: 'Ese canal no existe o no es de texto' }); return false; }
        if (c !== undefined) set[clave] = c;
        return true;
    };

    // ============================== CUMPLEAÑOS ==============================
    router.get(ruta('cumpleanos'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await cfgDe(guild.id);
            const { proximos } = require('../../utils/cumpleanos.js');
            const lista = await proximos(guild, 30);
            res.json({
                config: cfg.cumpleanos,
                nivelesActivo: !!cfg.nivelesActivo,
                proximos: lista.map((c) => ({ userId: c.userId, nombre: c.member.displayName, avatar: c.member.user.displayAvatarURL({ size: 64 }), dia: c.dia, mes: c.mes, faltan: c.faltan })),
            });
        } catch (e) { console.error('GET cumpleaños:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });
    router.put(ruta('cumpleanos'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const cfg = await cfgDe(guild.id);
            const set = {};
            if (b.activo !== undefined) set['cumpleanos.activo'] = !!b.activo;
            if (!ponerCanal(set, 'cumpleanos.canalId', guild, b.canalId, res)) return;
            const rol = rolDe(guild, b.rolId);
            if (rol === false) return res.status(400).json({ error: 'Ese rol no existe o no se puede dar' });
            if (rol !== undefined && rol !== cfg.cumpleanos.rolId) {
                // Elegir qué rol da el bot es cosa de quien gestiona los roles.
                if (!(await tieneAreaAcceso(req, guild.id, 'roles'))) return res.status(403).json({ error: 'Para elegir el rol hace falta acceso a la sección de roles del panel' });
                const err = await errorRolesNuevos(client, req.staff, guild.id, [rol], [cfg.cumpleanos.rolId]);
                if (err) return res.status(403).json({ error: err });
                set['cumpleanos.rolId'] = rol;
            }
            if (b.hora !== undefined) set['cumpleanos.hora'] = entero(b.hora, 0, 23, 9);
            if (b.mensaje !== undefined) set['cumpleanos.mensaje'] = texto(b.mensaje, 1000).trim() || cfg.cumpleanos.mensaje;
            if (b.oro !== undefined) set['cumpleanos.oro'] = entero(b.oro, 0, 1000000, 0);
            if (b.xp !== undefined) set['cumpleanos.xp'] = entero(b.xp, 0, 100000, 0);
            const nueva = await guardar(guild.id, set);
            res.json({ success: true, config: nueva.cumpleanos });
        } catch (e) { console.error('PUT cumpleaños:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });
    // Mensaje de prueba (con quien lo pulsa), sin dar rol ni regalo.
    router.post(ruta('cumpleanos/probar'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await cfgDe(guild.id);
            const canal = cfg.cumpleanos.canalId ? guild.channels.cache.get(cfg.cumpleanos.canalId) : null;
            if (!canal || !canal.isTextBased()) return res.status(400).json({ error: 'Elige antes el canal de los cumpleaños' });
            const yo = req.staff ? await guild.members.fetch(req.staff.id).catch(() => null) : null;
            const miembro = yo || guild.members.me;
            const { rellenar } = require('../../utils/cumpleanos.js');
            await canal.send({ content: `🧪 ${rellenar(cfg.cumpleanos.mensaje, miembro, guild)}`.slice(0, 2000), allowedMentions: { parse: [] } });
            res.json({ success: true });
        } catch (e) { res.status(400).json({ error: e.message || 'No se pudo enviar' }); }
    });

    // =========================== SALÓN DE LA FAMA ===========================
    router.get(ruta('salon'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await cfgDe(guild.id);
            const { ultimos } = require('../../utils/salonFama.js');
            const lista = await ultimos(guild.id, 30);
            res.json({
                config: cfg.salonFama,
                ultimos: await Promise.all(lista.map(async (x) => ({
                    id: x.mensajeId, estrellas: x.estrellas, fecha: x.fecha, canalId: x.canalId,
                    autor: x.autorId ? await usuario(guild, x.autorId) : null,
                    url: `https://discord.com/channels/${guild.id}/${x.canalId}/${x.mensajeId}`,
                }))),
            });
        } catch (e) { console.error('GET salón:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });
    router.put(ruta('salon'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const set = {};
            if (b.activo !== undefined) set['salonFama.activo'] = !!b.activo;
            if (!ponerCanal(set, 'salonFama.canalId', guild, b.canalId, res)) return;
            if (b.emoji !== undefined) {
                const e = texto(b.emoji, 64).trim();
                const valido = /^<a?:\w{2,32}:\d{15,22}>$/.test(e) || (/^\p{Extended_Pictographic}/u.test(e) && [...e].length <= 4);
                if (!valido) return res.status(400).json({ error: 'Elige un emoji (por ejemplo ⭐)' });
                set['salonFama.emoji'] = e;
            }
            if (b.minimo !== undefined) set['salonFama.minimo'] = entero(b.minimo, 1, 100, 3);
            if (b.propios !== undefined) set['salonFama.propios'] = !!b.propios;
            if (Array.isArray(b.canalesExentos)) set['salonFama.canalesExentos'] = b.canalesExentos.map(String).filter((id) => guild.channels.cache.has(id)).slice(0, 50);
            const nueva = await guardar(guild.id, set);
            res.json({ success: true, config: nueva.salonFama });
        } catch (e) { console.error('PUT salón:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });

    // ============================= BUSCAR GRUPO =============================
    const grupoJson = async (guild, g) => ({
        id: String(g._id), juego: g.juego, plazas: g.plazas, miembros: g.miembros.length, estado: g.estado, cuando: g.cuando,
        creador: await usuario(guild, g.creadorId), fecha: g.creadoFecha, salaVozId: g.salaVozId,
        url: g.mensajeId ? `https://discord.com/channels/${guild.id}/${g.canalId}/${g.mensajeId}` : null,
    });
    router.get(ruta('grupos'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await cfgDe(guild.id);
            const lista = await Grupo.find({ guildId: guild.id }).sort({ creadoFecha: -1 }).limit(30);
            res.json({ config: cfg.grupos, grupos: await Promise.all(lista.map((g) => grupoJson(guild, g))) });
        } catch (e) { console.error('GET grupos:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });
    router.put(ruta('grupos'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const set = {};
            if (b.activo !== undefined) set['grupos.activo'] = !!b.activo;
            if (!ponerCanal(set, 'grupos.canalId', guild, b.canalId, res)) return;
            if (b.crearSala !== undefined) set['grupos.crearSala'] = !!b.crearSala;
            const cat = categoriaDe(guild, b.categoriaId);
            if (cat === false) return res.status(400).json({ error: 'Esa categoría no existe' });
            if (cat !== undefined) set['grupos.categoriaId'] = cat;
            if (b.horasCaducidad !== undefined) set['grupos.horasCaducidad'] = entero(b.horasCaducidad, 1, 72, 6);
            const nueva = await guardar(guild.id, set);
            res.json({ success: true, config: nueva.grupos });
        } catch (e) { console.error('PUT grupos:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });
    router.post(ruta('grupos/:id/cerrar'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const g = await Grupo.findOne({ _id: req.params.id, guildId: guild.id }).catch(() => null);
            if (!g) return res.status(404).json({ error: 'No encontrado' });
            g.estado = 'cerrado';
            await g.save();
            const { mensajeGrupo } = require('../../utils/grupos.js');
            const canal = guild.channels.cache.get(g.canalId);
            const msg = canal && g.mensajeId ? await canal.messages.fetch(g.mensajeId).catch(() => null) : null;
            if (msg) await msg.edit(mensajeGrupo(g, await cfgDe(guild.id))).catch(() => {});
            res.json({ success: true });
        } catch (e) { console.error('Cerrar grupo:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    // ================================ CLANES ================================
    router.get(ruta('clanes'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await cfgDe(guild.id);
            const lista = await Clan.find({ guildId: guild.id }).sort({ puntosSemana: -1, puntosTotal: -1 }).limit(100).lean();
            res.json({
                config: cfg.clanes,
                nivelesActivo: !!cfg.nivelesActivo,
                clanes: await Promise.all(lista.map(async (c) => ({
                    id: String(c._id), nombre: c.nombre, emoji: c.emoji, miembros: c.miembros.length,
                    puntosSemana: c.puntosSemana, puntosTotal: c.puntosTotal, victorias: c.victorias,
                    lider: await usuario(guild, c.liderId), fecha: c.creadoFecha,
                }))),
            });
        } catch (e) { console.error('GET clanes:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });
    router.put(ruta('clanes'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const set = {};
            if (b.activo !== undefined) set['clanes.activo'] = !!b.activo;
            if (!ponerCanal(set, 'clanes.canalId', guild, b.canalId, res)) return;
            if (b.maxMiembros !== undefined) set['clanes.maxMiembros'] = entero(b.maxMiembros, 2, 100, 10);
            if (b.costeCrear !== undefined) set['clanes.costeCrear'] = entero(b.costeCrear, 0, 1000000, 0);
            if (b.premioOro !== undefined) set['clanes.premioOro'] = entero(b.premioOro, 0, 1000000, 100);
            if (b.premioXp !== undefined) set['clanes.premioXp'] = entero(b.premioXp, 0, 100000, 0);
            const nueva = await guardar(guild.id, set);
            res.json({ success: true, config: nueva.clanes });
        } catch (e) { console.error('PUT clanes:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });
    router.delete(ruta('clanes/:id'), exigeArea('moderacion'), async (req, res) => {
        try {
            const r = await Clan.deleteOne({ _id: req.params.id, guildId: req.params.guildId }).catch(() => ({ deletedCount: 0 }));
            if (!r.deletedCount) return res.status(404).json({ error: 'No encontrado' });
            res.json({ success: true });
        } catch (e) { console.error('DELETE clan:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    // ============================= CONFESIONES ==============================
    const confesionJson = (c) => ({ id: String(c._id), numero: c.numero, texto: c.texto, estado: c.estado, fecha: c.fecha, revisadoPor: c.revisadoPor });
    router.get(ruta('confesiones'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await cfgDe(guild.id);
            const lista = await Confesion.find({ guildId: guild.id }).sort({ fecha: -1 }).limit(100).lean();
            res.json({ config: cfg.confesiones, confesiones: lista.map(confesionJson) });
        } catch (e) { console.error('GET confesiones:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });
    router.put(ruta('confesiones'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const set = {};
            if (b.activo !== undefined) set['confesiones.activo'] = !!b.activo;
            if (!ponerCanal(set, 'confesiones.canalId', guild, b.canalId, res)) return;
            if (!ponerCanal(set, 'confesiones.canalRevisionId', guild, b.canalRevisionId, res)) return;
            if (b.escribirEnCanal !== undefined) set['confesiones.escribirEnCanal'] = !!b.escribirEnCanal;
            if (!ponerCanal(set, 'confesiones.canalEscrituraId', guild, b.canalEscrituraId, res)) return;
            const nueva = await guardar(guild.id, set);
            res.json({ success: true, config: nueva.confesiones });
        } catch (e) { console.error('PUT confesiones:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });
    router.post(ruta('confesiones/:id/revisar'), exigeArea('moderacion'), async (req, res) => {
        try {
            const c = await Confesion.findOne({ _id: req.params.id, guildId: req.params.guildId }).catch(() => null);
            if (!c) return res.status(404).json({ error: 'No encontrada' });
            const r = await require('../../utils/confesiones.js').revisar(client, c._id, !!(req.body && req.body.aprobar), (req.staff && req.staff.username) || 'Panel Web');
            if (!r.ok) return res.status(409).json({ error: r.error === 'ya' ? 'Ya estaba revisada' : r.error });
            res.json({ success: true, confesion: confesionJson(r.doc) });
        } catch (e) { console.error('Revisar confesión:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });
    // Quitar una confesión ya publicada (por ejemplo, ofensiva): se borra de Discord.
    router.delete(ruta('confesiones/:id'), exigeArea('moderacion'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const c = await Confesion.findOne({ _id: req.params.id, guildId: guild.id }).catch(() => null);
            if (!c) return res.status(404).json({ error: 'No encontrada' });
            const cfg = await cfgDe(guild.id);
            const canal = cfg.confesiones.canalId ? guild.channels.cache.get(cfg.confesiones.canalId) : null;
            if (canal && c.mensajeId) await canal.messages.delete(c.mensajeId).catch(() => {});
            c.estado = 'rechazada';
            c.revisadoPor = (req.staff && req.staff.username) || 'Panel Web';
            await c.save();
            res.json({ success: true, confesion: confesionJson(c) });
        } catch (e) { console.error('Quitar confesión:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });
    // Ver quién la escribió: solo con acceso a Moderación, y queda en el registro.
    router.post(ruta('confesiones/:id/autor'), exigeArea('moderacion'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const c = await Confesion.findOne({ _id: req.params.id, guildId: guild.id }).catch(() => null);
            if (!c) return res.status(404).json({ error: 'No encontrada' });
            const autor = await usuario(guild, c.autorId);
            const quien = (req.staff && req.staff.username) || 'Panel Web';
            const log = await Log.create({
                guildId: guild.id, categoria: 'Moderación', accion: '🕵️ Autor de una confesión consultado',
                usuario: quien, detalles: `${quien} vio quién escribió la confesión ${c.numero ? `#${c.numero}` : '(sin publicar)'}`, color: '#a855f7',
            });
            require('../../utils/logsManager.js').enviarLogADiscord(client, log).catch(() => {});
            res.json({ success: true, autor });
        } catch (e) { console.error('Autor confesión:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    // ============================= SOLICITUDES ==============================
    const solicitudJson = async (guild, s) => ({
        id: String(s._id), formularioId: s.formularioId, formulario: s.formularioNombre, estado: s.estado, motivo: s.motivo,
        respuestas: s.respuestas, fecha: s.fecha, revisadoPor: s.revisadoPor, usuario: await usuario(guild, s.userId),
    });
    // Primero todas las que esperan (hasta 200) y después las últimas ya revisadas.
    router.get(ruta('solicitudes'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await cfgDe(guild.id);
            const [pendientes, revisadas] = await Promise.all([
                Solicitud.find({ guildId: guild.id, estado: 'pendiente' }).sort({ fecha: 1 }).limit(200).lean(),
                Solicitud.find({ guildId: guild.id, estado: { $ne: 'pendiente' } }).sort({ fechaRevision: -1, fecha: -1 }).limit(50).lean(),
            ]);
            res.json({ config: cfg.solicitudes, solicitudes: await Promise.all([...pendientes, ...revisadas].map((s) => solicitudJson(guild, s))) });
        } catch (e) { console.error('GET solicitudes:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });
    const areaRoles = exigeArea('roles');
    router.put(ruta('solicitudes'), areaRoles, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const cfg = await cfgDe(guild.id);
            const set = {};
            if (b.activo !== undefined) set['solicitudes.activo'] = !!b.activo;
            if (!ponerCanal(set, 'solicitudes.canalId', guild, b.canalId, res)) return;
            if (!ponerCanal(set, 'solicitudes.canalRevisionId', guild, b.canalRevisionId, res)) return;
            if (b.titulo !== undefined) set['solicitudes.titulo'] = texto(b.titulo, 200).trim() || cfg.solicitudes.titulo;
            if (b.descripcion !== undefined) set['solicitudes.descripcion'] = texto(b.descripcion, 2000);
            if (Array.isArray(b.formularios)) {
                const vistos = new Set();
                const forms = [];
                for (const f of b.formularios.slice(0, MAX_FORMULARIOS)) {
                    if (!f || typeof f !== 'object') continue;
                    const nombre = texto(f.nombre, 80).trim();
                    if (!nombre) continue;
                    let id = /^[a-z0-9]{4,20}$/.test(String(f.id || '')) ? String(f.id) : Math.random().toString(36).slice(2, 10);
                    while (vistos.has(id)) id = Math.random().toString(36).slice(2, 10);
                    vistos.add(id);
                    const rol = rolDe(guild, f.rolId || null);
                    if (rol === false) return res.status(400).json({ error: `El rol del formulario «${nombre}» no existe o no se puede dar` });
                    forms.push({
                        id, nombre,
                        emoji: texto(f.emoji, 64).trim() || '📝',
                        descripcion: texto(f.descripcion, 200),
                        preguntas: (Array.isArray(f.preguntas) ? f.preguntas : []).map((p) => texto(p, 300).trim()).filter(Boolean).slice(0, 5),
                        rolId: rol || null,
                        abierto: f.abierto !== false,
                        esperaDias: entero(f.esperaDias, 0, 365, 7),
                        mensajeAceptado: texto(f.mensajeAceptado, 1000),
                    });
                }
                // Los roles los da el bot al aceptar: misma regla de jerarquía que el resto del panel.
                const err = await errorRolesNuevos(client, req.staff, guild.id, forms.map((f) => f.rolId), (cfg.solicitudes.formularios || []).map((f) => f.rolId));
                if (err) return res.status(403).json({ error: err });
                set['solicitudes.formularios'] = forms;
            }
            const nueva = await guardar(guild.id, set);
            res.json({ success: true, config: nueva.solicitudes });
        } catch (e) { console.error('PUT solicitudes:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });
    router.post(ruta('solicitudes/publicar'), areaRoles, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const r = await require('../../utils/solicitudes.js').publicarPanel(client, guild.id);
            if (!r.ok) return res.status(400).json({ error: r.error });
            res.json({ success: true, url: r.url });
        } catch (e) { console.error('Publicar solicitudes:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });
    router.post(ruta('solicitudes/:id/resolver'), areaRoles, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const s = await Solicitud.findOne({ _id: req.params.id, guildId: guild.id }).catch(() => null);
            if (!s) return res.status(404).json({ error: 'No encontrada' });
            const b = req.body || {};
            const r = await require('../../utils/solicitudes.js').resolver(client, s._id, { aceptar: !!b.aceptar, motivo: texto(b.motivo, 500), revisor: (req.staff && req.staff.username) || 'Panel Web' });
            if (!r.ok) return res.status(409).json({ error: 'Ya estaba revisada' });
            const avisos = { rol: 'Aceptada, pero el bot no ha podido darle el rol (¿está por encima del rol del bot?).', fuera: 'Aceptada, pero ya no está en el servidor.' };
            res.json({ success: true, aviso: r.aviso ? avisos[r.aviso] : null, solicitud: await solicitudJson(guild, r.solicitud) });
        } catch (e) { console.error('Resolver solicitud:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    // ============================= MODO AUSENTE =============================
    router.get(ruta('ausente'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await cfgDe(guild.id);
            const lista = await require('../../utils/ausente.js').ausentesDe(guild.id);
            res.json({
                config: cfg.ausente,
                ausentes: await Promise.all(lista.slice(0, 100).map(async (a) => ({ ...(await usuario(guild, a.userId)), motivo: a.motivo, desde: a.desde, menciones: a.menciones || 0 }))),
            });
        } catch (e) { console.error('GET ausente:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });
    router.put(ruta('ausente'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const set = {};
            if (b.activo !== undefined) set['ausente.activo'] = !!b.activo;
            if (b.cambiarApodo !== undefined) set['ausente.cambiarApodo'] = !!b.cambiarApodo;
            const nueva = await guardar(guild.id, set);
            res.json({ success: true, config: nueva.ausente });
        } catch (e) { console.error('PUT ausente:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });
    router.delete(ruta('ausente/:userId'), async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            await require('../../utils/ausente.js').quitarAusente(guild, String(req.params.userId));
            res.json({ success: true });
        } catch (e) { console.error('Quitar ausente:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    // ============================ MENSAJES FIJOS ============================
    const areaMensajes = exigeArea('mensajes');
    const fijoJson = (f) => ({ id: String(f._id), canalId: f.canalId, titulo: f.titulo, texto: f.texto, color: f.color, comoEmbed: f.comoEmbed, activo: f.activo, publicado: !!f.ultimoMensajeId });
    const datosFijo = (b) => ({
        titulo: texto(b.titulo, 200).trim(),
        texto: texto(b.texto, 3800),
        color: /^#[0-9a-f]{6}$/i.test(String(b.color || '')) ? String(b.color) : '#a855f7',
        comoEmbed: b.comoEmbed !== false,
        activo: b.activo !== false,
    });
    router.get(ruta('fijos'), areaMensajes, async (req, res) => {
        try {
            const lista = await MensajeFijo.find({ guildId: req.params.guildId }).sort({ createdAt: 1 }).lean();
            res.json({ fijos: lista.map(fijoJson), max: MAX_FIJOS });
        } catch (e) { console.error('GET fijos:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });
    router.post(ruta('fijos'), areaMensajes, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const canal = canalDe(guild, b.canalId);
            if (!canal) return res.status(400).json({ error: 'Elige un canal de texto' });
            const datos = datosFijo(b);
            if (!datos.titulo && !datos.texto.trim()) return res.status(400).json({ error: 'Escribe el mensaje' });
            if (await MensajeFijo.countDocuments({ guildId: guild.id }) >= MAX_FIJOS) return res.status(400).json({ error: `Como mucho ${MAX_FIJOS} mensajes fijos por servidor` });
            if (await MensajeFijo.exists({ guildId: guild.id, canalId: canal })) return res.status(409).json({ error: 'Ese canal ya tiene un mensaje fijo: edítalo' });
            const fijo = await MensajeFijo.create({ guildId: guild.id, canalId: canal, ...datos, creadoPor: (req.staff && req.staff.username) || 'Panel Web' });
            const fijos = require('../../utils/mensajesFijos.js');
            fijos.recordar(fijo);
            const aviso = fijo.activo && !(await fijos.publicar(client, fijo)) ? 'Guardado, pero el bot no puede escribir en ese canal.' : null;
            res.json({ success: true, aviso, fijo: fijoJson(await MensajeFijo.findById(fijo._id).lean()) });
        } catch (e) { console.error('POST fijo:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });
    router.put(ruta('fijos/:id'), areaMensajes, async (req, res) => {
        try {
            const fijo = await MensajeFijo.findOne({ _id: req.params.id, guildId: req.params.guildId }).catch(() => null);
            if (!fijo) return res.status(404).json({ error: 'No encontrado' });
            Object.assign(fijo, datosFijo({ ...fijoJson(fijo), ...(req.body || {}) }));
            if (!fijo.titulo && !fijo.texto.trim()) return res.status(400).json({ error: 'Escribe el mensaje' });
            await fijo.save();
            const fijos = require('../../utils/mensajesFijos.js');
            if (fijo.activo) { fijos.recordar(fijo); await fijos.publicar(client, fijo); } else await fijos.retirar(client, fijo);
            res.json({ success: true, fijo: fijoJson(await MensajeFijo.findById(fijo._id).lean()) });
        } catch (e) { console.error('PUT fijo:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });
    router.delete(ruta('fijos/:id'), areaMensajes, async (req, res) => {
        try {
            const fijo = await MensajeFijo.findOne({ _id: req.params.id, guildId: req.params.guildId }).catch(() => null);
            if (!fijo) return res.status(404).json({ error: 'No encontrado' });
            await require('../../utils/mensajesFijos.js').retirar(client, fijo);
            await fijo.deleteOne();
            res.json({ success: true });
        } catch (e) { console.error('DELETE fijo:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    // ========================= CANALES CON CONTADORES =======================
    const areaCrecimiento = exigeArea('crecimiento');
    const contadoresJson = (guild, cfg) => (cfg.contadoresCanal || []).map((c) => {
        const canal = guild.channels.cache.get(c.canalId);
        return { canalId: c.canalId, tipo: c.tipo, plantilla: c.plantilla, nombre: canal ? canal.name : null, existe: !!canal };
    });
    router.get(ruta('contadores'), areaCrecimiento, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const cfg = await cfgDe(guild.id);
            const { TIPOS } = require('../../utils/contadoresCanal.js');
            res.json({ contadores: contadoresJson(guild, cfg), tipos: TIPOS.map(([k, es, en]) => ({ id: k, es, en })), max: MAX_CONTADORES });
        } catch (e) { console.error('GET contadores:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });
    router.post(ruta('contadores'), areaCrecimiento, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const cfg = await cfgDe(guild.id);
            const cont = require('../../utils/contadoresCanal.js');
            if ((cfg.contadoresCanal || []).length >= MAX_CONTADORES) return res.status(400).json({ error: `Como mucho ${MAX_CONTADORES} contadores` });
            const tipo = cont.CLAVES.includes(b.tipo) ? b.tipo : 'miembros';
            const plantilla = texto(b.plantilla, 90).trim();
            if (plantilla && !plantilla.includes('{n}')) return res.status(400).json({ error: 'El nombre tiene que llevar {n}, que es donde va la cifra' });
            const categoria = categoriaDe(guild, b.categoriaId || null);
            let canal;
            try {
                canal = await cont.crearCanal(guild, { tipo, plantilla, categoriaId: categoria || null }, cfg);
            } catch (e) {
                return res.status(400).json({ error: e.code === 50013 ? 'El bot no tiene permiso para crear canales (Gestionar canales)' : 'No se pudo crear el canal' });
            }
            const nueva = await ServidorConfig.findOneAndUpdate(
                { guildId: guild.id },
                { $push: { contadoresCanal: { canalId: canal.id, tipo, plantilla: plantilla || cont.plantillaPorDefecto(tipo, cfg) } } },
                { returnDocument: 'after' },
            );
            res.json({ success: true, contadores: contadoresJson(guild, nueva) });
        } catch (e) { console.error('POST contador:', e.message); res.status(500).json({ error: 'No se pudo crear' }); }
    });
    router.put(ruta('contadores/:canalId'), areaCrecimiento, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const b = req.body || {};
            const cont = require('../../utils/contadoresCanal.js');
            const set = {};
            if (b.tipo !== undefined) { if (!cont.CLAVES.includes(b.tipo)) return res.status(400).json({ error: 'Tipo no válido' }); set['contadoresCanal.$.tipo'] = b.tipo; }
            if (b.plantilla !== undefined) {
                const p = texto(b.plantilla, 90).trim();
                if (!p.includes('{n}')) return res.status(400).json({ error: 'El nombre tiene que llevar {n}, que es donde va la cifra' });
                set['contadoresCanal.$.plantilla'] = p;
            }
            const nueva = await ServidorConfig.findOneAndUpdate({ guildId: guild.id, 'contadoresCanal.canalId': req.params.canalId }, { $set: set }, { returnDocument: 'after' });
            if (!nueva) return res.status(404).json({ error: 'No encontrado' });
            // Se pone al día enseguida si Discord lo deja (2 cambios cada 10 minutos).
            await cont.actualizarServidor(guild, nueva).catch(() => {});
            res.json({ success: true, contadores: contadoresJson(guild, nueva) });
        } catch (e) { console.error('PUT contador:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });
    router.delete(ruta('contadores/:canalId'), areaCrecimiento, async (req, res) => {
        try {
            const guild = guildDe(req, res); if (!guild) return;
            const antes = await cfgDe(guild.id);
            if (!(antes.contadoresCanal || []).some((c) => c.canalId === req.params.canalId)) return res.status(404).json({ error: 'No encontrado' });
            const nueva = await ServidorConfig.findOneAndUpdate({ guildId: guild.id }, { $pull: { contadoresCanal: { canalId: req.params.canalId } } }, { returnDocument: 'after' });
            // Solo se borra el canal si era un contador (nunca otro canal del servidor).
            if (req.query.borrarCanal === '1') {
                const canal = guild.channels.cache.get(req.params.canalId);
                if (canal) await canal.delete('Contador quitado desde el panel').catch(() => {});
            }
            res.json({ success: true, contadores: contadoresJson(guild, nueva) });
        } catch (e) { console.error('DELETE contador:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    return router;
};
