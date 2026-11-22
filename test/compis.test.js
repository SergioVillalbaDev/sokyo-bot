// 1.20.0: compañeros tipo tamagotchi (reglas puras).
const { test, describe } = require('node:test');
const assert = require('node:assert');
const K = require('../utils/cofresNucleo.js');
const P = require('../utils/compisNucleo.js');
const { GENERAL, VOCES } = require('../utils/compisFrases.js');
const fs = require('fs');
const path = require('path');

const H = 3600000;
const T0 = Date.UTC(2026, 10, 22, 12);

describe('Catálogo', () => {
    test('hay muchos compañeros, con personajes, dibujo y una sola divina', () => {
        const todos = Object.entries(K.COMPANEROS);
        assert.ok(todos.length >= 50);
        assert.ok(todos.filter(([, c]) => c.tipo === 'personaje').length >= 15);
        assert.equal(todos.filter(([, c]) => c.rareza === 'divina').length, 1);
        for (const [id, c] of todos) {
            assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'mascota', `${c.svg}.svg`)), id);
            assert.ok(K.RAREZAS[c.rareza], id);
            if (c.voz) assert.ok(VOCES[c.voz], `${id}: voz ${c.voz}`);
        }
    });
    test('las frases tienen español e inglés y hay muchas', () => {
        for (const l of [...Object.values(GENERAL), ...Object.values(VOCES)]) for (const [es, en] of l) assert.ok(es && en);
        assert.ok(P.totalFrases() >= 200);
    });
    test('compañeros del servidor: salen solo con su rareza y nunca divinos', () => {
        K.registrarPersonalizado({ id: 's:1:a', guildId: '1', nombre: 'Michi', rareza: 'epica', imagen: '/uploads/x.png' });
        K.registrarPersonalizado({ id: 's:1:b', guildId: '1', nombre: 'Dios', rareza: 'divina' });
        assert.equal(K.def('s:1:a').es, 'Michi');
        assert.ok(K.def('s:1:b').perdido);
        assert.ok(K.def('nada').perdido);
        let sale = 0;
        for (let i = 0; i < 400; i++) if (K.companeroAlAzar('epica', Math.random, ['s:1:a']) === 's:1:a') sale++;
        assert.ok(sale > 0);
        assert.notEqual(K.companeroAlAzar('comun', () => 0.999, ['s:1:a']), 's:1:a');
        K.olvidarPersonalizado('s:1:a');
    });
});

describe('Necesidades', () => {
    test('con el tiempo baja el hambre y la alegría y sube la energía', () => {
        const m = { id: 'gato', hambre: 80, alegria: 80, energia: 20, actualizado: new Date(T0) };
        const e = P.estado(m, T0 + 10 * H);
        assert.deepEqual(e, { hambre: 50, alegria: 60, energia: 80 });
        assert.equal(P.estado(m, T0 + 100 * H).hambre, 0);
    });
    test('de expedición no gasta', () => {
        const m = { id: 'gato', hambre: 80, alegria: 80, energia: 50, actualizado: new Date(T0), exp: { tipo: 'aventura', hasta: new Date(T0 + 4 * H) } };
        assert.equal(P.estado(m, T0 + 3 * H).hambre, 80);
    });
    test('humor', () => {
        assert.equal(P.humor({ hambre: 10, alegria: 90, energia: 90 }), 'hambre');
        assert.equal(P.humor({ hambre: 90, alegria: 90, energia: 10 }), 'cansado');
        assert.equal(P.humor({ hambre: 90, alegria: 10, energia: 90 }), 'aburrido');
        assert.equal(P.humor({ hambre: 90, alegria: 90, energia: 90 }), 'feliz');
    });
    test('cuidar: la afinidad solo sube si hacía falta', () => {
        const ham = { id: 'gato', hambre: 30, alegria: 50, energia: 50, actualizado: new Date(T0) };
        const r = P.cuidar(ham, 'comer', T0);
        assert.equal(r.hambre, 65); assert.equal(r.afinidad, 5);
        assert.equal(P.cuidar({ ...ham, hambre: 96 }, 'comer', T0).fallo, 'lleno');
        assert.equal(P.cuidar({ ...ham, hambre: 92 }, 'comer', T0).afinidad, 0);
        assert.equal(P.cuidar({ ...ham, energia: 5 }, 'jugar', T0).fallo, 'energia');
        assert.equal(P.cuidar({ ...ham, ultMimo: new Date(T0 - 60000) }, 'mimar', T0).afinidad, 0);
        assert.equal(P.cuidar(ham, 'mimar', T0).afinidad, 3);
    });
    test('nivel y extra de ventajas', () => {
        assert.equal(P.nivel(0), 1); assert.equal(P.nivel(10), 2); assert.equal(P.nivel(39), 2); assert.equal(P.nivel(40), 3);
        assert.equal(P.nivel(1e9), P.NIVEL_MAX);
        const feliz = { id: 'gato', hambre: 90, alegria: 90, energia: 90, actualizado: new Date(T0), afinidad: 40 };
        assert.equal(P.extraCuidado(feliz, T0), 0.12);
        assert.ok(K.ventajas('gato', 1, 0.12).xp > K.ventajas('gato', 1).xp);
    });
});

