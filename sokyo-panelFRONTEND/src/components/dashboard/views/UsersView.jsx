// Vista de registro de usuarios — tabla de estadísticas.
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { Avatar, Stars, Card } from '../../ui/primitives';

export default function UsersView({ dash }) {
  const { t } = useTranslation();
  const { usuariosStats } = dash;

  if (usuariosStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-24 text-center">
        <Users size={48} className="text-muted/50" />
        <p className="mt-4 text-lg font-semibold text-fg">{t('dashboard.users_v.empty')}</p>
        <p className="mt-1 text-sm text-muted">{t('dashboard.users_v.emptyDesc')}</p>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-bg text-xs uppercase tracking-wide text-muted">
              <th className="px-6 py-4 font-semibold">{t('dashboard.users_v.user')}</th>
              <th className="px-6 py-4 font-semibold">{t('dashboard.users_v.total')}</th>
              <th className="px-6 py-4 font-semibold">{t('dashboard.users_v.open')}</th>
              <th className="px-6 py-4 font-semibold">{t('dashboard.users_v.rating')}</th>
              <th className="px-6 py-4 font-semibold">{t('dashboard.users_v.lastActivity')}</th>
            </tr>
          </thead>
          <tbody>
            {usuariosStats.map((user, index) => (
              <motion.tr
                key={user._id || index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
                className="border-b border-line transition-colors last:border-0 hover:bg-elevated/50"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={user.avatar} name={user.nombre} size={34} />
                    <strong className="text-fg">{user.nombre}</strong>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full border border-line bg-bg px-2.5 py-1 text-xs font-semibold text-fg">
                    {user.totalTickets}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {user.ticketsAbiertos > 0 ? (
                    <span className="font-semibold text-danger">{t('dashboard.users_v.openCount', { count: user.ticketsAbiertos })}</span>
                  ) : (
                    <span className="text-ok">{t('dashboard.users_v.allClosed')}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Stars value={Math.round(user.ratingMedio || 0)} size={14} />
                    <span className={`text-sm font-bold ${user.ratingMedio ? 'text-amber-400' : 'text-muted'}`}>
                      {user.ratingMedio ? user.ratingMedio.toFixed(1) : '0.0'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-muted">
                  {user.ultimoTicket ? new Date(user.ultimoTicket).toLocaleDateString() : t('dashboard.users_v.unknown')}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
