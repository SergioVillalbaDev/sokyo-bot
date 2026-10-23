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

// Idioma por defecto: inglés. Si el visitante ya eligió uno antes, se respeta.
const guardado = localStorage.getItem('sokyoLang');
const inicial = guardado && IDIOMAS.some((i) => i.code === guardado) ? guardado : 'en';

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
