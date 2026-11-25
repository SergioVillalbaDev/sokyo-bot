// 1.14.0: mascota del servidor, bromas de oro y Liga Sokyo (reglas puras).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const N = require('../utils/mascotaNucleo.js');
const bromas = require('../utils/bromas.js');
const liga = require('../utils/liga.js');
const { elegirCandidato } = require('../utils/redSokyo.js');

const viva = (x = {}) => ({ estado: 'viva', especie: 'dragon', nombre: 'Draco', nivel: 1, xp: 0, hambre: 80, alegria: 70, salud: 100, contadores: {}, ...x });

describe('Mascota · niveles y fases', () => {
    test('sumar XP sube los niveles que tocan y guarda lo que sobra', () => {
        assert.deepEqual(N.sumarXp(1, 0, 50), { nivel: 1, xp: 50, subidos: 0 });
        const r = N.sumarXp(1, 0, N.xpParaSubir(1) + N.xpParaSubir(2) + 5);
        assert.deepEqual(r, { nivel: 3, xp: 5, subidos: 2 });
        assert.equal(N.sumarXp(N.NIVEL_MAX, 0, 99999).nivel, N.NIVEL_MAX);
    });
    test('fases según el nivel', () => {
        assert.equal(N.faseDe({ estado: 'huevo' }).id, 'huevo');
        assert.equal(N.faseDe(viva({ nivel: 1 })).id, 'cria');
        assert.equal(N.faseDe(viva({ nivel: 5 })).id, 'joven');
        assert.equal(N.faseDe(viva({ nivel: 15 })).id, 'adulta');
        assert.equal(N.faseDe(viva({ nivel: 30 })).id, 'legendaria');
    });
    test('la forma de adulta sale de cómo es el servidor', () => {
        assert.equal(N.formaDe({ victorias: 6 }), 'guerrera');
        assert.equal(N.formaDe({ musica: 100 }), 'musical');
        assert.equal(N.formaDe({ noche: 40, dia: 60 }), 'nocturna');
        assert.equal(N.formaDe({ noche: 5, dia: 95 }), 'social');
        assert.equal(N.formaDe({}), 'social');
    });
});

describe('Mascota · ventajas', () => {
    test('se desbloquean por nivel y no valen si hiberna o está enferma', () => {
        assert.deepEqual(N.ventajasDe(viva({ nivel: 2 })), []);
        assert.deepEqual(N.ventajasDe(viva({ nivel: 10 })), ['caricia', 'xp5', 'bromas10']);
        assert.equal(N.bonusXp(viva({ nivel: 20 })), 0.10);
        assert.equal(N.bonusXp(viva({ nivel: 30 })), 0.15);
        assert.equal(N.descuentoBromas(viva({ nivel: 25 })), 0.2);
        assert.equal(N.bonusXp(viva({ nivel: 30, hibernando: true })), 0);
        assert.equal(N.bonusXp(viva({ nivel: 30, salud: 10 })), 0);
        assert.equal(N.bonusXp({ estado: 'huevo', nivel: 30 }), 0);
    });
    test('ánimo', () => {
        assert.equal(N.animoDe(viva({ hambre: 90, alegria: 90, salud: 90 })), 'feliz');
        assert.equal(N.animoDe(viva({ hambre: 10 })), 'hambrienta');
        assert.equal(N.animoDe(viva({ salud: 10 })), 'enferma');
        assert.equal(N.animoDe(viva({ hibernando: true })), 'hibernando');
    });
});

