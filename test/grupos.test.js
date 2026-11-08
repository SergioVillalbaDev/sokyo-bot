// ============================================================================
// Tests de buscar grupo (1.9.16): /grupo abre una ventana con a qué se juega,
// plazas, cuándo y un mensaje de varias líneas; «Editar» en el grupo; y el
// borrador (lo escrito no se pierde si algo falla al publicar).
// utils/grupos.js. Sin MongoDB: lo que la necesita falla al momento.
// ============================================================================
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { TextInputStyle } = require('discord.js');
// Sin conexión, que Mongoose falle al momento en vez de esperar 10 s.
require('mongoose').set('bufferCommands', false);
const grupos = require('../utils/grupos.js');
const comando = require('../slash/grupo.js');

const cajas = (modal) => modal.toJSON().components.map((fila) => fila.components[0]);

// Una interacción falsa con lo justo: responde, abre ventanas y lee lo escrito.
function interaccion({ customId = '', campos = {}, userId = 'u1', guildId = 'g1' } = {}) {
    const i = {
        customId, guildId, locale: 'es-ES', user: { id: userId }, member: null, deferred: false,
        respuestas: [], ventanas: [],
        fields: { getTextInputValue(id) { if (!(id in campos)) throw new Error('no existe'); return campos[id]; } },
        async reply(r) { this.respuestas.push(r); },
        async editReply(r) { this.respuestas.push(r); },
        async deferReply() { this.deferred = true; },
        async showModal(m) { this.ventanas.push(m); },
    };
    return i;
}

describe('grupos: la ventana de /grupo', () => {
    it('/grupo ya no pide nada escrito: todo se rellena en la ventana', () => {
        assert.deepStrictEqual(comando.data.toJSON().options, []);
    });
    it('tiene juego, plazas, cuándo y una caja grande para el mensaje, dentro de los límites de Discord', () => {
        for (const idioma of ['es', 'en']) {
            for (const destino of ['nuevo', '665f0c0c0c0c0c0c0c0c0c0c']) {
                const m = grupos.ventanaGrupo(destino, {}, idioma);
                const json = m.toJSON();
                assert.strictEqual(json.custom_id, `grp_ventana:${destino}`);
                assert.ok(json.title.length <= 45);
                const cs = cajas(m);
                assert.deepStrictEqual(cs.map((c) => c.custom_id), ['juego', 'plazas', 'cuando', 'mensaje']);
                for (const c of cs) {
                    assert.ok(c.label.length <= 45, `etiqueta larga: ${c.label}`);
                    assert.ok(c.placeholder.length <= 100, `ayuda larga: ${c.placeholder}`);
                }
                assert.deepStrictEqual(cs.map((c) => c.required), [true, true, false, false]);
                assert.strictEqual(cs[3].style, TextInputStyle.Paragraph);
                assert.strictEqual(cs[3].max_length, grupos.MAX_MENSAJE);
            }
        }
        assert.match(grupos.ventanaGrupo('nuevo', {}, 'es').toJSON().title, /Buscar grupo/);
        assert.match(grupos.ventanaGrupo('abc', {}, 'es').toJSON().title, /Editar/);
    });
    it('sale con lo que ya estaba escrito (al editar o al volver del borrador)', () => {
        const cs = cajas(grupos.ventanaGrupo('nuevo', { juego: 'Minecraft', plazas: 20, cuando: '', descripcion: 'Survival\n\nCon micro' }, 'es'));
        assert.strictEqual(cs[0].value, 'Minecraft');
        assert.strictEqual(cs[1].value, '20');
        assert.strictEqual(cs[2].value, undefined); // vacío: Discord enseña la ayuda gris
        assert.strictEqual(cs[3].value, 'Survival\n\nCon micro');
    });
    it('las plazas valen escritas de muchas formas, siempre de 2 a 25', () => {
        assert.strictEqual(grupos.leerPlazas('5'), 5);
        assert.strictEqual(grupos.leerPlazas(' 5 personas'), 5);
        assert.strictEqual(grupos.leerPlazas('somos 10'), 10);
        assert.strictEqual(grupos.leerPlazas(25), 25);
        for (const mal of ['1', '26', 'cinco', '', null, undefined]) assert.strictEqual(grupos.leerPlazas(mal), null, String(mal));
    });
    it('el mensaje conserva sus líneas, sin huecos de más ni pasarse de largo', () => {
        const d = grupos.datosVentana(interaccion({ campos: {
            juego: '  Valorant  ', plazas: '5', cuando: 'a las 22:00',
            mensaje: 'Partidas tranquilas   \r\n\r\n\r\n\r\nNivel oro\n- con micro  ',
        } }));
        assert.deepStrictEqual(d, { juego: 'Valorant', plazas: '5', cuando: 'a las 22:00', descripcion: 'Partidas tranquilas\n\nNivel oro\n- con micro' });
        const largo = grupos.datosVentana(interaccion({ campos: { juego: 'x', plazas: '2', mensaje: 'a'.repeat(5000) } }));
        assert.strictEqual(largo.descripcion.length, grupos.MAX_MENSAJE);
        assert.strictEqual(largo.cuando, ''); // una caja que no llega no rompe nada
    });
});

