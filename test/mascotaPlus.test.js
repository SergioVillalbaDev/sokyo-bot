// 1.15.0: mascota mucho más completa (reglas puras de utils/mascotaExtras.js y combates).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const N = require('../utils/mascotaNucleo.js');
const X = require('../utils/mascotaExtras.js');

const viva = (x = {}) => ({ estado: 'viva', especie: 'dragon', nombre: 'Draco', nivel: 5, xp: 0, hambre: 80, alegria: 70, salud: 100, energia: 100, stats: { fuerza: 5, defensa: 5, agilidad: 5 }, contadores: {}, ...x });
const fijo = (v) => () => v;

describe('Personalidad', () => {
    test('sale una de las que hay', () => {
        for (let i = 0; i < 20; i++) assert.ok(X.PERSONALIDADES[X.personalidadAlAzar()]);
        assert.equal(X.personalidadAlAzar(fijo(0)), Object.keys(X.PERSONALIDADES)[0]);
    });
    test('glotona tiene hambre antes; dormilona recupera energía antes; tozuda aguanta la toxicidad', () => {
        const normal = N.pasarTiempo(viva(), {}, 4).cambio;
        assert.ok(N.pasarTiempo(viva({ personalidad: 'glotona' }), {}, 4).cambio.hambre < normal.hambre);
        assert.ok(N.pasarTiempo(viva({ personalidad: 'dormilona', energia: 20 }), {}, 2).cambio.energia > N.pasarTiempo(viva({ energia: 20 }), {}, 2).cambio.energia);
        assert.ok(N.pasarTiempo(viva({ personalidad: 'tozuda' }), { incidentes: 5 }, 1).cambio.salud > N.pasarTiempo(viva(), { incidentes: 5 }, 1).cambio.salud);
    });
    test('presumida está más contenta con un accesorio puesto', () => {
        const sin = N.pasarTiempo(viva({ personalidad: 'presumida' }), {}, 4).cambio.alegria;
        const con = N.pasarTiempo(viva({ personalidad: 'presumida', accesorio: 'gafas' }), {}, 4).cambio.alegria;
        assert.ok(con > sin);
    });
    test('valiente pega más fuerte', () => {
        assert.ok(N.poderDe(viva({ personalidad: 'valiente' })) > N.poderDe(viva()));
    });
});

describe('Entrenamiento', () => {
    test('sube más al principio, gasta energía y la personalidad ayuda', () => {
        const r = X.entrenar(viva(), 'fuerza', fijo(0.9));
        assert.deepEqual([r.sube, r.nuevo, r.energia, r.perfecto], [3, 8, 85, false]);
        assert.equal(X.entrenar(viva({ stats: { fuerza: 40 } }), 'fuerza', fijo(0.9)).sube, 2);
        assert.equal(X.entrenar(viva({ stats: { fuerza: 70 } }), 'fuerza', fijo(0.9)).sube, 1);
        assert.equal(X.entrenar(viva({ personalidad: 'valiente' }), 'fuerza', fijo(0.9)).sube, 4);
        assert.equal(X.entrenar(viva(), 'fuerza', fijo(0.01)).perfecto, true);
    });
    test('sin energía, al máximo o con un atributo que no existe no se puede', () => {
        assert.equal(X.entrenar(viva({ energia: 10 }), 'fuerza').fallo, 'energia');
        assert.equal(X.entrenar(viva({ stats: { fuerza: 100 } }), 'fuerza').fallo, 'maximo');
        assert.equal(X.entrenar(viva(), 'magia').fallo, 'stat');
        assert.equal(X.entrenar(viva({ stats: { agilidad: 99 } }), 'agilidad', fijo(0.01)).nuevo, 100, 'nunca pasa de 100');
    });
    test('entrenar la hace más fuerte', () => {
        assert.ok(N.poderDe(viva({ stats: { fuerza: 60, defensa: 40, agilidad: 40 } })) > N.poderDe(viva()) + 100);
    });
});

describe('Tienda', () => {
    test('cada artículo existe con su tipo', () => {
        assert.equal(X.articulo('tarta').tipo, 'comida');
        assert.equal(X.articulo('gafas').tipo, 'accesorio');
        assert.equal(X.articulo('volcan').tipo, 'habitat');
        assert.equal(X.articulo('nada'), null);
    });
    test('las comidas suben las barras con tope de 100 y no se cobran si no hacen falta', () => {
        const r = X.aplicarComida(viva({ hambre: 90, alegria: 50 }), 'tarta');
        assert.deepEqual(r.cambio, { hambre: 100, alegria: 80 });
        assert.ok(r.xp > 0);
        assert.equal(X.aplicarComida(viva({ salud: 100 }), 'medicina').fallo, 'llena');
        assert.equal(X.aplicarComida(viva({ energia: 40 }), 'batido').cambio.energia, 80);
        assert.ok(X.aplicarComida(viva({ personalidad: 'glotona' }), 'filete').xp > X.aplicarComida(viva(), 'filete').xp);
    });
    test('cada accesorio tiene sitio en cada especie y su dibujo', () => {
        const fs = require('fs');
        for (const [id, a] of Object.entries(X.ACCESORIOS)) {
            assert.ok(fs.existsSync(`${__dirname}/../assets/mascota/${a.svg}.svg`), id);
            for (const esp of Object.keys(N.ESPECIES)) assert.ok(X.POSICIONES[esp][a.slot], `${esp}/${a.slot}`);
        }
        for (const h of Object.values(X.HABITATS)) for (const d of h.decor) assert.ok(fs.existsSync(`${__dirname}/../assets/mascota/${d}.svg`), d);
    });
});

