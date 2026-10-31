// Caja de texto en la que, al escribir «#», sale la lista de canales del servidor
// para mencionar uno (como en Discord). Se elige con el ratón o con ↑ ↓ y Enter;
// se inserta «#nombre» y el bot lo convierte en el enlace al canal al enviar.
// Sin `canales` es una caja de texto normal. La lógica está en lib/canalesTexto.js.
import { useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hash } from 'lucide-react';
import { buscarConsultaCanal, filtrarCanales, insertarCanal } from '../../lib/canalesTexto';

export default function TextareaCanales({ canales, value, onChange, onValor, onKeyDown, onBlur, ref, ...props }) {
  const { t } = useTranslation();
  const caja = useRef(null);
  const idLista = useId();
  useImperativeHandle(ref, () => caja.current, []);
  const [menu, setMenu] = useState(null); // { inicio, consulta, activo }
  // Dónde dejar el cursor tras elegir un canal: se pone en cuanto llega el texto
  // nuevo (antes de la siguiente tecla), no un fotograma después.
  const cursorPendiente = useRef(null);
  useLayoutEffect(() => {
    const el = caja.current;
    if (el && cursorPendiente.current !== null) {
      el.selectionStart = el.selectionEnd = cursorPendiente.current;
      cursorPendiente.current = null;
    }
  }, [value]);
  const activo = Array.isArray(canales) && canales.length > 0;
  const lista = menu ? filtrarCanales(canales, menu.consulta) : [];

  const revisar = (el) => {
    if (!activo) return;
    const encontrado = buscarConsultaCanal(el.value, el.selectionStart);
    setMenu(encontrado ? { ...encontrado, activo: 0 } : null);
  };

  const elegir = (canal) => {
    const el = caja.current;
    if (!el || !menu) return;
    const r = insertarCanal(el.value, el.selectionStart, menu.inicio, canal.nombre);
    cursorPendiente.current = r.cursor;
    el.focus();
    if (onValor) onValor(r.texto);
    else onChange?.({ target: { value: r.texto } });
    setMenu(null);
  };

  const teclas = (ev) => {
    if (menu && lista.length > 0) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        const paso = ev.key === 'ArrowDown' ? 1 : -1;
        setMenu({ ...menu, activo: (menu.activo + paso + lista.length) % lista.length });
        return;
      }
      if (ev.key === 'Enter' || ev.key === 'Tab') {
        ev.preventDefault();
        elegir(lista[menu.activo] || lista[0]);
        return;
      }
    }
    if (menu && ev.key === 'Escape') { ev.preventDefault(); setMenu(null); return; }
    onKeyDown?.(ev);
  };

  const abierto = !!menu;
  return (
    <div className="relative">
      <textarea ref={caja} value={value}
        onChange={(ev) => { onChange?.(ev); revisar(ev.target); }}
        onKeyDown={teclas}
        onClick={(ev) => revisar(ev.currentTarget)}
        onBlur={(ev) => { setMenu(null); onBlur?.(ev); }}
        aria-autocomplete={activo ? 'list' : undefined}
        aria-expanded={activo ? abierto : undefined}
        aria-controls={abierto ? idLista : undefined}
        aria-activedescendant={abierto && lista.length ? `${idLista}-${menu.activo}` : undefined}
        {...props} />
      {abierto && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-line bg-[var(--solido-card)] shadow-xl">
          <p className="border-b border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {lista.length ? t('dashboard.bienvenida_v.canalesLista') : t('dashboard.bienvenida_v.canalesNinguno', { texto: menu.consulta })}
          </p>
          {lista.length > 0 && (
            <ul id={idLista} role="listbox" className="max-h-60 overflow-y-auto p-1">
              {lista.map((c, i) => (
                <li key={c.id} id={`${idLista}-${i}`} role="option" aria-selected={i === menu.activo}
                  onMouseDown={(ev) => { ev.preventDefault(); elegir(c); }}
                  onMouseEnter={() => setMenu({ ...menu, activo: i })}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${i === menu.activo ? 'bg-brand/15 text-fg' : 'text-muted'}`}>
                  <Hash size={14} className="shrink-0 opacity-70" />
                  <span className="truncate">{c.nombre}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
