const test = require('node:test');
const assert = require('node:assert/strict');
const { construirTranscriptHtml } = require('../utils/ticketManager.js');

const ticket = { titulo: '<b>Hola</b>', creadorNombre: 'ana', creadorId: '1', motivo: 'm', prioridad: 'Alta', fechaCreacion: new Date('2026-01-01'), fechaCierre: new Date('2026-01-01T02:00:00Z') };

test('la transcripción HTML escapa contenido malicioso', () => {
    const html = construirTranscriptHtml(ticket, [{ usuario: '<script>x</script>', usuarioId: '1', contenido: '<img src=x onerror=alert(1)>', imagenes: ['javascript:alert(1)', 'https://cdn.x/a.png'], fecha: new Date() }]);
    assert.ok(!html.includes('<script>x'));
    assert.ok(!html.includes('<img src=x'));
    assert.ok(!html.includes('javascript:'), 'solo se admiten imágenes http(s)');
    assert.ok(html.includes('https://cdn.x/a.png'));
    assert.ok(html.includes('2 h'), 'muestra la duración');
});

test('transcripción vacía', () => {
    assert.ok(construirTranscriptHtml(ticket, []).includes('No se registraron mensajes'));
});
