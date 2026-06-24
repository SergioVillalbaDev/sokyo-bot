// ============================================================================
// SOKYO — ONBOARDING INTERACTIVO DEL PANEL (versión "deep tour")
// ----------------------------------------------------------------------------
// Recorrido guiado que explica CADA categoría del panel, en el mismo orden que
// el menú lateral, con un resaltado visual potente (campo de energía + rastro
// de partículas) alrededor del elemento de cada paso.
//
// • Filosofía: corto por paso, pero completo en conjunto. Nunca atrapa: siempre
//   hay "Saltar tutorial" + la X para cerrar.
// • Persistencia: localStorage → solo salta solo la PRIMERA vez. Después se
//   relanza a mano con el botón de ayuda (?) del Header.
// • Textos: i18n (dashboard.onboarding.*), funciona en ES/EN.
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

// ---------------------------------------------------------------------------
// CAMPO DE ENERGÍA: un overlay que rodea el elemento resaltado con un anillo
// giratorio + partículas en órbita. Se reposiciona en cada paso y al hacer
// scroll/resize. Vive por encima del oscurecido de driver.js y por debajo del
// popover (z-index controlado en onboarding.css).
// ---------------------------------------------------------------------------
const FOCUS_PAD = 6;
let focusEl = null;

const ensureFocus = () => {
  if (focusEl) return focusEl;
  focusEl = document.createElement('div');
  focusEl.className = 'sokyo-focus';
  focusEl.setAttribute('aria-hidden', 'true');
  focusEl.innerHTML =
    '<div class="sokyo-focus__ring"></div>' +
    '<div class="sokyo-focus__glow"></div>';
  document.body.appendChild(focusEl);
  return focusEl;
};

const positionFocus = (el) => {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const f = ensureFocus();
  f.style.left = `${r.left - FOCUS_PAD}px`;
  f.style.top = `${r.top - FOCUS_PAD}px`;
  f.style.width = `${r.width + FOCUS_PAD * 2}px`;
  f.style.height = `${r.height + FOCUS_PAD * 2}px`;
};

const showFocus = (el) => {
  positionFocus(el);
  const f = ensureFocus();
  // Doble pase: tras el scroll que hace driver, recalculamos la posición real.
  requestAnimationFrame(() => positionFocus(el));
  f.classList.add('is-visible');
};

const hideFocus = () => focusEl && focusEl.classList.remove('is-visible');
const destroyFocus = () => { if (focusEl) { focusEl.remove(); focusEl = null; } };

// ---------------------------------------------------------------------------
// PASOS — uno por categoría del panel, en el orden del menú lateral. Cada paso
// resalta el grupo del sidebar (o una zona de Inicio) y su texto resume TODO lo
// que vive dentro de esa categoría.
// ---------------------------------------------------------------------------
const buildSteps = (t) => {
  const step = (key, element, side, align) => ({
    element,
    popover: {
      title: t(`dashboard.onboarding.steps.${key}.title`),
      description: t(`dashboard.onboarding.steps.${key}.desc`),
      ...(side ? { side } : {}),
      ...(align ? { align } : {}),
    },
  });

  return [
    step('welcome', undefined, undefined, 'center'),
    step('server', '[data-tour="server"]', 'right', 'start'),
    step('home', '[data-tour="stats"]', 'bottom', 'start'),
    step('plan', '[data-tour="nav-cuenta"]', 'right', 'center'),
    step('data', '[data-tour="nav-datos"]', 'right', 'center'),
    step('community', '[data-tour="nav-entrada"]', 'right', 'center'),
    step('music', '[data-tour="nav-musica"]', 'right', 'center'),
    step('tickets', '[data-tour="nav-tickets"]', 'right', 'center'),
    step('roles', '[data-tour="nav-roles"]', 'right', 'center'),
    step('moderation', '[data-tour="nav-moderacion"]', 'right', 'center'),
    step('logs', '[data-tour="nav-logs"]', 'right', 'center'),
    step('messages', '[data-tour="nav-mensajes"]', 'right', 'center'),
    step('config', '[data-tour="nav-config"]', 'right', 'center'),
    step('tools', '[data-tour="tools"]', 'bottom', 'end'),
    step('help', '[data-tour="help"]', 'bottom', 'end'),
  ];
};

