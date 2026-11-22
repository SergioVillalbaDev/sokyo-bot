// 1.16.0: casino de oro y cofres de mascotas (reglas puras).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../utils/casinoNucleo.js');
const K = require('../utils/cofresNucleo.js');
const N = require('../utils/mascotaNucleo.js');

describe('Lo que devuelve cada juego a la larga (la casa se queda un poco)', () => {
    test('tragaperras ~95 % (calculado exacto)', () => {
        const T = C.SIMBOLOS.reduce((s, x) => s + x.peso, 0);
        let rtp = 0;
        for (const a of C.SIMBOLOS) for (const b of C.SIMBOLOS) for (const c of C.SIMBOLOS) rtp += (a.peso * b.peso * c.peso / T ** 3) * C.pagoTragaperras([a.id, b.id, c.id]).mult;
        assert.ok(rtp > 0.93 && rtp < 0.97, String(rtp));
    });
    test('ruleta: 97,3 % en todas las apuestas', () => {
        for (const ap of C.APUESTAS_RULETA) {
            let r = 0;
            for (let n = 0; n < 37; n++) r += C.pagoRuleta(ap, 17, n) / 37;
            assert.ok(Math.abs(r - 36 / 37) < 1e-9, ap);
        }
    });
    test('crash ~97 % se retire cuando se retire', () => {
        const az = N.azarCon('crash');
        for (const objetivo of [1.5, 2, 5]) {
            let total = 0; const n = 40000;
            for (let i = 0; i < n; i++) if (C.puntoCrash(az) >= objetivo) total += objetivo;
            assert.ok(Math.abs(total / n - 0.97) < 0.04, `${objetivo}: ${total / n}`);
        }
    });
    test('minas: 97 % en cada paso', () => {
        for (const minas of [1, 3, 5, 10]) for (let k = 1; k <= 20 - minas && k <= 8; k++) {
            let p = 1; for (let i = 0; i < k; i++) p *= (20 - minas - i) / (20 - i);
            assert.ok(Math.abs(p * C.multMinas(minas, k) - 0.97) < 0.01, `${minas}/${k}`);
        }
    });
    test('carrera: 94 % con cualquier corredor', () => {
        const total = C.CORREDORES.reduce((s, c) => s + c.fuerza, 0);
        for (const c of C.CORREDORES) assert.ok(Math.abs((c.fuerza / total) * C.cuota(c.id) - 0.94) < 0.01, c.id);
    });
});

describe('Tragaperras', () => {
    test('pagos', () => {
        assert.deepEqual(C.pagoTragaperras(['siete', 'siete', 'siete']), { mult: 600, tipo: 'tres', bote: false });
        assert.equal(C.pagoTragaperras(['diamante', 'diamante', 'diamante']).bote, true);
        assert.equal(C.pagoTragaperras(['cereza', 'uva', 'cereza']).mult, 2);
        assert.equal(C.pagoTragaperras(['uva', 'uva', 'limon']).mult, 1);
        assert.equal(C.pagoTragaperras(['uva', 'limon', 'uva']).mult, 0);
    });
});

describe('Ruleta', () => {
    test('colores, docenas y números', () => {
        assert.equal(C.colorNumero(0), 'verde');
        assert.equal(C.colorNumero(1), 'rojo');
        assert.equal(C.colorNumero(2), 'negro');
        assert.equal(C.pagoRuleta('rojo', null, 0), 0);
        assert.equal(C.pagoRuleta('docena2', null, 13), 3);
        assert.equal(C.pagoRuleta('numero', 7, 7), 36);
        assert.equal(C.ORDEN_RUEDA.length, 37);
        assert.deepEqual([...C.ORDEN_RUEDA].sort((a, b) => a - b), [...Array(37).keys()]);
    });
});

describe('Blackjack', () => {
    test('puntos con ases', () => {
        assert.equal(C.puntos(['A♠', 'K♥']).total, 21);
        assert.equal(C.puntos(['A♠', 'A♥', '9♦']).total, 21);
        assert.equal(C.puntos(['K♠', 'Q♥', '5♦']).total, 25);
        assert.equal(C.esBlackjack(['A♠', '10♥']), true);
    });
    test('resultados', () => {
        assert.equal(C.resultadoBlackjack(['A♠', 'K♥'], ['9♠', '9♥']).mult, 2.5);
        assert.equal(C.resultadoBlackjack(['K♠', 'Q♥'], ['K♦', '7♥', '9♣']).mult, 2);
        assert.equal(C.resultadoBlackjack(['K♠', '8♥'], ['K♦', '8♣']).mult, 1);
        assert.equal(C.resultadoBlackjack(['K♠', '8♥', '9♦'], ['K♦', '8♣']).mult, 0);
    });
    test('la banca se planta en 17', () => {
        const mazo = ['5♠', '2♥'];
        assert.deepEqual(C.jugarBanca(['10♠', '6♥'], mazo), ['10♠', '6♥', '2♥']);
        assert.equal(C.baraja().length, 312);
    });
});

