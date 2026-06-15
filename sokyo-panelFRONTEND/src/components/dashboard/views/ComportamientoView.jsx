// Vista de Comportamiento — interruptores de funciones opcionales del bot.
// Los cambios se guardan automáticamente (auto-save por interruptor).
import { useTranslation } from 'react-i18next';
import { Star, FileText, MessageSquareWarning, BellRing, ScrollText, Info } from 'lucide-react';
import { Card, Toggle } from '../../ui/primitives';

const LOG_ROWS = [
  { k: 'tickets', titleKey: 'logTickets', descKey: 'logTicketsDesc' },
  { k: 'entradas', titleKey: 'logEntradas', descKey: 'logEntradasDesc' },
  { k: 'salidas', titleKey: 'logSalidas', descKey: 'logSalidasDesc' },
  { k: 'mensajesBorrados', titleKey: 'logBorrados', descKey: 'logBorradosDesc' },
  { k: 'mensajesEditados', titleKey: 'logEditados', descKey: 'logEditadosDesc' },
];

// Fila con interruptor (definida a nivel de módulo, no dentro del render).
function Row({ icon: Icon, title, desc, checked, onChange, accent = 'text-brand' }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 ${accent}`}><Icon size={18} /></span>
        <div>
          <p className="text-sm font-semibold text-fg">{title}</p>
          <p className="text-xs text-muted">{desc}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export default function ComportamientoView({ dash }) {
  const { t } = useTranslation();
  const { configServidor, roles, guardarComportamiento } = dash;

  if (!configServidor) {
    return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  }
  const b = (k) => t(`dashboard.behavior_v.${k}`);

  const c = configServidor;
  const logs = c.logsActivos || {};
  // Lee un booleano con valor por defecto (igual que el modelo).
  const val = (v, def = true) => (v === undefined || v === null ? def : v);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      {/* Aviso de autoguardado */}
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-xs text-muted shadow-soft">
        <Info size={15} className="text-brand" /> {b('autosave')}
      </div>

      {/* Tickets */}
      <Card className="p-6 shadow-soft">
        <h3 className="mb-1 font-bold text-fg">{b('onClose')}</h3>
        <div className="divide-y divide-line">
          <Row
            icon={Star} accent="text-amber-400"
            title={b('csat')} desc={b('csatDesc')}
            checked={val(c.ratingActivo)}
            onChange={(v) => guardarComportamiento({ ratingActivo: v })}
          />
          <Row
            icon={FileText} accent="text-emerald-400"
            title={b('transcript')} desc={b('transcriptDesc')}
            checked={val(c.enviarTranscript)}
            onChange={(v) => guardarComportamiento({ enviarTranscript: v })}
          />
          <Row
            icon={MessageSquareWarning} accent="text-brand"
            title={b('closeNotice')} desc={b('closeNoticeDesc')}
            checked={val(c.avisoCierreCanal)}
            onChange={(v) => guardarComportamiento({ avisoCierreCanal: v })}
          />
        </div>
      </Card>

      {/* Notificaciones */}
      <Card className="p-6 shadow-soft">
        <h3 className="mb-1 font-bold text-fg">{b('notifications')}</h3>
        <div className="divide-y divide-line">
          <Row
            icon={BellRing} accent="text-brand"
            title={b('pingTeam')} desc={b('pingTeamDesc')}
            checked={val(c.pingSoporte, false)}
            onChange={(v) => guardarComportamiento({ pingSoporte: v })}
          />
          {val(c.pingSoporte, false) && (
            <div className="flex items-center justify-between gap-4 py-3.5">
              <p className="text-sm text-muted">{b('roleToMention')}</p>
              <select
                value={c.rolSoporteId || ''}
                onChange={(e) => guardarComportamiento({ rolSoporteId: e.target.value || null })}
                className="min-w-[180px] rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/40"
              >
                <option value="">{b('selectRole')}</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {val(c.pingSoporte, false) && roles.length === 0 && (
          <p className="mt-2 text-xs italic text-muted">{b('noRoles')}</p>
        )}
      </Card>

      {/* Logs */}
      <Card className="p-6 shadow-soft">
        <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><ScrollText size={18} className="text-brand" /> {b('logsTitle')}</h3>
        <p className="mb-2 text-xs text-muted">{b('logsSub')}</p>
        <div className="divide-y divide-line">
          {LOG_ROWS.map((it) => (
            <Row
              key={it.k} icon={ScrollText} accent="text-muted"
              title={b(it.titleKey)} desc={b(it.descKey)}
              checked={val(logs[it.k])}
              onChange={(v) => guardarComportamiento({ logsActivos: { [it.k]: v } })}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
