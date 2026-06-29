// ============================================================================
// Analítica completa del servidor (función Pro). Radiografía comunidad,
// actividad, niveles, moderación y tickets, y genera INSIGHTS de crecimiento
// (recomendaciones accionables a partir de los datos).
//
// Fuentes: guild en vivo (miembros/canales/roles/boosts), Log (entradas/salidas),
// RegistroMensaje (actividad), ActividadUsuario (niveles/voz), Sancion, Reporte,
// Ticket. Todo acotado por guildId y, donde aplica, por la ventana de `dias`.
// ============================================================================
const Ticket = require('../models/Ticket.js');
const Log = require('../models/Log.js');
const RegistroMensaje = require('../models/RegistroMensaje.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const Sancion = require('../models/Sancion.js');
const Reporte = require('../models/Reporte.js');
const EstadisticaDiaria = require('../models/EstadisticaDiaria.js');
const EmbudoCohorte = require('../models/EmbudoCohorte.js');
const { esPro } = require('./billing.js');

const DIA = 24 * 60 * 60 * 1000;
const SEMANA = 7 * DIA;
const fmt = (d) => new Date(d).toISOString().slice(0, 10);

async function construirAnalitica(client, gid, cfg, dias) {
    const desde = new Date(Date.now() - dias * DIA);
    const guild = client && client.guilds.cache.get(gid);
    const cubos = [];
    for (let i = dias - 1; i >= 0; i--) cubos.push(fmt(Date.now() - i * DIA));
    const vacioDia = () => Object.fromEntries(cubos.map((d) => [d, 0]));

    const [
        tickets, logsDia, msgsDia, msgsHora, msgsCanal, topUsuarios,
        nivelesResumen, nivelesDist, topNiveles, sancionesDocs, topMods,
        reportePend, reporteTotal, activos, vozActivos, snapshots, saludDia,
        embudoDocs,
    ] = await Promise.all([
        Ticket.find({ guildId: gid }).select('estado prioridad motivo fechaCreacion fechaCierre valoracionCSAT asignadoNombre').lean(),
        Log.aggregate([
            { $match: { guildId: gid, categoria: { $in: ['Entradas', 'Salidas'] }, fecha: { $gte: desde } } },
            { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } }, c: '$categoria' }, n: { $sum: 1 } } },
        ]),
        RegistroMensaje.aggregate([
            { $match: { guildId: gid, fecha: { $gte: desde } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } }, n: { $sum: 1 } } },
        ]),
        RegistroMensaje.aggregate([
            { $match: { guildId: gid, fecha: { $gte: desde } } },
            { $group: { _id: { $hour: '$fecha' }, n: { $sum: 1 } } },
        ]),
        RegistroMensaje.aggregate([
            { $match: { guildId: gid, fecha: { $gte: desde }, canalId: { $ne: null } } },
            { $group: { _id: '$canalId', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 6 },
        ]),
        ActividadUsuario.find({ guildId: gid, mensajesTotal: { $gt: 0 } }).sort({ mensajesTotal: -1 }).limit(6).select('usuarioTag userId mensajesTotal').lean(),
        ActividadUsuario.aggregate([
            { $match: { guildId: gid } },
            { $group: { _id: null, total: { $sum: 1 }, conXp: { $sum: { $cond: [{ $gt: ['$xp', 0] }, 1, 0] } }, nivelMedio: { $avg: '$nivel' } } },
        ]),
        ActividadUsuario.aggregate([
            { $match: { guildId: gid, xp: { $gt: 0 } } },
            { $bucket: { groupBy: '$nivel', boundaries: [0, 1, 6, 11, 21, 100000], default: 'otros', output: { n: { $sum: 1 } } } },
        ]),
        ActividadUsuario.find({ guildId: gid, xp: { $gt: 0 } }).sort({ xp: -1 }).limit(5).select('usuarioTag userId nivel xp').lean(),
        Sancion.find({ guildId: gid, fecha: { $gte: desde } }).select('accion fecha moderadorTag usuarioTag').lean(),
        Sancion.aggregate([
            { $match: { guildId: gid, fecha: { $gte: desde } } },
            { $group: { _id: '$moderadorTag', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 5 },
        ]),
        Reporte.countDocuments({ guildId: gid, estado: 'pendiente' }),
        Reporte.countDocuments({ guildId: gid, fecha: { $gte: desde } }),
        ActividadUsuario.countDocuments({ guildId: gid, ultimoMensajeFecha: { $gte: desde } }),
        ActividadUsuario.countDocuments({ guildId: gid, ultimaVozFecha: { $gte: desde } }),
        EstadisticaDiaria.find({ guildId: gid, dia: { $in: cubos } }).select('dia miembros').lean(),
        Log.aggregate([
            { $match: { guildId: gid, categoria: { $in: ['Mensajes Borrados', 'Mensajes Editados'] }, fecha: { $gte: desde } } },
            { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } }, c: '$categoria' }, n: { $sum: 1 } } },
        ]),
        EmbudoCohorte.find({ guildId: gid, fechaEntrada: { $gte: desde } })
            .select('variante verificado participo fechaEntrada fechaPrimerMensaje sigueEnServidor').lean(),
    ]);

    // --- Comunidad: entradas / salidas por día ---
    const entradasMap = vacioDia(), salidasMap = vacioDia();
    for (const r of logsDia) {
        const d = r._id.d; if (!(d in entradasMap)) continue;
        if (r._id.c === 'Entradas') entradasMap[d] = r.n; else salidasMap[d] = r.n;
    }
    const totalEntradas = Object.values(entradasMap).reduce((a, b) => a + b, 0);
    const totalSalidas = Object.values(salidasMap).reduce((a, b) => a + b, 0);
    const crecimientoNeto = totalEntradas - totalSalidas;

    // --- Actividad: mensajes por día / hora / canal / usuario ---
    const msgDiaMap = vacioDia();
    for (const r of msgsDia) if (r._id in msgDiaMap) msgDiaMap[r._id] = r.n;
    const totalMensajes = Object.values(msgDiaMap).reduce((a, b) => a + b, 0);
    const horas = Array.from({ length: 24 }, (_, h) => ({ label: `${h}h`, n: 0 }));
    for (const r of msgsHora) if (typeof r._id === 'number' && horas[r._id]) horas[r._id].n = r.n;
    const horaPico = horas.reduce((m, c) => (c.n > m.n ? c : m), horas[0]);
    const nombreCanal = (id) => (guild && guild.channels.cache.get(id) && guild.channels.cache.get(id).name) || `#${String(id).slice(-4)}`;
    const topCanales = msgsCanal.map((r) => ({ nombre: nombreCanal(r._id), n: r.n }));
    const topUsuariosOut = topUsuarios.map((u) => ({
        nombre: u.usuarioTag || (guild && guild.members.cache.get(u.userId) && guild.members.cache.get(u.userId).displayName) || String(u.userId).slice(-4),
        n: u.mensajesTotal,
    }));

    // --- Niveles ---
    const nr = nivelesResumen[0] || { total: 0, conXp: 0, nivelMedio: 0 };
    const distMap = {};
    for (const b of nivelesDist) distMap[b._id] = b.n;
    const distribucionNiveles = [
        { nombre: 'Nivel 0', n: distMap[0] || 0 },
        { nombre: '1-5', n: distMap[1] || 0 },
        { nombre: '6-10', n: distMap[6] || 0 },
        { nombre: '11-20', n: distMap[11] || 0 },
        { nombre: '21+', n: (distMap[21] || 0) + (distMap.otros || 0) },
    ];
    const topNivelesOut = topNiveles.map((u) => ({ nombre: u.usuarioTag || String(u.userId).slice(-4), nivel: u.nivel, xp: u.xp }));

    // --- Moderación ---
    const modDiaMap = vacioDia(); const porTipo = {}; let automod = 0;
    for (const s of sancionesDocs) {
        const d = fmt(s.fecha); if (d in modDiaMap) modDiaMap[d]++;
        const a = s.accion || 'otro'; porTipo[a] = (porTipo[a] || 0) + 1;
        if (String(s.moderadorTag || '').toLowerCase() === 'automod') automod++;
    }
    const topModsOut = topMods.map((m) => ({ nombre: m._id || 'Desconocido', n: m.n }));

    // --- Tickets ---
    const tCreados = vacioDia(), tCerrados = vacioDia();
    let abiertos = 0, cerrados = 0, csatSum = 0, csatN = 0, cierreMs = 0, cierreN = 0;
    const porUrg = {}, porMotivo = {};
    for (const t of tickets) {
        if (t.fechaCreacion) { const d = fmt(t.fechaCreacion); if (d in tCreados) tCreados[d]++; }
        if (t.fechaCierre) {
            const d = fmt(t.fechaCierre); if (d in tCerrados) tCerrados[d]++;
            if (t.fechaCreacion) { cierreMs += new Date(t.fechaCierre) - new Date(t.fechaCreacion); cierreN++; }
        }
        if (t.estado === 'Cerrado') cerrados++; else abiertos++;
        const u = t.prioridad || 'Normal'; porUrg[u] = (porUrg[u] || 0) + 1;
        const m = t.motivo || 'Sin especificar'; porMotivo[m] = (porMotivo[m] || 0) + 1;
        if (typeof t.valoracionCSAT === 'number') { csatSum += t.valoracionCSAT; csatN++; }
    }
    const csat = csatN ? Math.round((csatSum / csatN) * 10) / 10 : null;
    const tiempoMedioCierreH = cierreN ? Math.round((cierreMs / cierreN) / 3600000 * 10) / 10 : null;

    // --- Salud del chat: mensajes borrados / editados por día ---
    const borradosMap = vacioDia(), editadosMap = vacioDia();
    for (const r of saludDia) {
        const d = r._id.d; if (!(d in borradosMap)) continue;
        if (r._id.c === 'Mensajes Borrados') borradosMap[d] = r.n; else editadosMap[d] = r.n;
    }
    const totalBorrados = Object.values(borradosMap).reduce((a, b) => a + b, 0);
    const totalEditados = Object.values(editadosMap).reduce((a, b) => a + b, 0);

    // --- Histórico de miembros (snapshots, con relleno hacia delante) ---
    const snapMap = {};
    for (const s of snapshots) snapMap[s.dia] = s.miembros;
    let ultimoMiembros = null, hayMiembros = false;
    const serieMiembros = cubos.map((d) => {
        if (snapMap[d] != null) { ultimoMiembros = snapMap[d]; hayMiembros = true; }
        return { fecha: d, miembros: ultimoMiembros };
    });

    // --- Rendimiento del equipo (agentes que atienden tickets) ---
    const agMap = {};
    for (const t of tickets) {
        const nombre = t.asignadoNombre;
        if (!nombre) continue;
        const ag = agMap[nombre] || (agMap[nombre] = { nombre, n: 0, cierreMs: 0, cierreN: 0, csatSum: 0, csatN: 0 });
        ag.n++;
        if (t.fechaCierre && t.fechaCreacion) { ag.cierreMs += new Date(t.fechaCierre) - new Date(t.fechaCreacion); ag.cierreN++; }
        if (typeof t.valoracionCSAT === 'number') { ag.csatSum += t.valoracionCSAT; ag.csatN++; }
    }
    const agentes = Object.values(agMap).sort((x, y) => y.n - x.n).slice(0, 5).map((ag) => ({
        nombre: ag.nombre, tickets: ag.n,
        cierreMedioH: ag.cierreN ? Math.round((ag.cierreMs / ag.cierreN) / 3600000 * 10) / 10 : null,
        csat: ag.csatN ? Math.round((ag.csatSum / ag.csatN) * 10) / 10 : null,
    }));

    // --- Top sancionados ---
    const sancMap = {};
    for (const s of sancionesDocs) { const k = s.usuarioTag || 'Desconocido'; sancMap[k] = (sancMap[k] || 0) + 1; }
    const topSancionados = Object.entries(sancMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nombre, n]) => ({ nombre, n }));

    const mensajesPorActivo = activos ? Math.round(totalMensajes / activos) : 0;

    // --- Servidor en vivo ---
    const miembros = guild ? guild.memberCount : null;
    const pctActivos = miembros ? Math.round((activos / miembros) * 100) : null;

    // --- Embudo de bienvenida A/B: retención y participación por variante ---
    const embudo = construirEmbudo(embudoDocs, cfg);

    const insights = construirInsights({
        dias, crecimientoNeto, totalEntradas, totalSalidas, pctActivos, activos, miembros,
        horaPico, topCanales, totalMensajes, csat, reportePend, tiempoMedioCierreH, abiertos,
        sancionesTotal: sancionesDocs.length, automod, nr,
        totalBorrados, totalEditados, agentes, vozActivos, mensajesPorActivo, hayMiembros, serieMiembros,
    });
    if (embudo.insight) insights.unshift(embudo.insight);

    return {
        esPro: esPro(cfg), dias,
        servidor: {
            nombre: guild ? guild.name : null,
            miembros,
            canales: guild ? guild.channels.cache.size : null,
            roles: guild ? guild.roles.cache.size : null,
            boosts: guild ? (guild.premiumSubscriptionCount || 0) : null,
            creado: guild ? guild.createdTimestamp : null,
        },
        resumen: {
            miembros, crecimientoNeto, mensajes: totalMensajes, activos, pctActivos,
            ticketsTotales: tickets.length, csat, sanciones: sancionesDocs.length,
            vozActivos, mensajesPorActivo,
        },
        comunidad: {
            serie: cubos.map((d) => ({ fecha: d, entradas: entradasMap[d], salidas: salidasMap[d] })),
            totalEntradas, totalSalidas, neto: crecimientoNeto,
            serieMiembros, hayMiembros,
        },
        actividad: {
            serie: cubos.map((d) => ({ fecha: d, n: msgDiaMap[d] })),
            total: totalMensajes, porHora: horas, horaPico: horaPico.label,
            topCanales, topUsuarios: topUsuariosOut, activos, pctActivos,
            vozActivos, mensajesPorActivo,
        },
        salud: {
            serie: cubos.map((d) => ({ fecha: d, borrados: borradosMap[d], editados: editadosMap[d] })),
            totalBorrados, totalEditados,
        },
        niveles: {
            total: nr.total, conXp: nr.conXp, nivelMedio: Math.round((nr.nivelMedio || 0) * 10) / 10,
            distribucion: distribucionNiveles, top: topNivelesOut,
        },
        equipo: { agentes },
        moderacion: {
            serie: cubos.map((d) => ({ fecha: d, n: modDiaMap[d] })),
            total: sancionesDocs.length,
            porTipo: Object.entries(porTipo).map(([nombre, n]) => ({ nombre, n })),
            topMods: topModsOut, topSancionados, automod, reportesPendientes: reportePend, reportesTotal: reporteTotal,
        },
        tickets: {
            serie: cubos.map((d) => ({ fecha: d, creados: tCreados[d], cerrados: tCerrados[d] })),
            totales: { total: tickets.length, abiertos, cerrados, csat, csatVotos: csatN, tiempoMedioCierreH },
            urgencias: Object.entries(porUrg).map(([nombre, n]) => ({ nombre, n })),
            topMotivos: Object.entries(porMotivo).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([nombre, n]) => ({ nombre, n })),
        },
        embudo,
        insights,
    };
}

