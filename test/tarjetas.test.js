// ============================================================================
// Tests de la 1.9.7: diseños de tarjeta con imagen o GIF de fondo (catálogo de
// Niveles → Diseños de tarjeta). El encuadre que se ajusta en el panel (mover,
// ampliar, girar) lo aplica el bot al dibujarla, también a cada fotograma de un GIF.
// ============================================================================
const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');
const { GifReader } = require('omggif');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const { generarTarjeta, generarTarjetaAnimada, fondoEsGif, encuadreValido } = require('../utils/rankCard.js');
const { sanearDiseno, opcionesDeDiseno } = require('../utils/catalogoTarjetas.js');
const { construirBuffer } = require('../utils/niveles.js');

const UPLOADS = path.join(__dirname, '..', 'api', 'uploads');
const creados = [];
after(() => { for (const f of creados) fs.rmSync(f, { force: true }); });

// GIF de 2 fotogramas (rojo y azul) de 300 × 90 subido a /uploads.
function gifDePrueba() {
    fs.mkdirSync(UPLOADS, { recursive: true });
    const w = 300, h = 90;
    const gif = GIFEncoder();
    for (const [r, g, b] of [[255, 0, 0], [0, 0, 255]]) {
        const datos = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < w * h; i++) datos.set([r, g, b, 255], i * 4);
        const paleta = quantize(datos, 16);
        gif.writeFrame(applyPalette(datos, paleta), w, h, { palette: paleta, delay: 200 });
    }
    gif.finish();
    const nombre = `test-tarjeta-${process.pid}.gif`;
    fs.writeFileSync(path.join(UPLOADS, nombre), Buffer.from(gif.bytes()));
    creados.push(path.join(UPLOADS, nombre));
    return `/uploads/${nombre}`;
}

// PNG de 200 × 60: mitad izquierda roja, mitad derecha verde.
function pngDePrueba() {
    const c = createCanvas(200, 60);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 100, 60);
    ctx.fillStyle = '#00ff00'; ctx.fillRect(100, 0, 100, 60);
    const nombre = `test-tarjeta-${process.pid}.png`;
    fs.mkdirSync(UPLOADS, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS, nombre), c.toBuffer('image/png'));
    creados.push(path.join(UPLOADS, nombre));
    return `/uploads/${nombre}`;
}

const render = { nombre: 'alex', nivel: 3, rank: 1, xpActual: 10, xpNecesaria: 100, idioma: 'es' };
// Color de un píxel de la tarjeta (PNG) en (x, y).
async function pixel(buffer, x, y) {
    const img = await loadImage(buffer);
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
}

