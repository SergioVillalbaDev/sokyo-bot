// Distintivo dorado para las cuentas de DUEÑO (Discord ID dentro de OWNER_IDS).
// Se muestra solo si la sesión de staff tiene owner=true. En móvil se compacta
// al icono de corona; desde sm+ muestra el texto "Cuenta de Dueño".
import { useTranslation } from 'react-i18next';
import { Crown } from 'lucide-react';
import { getStaffSession } from '../../lib/api';

export default function OwnerBadge({ className = '' }) {
  const { t } = useTranslation();
  const session = getStaffSession();
  if (!session?.owner) return null;

  return (
    <span
      title={session.username ? `${t('dashboard.plan.ownerBadge')} · ${session.username}` : t('dashboard.plan.ownerBadge')}
      className={
        'group inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 ' +
        'bg-gradient-to-r from-amber-400/20 via-amber-300/10 to-amber-500/15 px-2.5 py-1.5 ' +
        'text-xs font-bold text-amber-400 shadow-[0_0_18px_-6px_rgba(251,191,36,0.6)] ' +
        className
      }
    >
      <Crown size={14} className="shrink-0 drop-shadow-[0_0_4px_rgba(251,191,36,0.7)]" />
      <span className="hidden whitespace-nowrap sm:inline">{t('dashboard.plan.ownerBadge')}</span>
    </span>
  );
}