describe('Mascota · el paso del tiempo', () => {
    test('pierde comida con las horas y el servidor callado la aburre', () => {
        const { cambio } = N.pasarTiempo(viva({ hambre: 80, alegria: 70 }), {}, 5);
        assert.equal(cambio.hambre, 65);
        assert.equal(cambio.alegria, 55);
    });
    test('un servidor vivo la alegra y le da XP', () => {
        const { cambio } = N.pasarTiempo(viva({ alegria: 50 }), { mensajes: 40, vozMin: 60 }, 1);
        assert.ok(cambio.alegria > 50);
        assert.ok(cambio.xp > 0 || cambio.nivel > 1);
    });
    test('la toxicidad baja la salud', () => {
        const { cambio } = N.pasarTiempo(viva({ salud: 100, hambre: 20 }), { incidentes: 5 }, 1);
        assert.equal(cambio.salud, 80);
    });
    test('sin comida ni alegría se va a hibernar; cada día dormida pierde un nivel', () => {
        const ahora = new Date('2026-11-20T12:00:00Z');
        const a = N.pasarTiempo(viva({ hambre: 2, alegria: 5 }), {}, 1, ahora);
        assert.equal(a.cambio.hibernando, true);
        assert.ok(a.avisos.some((x) => x.tipo === 'hiberna'));
        const b = N.pasarTiempo(viva({ nivel: 8, hambre: 0, alegria: 0, hibernando: true, hibernaDesde: new Date('2026-11-19T11:00:00Z') }), {}, 1, ahora);
        assert.equal(b.cambio.nivel, 7);
        assert.ok(b.avisos.some((x) => x.tipo === 'pierde'));
        const c = N.pasarTiempo(viva({ nivel: 1, hambre: 0, alegria: 0, hibernando: true, hibernaDesde: new Date('2026-11-10T11:00:00Z') }), {}, 1, ahora);
        assert.equal(c.cambio.nivel, undefined, 'nunca baja de 1');
    });
    test('al llegar a adulta elige su forma una sola vez', () => {
        const m = viva({ nivel: 14, xp: N.xpParaSubir(14) - 1, contadores: { noche: 60, dia: 40 } });
        const { cambio, avisos } = N.pasarTiempo(m, { mensajes: 80, noche: 60 }, 1);
        assert.equal(cambio.nivel, 15);
        assert.equal(cambio.forma, 'nocturna');
        assert.ok(avisos.some((x) => x.tipo === 'forma'));
        const otra = N.pasarTiempo(viva({ nivel: 20, forma: 'social' }), { mensajes: 80 }, 1);
        assert.equal(otra.cambio.forma, undefined);
    });
    test('comer: solo cobra lo que cabe y despierta si come bastante', () => {
        assert.deepEqual(N.comida(viva({ hambre: 95 }), 500), { usado: 50, hambre: 100, xp: 7, cuidado: 5 });
        assert.equal(N.comida(viva({ hambre: 100 }), 500).usado, 0);
        assert.equal(N.comida(viva({ hambre: 50 }), 15).usado, 10);
        assert.equal(N.despierta(viva({ hibernando: true }), 30), true);
        assert.equal(N.despierta(viva({ hibernando: true }), 20), false);
    });
});

describe('Mascota · combates', () => {
    test('la fuerza depende del nivel, de cómo está y de la forma', () => {
        assert.ok(N.poderDe(viva({ nivel: 20 })) > N.poderDe(viva({ nivel: 5 })));
        assert.ok(N.poderDe(viva({ nivel: 20, forma: 'guerrera' })) > N.poderDe(viva({ nivel: 20, forma: 'social' })));
        assert.equal(N.extraAnimos(100), 0.3);
    });
    test('al mejor de 3, repetible con la misma semilla', () => {
        const r1 = N.combatir({ poder: 200, animos: 0 }, { poder: 200, animos: 0 }, N.azarCon('x'));
        const r2 = N.combatir({ poder: 200, animos: 0 }, { poder: 200, animos: 0 }, N.azarCon('x'));
        assert.deepEqual(r1, r2);
        assert.ok(r1.rondas.length >= 2 && r1.rondas.length <= 3);
        const gana = r1.rondas.filter((r) => (r1.ganador === 'a' ? r.a >= r.b : r.b > r.a)).length;
        assert.equal(gana, 2);
    });
    test('mucho más fuerte casi siempre gana', () => {
        let a = 0;
        for (let i = 0; i < 50; i++) if (N.combatir({ poder: 500 }, { poder: 150 }, N.azarCon(`s${i}`)).ganador === 'a') a++;
        assert.ok(a >= 48);
    });
    test('emparejar por fuerza parecida; el que sobra va contra una criatura salvaje', () => {
        const p = N.emparejar([{ guildId: 'a', poder: 100 }, { guildId: 'b', poder: 500 }, { guildId: 'c', poder: 110 }], () => 0.5);
        assert.equal(p.length, 2);
        assert.deepEqual(p[0].map((x) => x.guildId), ['b', 'c']);
        assert.equal(p[1][1], null);
    });
});

