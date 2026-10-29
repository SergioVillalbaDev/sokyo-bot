const express = require('express');
const ActividadUsuario = require('../../models/ActividadUsuario.js');
const RegistroMensaje = require('../../models/RegistroMensaje.js');
const Ticket = require('../../models/Ticket.js');
const Mensaje = require('../../models/Mensaje.js');
const Item = require('../../models/Item.js');
const economia = require('../../utils/economia.js');
const { progreso } = require('../../utils/niveles.js');
const { contarActivas } = require('../../utils/invitaciones.js');
const { getConfigCached } = require('../../utils/config.js');

// "Mi cuenta" · pantalla de inicio del usuario: su resumen en todos los
// servidores con Sokyo (nivel, oro, invitaciones, tickets), la gráfica de
// actividad y la recompensa diaria con un clic.
const DIAS_GRAFICA = 14;
const MAX_SERVIDORES = 12;
const { HORAS_DAILY, HORAS_RACHA } = economia;

// Zona horaria del navegador (para agrupar los mensajes por SU día). Se valida
// con Intl y se devuelve con su nombre canónico ('europe/madrid' -> 'Europe/Madrid').
function zonaValida(tz) {
    if (typeof tz !== 'string' || !/^[A-Za-z0-9_+\-/]{1,64}$/.test(tz)) return null;
    try { return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone; } catch { return null; }
}

// Fecha 'YYYY-MM-DD' de `fecha` en la zona `tz`.
const diaEn = (fecha, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);

// Los últimos `n` días de calendario hasta hoy (en `tz`), del más antiguo al de hoy.
// Se cuenta sobre el calendario y no restando 24 h, que con los cambios de hora
// se saltaba o repetía un día.
function ultimosDias(n, tz, ahora = new Date()) {
    const [y, m, d] = diaEn(ahora, tz).split('-').map(Number);
    const dias = [];
    for (let i = n - 1; i >= 0; i--) dias.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
    return dias;
}

