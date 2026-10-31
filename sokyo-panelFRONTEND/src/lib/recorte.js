// Geometría del recorte de imágenes (components/dashboard/RecortarImagen.jsx).
// Todo va en «unidades de marco»: el ancho del marco vale 1 y su alto, 1 / proporción.
// La escala son unidades de marco por píxel de la imagen original.

// Dónde se usa cada forma en Discord y a qué tamaño se guarda como mucho.
export const FORMAS = {
  circulo: { proporciones: [1], salidaMax: 512, circular: true },      // icono del autor y del pie
  cuadrado: { proporciones: [1], salidaMax: 512, circular: false },    // miniatura
  ancho: { proporciones: ['original', 16 / 9, 3, 1], salidaMax: 1600, circular: false }, // imagen grande
};

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 4;

// Tamaño de la imagen después de girarla (90° y 270° cambian ancho por alto).
export function tamanoGirado(ancho, alto, giro) {
  return giro % 180 === 0 ? { w: ancho, h: alto } : { w: alto, h: ancho };
}

// Proporción (ancho / alto) del marco. «original» = la de la imagen girada.
export function proporcionDe(eleccion, tam) {
  return eleccion === 'original' ? tam.w / tam.h : eleccion;
}

// Escala inicial de cada modo:
//  - rellenar: la imagen cubre todo el marco (lo que sobra se recorta).
//  - entera: la imagen se ve completa; en un círculo, también sus esquinas.
export function escalaBase(tam, proporcion, modo, circular) {
  const altoMarco = 1 / proporcion;
  if (modo === 'entera') {
    if (circular) return 1 / Math.hypot(tam.w, tam.h);
    return Math.min(1 / tam.w, altoMarco / tam.h);
  }
  return Math.max(1 / tam.w, altoMarco / tam.h);
}

// Cuánto se puede mover la imagen: al rellenar, sin dejar huecos; si es más
// pequeña que el marco, sin que se salga de él.
export function limitarDesplazamiento(desp, tam, escala, proporcion) {
  const lx = Math.abs(tam.w * escala - 1) / 2;
  const ly = Math.abs(tam.h * escala - 1 / proporcion) / 2;
  const limitar = (v, l) => Math.min(l, Math.max(-l, v));
  return { x: limitar(desp.x, lx), y: limitar(desp.y, ly) };
}

// Dibuja la imagen en un contexto 2D. `px` = píxeles por unidad de marco y
// (cx, cy) = centro del marco en píxeles.
export function dibujarImagen(ctx, img, { giro, escala, desp }, px, cx, cy) {
  const w = img.naturalWidth * escala * px;
  const h = img.naturalHeight * escala * px;
  ctx.save();
  ctx.translate(cx + desp.x * px, cy + desp.y * px);
  ctx.rotate((giro * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// Ancho en píxeles de la imagen recortada: el detalle que de verdad tiene la
// imagen dentro del marco (sin agrandarla de más), entre 128 y el máximo de la forma.
export function anchoSalida(escala, salidaMax) {
  return Math.round(Math.min(salidaMax, Math.max(128, 1 / escala)));
}

// PNG si puede tener transparencia; JPEG (más ligero) si era una foto sin fondo transparente.
export function tipoSalida(tipoOriginal, fondo) {
  return fondo && tipoOriginal === 'image/jpeg' ? 'image/jpeg' : 'image/png';
}
