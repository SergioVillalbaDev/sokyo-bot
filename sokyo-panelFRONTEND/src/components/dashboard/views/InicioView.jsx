// Vista de Inicio (overview) — estilo "soft dashboard" adaptado al bot de Discord.
// Izquierda: widgets del bot (equipo, actividad, tickets recientes).
// Derecha: gauges de memoria del plan y otras estadísticas.
import { motion } from 'framer-motion';
import { Ticket, Inbox, Activity, Users2, ArrowRight, HardDrive, ScrollText, Smile, ChevronRight } from 'lucide-react';
import { Avatar, Badge } from '../../ui/primitives';
import { CircularGauge } from '../../ui/CircularGauge';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';

export default function InicioView({ dash }) {
  const {
    ticketsReales, logsRegistrados, limiteLogs, usoStats, esPremium,
    getColorUrgencia, verMensajes, setActiveTab,
  } = dash;

  // --- Métricas derivadas ---
  const total = ticketsReales.length;
  const abiertos = ticketsReales.filter((t) => t.estado !== 'Cerrado').length;
  const cerrados = total - abiertos;

  const valorados = ticketsReales.filter((t) => t.valoracionCSAT);
  const csatMedio = valorados.length ? valorados.reduce((a, t) => a + t.valoracionCSAT, 0) / valorados.length : 0;
  const csatPct = Math.round((csatMedio / 5) * 100);

  const logsPct = limiteLogs ? Math.min(100, Math.round((logsRegistrados.length / limiteLogs) * 100)) : 0;
  const memoria = usoStats?.memoria || { porcentaje: 0, usadoMB: 0, cuotaMB: esPremium ? 5120 : 512 };

  // Equipo de soporte (staff que ha participado / reclamado)
  const staff = [];
  const visto = new Set();
  ticketsReales.forEach((t) => {
    (t.participantes || []).forEach((p) => {
      if (p.rol === 'Staff' && p.id && !visto.has(p.id)) { visto.add(p.id); staff.push(p); }
    });
    if (t.asignadoNombre && !visto.has(t.asignadoNombre)) {
      visto.add(t.asignadoNombre);
      staff.push({ id: t.asignadoNombre, username: t.asignadoNombre, avatar: null, rol: 'Agente' });
    }
  });

  const recientes = ticketsReales.slice(0, 5);
  const actividad = logsRegistrados.slice(0, 5);

  const abrirTicket = (ticket) => { setActiveTab('tickets-gestion'); verMensajes(ticket); };

  const quickStats = [
    { label: 'Tickets totales', value: total, icon: Ticket, color: 'var(--accent-color)' },
    { label: 'Abiertos', value: abiertos, icon: Inbox, color: 'var(--danger)' },
    { label: 'Cerrados', value: cerrados, icon: Activity, color: 'var(--success)' },
    { label: 'Agentes', value: staff.length, icon: Users2, color: 'var(--warning)' },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
      {/* ===================== COLUMNA PRINCIPAL ===================== */}
      <div className="space-y-5">
        {/* Tarjetas rápidas */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {quickStats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-3xl border border-line bg-card p-4 shadow-soft"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${s.color}1f`, color: s.color }}>
                <s.icon size={18} />
              </span>
              <p className="mt-3 text-2xl font-extrabold text-fg">{s.value}</p>
              <p className="text-xs text-muted">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Equipo de soporte */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-fg"><Users2 size={18} className="text-brand" /> Equipo de soporte</h3>
            <button onClick={() => setActiveTab('tickets-usuarios')} className="flex items-center gap-1 text-xs font-semibold text-muted transition-colors hover:text-fg">
              Ver usuarios <ChevronRight size={13} />
            </button>
          </div>
          {staff.length === 0 ? (
            <p className="py-4 text-center text-sm italic text-muted">Aún no hay agentes asignados a tickets.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {staff.slice(0, 8).map((p, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-2xl border border-line bg-bg px-3 py-2">
                  <Avatar src={p.avatar} name={p.username} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">{p.username}</p>
                    <p className="text-[11px] text-muted">{p.rol || 'Agente'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tickets recientes */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-fg"><Ticket size={18} className="text-brand" /> Tickets recientes</h3>
            <button onClick={() => setActiveTab('tickets-gestion')} className="flex items-center gap-1 text-xs font-semibold text-muted transition-colors hover:text-fg">
              Ver todos <ChevronRight size={13} />
            </button>
          </div>
          {recientes.length === 0 ? (
            <p className="py-4 text-center text-sm italic text-muted">No hay tickets todavía.</p>
          ) : (
            <div className="space-y-2.5">
              {recientes.map((t, i) => {
                const color = getColorUrgencia(t.prioridad);
                return (
                  <button
                    key={t.canalId || i}
                    onClick={() => abrirTicket(t)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-bg p-3 text-left transition-colors hover:border-brand/40"
                    style={{ borderLeft: `4px solid ${color}` }}
                  >
                    <Avatar src={t.creadorAvatar} name={t.creadorNombre} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fg">{t.titulo || t.motivo || 'Ticket'}</p>
                      <p className="truncate text-xs text-muted">{t.creadorNombre} · {t.motivo}</p>
                    </div>
                    <Badge color={t.estado === 'Cerrado' ? 'var(--danger)' : 'var(--success)'}>{t.estado}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actividad reciente */}
        <div className={card}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-fg"><Activity size={18} className="text-brand" /> Actividad reciente</h3>
            <button onClick={() => setActiveTab('logs-todos')} className="flex items-center gap-1 text-xs font-semibold text-muted transition-colors hover:text-fg">
              Ver logs <ChevronRight size={13} />
            </button>
          </div>
          {actividad.length === 0 ? (
            <p className="py-4 text-center text-sm italic text-muted">Sin eventos registrados.</p>
          ) : (
            <div className="space-y-2">
              {actividad.map((log, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: log.color || '#888' }} />
                  <span className="flex-1 truncate text-sm text-fg">{log.accion} · <span className="text-muted">{log.usuario}</span></span>
                  <span className="shrink-0 text-xs text-muted">{new Date(log.fecha).toLocaleDateString('es-ES')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===================== RAIL DERECHO: MEMORIA / STATS ===================== */}
      <div className="space-y-4">
        {/* Memoria del plan */}
        <div className={`${card} flex flex-col items-center text-center`}>
          <div className="mb-1 flex w-full items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-fg"><HardDrive size={15} className="text-brand" /> Memoria del plan</h3>
            <Badge color={esPremium ? 'var(--warning)' : undefined}>{usoStats?.plan || (esPremium ? 'Premium' : 'Free')}</Badge>
          </div>
          <div className="my-3">
            <CircularGauge value={memoria.porcentaje} color="var(--accent-color)">
              <span className="text-2xl font-extrabold text-fg">{memoria.porcentaje}%</span>
              <span className="text-[11px] text-muted">usado</span>
            </CircularGauge>
          </div>
          <p className="text-xs text-muted">
            <strong className="text-fg">{memoria.usadoMB}</strong> MB de <strong className="text-fg">{memoria.cuotaMB}</strong> MB
          </p>
        </div>

        {/* Capacidad de logs */}
        <div className={`${card} flex flex-col items-center text-center`}>
          <h3 className="mb-1 flex w-full items-center gap-1.5 text-sm font-bold text-fg"><ScrollText size={15} className="text-emerald-400" /> Capacidad de Logs</h3>
          <div className="my-3">
            <CircularGauge value={logsPct} color="#34d399">
              <span className="text-2xl font-extrabold text-fg">{logsRegistrados.length}</span>
              <span className="text-[11px] text-muted">de {limiteLogs}</span>
            </CircularGauge>
          </div>
          <p className="text-xs text-muted">Registros de auditoría almacenados</p>
        </div>

        {/* Satisfacción CSAT */}
        <div className={`${card} flex flex-col items-center text-center`}>
          <h3 className="mb-1 flex w-full items-center gap-1.5 text-sm font-bold text-fg"><Smile size={15} className="text-amber-400" /> Satisfacción</h3>
          <div className="my-3">
            <CircularGauge value={csatPct} color="#fbbf24">
              <span className="text-2xl font-extrabold text-fg">{csatMedio ? csatMedio.toFixed(1) : '–'}</span>
              <span className="text-[11px] text-muted">/ 5.0</span>
            </CircularGauge>
          </div>
          <button onClick={() => setActiveTab('tickets-usuarios')} className="flex items-center gap-1 text-xs font-semibold text-brand transition-opacity hover:opacity-80">
            Ver más <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
