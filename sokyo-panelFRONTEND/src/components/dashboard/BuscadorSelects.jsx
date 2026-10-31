// Buscador en los desplegables del panel. Al abrir uno con muchas opciones (canales,
// roles, categorías…), en vez de la lista del navegador sale una con un cuadro para
// buscar: se escribe parte del nombre («avisos», «sala de») y quedan solo los que
// encajan, sin mayúsculas, tildes ni adornos («📢・avisos» vale con «avisos»).
// Se elige con el ratón, con el dedo o con ↑ ↓ y Enter; Escape cierra.
//
// Va montado una vez en el panel (Dashboard.jsx) y vale para TODOS los <select> sin
// tocar cada sección. Elegir cambia el valor como si se hubiera elegido a mano, así
// que la sección (React), «➕ Crear canal/rol nuevo…» (CrearAlVuelo.jsx) y el
// autoguardado se enteran igual. Con pocas opciones (menos de MIN_OPCIONES) se deja
// el desplegable normal; `data-sin-buscador` lo quita en uno concreto.
// Se pinta en la raíz del panel (portal): dentro de una tarjeta con cristal, un
// `fixed` se colocaría respecto a la tarjeta.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, Check } from 'lucide-react';

const MIN_OPCIONES = 8;
const ALTO_MAX = 340;

// Solo letras y números, en minúsculas y sin tildes (como el «#» de las bienvenidas).
const normalizar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, '');

const conBuscador = (el) => el instanceof HTMLSelectElement && !el.multiple && !el.disabled
  && el.options.length >= MIN_OPCIONES && !('sinBuscador' in el.dataset) && !!el.closest('.sk-dash');