describe('grupos: el mensaje del grupo', () => {
    const base = { _id: 'abc', juego: 'Valorant', plazas: 5, miembros: ['1', '2'], cuando: '', creadoFecha: new Date() };
    it('el mensaje sale entero, con sus líneas, debajo del juego', () => {
        const e = grupos.embedGrupo({ ...base, estado: 'abierto', descripcion: 'Partidas tranquilas\nNivel oro · con micro' }, 'es').toJSON();
        assert.strictEqual(e.title, 'Valorant');
        assert.strictEqual(e.description, 'Partidas tranquilas\nNivel oro · con micro');
    });
    it('lleva «Editar» junto a apuntarse, salir y cerrar; cerrado, todo desactivado', () => {
        const abierto = grupos.filaGrupo({ ...base, estado: 'abierto' }, 'es').toJSON().components;
        assert.deepStrictEqual(abierto.map((b) => b.custom_id), ['grp_unir:abc', 'grp_salir:abc', 'grp_editar:abc', 'grp_cerrar:abc']);
        assert.ok(abierto.every((b) => !b.disabled));
        const lleno = grupos.filaGrupo({ ...base, estado: 'lleno' }, 'es').toJSON().components;
        assert.deepStrictEqual(lleno.map((b) => !!b.disabled), [true, false, false, false]); // completo: se puede editar (p. ej. más plazas)
        const cerrado = grupos.filaGrupo({ ...base, estado: 'cerrado' }, 'en').toJSON().components;
        assert.ok(cerrado.every((b) => b.disabled));
        assert.strictEqual(cerrado[2].label, 'Edit');
    });
});

describe('grupos: borradores', () => {
    beforeEach(() => { grupos.borrarBorrador('g1', 'u1', 'nuevo'); grupos.borrarBorrador('g1', 'u2', 'nuevo'); });
    it('se guarda por persona y por grupo, y dura una hora', () => {
        const ahora = Date.now();
        grupos.guardarBorrador('g1', 'u1', 'nuevo', { juego: 'Minecraft', plazas: '20', cuando: '', descripcion: 'Hola' }, ahora);
        assert.strictEqual(grupos.verBorrador('g1', 'u1', 'nuevo', ahora + 1000).juego, 'Minecraft');
        assert.strictEqual(grupos.verBorrador('g1', 'u2', 'nuevo', ahora), null);
        assert.strictEqual(grupos.verBorrador('g1', 'u1', 'otroGrupo', ahora), null);
        assert.strictEqual(grupos.verBorrador('g1', 'u1', 'nuevo', ahora + 61 * 60 * 1000), null);
        assert.strictEqual(grupos.verBorrador('g1', 'u1', 'nuevo', ahora), null); // caducado: ya no está
    });
    it('si las plazas no valen, no se publica, se guarda lo escrito y sale «Volver a la ventana»', async () => {
        const i = interaccion({ customId: 'grp_ventana:nuevo', campos: { juego: 'Minecraft', plazas: 'muchos', cuando: 'ahora', mensaje: 'Survival con amigos\nTraed comida' } });
        await grupos.manejarVentana(i);
        const r = i.respuestas[0];
        assert.strictEqual(r.flags, 64);
        assert.match(r.content, /Plazas/);
        assert.match(r.content, /guardado/);
        assert.strictEqual(r.components[0].toJSON().components[0].custom_id, 'grp_reabrir:nuevo');
        assert.strictEqual(grupos.verBorrador('g1', 'u1', 'nuevo').descripcion, 'Survival con amigos\nTraed comida');
    });
    it('«Volver a la ventana» la abre con todo lo escrito', async () => {
        grupos.guardarBorrador('g1', 'u1', 'nuevo', { juego: 'Minecraft', plazas: 'muchos', cuando: 'ahora', descripcion: 'Survival\nTraed comida' });
        const i = interaccion({ customId: 'grp_reabrir:nuevo' });
        i.isButton = () => true;
        await grupos.manejarBoton(i);
        assert.strictEqual(i.ventanas.length, 1);
        const cs = cajas(i.ventanas[0]);
        assert.deepStrictEqual(cs.map((c) => c.value), ['Minecraft', 'muchos', 'ahora', 'Survival\nTraed comida']);
    });
    it('sin borrador (pasada la hora), lo explica en vez de abrir una ventana vacía', async () => {
        const i = interaccion({ customId: 'grp_reabrir:nuevo', userId: 'u2' });
        await grupos.manejarBoton(i);
        assert.strictEqual(i.ventanas.length, 0);
        assert.match(i.respuestas[0].content, /Ya no tengo guardado/);
    });
    it('/grupo abre la ventana con el borrador; apagado en el servidor, lo dice', async () => {
        grupos.guardarBorrador('g1', 'u1', 'nuevo', { juego: 'Minecraft', plazas: '20', cuando: '', descripcion: 'Hola' });
        const i = interaccion();
        await comando.execute(i, null, null);
        assert.strictEqual(cajas(i.ventanas[0])[0].value, 'Minecraft');
        const apagado = interaccion();
        await comando.execute(apagado, null, { grupos: { activo: false } });
        assert.strictEqual(apagado.ventanas.length, 0);
        assert.match(apagado.respuestas[0].content, /apagado/);
    });
});
