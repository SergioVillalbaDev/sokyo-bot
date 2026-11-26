// 2.5.0: una sola ventana (utils/ventana.js). Lo privado cambia en su mismo mensaje en vez de ir dejando
// mensajes «Solo tú puedes ver esto» uno debajo de otro, y una ventana nueva sustituye a la anterior.
const test = require('node:test');
const assert = require('node:assert');
const V = require('../utils/ventana.js');

let n = 0;
// Interacción falsa con lo justo: apunta qué método de Discord se llama y con qué.
function falsa({ customId = 'cas_lb:mio', efimero = true, componente = true, user = 'U', canal = 'C', comando = null } = {}) {
    const llamadas = [];
    const msg = componente ? { id: `m${++n}`, flags: { has: (f) => f === 64 && efimero } } : null;
    const i = {
        id: `i${++n}`, guildId: 'G', channelId: canal, user: { id: user }, customId, commandName: comando, message: msg,
        replied: false, deferred: false, llamadas,
        isMessageComponent: () => componente, isModalSubmit: () => false, isFromMessage: () => false,
        isButton: () => componente, isChatInputCommand: () => !!comando,
    };
    for (const k of ['reply', 'deferReply', 'editReply', 'followUp', 'deleteReply', 'update', 'deferUpdate']) {
        i[k] = async (p) => { llamadas.push([k, p]); if (['reply', 'update'].includes(k)) i.replied = true; if (['deferReply', 'deferUpdate'].includes(k)) i.deferred = true; return { id: `r${++n}` }; };
    }
    V.preparar(i);
    return i;
}
const metodos = (i) => i.llamadas.map(([k]) => k);

test('en tu ventana, una vista privada cambia el mismo mensaje y vacía lo que no dice', async () => {
    const i = falsa();
    await i.reply({ embeds: [{ title: 'Mi oro' }], flags: 64 });
    assert.deepStrictEqual(metodos(i), ['update']);
    const p = i.llamadas[0][1];
    assert.deepStrictEqual(p.components, []);
    assert.deepStrictEqual(p.attachments, [], 'la imagen de antes se quita');
    assert.equal(p.content, '');
    assert.equal(p.flags, undefined, 'al editar no se mandan los flags');
});

test('en tu ventana, un aviso de texto sale encima sin borrar la vista y se quita al pulsar otra cosa', async () => {
    const i = falsa();
    await i.reply({ content: 'No tienes 🪙 100.', flags: 64 });
    assert.deepStrictEqual(i.llamadas, [['update', { content: 'No tienes 🪙 100.' }]], 'solo cambia el texto: embeds y botones se quedan');
    // Otra pulsación en el mismo mensaje: su vista nueva quita el aviso.
    const k = falsa(); k.message.id = i.message.id;
    await k.update({ embeds: [{ title: 'Blackjack' }] });
    assert.equal(k.llamadas[0][1].content, '', 'el aviso viejo se quita');
});

test('deferReply privado en tu ventana = deferUpdate; el primer contenido sustituye, lo siguiente solo edita', async () => {
    const i = falsa({ customId: 'menu:a:casino:crash:U' });
    await i.deferReply({ flags: 64 });
    await i.editReply({ embeds: [{ title: 'Crash' }], files: [{ name: 'cohete.gif' }] });
    await i.editReply({ embeds: [{ title: 'Crash ×1,20' }], components: [] });
    await i.deleteReply();
    assert.deepStrictEqual(metodos(i), ['deferUpdate', 'editReply', 'editReply'], 'deleteReply no borra tu ventana');
    assert.deepStrictEqual(i.llamadas[1][1].attachments, []);
    assert.equal(i.llamadas[2][1].attachments, undefined, 'el crash en directo no pierde su GIF');
});

test('un followUp privado de texto en tu ventana sale como aviso en ella', async () => {
    const i = falsa();
    await i.deferUpdate();
    await i.followUp({ content: '💥 ¡Demasiado tarde!', flags: 64 });
    assert.deepStrictEqual(metodos(i), ['deferUpdate', 'editReply']);
    // Un followUp público o con vista sigue saliendo aparte.
    await i.followUp({ content: '🎉 ¡Premio gordo!' });
    await i.followUp({ embeds: [{ title: 'carta' }], flags: 64 });
    assert.deepStrictEqual(metodos(i).slice(2), ['followUp', 'followUp']);
});

