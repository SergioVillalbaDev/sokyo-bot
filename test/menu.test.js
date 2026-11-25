// 1.34.0: catálogo, /menu, desbloqueo poco a poco y fila de navegación (❔ + 🏠).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../utils/catalogo.js');
const PR = require('../utils/progreso.js');
const P = require('../utils/puertas.js');

test('catálogo: cada módulo está completo y sus secciones del panel existen', () => {
    const nav = fs.readFileSync(path.join(__dirname, '../sokyo-panelFRONTEND/src/components/dashboard/navConfig.js'), 'utf8');
    const ids = new Set();
    for (const m of C.MODULOS) {
        assert.ok(!ids.has(m.id), `repetido ${m.id}`); ids.add(m.id);
        assert.ok(C.ZONAS[m.zona], `${m.id}: zona`);
        assert.ok(m.es && m.en && m.emoji && m.frase.es && m.frase.en, `${m.id}: textos`);
        assert.ok(m.pasos.es.length && m.pasos.es.length === m.pasos.en.length, `${m.id}: pasos`);
        assert.strictEqual(typeof m.activo({}), 'boolean');
        if (m.tab) assert.ok(nav.includes(`tab: '${m.tab}'`), `${m.id}: la sección ${m.tab} no existe`);
        if (m.activar === 'campo') assert.ok(m.campo, `${m.id}: activar por campo sin campo`);
    }
});

test('menú: cada acción lanza un comando (y subcomando) que existe y es de un módulo del catálogo', () => {
    const { ACCIONES } = require('../utils/menu.js');
    for (const [mod, lista] of Object.entries(ACCIONES)) {
        assert.ok(C.modulo(mod), `módulo ${mod}`);
        for (const [clave, , es, en, cmd, sub, , , etapa] of lista) {
            assert.ok(es && en, `${mod}:${clave}`);
            const c = P.comandos().get(cmd);
            assert.ok(c, `${mod}:${clave} → /${cmd} no existe`);
            const subs = (c.data.toJSON().options || []).filter((o) => o.type === 1).map((o) => o.name);
            if (sub) assert.ok(subs.includes(sub), `${mod}:${clave} → /${cmd} ${sub} no existe`);
            else assert.strictEqual(subs.length, 0, `${mod}:${clave} → /${cmd} necesita subcomando`);
            assert.ok(PR.ETAPAS.some((e) => e.id === (etapa || 'base')), `${mod}:${clave}: etapa ${etapa}`);
        }
    }
});

test('desbloqueo: se abre poco a poco y avisa una sola vez', () => {
    const nada = PR.datosDe({}, null);
    assert.deepStrictEqual([...PR.abiertas(nada)], ['base']);
    assert.strictEqual(PR.siguiente(nada).id, 'primerDiario');
    const umbral = require('../utils/compisNucleo.js').umbral;
    const col = { mascotas: [{ id: 'gato', afinidad: umbral(10) }, { id: 'perro' }, { id: 'zorro' }] };
    const mucho = PR.datosDe({ ultimoDaily: new Date(), rachaDaily: 3 }, col);
    assert.strictEqual(PR.abiertas(mucho).size, PR.ETAPAS.length);
    assert.strictEqual(PR.nuevas(mucho, ['primerDiario', 'conMascota']).length, PR.ETAPAS.length - 3);
    assert.strictEqual(PR.siguiente(mucho), null);
});

test('navegación: la fila ❔ + 🏠 se añade solo donde cabe y no se repite', () => {
    const N = require('../utils/navegacion.js');
    const mod = C.modulo('casino');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const fila = () => new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('x').setLabel('x').setStyle(ButtonStyle.Primary));
    const ids = (p) => p.components.flatMap((f) => f.components.map((c) => c.data.custom_id));
    // Con embed y sitio: se añade
    let p = N.decorar({ embeds: [{}], components: [fila()] }, mod, 'u1', 'es', true);
    assert.ok(ids(p).includes('menu:abrir:u1') && ids(p).includes('menu:ayuda:casino:u1'));
    // Otra vez: no se repite
    assert.strictEqual(N.decorar(p, mod, 'u1', 'es', true).components.length, p.components.length);
    // Lleno (5 filas): no se toca
    p = { embeds: [{}], components: [fila(), fila(), fila(), fila(), fila()] };
    assert.strictEqual(N.decorar(p, mod, 'u1', 'es', true).components.length, 5);
    // Editar sin decir botones: se quedan los de antes
    assert.strictEqual(N.decorar({ embeds: [{}] }, mod, 'u1', 'es', false).components, undefined);
    // Error privado: «¿Cómo funciona?»
    assert.ok(ids(N.decorar({ content: '❌ No tienes oro', flags: 64 }, mod, 'u1', 'es', true)).includes('menu:ayuda:casino:u1'));
    // Texto normal: nada
    assert.strictEqual(N.decorar({ content: 'hola' }, mod, 'u1', 'es', true).components, undefined);
});

test('comandos por servidor: lo apagado no sale y las puertas solo llevan lo encendido', () => {
    const CS = require('../utils/comandosServidor.js');
    const nombres = (cfg) => CS.comandosPara(cfg).map((c) => c.name);
    const vacio = nombres({});
    assert.ok(!vacio.includes('casino') && !vacio.includes('clan') && !vacio.includes('pets'));
    assert.ok(vacio.includes('menu') && vacio.includes('games') && vacio.includes('daily'));
    const con = CS.comandosPara({ casino: { activo: true }, clanes: { activo: true } });
    assert.ok(con.some((c) => c.name === 'casino') && con.some((c) => c.name === 'clan'));
    const jugar = con.find((c) => c.name === 'games');
    assert.ok(jugar.options.some((o) => o.name === 'chest') && !jugar.options.some((o) => o.name === 'card'));
    // Ninguno de los que van dentro de una puerta sale suelto, y los globales no se repiten por servidor.
    for (const n of C.EN_PUERTA) assert.ok(!nombres({ casino: { activo: true } }).includes(n), n);
    for (const n of C.GLOBALES) assert.ok(!vacio.includes(n), n);
    assert.ok(CS.comandosPara({}).length <= 100);
});

test('mapa del juego y guía automática: se pueden dibujar/escribir en los dos idiomas', () => {
    const G = require('../utils/guiaServidor.js');
    for (const idioma of ['es', 'en']) {
        const { out } = G.mensajes({ idioma, casino: { activo: true }, clanes: { activo: true } });
        assert.ok(out.length >= 3);
        for (const m of out) for (const e of m.embeds) assert.ok((e.data.description || '').length <= 4096);
    }
    assert.notStrictEqual(G.hashDe({ casino: { activo: true } }), G.hashDe({ casino: { activo: false } }));
});