describe('Apuestas y límites', () => {
    test('mínimo, máximo, tope diario y pausa', () => {
        const cfg = { apuestaMin: 10, apuestaMax: 1000, limiteDiario: 3000 };
        const hoy = new Date('2026-11-21T12:00:00Z');
        assert.equal(C.comprobarApuesta(5, cfg, {}, hoy).fallo, 'min');
        assert.equal(C.comprobarApuesta(2000, cfg, {}, hoy).fallo, 'max');
        assert.equal(C.comprobarApuesta(500, cfg, { dia: '2026-11-21', perdidoHoy: 2800 }, hoy).fallo, 'limite');
        assert.equal(C.comprobarApuesta(500, cfg, { dia: '2026-11-20', perdidoHoy: 2800 }, hoy).ok, true, 'el tope es por día');
        assert.equal(C.comprobarApuesta(500, cfg, { pausaHasta: new Date('2026-11-22') }, hoy).fallo, 'pausa');
        assert.equal(C.comprobarApuesta(500, { ...cfg, limiteDiario: 0 }, { dia: '2026-11-21', perdidoHoy: 99999 }, hoy).ok, true, '0 = sin tope');
    });
});

describe('Cofres de mascotas', () => {
    test('las probabilidades suman 100 en cada cofre y la divina es rarísima', () => {
        for (const [id, c] of Object.entries(K.COFRES)) {
            assert.ok(Math.abs(Object.values(c.prob).reduce((a, b) => a + b, 0) - 100) < 1e-9, id);
            assert.ok(c.prob.divina <= 0.2);
        }
        assert.equal(Object.values(K.COMPANEROS).filter((x) => x.rareza === 'divina').length, 1);
    });
    test('salen con la frecuencia que dicen', () => {
        const az = N.azarCon('cofres');
        const cuenta = {}; const n = 100000;
        for (let i = 0; i < n; i++) { const r = K.rarezaAlAzar('basico', az); cuenta[r] = (cuenta[r] || 0) + 1; }
        assert.ok(Math.abs(cuenta.comun / n - 0.70) < 0.01);
        assert.ok(Math.abs(cuenta.legendaria / n - 0.013) < 0.003);
        assert.ok((cuenta.divina || 0) < 40);
    });
    test('piedad: al décimo sin épica, sale épica o mejor', () => {
        for (let i = 0; i < 200; i++) assert.ok(K.RAREZAS[K.rarezaAlAzar('basico', Math.random, K.PIEDAD - 1)].orden >= 2);
        const r = K.abrir({ sinEpica: 9, mascotas: [] }, 'basico', () => 0.99);
        assert.equal(r.piedad, true);
        assert.equal(r.sinEpica, 0);
    });
    test('repetidos suben estrellas y con 5 devuelven oro', () => {
        const az = () => 0.0001; // la más rara de la lista que toque
        const r1 = K.abrir({ mascotas: [] }, 'basico', az);
        const r2 = K.abrir({ mascotas: [{ id: r1.id, estrellas: 2 }] }, 'basico', az);
        assert.deepEqual([r2.nuevo, r2.estrellas, r2.devuelto], [false, 3, 0]);
        const r3 = K.abrir({ mascotas: [{ id: r1.id, estrellas: 5 }] }, 'basico', az);
        assert.deepEqual([r3.estrellas, r3.devuelto], [5, 125]);
    });
    test('ventajas: la divina está muy chetada y las estrellas suman', () => {
        assert.deepEqual(K.ventajas('celestial', 1), { xp: 0.5, diario: 1, vuelta: 0.1, bromas: 0.4, liga: 0.5, expedicion: 1 });
        assert.deepEqual(K.ventajas('gato', 1), { xp: 0.02, diario: 0, vuelta: 0.02, bromas: 0, liga: 0, expedicion: 0 }); // + «Siete vidas»
        assert.deepEqual(K.ventajas('dragon', 5), { xp: 0.324, diario: 0.36, vuelta: 0.036, bromas: 0.27, liga: 0.36, expedicion: 0.63 }); // + «Aliento de fuego»
        assert.deepEqual(K.ventajas('nada'), { xp: 0, diario: 0, vuelta: 0, bromas: 0, liga: 0, expedicion: 0 });
        assert.equal(K.ventajas('celestial', 5, 0.5).bromas, 0.6); // tope
    });
});

