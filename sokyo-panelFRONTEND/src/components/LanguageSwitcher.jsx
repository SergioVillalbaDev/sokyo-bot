// Selector de idioma reutilizable (landing y dashboard).
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { IDIOMAS, cambiarIdioma } from '../i18n';

export default function LanguageSwitcher({ className = '' }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const actual = IDIOMAS.find((i) => i.code === i18n.language) || IDIOMAS[0];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
        aria-label="Idioma"
      >
        <Globe size={16} className="text-brand" />
        <span className="hidden sm:inline">{actual.flag} {actual.code.toUpperCase()}</span>
        <span className="sm:hidden">{actual.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-44 rounded-2xl border border-line bg-card p-1.5 shadow-soft">
          {IDIOMAS.map((idioma) => {
            const activo = idioma.code === i18n.language;
            return (
              <button
                key={idioma.code}
                onClick={() => { cambiarIdioma(idioma.code); setOpen(false); }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                  activo ? 'bg-elevated font-semibold text-fg' : 'text-muted hover:bg-elevated hover:text-fg'
                }`}
              >
                <span>{idioma.flag} {idioma.label}</span>
                {activo && <Check size={14} className="text-brand" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
