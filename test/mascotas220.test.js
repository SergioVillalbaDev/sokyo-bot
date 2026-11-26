// 2.2.0: trucos de las mascotas, carta gratis de cada día, combates con animaciones nuevas, cartas
// rediseñadas y el GIF más rápido. Las imágenes solo se comprueban si hay canvas.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const P = require('../utils/compisNucleo.js');
const S = require('../utils/cartasNucleo.js');
const K = require('../utils/cofresNucleo.js');
const C = require('../utils/combateNucleo.js');
const A = require('../utils/casinoArte.js');

const HORA = 3600000;
const afinidadDe = (n) => { let a = 0; while (P.nivel(a) < n) a += 25; return a; };

describe('trucos', () => {
    it('se aprenden al subir de nivel', () => {
        assert.deepStrictEqual(P.trucosDe({ id: 'gato', afinidad: 0 }), ['saltar']);
        assert.deepStrictEqual(P.trucosNuevos(2, 6), ['vuelta', 'bailar']);
        assert.deepStrictEqual(P.trucosNuevos(6, 6), []);
        assert.strictEqual(P.trucosDe({ id: 'gato', afinidad: afinidadDe(P.NIVEL_MAX) }).length, Object.keys(P.TRUCOS).filter((id) => P.TRUCOS[id].nivel <= P.NIVEL_MAX).length);
    });
    it('no se puede hacer uno que aún no sabe', () => {
        const r = P.hacerTruco({ id: 'gato', afinidad: 0 }, 'magia');
        assert.strictEqual(r.fallo, 'nivelTruco');
        assert.strictEqual(r.nivel, P.TRUCOS.magia.nivel);
    });
    it('premia una vez cada pocas horas; entre medias solo presume (sin gastar nada)', () => {
        const ahora = Date.parse('2026-11-26T10:00:00Z');
        const m = { id: 'gato', afinidad: 0, hambre: 80, alegria: 50, energia: 80, actualizado: new Date(ahora) };
        const r1 = P.hacerTruco(m, 'saltar', ahora);
        assert.ok(r1.premio);
        assert.ok(r1.alegria > 50 && r1.energia < 80 && r1.afinidad > 0);
        const m2 = { ...m, alegria: r1.alegria, energia: r1.energia, cds: r1.cds, actualizado: new Date(ahora) };
        const r2 = P.hacerTruco(m2, 'saltar', ahora + HORA);
        assert.strictEqual(r2.premio, false);
        assert.strictEqual(r2.afinidad, 0);
        assert.strictEqual(r2.energia, P.estado(m2, ahora + HORA).energia, 'repetirlo para presumir no gasta energía');
        assert.ok(r2.min > 0 && r2.min <= P.TRUCO_ESPERA_H * 60);
        assert.ok(P.hacerTruco(m2, 'saltar', ahora + P.TRUCO_ESPERA_H * HORA + 1000).premio);
    });
    it('sin energía o de expedición, no', () => {
        const ahora = Date.now();
        assert.strictEqual(P.hacerTruco({ id: 'gato', afinidad: 0, hambre: 80, alegria: 80, energia: 1, actualizado: new Date(ahora) }, 'saltar', ahora).fallo, 'energia');
        assert.strictEqual(P.hacerTruco({ id: 'gato', afinidad: 0, exp: { tipo: 'parque', desde: new Date(ahora), hasta: new Date(ahora + HORA) } }, 'saltar', ahora).fallo, 'fuera');
    });
});