describe('Panel y bot con los mismos datos', () => {
    test('src/lib/casino.js coincide con el bot', async () => {
        const L = await import('../sokyo-panelFRONTEND/src/lib/casino.js');
        assert.deepEqual(L.SIMBOLOS.map((s) => [s.id, s.paga3]), C.SIMBOLOS.map((s) => [s.id, s.paga3]));
        for (const [id, c] of Object.entries(K.COFRES)) assert.deepEqual([L.COFRES[id].precio, L.COFRES[id].prob], [c.precio, c.prob], id);
        assert.deepEqual(Object.keys(L.COMPANEROS), Object.keys(K.COMPANEROS));
        for (const [r, v] of Object.entries(K.RAREZAS)) assert.deepEqual(['xp', 'diario', 'vuelta', 'bromas', 'liga', 'expedicion'].map((k) => L.RAREZAS[r][k]), ['xp', 'diario', 'vuelta', 'bromas', 'liga', 'expedicion'].map((k) => v[k]), r);
        const P = require('../utils/compisNucleo.js');
        assert.deepEqual(Object.fromEntries(Object.entries(L.INTERACCIONES).map(([id, x]) => [id, x.rareza])), Object.fromEntries(Object.entries(P.INTERACCIONES).map(([id, x]) => [id, x.rareza])));
        assert.deepEqual(L.PODERES.map((p) => p.id), P.PODERES.map((p) => p.id));
        assert.equal(L.PIEDAD, K.PIEDAD);
        const G = require('../utils/granjaNucleo.js');
        assert.deepEqual([L.GRANJA.produccion, L.GRANJA.topeH, L.GRANJA.huecos, L.GRANJA.porEstrella, L.GRANJA.porNivel, L.GRANJA.hitos, L.GRANJA.premioSemana, L.GRANJA.premioTodas],
            [G.PRODUCCION, G.TOPE_H, G.HUECOS_BASE, G.POR_ESTRELLA, G.POR_NIVEL, G.HITOS, G.PREMIO_SEMANA, G.PREMIO_SEMANA_TODAS]);
        assert.deepEqual(Object.fromEntries(Object.entries(L.GRANJA.semana).map(([k, v]) => [k, v.n])), Object.fromEntries(Object.entries(G.MISIONES_SEMANA).map(([k, v]) => [k, v.n])));
    });
});

describe('1.25.0: mayor o menor y rasca y gana', () => {
    test('rasca y gana devuelve entre el 94 % y el 97 %, y los boletos son coherentes', () => {
        assert.ok(C.rtpRasca() > 0.94 && C.rtpRasca() < 0.97, String(C.rtpRasca()));
        const az = N.azarCon('rasca');
        for (let i = 0; i < 5000; i++) {
            const b = C.boletoRasca(az);
            assert.equal(b.casillas.length, 9);
            const cuenta = {}; b.casillas.forEach((x) => { cuenta[x] = (cuenta[x] || 0) + 1; });
            const trios = Object.entries(cuenta).filter(([, n]) => n >= 3);
            if (b.premio) assert.deepEqual(trios, [[b.premio.simbolo, 3]]); else assert.equal(trios.length, 0);
        }
    });
    test('mayor o menor: paga lo justo menos un 3 % en cada carta', () => {
        for (const v of ['A', '2', '5', '7', '10', 'K']) {
            for (const el of ['mayor', 'menor']) {
                const c = `${v}♠`; const pago = C.pagoHilo(c, el);
                const casos = el === 'mayor' ? 13 - C.valorHilo(c) : C.valorHilo(c) - 1;
                if (!casos) { assert.equal(pago, 0); continue; }
                const rtp = (casos / 12) * pago; // los empates no cuentan
                assert.ok(rtp <= 0.97 + 1e-9 && rtp > 0.95, `${c} ${el}: ${rtp}`);
            }
        }
        assert.equal(C.resultadoHilo('7♠', '7♥', 'mayor'), 'empate');
        assert.equal(C.resultadoHilo('7♠', '9♥', 'mayor'), 'gana');
        assert.equal(C.resultadoHilo('7♠', '9♥', 'menor'), 'pierde');
    });
});
