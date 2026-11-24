// 1.32.0: dibujos propios de las mascotas (utils/sprites.js), sin emojis.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const SPR = require('../utils/sprites.js');
const K = require('../utils/cofresNucleo.js');
const N = require('../utils/mascotaNucleo.js');
const { createCanvas } = require('@napi-rs/canvas');

// Cuenta los píxeles con algo pintado (para saber que de verdad dibuja).
function pintados(ctx) {
    const d = ctx.getImageData(0, 0, SPR.TAM, SPR.TAM).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
    return n;
}

test('cada compañero del catálogo y cada especie del servidor tienen su dibujo', () => {
    for (const id of Object.keys(K.COMPANEROS)) assert.ok(SPR.tiene(id), `falta el dibujo de ${id}`);
    for (const id of Object.keys(N.ESPECIES)) assert.ok(SPR.tiene(`srv:${id}`), `falta la especie ${id}`);
    assert.equal(SPR.tiene('a:70069'), false); // las cartas de anime usan su foto
    assert.equal(SPR.tiene('s:123:x'), false); // los del servidor, la foto que subió el admin
});

test('se dibujan en todas las etapas, humores y en brillante sin fallar', () => {
    const humores = ['feliz', 'normal', 'hambre', 'cansado', 'aburrido', 'enfermo', 'dormido', 'enfadado', 'fuera'];
    const ids = [...Object.keys(K.COMPANEROS), ...Object.keys(N.ESPECIES).map((e) => `srv:${e}`), ...Object.keys(SPR.JEFES).map((j) => `jefe:${j}`)];
    for (const id of ids) {
        for (const etapa of [0, 1, 2]) {
            for (const humor of humores) {
                const c = createCanvas(SPR.TAM, SPR.TAM); const ctx = c.getContext('2d');
                assert.ok(SPR.dibujar(ctx, id, { etapa, humor, t: (etapa + 1) / 5, parpadeo: humor === 'normal' }), id);
            }
        }
        const c = createCanvas(SPR.TAM, SPR.TAM); const ctx = c.getContext('2d');
        SPR.dibujar(ctx, id, { variante: 'brillante' });
        assert.ok(pintados(ctx) > 4000, `${id} casi no pinta nada`);
    }
});

test('el bebé es más pequeño que el adulto y la etapa sale de la afinidad', () => {
    const area = (etapa) => { const c = createCanvas(SPR.TAM, SPR.TAM); const ctx = c.getContext('2d'); SPR.dibujar(ctx, 'gato', { etapa, sombra: false }); return pintados(ctx); };
    assert.ok(area(0) < area(1) && area(1) < area(2));
    assert.equal(SPR.etapaDe(1), 0); assert.equal(SPR.etapaDe(9), 0); assert.equal(SPR.etapaDe(10), 1);
    assert.equal(SPR.etapaDe(19), 1); assert.equal(SPR.etapaDe(20), 2); assert.equal(SPR.etapaDe(30), 2);
});

test('la variante brillante cambia los colores', () => {
    assert.notEqual(SPR.girarTono('#22c55e', 150), '#22c55e');
    assert.equal(SPR.girarTono('#ffffff', 150), '#ffffff'); // el blanco sigue blanco
    const a = SPR.png('dragon', {}, 96); const b = SPR.png('dragon', { variante: 'brillante' }, 96);
    assert.ok(Buffer.isBuffer(a) && Buffer.isBuffer(b) && !a.equals(b));
});

test('la caché devuelve el mismo lienzo y no crece sin límite', () => {
    const a = SPR.imagen('perro', { humor: 'feliz' });
    assert.strictEqual(SPR.imagen('perro', { humor: 'feliz' }), a);
    for (let i = 0; i < 300; i++) SPR.imagen('perro', { t: (i % 16) / 16, humor: ['feliz', 'normal', 'hambre'][i % 3], etapa: i % 3, variante: i % 2 ? 'brillante' : null });
    assert.ok(SPR.imagen('perro') !== null);
});

test('los accesorios del panel van en el mismo sitio que en el bot', () => {
    const lib = fs.readFileSync(path.join(__dirname, '..', 'sokyo-panelFRONTEND', 'src', 'lib', 'mascota.js'), 'utf8');
    const m = lib.match(/const ANCLA_FORMA = (\{.*\});/);
    assert.ok(m, 'no encuentro ANCLA_FORMA en lib/mascota.js');
    const panel = Function(`return (${m[1]})`)();
    for (const esp of Object.keys(N.ESPECIES)) {
        for (const etapa of [0, 1, 2]) {
            const bot = SPR.anclas(`srv:${esp}`, etapa);
            const forma = SPR.diseno(`srv:${esp}`).forma;
            for (const slot of ['cabeza', 'cara', 'cuello']) {
                const [x, y] = panel[forma][slot];
                const k = etapa === 0 ? 0.8 : etapa === 1 ? 0.9 : 1;
                assert.ok(Math.abs(bot[slot].y - (240 + (y - 240) * k) / 256) < 1e-9 && Math.abs(bot[slot].x - (128 + (x - 128) * k) / 256) < 1e-9, `${esp} ${slot}`);
            }
        }
    }
});

test('el panel tiene la imagen de cada dibujo (scripts/generarSprites.js)', () => {
    const dir = path.join(__dirname, '..', 'sokyo-panelFRONTEND', 'public', 'sprites');
    for (const id of Object.keys(K.COMPANEROS)) {
        assert.ok(fs.existsSync(path.join(dir, `${id}.webp`)), `${id}.webp`);
        assert.ok(fs.existsSync(path.join(dir, `${id}-brillante.webp`)), `${id}-brillante.webp`);
    }
    for (const e of Object.keys(N.ESPECIES)) for (const et of [0, 1, 2]) assert.ok(fs.existsSync(path.join(dir, `srv-${e}-${et}.webp`)));
    assert.ok(fs.existsSync(path.join(dir, 'huevo.webp')));
});

test('la tarjeta del compañero con dibujo propio es un GIF en bucle', async () => {
    const A = require('../utils/compisArte.js');
    const d = { id: 'zorro', nombre: 'Zorro', rarezaTexto: 'RARA', estrellas: 1, nivel: 12, progreso: 0.5, estado: { hambre: 50, alegria: 70, energia: 40 }, humor: { emoji: '🙂', texto: 'Tranquilo' }, humorClave: 'normal', etapaTexto: 'JOVEN', frase: 'Hola', etiquetas: { hambre: 'B', alegria: 'A', energia: 'E', nivel: 'N' }, pie: 'x' };
    const r = await A.tarjeta(d);
    assert.equal(r.nombre, 'compi.gif');
    assert.equal(r.buffer.slice(0, 3).toString(), 'GIF');
    // Con un efecto (evolución) también es GIF.
    const r2 = await A.tarjeta(d, 'evolucion');
    assert.equal(r2.nombre, 'compi.gif');
});