test('lo público y lo marcado «aparte» no se tocan', async () => {
    const i = falsa();
    await i.reply({ content: '⚔️ Duelo', embeds: [{ title: 'x' }] });
    assert.deepStrictEqual(metodos(i), ['reply']);
    const j = falsa();
    await j.reply({ embeds: [{ title: 'x' }], flags: 64, aparte: true });
    assert.deepStrictEqual(metodos(j), ['reply']);
    assert.equal('aparte' in j.llamadas[0][1], false, 'aparte no llega a Discord');
});

test('en un mensaje público (el lobby), se abre una ventana nueva y la anterior del mismo canal se borra', async () => {
    const a = falsa({ efimero: false, customId: 'cas_lob', user: 'P1', canal: 'K1' });
    await a.reply({ embeds: [{ title: 'Mesa' }], flags: 64 });
    const b = falsa({ efimero: false, customId: 'cas_lb:mio', user: 'P1', canal: 'K1' });
    await b.reply({ embeds: [{ title: 'Mi oro' }], flags: 64 });
    await new Promise((r) => setImmediate(r));
    assert.ok(metodos(a).includes('deleteReply'), 'la mesa anterior se borra');
    assert.ok(!metodos(b).includes('deleteReply'));
    // Otra persona u otro canal: no se toca.
    const c = falsa({ efimero: false, customId: 'cas_lob', user: 'P2', canal: 'K1' });
    await c.reply({ embeds: [{ title: 'Mesa' }], flags: 64 });
    const d = falsa({ efimero: false, customId: 'cas_lob', user: 'P1', canal: 'K2' });
    await d.reply({ embeds: [{ title: 'Mesa' }], flags: 64 });
    await new Promise((r) => setImmediate(r));
    assert.ok(!metodos(b).includes('deleteReply'));
});

test('con una partida a medias no se borra la ventana', async () => {
    let enMarcha = true;
    V.registrarEnMarcha((userId) => userId === 'P3' && enMarcha);
    const a = falsa({ efimero: false, customId: 'cas_lob', user: 'P3', canal: 'K3' });
    await a.reply({ embeds: [{ title: 'Blackjack' }], flags: 64 });
    const b = falsa({ efimero: false, customId: 'cas_lob', user: 'P3', canal: 'K3' });
    await b.reply({ embeds: [{ title: 'Mesa' }], flags: 64 });
    await new Promise((r) => setImmediate(r));
    assert.ok(!metodos(a).includes('deleteReply'));
    enMarcha = false;
});

test('los avisos sueltos no se acumulan: el nuevo quita el anterior', async () => {
    const a = falsa({ efimero: false, customId: 'cas_lb:diaria', user: 'P4', canal: 'K4' });
    await a.reply({ content: 'Ya has usado tu tirada.', flags: 64 });
    const b = falsa({ efimero: false, customId: 'cas_lb:diaria', user: 'P4', canal: 'K4' });
    await b.reply({ content: 'Ya has usado tu tirada.', flags: 64 });
    await new Promise((r) => setImmediate(r));
    assert.ok(metodos(a).includes('deleteReply'));
});

test('fuera de juegos (staff, tickets…) no se borra nada de nadie', async () => {
    const a = falsa({ efimero: false, customId: 'close_ticket', user: 'P5', canal: 'K5' });
    await a.reply({ embeds: [{ title: 'x' }], flags: 64 });
    const b = falsa({ efimero: false, customId: 'close_ticket', user: 'P5', canal: 'K5' });
    await b.reply({ embeds: [{ title: 'y' }], flags: 64 });
    await new Promise((r) => setImmediate(r));
    assert.ok(!metodos(a).includes('deleteReply'));
});

test('responderJuego: en tu ventana o en tu propio mensaje juega ahí; si no, mensaje nuevo', async () => {
    const enVentana = falsa({ customId: 'cof_otro:basico' });
    assert.deepStrictEqual(await V.responderJuego(enVentana), { enSitio: true, privado: true });
    assert.equal(enVentana.__casinoPrivado, true);
    await enVentana.editReply({ embeds: [{ title: 'Cofre' }] });
    assert.deepStrictEqual(enVentana.llamadas.at(-1)[1].attachments, [], 'el GIF del cofre anterior se quita');
    await enVentana.followUp({ content: '⭐ ¡Nueva estrella!' });
    assert.equal(enVentana.llamadas.at(-1)[0], 'editReply', 'en tu ventana, lo de después también es solo para ti (como aviso)');

    const mio = falsa({ efimero: false, customId: 'cof_otro:basico', user: 'P6' });
    mio.message.interactionMetadata = { user: { id: 'P6' } };
    assert.deepStrictEqual(await V.responderJuego(mio), { enSitio: true, privado: false });
    await V.falloJuego(mio, { enSitio: true }, '❌ No tienes oro');
    assert.ok(!metodos(mio).includes('deleteReply'), 'tu mensaje no se borra si falla');

    const ajeno = falsa({ efimero: false, customId: 'cof_otro:basico', user: 'P7' });
    ajeno.message.interactionMetadata = { user: { id: 'OTRA' } };
    assert.deepStrictEqual(await V.responderJuego(ajeno), { enSitio: false, privado: false });
    assert.deepStrictEqual(metodos(ajeno), ['deferReply']);
});

