// ============================================================================
// Tests del aviso "Bot actualizado" (utils/anuncioActualizacion.js).
//
// Solo cubren la parte pura: qué servidor se elige (tolerando erratas) y en qué
// canal se publica. Se usan objetos falsos con la forma mínima de discord.js.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { Collection, ChannelType } = require('discord.js');

const { servidoresObjetivo, canalGeneral, normalizar, distancia } = require('../utils/anuncioActualizacion.js');

const clienteCon = (...nombres) => ({
    guilds: {
        cache: new Collection(nombres.map((name, i) => [String(i + 1), { id: String(i + 1), name, available: true }])),
    },
});

const canal = (id, name, { escribe = true, rawPosition = 0, type = ChannelType.GuildText } = {}) => ({
    id, name, type, rawPosition,
    permissionsFor: () => ({ has: () => escribe }),
});

const servidorCon = (canales, systemChannel = null) => ({
    members: { me: {} },
    systemChannel,
    channels: { cache: new Collection(canales.map((c) => [c.id, c])) },
});

describe('normalizar y distancia', () => {
    it('quita acentos, mayúsculas y símbolos', () => {
        assert.strictEqual(normalizar('  Tókyto ✨ Server '), 'tokytoserver');
    });
    it('calcula la distancia de edición', () => {
        assert.strictEqual(distancia('tokyto', 'tokyo'), 1);
        assert.strictEqual(distancia('tokyto', 'tokyto'), 0);
        assert.strictEqual(distancia('abc', 'xyz'), 3);
    });
});

describe('servidoresObjetivo', () => {
    it('encuentra el servidor por nombre sin importar mayúsculas ni adornos', () => {
        const r = servidoresObjetivo(clienteCon('Otro', '✨ TOKYTO Comunidad'), 'Tokyto');
        assert.deepStrictEqual(r.map((g) => g.name), ['✨ TOKYTO Comunidad']);
    });
    it('encuentra el servidor por ID', () => {
        const r = servidoresObjetivo(clienteCon('A', 'B'), '2');
        assert.deepStrictEqual(r.map((g) => g.id), ['2']);
    });
    it('tolera una errata en el nombre', () => {
        const r = servidoresObjetivo(clienteCon('Otro', 'Tokyo Server'), 'Tokyto');
        assert.deepStrictEqual(r.map((g) => g.name), ['Tokyo Server']);
    });
    it('usa el único servidor si ninguno coincide', () => {
        const r = servidoresObjetivo(clienteCon('Mi servidor'), 'Tokyto');
        assert.deepStrictEqual(r.map((g) => g.name), ['Mi servidor']);
    });
    it('no elige ninguno si hay varios y ninguno coincide', () => {
        assert.deepStrictEqual(servidoresObjetivo(clienteCon('Alfa', 'Beta'), 'Tokyto'), []);
    });
    it('queda desactivado con el nombre vacío', () => {
        assert.deepStrictEqual(servidoresObjetivo(clienteCon('Tokyto'), ''), []);
    });
});

describe('canalGeneral', () => {
    it('prefiere el canal llamado general', () => {
        const g = servidorCon([canal('1', 'reglas'), canal('2', 'chat-general'), canal('3', 'general')]);
        assert.strictEqual(canalGeneral(g).id, '3');
    });
    it('si no, uno que contenga "general"', () => {
        const g = servidorCon([canal('1', 'reglas'), canal('2', '💬・general-es')]);
        assert.strictEqual(canalGeneral(g).id, '2');
    });
    it('ignora los canales donde el bot no puede escribir', () => {
        const g = servidorCon([canal('1', 'general', { escribe: false }), canal('2', 'charla', { rawPosition: 1 })]);
        assert.strictEqual(canalGeneral(g).id, '2');
    });
    it('usa el canal del sistema y luego el primero disponible', () => {
        const sistema = canal('9', 'bienvenidas', { rawPosition: 5 });
        assert.strictEqual(canalGeneral(servidorCon([canal('1', 'charla'), sistema], sistema)).id, '9');
        assert.strictEqual(canalGeneral(servidorCon([canal('2', 'b', { rawPosition: 2 }), canal('1', 'a', { rawPosition: 1 })])).id, '1');
    });
    it('devuelve null si no hay dónde escribir', () => {
        assert.strictEqual(canalGeneral(servidorCon([canal('1', 'voz', { type: ChannelType.GuildVoice })])), null);
    });
});

// Las novedades de cada versión van en el aviso (y caben en un mensaje de Discord).
describe('novedades del aviso', () => {
    const { NOVEDADES, mensajeNovedades } = require('../utils/novedades.js');
    it('cada versión con novedades da un mensaje de menos de 2000 caracteres con su número', () => {
        for (const v of Object.keys(NOVEDADES)) {
            const m = mensajeNovedades(v);
            assert.ok(m.includes(`v${v}`));
            assert.ok(m.length <= 2000, `${v}: ${m.length} caracteres`);
        }
    });
    it('sin novedades apuntadas no hay mensaje propio (se usa el genérico)', () => {
        assert.strictEqual(mensajeNovedades('0.0.1'), null);
    });
});
