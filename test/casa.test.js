// 1.33.0: casa del compañero (utils/casaNucleo.js).
const test = require('node:test');
const assert = require('node:assert');
const H = require('../utils/casaNucleo.js');

test('casa: colocar, quitar y sustituir cuando el hueco está lleno', () => {
    let casa = { muebles: ['cama', 'sofa', 'planta', 'mesa', 'acuario', 'lampara', 'arana'] };
    let r = H.colocar(casa, 'trono');
    assert.equal(r.fallo, 'noTiene');
    for (const id of ['cama', 'sofa', 'planta', 'mesa']) { r = H.colocar(casa, id); casa = { ...casa, puestos: r.puestos }; }
    assert.equal(Object.keys(casa.puestos).length, 4);
    r = H.colocar(casa, 'acuario'); // suelo lleno: sustituye al primero
    assert.equal(r.sustituido, 'cama'); assert.equal(r.puestos.suelo0, 'acuario');
    casa = { ...casa, puestos: r.puestos };
    r = H.colocar(casa, 'acuario'); // ya puesto: se quita
    assert.equal(r.quitado, true); assert.equal(Object.values(r.puestos).includes('acuario'), false);
    // La lámpara de araña sustituye a la lámpara (solo hay un techo).
    casa = { ...casa, puestos: H.colocar(casa, 'lampara').puestos };
    assert.equal(H.colocar(casa, 'arana').sustituido, 'lampara');
});

test('casa: la comodidad sube la granja con tope', () => {
    assert.equal(H.bonusGranja({}), 0);
    assert.equal(H.confort({ puestos: { suelo0: 'cama' }, papel: 'menta' }), 5);
    assert.ok(Math.abs(H.bonusGranja({ puestos: { suelo0: 'cama' }, papel: 'menta' }) - 0.05) < 1e-9);
    const todo = { puestos: { suelo0: 'trono', suelo1: 'chimenea', suelo2: 'consola', suelo3: 'acuario', pared0: 'trofeos', alfombra0: 'arcoiris', techo0: 'arana' }, papel: 'noche' };
    assert.equal(H.bonusGranja(todo), H.BONUS_MAX);
    // Un mueble que no existe no cuenta.
    assert.equal(H.confort({ puestos: { suelo0: 'nave' } }), 0);
    // La granja lo usa.
    const G = require('../utils/granjaNucleo.js');
    const col = { mascotas: [{ id: 'gato', estrellas: 1, afinidad: 0, hambre: 100, alegria: 100, actualizado: new Date() }], granja: { desde: new Date(Date.now() - 3600000) } };
    const sin = G.acumulado(col).porHora; const con = G.acumulado({ ...col, casa: todo }).porHora;
    assert.ok(Math.abs(con - sin * 1.25) < 0.11, `${sin} → ${con}`);
});

test('casa: «me gusta» una vez al día y nunca a la propia', () => {
    assert.equal(H.puedeDarLike({}, 'a', 'a', '2026-01-01'), false);
    assert.equal(H.puedeDarLike({ likeDe: { b: '2026-01-01' } }, 'b', 'a', '2026-01-01'), false);
    assert.equal(H.puedeDarLike({ likeDe: { b: '2025-12-31' } }, 'b', 'a', '2026-01-01'), true);
});