test('casino: las partidas solo para ti valen en cualquier canal si se juegan en privado', async () => {
    const casino = require('../utils/casino.js');
    assert.equal(casino.canalJuego({ channelId: 'X', __casinoPrivado: true }), null);
    assert.equal(casino.canalJuego({ channelId: 'X', message: { flags: { has: (f) => f === 64 } } }), null);
    assert.equal(casino.canalJuego({ channelId: 'X' }), 'X');
    assert.ok(casino.fueraDelCasino({ casino: { canalId: 'CAS' } }, 'X'));
    assert.ok(!casino.fueraDelCasino({ casino: { canalId: 'CAS' } }, 'CAS'));
    assert.ok(!casino.fueraDelCasino({ casino: {} }, 'X'));
    // En público fuera de su canal, sí se pide el canal del casino (y el texto lo explica sin mandarte allí a ciegas).
    const a = await casino.apostar({ guildId: 'G', canalId: 'X', userId: 'U', cfg: { casino: { activo: true, canalId: 'CAS' } }, juego: 'minas', cantidad: 10 });
    assert.equal(a.fallo, 'canal');
    assert.match(casino.textoFallo(a, 'es', { canalId: 'CAS' }), /aquí mismo/);
});

test('casino: «Otra vez» va con «Cambiar apuesta o juego» y la mesa lleva el desplegable de juegos', async () => {
    const casino = require('../utils/casino.js');
    const fila = casino.filaOtraVez('ruleta', 50, 'es', 'rojo').toJSON().components;
    assert.deepStrictEqual(fila.map((b) => b.custom_id), ['cas_rep:ruleta:50:rojo', 'cas_mesa:ruleta:rojo']);
    const L = require('../utils/casinoLobby.js');
    const v = L.conJuegos({ components: [] }, { casino: { activo: true } }, 'es', 'minas');
    const menu = v.components[0].toJSON().components[0];
    assert.equal(menu.custom_id, 'cas_lob');
    assert.ok(menu.options.find((o) => o.value === 'minas').default, 'el juego abierto sale marcado');
    assert.ok(menu.options.length <= 25);
    // Si no cabe (deja sitio a «🏠 Menú · ❔»), no se pone.
    assert.equal(L.conJuegos({ components: [1, 2, 3, 4] }, {}, 'es').components.length, 4);
});

test('una ventana nueva solo sustituye a la de la MISMA función (lo que tengas a medias de otra no se pierde)', async () => {
    const menu = falsa({ efimero: false, customId: 'menu:abrir:P8', user: 'P8', canal: 'K8' });
    await menu.reply({ embeds: [{ title: 'Tu menú' }], flags: 64 });
    const mesa = falsa({ efimero: false, customId: 'cas_lob', user: 'P8', canal: 'K8' });
    await mesa.reply({ embeds: [{ title: 'Mesa' }], flags: 64 });
    await new Promise((r) => setImmediate(r));
    assert.ok(!metodos(menu).includes('deleteReply'), 'abrir el casino no cierra tu menú');
    const otraMesa = falsa({ efimero: false, customId: 'cas_lb:mio', user: 'P8', canal: 'K8' });
    await otraMesa.reply({ embeds: [{ title: 'Mi oro' }], flags: 64 });
    await new Promise((r) => setImmediate(r));
    assert.ok(metodos(mesa).includes('deleteReply'), 'pero la mesa anterior del casino sí se cierra');
});

test('las ventanas privadas del staff no se tocan (confirmar un cierre, asistentes…)', async () => {
    const i = falsa({ customId: 'close_ticket_confirm' });
    await i.reply({ content: '✅ Hecho', flags: 64 });
    assert.deepStrictEqual(metodos(i), ['reply'], 'sale aparte, como siempre');
});

test('tras convertir un reply en tu ventana, lo que se edite después no vacía la vista', async () => {
    const i = falsa();
    await i.reply({ embeds: [{ title: 'x' }], files: [{ name: 'a.gif' }], components: [1], flags: 64 });
    await i.editReply({ embeds: [{ title: 'y' }] });
    assert.equal(i.llamadas[1][1].components, undefined, 'los botones y la imagen se quedan');
});