// Mensajes por día del usuario en todos sus servidores. Si la base de datos no
// conoce la zona (su lista de zonas puede ir por detrás de la del navegador,
// p. ej. 'Europe/Kyiv'), se cuenta en UTC en vez de dejar sin resumen.
async function serieActividad(userId, tz, n = DIAS_GRAFICA) {
    const dias = ultimosDias(n, tz);
    const desde = new Date(Date.now() - (n + 1) * 86400000);
    let filas;
    try {
        filas = await RegistroMensaje.aggregate([
            { $match: { userId, fecha: { $gte: desde } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha', timezone: tz } }, n: { $sum: 1 } } },
        ]);
    } catch (e) {
        if (tz === 'UTC') throw e;
        return serieActividad(userId, 'UTC', n);
    }
    const porDia = new Map(filas.map((f) => [f._id, f.n]));
    const serie = dias.map((dia) => ({ dia, mensajes: porDia.get(dia) || 0 }));
    // Cambio de la última semana frente a la anterior (null si no hay base).
    const mitad = Math.floor(n / 2);
    const antes = serie.slice(0, mitad).reduce((a, x) => a + x.mensajes, 0);
    const ahora = serie.slice(mitad).reduce((a, x) => a + x.mensajes, 0);
    const cambio = antes > 0 ? Math.round(((ahora - antes) / antes) * 100) : null;
    return { serie, semana: ahora, semanaAnterior: antes, cambio };
}

// Estado de la recompensa diaria sin reclamarla.
function estadoDaily(u, ahora = Date.now()) {
    if (!u.ultimoDaily) return { disponible: true, proximo: null, racha: 0 };
    const horas = (ahora - new Date(u.ultimoDaily).getTime()) / 3600000;
    return {
        disponible: horas >= HORAS_DAILY,
        proximo: horas >= HORAS_DAILY ? null : new Date(new Date(u.ultimoDaily).getTime() + HORAS_DAILY * 3600000),
        // Pasadas 48 h la racha se pierde al reclamar: se enseña ya a 0.
        racha: horas <= HORAS_RACHA ? (u.rachaDaily || 0) : 0,
    };
}

// Nivel, puesto e invitaciones en cada servidor (los de más XP primero).
async function servidoresDe(userId, client, actividades) {
    const filas = actividades
        .filter((a) => client.guilds.cache.has(a.guildId))
        .sort((a, b) => (b.xp || 0) - (a.xp || 0) || (b.mensajesTotal || 0) - (a.mensajesTotal || 0))
        .slice(0, MAX_SERVIDORES);
    return Promise.all(filas.map(async (a) => {
        const guild = client.guilds.cache.get(a.guildId);
        const cfg = await getConfigCached(a.guildId).catch(() => null);
        const niveles = !!cfg?.nivelesActivo;
        const p = progreso(a.xp || 0, cfg?.dificultad || 1);
        const [puesto, invitaciones] = await Promise.all([
            niveles ? ActividadUsuario.countDocuments({ guildId: a.guildId, xp: { $gt: a.xp || 0 } }).then((n) => n + 1) : null,
            cfg?.crecimiento?.invitaciones?.activo ? contarActivas(a.guildId, userId).catch(() => null) : null,
        ]);
        return {
            id: a.guildId,
            nombre: guild.name,
            icono: guild.iconURL({ size: 64 }),
            miembros: guild.memberCount,
            niveles,
            nivel: p.nivel,
            xp: a.xp || 0,
            xpActual: p.actual,
            xpNecesaria: p.necesaria,
            puesto,
            mensajes: a.mensajesTotal || 0,
            invitaciones,
            racha: a.retoRacha || 0,
            ultimoMensaje: a.ultimoMensajeFecha || null,
        };
    }));
}

// Último mensaje de cada ticket abierto: para avisar de respuestas nuevas.
async function ultimosMensajes(canalIds) {
    if (!canalIds.length) return new Map();
    const filas = await Mensaje.aggregate([
        { $match: { ticketId: { $in: canalIds } } },
        { $sort: { ticketId: 1, fecha: -1 } },
        { $group: { _id: '$ticketId', usuarioId: { $first: '$usuarioId' }, usuario: { $first: '$usuario' }, contenido: { $first: '$contenido' }, fecha: { $first: '$fecha' } } },
    ]);
    return new Map(filas.map((f) => [f._id, f]));
}

// Tickets abiertos del usuario (los 10 más recientes) con su último mensaje.
async function ticketsAbiertos(uid, client) {
    const abiertos = await Ticket.find({ creadorId: uid, estado: { $ne: 'Cerrado' } })
        .select('canalId guildId estado titulo motivo fechaCreacion').sort({ fechaCreacion: -1 }).limit(10).lean();
    const ultimos = await ultimosMensajes(abiertos.map((tk) => tk.canalId));
    return abiertos.map((tk) => {
        const m = ultimos.get(tk.canalId);
        return {
            canalId: tk.canalId,
            titulo: tk.titulo || tk.motivo,
            estado: tk.estado,
            fechaCreacion: tk.fechaCreacion,
            servidor: client.guilds.cache.get(tk.guildId)?.name || null,
            ultimo: m ? { mio: m.usuarioId === uid, usuario: m.usuario, contenido: String(m.contenido || '').slice(0, 140), fecha: m.fecha } : null,
        };
    });
}

// Objetos de la mochila que siguen existiendo (igual que la cuenta de la tienda).
async function contarObjetos(inventario = []) {
    if (!inventario.length) return 0;
    const vivos = new Set((await Item.find({ _id: { $in: inventario.map((e) => e.item) } }).select('_id').lean()).map((i) => String(i._id)));
    return inventario.reduce((a, e) => a + (vivos.has(String(e.item)) ? (e.cantidad || 0) : 0), 0);
}

module.exports = ({ portalAuth, client, usuarioEsPremium }) => {
    const router = express.Router();

    router.get('/portal/resumen', portalAuth, async (req, res) => {
        try {
            const uid = req.usuario.id;
            const tz = zonaValida(req.query.tz) || 'Europe/Madrid';
            const [u, actividades, total, abiertos, recientes, actividad, esPremium] = await Promise.all([
                economia.obtenerUsuario(uid),
                ActividadUsuario.find({ userId: uid }).select('guildId xp mensajesTotal ultimoMensajeFecha retoRacha').lean(),
                Ticket.countDocuments({ creadorId: uid }),
                Ticket.countDocuments({ creadorId: uid, estado: { $ne: 'Cerrado' } }),
                ticketsAbiertos(uid, client),
                serieActividad(uid, tz),
                usuarioEsPremium(uid).catch(() => false),
            ]);
            const [servidores, objetos] = await Promise.all([servidoresDe(uid, client, actividades), contarObjetos(u.inventory)]);
            const boost = u.boostXp && u.boostXp.expiraEn && new Date(u.boostXp.expiraEn) > new Date() && (u.boostXp.multiplicador || 1) > 1
                ? { multiplicador: u.boostXp.multiplicador, expiraEn: u.boostXp.expiraEn } : null;

            res.json({
                usuario: { id: uid, username: req.usuario.username, avatar: req.usuario.avatar, esPremium },
                oro: u.balance || 0,
                objetos,
                boost,
                daily: estadoDaily(u),
                totales: {
                    mensajes: actividades.reduce((a, x) => a + (x.mensajesTotal || 0), 0),
                    xp: actividades.reduce((a, x) => a + (x.xp || 0), 0),
                    nivelMax: servidores.reduce((a, s) => Math.max(a, s.niveles ? s.nivel : 0), 0),
                    servidores: actividades.filter((a) => client.guilds.cache.has(a.guildId)).length,
                    invitaciones: servidores.reduce((a, s) => a + (s.invitaciones || 0), 0),
                },
                actividad,
                servidores,
                // Abiertos con su último mensaje: la web avisa si es de otra persona.
                tickets: { total, abiertos, recientes },
                sorteos: await sorteosGanados(uid).catch(() => []),
            });
        } catch (e) {
            console.error('portal/resumen:', e);
            res.status(500).json({ error: 'No se pudo cargar tu resumen.' });
        }
    });

    // Sorteos que ha ganado en las últimas 2 semanas (aviso en la campana).
    async function sorteosGanados(uid) {
        const Sorteo = require('../../models/Sorteo.js');
        const desde = new Date(Date.now() - 14 * 86400000);
        const lista = await Sorteo.find({ 'ganadoresSeleccionados.id': uid, activo: false, fechaFin: { $gte: desde } })
            .select('guildId canalId mensajeId nombre premio fechaFin').sort({ fechaFin: -1 }).limit(10).lean();
        return lista.map((s) => ({
            id: String(s._id), nombre: s.nombre, premio: s.premio, fecha: s.fechaFin,
            servidor: client.guilds.cache.get(s.guildId)?.name || '',
            enlace: s.mensajeId ? `https://discord.com/channels/${s.guildId}/${s.canalId}/${s.mensajeId}` : null,
        }));
    }

    // Solo los avisos (respuestas en tickets abiertos y sorteos ganados): lo que la
    // web consulta cada minuto, sin recalcular el resumen entero.
    router.get('/portal/avisos', portalAuth, async (req, res) => {
        try {
            const [recientes, sorteos] = await Promise.all([ticketsAbiertos(req.usuario.id, client), sorteosGanados(req.usuario.id).catch(() => [])]);
            res.json({ recientes, sorteos });
        } catch (e) {
            console.error('portal/avisos:', e);
            res.status(500).json({ error: 'No se pudieron cargar los avisos.' });
        }
    });

    // Mis sanciones: avisos, aislamientos, expulsiones y bans en los servidores donde
    // está el bot (sin decir qué moderador fue: solo qué, cuándo y por qué).
    router.get('/portal/sanciones', portalAuth, async (req, res) => {
        try {
            const Sancion = require('../../models/Sancion.js');
            const lista = await Sancion.find({ usuarioId: req.usuario.id }).sort({ fecha: -1 }).limit(60).lean();
            const ahora = Date.now();
            res.json(lista.map((s) => {
                const fin = s.duracionMin > 0 ? new Date(new Date(s.fecha).getTime() + s.duracionMin * 60000) : null;
                // quitada (la deshizo el staff) · activa (ban o aislamiento en vigor) ·
                // terminada (ya pasó) · registrada (un aviso o una expulsión: queda apuntado).
                let estado = 'registrada';
                if (s.revocada) estado = 'quitada';
                else if (s.accion === 'ban') estado = s.activa ? 'activa' : 'terminada';
                else if (s.accion === 'timeout') estado = fin && fin.getTime() > ahora ? 'activa' : 'terminada';
                return {
                    id: String(s._id), servidor: client.guilds.cache.get(s.guildId)?.name || '', accion: s.accion,
                    motivo: s.motivo || '', fecha: s.fecha, duracionMin: s.duracionMin || 0, fin, estado,
                };
            }));
        } catch (e) {
            console.error('portal/sanciones:', e);
            res.status(500).json({ error: 'No se pudieron cargar tus sanciones.' });
        }
    });

    // Mis preferencias del bot (las mismas que /preferencias en Discord).
    router.get('/portal/preferencias', portalAuth, async (req, res) => {
        try {
            res.json(await require('../../utils/preferencias.js').preferenciasDe(req.usuario.id));
        } catch (e) {
            console.error('portal/preferencias:', e);
            res.status(500).json({ error: 'No se pudieron cargar tus preferencias.' });
        }
    });
    router.put('/portal/preferencias', portalAuth, async (req, res) => {
        try {
            const { idioma, dms } = req.body || {};
            res.json(await require('../../utils/preferencias.js').guardarPreferencias(req.usuario.id, { idioma, dms }));
        } catch (e) {
            console.error('portal/preferencias (guardar):', e);
            res.status(500).json({ error: 'No se pudieron guardar tus preferencias.' });
        }
    });

    // Mi cumpleaños (el mismo que /cumple: vale en todos los servidores).
    router.get('/portal/cumple', portalAuth, async (req, res) => {
        try {
            const c = await require('../../utils/cumpleanos.js').cumpleDe(req.usuario.id);
            res.json(c ? { dia: c.dia, mes: c.mes } : { dia: null, mes: null });
        } catch (e) {
            console.error('portal/cumple:', e);
            res.status(500).json({ error: 'No se pudo cargar tu cumpleaños.' });
        }
    });
    router.put('/portal/cumple', portalAuth, async (req, res) => {
        try {
            const cumple = require('../../utils/cumpleanos.js');
            const { dia, mes } = req.body || {};
            if (dia === null || mes === null || dia === '' || mes === '') {
                await cumple.borrarCumple(req.usuario.id);
                return res.json({ dia: null, mes: null });
            }
            const r = await cumple.guardarCumple(req.usuario.id, dia, mes);
            if (!r.ok) return res.status(400).json({ error: 'Esa fecha no existe.' });
            res.json({ dia: r.dia, mes: r.mes });
        } catch (e) {
            console.error('portal/cumple (guardar):', e);
            res.status(500).json({ error: 'No se pudo guardar tu cumpleaños.' });
        }
    });

    // Recompensa diaria desde la web (la misma que /daily: el oro es global).
    router.post('/portal/daily', portalAuth, async (req, res) => {
        try {
            const r = await economia.reclamarDaily(req.usuario.id);
            if (!r.ok) return res.status(409).json({ error: 'Ya la has reclamado hace poco.', esperaHoras: r.esperaHoras, proximo: new Date(Date.now() + r.esperaHoras * 3600000) });
            res.json({ success: true, total: r.total, racha: r.racha, jackpot: r.jackpot, balance: r.balance });
        } catch (e) {
            console.error('portal/daily:', e);
            res.status(500).json({ error: 'No se pudo reclamar la recompensa.' });
        }
    });

    return router;
};

module.exports.zonaValida = zonaValida;
module.exports.ultimosDias = ultimosDias;
module.exports.estadoDaily = estadoDaily;
module.exports.serieActividad = serieActividad;
