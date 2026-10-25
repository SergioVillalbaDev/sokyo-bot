// Capturas reales del panel y de «Mi cuenta» (public/landing/), sacadas con un
// servidor de ejemplo en los dos idiomas. Escritorio: 640, 960 y 1800 px de
// ancho (1800×1125); móvil: 390 y 780 px (780×1328). El navegador elige la que
// le basta según `sizes`: en el móvil, la pequeña.
const idioma = (lng) => (String(lng || '').startsWith('en') ? 'en' : 'es');

export const ANCHO = 1800;
export const ALTO = 1125;
export const ANCHO_MOVIL = 780;
export const ALTO_MOVIL = 1328;

export function captura(lng, nombre) {
  const base = `/landing/${idioma(lng)}-${nombre}`;
  return { src: `${base}-960.webp`, srcSet: `${base}-640.webp 640w, ${base}-960.webp 960w, ${base}-1800.webp 1800w` };
}

export function capturaMovil(lng, nombre) {
  const base = `/landing/${idioma(lng)}-m-${nombre}`;
  return { src: `${base}-390.webp`, srcSet: `${base}-390.webp 390w, ${base}-780.webp 780w` };
}

// Descarga una captura antes de que haga falta (al pasar por encima de su pestaña).
export function precargar(lng, nombre, sizes) {
  const { src, srcSet } = captura(lng, nombre);
  const img = new Image();
  img.sizes = sizes;
  img.srcset = srcSet;
  img.src = src;
}
