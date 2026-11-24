// 1.32.0: combates de compañeros (reglas puras) y las cartas como técnicas, polvo, crear e intercambiar.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../utils/combateNucleo.js');
const S = require('../utils/cartasNucleo.js');
const K = require('../utils/cofresNucleo.js');
const N = require('../utils/mascotaNucleo.js');

const af = (n) => 10 * (n - 1) * (n - 1); // afinidad para llegar al nivel n
const gana = (ma, mb, n = 1500, azar = N.azarCon('x')) => {
    let w = 0;
    for (let i = 0; i < n; i++) if (C.simular(C.luchador({ id: ma.id, s: C.stats(ma) }), C.luchador({ id: mb.id, s: C.stats(mb) }), azar).fin.ganador === 'a') w++;
    return w / n;
};

test('cada compañero tiene elemento y los elementos se ganan en ciclo', () => {
    for (const id of Object.keys(K.COMPANEROS)) assert.ok(C.ELEMENTOS[C.elementoDe(id)], id);
    assert.ok(C.ELEMENTOS[C.elementoDe('a:70069')]); // los del pack también (fijo por id)
    assert.strictEqual(C.elementoDe('a:70069'), C.elementoDe('a:70069'));
    assert.strictEqual(C.factorElemento('agua', 'fuego'), C.VENTAJA);
    assert.strictEqual(C.factorElemento('fuego', 'agua'), C.DESVENTAJA);
    assert.strictEqual(C.factorElemento('luz', 'sombra'), C.VENTAJA);
    assert.strictEqual(C.factorElemento('sombra', 'luz'), C.VENTAJA);
    assert.strictEqual(C.factorElemento('fuego', 'fuego'), 1);
});

test('las estadísticas suben con la rareza, las estrellas y el nivel, y bajan con hambre', () => {
    const p = (m) => C.poder(C.stats(m));
    assert.ok(p({ id: 'leon' }) > p({ id: 'gato' }));
    assert.ok(p({ id: 'gato', estrellas: 5 }) > p({ id: 'gato' }));
    assert.ok(p({ id: 'gato', afinidad: af(20) }) > p({ id: 'gato' }));
    const ahora = Date.now();
    const feliz = C.stats({ id: 'gato', hambre: 90, alegria: 90, energia: 90, actualizado: new Date(ahora) }, ahora);
    const hambre = C.stats({ id: 'gato', hambre: 5, alegria: 90, energia: 90, actualizado: new Date(ahora) }, ahora);
    assert.ok(feliz.atk > hambre.atk);
    assert.strictEqual(feliz.humor, 'feliz');
});

test('un combate siempre acaba, con un ganador y sin vida negativa', () => {
    const azar = N.azarCon('fin');
    for (let i = 0; i < 300; i++) {
        const a = C.luchador({ id: 'dragon', s: C.stats({ id: 'dragon' }), mazo: C.prepararMazo([...K.ANIME.keys()].slice(i % 50, i % 50 + 3), [...K.ANIME.keys()].slice(i % 50, i % 50 + 3).map((id) => ({ id, estrellas: 1 }))) });
        const b = C.luchador({ id: 'zorro', s: C.stats({ id: 'zorro' }) });
        const c = C.simular(a, b, azar);
        assert.ok(c.fin && ['a', 'b'].includes(c.fin.ganador));
        assert.ok(c.ronda <= C.MAX_RONDAS);
        assert.ok(c.a.hp >= 0 && c.b.hp >= 0 && c.a.hp <= c.a.max && c.b.hp <= c.b.max);
    }
});

test('equilibrio: iguales ~50 %, el más fuerte gana más, y nadie está al 100 % por un elemento', () => {
    const iguales = gana({ id: 'gato' }, { id: 'gato' });
    assert.ok(iguales > 0.4 && iguales < 0.6, `iguales ${iguales}`);
    assert.ok(gana({ id: 'leon', afinidad: af(10) }, { id: 'gato' }) > 0.75);
    const s = { hp: 90, atk: 24, def: 14, vel: 14 };
    let w = 0; const azar = N.azarCon('el');
    for (let i = 0; i < 1500; i++) if (C.simular(C.luchador({ id: 'a', s: { ...s, elemento: 'agua' } }), C.luchador({ id: 'b', s: { ...s, elemento: 'fuego' } }), azar).fin.ganador === 'a') w++;
    assert.ok(w / 1500 > 0.6 && w / 1500 < 0.88, `elemento ${w / 1500}`);
});