describe('Expediciones, misiones y racha', () => {
    test('salir gasta energía, tiene tope diario y luego trae botín', () => {
        const m = { id: 'kaede', hambre: 80, alegria: 80, energia: 70, actualizado: new Date(T0) };
        const s = P.salir(m, 'aventura', { dia: '2026-11-22', n: 0 }, '2026-11-22', T0);
        assert.equal(s.energia, 30); assert.equal(s.usadas, 1);
        assert.equal(P.salir({ ...m, energia: 10 }, 'aventura', null, '2026-11-22', T0).fallo, 'energia');
        assert.equal(P.salir(m, 'paseo', { dia: '2026-11-22', n: P.EXPEDICIONES_DIA }, '2026-11-22', T0).fallo, 'tope');
        assert.equal(P.salir(m, 'paseo', { dia: '2026-11-21', n: 9 }, '2026-11-22', T0).usadas, 1);
        const fuera = { ...m, exp: s.exp };
        assert.equal(P.salir(fuera, 'paseo', null, '2026-11-22', T0).fallo, 'fuera');
        assert.ok(P.expedicionLista(fuera, T0 + 4 * H));
        const b = P.botin(fuera, () => 0.999);
        assert.ok(b.oro >= 130 && b.oro <= 200, String(b.oro)); assert.equal(b.recuerdo, null);
        assert.notEqual(P.botin(fuera, () => 0.1).recuerdo, null);
    });
    test('misiones del día: 3 distintas, iguales para todos ese día, premio al cumplir', () => {
        const hoy = P.misionesDelDia('2026-11-22');
        assert.equal(new Set(hoy).size, 3);
        assert.deepEqual(hoy, P.misionesDelDia('2026-11-22'));
        let mis = null; let todas = false;
        for (const a of hoy) for (let i = 0; i < P.MISIONES[a].n; i++) { const r = P.avanzarMision(mis, a, '2026-11-22'); mis = r.mis; todas = todas || r.todas; }
        assert.equal(mis.hechas.length, 3); assert.ok(todas);
        assert.equal(P.avanzarMision(mis, hoy[0], '2026-11-22').cumplida, null);
        assert.deepEqual(P.avanzarMision(mis, hoy[0], '2026-11-23').mis.dia, '2026-11-23');
    });
    test('racha', () => {
        assert.deepEqual(P.avanzarRacha({}, '2026-11-22'), { racha: 1, nueva: true, premio: 0 });
        assert.equal(P.avanzarRacha({ ultimoDiaCuidado: '2026-11-21', racha: 2 }, '2026-11-22').premio, 150);
        assert.equal(P.avanzarRacha({ ultimoDiaCuidado: '2026-11-20', racha: 9 }, '2026-11-22').racha, 1);
        assert.equal(P.avanzarRacha({ ultimoDiaCuidado: '2026-11-22', racha: 4 }, '2026-11-22').nueva, false);
    });
    test('frases: según su humor y con el nombre del dueño', () => {
        const ham = { id: 'vlad', hambre: 5, alegria: 80, energia: 80, actualizado: new Date(T0) };
        const f = P.frase(ham, 'hablar', { idioma: 'es', dueno: 'Ana', azar: () => 0, ahora: T0 });
        assert.equal(f, GENERAL.hambre[0][0].replace('{d}', 'Ana'));
        const en = P.frase({ id: 'vlad', hambre: 90, alegria: 90, energia: 90, actualizado: new Date(T0) }, 'hablar', { idioma: 'en', dueno: 'Ana', azar: () => 0.3, ahora: T0 });
        assert.ok(VOCES.vampiro.some(([, e]) => e.replace('{d}', 'Ana') === en), en);
    });
});

