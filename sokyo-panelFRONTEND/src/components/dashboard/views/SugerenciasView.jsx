// Comunidad · Sugerencias — buzón de ideas de los miembros con votos y gestión de estado.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, ThumbsUp, ThumbsDown, Trash2, Info, Check, X, Clock, Eye } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

const ESTADO_CONFIG = {
  pendiente:  { color: 'text-muted bg-elevated', Icon: Clock },
  revision:   { color: 'text-warning bg-warning/10', Icon: Eye },
  aceptada:   { color: 'text-success bg-success/10', Icon: Check },
  rechazada:  { color: 'text-danger bg-danger/10', Icon: X },
};

const ESTADOS = Object.keys(ESTADO_CONFIG);

export default function SugerenciasView({ dash }) {
  const { t } = useTranslation();
  const { canales, configServidor, sugerencias = [], actualizarSugerencia, eliminarSugerencia, guardarConfigSugerencias } = dash;

  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [canalSugs, setCanalSugs] = useState('');
  const [modo, setModo] = useState('mensaje');
  const [plantilla, setPlantilla] = useState('');
  const [minLong, setMinLong] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (configServidor?.canalSugerencias) setCanalSugs(configServidor.canalSugerencias);
    if (configServidor?.sugerenciasModo) setModo(configServidor.sugerenciasModo);
    if (configServidor?.sugerenciasPlantilla) setPlantilla(configServidor.sugerenciasPlantilla);
    if (configServidor?.sugerenciasMinLong != null) setMinLong(configServidor.sugerenciasMinLong);
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const sugsOrdenadas = [...sugerencias].sort(
    (a, b) => (b.votos_pos - b.votos_neg) - (a.votos_pos - a.votos_neg),
  );
  const filtradas = filtroEstado === 'todos'
    ? sugsOrdenadas
    : sugsOrdenadas.filter((s) => s.estado === filtroEstado);

  const guardar = async () => {
    setGuardando(true);
    await guardarConfigSugerencias({
      canalSugerencias: canalSugs,
      sugerenciasModo: modo,
      sugerenciasPlantilla: plantilla,
      sugerenciasMinLong: Number(minLong) || 0,
    });
    setGuardadoOk(true);
    setGuardando(false);
    setTimeout(() => setGuardadoOk(false), 2500);
  };

  const cambiarEstado = (id, nuevoEstado) => actualizarSugerencia(id, { estado: nuevoEstado });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.sugerencias_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.sugerencias_v.note')}</p>
      </div>

      {/* Config canal */}
      <div data-help="sugerencias-config" className={card}>
        <h3 className="mb-3 font-bold text-fg">{t('dashboard.sugerencias_v.config')}</h3>
        <p className="mb-3 text-xs text-muted">{t('dashboard.sugerencias_v.configNote')}</p>
        <select value={canalSugs} onChange={(e) => setCanalSugs(e.target.value)} className={`${input} mb-3`}>
          <option value="">{t('dashboard.sugerencias_v.channelPh')}</option>
          {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        {/* Modo de envío */}
        <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.sugerencias_v.howSent')}</span>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setModo('mensaje')}
            className={`rounded-2xl border p-3 text-left transition-colors ${modo === 'mensaje' ? 'border-brand bg-brand/10' : 'border-line hover:border-brand/50'}`}>
            <p className="text-sm font-semibold text-fg">{t('dashboard.sugerencias_v.modeMessage')}</p>
            <p className="mt-0.5 text-xs text-muted">{t('dashboard.sugerencias_v.modeMessageDesc')}</p>
          </button>
          <button type="button" onClick={() => setModo('formulario')}
            className={`rounded-2xl border p-3 text-left transition-colors ${modo === 'formulario' ? 'border-brand bg-brand/10' : 'border-line hover:border-brand/50'}`}>
            <p className="text-sm font-semibold text-fg">{t('dashboard.sugerencias_v.modeForm')}</p>
            <p className="mt-0.5 text-xs text-muted">{t('dashboard.sugerencias_v.modeFormDesc')}</p>
          </button>
        </div>

        {modo === 'formulario' && (
          <label className="mb-3 block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.sugerencias_v.formTemplate')}</span>
            <textarea value={plantilla} onChange={(e) => setPlantilla(e.target.value)} rows={3} maxLength={1000}
              className={`${input} resize-none`} placeholder={'Example:\nWhat you propose: \nWhy it would help: '} />
            <span className="mt-1 block text-xs text-muted">{t('dashboard.sugerencias_v.formTemplateNote')}</span>
          </label>
        )}

        <label className="mb-3 block">
          <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.sugerencias_v.minLength')}</span>
          <input type="number" min={0} max={500} value={minLong} onChange={(e) => setMinLong(e.target.value)} className={input} placeholder={t('dashboard.sugerencias_v.minLengthPh')} />
        </label>

        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-4 py-2 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {guardando ? '...' : t('dashboard.sugerencias_v.save')}
        </button>
        {guardadoOk && <p className="mt-2 text-xs font-semibold text-success">{t('dashboard.sugerencias_v.savedOk')}</p>}
      </div>

      {/* Filtros de estado */}
      <div className="flex flex-wrap gap-2">
        {['todos', ...ESTADOS].map((est) => (
          <button
            key={est}
            type="button"
            onClick={() => setFiltroEstado(est)}
            className={`rounded-2xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filtroEstado === est
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-line bg-card text-muted hover:border-brand/50 hover:text-fg'
            }`}
          >
            {t(`dashboard.sugerencias_v.estados.${est}`)}
            {est !== 'todos' && (
              <span className="ml-1.5 opacity-60">
                ({sugerencias.filter((s) => s.estado === est).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div data-help="sugerencias-lista" className={card}>
        <h3 className="mb-3 font-bold text-fg">
          {t('dashboard.sugerencias_v.list')}
          <span className="ml-2 text-sm font-normal text-muted">({filtradas.length})</span>
        </h3>
        {filtradas.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-muted">{t('dashboard.sugerencias_v.empty')}</p>
        ) : (
          <div className="space-y-3">
            {filtradas.map((s) => {
              const neto = (s.votos_pos || 0) - (s.votos_neg || 0);
              const estadoCfg = ESTADO_CONFIG[s.estado] || ESTADO_CONFIG.pendiente;
              const { Icon: EstadoIcon, color } = estadoCfg;
              return (
                <div key={s._id} className="rounded-2xl border border-line bg-bg p-4">
                  <div className="flex items-start gap-4">
                    {/* Puntuación neta */}
                    <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5" style={{ minWidth: 36 }}>
                      <ThumbsUp size={13} className="text-success" />
                      <span className={`text-base font-bold leading-tight ${neto >= 0 ? 'text-success' : 'text-danger'}`}>
                        {neto >= 0 ? '+' : ''}{neto}
                      </span>
                      <ThumbsDown size={13} className="text-danger" />
                    </div>

                    {/* Contenido */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-fg">{s.texto}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
                          <EstadoIcon size={10} /> {t(`dashboard.sugerencias_v.estados.${s.estado}`)}
                        </span>
                        <span className="text-xs text-muted">
                          👍 {s.votos_pos || 0} · 👎 {s.votos_neg || 0}
                        </span>
                        {s.autor && <span className="text-xs text-muted">@{s.autor}</span>}
                      </div>

                      {/* Botones de acción */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {ESTADOS.filter((e) => e !== s.estado).map((est) => (
                          <button
                            key={est}
                            type="button"
                            onClick={() => cambiarEstado(s._id, est)}
                            className="rounded-lg border border-line px-2 py-1 text-xs text-muted transition-colors hover:border-brand hover:text-brand"
                          >
                            → {t(`dashboard.sugerencias_v.estados.${est}`)}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => eliminarSugerencia(s._id)}
                          className="ml-auto rounded-lg border border-line px-2 py-1 text-xs text-muted transition-colors hover:text-danger"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
