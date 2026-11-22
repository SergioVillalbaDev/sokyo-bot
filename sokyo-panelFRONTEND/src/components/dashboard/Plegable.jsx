// Bloque plegable (1.27.0): para que cada sección enseñe primero lo básico y deje lo demás
// recogido con un título claro. Recuerda si lo abriste (localStorage `sokyoPlegable:<id>`).
// Uso: <Plegable id="casino-stats" titulo="Estadísticas" sub="Quién gana más…" emoji="📊">…tarjetas…</Plegable>
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

const leer = (id, porDefecto) => {
  try { const v = localStorage.getItem(`sokyoPlegable:${id}`); return v === null ? porDefecto : v === '1'; } catch { return porDefecto; }
};

export default function Plegable({ id, titulo, sub, emoji = '⚙️', abierto: porDefecto = false, cuenta = null, children }) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(() => leer(id, porDefecto));
  const cambiar = () => {
    const v = !abierto; setAbierto(v);
    try { localStorage.setItem(`sokyoPlegable:${id}`, v ? '1' : '0'); } catch { /* no es crítico */ }
  };
  return (
    <div data-plegable={id}>
      <button type="button" onClick={cambiar} aria-expanded={abierto}
        className={`sk-foco group flex w-full items-center gap-3 rounded-3xl border bg-card px-5 py-4 text-left shadow-soft transition-colors hover:border-brand/50 ${abierto ? 'border-brand/40' : 'border-line'}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-elevated text-xl" aria-hidden>{emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-fg">{titulo}{cuenta !== null && <span className="ml-2 rounded-full bg-elevated px-2 py-0.5 text-[11px] font-bold text-muted">{cuenta}</span>}</span>
          {sub && <span className="mt-0.5 block text-xs text-muted">{sub}</span>}
        </span>
        <span className="hidden shrink-0 text-xs font-bold text-muted group-hover:text-fg sm:inline">{abierto ? t('dashboard.plegable.ocultar') : t('dashboard.plegable.ver')}</span>
        <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {/* Siempre montado (oculto si está plegado): así el buscador de ajustes lo encuentra y lo abre. */}
      <div data-plegable-cuerpo hidden={!abierto} className="mt-3 space-y-5">{children}</div>
    </div>
  );
}