describe('Mascota · votación del huevo', () => {
    test('gana la especie más votada y el nombre con más votos', () => {
        const r = N.ganadoresVotacion({
            especies: [{ userId: '1', especie: 'zorro' }, { userId: '2', especie: 'zorro' }, { userId: '3', especie: 'kraken' }],
            nombres: [{ userId: '1', nombre: 'Foxy', votos: ['1'] }, { userId: '2', nombre: 'Kitsune', votos: ['2', '3'] }],
        });
        assert.equal(r.especie, 'zorro');
        assert.equal(r.nombre, 'Kitsune');
    });
    test('sin nombres sale el de la especie', () => {
        const r = N.ganadoresVotacion({ especies: [{ userId: '1', especie: 'golem' }] });
        assert.equal(r.nombre, N.ESPECIES.golem.nombre);
    });
    test('nombres válidos', () => {
        assert.equal(N.nombreValido('Draco'), true);
        assert.equal(N.nombreValido('a'), false);
        assert.equal(N.nombreValido('@everyone'), false);
        assert.equal(N.nombreValido('https://x.y'), false);
    });
});

describe('Bromas', () => {
    const cfg = {
        guildId: 'g',
        bromas: { activo: true, tipos: { apodo: { activo: true, precio: 300 }, payaso: { activo: false, precio: 500 }, reaccion: { activo: true, precio: 250 }, loro: { activo: true, precio: 400 } }, esperaMin: 10, inmunes: ['staff'] },
    };
    const base = { cfg, tipo: 'apodo', autorId: 'a', objetivoId: 'b' };
    test('reglas: apagadas, tipo, a uno mismo, bots, quien no juega, inmunes, escudo, espera', () => {
        assert.equal(bromas.comprobar({ ...base, cfg: { bromas: { activo: false } } }), 'apagadas');
        assert.equal(bromas.comprobar({ ...base, tipo: 'payaso' }), 'tipo');
        assert.equal(bromas.comprobar({ ...base, objetivoId: 'a' }), 'tuyo');
        assert.equal(bromas.comprobar({ ...base, objetivoBot: true }), 'bot');
        assert.equal(bromas.comprobar({ ...base, perfilAutor: { fuera: true } }), 'autorFuera');
        assert.equal(bromas.comprobar({ ...base, perfilObjetivo: { fuera: true } }), 'objetivoFuera');
        assert.equal(bromas.comprobar({ ...base, rolesObjetivo: ['staff'] }), 'inmune');
        const ahora = new Date();
        assert.equal(bromas.comprobar({ ...base, perfilObjetivo: { escudoHasta: new Date(ahora.getTime() + 60000) }, ahora }), 'escudo');
        assert.equal(bromas.comprobar({ ...base, activaObjetivo: true }), 'yaTiene');
        assert.equal(bromas.comprobar({ ...base, perfilAutor: { ultimaBroma: new Date(ahora.getTime() - 60000) }, ahora }), 'espera');
        assert.equal(bromas.comprobar({ ...base, perfilAutor: { ultimaBroma: new Date(ahora.getTime() - 11 * 60000) }, ahora }), null);
    });
    test('devolverla se salta el escudo y la espera, pero no a quien no juega', () => {
        const ahora = new Date();
        assert.equal(bromas.comprobar({ ...base, devolucion: true, perfilObjetivo: { escudoHasta: new Date(ahora.getTime() + 60000) }, perfilAutor: { ultimaBroma: ahora }, ahora }), null);
        assert.equal(bromas.comprobar({ ...base, devolucion: true, perfilObjetivo: { fuera: true } }), 'objetivoFuera');
    });
    test('precio con el descuento de la mascota', () => {
        assert.equal(bromas.precioDe(cfg, 'apodo', 0), 300);
        assert.equal(bromas.precioDe(cfg, 'apodo', 0.2), 240);
    });
    test('loro, emojis y apodos', () => {
        assert.equal(bromas.burla('hola qué tal'), 'hOlA qUé TaL');
        assert.equal(bromas.emojiValido('💩'), true);
        assert.equal(bromas.emojiValido('hola'), false);
        assert.equal(bromas.emojiValido('<:x:123>'), false);
        assert.equal(bromas.apodoValido('El Calvo', cfg), true);
        assert.equal(bromas.apodoValido('@everyone', cfg), false);
        assert.equal(bromas.apodoValido('x'.repeat(33), cfg), false);
        assert.equal(bromas.apodoValido('feo', { automod: { activo: true, palabras: { activo: true, lista: ['feo'] } } }), false);
    });
    test('cada código de error tiene texto en los dos idiomas', () => {
        for (const c of ['apagadas', 'tipo', 'tuyo', 'bot', 'autorFuera', 'objetivoFuera', 'inmune', 'escudo', 'yaTiene', 'espera', 'oro', 'apodo', 'noApodo', 'permApodo', 'rol', 'emoji']) {
            assert.notEqual(bromas.textoError(c, 'es'), bromas.textoError(c, 'en'), c);
            assert.ok(!bromas.textoError(c, 'es').startsWith('No se ha podido'), c);
        }
    });
});