describe('1.21.0: interacciones por rareza, poderes y ventajas', () => {
    const base = { hambre: 60, alegria: 50, energia: 70, actualizado: new Date(T0) };
    test('cada rareza desbloquea más interacciones', () => {
        const n = (id) => P.interaccionesDe({ id }).length;
        assert.equal(n('gato'), 0);
        assert.ok(n('zorro') > 0 && n('kaede') > n('zorro') && n('vlad') > n('kaede') && n('djinn') > n('vlad') && n('celestial') > n('djinn'));
        assert.equal(n('celestial'), Object.keys(P.INTERACCIONES).length);
        for (const id of Object.keys(P.INTERACCIONES)) assert.ok(require('../utils/compisFrases.js').EXTRA[id], id);
    });
    test('interactuar: rareza, espera, energía y premio', () => {
        assert.equal(P.interactuar({ id: 'gato', ...base }, 'banar', T0).fallo, 'rareza');
        const r = P.interactuar({ id: 'zorro', ...base }, 'banar', T0);
        assert.equal(r.alegria, 58); assert.equal(r.afinidad, 3);
        const tras = { id: 'zorro', ...base, cds: r.cds };
        assert.equal(P.interactuar(tras, 'banar', T0 + 60000).fallo, 'espera');
        assert.equal(P.interactuar(tras, 'banar', T0 + 31 * 60000).fallo, undefined);
        assert.equal(P.interactuar({ id: 'kaede', ...base, energia: 5 }, 'entrenar', T0).fallo, 'energia');
        const g = P.interactuar({ id: 'vlad', ...base }, 'regalo', T0, () => 0.1);
        assert.ok(g.oro >= 60 && g.oro <= 150); assert.notEqual(g.recuerdo, null);
        const fuera = { id: 'vlad', ...base, exp: { tipo: 'paseo', hasta: new Date(T0 + H) } };
        assert.equal(P.interactuar(fuera, 'historia', T0).fallo, 'fuera');
    });
    test('poder del día según la rareza, cada 20 h', () => {
        assert.ok(P.usarPoder({ id: 'gato', ...base }, {}, { ahora: T0, azar: () => 0.5 }).oro > 0);
        const ins = P.usarPoder({ id: 'kaede', ...base }, {}, { ahora: T0 });
        assert.equal(ins.buff.xp, 0.3);
        assert.ok(P.usarPoder({ id: 'vlad', ...base }, {}, { ahora: T0, bromas: true }).escudoHasta);
        assert.equal(P.usarPoder({ id: 'vlad', ...base }, {}, { ahora: T0, bromas: false }).id, 'inspiracion');
        assert.ok(P.usarPoder({ id: 'djinn', ...base, exp: { tipo: 'viaje', hasta: new Date(T0 + 5 * H) } }, {}, { ahora: T0 }).volver);
        assert.ok(P.usarPoder({ id: 'djinn', ...base }, {}, { ahora: T0 }).lleno);
        const b = P.usarPoder({ id: 'celestial', ...base }, {}, { ahora: T0 });
        assert.ok(b.lleno && b.buff.xp === 1);
        assert.equal(P.usarPoder({ id: 'gato', ...base }, { poderUsado: new Date(T0 - H) }, { ahora: T0 }).fallo, 'espera');
        assert.equal(P.faltaPoder({ poderUsado: new Date(T0 - 21 * H) }, T0), 0);
        assert.equal(P.buffXp({ buff: { xp: 0.3, hasta: new Date(T0 + 1) } }, T0), 0.3);
        assert.equal(P.buffXp({ buff: { xp: 0.3, hasta: new Date(T0 - 1) } }, T0), 0);
    });
    test('las rarezas dan más en bromas, Liga y expediciones', () => {
        const orden = ['gato', 'zorro', 'kaede', 'vlad', 'djinn', 'celestial'].map((id) => K.ventajas(id, 1));
        for (const k of ['bromas', 'liga', 'expedicion']) for (let i = 1; i < orden.length; i++) assert.ok(orden[i][k] >= orden[i - 1][k], k);
        const pobre = P.botin({ id: 'gato', exp: { tipo: 'viaje' } }, () => 0.5).oro;
        const rico = P.botin({ id: 'celestial', exp: { tipo: 'viaje' } }, () => 0.5).oro;
        assert.equal(rico, pobre * 2);
    });
});
