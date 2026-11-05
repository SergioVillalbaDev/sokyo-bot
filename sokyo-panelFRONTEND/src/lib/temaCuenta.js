// Tema de «Mi cuenta» (1.9.12): los mismos temas que el panel y la web (lib/themes.js)
// más «Cristal», el de siempre del portal. Igual que en el panel: los premium solo
// con plan (en «Mi cuenta», si la persona es Premium: usuario.esPremium). Se guarda
// en este navegador; portal.css pinta el cristal con la paleta de cada tema.
import { THEMES, isPremiumTheme } from './themes';

const CLAVE = 'sokyoTemaCuenta';
export const EVENTO_TEMA_CUENTA = 'sokyo-tema-cuenta';
export const TEMAS_CUENTA = [{ id: 'glass', label: 'Cristal', premium: false, swatch: ['#05040d', '#c084fc'] }, ...THEMES];

export function leerTemaCuenta() {
  try { const v = localStorage.getItem(CLAVE); return TEMAS_CUENTA.some((x) => x.id === v) ? v : 'glass'; } catch { return 'glass'; }
}
export function guardarTemaCuenta(id) {
  try { localStorage.setItem(CLAVE, id); } catch { /* sin almacenamiento: dura lo que la pestaña */ }
}
// El tema que se ve: uno premium sin plan vuelve a «Cristal». `premium` null = aún no se
// sabe (se respeta el elegido, para no parpadear al cargar; nunca se trata como Free).
export const temaVisible = (id, premium) => (premium === false && isPremiumTheme(id) ? 'glass' : id);
