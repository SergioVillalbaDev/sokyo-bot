const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularMetricas } = require('../utils/metricas.js');

const AHORA = Date.UTC(2026, 5, 15, 12, 0, 0);
const h = (n) => new Date(AHORA - n * 3600_000);
const t = (o) => ({ estado: 'Abierto', motivo: 'Soporte', prioridad: 'Normal', asignadoA: null, ...o });

test('métricas: totales, tiempos y satisfacción', () => {
    const tickets = [
        t({ fechaCreacion: h(48), fechaCierre: h(46), estado: 'Cerrado', primeraRespuestaStaff: h(47.5), valoracionCSAT: 5, asignadoA: 'a', asignadoNombre: 'Ana' }),
        t({ fechaCreacion: h(30), fechaCierre: h(26), estado: 'Cerrado', primeraRespuestaStaff: h(29), valoracionCSAT: 3, asignadoA: 'a', asignadoNombre: 'Ana' }),
        t({ fechaCreacion: h(5), asignadoA: 'b', asignadoNombre: 'Bob' }),
        t({ fechaCreacion: h(2) }),
        t({ fechaCreacion: new Date(AHORA - 100 * 86400000), estado: 'Cerrado', fechaCierre: new Date(AHORA - 99 * 86400000) }) // fuera del periodo
    ];
    const m = calcularMetricas(tickets, { dias: 30, ahora: AHORA });
    assert.equal(m.totales.creados, 4);
    assert.equal(m.totales.abiertosAhora, 2);
    assert.equal(m.totales.sinAsignar, 1);
    assert.equal(m.totales.cerrados, 2);
    assert.equal(m.csatMedio, 4);
    assert.equal(m.primeraRespuestaMediaMs, (0.5 * 3600_000 + 1 * 3600_000) / 2);
    assert.equal(m.resolucionMediaMs, (2 * 3600_000 + 4 * 3600_000) / 2);
    assert.equal(m.porDia.length, 30);
    assert.equal(m.porHora.reduce((a, b) => a + b, 0), 4);
    assert.equal(m.ranking[0].nombre, 'Ana');
    assert.equal(m.ranking[0].csat, 4);
    assert.equal(m.distribucionCsat.find(x => x.estrellas === 5).total, 1);
});

test('métricas: sin tickets no revienta', () => {
    const m = calcularMetricas([], { dias: 7, ahora: AHORA });
    assert.equal(m.totales.creados, 0); assert.equal(m.csatMedio, null); assert.deepEqual(m.ranking, []); assert.equal(m.porDia.length, 7);
});

test('métricas: la hora pico respeta la zona horaria del navegador', () => {
    const tickets = [t({ fechaCreacion: new Date(Date.UTC(2026, 5, 15, 10, 0, 0)) })];
    assert.equal(calcularMetricas(tickets, { dias: 7, ahora: AHORA, offsetMin: 0 }).porHora[10], 1);
    assert.equal(calcularMetricas(tickets, { dias: 7, ahora: AHORA, offsetMin: -120 }).porHora[12], 1, 'UTC+2 => 12:00');
});
