// ============================================================================
// SOKYO — ONBOARDING INTERACTIVO DEL PANEL
// ----------------------------------------------------------------------------
// Tour guiado paso a paso con driver.js. Filosofía: corto, amigable y nunca
// atrapa al usuario (siempre hay "Saltar tutorial" + X para cerrar).
//
// • Persistencia: se guarda en localStorage que ya se vio → solo salta solo la
//   PRIMERA vez. Después solo se lanza a mano (botón de ayuda en el Header).
// • Textos: salen de i18n (dashboard.onboarding.*), así funciona en ES/EN.
// • Anclajes: cada paso apunta a un [data-tour="..."] del panel.
// ============================================================================
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './onboarding.css';

const STORAGE_KEY = 'sokyoOnboardingDone';

/** ¿El usuario ya completó/saltó el tour alguna vez? */
export const hasSeenOnboarding = () => localStorage.getItem(STORAGE_KEY) === '1';

/** Marca el tour como visto (para que no vuelva a saltar solo). */
export const markOnboardingSeen = () => localStorage.setItem(STORAGE_KEY, '1');

// Pasos del recorrido (máx. 5, estratégicos). El primero es una bienvenida
// centrada (sin `element`); el resto resaltan zonas reales del panel.
const buildSteps = (t) => [
  {
    popover: {
      title: t('dashboard.onboarding.welcome.title'),
      description: t('dashboard.onboarding.welcome.desc'),
      align: 'center',
    },
  },
  {
    element: '[data-tour="stats"]',
    popover: {
      title: t('dashboard.onboarding.stats.title'),
      description: t('dashboard.onboarding.stats.desc'),
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="nav-tickets"]',
    popover: {
      title: t('dashboard.onboarding.tickets.title'),
      description: t('dashboard.onboarding.tickets.desc'),
      side: 'right',
      align: 'center',
    },
  },
  {
    element: '[data-tour="nav-entrada"]',
    popover: {
      title: t('dashboard.onboarding.community.title'),
      description: t('dashboard.onboarding.community.desc'),
      side: 'right',
      align: 'center',
    },
  },
  {
    element: '[data-tour="help"]',
    popover: {
      title: t('dashboard.onboarding.help.title'),
      description: t('dashboard.onboarding.help.desc'),
      side: 'bottom',
      align: 'end',
    },
  },
];

/**
 * Lanza el tour. Solo descarta los pasos cuyo elemento no exista (p. ej. si el
 * usuario no tiene permiso para verlo), así nunca se queda en blanco.
 */
export const startOnboarding = (t) => {
  const steps = buildSteps(t).filter(
    (s) => !s.element || document.querySelector(s.element),
  );
  if (steps.length === 0) return;

  let driverObj;
  driverObj = driver({
    showProgress: steps.length > 1,
    progressText: t('dashboard.onboarding.progress'),
    nextBtnText: t('dashboard.onboarding.next'),
    prevBtnText: t('dashboard.onboarding.prev'),
    doneBtnText: t('dashboard.onboarding.done'),
    popoverClass: 'sokyo-popover',
    stagePadding: 6,
    stageRadius: 16,
    overlayColor: '#0b0c0e',
    overlayOpacity: 0.62,
    steps,
    // Inyecta un botón "Saltar tutorial" a la izquierda del footer en cada paso.
    onPopoverRender: (popover) => {
      const footer = popover.footer;
      if (!footer || footer.querySelector('.sokyo-skip-btn')) return;
      const skip = document.createElement('button');
      skip.className = 'sokyo-skip-btn';
      skip.type = 'button';
      skip.textContent = t('dashboard.onboarding.skip');
      skip.addEventListener('click', () => driverObj.destroy());
      footer.insertBefore(skip, footer.firstChild);
    },
    // Se dispara al terminar, saltar o cerrar con la X → no vuelve a salir solo.
    onDestroyed: () => markOnboardingSeen(),
  });

  driverObj.drive();
};

/** Lanza el tour solo si es la primera vez (auto-inicio en el primer login). */
export const maybeStartOnboarding = (t) => {
  if (hasSeenOnboarding()) return;
  startOnboarding(t);
};