// Calcula las métricas del Test A/B del embudo de bienvenida a partir de las
// fichas de cohorte. Por cada variante: cuántos entraron, se verificaron,
// participaron en su 1ª semana y siguen en el servidor (retención, medida solo
// sobre las cohortes "maduras": las que ya cumplieron 7 días). Determina la
// variante ganadora (por retención; si no hay datos maduros, por participación).
function construirEmbudo(docs, cfg) {
    const activo = !!(cfg && cfg.embudoAB && cfg.embudoAB.activo);
    const ahora = Date.now();
    const nombres = { A: 'Texto + captcha', B: 'Embed visual' };
    const base = () => ({ asignados: 0, verificados: 0, participaron: 0, maduros: 0, retenidos: 0 });
    const acc = { A: base(), B: base() };

    for (const d of docs || []) {
        const v = acc[d.variante];
        if (!v) continue;
        v.asignados++;
        if (d.verificado) v.verificados++;
        // Participación dentro de la primera semana desde la entrada.
        if (d.participo && d.fechaPrimerMensaje && d.fechaEntrada
            && (new Date(d.fechaPrimerMensaje) - new Date(d.fechaEntrada)) <= SEMANA) v.participaron++;
        // Retención: solo cuenta a quien ya tuvo tiempo de cumplir su 1ª semana.
        if (d.fechaEntrada && (ahora - new Date(d.fechaEntrada)) >= SEMANA) {
            v.maduros++;
            if (d.sigueEnServidor) v.retenidos++;
        }
    }

    const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : null);
    const fmtV = (k) => {
        const v = acc[k];
        return {
            clave: k, nombre: nombres[k],
            asignados: v.asignados,
            verificados: v.verificados, tasaVerificacion: pct(v.verificados, v.asignados),
            participaron: v.participaron, tasaParticipacion: pct(v.participaron, v.asignados),
            maduros: v.maduros, retenidos: v.retenidos, tasaRetencion: pct(v.retenidos, v.maduros),
        };
    };
    const A = fmtV('A'), B = fmtV('B');
    const total = A.asignados + B.asignados;

    // Ganadora: por retención si ambas tienen cohortes maduras; si no, por participación.
    let ganadora = null, metrica = null, confianza = 'baja';
    const usarRet = A.maduros > 0 && B.maduros > 0;
    const mA = usarRet ? A.tasaRetencion : A.tasaParticipacion;
    const mB = usarRet ? B.tasaRetencion : B.tasaParticipacion;
    if (A.asignados > 0 && B.asignados > 0 && mA != null && mB != null && mA !== mB) {
        ganadora = mA > mB ? 'A' : 'B';
        metrica = usarRet ? 'retencion' : 'participacion';
        // Confianza alta si hay muestra razonable en ambas variantes.
        const minMuestra = usarRet ? Math.min(A.maduros, B.maduros) : Math.min(A.asignados, B.asignados);
        confianza = minMuestra >= 10 ? 'alta' : 'baja';
    }

    // Insight accionable para el panel de Analítica.
    let insight = null;
    if (activo && total > 0) {
        if (ganadora) {
            const g = ganadora === 'A' ? A : B;
            const o = ganadora === 'A' ? B : A;
            const etqMetrica = metrica === 'retencion' ? '7-day retention' : 'first-week participation';
            const vG = metrica === 'retencion' ? g.tasaRetencion : g.tasaParticipacion;
            const vO = metrica === 'retencion' ? o.tasaRetencion : o.tasaParticipacion;
            insight = {
                tipo: 'ok',
                titulo: `A/B test: "${g.nombre}" wins`,
                texto: `Variant "${g.nombre}" achieves better ${etqMetrica} (${vG}% vs ${vO}% for "${o.nombre}").`
                    + (confianza === 'alta'
                        ? ` The sample is now reliable: consider rolling this variant out to everyone.`
                        : ` Still few data points: let the test run a few more days to confirm.`),
            };
        } else {
            insight = {
                tipo: 'tip',
                titulo: 'A/B test running',
                texto: `Your welcome funnel is splitting newcomers between two variants (${total} so far). In a few days you’ll see here which method retains better.`,
            };
        }
    }

    return { activo, hayDatos: total > 0, total, variantes: { A, B }, ganadora, metrica, confianza, insight };
}

