// Vista de logs — timeline con filtro por "pills" e indicador de capacidad del plan.
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Inbox, Crown, ScrollText } from 'lucide-react';
import { Card, Toggle } from '../../ui/primitives';
import { cn } from '../../../lib/cn';

const pills = [
  { tab: 'logs-todos', key: 'todos' },
  { tab: 'logs-tickets', key: 'tickets' },
  { tab: 'logs-borrados', key: 'borrados' },
  { tab: 'logs-editados', key: 'editados' },
  { tab: 'logs-entradas', key: 'entradas' },
  { tab: 'logs-salidas', key: 'salidas' },
];

// Qué eventos registra el bot (antes vivía en "Comportamiento").
const LOG_ROWS = [
  { k: 'tickets', titleKey: 'logTickets', descKey: 'logTicketsDesc' },
  { k: 'entradas', titleKey: 'logEntradas', descKey: 'logEntradasDesc' },
  { k: 'salidas', titleKey: 'logSalidas', descKey: 'logSalidasDesc' },
  { k: 'mensajesBorrados', titleKey: 'logBorrados', descKey: 'logBorradosDesc' },
  { k: 'mensajesEditados', titleKey: 'logEditados', descKey: 'logEditadosDesc' },
];

// Panel de ajustes de logs (qué se registra). Vive en la propia categoría Logs.
function AjustesLogs({ dash }) {
  const { t } = useTranslation();
  const { configServidor, guardarComportamiento } = dash;
  if (!configServidor) return null;
  const b = (k) => t(`dashboard.behavior_v.${k}`);
  const logsActivos = configServidor.logsActivos || {};
  const val = (v, def = true) => (v === undefined || v === null ? def : v);

  return (
    <Card className="mb-6 p-6 shadow-soft">
      <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><ScrollText size={18} className="text-brand" /> {b('logsTitle')}</h3>
      <p className="mb-2 text-xs text-muted">{b('logsSub')}</p>
      <div className="divide-y divide-line">
        {LOG_ROWS.map((it) => (
          <div key={it.k} className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-muted"><ScrollText size={18} /></span>
              <div>
                <p className="text-sm font-semibold text-fg">{b(it.titleKey)}</p>
                <p className="text-xs text-muted">{b(it.descKey)}</p>
              </div>
            </div>
            <Toggle checked={val(logsActivos[it.k])} onChange={(v) => guardarComportamiento({ logsActivos: { [it.k]: v } })} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function LogsView({ dash }) {
  const { t } = useTranslation();
  const { obtenerLogsFiltrados, logsRegistrados, limiteLogs, esPremium, activeTab, setActiveTab } = dash;
  const logs = obtenerLogsFiltrados();
  const pct = Math.min(100, Math.round((logsRegistrados.length / limiteLogs) * 100));

  return (
    <>
    {activeTab === 'logs-todos' && <AjustesLogs dash={dash} />}
    <Card className="p-6">
      {/* Cabecera con capacidad del plan */}
      <div data-help="logs-capacidad" className="flex flex-col items-start justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-fg">{t('dashboard.logs_v.title')}</h2>
          <p className="mt-0.5 text-sm text-muted">{t('dashboard.logs_v.subtitle')}</p>
        </div>

        <div className="w-full sm:w-64">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted">{t('dashboard.logs_v.capacity')} <strong className="text-fg">{logsRegistrados.length} / {limiteLogs}</strong></span>
            {esPremium ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-400">
                <Crown size={12} /> {t('dashboard.plan.premiumShort')}
              </span>
            ) : (
              <span className="rounded-full bg-elevated px-2 py-0.5 text-xs font-semibold text-muted">{t('dashboard.plan.freeShort')}</span>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={cn('h-full rounded-full', esPremium ? 'bg-amber-400' : 'bg-gradient-brand')}
            />
          </div>
        </div>
      </div>

      {/* Pills de filtrado */}
      <div data-help="logs-filtros" className="flex flex-wrap gap-2 py-5">
        {pills.map((p) => {
          const active = activeTab === p.tab;
          return (
            <button
              key={p.tab}
              onClick={() => setActiveTab(p.tab)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                active ? 'bg-gradient-brand text-on-brand shadow-md shadow-brand/20' : 'border border-line bg-bg text-muted hover:text-fg'
              )}
            >
              {t(`dashboard.logs_v.pills.${p.key}`)}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox size={44} className="text-muted/50" />
          <p className="mt-3 text-sm text-muted">{t('dashboard.logs_v.empty')}</p>
        </div>
      ) : (
        <div data-help="logs-timeline" className="relative ml-2 border-l-2 border-line pl-6">
          {logs.map((log, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.4) }}
              className="relative mb-4 last:mb-0"
            >
              {/* Punto del timeline */}
              <span
                className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-bg"
                style={{ backgroundColor: log.color || '#3498db' }}
              />
              <div className="rounded-xl border border-line bg-bg p-4" style={{ borderLeft: `3px solid ${log.color || '#3498db'}` }}>
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-[0.95rem]" style={{ color: log.color || 'var(--text-primary)' }}>{log.accion}</strong>
                  <span className="shrink-0 text-xs text-muted">{new Date(log.fecha).toLocaleString('es-ES')}</span>
                </div>
                <div className="mt-1 text-sm text-fg">👤 {t('dashboard.logs_v.involvedUser')} <strong>{log.usuario}</strong></div>
                {log.detalles && (
                  <div className="mt-2 whitespace-pre-wrap rounded-lg bg-card px-3 py-2 text-sm italic text-muted">{log.detalles}</div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
    </>
  );
}
