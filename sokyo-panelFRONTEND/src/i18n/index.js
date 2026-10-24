// Configuración de internacionalización (i18n).
// Para AÑADIR UN IDIOMA: crea src/i18n/locales/<code>.js y <code>.panel.js
// (copiando los de es y traduciendo), impórtalo aquí, y añádelo a
// `resources`, a `TEXTOS_PANEL` y a `IDIOMAS`.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es';
import en from './locales/en';

// Idiomas disponibles (se muestran en el selector).
export const IDIOMAS = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

// Idioma: el que el visitante eligió antes; si no, el de su navegador (o móvil)
// si lo tenemos; y si no, inglés.
const guardado = localStorage.getItem('sokyoLang');
const delNavegador = (navigator.languages || [navigator.language || ''])
  .map((l) => String(l).slice(0, 2).toLowerCase())
  .find((l) => IDIOMAS.some((i) => i.code === l));
const inicial = guardado && IDIOMAS.some((i) => i.code === guardado) ? guardado : (delNavegador || 'en');

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: inicial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React ya escapa por seguridad
});

// Textos del panel de admin: son la mayor parte (y la web pública no los usa),
// así que van en un archivo por idioma que se descarga al entrar al panel.
const TEXTOS_PANEL = {
  es: () => import('./locales/es.panel.js'),
  en: () => import('./locales/en.panel.js'),
};
const textosPanel = {};
let enElPanel = false;
// El panel avisa al abrirse y al cerrarse (Dashboard.jsx): fuera de él, cambiar de
// idioma no descarga sus textos.
export const marcarEnPanel = (si) => { enElPanel = si; };
export function cargarTextosPanel(lng = i18n.language) {
  const code = TEXTOS_PANEL[lng] ? lng : 'en';
  textosPanel[code] ||= TEXTOS_PANEL[code]()
    .then((m) => { i18n.addResourceBundle(code, 'translation', m.default, true, true); })
    .catch((e) => { delete textosPanel[code]; throw e; }); // sin red: se reintenta la próxima vez
  return textosPanel[code];
}

// Cambia el idioma y lo recuerda para la próxima visita. Dentro del panel,
// primero se traen sus textos en el idioma nuevo (si no, se verían las claves).
let idiomaPedido = null;
export const cambiarIdioma = async (code) => {
  idiomaPedido = code;
  try { localStorage.setItem('sokyoLang', code); } catch { /* sin almacenamiento */ }
  if (enElPanel) await cargarTextosPanel(code).catch(() => {});
  // Si mientras tanto se eligió otro idioma, gana el último.
  if (idiomaPedido === code) i18n.changeLanguage(code);
};

export default i18n;