describe('carta gratis de cada día', () => {
    const azar = (() => { let x = 0.42; return () => (x = (x * 9.731 + 0.137) % 1); })();
    it('una al día', () => {
        const r = S.cartaGratis({ cartas: [] }, '2026-11-26', azar);
        assert.ok(r.carta && r.carta.id && r.carta.nuevo);
        assert.strictEqual(r.cartas.length, 1);
        assert.strictEqual(S.cartaGratis({ cartas: r.cartas, cartaGratis: '2026-11-26' }, '2026-11-26', azar).fallo, 'hoy');
        assert.ok(S.cartaGratis({ cartas: r.cartas, cartaGratis: '2026-11-25' }, '2026-11-26', azar).carta);
    });
    it('repetida sube estrella; al máximo da polvo', () => {
        const fijo = () => 0.01; // siempre la misma carta común
        const id = S.cartaGratis({ cartas: [] }, 'd', fijo).carta.id;
        const sube = S.cartaGratis({ cartas: [{ id, estrellas: 2 }] }, 'd', fijo);
        assert.strictEqual(sube.carta.estrellas, 3);
        assert.strictEqual(sube.cartas.find((c) => c.id === id).estrellas, 3);
        const max = S.cartaGratis({ cartas: [{ id, estrellas: S.MAX_ESTRELLAS }] }, 'd', fijo);
        assert.strictEqual(max.polvo, S.POLVO[K.def(id).rareza]);
        assert.strictEqual(max.cartas.find((c) => c.id === id).estrellas, S.MAX_ESTRELLAS);
    });
    it('si es de una serie quitada, da oro y no cambia de carta', () => {
        const fijo = () => 0.01;
        const id = S.cartaGratis({ cartas: [] }, 'd', fijo).carta.id;
        const r = S.cartaGratis({ cartas: [] }, 'd', fijo, new Set([id]));
        assert.ok(r.carta.quitada);
        assert.strictEqual(r.carta.devuelto, S.CARTA_GRATIS_ORO_QUITADA);
        assert.deepStrictEqual(r.cartas, []);
    });
    it('no toca las cartas que recibe', () => {
        const cartas = [{ id: [...K.ANIME.keys()][0], estrellas: 1 }];
        const copia = JSON.stringify(cartas);
        S.cartaGratis({ cartas }, 'd', () => 0.999);
        assert.strictEqual(JSON.stringify(cartas), copia);
    });
});

