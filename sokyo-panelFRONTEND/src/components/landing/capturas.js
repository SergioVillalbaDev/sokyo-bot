// Capturas reales del panel y de «Mi cuenta» (public/landing/), sacadas con un
// servidor de ejemplo en los dos idiomas. Escritorio: 640, 960 y 1800 px de
// ancho (1800×1125); móvil: 390 y 780 px (780×1328). El navegador elige la que
// le basta según `sizes`: en el móvil, la pequeña.
const idioma = (lng) => (String(lng || '').startsWith('en') ? 'en' : 'es');

// Va en la dirección de cada captura: si se repiten, súbela para que nadie siga
// viendo la antigua guardada en su navegador.
const VERSION = 1;

export const ANCHO = 1800;
export const ALTO = 1125;
export const ANCHO_MOVIL = 780;
export const ALTO_MOVIL = 1328;

export function captura(lng, nombre) {
  const base = `/landing/${idioma(lng)}-${nombre}`;
  const a = (ancho) => `${base}-${ancho}.webp?v=${VERSION}`;
  return { src: a(960), srcSet: `${a(640)} 640w, ${a(960)} 960w, ${a(1800)} 1800w` };
}

export function capturaMovil(lng, nombre) {
  const base = `/landing/${idioma(lng)}-m-${nombre}`;
  const a = (ancho) => `${base}-${ancho}.webp?v=${VERSION}`;
  return { src: a(390), srcSet: `${a(390)} 390w, ${a(780)} 780w` };
}
