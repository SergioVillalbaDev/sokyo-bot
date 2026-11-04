// Interruptor «Modo simple / Modo avanzado» de los editores de permisos.
// Simple = lo esencial (como hasta ahora). Avanzado = todas las opciones de Discord.
import { useTranslation } from 'react-i18next';
import { Sparkles, SlidersHorizontal } from 'lucide-react';

export default function SelectorModoPermisos({ modo, setModo, className = '' }) {
  const { t } = useTranslation();
  const opcion = (valor, Icono, texto) => (
    <button
      type="button" role="radio" aria-checked={modo === valor} onClick={() => setModo(valor)}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${modo === valor ? 'bg-gradient-brand text-white shadow-soft' : 'text-muted hover:text-fg'}`}
    >
      <Icono size={14} /> {texto}
    </button>
  );
  return (
    <div className={className} data-help="modo-permisos">
      <div role="radiogroup" aria-label={t('dashboard.modoPermisos.label')} className="flex gap-1 rounded-2xl border border-line bg-bg p-1">
        {opcion('simple', Sparkles, t('dashboard.modoPermisos.simple'))}
        {opcion('avanzado', SlidersHorizontal, t('dashboard.modoPermisos.avanzado'))}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted">
        {modo === 'simple' ? t('dashboard.modoPermisos.simpleDesc') : t('dashboard.modoPermisos.avanzadoDesc')}
      </p>
    </div>
  );
}