test('energía: el especial cuesta y no se puede sin energía; cada carta, una vez', () => {
    const ids = [...K.ANIME.keys()].slice(0, 2);
    const a = C.luchador({ id: 'gato', s: C.stats({ id: 'gato' }), mazo: C.prepararMazo(ids, ids.map((id) => ({ id, estrellas: 1 }))) });
    const b = C.luchador({ id: 'perro', s: C.stats({ id: 'perro' }) });
    const c = C.nuevoCombate(a, b);
    assert.strictEqual(C.valida(c.a, 'especial'), false);
    assert.ok(C.valida(c.a, 'carta:0'));
    C.ronda(c, { a: 'carta:0', b: 'defender' }, N.azarCon('e'));
    assert.strictEqual(C.valida(c.a, 'carta:0'), false);
    assert.strictEqual(C.valida(c.a, 'carta:9'), false);
    // Una jugada inválida se cambia por atacar (no rompe nada).
    C.ronda(c, { a: 'carta:0', b: 'especial' }, N.azarCon('e2'));
    assert.strictEqual(c.log[1].acciones.a, 'atacar');
    assert.strictEqual(c.log[1].acciones.b, 'atacar');
    c.a.energia = C.ENERGIA_ESPECIAL;
    C.ronda(c, { a: 'especial', b: 'atacar' }, N.azarCon('e3'));
    assert.ok(c.a.energia < C.ENERGIA_ESPECIAL);
});

test('defender reduce el daño recibido', () => {
    let con = 0; let sin = 0;
    for (let i = 0; i < 400; i++) {
        for (const [def, sum] of [[true, (v) => { con += v; }], [false, (v) => { sin += v; }]]) {
            const c = C.nuevoCombate(C.luchador({ id: 'gato', s: C.stats({ id: 'gato' }) }), C.luchador({ id: 'perro', s: C.stats({ id: 'perro' }) }));
            const hp = c.a.hp;
            C.ronda(c, { a: def ? 'defender' : 'atacar', b: 'atacar' }, N.azarCon(`d${i}`));
            sum(hp - c.a.hp + (def ? 0 : 0));
        }
    }
    assert.ok(con < sin * 0.65, `${con} vs ${sin}`);
});

test('las cartas son técnicas: más rareza y estrellas, más fuerza; textos claros', () => {
    const comun = [...K.ANIME.entries()].find(([, d]) => d.rareza === 'comun')[0];
    const legend = [...K.ANIME.entries()].find(([, d]) => d.rareza === 'legendaria')[0];
    assert.ok(C.fuerzaCarta(legend) > C.fuerzaCarta(comun));
    assert.ok(C.fuerzaCarta(comun, 5) > C.fuerzaCarta(comun, 1));
    for (const tipo of Object.keys(C.TECNICAS)) {
        const t = { tipo, ...C.TECNICAS[tipo] };
        assert.ok(C.textoTecnica(t, 'es').length > 3, tipo);
        assert.ok(C.textoTecnica(t, 'en').length > 3, tipo);
    }
    // Todas las cartas del pack tienen una técnica que existe.
    for (const id of K.ANIME.keys()) assert.ok(C.TECNICAS[C.tecnicaDe(id).tipo], id);
    // Sinergia: dos de la misma serie en el mazo pegan más; la holográfica, un 5 % más.
    const porSerie = new Map();
    for (const [id, d] of K.ANIME) { if (!porSerie.has(d.serie)) porSerie.set(d.serie, []); porSerie.get(d.serie).push(id); }
    const par = [...porSerie.values()].find((x) => x.length >= 2).slice(0, 2);
    const juntos = C.prepararMazo(par, par.map((id) => ({ id, estrellas: 1 })));
    const solo = C.prepararMazo([par[0]], [{ id: par[0], estrellas: 1 }]);
    assert.ok(juntos[0].tecnica.f > solo[0].tecnica.f);
    const holo = C.prepararMazo([par[0]], [{ id: par[0], estrellas: 1 }], [], [par[0]]);
    assert.ok(holo[0].tecnica.f > solo[0].tecnica.f);
    // El mazo ignora las que no tienes y no pasa de 3.
    assert.strictEqual(C.prepararMazo([...K.ANIME.keys()].slice(0, 5), [...K.ANIME.keys()].slice(0, 5).map((id) => ({ id }))).length, C.MAZO_MAX);
    assert.strictEqual(C.prepararMazo(['a:1'], []).length, 0);
});

test('ELO: quien gana sube lo mismo que baja el otro, y los rangos', () => {
    const r = C.elo(1000, 1000, 'a');
    assert.strictEqual(r.a - 1000, 1000 - r.b);
    assert.strictEqual(r.cambio, 16);
    assert.ok(C.elo(1000, 1400, 'a').cambio > C.elo(1400, 1000, 'a').cambio); // ganar al favorito da más
    assert.strictEqual(C.rangoDe(1000).id, 'bronce');
    assert.strictEqual(C.rangoDe(1250).id, 'oro');
    assert.strictEqual(C.rangoDe(2000).id, 'maestro');
    assert.ok(C.elo(5, 2000, 'b').a >= 0);
});

