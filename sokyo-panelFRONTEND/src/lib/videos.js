// Vídeos cortos del panel (public/videos/<idioma>-<id>.mp4 y .webm, con su
// póster .webp): cómo se hace cada cosa, grabados con un servidor de ejemplo en
// los dos idiomas. Se repiten solos, como un GIF, pero pesan mucho menos
// (150-600 KB cada uno, frente a varios MB de un GIF).
const idioma = (lng) => (String(lng || '').startsWith('en') ? 'en' : 'es');

// Va en la dirección de cada archivo: si se regraba algún vídeo, súbela para
// que nadie siga viendo el antiguo guardado en su navegador.
const VERSION = 1;

// Dos formatos: MP4 (H.264, el que usan Chrome, Safari, Edge y Firefox) y WebM
// (VP9) para los navegadores sin H.264, como algunos Chromium.
export const videoDemo = (lng, id) => {
  const base = `/videos/${idioma(lng)}-${id}`;
  return { mp4: `${base}.mp4?v=${VERSION}`, webm: `${base}.webm?v=${VERSION}`, poster: `${base}.webp?v=${VERSION}` };
};

// Sección del panel → su vídeo (botón «Ver cómo se hace» de la cabecera).
export const VIDEOS_PANEL = {
  inicio: 'inicio',
  'tickets-gestion': 'tickets',
  'mod-automod': 'automod',
  'config-niveles': 'niveles',
  'datos-analitica': 'analitica',
  'com-sorteos': 'sorteos',
  'prod-bienvenidas': 'bienvenidas',
  'config-canales': 'canales',
  'com-micuenta': 'micuenta',
};
