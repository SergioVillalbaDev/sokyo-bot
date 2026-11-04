// Imágenes que se suben desde el panel (1.9.10). Desde el móvil llegan cosas que
// antes fallaban: GIF de más de 8 MB, «GIF» que en realidad son WebP animados
// (Pinterest, teclados) o vídeos MP4 (WhatsApp, Telegram), y galerías que no dicen
// bien el tipo del archivo. Aquí se mira qué es de verdad por sus primeros bytes y
// se deja listo para Discord:
//  · Lo animado nunca se recorta en un lienzo (se quedaría quieto). Un WebP o PNG
//    animado se pasa a GIF (en Discord el GIF se mueve en todas partes).
//  · Un GIF que pasa del máximo se encoge (menos tamaño y, si hace falta, menos
//    fotogramas) hasta que cabe.
//  · Un vídeo corto se convierte en GIF (los 12 primeros segundos).
//  · Una imagen quieta que pasa del máximo se reduce.
// Lo pesado (omggif y gifenc) se descarga solo cuando hace falta.

export const MAX_SUBIDA = 8 * 1024 * 1024;
const MAX_LADO_GIF = 640;      // en Discord un embed no se ve más ancho que esto
const SEGUNDOS_VIDEO = 12;

const ascii = (b, i, j) => String.fromCharCode(...b.subarray(i, j));

// Qué es de verdad el archivo, por sus primeros bytes ('' si no se reconoce).
export function tipoReal(b) {
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 12 && ascii(b, 4, 8) === 'ftyp') {
    const marca = ascii(b, 8, 12);
    if (/^avi[fs]/.test(marca)) return 'image/avif';
    if (/^(heic|heix|hevc|heim|heis|mif1|msf1)/.test(marca)) return 'image/heic';
    return 'video/mp4';
  }
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  return '';
}

// ¿Tiene movimiento? GIF (siempre se trata como animado: no se recorta), WebP con
// la marca de animación (VP8X) y PNG animado (trozo acTL antes de los datos).
export function esAnimada(b, tipo) {
  if (tipo === 'image/gif') return true;
  if (tipo === 'image/webp') return b.length > 20 && ascii(b, 12, 16) === 'VP8X' && (b[20] & 0x02) !== 0;
  if (tipo === 'image/png') {
    for (let i = 8; i + 8 < Math.min(b.length, 64 * 1024);) {
      const largo = (b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]) >>> 0;
      const nombre = ascii(b, i + 4, i + 8);
      if (nombre === 'acTL') return true;
      if (nombre === 'IDAT') return false;
      i += 12 + largo;
    }
  }
  return false;
}

const EXT = { 'image/gif': 'gif', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const conExtension = (nombre, tipo) => `${String(nombre || 'imagen').replace(/\.[^.]+$/, '') || 'imagen'}.${EXT[tipo] || 'img'}`;
const pausa = () => new Promise((r) => setTimeout(r, 0));

export function aDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Error con un código que el panel traduce (dashboard.imagen.errores.<codigo>).
export class ErrorImagen extends Error {
  constructor(codigo, datos = {}) { super(codigo); this.codigo = codigo; this.datos = datos; }
}

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Codificador de GIF que va añadiendo fotogramas RGBA (con transparencia).
async function nuevoGif() {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const gif = GIFEncoder();
  return {
    fotograma(px, w, h, retardoMs) {
      const paleta = quantize(px, 256, { format: 'rgba4444', oneBitAlpha: true });
      const indices = applyPalette(px, paleta, 'rgba4444');
      const transparente = paleta.findIndex((c) => c[3] === 0);
      gif.writeFrame(indices, w, h, { palette: paleta, delay: Math.max(20, retardoMs), transparent: transparente >= 0, transparentIndex: Math.max(0, transparente) });
    },
    bytes() { gif.finish(); return gif.bytes(); },
  };
}

// Medidas para que el lado más largo no pase de `lado`.
const medidas = (w, h, lado) => {
  const f = Math.min(1, lado / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * f)), h: Math.max(1, Math.round(h * f)) };
};

