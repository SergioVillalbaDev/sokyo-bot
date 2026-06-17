// Vista de gestión de tickets — grid avanzado de tarjetas tipo Kanban.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Lock, Unlock, EyeOff, ShieldCheck, Tag, Inbox } from 'lucide-react';
import { Avatar, Badge, Stars, Card } from '../../ui/primitives';
import { cn } from '../../../lib/cn';

export default function TicketsView({ dash }) {
  const { t } = useTranslation();
  const {
    getTicketsOrdenados, getColorUrgencia, verMensajes,
    handleCerrarTicket, handleReabrirTicket, handleOcultarTicket, query,
  } = dash;

  const [tagFiltro, setTagFiltro] = useState(null);

  const q = (query || '').trim().toLowerCase();
  const ordenados = getTicketsOrdenados().filter((t) =>
    !q ||
    (t.titulo || '').toLowerCase().includes(q) ||
    (t.motivo || '').toLowerCase().includes(q) ||
    (t.creadorNombre || '').toLowerCase().includes(q)
  );

  // Todas las etiquetas existentes (para la barra de filtro)
  const allTags = [...new Set(ordenados.flatMap((tk) => tk.etiquetas || []))];
  const tickets = tagFiltro ? ordenados.filter((tk) => (tk.etiquetas || []).includes(tagFiltro)) : ordenados;

  return (
    <div className="flex flex-col gap-5">
      {/* Barra de filtro por etiqueta */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTagFiltro(null)}
            className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              !tagFiltro ? 'bg-gradient-brand text-on-brand' : 'border border-line bg-card text-muted hover:text-fg')}
          >
            <Tag size={12} /> {t('dashboard.tickets_v.allTags')}
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFiltro(tag)}
              className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                tagFiltro === tag ? 'bg-gradient-brand text-on-brand' : 'border border-line bg-card text-muted hover:text-fg')}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-24 text-center">
          <Inbox size={48} className="text-muted/50" />
          <p className="mt-4 text-lg font-semibold text-fg">{t('dashboard.tickets_v.empty')}</p>
          <p className="mt-1 text-sm text-muted">{t('dashboard.tickets_v.emptyDesc')}</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {tickets.map((ticket, index) => {
        const color = getColorUrgencia(ticket.prioridad);
        const cerrado = ticket.estado === 'Cerrado';
        return (
          <motion.div
            key={ticket.canalId || index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
          >
            <Card className="group relative flex h-full flex-col overflow-hidden p-5 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20">
              {/* Franja de color de urgencia */}
              <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />

              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold leading-tight text-fg">
                  {ticket.titulo || ticket.motivo || 'Ticket de Soporte'}
                </h3>
                <Badge color={color}>{ticket.prioridad || 'Normal'}</Badge>
              </div>

              {/* Creador + motivo */}
              <div className="mt-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Avatar src={ticket.creadorAvatar} name={ticket.creadorNombre} size={22} />
                  <span className="font-semibold text-fg">{ticket.creadorNombre}</span>
                </div>
                <span className="flex items-center gap-1 text-xs italic text-muted">
                  <Tag size={12} /> {ticket.motivo}
                </span>
              </div>

              {/* Asignación */}
              <div className="mt-3 flex items-center gap-1.5 border-b border-dashed border-line pb-3 text-xs text-muted">
                <ShieldCheck size={13} /> {t('dashboard.tickets_v.attendedBy')}{' '}
                {ticket.asignadoNombre
                  ? <span className="font-semibold text-brand">{ticket.asignadoNombre}</span>
                  : <span className="italic opacity-70">{t('dashboard.tickets_v.unclaimed')}</span>}
              </div>

              {ticket.etiquetas && ticket.etiquetas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ticket.etiquetas.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand">
                      <Tag size={10} /> {tag}
                    </span>
                  ))}
                </div>
              )}

              {ticket.descripcion && (
                <p
                  className="mt-3 rounded-lg bg-bg px-3 py-2 text-sm italic text-muted"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  "{ticket.descripcion.substring(0, 60)}..."
                </p>
              )}

              {cerrado && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
                  <span className="text-xs font-bold text-amber-400">{t('dashboard.tickets_v.rating')}</span>
                  <Stars value={ticket.valoracionCSAT} />
                </div>
              )}

              {/* Acciones */}
              <div className="mt-auto flex flex-col gap-2 pt-4">
                <button
                  onClick={() => verMensajes(ticket)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-brand py-2 text-sm font-semibold text-on-brand transition-transform hover:scale-[1.02]"
                >
                  <MessageSquare size={15} /> {t('dashboard.tickets_v.view')}
                </button>
                <div className="flex gap-2">
                  {!cerrado ? (
                    <button
                      onClick={(e) => handleCerrarTicket(ticket.canalId, e)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-danger/15 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/25"
                    >
                      <Lock size={14} /> {t('dashboard.tickets_v.close')}
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleReabrirTicket(ticket.canalId, e)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ok/15 py-2 text-sm font-semibold text-ok transition-colors hover:bg-ok/25"
                    >
                      <Unlock size={14} /> {t('dashboard.tickets_v.reopen')}
                    </button>
                  )}
                  <button
                    onClick={(e) => handleOcultarTicket(ticket.canalId, e)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-elevated py-2 text-sm font-semibold text-muted transition-colors hover:text-fg"
                  >
                    <EyeOff size={14} /> {t('dashboard.tickets_v.hide')}
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
      </div>
      )}
    </div>
  );
}