describe('fondo de la tarjeta con imagen y encuadre (utils/rankCard.js)', () => {
    it('sin encuadre la imagen cubre la tarjeta; con encuadre se mueve donde se dejó', async () => {
        const ruta = pngDePrueba();
        // Cubriendo: el borde izquierdo (x≈40) sale rojo y el derecho verde.
        let png = await generarTarjeta({ ...render, fondoTipo: 'imagen', fondoImagen: ruta, fondoColor: '#000000' });
        let izq = await pixel(png, 30, 250);
        let der = await pixel(png, 880, 250);
        assert.ok(izq[0] > 100 && izq[1] < 60, `izquierda roja: ${izq}`);
        assert.ok(der[1] > 100 && der[0] < 60, `derecha verde: ${der}`);
        // Desplazada a la derecha (x = +0.5 anchos): la mitad roja tapa la derecha y
        // a la izquierda queda el color del diseño (azul).
        const encuadre = { escala: 900 / 200 / 900 * 1, x: 0.5, y: 0, giro: 0 }; // ancho de la imagen = ancho de la tarjeta
        png = await generarTarjeta({ ...render, fondoTipo: 'imagen', fondoImagen: ruta, fondoColor: '#0000ff', encuadre });
        izq = await pixel(png, 30, 250);
        der = await pixel(png, 880, 250);
        assert.ok(izq[2] > 100 && izq[0] < 60, `izquierda del color del diseño: ${izq}`);
        assert.ok(der[0] > 100 && der[1] < 60, `derecha roja (la imagen movida): ${der}`);
    });

    it('un GIF de fondo sale animado: un fotograma de la tarjeta por cada uno del GIF', async () => {
        const ruta = gifDePrueba();
        const opts = { ...render, fondoTipo: 'imagen', fondoImagen: ruta, fondoColor: '#000000' };
        assert.strictEqual(fondoEsGif(opts), true);
        const gif = await generarTarjetaAnimada(opts);
        const lector = new GifReader(new Uint8Array(gif));
        assert.strictEqual(lector.numFrames(), 2);
        const color = (f) => {
            const px = new Uint8ClampedArray(lector.width * lector.height * 4);
            lector.decodeAndBlitFrameRGBA(f, px);
            const i = (250 * lector.width + 20) * 4; // abajo a la izquierda, fuera del texto
            return [px[i], px[i + 1], px[i + 2]];
        };
        const [r0, , b0] = color(0);
        const [r1, , b1] = color(1);
        assert.ok(r0 > b0, `primer fotograma rojo: ${color(0)}`);
        assert.ok(b1 > r1, `segundo fotograma azul: ${color(1)}`);
        assert.strictEqual(lector.frameInfo(0).delay, 20); // conserva la duración del GIF (200 ms, en centésimas)
    });

    it('un GIF más ancho que la tarjeta se guarda reducido sin moverse de donde se ajustó', async () => {
        // 1800 × 540: mitad izquierda roja y derecha azul; encuadre = la imagen ocupa justo la tarjeta.
        const w = 1800, h = 540;
        const gif = GIFEncoder();
        for (let f = 0; f < 2; f++) {
            const datos = new Uint8ClampedArray(w * h * 4);
            for (let i = 0; i < w * h; i++) datos.set((i % w) < w / 2 ? [255, 0, 0, 255] : [0, 0, 255, 255], i * 4);
            const paleta = quantize(datos, 16);
            gif.writeFrame(applyPalette(datos, paleta), w, h, { palette: paleta, delay: 100 });
        }
        gif.finish();
        const nombre = `test-tarjeta-ancho-${process.pid}.gif`;
        fs.writeFileSync(path.join(UPLOADS, nombre), Buffer.from(gif.bytes()));
        creados.push(path.join(UPLOADS, nombre));
        const salida = await generarTarjetaAnimada({ ...render, fondoTipo: 'imagen', fondoImagen: `/uploads/${nombre}`, fondoColor: '#00ff00', encuadre: { escala: 1 / w, x: 0, y: 0, giro: 0 } });
        const lector = new GifReader(new Uint8Array(salida));
        const px = new Uint8ClampedArray(lector.width * lector.height * 4);
        lector.decodeAndBlitFrameRGBA(0, px);
        const en = (x, y) => { const i = (y * lector.width + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
        const izq = en(20, 250);
        const der = en(880, 250);
        assert.ok(izq[0] > izq[2] && izq[1] < 80, `izquierda roja (no el verde del diseño): ${izq}`);
        assert.ok(der[2] > der[0] && der[1] < 80, `derecha azul (no el verde del diseño): ${der}`);
    });

    it('solo se anima con premium; sin premium, el primer fotograma (PNG)', async () => {
        const ruta = gifDePrueba();
        const opc = { fondoTipo: 'imagen', fondoImagen: ruta, fondoColor: '#000000' };
        assert.strictEqual((await construirBuffer(opc, true, render)).ext, 'gif');
        assert.strictEqual((await construirBuffer(opc, false, render)).ext, 'png');
    });

    it('encuadre: se descartan valores que no valen', () => {
        assert.strictEqual(encuadreValido(null), null);
        assert.strictEqual(encuadreValido({ escala: 0, x: 0, y: 0 }), null);
        assert.strictEqual(encuadreValido({ escala: 'x', x: 0, y: 0 }), null);
        assert.deepStrictEqual(encuadreValido({ escala: 0.01, x: 0.1, y: -0.2, giro: 45 }), { escala: 0.01, x: 0.1, y: -0.2, giro: 0 });
    });
});

describe('diseños del catálogo (utils/catalogoTarjetas.js)', () => {
    it('con imagen: guarda la imagen subida y su encuadre limpio', () => {
        const d = sanearDiseno({ id: 'custom-1', nombre: 'Valorant', fondoTipo: 'imagen', fondoImagen: '/uploads/abc.gif', encuadre: { escala: 0.002, x: 9, y: -0.1, giro: 90, ancho: 640, alto: 360 }, colorAcento: '#ff4655' });
        assert.strictEqual(d.fondoTipo, 'imagen');
        assert.strictEqual(d.fondoImagen, '/uploads/abc.gif');
        assert.deepStrictEqual(d.encuadre, { escala: 0.002, x: 5, y: -0.1, giro: 90, ancho: 640, alto: 360 });
        assert.strictEqual(d.colorAcento, '#ff4655');
        const opc = opcionesDeDiseno(d);
        assert.strictEqual(opc.fondoImagen, '/uploads/abc.gif');
        assert.strictEqual(opc.preset, 'custom-1');
    });
    it('sin imagen o con una dirección que no vale, se queda con sus colores', () => {
        assert.strictEqual(sanearDiseno({ fondoTipo: 'imagen' }).fondoTipo, 'degradado');
        assert.strictEqual(sanearDiseno({ fondoTipo: 'imagen', fondoImagen: 'javascript:alert(1)' }).fondoTipo, 'degradado');
        assert.strictEqual(sanearDiseno({ fondoTipo: 'imagen', fondoImagen: '/uploads/../../.env' }).fondoTipo, 'degradado');
        assert.strictEqual(sanearDiseno({ fondoTipo: 'imagen', fondoImagen: 'http://192.168.1.1/x.png' }).fondoTipo, 'degradado');
        assert.strictEqual(sanearDiseno({ fondoTipo: 'color', fondoImagen: '/uploads/a.png' }).fondoImagen, null);
        assert.strictEqual(sanearDiseno({ colorAcento: 'red;}' }).colorAcento, '#5865F2');
    });
});
