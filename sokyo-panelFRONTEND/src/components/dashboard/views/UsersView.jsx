// Vista de registro de usuarios — tabla de estadísticas.
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { Avatar, Stars, Card } from '../../ui/primitives';

export default function UsersView({ dash }) {
  const { usuariosStats } = dash;

  if (usuariosStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-24 text-center">
        <Users size={48} className="text-muted/50" />
        <p className="mt-4 text-lg font-semibold text-fg">Sin datos de usuarios</p>
        <p className="mt-1 text-sm text-muted">Aún no hay actividad registrada en tu servidor.</p>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-bg text-xs uppercase tracking-wide text-muted">
              <th className="px-6 py-4 font-semibold">Usuario</th>
              <th className="px-6 py-4 font-semibold">Total Tickets</th>
              <th className="px-6 py-4 font-semibold">Abiertos</th>
              <th className="px-6 py-4 font-semibold">Rating Medio</th>
              <th className="px-6 py-4 font-semibold">Última Actividad</th>
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
                    <span className="font-semibold text-danger">{user.ticketsAbiertos} abierto(s)</span>
                  ) : (
                    <span className="text-ok">Todo cerrado</span>
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
                  {user.ultimoTicket ? new Date(user.ultimoTicket).toLocaleDateString() : 'Desconocida'}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