test('torre: pisos cada vez más duros, jefe cada 10 y premios', () => {
    const p1 = C.enemigoTorre(1, '2026-11'); const p9 = C.enemigoTorre(9, '2026-11'); const p10 = C.enemigoTorre(10, '2026-11');
    assert.ok(C.poder(p9.s) > C.poder(p1.s));
    assert.ok(p10.jefe && p10.id.startsWith('jefe:'));
    assert.deepStrictEqual(C.enemigoTorre(7, '2026-11'), C.enemigoTorre(7, '2026-11')); // el mismo para todos este mes
    assert.ok(C.premioPiso(5).tickets.sobre_normal);
    assert.ok(C.premioPiso(10).tickets.cofre_basico);
    assert.ok(C.premioPiso(50).tickets.cofre_epico);
    assert.ok(C.premioPiso(11).oro > C.premioPiso(1).oro);
});

test('jefe: rota cada semana, su vida crece con la gente y el reparto premia el daño', () => {
    assert.strictEqual(C.semanaDe(Date.parse('2026-11-25T12:00:00Z')), '2026-11-23'); // miércoles → lunes
    assert.strictEqual(C.semanaDe(Date.parse('2026-11-23T00:00:00Z')), '2026-11-23');
    assert.strictEqual(C.semanaDe(Date.parse('2026-11-29T23:59:00Z')), '2026-11-23');
    assert.ok(C.jefeDeSemana('s', 50).vida > C.jefeDeSemana('s', 5).vida);
    const s = C.stats({ id: 'lobo', afinidad: af(10) });
    const j = C.jefeDeSemana('s', 10);
    const r = C.atacarJefe(s, [], { id: j.id, el: j.el, def: j.def }, N.azarCon('j'));
    assert.strictEqual(r.golpes.length, 3);
    assert.strictEqual(r.total, r.golpes.reduce((a, g) => a + g.danio, 0));
    const pr = C.premiosJefe([{ userId: 'a', danio: 900 }, { userId: 'b', danio: 100 }, { userId: 'c', danio: 0 }], true, 10000);
    assert.strictEqual(pr.length, 2); // quien no pegó, nada
    assert.ok(pr[0].oro > pr[1].oro);
    assert.ok(pr[0].tickets.cofre_epico && pr[1].tickets.sobre_normal);
    const vivo = C.premiosJefe([{ userId: 'a', danio: 900 }], false, 10000);
    assert.ok(vivo[0].oro < pr[0].oro);
});

test('cartas: desencantar da polvo, crear lo gasta, la divina no se crea', () => {
    const [id] = [...K.ANIME.entries()].find(([, d]) => d.rareza === 'rara');
    const d1 = S.desencantar([{ id, estrellas: 2 }], id);
    assert.deepStrictEqual(d1.cartas, [{ id, estrellas: 1 }]);
    assert.strictEqual(d1.polvo, S.POLVO.rara);
    assert.strictEqual(S.desencantar([{ id, estrellas: 1 }], id).cartas.length, 0);
    assert.strictEqual(S.desencantar([], id).fallo, 'sinCarta');
    assert.strictEqual(S.crear([], id, 0).fallo, 'polvo');
    const c = S.crear([], id, S.COSTE_CREAR.rara);
    assert.strictEqual(c.coste, S.COSTE_CREAR.rara);
    assert.ok(c.nueva);
    assert.strictEqual(S.crear([{ id, estrellas: 5 }], id, 1e9).fallo, 'max');
    const divina = [...K.ANIME.entries()].find(([, d]) => d.rareza === 'divina')[0];
    assert.strictEqual(S.crear([], divina, 1e9).fallo, 'divina');
    // Desencantar da siempre menos que lo que cuesta crear (no hay bucle infinito de polvo).
    for (const r of Object.keys(S.COSTE_CREAR)) assert.ok(S.POLVO[r] < S.COSTE_CREAR[r]);
});

test('intercambiar mueve una copia en cada sentido', () => {
    const [x, y] = [...K.ANIME.keys()];
    const r = S.intercambiar([{ id: x, estrellas: 2 }], [{ id: y, estrellas: 1 }], x, y);
    assert.deepStrictEqual(r.a.map((c) => [c.id, c.estrellas]), [[x, 1], [y, 1]]);
    assert.deepStrictEqual(r.b.map((c) => [c.id, c.estrellas]), [[x, 1]]);
    assert.strictEqual(S.intercambiar([], [{ id: y }], x, y).fallo, 'sinCartaA');
    assert.strictEqual(S.intercambiar([{ id: x }], [{ id: x }], x, x).fallo, 'iguales');
});

test('los sobres a veces traen holográficas y las repetidas al máximo dan polvo', () => {
    let holos = 0; let polvo = 0;
    const azar = N.azarCon('sobres');
    const llena = [...K.ANIME.keys()].map((id) => ({ id, estrellas: 5 }));
    for (let i = 0; i < 400; i++) {
        const r = S.abrirSobre({ cartas: llena }, 'normal', azar);
        holos += r.cartas.filter((c) => c.holo).length;
        polvo += r.polvo;
    }
    assert.ok(holos > 10 && holos < 80, `holos ${holos}`);
    assert.ok(polvo > 0);
});
