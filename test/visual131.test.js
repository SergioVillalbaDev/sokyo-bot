// 1.31.0: casino, granja, pase, logros, compañero, diario y ranking en imagen (con muy poco texto).
const test = require('node:test');
const assert = require('node:assert');
const A = require('../utils/casinoArte.js');
const V = require('../utils/arteVistas.js');
const X = require('../utils/paseNucleo.js');
const K = require('../utils/cofresNucleo.js');

const esPng = (b) => Buffer.isBuffer(b) && b.slice(1, 4).toString() === 'PNG';
const esGif = (b) => Buffer.isBuffer(b) && b.slice(0, 3).toString() === 'GIF';
const ancho = (b) => b.readUInt32BE(16);
const alto = (b) => b.readUInt32BE(20);

test('la pastilla del resultado dice lo que se gana o se pierde', () => {
    assert.match(A.textoResultado({ premio: 500, apuesta: 100, mult: 5 }).texto, /×5 {2}\+🪙 500/);
    assert.equal(A.textoResultado({ premio: 0, apuesta: 100 }).texto, '−🪙 100');
    assert.equal(A.textoResultado({ premio: 50, apuesta: 100 }).texto, '↩ 🪙 50');
    assert.equal(A.textoResultado({ premio: 100, apuesta: 100 }).texto, '↩ 🪙 100');
    assert.match(A.textoResultado({ premio: 5000, apuesta: 100, bote: true, idioma: 'en' }).texto, /JACKPOT/);
    assert.equal(A.textoResultado({ premio: 0, apuesta: 100 }).color, '#991b1b');
    assert.equal(A.textoResultado({ premio: 0, apuesta: 0 }).texto, '💨', 'tirada gratis sin premio: no se pierde nada');
    assert.match(A.textoResultado({ premio: 50, apuesta: 0 }).texto, /^\+🪙 50/, 'tirada gratis con premio: es ganancia');
    assert.equal(A.textoResultado({ premio: 250, apuesta: 100 }).color, '#15803d');
});

test('los GIF del casino llevan el resultado (y son más altos para la pastilla)', async () => {
    const con = await A.gifTragaperras(['cereza', 'cereza', 'cereza'], { mult: 7, resultado: { premio: 700, apuesta: 100 } });
    const sin = await A.gifTragaperras(['cereza', 'limon', 'uva'], { mult: 0 });
    assert.ok(esGif(con) && esGif(sin));
    assert.ok(con.readUInt16LE(8) > sin.readUInt16LE(8), 'con resultado es más alto');
    assert.ok(esGif(await A.gifRuleta(0, { resultado: { premio: 0, apuesta: 10 } })));
    assert.ok(esGif(await A.gifMoneda('cara', { res: { premio: 194, apuesta: 100 } })));
    assert.ok(esGif(await A.gifDado(3)));
});

test('crash, carrera y blackjack se dibujan en todos sus estados', () => {
    for (const estado of ['vuela', 'cobrado', 'boom']) {
        const b = A.graficaCrash({ mult: 2.4, punto: 3.1, cobradoEn: 1.8, estado, apuesta: 100, auto: 2 });
        assert.ok(esPng(b), estado);
        assert.equal(ancho(b), 640);
    }
    assert.ok(esPng(A.graficaCrash({ mult: 1, punto: 1, estado: 'boom', apuesta: 50 })), 'explota al salir');
    assert.ok(esPng(A.pistaCarrera({})));
    assert.ok(esPng(A.pistaCarrera({ pos: { caballo: 1 }, ganador: 'caballo', apostados: { caballo: 3 } })));
    assert.ok(esPng(A.mesaBlackjack({ jugador: ['10♠', 'A♥'], banca: ['9♦', '7♣'], ocultar: false, resultado: { premio: 250, apuesta: 100, titulo: 'BLACKJACK!' } })));
});

test('granja, pase, logros, diario y ranking salen en imagen', async () => {
    const ids = Object.keys(K.COMPANEROS);
    const granja = await V.tarjetaGranja({
        oro: 120, frac: 0.5, porHora: 12, huecos: 4, equipo: [{ id: ids[0], estrellas: 2, oroH: 6 }, { id: ids[1], estrellas: 1, oroH: 6, triste: true }],
        album: { n: 2, total: 57, sig: 'Próximo: 3', sig2: '+🪙 250' }, semana: [{ emoji: '🤗', n: 40, prog: 10 }, { emoji: '🧭', n: 8, prog: 8, hecha: true }],
    });
    assert.ok(esPng(granja));
    const pase = V.tarjetaPase({ nivel: 4, max: 50, frac: 0.3, xp: 30, xpNivel: 100, temp: '2026-11', proximos: [5, 6].map((n) => ({ n, oro: X.premio(n).oro })), tickets: [], logros: { n: 0, total: 24 }, casino: { n: 0, tope: 25 } });
    assert.ok(esPng(pase));
    const logros = V.tarjetaLogros({ logros: X.LOGROS.map((l, i) => ({ emoji: l.emoji, nombre: l.es, oro: l.oro, tiene: i === 0 })) });
    assert.ok(esPng(logros) && alto(logros) > 400, 'una cuadrícula con las 24 insignias');
    for (const racha of [1, 7, 8, 30]) assert.ok(esPng(V.tarjetaDiario({ total: 100, racha, saldo: 1000 })), `racha ${racha}`);
    const ranking = await V.tarjetaRanking({ titulo: 'Top', filas: [{ nombre: 'ana', avatar: null, nivel: 3, xp: 300 }] });
    assert.ok(esPng(ranking), 'con una sola persona también');
});

test('la tarjeta del compañero crece con la franja de misiones', async () => {
    const d = { id: 'gato', nombre: 'Michi', rarezaTexto: 'COMÚN', estrellas: 1, nivel: 1, progreso: 0.2, estado: { hambre: 50, alegria: 50, energia: 50 }, humor: { emoji: '😊', texto: 'Bien' }, frase: 'Hola', etiquetas: { hambre: 'a', alegria: 'b', energia: 'c', nivel: 'd' }, pie: '' };
    const sin = await require('../utils/compisArte.js').tarjeta(d);
    const con = await require('../utils/compisArte.js').tarjeta({ ...d, extra: { misiones: [{ emoji: '🍖', n: 3, prog: 1 }], racha: 2, exp: { n: 0, max: 3 }, recuerdos: [], recTotal: 20, poder: { emoji: '✨', listo: true } } });
    assert.ok(alto(con.buffer) > alto(sin.buffer));
});

test('si el dibujo falla, devuelve null en vez de romper la respuesta', () => {
    assert.equal(V.tarjetaDiario(null), null);
    assert.equal(A.graficaCrash(null), null);
});

test('granja: los datos de la imagen salen de la colección', () => {
    const G = require('../utils/granjaNucleo.js');
    const { datosGranja } = require('../utils/granja.js');
    const col = { mascotas: [{ id: 'gato', estrellas: 1 }], granja: { desde: new Date(Date.now() - 6 * 3600000) } };
    const a = G.acumulado(col);
    const d = datosGranja(col, a, G.huecos(col), 'es', Date.now());
    assert.equal(d.equipo.length, 1);
    assert.ok(d.frac > 0.45 && d.frac < 0.55, 'medio granero tras 6 h');
    assert.equal(d.semana.length, Object.keys(G.MISIONES_SEMANA).length);
    assert.equal(d.album.total, G.TOTAL());
});
