// Selector de temas — 3 free + 8 premium (bloqueados sin plan Premium).
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Lock, Check, Crown } from 'lucide-react';
import { FREE_THEMES, PREMIUM_THEMES } from '../../lib/themes';

export default function ThemePicker({ theme, setTheme, esPremium }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const Swatch = ({ t, locked }) => {
    const active = theme === t.id;
    return (
      <button
        onClick={() => { if (!locked) { setTheme(t.id); } }}
        disabled={locked}
        title={locked ? 'Disponible en Premium' : t.label}
        className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all ${
          active ? 'border-brand ring-2 ring-brand/40' : 'border-line hover:border-brand/50'
        } ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      >
        <span
          className="relative flex h-9 w-full items-center justify-center overflow-hidden rounded-lg"
          style={{ background: t.swatch[0] }}
        >
          <span className="h-4 w-4 rounded-full" style={{ background: t.swatch[1] }} />
          {locked && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Lock size={13} className="text-white" />
            </span>
          )}
          {active && !locked && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-on-brand">
              <Check size={10} strokeWidth={3} />
            </span>
          )}
        </span>
        <span className="text-[11px] font-medium text-muted">{t.label}</span>
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
        aria-label="Cambiar tema"
      >
        <Palette size={16} className="text-brand" />
        <span className="hidden sm:inline">Tema</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-line bg-card p-4 shadow-soft"
          >
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-bold text-fg">Apariencia</h4>
              <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] font-bold text-muted">
                {esPremium ? 'Plan Premium' : 'Plan Free'}
              </span>
            </div>

            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Básicos</p>
            <div className="grid grid-cols-3 gap-2">
              {FREE_THEMES.map((t) => <Swatch key={t.id} t={t} locked={false} />)}
            </div>

            <div className="mb-2 mt-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <Crown size={12} className="text-amber-400" /> Premium
            </div>
            <div className="grid grid-cols-4 gap-2">
              {PREMIUM_THEMES.map((t) => <Swatch key={t.id} t={t} locked={!esPremium} />)}
            </div>

            {!esPremium && (
              <p className="mt-3 rounded-lg bg-elevated px-3 py-2 text-[11px] text-muted">
                🔒 Desbloquea 8 temas con estilo propio activando <strong className="text-fg">Sokyo Pro</strong>.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
