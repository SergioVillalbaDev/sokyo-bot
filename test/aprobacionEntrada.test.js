// ============================================================================
// Tests de 1.9.13: verificación con aprobación del staff (utils/preguntasEntrada.js)
// y el panel de tickets publicable desde el panel (utils/panelTickets.js).
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const pe = require('../utils/preguntasEntrada.js');
const { contenidoPanelTickets } = require('../utils/panelTickets.js');

describe('verificación con aprobación del staff', () => {
    it('solo cuenta si está encendida y tiene canal', () => {
        assert.strictEqual(pe.aprobacionActiva({ preguntasEntrada: { aprobacion: true, canalRevisionId: '123' } }), true);
        assert.strictEqual(pe.aprobacionActiva({ preguntasEntrada: { aprobacion: true } }), false);
        assert.strictEqual(pe.aprobacionActiva({ preguntasEntrada: { aprobacion: false, canalRevisionId: '123' } }), false);
    });
    it('el staff ve lo respondido en texto', () => {
        const cfg = { preguntasEntrada: { preguntas: [{ id: 'j', texto: '¿A qué juegas?', opciones: [{ id: 'a', etiqueta: 'LoL', emoji: '⚔️' }, { id: 'b', etiqueta: 'Minecraft' }] }] } };
        assert.deepStrictEqual(pe.resumenRespuestas(cfg, { j: ['a', 'b'] }), [{ pregunta: '¿A qué juegas?', respuesta: '⚔️ LoL, Minecraft' }]);
        assert.deepStrictEqual(pe.resumenRespuestas(cfg, {}), [{ pregunta: '¿A qué juegas?', respuesta: '—' }]);
    });
    it('el rechazo lleva el motivo y la vista previa del panel usa el mismo texto de fábrica', () => {
        assert.strictEqual(pe.rellenar('{user} {server} {motivo} $&', { user: '@a', server: 'S', motivo: 'm' }), '@a S m $&');
        const vista = fs.readFileSync(path.join(__dirname, '..', 'sokyo-panelFRONTEND', 'src', 'components', 'dashboard', 'views', 'AprobacionEntrada.jsx'), 'utf8');
        for (const [constante, bot] of [['RECHAZO_FABRICA', pe.RECHAZO_ENTRADA], ['ACEPTADA_FABRICA', pe.ACEPTADA_ENTRADA]]) {
            for (const l of ['es', 'en']) {
                const m = new RegExp(`${l}: '([^']*)'`).exec(vista.slice(vista.indexOf(`const ${constante}`)));
                assert.ok(m, `${constante}.${l}`);
                assert.strictEqual(m[1].replace(/\\n/g, '\n'), bot[l], `${constante}.${l}`);
            }
        }
    });
});

describe('aviso al staff y revisión', () => {
    it('el aviso no pasa de los límites de Discord aunque las respuestas sean largas', () => {
        const largo = 'x'.repeat(2000);
        const campos = pe.camposResumen({ idioma: 'es' }, Array.from({ length: 30 }, () => ({ pregunta: largo, respuesta: largo })));
        const total = campos.reduce((n, c) => n + c.name.length + c.value.length, 0);
        assert.ok(campos.length <= 23, `campos: ${campos.length}`);
        assert.ok(total <= 4400, `letras: ${total}`);
        assert.strictEqual(campos[campos.length - 1].name, '…');
        assert.ok(campos.every((c) => c.name.length <= 256 && c.value.length <= 1024));
    });
    it('no manda solicitudes a un canal de otro servidor', () => {
        const canalOtro = { id: '999', isTextBased: () => true };
        const client = { guilds: { cache: new Map([['g1', { channels: { cache: new Map() } }], ['g2', { channels: { cache: new Map([['999', canalOtro]]) } }]]) } };
        assert.strictEqual(pe.canalRevision(client, 'g1', { preguntasEntrada: { canalRevisionId: '999' } }), null);
        assert.strictEqual(pe.canalRevision(client, 'g2', { preguntasEntrada: { canalRevisionId: '999' } }), canalOtro);
    });
});

describe('panel de tickets (también desde el panel web)', () => {
    it('usa los textos y el color guardados, con «Abrir un ticket» y «Ver mis tickets»', () => {
        const { embeds, components } = contenidoPanelTickets({ idioma: 'es', mensajeSoporteTitulo: 'Soporte y Ayuda', colorEmbed: '#ff0000', textoBoton: 'Abrir ticket' });
        assert.strictEqual(embeds[0].data.title, 'Soporte y Ayuda');
        assert.strictEqual(embeds[0].data.color, 0xff0000);
        const botones = components[0].components.map((b) => b.data);
        assert.strictEqual(botones[0].custom_id, 'create_ticket');
        assert.strictEqual(botones[0].label, 'Abrir ticket');
        assert.match(botones[1].custom_id, /^cuenta:abrir:tickets/);
    });
});