// Convierte los números en recomendaciones accionables de crecimiento.
function construirInsights(d) {
    const out = [];
    if (d.totalEntradas + d.totalSalidas > 0) {
        if (d.crecimientoNeto < 0) out.push({ tipo: 'warn', titulo: 'You’re losing members', texto: `In ${d.dias} days ${d.totalEntradas} joined and ${d.totalSalidas} left (net ${d.crecimientoNeto}). Turn on the welcome message, autorole and verification, and post content in the first days to keep newcomers.` });
        else if (d.crecimientoNeto > 0) out.push({ tipo: 'ok', titulo: 'Your community is growing', texto: `Net +${d.crecimientoNeto} members in ${d.dias} days. Keep the momentum with recurring events and giveaways.` });
    }
    if (d.pctActivos != null) {
        if (d.pctActivos < 10) out.push({ tipo: 'warn', titulo: 'Few active members', texto: `Only ${d.pctActivos}% (${d.activos}) have spoken in ${d.dias} days. Run a giveaway, enable levels with role rewards and open topic channels to wake up the community.` });
        else if (d.pctActivos >= 30) out.push({ tipo: 'ok', titulo: 'Very active community', texto: `${d.pctActivos}% take part actively. Lock in that engagement with level roles and events.` });
    }
    if (d.totalMensajes > 0) out.push({ tipo: 'tip', titulo: 'Best time to post', texto: `Your activity peak is at ${d.horaPico} (UTC). Schedule announcements, events and giveaways at that time for maximum reach.` });
    if (d.topCanales && d.topCanales.length && d.totalMensajes > 0) {
        const top = d.topCanales[0];
        const pct = Math.round((top.n / d.totalMensajes) * 100);
        if (pct >= 60) out.push({ tipo: 'tip', titulo: 'Activity is very concentrated', texto: `${pct}% of messages are in "${top.nombre}". Spread activity out with topic channels and events so you don’t depend on a single channel.` });
    }
    if (d.csat != null) {
        if (d.csat < 3.5) out.push({ tipo: 'warn', titulo: 'Low satisfaction', texto: `Your average CSAT is ${d.csat}/5. Review the worst-rated tickets, use quick replies and cut down response times.` });
        else if (d.csat >= 4.5) out.push({ tipo: 'ok', titulo: 'Happy customers', texto: `CSAT of ${d.csat}/5. Excellent — ask for testimonials to use in your marketing.` });
    }
    if (d.tiempoMedioCierreH != null && d.tiempoMedioCierreH > 24) out.push({ tipo: 'tip', titulo: 'Tickets are slow to close', texto: `It takes you ${d.tiempoMedioCierreH}h on average to close a ticket. Turn on auto-assign, auto-close on inactivity and use macros to reply faster.` });
    if (d.reportePend > 0) out.push({ tipo: 'warn', titulo: 'Unresolved reports', texto: `You have ${d.reportePend} pending report(s). Handle them to keep the community healthy.` });
    if (d.abiertos > 5) out.push({ tipo: 'tip', titulo: 'Many open tickets', texto: `There are ${d.abiertos} open tickets. Spread the load with auto-assign to the support team.` });
    if (d.sancionesTotal > 0 && d.automod > 0) out.push({ tipo: 'ok', titulo: 'Automod is protecting you', texto: `The automoderator applied ${d.automod} of ${d.sancionesTotal} sanctions on its own. Good shield; check there are no false positives.` });
    if (d.nr && d.nr.total > 0 && d.nr.conXp === 0) out.push({ tipo: 'tip', titulo: 'Turn on the leveling system', texto: 'Nobody has XP yet. Levels with role rewards are one of the best ways to retain and engage your community.' });
    // Salud del chat
    if (d.totalMensajes > 50 && d.totalBorrados / d.totalMensajes > 0.15) out.push({ tipo: 'warn', titulo: 'Lots of message cleanup', texto: `${d.totalBorrados} messages were deleted (over 15% of the total). Review the rules and tune the automod (spam, links, words) to reduce the noise.` });
    // Reparto de carga del equipo
    if (d.agentes && d.agentes.length >= 2) {
        const totalAg = d.agentes.reduce((a, b) => a + b.tickets, 0);
        const top = d.agentes[0];
        if (totalAg > 0 && top.tickets / totalAg > 0.6) out.push({ tipo: 'tip', titulo: 'Uneven team workload', texto: `"${top.nombre}" handles ${Math.round((top.tickets / totalAg) * 100)}% of tickets. Turn on auto-assign (round-robin) to share the work and avoid burning out your staff.` });
    }
    // Voz
    if (d.vozActivos === 0 && d.activos > 5) out.push({ tipo: 'tip', titulo: 'Nobody uses voice channels', texto: 'Your community types but doesn’t talk over voice. Run voice events (hangouts, gaming, AMAs) and create topic voice channels to boost engagement.' });
    // Tendencia de miembros (histórico real de snapshots)
    if (d.hayMiembros && d.serieMiembros && d.serieMiembros.length > 1) {
        const conDato = d.serieMiembros.filter((p) => p.miembros != null);
        if (conDato.length >= 2) {
            const delta = conDato[conDato.length - 1].miembros - conDato[0].miembros;
            if (delta <= -3) out.push({ tipo: 'warn', titulo: 'Your member base is shrinking', texto: `You’ve gone from ${conDato[0].miembros} to ${conDato[conDato.length - 1].miembros} members. Strengthen retention: a warm welcome, interest roles and events for newcomers.` });
            else if (delta >= 3) out.push({ tipo: 'ok', titulo: 'Member base is rising', texto: `You’ve grown from ${conDato[0].miembros} to ${conDato[conDato.length - 1].miembros} members. Great work! Use the momentum for campaigns and collaborations.` });
        }
    }
    if (out.length === 0) out.push({ tipo: 'tip', titulo: 'Collecting data', texto: 'Once your server builds up more activity, you’ll see personalized growth recommendations here.' });
    return out;
}

module.exports = { construirAnalitica };
