// Comunidad · Presentaciones — formulario de presentación para nuevos miembros
// con preguntas configurables y filtros automáticos de descarte.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Plus, Trash2, Info, Filter, Check, AlertTriangle, Bell, ChevronDown, ChevronUp } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';
const miniSelect = 'rounded-xl border border-line bg-bg px-2 py-1.5 text-xs text-fg focus:border-brand focus:outline-none';

const TIPOS = ['texto', 'numero', 'seleccion'];

// Operadores disponibles según el tipo de pregunta
const OPS_NUMERO = ['menor_que', 'mayor_que', 'igual_a'];
const OPS_TEXTO = ['contiene', 'no_contiene', 'igual_a'];

const PREGUNTAS_DEFECTO = [
  { id: 'nombre', texto: 'What’s your name or alias?', tipo: 'texto', requerida: true },
  { id: 'edad', texto: 'How old are you?', tipo: 'numero', requerida: true },
  { id: 'intereses', texto: 'What are you into, or why are you joining the server?', tipo: 'texto', requerida: false },
];

export default function PresentacionesView({ dash }) {
  const { t } = useTranslation();
  const { canales, configServidor, presentaciones = [], guardarConfigPresentaciones, eliminarPresentacion } = dash;

  const [canalIntro, setCanalIntro] = useState('');
  const [canalStaff, setCanalStaff] = useState('');
  const [modo, setModo] = useState('preguntas');
  const [plantilla, setPlantilla] = useState('Age: \nWhere you’re from: \nHobbies: \nWhy you’re joining: ');
  const [preguntas, setPreguntas] = useState(PREGUNTAS_DEFECTO);
  const [filtros, setFiltros] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [seccionAbierta, setSeccionAbierta] = useState('preguntas'); // 'preguntas' | 'filtros'

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (configServidor?.presentaciones) {
      const p = configServidor.presentaciones;
      if (p.canalIntro) setCanalIntro(p.canalIntro);
      if (p.canalStaff) setCanalStaff(p.canalStaff);
      if (p.modo) setModo(p.modo);
      if (p.plantilla) setPlantilla(p.plantilla);
      if (Array.isArray(p.preguntas) && p.preguntas.length) setPreguntas(p.preguntas);
      if (Array.isArray(p.filtros)) setFiltros(p.filtros);
    }
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // --- Preguntas ---
  const addPregunta = () => setPreguntas((prev) => [
    ...prev,
    { id: `p_${Date.now()}`, texto: '', tipo: 'texto', requerida: false },
  ]);
  const removePregunta = (id) => {
    setPreguntas((prev) => prev.filter((p) => p.id !== id));
    setFiltros((prev) => prev.filter((f) => f.campo !== id));
  };
  const updatePregunta = (id, key, val) =>
    setPreguntas((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: val } : p)));

  // --- Filtros ---
  const addFiltro = () => {
    if (preguntas.length === 0) return;
    setFiltros((prev) => [
      ...prev,
      {
        id: `f_${Date.now()}`,
        campo: preguntas[0].id,
        operador: preguntas[0].tipo === 'numero' ? 'menor_que' : 'contiene',
        valor: '',
        accion: 'descartar',
        avisarUsuario: true,
        mensajeAviso: '',
      },
    ]);
  };
  const removeFiltro = (id) => setFiltros((prev) => prev.filter((f) => f.id !== id));
  const updateFiltro = (id, key, val) =>
    setFiltros((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: val } : f)));

  const updateFiltroCampo = (id, nuevoCampo) => {
    const pregunta = preguntas.find((p) => p.id === nuevoCampo);
    const ops = pregunta?.tipo === 'numero' ? OPS_NUMERO : OPS_TEXTO;
    setFiltros((prev) => prev.map((f) =>
      f.id === id ? { ...f, campo: nuevoCampo, operador: ops[0] } : f,
    ));
  };

  const opsParaCampo = (campoId) => {
    const p = preguntas.find((pr) => pr.id === campoId);
    return p?.tipo === 'numero' ? OPS_NUMERO : OPS_TEXTO;
  };

  const guardar = async () => {
    setGuardando(true);
    await guardarConfigPresentaciones({ canalIntro, canalStaff, modo, plantilla, preguntas, filtros });
    setGuardadoOk(true);
    setGuardando(false);
    setTimeout(() => setGuardadoOk(false), 2500);
  };

  const pendientes = presentaciones.filter((p) => !p.procesada);
  const procesadas = presentaciones.filter((p) => p.procesada);

  const toggle = (s) => setSeccionAbierta((prev) => (prev === s ? null : s));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.presentaciones_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.presentaciones_v.note')}</p>
      </div>

      {/* Canales */}
      <div className={card}>
        <h3 className="mb-3 font-bold text-fg">{t('dashboard.presentaciones_v.channels')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.presentaciones_v.introChannel')}</span>
            <select value={canalIntro} onChange={(e) => setCanalIntro(e.target.value)} className={input}>
              <option value="">{t('dashboard.presentaciones_v.channelPh')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.presentaciones_v.staffChannel')}</span>
            <select value={canalStaff} onChange={(e) => setCanalStaff(e.target.value)} className={input}>
              <option value="">{t('dashboard.presentaciones_v.channelPh')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Modo de presentación */}
      <div className={card}>
        <h3 className="mb-3 font-bold text-fg">Formato de la presentación</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setModo('preguntas')}
            className={`rounded-2xl border p-3 text-left transition-colors ${modo === 'preguntas' ? 'border-brand bg-brand/10' : 'border-line hover:border-brand/50'}`}>
            <p className="text-sm font-semibold text-fg">📋 Preguntas sueltas</p>
            <p className="mt-0.5 text-xs text-muted">Un campo por cada pregunta (hasta 5 en el formulario).</p>
          </button>
          <button type="button" onClick={() => setModo('plantilla')}
            className={`rounded-2xl border p-3 text-left transition-colors ${modo === 'plantilla' ? 'border-brand bg-brand/10' : 'border-line hover:border-brand/50'}`}>
            <p className="text-sm font-semibold text-fg">📝 Plantilla rellenable</p>
            <p className="mt-0.5 text-xs text-muted">Un único texto con tu propio formato que el usuario completa.</p>
          </button>
        </div>
        {modo === 'plantilla' && (
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">Plantilla</span>
            <textarea value={plantilla} onChange={(e) => setPlantilla(e.target.value)} rows={5} maxLength={1500}
              className={`${input} resize-none font-mono`} placeholder={'Age: \nWhere you’re from: \nHobbies: '} />
            <span className="mt-1 block text-xs text-muted">Aparecerá prerellenada en el formulario. Los filtros de abajo se evalúan sobre todo el texto.</span>
          </label>
        )}
      </div>

      {/* Preguntas (acordeón) — solo en modo preguntas */}
      {modo === 'preguntas' && (
      <div className={card}>
        <button
          type="button"
          onClick={() => toggle('preguntas')}
          className="flex w-full items-center justify-between gap-3"
        >
          <div>
            <h3 className="font-bold text-fg text-left">{t('dashboard.presentaciones_v.questions')}</h3>
            <p className="mt-0.5 text-xs text-muted text-left">{preguntas.length} {t('dashboard.presentaciones_v.questionsCount')}</p>
          </div>
          {seccionAbierta === 'preguntas' ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
        </button>

        {seccionAbierta === 'preguntas' && (
          <div className="mt-4 space-y-3">
            {preguntas.map((p, i) => (
              <div key={p.id} className="rounded-2xl border border-line bg-bg p-3">
                <div className="flex gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-bold text-brand">
                    {i + 1}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      value={p.texto}
                      onChange={(e) => updatePregunta(p.id, 'texto', e.target.value)}
                      className={input}
                      placeholder={t('dashboard.presentaciones_v.questionPh')}
                      maxLength={200}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={p.tipo}
                        onChange={(e) => updatePregunta(p.id, 'tipo', e.target.value)}
                        className={miniSelect}
                      >
                        {TIPOS.map((tp) => (
                          <option key={tp} value={tp}>{t(`dashboard.presentaciones_v.tipos.${tp}`)}</option>
                        ))}
                      </select>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={p.requerida}
                          onChange={(e) => updatePregunta(p.id, 'requerida', e.target.checked)}
                          className="accent-brand"
                        />
                        {t('dashboard.presentaciones_v.required')}
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePregunta(p.id)}
                    className="shrink-0 text-muted transition-colors hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addPregunta}
              className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted transition-colors hover:border-brand hover:text-brand"
            >
              <Plus size={14} /> {t('dashboard.presentaciones_v.addQuestion')}
            </button>
          </div>
        )}
      </div>
      )}

      {/* Filtros automáticos (acordeón) */}
      <div className={`${card} ${filtros.length > 0 ? 'border-warning/40' : ''}`}>
        <button
          type="button"
          onClick={() => toggle('filtros')}
          className="flex w-full items-center justify-between gap-3"
        >
          <div>
            <h3 className="flex items-center gap-2 font-bold text-fg text-left">
              <Filter size={15} className="text-warning" />
              {t('dashboard.presentaciones_v.filtersTitle')}
            </h3>
            <p className="mt-0.5 text-xs text-muted text-left">{t('dashboard.presentaciones_v.filtersDesc')}</p>
          </div>
          <div className="flex items-center gap-2">
            {filtros.length > 0 && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-bold text-warning">
                {filtros.length}
              </span>
            )}
            {seccionAbierta === 'filtros' ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
          </div>
        </button>

        {seccionAbierta === 'filtros' && (
          <div className="mt-4 space-y-4">
            {filtros.length === 0 && (
              <p className="py-3 text-center text-sm italic text-muted">{t('dashboard.presentaciones_v.filtersEmpty')}</p>
            )}

            {filtros.map((f) => {
              const ops = opsParaCampo(f.campo);
              return (
                <div key={f.id} className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
                    <div className="flex-1 space-y-3">

                      {/* Condición: Si [campo] [operador] [valor] */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-fg">{t('dashboard.presentaciones_v.if')}</span>
                        <select
                          value={f.campo}
                          onChange={(e) => updateFiltroCampo(f.id, e.target.value)}
                          className={miniSelect}
                        >
                          {preguntas.map((p) => (
                            <option key={p.id} value={p.id}>{p.texto || p.id}</option>
                          ))}
                        </select>
                        <select
                          value={f.operador}
                          onChange={(e) => updateFiltro(f.id, 'operador', e.target.value)}
                          className={miniSelect}
                        >
                          {ops.map((op) => (
                            <option key={op} value={op}>{t(`dashboard.presentaciones_v.operadores.${op}`)}</option>
                          ))}
                        </select>
                        <input
                          value={f.valor}
                          onChange={(e) => updateFiltro(f.id, 'valor', e.target.value)}
                          placeholder={t('dashboard.presentaciones_v.filterValue')}
                          className="w-24 rounded-xl border border-line bg-bg px-2 py-1.5 text-xs text-fg focus:border-brand focus:outline-none"
                        />
                      </div>

                      {/* Acción: Entonces [accion] */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-fg">{t('dashboard.presentaciones_v.then')}</span>
                        <select
                          value={f.accion}
                          onChange={(e) => updateFiltro(f.id, 'accion', e.target.value)}
                          className={miniSelect}
                        >
                          <option value="descartar">{t('dashboard.presentaciones_v.acciones.descartar')}</option>
                          <option value="marcar">{t('dashboard.presentaciones_v.acciones.marcar')}</option>
                          <option value="aislar">🔇 Aislar (timeout 1h)</option>
                          <option value="expulsar">👢 Expulsar</option>
                          <option value="banear">🔨 Banear</option>
                        </select>
                      </div>

                      {/* Aviso al usuario */}
                      <div className="space-y-2">
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                          <input
                            type="checkbox"
                            checked={f.avisarUsuario}
                            onChange={(e) => updateFiltro(f.id, 'avisarUsuario', e.target.checked)}
                            className="accent-brand"
                          />
                          <Bell size={11} className="text-brand" />
                          {t('dashboard.presentaciones_v.notifyUser')}
                        </label>
                        {f.avisarUsuario && (
                          <textarea
                            value={f.mensajeAviso}
                            onChange={(e) => updateFiltro(f.id, 'mensajeAviso', e.target.value)}
                            placeholder={t('dashboard.presentaciones_v.notifyMsgPh')}
                            rows={2}
                            maxLength={500}
                            className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-xs text-fg focus:border-brand focus:outline-none"
                          />
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFiltro(f.id)}
                      className="shrink-0 text-muted transition-colors hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addFiltro}
              disabled={preguntas.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-dashed border-warning/40 px-3 py-2 text-sm text-warning/70 transition-colors hover:border-warning hover:text-warning disabled:opacity-40"
            >
              <Plus size={14} /> {t('dashboard.presentaciones_v.addFilter')}
            </button>
          </div>
        )}
      </div>

      {/* Botón guardar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Check size={16} />
          {guardando ? t('dashboard.presentaciones_v.saving') : t('dashboard.presentaciones_v.save')}
        </button>
        {guardadoOk && <span className="text-sm font-semibold text-success">{t('dashboard.presentaciones_v.savedOk')}</span>}
      </div>

      {/* Presentaciones recibidas */}
      {(pendientes.length > 0 || procesadas.length > 0) && (
        <div className={card}>
          <h3 className="mb-3 font-bold text-fg">
            {t('dashboard.presentaciones_v.received')}
            {pendientes.length > 0 && (
              <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                {pendientes.length} {t('dashboard.presentaciones_v.pending')}
              </span>
            )}
          </h3>
          <div className="space-y-3">
            {[...pendientes, ...procesadas.slice(0, 3)].map((p) => (
              <div
                key={p._id}
                className={`rounded-2xl border p-4 ${p.descartada ? 'border-danger/30 bg-danger/5' : 'border-line bg-bg'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg">
                      @{p.autor}
                      {p.descartada && (
                        <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                          {t('dashboard.presentaciones_v.discarded')}
                        </span>
                      )}
                    </p>
                    <div className="mt-1.5 space-y-1">
                      {p.respuestas?.map((r, i) => (
                        <p key={i} className="text-xs text-muted">
                          <span className="font-medium text-fg">{r.pregunta}:</span> {r.respuesta}
                        </p>
                      ))}
                    </div>
                    {p.motivoDescarte && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-danger">
                        <AlertTriangle size={10} /> {p.motivoDescarte}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarPresentacion(p._id)}
                    className="shrink-0 rounded-xl border border-line px-2.5 py-2 text-muted transition-colors hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