// Vuelve a hacer un GIF más pequeño: lado máximo `lado` y uno de cada `paso` fotogramas.
async function rehacerGif(bytes, { lado, paso, alProgreso }) {
  const { GifReader } = await import('omggif');
  const r = new GifReader(bytes);
  const W = r.width; const H = r.height; const N = r.numFrames();
  const { w, h } = medidas(W, H, lado);
  const completo = lienzo(W, H);
  const cc = completo.getContext('2d', { willReadFrequently: true });
  const peque = lienzo(w, h);
  const pc = peque.getContext('2d', { willReadFrequently: true });
  const out = await nuevoGif();
  let lienzoRgba = new Uint8ClampedArray(W * H * 4);
  let acumulado = 0;
  for (let i = 0; i < N; i++) {
    const info = r.frameInfo(i);
    const antes = info.disposal === 3 ? lienzoRgba.slice() : null;
    r.decodeAndBlitFrameRGBA(i, lienzoRgba);
    acumulado += (info.delay || 10) * 10;
    if (i % paso === 0 || i === N - 1) {
      cc.putImageData(new ImageData(lienzoRgba, W, H), 0, 0);
      pc.clearRect(0, 0, w, h);
      pc.drawImage(completo, 0, 0, w, h);
      out.fotograma(pc.getImageData(0, 0, w, h).data, w, h, acumulado);
      acumulado = 0;
    }
    // Qué se hace con este fotograma antes del siguiente (como manda el GIF).
    if (info.disposal === 2) {
      for (let y = info.y; y < info.y + info.height; y++) lienzoRgba.fill(0, (y * W + info.x) * 4, (y * W + info.x + info.width) * 4);
    } else if (antes) lienzoRgba = antes;
    if (i % 4 === 0) { alProgreso?.(i / N); await pausa(); }
  }
  return out.bytes();
}

// Intentos de menos a más agresivo hasta que el GIF quepa: [lado máximo, 1 de cada N
// fotogramas]. Para algo pequeño (un emoji: 256 KB, se ve a 128 px) se empieza más abajo.
const INTENTOS = [[MAX_LADO_GIF, 1], [480, 1], [400, 2], [320, 2], [240, 3]];
const INTENTOS_PEQUENO = [[256, 1], [160, 1], [128, 1], [128, 2], [96, 2], [64, 3]];
// `ladoMinimo`: no se baja de ahí (el fondo de la tarjeta pide 900 px): se quitan
// fotogramas en vez de tamaño.
const intentosPara = (max, ladoMinimo = 0) => (ladoMinimo
  ? [[Math.max(1200, ladoMinimo), 1], [ladoMinimo, 1], [ladoMinimo, 2], [ladoMinimo, 3], [ladoMinimo, 4]]
  : (max < 1024 * 1024 ? INTENTOS_PEQUENO : INTENTOS));
async function encogerGif(bytes, max, alProgreso, ladoMinimo) {
  for (const [lado, paso] of intentosPara(max, ladoMinimo)) {
    const nuevo = await rehacerGif(bytes, { lado, paso, alProgreso });
    if (nuevo.length <= max) return nuevo;
  }
  throw new ErrorImagen('muy-grande', { mb: (bytes.length / 1048576).toFixed(1) });
}

// WebP o PNG animado → GIF, con ImageDecoder (Chrome, Edge, Android). Sin él, null.
async function animadaAGif(bytes, tipo, max, alProgreso, ladoMinimo) {
  if (typeof window === 'undefined' || !('ImageDecoder' in window)) return null;
  let dec;
  try {
    dec = new window.ImageDecoder({ data: bytes, type: tipo });
    await dec.tracks.ready;
    const n = dec.tracks.selectedTrack.frameCount;
    for (const [lado, paso] of intentosPara(max, ladoMinimo)) {
      const out = await nuevoGif();
      let c; let ctx; let acumulado = 0;
      for (let i = 0; i < n; i++) {
        const { image } = await dec.decode({ frameIndex: i });
        acumulado += (image.duration || 100000) / 1000;
        if (i % paso === 0 || i === n - 1) {
          if (!c) { const m = medidas(image.displayWidth, image.displayHeight, lado); c = lienzo(m.w, m.h); ctx = c.getContext('2d', { willReadFrequently: true }); }
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.drawImage(image, 0, 0, c.width, c.height);
          out.fotograma(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, acumulado);
          acumulado = 0;
        }
        image.close();
        if (i % 4 === 0) { alProgreso?.(i / n); await pausa(); }
      }
      const gif = out.bytes();
      if (gif.length <= max) return gif;
    }
    throw new ErrorImagen('muy-grande', { mb: (bytes.length / 1048576).toFixed(1) });
  } catch (e) {
    if (e instanceof ErrorImagen) throw e;
    return null;
  } finally { dec?.close?.(); }
}

