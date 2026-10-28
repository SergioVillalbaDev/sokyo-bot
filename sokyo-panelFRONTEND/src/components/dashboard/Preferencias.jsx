// Preferencias de comodidad del panel: autoguardado, modo ligero (PCs con pocos
// recursos y Firefox) y la chuleta de atajos de teclado. En el escritorio van en
// el botón ⚙ de la cabecera; en el móvil, dentro de «Ayuda, idioma y tema».
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Settings2, Keyboard, X } from 'lucide-react';
import { Toggle } from '../ui/primitives';
import { cn } from '../../lib/cn';
import { useAutoguardadoActivo, ponerAutoguardado } from '../../hooks/useAutoguardado';
import { preferenciaLigero, ponerLigero, suscribirLigero, equipoModesto } from '../../lib/ligero';

export function OpcionesComodidad({ onAtajos }) {
  const { t } = useTranslation();
  const autoguardado = useAutoguardadoActivo();
  const ligero = useSyncExternalStore(suscribirLigero, preferenciaLigero, () => 'auto');
  const modesto = equipoModesto();
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-fg">{t('dashboard.prefs.autosave')}</span>
          <span className="block text-xs leading-snug text-muted">{t('dashboard.prefs.autosaveDesc')}</span>
        </span>
        <Toggle checked={autoguardado} onChange={(v) => ponerAutoguardado(v)} />
      </div>
      <div>
        <span className="block text-sm font-semibold text-fg">{t('dashboard.prefs.light')}</span>
        <span className="mb-2 block text-xs leading-snug text-muted">{t('dashboard.prefs.lightDesc')}</span>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t('dashboard.prefs.light')}>
          {['auto', 'si', 'no'].map((op) => (
            <button
              key={op} type="button" role="radio" aria-checked={ligero === op} onClick={() => ponerLigero(op)}
              className={cn('rounded-xl border px-2 py-1.5 text-xs font-semibold transition-colors',
                ligero === op ? 'border-brand bg-brand/15 text-fg' : 'border-line text-muted hover:text-fg')}
            >
              {t(`dashboard.prefs.lightOpts.${op}`)}
            </button>
          ))}
        </div>
        {ligero === 'auto' && <p className="mt-1.5 text-[11px] text-muted">{t(modesto ? 'dashboard.prefs.lightAutoOn' : 'dashboard.prefs.lightAutoOff')}</p>}
      </div>
      {onAtajos && (
        <button type="button" onClick={onAtajos} className="flex w-full items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-left text-sm font-semibold text-fg transition-colors hover:bg-elevated">
          <Keyboard size={16} className="text-brand" /> {t('dashboard.prefs.shortcuts')} <span className="sk-tecla ml-auto">?</span>
        </button>
      )}
    </div>
  );
}

// Escritorio: botón ⚙ con las opciones en un desplegable.
export default function BotonPreferencias({ onAtajos }) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!caja.current?.contains(e.target)) setAbierto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);
  return (
    <div ref={caja} className="relative">
      <button type="button" onClick={() => setAbierto((v) => !v)} className="sk-boton-icono" aria-expanded={abierto} aria-label={t('dashboard.prefs.title')} title={t('dashboard.prefs.title')}>
        <Settings2 size={17} />
      </button>
      {abierto && (
        <div className="sk-aparece absolute right-0 top-[calc(100%+10px)] z-40 w-80 rounded-2xl border border-line bg-card p-4 shadow-xl">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted">{t('dashboard.prefs.title')}</p>
          <OpcionesComodidad onAtajos={onAtajos ? () => { setAbierto(false); onAtajos(); } : undefined} />
        </div>
      )}
    </div>
  );
}

// Chuleta de atajos de teclado (se abre con «?» o desde las preferencias).
export function AtajosTeclado({ onCerrar }) {
  const { t } = useTranslation();
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onCerrar]);
  const lista = [
    [['Ctrl', 'K'], 'search'], [['/'], 'searchAlt'], [['Alt', '←'], 'back'], [['Ctrl', 'S'], 'save'],
    [['Esc'], 'close'], [['?'], 'help'],
  ];
  return createPortal(
    <div className="sk-velo flex items-start justify-center px-3 pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-label={t('dashboard.prefs.shortcuts')} className="sk-glass sk-brillo sk-aparece w-full max-w-md rounded-3xl border border-line bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-fg"><Keyboard size={19} className="text-brand" /> {t('dashboard.prefs.shortcuts')}</h2>
          <button type="button" autoFocus onClick={onCerrar} className="sk-boton-icono" aria-label={t('dashboard.prefs.close')}><X size={16} /></button>
        </div>
        <ul className="space-y-2.5">
          {lista.map(([teclas, clave]) => (
            <li key={clave} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-fg">{t(`dashboard.prefs.keys.${clave}`)}</span>
              <span className="flex shrink-0 gap-1">{teclas.map((k) => <span key={k} className="sk-tecla">{k}</span>)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.querySelector('.sk-dash') || document.body,
  );
}
