// Vista de ajustes de incidencias — niveles de urgencia (SLA) y categorías.
import { useTranslation } from 'react-i18next';
import { Save, X, Plus, Gauge, Tags } from 'lucide-react';
import { Card } from '../../ui/primitives';

export default function IncidentsView({ dash }) {
  const { t } = useTranslation();
  const {
    configServidor, urgencias, nuevaUrgNombre, setNuevaUrgNombre,
    nuevaUrgColor, setNuevaUrgColor, nuevaUrgNivel, setNuevaUrgNivel,
    agregarUrgencia, eliminarUrgencia,
    motivos, nuevoMotivo, setNuevoMotivo, nuevaUrgencia, setNuevaUrgencia,
    agregarMotivo, eliminarMotivo, getColorUrgencia, guardarCambiosConfig,
  } = dash;

  if (!configServidor) {
    return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  }

  const smallInput = 'rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/40';
  const urgenciasOrdenadas = [...urgencias].sort((a, b) => b.nivel - a.nivel);

  return (
    <div className="flex flex-col gap-6">
      <Card data-help="incidents-guardar" className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-fg">{t('dashboard.incidents_v.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('dashboard.incidents_v.subtitle')}</p>
        </div>
        <button
          onClick={guardarCambiosConfig}
          className="flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-on-brand glow-brand transition-transform hover:scale-[1.03]"
        >
          <Save size={16} /> {t('dashboard.incidents_v.save')}
        </button>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Niveles de urgencia */}
        <Card data-help="incidents-urgencias" className="flex flex-col p-6">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-fg"><Gauge size={18} className="text-brand" /> {t('dashboard.incidents_v.sla')}</h3>

          <ul className="mb-5 flex max-h-[340px] flex-col gap-2.5 overflow-y-auto">
            {urgenciasOrdenadas.map((u, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-xl bg-bg px-4 py-3"
                style={{ border: `1px solid ${u.color}40`, borderLeft: `4px solid ${u.color}` }}
              >
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: u.color, boxShadow: `0 0 8px ${u.color}` }} />
                  <strong className="text-fg">{u.nombre}</strong>
                  <span className="rounded-full border border-line bg-card px-2 py-0.5 text-xs text-muted">{t('dashboard.incidents_v.level', { n: u.nivel })}</span>
                </div>
                <button onClick={() => eliminarUrgencia(u.nombre)} className="text-muted transition-colors hover:text-danger">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-line bg-bg p-4">
            <input type="color" value={nuevaUrgColor} onChange={(e) => setNuevaUrgColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
            <input type="text" value={nuevaUrgNombre} onChange={(e) => setNuevaUrgNombre(e.target.value)} placeholder={t('dashboard.incidents_v.urgPlaceholder')} className={`${smallInput} min-w-[120px] flex-1`} />
            <input type="number" value={nuevaUrgNivel} onChange={(e) => setNuevaUrgNivel(e.target.value)} min="1" max="1000" className={`${smallInput} w-20`} />
            <button onClick={agregarUrgencia} className="flex items-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2.5 text-sm font-bold text-on-brand transition-transform hover:scale-[1.03]">
              <Plus size={15} /> {t('dashboard.incidents_v.add')}
            </button>
          </div>
        </Card>

        {/* Categorías del menú */}
        <Card data-help="incidents-categorias" className="flex flex-col p-6">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-fg"><Tags size={18} className="text-brand" /> {t('dashboard.incidents_v.categories')}</h3>

          <ul className="mb-5 flex max-h-[340px] flex-col gap-2.5 overflow-y-auto">
            {motivos.map((motivo, index) => {
              const nombre = typeof motivo === 'string' ? motivo : motivo.nombre;
              const urgencia = typeof motivo === 'string' ? 'Normal' : motivo.urgencia;
              const colorUrg = getColorUrgencia(urgencia);
              return (
                <li key={index} className="flex items-center justify-between rounded-xl border border-line bg-bg px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <strong className="text-fg">{nombre}</strong>
                    <span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: colorUrg }}>{urgencia}</span>
                  </div>
                  <button onClick={() => eliminarMotivo(motivo)} className="text-muted transition-colors hover:text-danger">
                    <X size={16} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-line bg-bg p-4">
            <input type="text" value={nuevoMotivo} onChange={(e) => setNuevoMotivo(e.target.value)} placeholder={t('dashboard.incidents_v.motivoPlaceholder')} className={`${smallInput} min-w-[150px] flex-1`} />
            <select value={nuevaUrgencia} onChange={(e) => setNuevaUrgencia(e.target.value)} className={`${smallInput} cursor-pointer`}>
              {urgencias.map((u, i) => (<option key={i} value={u.nombre}>{u.nombre}</option>))}
            </select>
            <button onClick={agregarMotivo} className="flex items-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2.5 text-sm font-bold text-on-brand transition-transform hover:scale-[1.03]">
              <Plus size={15} /> {t('dashboard.incidents_v.add')}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
