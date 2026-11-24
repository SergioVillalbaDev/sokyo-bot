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

// ---------------------------------------------------------------------------
// 1.31.1: GIF que no «se notan» y sin saltos (una animación por jugada).
// ---------------------------------------------------------------------------
const tieneBucle = (b) => b.includes(Buffer.from('NETSCAPE2.0'));
const paletasLocales = (b) => {
    // Cuenta los «Image Descriptor» (0x2C) con tabla de color local (bit 0x80 del byte 9).
    const { GifReader } = require('omggif');
    const r = new GifReader(new Uint8Array(b));
    let n = 0;
    for (let i = 0; i < r.numFrames(); i++) if (r.frameInfo(i).palette_offset !== r.frameInfo(0).palette_offset) n++;
    return n;
};

test('los GIF usan una sola paleta y los de jugada no se repiten', async () => {
    const g = await A.gifTragaperras(['uva', 'uva', 'uva'], { mult: 22, resultado: { premio: 2200, apuesta: 100, saldo: 5000 } });
    assert.equal(paletasLocales(g), 0, 'todos los fotogramas comparten la paleta');
    assert.ok(!tieneBucle(g), 'la jugada se ve una vez y se queda en el resultado');
    assert.ok(tieneBucle(await A.gifCohete()), 'el cohete del crash sí va en bucle');
    assert.ok(tieneBucle(await A.bannerCasino({ titulo: 'CASINO', boteTexto: '1000' })), 'el cartel del lobby, también');
});

test('el blackjack acaba en una sola animación (destapa, roba y resultado)', async () => {
    const { GifReader } = require('omggif');
    const g = await A.gifBlackjack({ jugador: ['10♠', '8♥'], bancaInicial: ['6♦', '5♣'], banca: ['6♦', '5♣', '3♠', '4♥'], resultado: { premio: 0, apuesta: 100, titulo: 'X' } });
    const r = new GifReader(new Uint8Array(g));
    assert.ok(r.numFrames() > 25, 'carta a carta, con movimiento');
    const sinDestapar = await A.gifBlackjack({ jugador: ['A♠', 'K♥'], bancaInicial: ['6♦', '5♣'], banca: ['6♦', '5♣'], destapar: false, resultado: { premio: 250, apuesta: 100 } });
    assert.ok(new GifReader(new Uint8Array(sinDestapar)).numFrames() < r.numFrames());
});

test('la carrera entera va en un GIF con los ganadores al final', async () => {
    const C = require('../utils/casinoNucleo.js');
    const { GifReader } = require('omggif');
    const g = await A.gifCarrera({ pasos: C.pasosCarrera('tortuga'), ganador: 'tortuga', ganadores: [{ nombre: 'ana', premio: 939 }] });
    const r = new GifReader(new Uint8Array(g));
    assert.ok(r.numFrames() >= 3 + 8 * 9, 'cuenta atrás + 8 tramos interpolados');
    assert.ok(g.length < 3 * 1024 * 1024, 'pesa poco (solo se guarda lo que se mueve)');
    assert.ok(esGif(await A.gifCarrera({ pasos: C.pasosCarrera('caballo'), ganador: 'caballo' })), 'sin ganadores también');
});

test('en la carrera nadie retrocede y el ganador llega el primero', () => {
    const C = require('../utils/casinoNucleo.js');
    for (let n = 0; n < 200; n++) {
        const gana = C.CORREDORES[n % C.CORREDORES.length].id;
        const pasos = C.pasosCarrera(gana);
        for (let i = 1; i < pasos.length; i++) for (const c of C.CORREDORES) assert.ok(pasos[i][c.id] >= pasos[i - 1][c.id], `${c.id} retrocede en el paso ${i}`);
        const fin = pasos.at(-1);
        for (const c of C.CORREDORES) if (c.id !== gana) assert.ok(fin[c.id] < fin[gana]);
    }
});

test('generar la carrera no deja al bot parado (cede el turno entre fotogramas)', async () => {
    const C = require('../utils/casinoNucleo.js');
    let ultimo = Date.now(); let peor = 0;
    const reloj = setInterval(() => { const ahora = Date.now(); peor = Math.max(peor, ahora - ultimo); ultimo = ahora; }, 5);
    await A.gifCarrera({ pasos: C.pasosCarrera('cebra'), ganador: 'cebra' });
    clearInterval(reloj);
    assert.ok(peor < 400, `el bot estuvo parado ${peor} ms seguidos`);
});
