// ============================================================================
// Tests de la 1.9.10: imágenes y GIF que se suben desde el móvil.
//  - El servidor mira qué es de verdad cada archivo por sus primeros bytes (algunas
//    galerías no dicen el tipo o lo dicen mal) (utils/imagenes.js).
//  - El panel distingue lo animado (GIF, WebP y PNG animados: no se recortan) y
//    arregla los enlaces de la página de Giphy/Tenor (sokyo-panelFRONTEND/src/lib/imagenes.js).
// Lo que necesita un navegador (encoger GIF, vídeo → GIF) se probó con Playwright.
// ============================================================================
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { extensionImagen, imagenDeDataUrl } = require('../utils/imagenes.js');

const fixture = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f));
// GIF de 1×1 (el más pequeño válido).
const GIF = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0]);

describe('servidor: qué imagen es por sus bytes (utils/imagenes.js)', () => {
    it('reconoce GIF, PNG, JPG y WebP', () => {
        assert.strictEqual(extensionImagen(GIF), 'gif');
        assert.strictEqual(extensionImagen(fixture('quieto.png')), 'png');
        assert.strictEqual(extensionImagen(JPG), 'jpg');
        assert.strictEqual(extensionImagen(fixture('animado.webp')), 'webp');
        assert.strictEqual(extensionImagen(Buffer.from('esto no es una imagen')), null);
    });
    it('un GIF que la galería manda sin tipo o como «octet-stream» se acepta como GIF', () => {
        for (const cabecera of ['data:application/octet-stream;base64,', 'data:;base64,', 'data:image/png;base64,']) {
            const r = imagenDeDataUrl(cabecera + GIF.toString('base64'));
            assert.strictEqual(r.ext, 'gif');
            assert.strictEqual(r.mime, 'image/gif');
        }
    });
    it('un archivo que no es imagen se rechaza aunque diga «image/gif»', () => {
        assert.strictEqual(imagenDeDataUrl(`data:image/gif;base64,${Buffer.from('hola, soy un texto').toString('base64')}`), null);
        assert.strictEqual(imagenDeDataUrl('no es un dataURL'), null);
    });
});

describe('panel: qué se sube y cómo (lib/imagenes.js)', () => {
    let lib;
    before(async () => { lib = await import(pathToFileURL(path.join(__dirname, '..', 'sokyo-panelFRONTEND', 'src', 'lib', 'imagenes.js')).href); });
    const u8 = (b) => new Uint8Array(b);

    it('tipo real: imágenes, vídeos (los «GIF» de WhatsApp) y fotos HEIC del iPhone', () => {
        assert.strictEqual(lib.tipoReal(u8(GIF)), 'image/gif');
        assert.strictEqual(lib.tipoReal(u8(JPG)), 'image/jpeg');
        assert.strictEqual(lib.tipoReal(u8(fixture('animado.webp'))), 'image/webp');
        const caja = (marca) => u8(Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from(`ftyp${marca}`), Buffer.alloc(8)]));
        assert.strictEqual(lib.tipoReal(caja('isom')), 'video/mp4');
        assert.strictEqual(lib.tipoReal(caja('heic')), 'image/heic');
        assert.strictEqual(lib.tipoReal(caja('avif')), 'image/avif');
        assert.strictEqual(lib.tipoReal(u8([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])), 'video/webm');
    });

    it('animada: GIF, WebP animado y PNG animado sí; WebP y PNG quietos no (esos sí se pueden recortar)', () => {
        assert.strictEqual(lib.esAnimada(u8(GIF), 'image/gif'), true);
        assert.strictEqual(lib.esAnimada(u8(fixture('animado.webp')), 'image/webp'), true);
        assert.strictEqual(lib.esAnimada(u8(fixture('quieto.webp')), 'image/webp'), false);
        assert.strictEqual(lib.esAnimada(u8(fixture('animado.png')), 'image/png'), true);
        assert.strictEqual(lib.esAnimada(u8(fixture('quieto.png')), 'image/png'), false);
    });

    it('enlace de la página de Giphy → el GIF de verdad', () => {
        assert.strictEqual(lib.enlaceGiphyDirecto('https://giphy.com/gifs/cat-funny-JIX9t2j0ZTN9S'), 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif');
        assert.strictEqual(lib.enlaceGiphyDirecto('https://giphy.com/gifs/JIX9t2j0ZTN9S'), 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif');
        assert.strictEqual(lib.enlaceGiphyDirecto('https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif'), null); // ya es el GIF
        assert.strictEqual(lib.enlaceGiphyDirecto('https://example.com/x.gif'), null);
    });

    it('enlace de la página de Tenor (lo resuelve el servidor) y lo que no lo es', () => {
        assert.strictEqual(lib.esPaginaTenor('https://tenor.com/es/view/hello-wave-cute-anime-cartoon-gif-13975234520976942340'), true);
        assert.strictEqual(lib.esPaginaTenor('https://tenor.com/view/cat-gif-9180355'), true);
        assert.strictEqual(lib.esPaginaTenor('https://tenor.com/bQx2k.gif'), true);
        assert.strictEqual(lib.esPaginaTenor('https://media1.tenor.com/m/wfIBwLubZQQAAAAC/hello-wave.gif'), false);
    });
});

describe('diagnóstico: ¿se puede abrir el panel desde internet? (utils/diagnostico.js)', () => {
    const { direccionPublica } = require('../utils/diagnostico.js');
    it('las direcciones de internet sí', () => {
        for (const u of ['https://dashboard.sokyo.studio', 'https://fcbarcelona.com/', 'http://[2001:db8::1]']) assert.strictEqual(direccionPublica(u), true, u);
    });
    it('las de casa o vacías no (Discord no podría descargar las imágenes)', () => {
        for (const u of ['', 'localhost:3000', 'http://localhost:3000', 'http://127.0.0.1', 'http://0.0.0.0:3001', 'http://[::1]:3000', 'http://raspberrypi', 'http://raspberrypi.local', 'http://pi.lan', 'http://192.168.1.5', 'http://172.20.1.1', 'http://[fd00::1]', 'ftp://ejemplo.com']) assert.strictEqual(direccionPublica(u), false, u);
    });
});