/**
 * Lanza el tour. Descarta los pasos cuyo elemento no exista (p. ej. una
 * categoría que el usuario no puede ver por permisos), así nunca se queda en
 * blanco ni señala al vacío.
 */
export const startOnboarding = (t) => {
  // Un paso es válido si no tiene elemento (centrado) o si su elemento existe Y
  // está visible en pantalla. En móvil el menú lateral está oculto (drawer),
  // así que sus pasos se descartan en vez de señalar fuera de la vista.
  const isUsable = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return (
      r.width > 0 && r.height > 0 &&
      r.right > 0 && r.bottom > 0 &&
      r.left < window.innerWidth && r.top < window.innerHeight
    );
  };
  const steps = buildSteps(t).filter((s) => !s.element || isUsable(s.element));
  if (steps.length === 0) return;

  let activeEl = null;
  const reposition = () => activeEl && positionFocus(activeEl);

  let driverObj;
  driverObj = driver({
    showProgress: true,
    progressText: t('dashboard.onboarding.progress'),
    nextBtnText: t('dashboard.onboarding.next'),
    prevBtnText: t('dashboard.onboarding.prev'),
    doneBtnText: t('dashboard.onboarding.done'),
    popoverClass: 'sokyo-popover',
    stagePadding: 6,
    stageRadius: 14,
    overlayColor: '#06070a',
    overlayOpacity: 0.72,
    smoothScroll: true,
    steps,

    // Inyecta "Saltar tutorial" a la izquierda del footer en cada paso.
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

    // Mueve el campo de energía al elemento del paso actual (o lo oculta si el
    // paso es centrado, como la bienvenida).
    onHighlighted: (element) => {
      if (element && element !== document.body) {
        activeEl = element;
        showFocus(element);
      } else {
        activeEl = null;
        hideFocus();
      }
    },

    // Al terminar, saltar o cerrar con la X: limpia todo y no vuelve a salir solo.
    onDestroyed: () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      destroyFocus();
      markOnboardingSeen();
    },
  });

  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  driverObj.drive();
};

/** Lanza el tour solo si es la primera vez (auto-inicio en el primer login). */
export const maybeStartOnboarding = (t) => {
  if (hasSeenOnboarding()) return;
  startOnboarding(t);
};

// ---------------------------------------------------------------------------
// AYUDA POR SECCIÓN — un popover de UN solo paso, con el mismo estilo que el
// tour, que explica a fondo SOLO la sección en la que estás. Se lanza desde el
// botón (?) que vive junto al título de cada sección en el Header.
//
// • Texto: i18n (dashboard.sectionHelp.<key>.title/desc). Si una sección no
//   tiene texto propio, no hace nada (botón inofensivo).
// • Es centrado (no señala a ningún elemento), así funciona igual en escritorio
//   y móvil y nunca apunta al vacío.
// ---------------------------------------------------------------------------
export const startSectionHelp = (t, key) => {
  const titleKey = `dashboard.sectionHelp.${key}.title`;
  const descKey = `dashboard.sectionHelp.${key}.desc`;
  // Si no hay traducción para esta sección, i18n devuelve la propia clave:
  // en ese caso no abrimos nada para no mostrar un popover vacío.
  const title = t(titleKey);
  const description = t(descKey);
  if (title === titleKey || description === descKey) return;

  const driverObj = driver({
    showProgress: false,
    doneBtnText: t('dashboard.sectionHelp.done'),
    popoverClass: 'sokyo-popover',
    overlayColor: '#06070a',
    overlayOpacity: 0.72,
    steps: [{ popover: { title, description, align: 'center' } }],
    onDestroyed: () => destroyFocus(),
  });
  driverObj.drive();
};
