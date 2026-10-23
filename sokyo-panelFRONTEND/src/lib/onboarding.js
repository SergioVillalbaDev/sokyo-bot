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
import { sectionTours } from './sectionTours';

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

// Un paso es válido si no tiene elemento (centrado) o si su elemento existe Y
// está visible en pantalla. En móvil el menú lateral está oculto (drawer), así
// que sus pasos se descartan en vez de señalar fuera de la vista.
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

/**
 * MOTOR COMÚN — corre un tour de driver.js con el "campo de energía" de Sokyo
 * alrededor de cada paso, el botón "Saltar tutorial" y la limpieza al cerrar.
 * Lo usan tanto el tour global como los mini-tours de cada sección.
 *
 * @param t        función de i18n
 * @param steps    pasos ya construidos (formato driver.js)
 * @param onClose  callback opcional al destruir (p. ej. marcar el tour visto)
 */
const runTour = (t, steps, onClose) => {
  if (!steps || steps.length === 0) return;

  let activeEl = null;
  const reposition = () => activeEl && positionFocus(activeEl);

  let driverObj;
  driverObj = driver({
    showProgress: steps.length > 1,
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

    // Inyecta "Saltar tutorial" a la izquierda del footer (solo si hay >1 paso).
    onPopoverRender: (popover) => {
      const footer = popover.footer;
      if (!footer || steps.length <= 1 || footer.querySelector('.sokyo-skip-btn')) return;
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

    onDestroyed: () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      destroyFocus();
      if (onClose) onClose();
    },
  });

  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  driverObj.drive();
};

/**
 * Lanza el tour global. Descarta los pasos cuyo elemento no exista o no esté
 * visible (p. ej. una categoría oculta por permisos o el sidebar en móvil), así
 * nunca se queda en blanco ni señala al vacío.
 */
export const startOnboarding = (t) => {
  const steps = buildSteps(t).filter((s) => !s.element || isUsable(s.element));
  runTour(t, steps, markOnboardingSeen);
};

/** Lanza el tour solo si es la primera vez (auto-inicio en el primer login). */
export const maybeStartOnboarding = (t) => {
  if (hasSeenOnboarding()) return;
  startOnboarding(t);
};

// ---------------------------------------------------------------------------
// MINI-TOUR POR SECCIÓN — el botón (?) del Header lanza un recorrido guiado que
// señala y explica las distintas partes de la sección en la que estás, con el
// mismo estilo (campo de energía + popover) que el tour global.
//
// • Estructura de pasos: lib/sectionTours.js (anclas data-help="..." + lado).
// • Texto: i18n dashboard.sectionTours.<key>.steps.<id>.{title,desc}.
// • Robusto: descarta pasos cuyo elemento no esté visible. Si no queda ninguno
//   (vista aún cargando, etc.), no abre nada.
// ---------------------------------------------------------------------------
export const startSectionTour = (t, key) => {
  const defs = sectionTours[key];

  // 1) Mini-tour guiado multi-paso (si la sección lo tiene definido y al menos
  //    uno de sus elementos está visible).
  if (Array.isArray(defs) && defs.length > 0) {
    const steps = defs
      .filter((d) => !d.sel || isUsable(d.sel))
      .map((d) => ({
        ...(d.sel ? { element: d.sel } : {}),
        popover: {
          title: t(`dashboard.sectionTours.${key}.steps.${d.id}.title`),
          description: t(`dashboard.sectionTours.${key}.steps.${d.id}.desc`),
          ...(d.side ? { side: d.side } : {}),
          ...(d.align ? { align: d.align } : {}),
        },
      }));
    if (steps.length > 0) { runTour(t, steps); return; }
  }

  // 2) Fallback: un único popover centrado con el resumen de la sección
  //    (dashboard.sectionHelp.<key>). Si no hay texto, no abre nada.
  const titleKey = `dashboard.sectionHelp.${key}.title`;
  const descKey = `dashboard.sectionHelp.${key}.desc`;
  const title = t(titleKey);
  const description = t(descKey);
  if (title === titleKey || description === descKey) return;
  runTour(t, [{ popover: { title, description, align: 'center' } }]);
};

/**
 * ¿Esta sección tiene alguna ayuda? Hay mini-tour propio o, como mínimo, el
 * texto-resumen de sectionHelp. Sirve para mostrar u ocultar el botón (?).
 */
export const hasSectionTour = (t, key) => {
  if (Array.isArray(sectionTours[key]) && sectionTours[key].length > 0) return true;
  return t(`dashboard.sectionHelp.${key}.title`) !== `dashboard.sectionHelp.${key}.title`;
};