// Cambia el valor de un <select> como si lo hubiera elegido la persona (React se entera).
function elegir(select, valor) {
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  set.call(select, valor);
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

// Las opciones del <select> (con el nombre de su grupo, si lo tiene).
const leerOpciones = (select) => [...select.options].map((o, i) => ({
  i, valor: o.value, texto: o.textContent.trim(), clave: normalizar(o.textContent),
  grupo: o.parentElement instanceof HTMLOptGroupElement ? o.parentElement.label : '', desactivada: o.disabled,
}));

// Dónde va la lista: debajo del desplegable o, si no cabe, encima; nunca fuera de la pantalla.
function posicionDe(select) {
  const r = select.getBoundingClientRect();
  const ancho = Math.min(window.innerWidth - 16, Math.max(r.width, 280));
  const izquierda = Math.min(Math.max(8, r.left), window.innerWidth - ancho - 8);
  const abajo = window.innerHeight - r.bottom - 8;
  const arriba = r.top - 8;
  if (abajo >= Math.min(ALTO_MAX, 220) || abajo >= arriba) return { left: izquierda, width: ancho, top: r.bottom + 4, maxHeight: Math.min(ALTO_MAX, abajo - 4) };
  return { left: izquierda, width: ancho, bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(ALTO_MAX, arriba - 4) };
}

export default function BuscadorSelects() {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(null); // { select, opciones }
  const [consulta, setConsulta] = useState('');
  const [activo, setActivo] = useState(0);
  const [pos, setPos] = useState(null);
  const caja = useRef(null);
  const lista = useRef(null);
  const abiertoRef = useRef(null);
  useEffect(() => { abiertoRef.current = abierto; }, [abierto]);

  const abrir = useCallback((select) => {
    select.focus({ preventScroll: true }); // CrearAlVuelo apunta aquí lo que había elegido
    const opciones = leerOpciones(select);
    setConsulta('');
    setActivo(Math.max(0, opciones.findIndex((o) => o.valor === select.value)));
    setPos(posicionDe(select));
    setAbierto({ select, opciones });
  }, []);

  const cerrar = useCallback((devolverFoco = true) => {
    const a = abiertoRef.current;
    setAbierto(null);
    if (a && devolverFoco && a.select.isConnected) a.select.focus({ preventScroll: true });
  }, []);

  // Abrir con el ratón, con el dedo o con el teclado (Enter, espacio, Alt + ↓, F4).
  useEffect(() => {
    let toque = null;
    const alPulsar = (e) => {
      if (e.button !== 0 || !conBuscador(e.target)) return;
      e.preventDefault(); // sin la lista del navegador
      if (abiertoRef.current && abiertoRef.current.select === e.target) cerrar();
      else abrir(e.target);
    };
    const alEmpezarToque = (e) => { toque = conBuscador(e.target) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; };
    const alSoltarToque = (e) => {
      if (!toque || !conBuscador(e.target)) return;
      const p = e.changedTouches[0];
      const movido = Math.hypot(p.clientX - toque.x, p.clientY - toque.y) > 10; // estaba desplazando la página
      toque = null;
      if (movido) return;
      e.preventDefault();
      abrir(e.target);
    };
    const alClicar = (e) => { if (conBuscador(e.target)) e.preventDefault(); };
    const alTeclear = (e) => {
      if (!conBuscador(e.target)) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'F4' || (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp'))) {
        e.preventDefault();
        abrir(e.target);
      }
    };
    window.addEventListener('mousedown', alPulsar, true);
    window.addEventListener('touchstart', alEmpezarToque, { capture: true, passive: true });
    window.addEventListener('touchend', alSoltarToque, { capture: true, passive: false });
    window.addEventListener('click', alClicar, true);
    window.addEventListener('keydown', alTeclear, true);
    return () => {
      window.removeEventListener('mousedown', alPulsar, true);
      window.removeEventListener('touchstart', alEmpezarToque, true);
      window.removeEventListener('touchend', alSoltarToque, true);
      window.removeEventListener('click', alClicar, true);
      window.removeEventListener('keydown', alTeclear, true);
    };
  }, [abrir, cerrar]);

  // Abierta: se cierra al pulsar fuera y sigue al desplegable si la página se mueve.
  useEffect(() => {
    if (!abierto) return undefined;
    let cuadro = 0;
    const recolocar = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        if (!abierto.select.isConnected) { cerrar(false); return; }
        setPos(posicionDe(abierto.select));
      });
    };
    const fuera = (e) => {
      if (caja.current && caja.current.contains(e.target)) return;
      if (e.target === abierto.select) return; // lo gestiona alPulsar
      cerrar(false);
    };
    window.addEventListener('scroll', recolocar, true);
    window.addEventListener('resize', recolocar);
    window.addEventListener('pointerdown', fuera, true);
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('scroll', recolocar, true);
      window.removeEventListener('resize', recolocar);
      window.removeEventListener('pointerdown', fuera, true);
    };
  }, [abierto, cerrar]);

  const q = normalizar(consulta);
  const visibles = abierto ? abierto.opciones.filter((o) => !q || (o.valor !== '' && o.clave.includes(q))) : [];

  // La opción activa siempre a la vista.
  useLayoutEffect(() => {
    const el = lista.current && lista.current.querySelector('[data-activa="1"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activo, abierto, consulta]);

  if (!abierto || !pos) return null;

  const escoger = (o) => {
    if (!o || o.desactivada) return;
    const { select } = abierto;
    cerrar();
    if (select.value !== o.valor) elegir(select, o.valor);
  };
  const mover = (paso) => {
    if (!visibles.length) return;
    let i = activo;
    for (let n = 0; n < visibles.length; n++) {
      i = (i + paso + visibles.length) % visibles.length;
      if (!visibles[i].desactivada) break;
    }
    setActivo(i);
  };
  const teclas = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mover(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); escoger(visibles[activo]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); }
    else if (e.key === 'Tab') cerrar(false);
  };

  const idLista = 'sk-buscador-lista';
  return createPortal(
    <div ref={caja} className="fixed z-[1000] flex flex-col overflow-hidden rounded-2xl border border-line bg-[var(--solido-card)] shadow-2xl"
      style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: Math.max(160, pos.maxHeight) }}>
      <label className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <Search size={15} className="shrink-0 text-muted" />
        <input autoFocus value={consulta} onKeyDown={teclas} placeholder={t('dashboard.buscadorSelect.buscar')}
          onChange={(e) => { setConsulta(e.target.value); setActivo(0); }}
          role="combobox" aria-expanded="true" aria-controls={idLista} aria-activedescendant={visibles[activo] ? `${idLista}-${visibles[activo].i}` : undefined}
          className="w-full min-w-0 bg-transparent text-sm text-fg outline-none placeholder:text-muted" />
      </label>
      <ul ref={lista} id={idLista} role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
        {visibles.length === 0 && <li className="px-3 py-3 text-center text-sm text-muted">{t('dashboard.buscadorSelect.nada', { texto: consulta })}</li>}
        {visibles.map((o, k) => {
          const elegida = o.valor === abierto.select.value;
          const grupoNuevo = o.grupo && (k === 0 || visibles[k - 1].grupo !== o.grupo);
          return (
            <li key={o.i} role="presentation">
              {grupoNuevo && <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{o.grupo}</p>}
              <div id={`${idLista}-${o.i}`} role="option" aria-selected={elegida} aria-disabled={o.desactivada || undefined} data-activa={k === activo ? '1' : undefined}
                onMouseDown={(e) => e.preventDefault()} onClick={() => escoger(o)} onMouseEnter={() => setActivo(k)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${o.desactivada ? 'cursor-not-allowed opacity-40' : ''} ${k === activo ? 'bg-brand/15 text-fg' : 'text-fg/90'} ${o.valor === '' ? 'text-muted' : ''}`}>
                <span className="min-w-0 flex-1 truncate">{o.texto || '—'}</span>
                {elegida && <Check size={14} className="shrink-0 text-brand" />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>,
    document.querySelector('.sk-dash') || document.body,
  );
}