describe('Liga Sokyo', () => {
    test('divisiones', () => {
        assert.equal(liga.divisionDe(0).id, 'bronce');
        assert.equal(liga.divisionDe(250).id, 'plata');
        assert.equal(liga.divisionDe(600).id, 'oro');
        assert.equal(liga.divisionDe(99999).id, 'leyenda');
        assert.equal(liga.siguienteDivision(250).id, 'oro');
        assert.equal(liga.siguienteDivision(99999), null);
    });
    test('meses', () => {
        assert.equal(liga.mesAnterior(new Date('2026-01-03T00:00:00Z')), '2025-12');
        assert.equal(liga.finDeMes(new Date('2026-11-21T10:00:00Z')).toISOString(), '2026-12-01T00:00:00.000Z');
    });
    test('la Red Sokyo saca más a menudo al podio de la Liga', () => {
        const receptor = { guildId: 'r', idioma: 'es', crecimiento: { red: {} } };
        const cands = [
            { guildId: 'a', idioma: 'es', mostrado: 0 },
            { guildId: 'b', idioma: 'es', mostrado: 5, destacado: true },
        ];
        assert.equal(elegirCandidato(receptor, cands, () => 0.1).guildId, 'b');
        assert.equal(elegirCandidato(receptor, cands, () => 0.9).guildId, 'a');
        // Sin destacados, como siempre: el que menos ha salido.
        assert.equal(elegirCandidato(receptor, cands.map((c) => ({ ...c, destacado: false })), () => 0.1).guildId, 'a');
    });
});

// 1.33.0: táctica votada de la Liga.
test('Liga: táctica más votada y su ventaja', () => {
    const N = require('../utils/mascotaNucleo.js');
    assert.equal(N.tacticaElegida({}), null);
    assert.equal(N.tacticaElegida({ a: 'ataque', b: 'ataque', c: 'defensa' }), 'ataque');
    assert.equal(N.tacticaElegida({ a: 'ataque', b: 'defensa' }), null); // empate
    assert.equal(N.tacticaElegida({ a: 'trampa' }), null);
    assert.equal(N.multTactica('ataque', 'astucia'), 1 + N.TACTICA_VENTAJA);
    assert.equal(N.multTactica('astucia', 'ataque'), 1);
    assert.equal(N.multTactica(null, 'ataque'), 1);
    // Cada táctica gana exactamente a otra distinta.
    const ganadas = Object.values(N.TACTICAS).map((x) => x.gana);
    assert.equal(new Set(ganadas).size, 3);
    // La ventaja se nota: con el mismo poder, quien acierta gana más a menudo.
    let gana = 0;
    for (let i = 0; i < 2000; i++) if (N.combatir({ poder: 100, mult: N.multTactica('ataque', 'astucia') }, { poder: 100 }, Math.random).ganador === 'a') gana++;
    assert.ok(gana > 1100, String(gana));
});
