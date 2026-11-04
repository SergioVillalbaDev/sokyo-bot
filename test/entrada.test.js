// ============================================================================
// Tests del mensaje de entrada (1.9.11): lo que manda el bot al entrar en un
// servidor, configurable por los propietarios (panel → Propietario → Mensaje de
// entrada). utils/onboarding.js → construirBienvenida con los ajustes `entrada`.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { construirBienvenida, piezasMensajeEntrada, ENTRADA_DEFECTO } = require('../utils/onboarding.js');

const guild = { id: '1', name: 'Nébula', iconURL: () => null };
const embedDe = (m) => m.embeds[0].toJSON();
const tamano = (e) => (e.title || '').length + (e.description || '').length + (e.footer?.text || '').length
    + (e.fields || []).reduce((n, f) => n + f.name.length + f.value.length, 0);

describe('mensaje de entrada del bot', () => {
    it('de fábrica: pasos, panel y la guía completa de todo lo que hace', () => {
        for (const idioma of ['es', 'en']) {
            const e = embedDe(construirBienvenida(guild, null, idioma, ENTRADA_DEFECTO));
            assert.strictEqual(e.title, piezasMensajeEntrada(idioma).porDefecto.titulo);
            assert.match(e.description, /Nébula/);
            assert.ok(e.fields.length >= 5, 'faltan la guía o los pasos');
            assert.ok(e.fields.some((f) => /\//.test(f.value)), 'no explica cómo ver los comandos con /');
            assert.ok(tamano(e) < 6000, 'supera el límite de 6000 caracteres de Discord');
        }
    });
    it('los textos propios de los propietarios se usan y {server} se rellena', () => {
        const entrada = { ...ENTRADA_DEFECTO, es: { titulo: 'Hola', descripcion: 'Bienvenido a **{server}** y a {servidor}' } };
        const e = embedDe(construirBienvenida(guild, null, 'es', entrada));
        assert.strictEqual(e.title, 'Hola');
        assert.strictEqual(e.description, 'Bienvenido a **Nébula** y a Nébula');
    });
    it('un «$» en el nombre del servidor sale tal cual (no es un patrón de reemplazo)', () => {
        const raro = { id: '2', name: 'Cash$&Co $1', iconURL: () => null };
        const entrada = { ...ENTRADA_DEFECTO, es: { titulo: 'Hola', descripcion: 'En {server}' } };
        assert.strictEqual(embedDe(construirBienvenida(raro, null, 'es', entrada)).description, 'En Cash$&Co $1');
    });
    it('un texto vacío vuelve al de fábrica (y en el otro idioma no se mezcla)', () => {
        const entrada = { ...ENTRADA_DEFECTO, es: { titulo: '   ', descripcion: '' }, en: { titulo: 'Only English' } };
        assert.strictEqual(embedDe(construirBienvenida(guild, null, 'es', entrada)).title, piezasMensajeEntrada('es').porDefecto.titulo);
        assert.strictEqual(embedDe(construirBienvenida(guild, null, 'en', entrada)).title, 'Only English');
    });
    it('sin la guía completa solo quedan los pasos, el panel y el consejo', () => {
        const e = embedDe(construirBienvenida(guild, null, 'es', { ...ENTRADA_DEFECTO, guiaCompleta: false }));
        assert.strictEqual(e.fields.length, 3);
    });
    it('sin ajustes cargados usa los de fábrica (p. ej. el botón de idioma antes de conectar a la BD)', () => {
        const e = embedDe(construirBienvenida(guild, null, 'en'));
        assert.ok(e.title);
        assert.ok(e.fields.length >= 3);
    });
});
