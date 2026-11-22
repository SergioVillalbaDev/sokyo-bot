// 1.30.0: el oro, el diario y la tienda son de cada servidor. Este selector elige de cuál.
import { useTranslation } from 'react-i18next';
import { fmtNum } from './portalUtils';

export default function SelectorServidorOro({ servidores = [], valor, onCambiar, className = '' }) {
  const { t, i18n } = useTranslation();
  if (!servidores.length) return <p className={`text-xs text-muted ${className}`}>{t('portal.server.none')}</p>;
  return (
    <label className={`flex items-center gap-2 text-xs text-muted ${className}`}>
      <span className="shrink-0 font-semibold">{t('portal.server.label')}</span>
      <select value={valor || ''} onChange={(e) => onCambiar?.(e.target.value)} aria-label={t('portal.server.label')}
        className="min-w-0 flex-1 truncate rounded-xl border border-line bg-[rgb(var(--gx-tinta)/.04)] px-2.5 py-1.5 text-sm font-semibold text-fg outline-none focus:border-brand">
        {servidores.map((s) => <option key={s.id} value={s.id}>{s.nombre} · 🪙 {fmtNum(s.oro, i18n.language)}</option>)}
      </select>
    </label>
  );
}
