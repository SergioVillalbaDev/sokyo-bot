// Comunidad · Encuestas — crea y gestiona votaciones en Discord con resultados en tiempo real.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart2, Trash2, Info, Plus, X, CheckSquare, EyeOff, Clock, Users } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

function minLocal() {
  const d = new Date(Date.now() + 60000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function tiempoRestante(fechaFin) {
  const diff = new Date(fechaFin) - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function EncuestasView({ dash }) {
  const { t } = useTranslation();
  const { canales, encuestas = [], crearEncuesta, eliminarEncuesta } = dash;

  const [pregunta, setPregunta] = useState('');
  const [opciones, setOpciones] = useState(['', '']);
  const [canalId, setCanalId] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [multiple, setMultiple] = useState(false);
  const [anonima, setAnonima] = useState(false);
  const [estado, setEstado] = useState('');

  const activas = encuestas.filter((e) => e.activa);
  const cerradas = encuestas.filter((e) => !e.activa);

  const addOpcion = () => setOpciones((prev) => [...prev, '']);
  const removeOpcion = (i) => setOpciones((prev) => prev.filter((_, idx) => idx !== i));
  const setOpcion = (i, v) => setOpciones((prev) => prev.map((o, idx) => (idx === i ? v : o)));

  const crear = async () => {
    setEstado('creando');
    const opsFiltradas = opciones.filter((o) => o.trim());
    const r = await crearEncuesta({
      pregunta, opciones: opsFiltradas, canalId,
      fechaFin: new Date(fechaFin).toISOString(),
      multiple, anonima,
    });
    setEstado(r?.error ? `error:${r.error}` : 'ok');
    if (!r?.error) {
      setPregunta(''); setOpciones(['', '']); setCanalId(''); setFechaFin('');
      setMultiple(false); setAnonima(false);
    }
  };

  const totalVotos = (enc) => enc.opciones?.reduce((sum, o) => sum + (o.votos || 0), 0) || 0;
  const pct = (votos, total) => (total === 0 ? 0 : Math.round((votos / total) * 100));
  const nombreCanal = (id) => (canales.find((c) => c.id === id) || {}).nombre || id;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.encuestas_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.encuestas_v.note')}</p>
      </div>

      {/* Encuestas activas */}
      <div data-help="encuestas-activas" className={card}>
        <h3 className="mb-3 font-bold text-fg">{t('dashboard.encuestas_v.active')}</h3>
        {activas.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-muted">{t('dashboard.encuestas_v.emptyActive')}</p>
        ) : (
          <div className="space-y-4">
            {activas.map((enc) => {
              const total = totalVotos(enc);
              const restante = tiempoRestante(enc.fechaFin);
              return (
                <div key={enc._id} className="rounded-2xl border border-line bg-bg p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-fg">{enc.pregunta}</p>
                        <button
                          type="button"
                          onClick={() => eliminarEncuesta(enc._id)}
                          className="shrink-0 rounded-xl border border-line px-2.5 py-2 text-muted transition-colors hover:text-danger"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="text-xs text-muted">#{nombreCanal(enc.canalId)}</span>
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Users size={10} /> {total} {t('dashboard.encuestas_v.votes')}
                        </span>
                        {restante && (
                          <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                            <Clock size={10} /> {restante}
                          </span>
                        )}
                        {enc.multiple && (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                            {t('dashboard.encuestas_v.multipleChoice')}
                          </span>
                        )}
                        {enc.anonima && (
                          <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-muted">
                            <EyeOff size={9} className="inline mr-0.5" />{t('dashboard.encuestas_v.anonymous')}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 space-y-2">
                        {enc.opciones?.map((op, i) => (
                          <div key={i}>
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="text-fg">{op.texto}</span>
                              <span className="font-semibold text-brand">{pct(op.votos || 0, total)}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
                              <div
                                className="h-full rounded-full bg-gradient-brand transition-all duration-500"
                                style={{ width: `${pct(op.votos || 0, total)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cerradas */}
      {cerradas.length > 0 && (
        <div className={card}>
          <h3 className="mb-3 font-bold text-muted">{t('dashboard.encuestas_v.closed')}</h3>
          <div className="space-y-2">
            {cerradas.slice(0, 5).map((enc) => (
              <div key={enc._id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-muted">{enc.pregunta}</p>
                  <p className="text-xs text-muted/60">{totalVotos(enc)} {t('dashboard.encuestas_v.votes')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => eliminarEncuesta(enc._id)}
                  className="shrink-0 text-muted transition-colors hover:text-danger"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crear encuesta */}
      <div data-help="encuestas-crear" className={card}>
        <h3 className="mb-4 font-bold text-fg">{t('dashboard.encuestas_v.createTitle')}</h3>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.encuestas_v.question')}</span>
            <input
              value={pregunta}
              onChange={(e) => { setEstado(''); setPregunta(e.target.value); }}
              className={input}
              maxLength={200}
              placeholder={t('dashboard.encuestas_v.questionPh')}
            />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.encuestas_v.options')}</span>
            <div className="space-y-2">
              {opciones.map((op, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={op}
                    onChange={(e) => setOpcion(i, e.target.value)}
                    className={input}
                    placeholder={`${t('dashboard.encuestas_v.optionPh')} ${i + 1}`}
                    maxLength={100}
                  />
                  {opciones.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOpcion(i)}
                      className="shrink-0 rounded-xl border border-line px-2.5 text-muted transition-colors hover:text-danger"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              {opciones.length < 10 && (
                <button
                  type="button"
                  onClick={addOpcion}
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted transition-colors hover:border-brand hover:text-brand"
                >
                  <Plus size={14} /> {t('dashboard.encuestas_v.addOption')}
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.encuestas_v.channel')}</span>
              <select value={canalId} onChange={(e) => setCanalId(e.target.value)} className={input}>
                <option value="">{t('dashboard.encuestas_v.channelPh')}</option>
                {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.encuestas_v.endAt')}</span>
              <input
                type="datetime-local"
                value={fechaFin}
                min={minLocal()}
                onChange={(e) => setFechaFin(e.target.value)}
                className={input}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-5">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={multiple}
                onChange={(e) => setMultiple(e.target.checked)}
                className="h-4 w-4 rounded accent-brand"
              />
              <span className="flex items-center gap-1.5 text-sm text-fg">
                <CheckSquare size={14} className="text-brand" /> {t('dashboard.encuestas_v.multipleChoice')}
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={anonima}
                onChange={(e) => setAnonima(e.target.checked)}
                className="h-4 w-4 rounded accent-brand"
              />
              <span className="flex items-center gap-1.5 text-sm text-fg">
                <EyeOff size={14} className="text-brand" /> {t('dashboard.encuestas_v.anonymous')}
              </span>
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={crear}
            disabled={estado === 'creando' || !pregunta || opciones.filter((o) => o.trim()).length < 2 || !canalId || !fechaFin}
            className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BarChart2 size={16} />
            {estado === 'creando' ? t('dashboard.encuestas_v.creating') : t('dashboard.encuestas_v.create')}
          </button>
          {estado === 'ok' && <span className="text-sm font-semibold text-success">{t('dashboard.encuestas_v.createOk')}</span>}
          {estado.startsWith('error:') && <span className="text-sm font-semibold text-danger">{estado.slice(6)}</span>}
        </div>
      </div>
    </div>
  );
}