describe('imágenes 2.2.0', { skip: !A.listo() }, () => {
    const CA = require('../utils/combateArte.js');
    const CR = require('../utils/cartasArte.js');
    const SPR = require('../utils/sprites.js');
    const mk = (id) => { const l = C.luchador({ nombre: id, id, s: C.stats({ id, estrellas: 2, afinidad: 300 }) }); l.nivel = 12; return l; };
    const esGif = (b) => Buffer.isBuffer(b) && b.subarray(0, 6).toString() === 'GIF89a';

    it('el golpe tiñe solo al luchador, no un cuadrado', async () => {
        const img = await CA.retrato('gato', { nivel: 20 });
        const { c, ctx } = A.lienzo(210, 210);
        CA.pintarLuchador(ctx, img, 'gato', 105, 105, 210, { rojo: 1 });
        const esquina = ctx.getImageData(2, 2, 1, 1).data;
        assert.strictEqual(esquina[3], 0, 'la esquina sigue transparente');
        void c;
    });
    for (const [nombre, a, b, acc, extra] of [
        ['ataque', 'gato', 'perro', { a: 'atacar', b: 'atacar' }],
        ['especial', 'dragon', 'tortuga', { a: 'especial', b: 'defender' }, (c) => { c.a.energia = C.ENERGIA_ESPECIAL; }],
        ['K.O.', 'leon', 'pollito', { a: 'atacar', b: 'atacar' }, (c) => { c.b.hp = 1; }],
    ]) {
        it(`ronda con ${nombre}: sale un GIF`, async () => {
            const c = C.nuevoCombate(mk(a), mk(b));
            if (extra) extra(c);
            const antes = JSON.parse(JSON.stringify({ a: c.a, b: c.b }));
            const ev = C.ronda(c, acc, () => 0.5);
            const g = await CA.gifRonda(c, antes, ev, { inicio: 'RONDA 1', titulo: 'RONDA 2', ganadorNombre: c.fin ? c[c.fin.ganador].nombre : null });
            assert.ok(esGif(g));
        });
    }
    it('carta en combate y ataque al jefe', async () => {
        const id = [...K.ANIME.keys()].find((x) => C.tecnicaDe(x, 1).golpe);
        const c = C.nuevoCombate(mk('kaede'), mk('perro'));
        c.a.mazo = C.prepararMazo([id], [{ id, estrellas: 2 }]);
        const antes = JSON.parse(JSON.stringify({ a: c.a, b: c.b }));
        const ev = C.ronda(c, { a: 'carta:0', b: 'atacar' }, () => 0.5);
        assert.ok(esGif(await CA.gifRonda(c, antes, ev, { inicio: 'RONDA 1', titulo: 'RONDA 2' })));
        const jefe = await CA.gifAtaqueJefe({ luchador: { id: 'gato', elemento: 'sombra', nivel: 10, hp: 100 }, nombre: 'Leo', jefe: { id: 'jefe:sombra', el: 'sombra', max: 500 }, jefeNombre: 'Sombra', vidaAntes: 30, total: 40, golpes: [{ tipo: 'atacar', danio: 20 }, { tipo: 'carta', danio: 20, nombre: { es: 'Tajo', en: 'Slash' } }], titulo: '', idioma: 'es' });
        assert.ok(esGif(jefe));
    });
    it('cartas: todas las rarezas, el dorso y la guía', async () => {
        const { ctx } = A.lienzo(200, 300);
        for (const r of Object.keys(K.RAREZAS)) {
            const id = [...K.ANIME.entries()].find(([, d]) => d.rareza === r)?.[0];
            if (id) { CR.dibujarCarta(ctx, 0, 0, 200, 300, id, { estrellas: 5, holo: true }); CR.dibujarCarta(ctx, 0, 0, 90, 135, id); }
        }
        CR.dibujarDorso(ctx, 0, 0, 200, 300, '#8b5cf6');
        const png = await CR.guia({ titulo: 'Cartas', partes: [['a', 'b', 'c']], fuentes: { titulo: 'X', lista: [['🎁', 'gratis']] }, usos: { titulo: 'Y', lista: [['🐾', 'a', 'b']] } });
        assert.ok(png && png.length > 1000);
    });
    it('sobre de una carta (la gratis) y de tres', async () => {
        const ids = [...K.ANIME.keys()].slice(0, 3);
        assert.ok(esGif(await CR.gifSobre('normal', [{ id: ids[0], rareza: K.def(ids[0]).rareza, nuevo: true, estrellas: 1 }], { nombre: 'CARTA GRATIS', sub: '1 CARTA' })));
        assert.ok(esGif(await CR.gifSobre('brillante', ids.map((id) => ({ id, rareza: K.def(id).rareza, estrellas: 2 })).concat([]))));
    });
    it('cada truco tiene su animación', async () => {
        const CP = require('../utils/compisArte.js');
        const d = { id: 'zorro', nombre: 'Mimi', rarezaTexto: 'RARA', estrellas: 1, nivel: 25, progreso: 0.5, estado: { hambre: 80, alegria: 80, energia: 80 }, humor: { emoji: '😊', texto: 'Feliz' }, frase: 'hola', fuera: null, etiquetas: { hambre: 'a', alegria: 'b', energia: 'c', nivel: 'd' } };
        for (const tr of Object.keys(P.TRUCOS)) {
            const r = await CP.tarjeta(d, `truco:${tr}`);
            assert.ok(r && esGif(r.buffer), tr);
        }
    });
    it('etapas: el bebé ocupa menos que el adulto', () => {
        const ocupado = (etapa) => {
            const im = SPR.imagen('gato', { etapa, aura: false, sombra: false });
            const d = im.getContext('2d').getImageData(0, 0, im.width, im.height).data;
            let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
            return n;
        };
        assert.ok(ocupado(0) < ocupado(1) && ocupado(1) < ocupado(2));
    });
    it('GIF: lo que no cambia no pesa', async () => {
        const fr = (dibujo) => { const { ctx } = A.lienzo(200, 120); ctx.fillStyle = '#1e1b4b'; ctx.fillRect(0, 0, 200, 120); dibujo(ctx); return ctx; };
        const quieto = await A.aGif([0, 1, 2, 3, 4, 5].map(() => ({ ctx: fr(() => {}), delay: 50 })), 200, 120);
        const mueve = await A.aGif([0, 1, 2, 3, 4, 5].map((i) => ({ ctx: fr((c) => { c.fillStyle = '#f97316'; c.fillRect(i * 30, 20, 40, 40); }), delay: 50 })), 200, 120);
        assert.ok(esGif(quieto) && esGif(mueve));
        assert.ok(quieto.length < mueve.length);
    });
});