// Vídeo corto (MP4/WebM de WhatsApp, Telegram…) → GIF.
async function videoAGif(archivo, max, alProgreso) {
  const url = URL.createObjectURL(archivo);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  try {
    await new Promise((ok, mal) => { v.onloadeddata = ok; v.onerror = () => mal(new ErrorImagen('video')); setTimeout(() => mal(new ErrorImagen('video')), 15000); });
    const duracion = Math.min(Number.isFinite(v.duration) ? v.duration : SEGUNDOS_VIDEO, SEGUNDOS_VIDEO);
    const ir = (t) => new Promise((ok) => { v.onseeked = ok; v.currentTime = t; });
    const pasos = max < 1024 * 1024 ? [[160, 8], [128, 8], [96, 6], [64, 5]] : [[480, 10], [400, 8], [320, 8], [240, 6]];
    for (const [lado, fps] of pasos) {
      const { w, h } = medidas(v.videoWidth || 320, v.videoHeight || 240, lado);
      const c = lienzo(w, h);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      const out = await nuevoGif();
      const total = Math.max(1, Math.floor(duracion * fps));
      for (let i = 0; i < total; i++) {
        await ir(i / fps);
        ctx.drawImage(v, 0, 0, w, h);
        out.fotograma(ctx.getImageData(0, 0, w, h).data, w, h, 1000 / fps);
        if (i % 3 === 0) { alProgreso?.(i / total); await pausa(); }
      }
      const gif = out.bytes();
      if (gif.length <= max) return { gif, recortado: Number.isFinite(v.duration) && v.duration > SEGUNDOS_VIDEO };
    }
    throw new ErrorImagen('muy-grande', { mb: (archivo.size / 1048576).toFixed(1) });
  } finally { URL.revokeObjectURL(url); v.removeAttribute('src'); }
}

// Imagen quieta demasiado grande (o AVIF, que Discord no enseña) → JPEG/PNG más pequeño.
async function reducirQuieta(blob, tipo, max) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new ErrorImagen('no-imagen')); i.src = url; });
    const salida = tipo === 'image/png' ? 'image/png' : 'image/jpeg';
    for (const lado of (max < 1024 * 1024 ? [512, 320, 256, 128, 96] : [2048, 1600, 1280, 1024, 800])) {
      const { w, h } = medidas(img.naturalWidth, img.naturalHeight, lado);
      const c = lienzo(w, h);
      const ctx = c.getContext('2d');
      if (salida === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);
      const nuevo = await new Promise((ok) => c.toBlob(ok, salida, 0.85));
      if (nuevo && nuevo.size <= max) return { blob: nuevo, tipo: salida };
    }
    throw new ErrorImagen('muy-grande', { mb: (blob.size / 1048576).toFixed(1) });
  } finally { URL.revokeObjectURL(url); }
}