describe('Logros y diario', () => {
    test('se ganan una vez', () => {
        const m = viva({ nivel: 16, contadores: { caricias: 120, victorias: 3, mejorRacha: 5 }, accesorios: ['a', 'b', 'c', 'd', 'e'], logros: ['nivel10'] });
        assert.deepEqual(X.logrosNuevos(m).sort(), ['adulta', 'coqueta', 'imparable', 'mimada']);
        assert.deepEqual(X.logrosNuevos({ ...m, logros: ['nivel10', 'adulta', 'coqueta', 'imparable', 'mimada'] }), []);
        assert.ok(X.logrosNuevos(viva({ stats: { fuerza: 30, defensa: 30, agilidad: 30 } })).includes('atleta'));
    });
    test('cada recuerdo se cuenta en los dos idiomas', () => {
        const tipos = { nacio: { nombre: 'X' }, nivel: { nivel: 10 }, fase: { fase_es: 'joven', fase_en: 'young' }, forma: { forma_es: 'social', forma_en: 'social' }, hiberna: {}, despierta: { quien: 'Ana' }, combate: { gana: true, rival: 'Y' }, racha: { n: 5 }, cuidador: { quien: 'Ana' }, accesorio: { es: 'Gafas', en: 'Glasses', quien: 'Ana' }, habitat: { es: 'Volcán', en: 'Volcano' }, logro: { es: 'Leyenda', en: 'Legend' }, evento: { es: 'a', en: 'b' } };
        for (const [tipo, datos] of Object.entries(tipos)) {
            const es = X.textoRecuerdo({ tipo, datos }, 'es');
            const en = X.textoRecuerdo({ tipo, datos }, 'en');
            assert.ok(es && en && es !== en, tipo);
        }
    });
    test('habla según su ánimo y su personalidad', () => {
        assert.match(X.frase(viva({ hibernando: true }), 'es'), /Zzz/);
        const f = X.frase(viva({ personalidad: 'glotona', hambre: 10 }), 'en', fijo(0));
        assert.ok(f.length > 5);
        assert.match(X.frase(viva(), 'es', fijo(0.999), 'Nació del huevo.'), /acordáis/);
    });
});

describe('Sorpresas', () => {
    const m = viva({ evento: {} });
    const a14 = new Date('2026-11-21T14:00:00Z');
    test('solo de día, separadas y una a la vez', () => {
        assert.equal(X.tocaEvento(m, 2, a14, fijo(0.1)), true);
        assert.equal(X.tocaEvento(m, 2, new Date('2026-11-21T03:00:00Z'), fijo(0.1)), false);
        assert.equal(X.tocaEvento(m, 0, a14, fijo(0.1)), false);
        assert.equal(X.tocaEvento({ ...m, ultimoEvento: new Date(a14 - 3600000) }, 2, a14, fijo(0.1)), false);
        assert.equal(X.tocaEvento({ ...m, evento: { id: 'x', resuelto: false } }, 2, a14, fijo(0.1)), false);
        assert.equal(X.tocaEvento({ ...m, hibernando: true }, 2, a14, fijo(0.1)), false);
    });
    test('la adivinanza piensa un número del 1 al 5', () => {
        for (let i = 0; i < 30; i++) {
            const e = X.eventoAlAzar();
            assert.ok(X.EVENTOS.includes(e.tipo));
            if (e.tipo === 'adivina') assert.ok(e.respuesta >= 1 && e.respuesta <= 5);
        }
    });
});

describe('Combates con atributos y habilidades', () => {
    test('las rondas cuentan críticos, esquivas y la habilidad especial', () => {
        let visto = new Set();
        for (let i = 0; i < 200; i++) {
            const r = N.combatir({ poder: 300, stats: { agilidad: 80 }, especie: 'fenix' }, { poder: 320, stats: { agilidad: 80 }, especie: 'zorro' }, N.azarCon(`c${i}`));
            for (const x of r.rondas) { if (x.eventoA) visto.add(x.eventoA); if (x.eventoB) visto.add(x.eventoB); }
        }
        assert.deepEqual([...visto].sort(), ['critico', 'especial', 'esquiva']);
    });
    test('la habilidad especial solo se usa una vez por combate', () => {
        for (let i = 0; i < 100; i++) {
            const r = N.combatir({ poder: 100, especie: 'dragon' }, { poder: 400, especie: 'kraken' }, N.azarCon(`e${i}`));
            assert.ok(r.rondas.filter((x) => x.eventoA === 'especial').length <= 1);
        }
    });
    test('la defensa alta protege', () => {
        let gana = 0;
        for (let i = 0; i < 200; i++) if (N.combatir({ poder: 300, stats: { defensa: 100 } }, { poder: 300, stats: { defensa: 5 } }, N.azarCon(`d${i}`)).ganador === 'a') gana++;
        assert.ok(gana > 120, `gana ${gana}/200`);
    });
});
