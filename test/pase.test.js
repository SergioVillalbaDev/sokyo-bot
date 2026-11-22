const test = require('node:test');
const assert = require('node:assert');
const X = require('../utils/paseNucleo.js');
const K = require('../utils/cofresNucleo.js');

const AHORA = Date.UTC(2026, 10, 22, 12);

test('pase: suma XP, sube niveles y da sus premios una sola vez', () => {
    let r = X.sumar(null, 'cuidar', { ahora: AHORA });
    assert.strictEqual(r.xp, X.XP.cuidar);
    assert.strictEqual(r.pase.temp, '2026-11');
    assert.deepStrictEqual(r.niveles, []);
    r = X.sumar(r.pase, 'cofre', { ahora: AHORA, n: 5 }); // 105 XP → nivel 1
    assert.deepStrictEqual(r.niveles, [1]);
    assert.strictEqual(r.premios.oro, X.premio(1).oro);
    // Del 1 al 10 de golpe: oro de cada nivel, 2 sobres normales y 1 cofre épico.
    r = X.sumar(r.pase, 'misionSemanal', { ahora: AHORA, n: 18 });
    assert.deepStrictEqual(r.niveles, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.strictEqual(r.premios.tickets.sobre_normal, 2);
    assert.strictEqual(r.premios.tickets.cofre_epico, 1);
    // Acción desconocida: nada
    assert.strictEqual(X.sumar(r.pase, 'nada', { ahora: AHORA }).xp, 0);
});

test('pase: temporada nueva cada mes, desde cero', () => {
    const r = X.sumar({ temp: '2026-10', xp: 4000, max: 40 }, 'cuidar', { ahora: AHORA });
    assert.strictEqual(r.pase.xp, X.XP.cuidar);
    assert.strictEqual(r.pase.max, 0);
});

test('pase: el casino da XP con tope diario y sin importar la apuesta', () => {
    let pase = null; let total = 0;
    for (let i = 0; i < X.TOPE_CASINO_DIA + 10; i++) { const r = X.sumar(pase, 'casino', { ahora: AHORA }); pase = r.pase; total += r.xp; }
    assert.strictEqual(total, X.TOPE_CASINO_DIA * X.XP.casino);
    const otroDia = X.sumar(pase, 'casino', { ahora: AHORA + 86400000 });
    assert.strictEqual(otroDia.xp, X.XP.casino);
});

test('pase: el nivel 50 da lo mejor y luego cada nivel extra da oro', () => {
    const p50 = X.premio(X.NIVEL_MAX);
    assert.ok(p50.titulo && p50.tickets.sobre_legendario && p50.tickets.cofre_legendario);
    assert.deepStrictEqual(X.premio(X.NIVEL_MAX + 3), { oro: X.ORO_EXTRA, tickets: {} });
    for (let i = 1; i <= X.NIVEL_MAX; i++) for (const k of Object.keys(X.premio(i).tickets)) assert.ok(X.TICKETS[k], k);
});

test('logros: se dan los conseguidos y no los ya dados', () => {
    const ids = Object.keys(K.COMPANEROS).slice(0, 10);
    const col = { mascotas: ids.map((id) => ({ id, estrellas: 1, cuidados: 12 })), mejorRacha: 8 };
    const nuevos = X.logrosNuevos(col).map((l) => l.id);
    for (const id of ['primera', 'diez', 'cuida100', 'racha7']) assert.ok(nuevos.includes(id), id);
    assert.ok(!nuevos.includes('treinta'));
    assert.ok(!X.logrosNuevos({ ...col, logros: nuevos }).length);
    assert.strictEqual(new Set(X.LOGROS.map((l) => l.id)).size, X.LOGROS.length);
});

test('empezar: «¿qué hago ahora?» sigue un orden con sentido', () => {
    const E = require('../utils/empezar.js');
    const cfg = { casino: { activo: true }, compis: { anime: true } };
    assert.strictEqual(E.siguientePaso({ usuario: { balance: 0 }, col: null, cfg, ahora: AHORA }).id, 'diario');
    const ya = { ultimoDaily: new Date(AHORA - 3600000) };
    assert.strictEqual(E.siguientePaso({ usuario: { ...ya, balance: 100 }, col: null, cfg, ahora: AHORA }).id, 'ahorrar');
    assert.strictEqual(E.siguientePaso({ usuario: { ...ya, balance: 900 }, col: { mascotas: [] }, cfg, ahora: AHORA }).id, 'primerCofre');
    const m = { id: 'gato', estrellas: 1, hambre: 100, alegria: 100, energia: 100, actualizado: new Date(AHORA) };
    assert.strictEqual(E.siguientePaso({ usuario: { ...ya, balance: 900 }, col: { mascotas: [m], equipada: 'gato', tickets: { sobre_normal: 1 } }, cfg, ahora: AHORA }).id, 'tickets');
    assert.strictEqual(E.siguientePaso({ usuario: { ...ya, balance: 900 }, col: { mascotas: [m], equipada: 'gato' }, cfg, ahora: AHORA }).id, 'granjaEmpezar');
    const conGranja = { mascotas: [m], equipada: 'gato', granja: { desde: new Date(AHORA) } };
    assert.strictEqual(E.siguientePaso({ usuario: { ...ya, balance: 900 }, col: conGranja, cfg, ahora: AHORA }).id, 'misiones');
    assert.strictEqual(E.siguientePaso({ usuario: { ...ya, balance: 900 }, col: { ...conGranja, mascotas: [{ ...m, hambre: 10 }] }, cfg, ahora: AHORA }).id, 'cuidar');
    // Todos los pasos tienen texto en los dos idiomas
    for (const id of ['diario', 'primerCofre', 'ahorrar', 'sinCofres', 'tickets', 'granjaEmpezar', 'granjaRecoger', 'volvio', 'cuidar', 'misiones', 'primerSobre', 'expedicion', 'pase']) {
        for (const i of ['es', 'en']) assert.ok(E.pasoUI({ id, m: 'gato', falta: 10, oro: 5 }, '1', i).texto.length > 10, id);
    }
    for (const tema of E.TEMAS) for (const i of ['es', 'en']) assert.ok(E.textoTema(tema, i, cfg).length > 100, tema);
});
