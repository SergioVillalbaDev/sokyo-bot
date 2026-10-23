// Configuración de internacionalización (i18n).
// Para AÑADIR UN IDIOMA: crea src/i18n/locales/<code>.js (copiando es.js y
// traduciendo), impórtalo aquí, y añádelo a `resources` y a `IDIOMAS`.
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

// Cambia el idioma y lo recuerda para la próxima visita.
export const cambiarIdioma = (code) => {
  i18n.changeLanguage(code);
  localStorage.setItem('sokyoLang', code);
};

export default i18n;