// Prepara lo que la persona ha elegido. Devuelve { archivo (File con su tipo real),
// tipo, animada, cambio: null | 'encogido' | 'video' | 'convertido' (animada → GIF) |
// 'formato' (AVIF o WebP → PNG/JPG) | 'reducido',
// recortado (vídeo más largo que lo que se usa) }. Lanza ErrorImagen si no se puede.
//   max: tamaño máximo (por defecto 8 MB). video: aceptar vídeos (se pasan a GIF).
//   sinWebp: un WebP quieto se pasa a PNG (los emojis de Discord no admiten WebP).
//   ladoMinimo: al rehacer un GIF, no bajar de ese tamaño (fondo de tarjeta: 900).
export async function prepararImagen(file, { max = MAX_SUBIDA, video = true, sinWebp = false, ladoMinimo = 0, alProgreso } = {}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const tipo = tipoReal(bytes) || (file.type || '');
  const hecho = (datos, t, extra = {}) => ({
    archivo: new File([datos], conExtension(file.name, t), { type: t }),
    tipo: t, animada: t === 'image/gif' || esAnimada(datos instanceof Uint8Array ? datos : bytes, t), cambio: null, recortado: false, ...extra,
  });

  if (tipo.startsWith('video/')) {
    if (!video) throw new ErrorImagen('video-no');
    const { gif, recortado } = await videoAGif(file, max, alProgreso);
    return hecho(gif, 'image/gif', { cambio: 'video', recortado, animada: true });
  }
  if (tipo === 'image/heic') throw new ErrorImagen('heic');
  if (tipo === 'image/avif') {
    const { blob, tipo: t } = await reducirQuieta(file, 'image/png', max);
    return hecho(new Uint8Array(await blob.arrayBuffer()), t, { cambio: 'formato' });
  }
  if (!EXT[tipo]) throw new ErrorImagen('no-imagen');

  const animada = esAnimada(bytes, tipo);
  if (animada && tipo !== 'image/gif') {
    const gif = await animadaAGif(bytes, tipo, max, alProgreso, ladoMinimo);
    if (gif) return hecho(gif, 'image/gif', { cambio: 'convertido', animada: true });
    // Sin forma de convertirla en este navegador (Firefox, Safari): donde no vale WebP, se dice.
    if (sinWebp && tipo === 'image/webp') throw new ErrorImagen('webp-animado');
    if (bytes.length > max) throw new ErrorImagen('muy-grande', { mb: (bytes.length / 1048576).toFixed(1) });
    return hecho(bytes, tipo, { animada: true }); // sin forma de convertirla aquí: tal cual
  }
  if (sinWebp && tipo === 'image/webp') {
    const { blob, tipo: t } = await reducirQuieta(file, 'image/png', max);
    return hecho(new Uint8Array(await blob.arrayBuffer()), t, { cambio: 'formato' });
  }
  if (bytes.length <= max) return hecho(bytes, tipo, { animada });
  if (tipo === 'image/gif') return hecho(await encogerGif(bytes, max, alProgreso, ladoMinimo), 'image/gif', { cambio: 'encogido', animada: true });
  const { blob, tipo: t } = await reducirQuieta(file, tipo, max);
  return hecho(new Uint8Array(await blob.arrayBuffer()), t, { cambio: 'reducido' });
}

// Enlaces de Tenor o Giphy (la página, no la imagen): Discord no los enseña como
// imagen. Giphy se arregla aquí; Tenor lo resuelve el servidor (/api/imagen/enlace).
export function enlaceGiphyDirecto(url) {
  const m = String(url || '').match(/^https?:\/\/(?:www\.)?giphy\.com\/(?:gifs|stickers)\/(?:[\w-]*-)?([A-Za-z0-9]{6,})\/?(?:[?#].*)?$/i)
    || String(url || '').match(/^https?:\/\/(?:www\.)?giphy\.com\/embed\/([A-Za-z0-9]{6,})/i)
    || String(url || '').match(/^https?:\/\/gph\.is\/g\/([A-Za-z0-9]{6,})/i);
  return m ? `https://media.giphy.com/media/${m[1]}/giphy.gif` : null;
}
export const esPaginaTenor = (url) => /^https?:\/\/(?:www\.)?tenor\.com\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:view\/|[A-Za-z0-9]+\.gif$)/i.test(String(url || '').trim());

// Tamaño para leer («6,2 MB», «253 KB») en el idioma de la persona.
export function tamanoLegible(bytes, idioma) {
  const fmt = new Intl.NumberFormat(idioma || undefined, { maximumFractionDigits: 1 });
  return bytes >= 1024 * 1024 ? `${fmt.format(bytes / 1048576)} MB` : `${Math.round(bytes / 1024)} KB`;
}

// Texto del error para la persona (lo usan todos los campos de imagen). `clave`: dónde
// están los textos (panel: dashboard.imagen.errores; «Mi cuenta»: portal.card.imgError).
export function textoErrorImagen(e, t, { max = MAX_SUBIDA, idioma, clave = 'dashboard.imagen.errores' } = {}) {
  if (!(e instanceof ErrorImagen)) return t(`${clave}.fallo`);
  const antes = e.datos.mb ? tamanoLegible(Number(e.datos.mb) * 1048576, idioma) : '';
  return t(`${clave}.${e.codigo}`, { max: tamanoLegible(max, idioma), antes });
}
