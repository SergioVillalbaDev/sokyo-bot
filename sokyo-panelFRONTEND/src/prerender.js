// Pinta en HTML la parte de arriba de la portada (lo que se ve nada más entrar:
// barra, hero y «Dos entradas») en un idioma. Lo usa scripts/prerender-portada.js
// al compilar para meterlo en dist/index.html: así el móvil ve la portada sin
// esperar a descargar y ejecutar el JavaScript, que luego solo la «hidrata».
// Debe pintar exactamente lo mismo que el primer render de <App /> en la portada.
import './prerender-entorno';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import i18n from './i18n';
import Landing from './components/landing/Landing';

export async function pintar(idioma) {
  await i18n.changeLanguage(idioma);
  return renderToString(createElement(Landing, { onEnterDashboard: () => {} }));
}
