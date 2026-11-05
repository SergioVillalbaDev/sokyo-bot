// ============================================================================
// Tests de la aprobación de presentaciones (1.9.12): el privado de rechazo se
// rellena con {user}, {server} y {motivo}, y el de fábrica del panel (vista
// previa) es el mismo que manda el bot. utils/comunidad.js.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { rellenarAvisoPresentacion, RECHAZO_FABRICA } = require('../utils/comunidad.js');

describe('presentaciones: aviso al miembro', () => {
    it('rellena las variables (en español y en inglés) y un «$» sale tal cual', () => {
        const txt = rellenarAvisoPresentacion('Hola {user} de {servidor}: {motivo} / {reason}', { user: '@Ana', server: 'Cash$&Co', motivo: 'falta $1' });
        assert.strictEqual(txt, 'Hola @Ana de Cash$&Co: falta $1 / falta $1');
    });
    it('el de fábrica lleva el motivo, en los dos idiomas', () => {
        for (const l of ['es', 'en']) assert.match(RECHAZO_FABRICA[l], /\{motivo\}/);
    });
    it('la vista previa del panel usa el mismo texto de fábrica que el bot', () => {
        const vista = fs.readFileSync(path.join(__dirname, '..', 'sokyo-panelFRONTEND', 'src', 'components', 'dashboard', 'views', 'PresentacionesView.jsx'), 'utf8');
        for (const l of ['es', 'en']) {
            const enVista = new RegExp(`${l}: '([^']*)'`).exec(vista.slice(vista.indexOf('const RECHAZO_FABRICA')));
            assert.ok(enVista, `falta el texto ${l} en la vista`);
            assert.strictEqual(enVista[1].replace(/\\n/g, '\n').replace(/\\'/g, "'"), RECHAZO_FABRICA[l]);
        }
    });
});
