// Cálculo de métricas del equipo de soporte a partir de la lista de tickets (función pura).

const media = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const pad = (n) => String(n).padStart(2, '0');

// `offsetMin`: minutos de diferencia con UTC del navegador (Date.getTimezoneOffset()), para que las
// "horas pico" y los días salgan en la hora local de quien mira el panel.
function calcularMetricas(tickets, { dias = 30, ahora = Date.now(), offsetMin = 0 } = {}) {
    const desde = ahora - dias * 86_400_000;
    const local = (ms) => new Date(ms - offsetMin * 60_000);
    const enPeriodo = tickets.filter(t => new Date(t.fechaCreacion).getTime() >= desde);

    // --- serie diaria (todos los días del periodo, aunque no tengan tickets) ---
    const porDiaMap = new Map();
    for (let i = dias - 1; i >= 0; i--) {
        const d = local(ahora - i * 86_400_000);
        porDiaMap.set(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, { creados: 0, cerrados: 0 });
    }
    const clave = (ms) => { const d = local(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
    for (const t of enPeriodo) { const k = clave(new Date(t.fechaCreacion).getTime()); if (porDiaMap.has(k)) porDiaMap.get(k).creados++; }
    for (const t of tickets) {
        if (t.fechaCierre) { const k = clave(new Date(t.fechaCierre).getTime()); if (porDiaMap.has(k)) porDiaMap.get(k).cerrados++; }
    }

    const agrupar = (campo) => {
        const m = new Map();
        for (const t of enPeriodo) m.set(t[campo] || 'Sin especificar', (m.get(t[campo] || 'Sin especificar') || 0) + 1);
        return [...m.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total);
    };

    const porHora = Array(24).fill(0);
    for (const t of enPeriodo) porHora[local(new Date(t.fechaCreacion).getTime()).getUTCHours()]++;

    const primeras = (lista) => lista.filter(t => t.primeraRespuestaStaff).map(t => new Date(t.primeraRespuestaStaff) - new Date(t.fechaCreacion)).filter(ms => ms >= 0);
    const resoluciones = (lista) => lista.filter(t => t.fechaCierre).map(t => new Date(t.fechaCierre) - new Date(t.fechaCreacion)).filter(ms => ms >= 0);
    const notas = (lista) => lista.filter(t => t.valoracionCSAT > 0).map(t => t.valoracionCSAT);

    // --- ranking del staff (por quién reclamó el ticket) ---
    const staff = new Map();
    for (const t of enPeriodo.filter(x => x.asignadoA)) {
        if (!staff.has(t.asignadoA)) staff.set(t.asignadoA, { id: t.asignadoA, nombre: t.asignadoNombre || t.asignadoA, tickets: [] });
        staff.get(t.asignadoA).tickets.push(t);
    }
    const ranking = [...staff.values()].map(s => ({
        id: s.id,
        nombre: s.nombre,
        atendidos: s.tickets.length,
        cerrados: s.tickets.filter(t => t.estado === 'Cerrado').length,
        csat: media(notas(s.tickets)),
        valoraciones: notas(s.tickets).length,
        primeraRespuestaMediaMs: media(primeras(s.tickets)),
        resolucionMediaMs: media(resoluciones(s.tickets))
    })).sort((a, b) => b.cerrados - a.cerrados || b.atendidos - a.atendidos);

    const distribucionCsat = [1, 2, 3, 4, 5].map(n => ({ estrellas: n, total: notas(enPeriodo).filter(x => x === n).length }));

    return {
        periodoDias: dias,
        totales: {
            creados: enPeriodo.length,
            abiertosAhora: tickets.filter(t => t.estado === 'Abierto').length,
            cerrados: enPeriodo.filter(t => t.estado === 'Cerrado').length,
            sinAsignar: tickets.filter(t => t.estado === 'Abierto' && !t.asignadoA).length,
            valorados: notas(enPeriodo).length
        },
        csatMedio: media(notas(enPeriodo)),
        distribucionCsat,
        primeraRespuestaMediaMs: media(primeras(enPeriodo)),
        resolucionMediaMs: media(resoluciones(enPeriodo)),
        porDia: [...porDiaMap.entries()].map(([fecha, v]) => ({ fecha, ...v })),
        porMotivo: agrupar('motivo'),
        porPrioridad: agrupar('prioridad'),
        porHora,
        ranking
    };
}

module.exports = { calcularMetricas };
