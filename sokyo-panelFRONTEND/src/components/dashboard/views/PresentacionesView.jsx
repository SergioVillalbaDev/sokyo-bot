// Comunidad · Presentaciones — formulario de presentación para nuevos miembros
// con preguntas configurables y filtros automáticos de descarte.
import {useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Info, Filter, Check, AlertTriangle, Bell, ChevronDown, ChevronUp, ShieldCheck, X } from 'lucide-react';
import { Toggle } from '../../ui/primitives';
import { useAutoguardado } from '../../../hooks/useAutoguardado';
import EstadoAutoguardado from '../EstadoAutoguardado';
import { OpcionCrear } from '../CrearAlVuelo';
import { useDesdeServidor } from '../../../hooks/useDesdeServidor';
import VistaDiscord from '../VistaDiscord';
import VentanaDiscord from '../VentanaDiscord';
import EditorMensajePanel from '../EditorMensajePanel';
import { PANEL_VACIO, panelDesde } from '../../../lib/panelMensaje';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';
const miniSelect = 'rounded-xl border border-line bg-bg px-2 py-1.5 text-xs text-fg focus:border-brand focus:outline-none';

const TIPOS = ['texto', 'numero', 'seleccion'];

// Operadores disponibles según el tipo de pregunta
const OPS_NUMERO = ['menor_que', 'mayor_que', 'igual_a'];
const OPS_TEXTO = ['contiene', 'no_contiene', 'igual_a'];

// Preguntas de ejemplo en el idioma del panel (antes siempre salían en inglés).
const preguntasDefecto = (t) => [
  { id: 'nombre', texto: t('dashboard.presentaciones_v.defaultQName'), tipo: 'texto', requerida: true },
  { id: 'edad', texto: t('dashboard.presentaciones_v.defaultQAge'), tipo: 'numero', requerida: true },
  { id: 'intereses', texto: t('dashboard.presentaciones_v.defaultQInterests'), tipo: 'texto', requerida: false },
];

// Plantilla de fábrica en el idioma del bot en el servidor (es la que se publica en
// Discord). Igual que en utils/textosPorDefecto.js del bot, para que se adapte sola
// si el servidor cambia de idioma.
const PLANTILLA_FABRICA = {
  en: 'Age: \nWhere you’re from: \nHobbies: \nWhy you’re joining: ',
  es: 'Edad: \nDe dónde eres: \nAficiones: \nPor qué te unes: ',
};

// Privado de rechazo de fábrica: el mismo que utils/comunidad.js (RECHAZO_FABRICA).
const RECHAZO_FABRICA = {
  es: 'Hola {user}, tu presentación en **{server}** no ha sido aceptada.\n**Motivo:** {motivo}\n\nPuedes enviar otra cuando quieras desde el canal de presentaciones.',
  en: 'Hi {user}, your intro on **{server}** wasn’t accepted.\n**Reason:** {motivo}\n\nYou can send another one whenever you like from the intros channel.',
};

export default function PresentacionesView({ dash }) {
  const { t } = useTranslation();
  const { canales, roles = [], configServidor, presentaciones = [], guardarConfigPresentaciones, eliminarPresentacion, revisarPresentacion } = dash;

  const [canalIntro, setCanalIntro] = useState('');
  const [canalStaff, setCanalStaff] = useState('');
  const [modo, setModo] = useState('preguntas');
  const [plantilla, setPlantilla] = useState(() => PLANTILLA_FABRICA[configServidor?.idioma] || PLANTILLA_FABRICA.en);
  const [preguntas, setPreguntas] = useState(() => preguntasDefecto(t));
  const [filtros, setFiltros] = useState([]);
  // Aprobación del staff (1.9.12)
  const [aprobacion, setAprobacion] = useState(true);
  const [canalPublico, setCanalPublico] = useState('');
  const [mensajeRechazo, setMensajeRechazo] = useState('');
  const [mensajeAceptada, setMensajeAceptada] = useState('');
  const [rolAceptadaId, setRolAceptadaId] = useState('');
  // Cómo es el mensaje «Preséntate» en Discord (1.9.14)
  const [panel, setPanel] = useState(PANEL_VACIO);
  const [revision, setRevision] = useState({}); // id -> { rechazando, motivo, estado, texto }
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [seccionAbierta, setSeccionAbierta] = useState('preguntas'); // 'preguntas' | 'filtros'

  useDesdeServidor(configServidor, () => {
    if (configServidor?.presentaciones) {
      const p = configServidor.presentaciones;
      if (p.canalIntro) setCanalIntro(p.canalIntro);
      if (p.canalStaff) setCanalStaff(p.canalStaff);
      if (p.modo) setModo(p.modo);
      if (p.plantilla) setPlantilla(p.plantilla);
      if (Array.isArray(p.preguntas) && p.preguntas.length) setPreguntas(p.preguntas);
      if (Array.isArray(p.filtros)) setFiltros(p.filtros);
      setAprobacion(p.aprobacion !== false);
      setCanalPublico(p.canalPublico || '');
      setMensajeRechazo(p.mensajeRechazo || '');
      setMensajeAceptada(p.mensajeAceptada || '');
      setRolAceptadaId(p.rolAceptadaId || '');
      setPanel(panelDesde(p.panel));
    }
  });

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
    const ok = await guardarConfigPresentaciones({ canalIntro, canalStaff, modo, plantilla, preguntas, filtros, aprobacion, canalPublico, mensajeRechazo, mensajeAceptada, rolAceptadaId, panel });
    setGuardadoOk(!!ok);
    setGuardando(false);
    if (ok) setTimeout(() => setGuardadoOk(false), 2500);
    return ok; // el autoguardado reintenta si falla
  };
  // Se guarda solo al dejar de tocar algo (hooks/useAutoguardado.js).
  const autoguardado = useAutoguardado([canalIntro, canalStaff, modo, plantilla, preguntas, filtros, aprobacion, canalPublico, mensajeRechazo, mensajeAceptada, rolAceptadaId, panel], guardar, {
    listo: !!configServidor, borrador: 'presentaciones',
    restaurar: ([ci, cs, m, p, q, fl, ap = true, cp = '', mr = '', ma = '', ra = '', pn = PANEL_VACIO]) => {
      setCanalIntro(ci); setCanalStaff(cs); setModo(m); setPlantilla(p); setPreguntas(q); setFiltros(fl);
      setAprobacion(ap !== false); setCanalPublico(cp || ''); setMensajeRechazo(mr || ''); setMensajeAceptada(ma || ''); setRolAceptadaId(ra || '');
      setPanel(panelDesde(pn));
    },
  });

  // Aceptar / rechazar desde el panel (igual que los botones del aviso del staff).
  const cambiarRevision = (id, parche) => setRevision((r) => ({ ...r, [id]: { ...(r[id] || {}), ...parche } }));
  const revisar = async (p, aceptar) => {
    const motivo = revision[p._id]?.motivo || '';
    if (!aceptar && !motivo.trim()) { cambiarRevision(p._id, { texto: t('dashboard.presentaciones_v.reasonNeeded'), error: true }); return; }
    cambiarRevision(p._id, { estado: 'enviando', texto: '', error: false });
    const r = await revisarPresentacion(p._id, aceptar, motivo);
    if (r.ok) cambiarRevision(p._id, { estado: 'hecho', rechazando: false, texto: aceptar ? t('dashboard.presentaciones_v.acceptedOk') : (r.aviso ? t('dashboard.presentaciones_v.rejectedOk') : t('dashboard.presentaciones_v.rejectedNoDm')) });
    else cambiarRevision(p._id, { estado: '', error: true, texto: r.codigo === 'sin-canal' ? t('dashboard.presentaciones_v.errNoChannel') : r.codigo === 'ya-revisada' ? t('dashboard.presentaciones_v.errDone') : t('dashboard.presentaciones_v.errReview') });
  };
  const idiomaBot = configServidor?.idioma === 'es' ? 'es' : 'en';
  const servidorNombre = dash.servidorInfo?.nombre || 'Nébula';
  const ejemploRechazo = (mensajeRechazo.trim() || RECHAZO_FABRICA[idiomaBot])
    .replace(/\{(user|usuario)\}/gi, '@Alex').replace(/\{(server|servidor)\}/gi, servidorNombre)
    .replace(/\{(motivo|reason)\}/gi, t('dashboard.presentaciones_v.exampleReason'));

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
      <div data-help="presentaciones-canales" className={card}>
        <h3 className="mb-3 font-bold text-fg">{t('dashboard.presentaciones_v.channels')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.presentaciones_v.introChannel')}</span>
            <select value={canalIntro} onChange={(e) => setCanalIntro(e.target.value)} className={input}>
              <option value="">{t('dashboard.presentaciones_v.channelPh')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              <OpcionCrear tipo="canal" />
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.presentaciones_v.staffChannel')}</span>
            <select value={canalStaff} onChange={(e) => setCanalStaff(e.target.value)} className={input}>
              <option value="">{t('dashboard.presentaciones_v.channelPh')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              <OpcionCrear tipo="canal" />
            </select>
          </label>
        </div>
      </div>

      {/* El mensaje con el botón «Presentarme» (utils/comunidad.js: contenidoPanelPresentacion) */}
      <EditorMensajePanel dash={dash} tipo="presentaciones" valor={panel} onCambio={(parche) => setPanel((pn) => ({ ...pn, ...parche }))}
        publicado={configServidor?.presentaciones?.panelMensajeId ? { canalId: configServidor.presentaciones.canalIntro, mensajeId: configServidor.presentaciones.panelMensajeId } : null}
        pendiente={!!configServidor?.presentaciones?.panelPendiente} />

      {/* Aprobación del staff (utils/comunidad.js: revisarPresentacion) */}
      <div data-help="presentaciones-aprobacion" className={card}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-bold text-fg"><ShieldCheck size={18} className="text-brand" /> {t('dashboard.presentaciones_v.approval')}</h3>
            <p className="mt-0.5 text-xs leading-snug text-muted">{t('dashboard.presentaciones_v.approvalDesc')}</p>
          </div>
          <Toggle checked={aprobacion} onChange={setAprobacion} />
        </div>
        <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.presentaciones_v.publicChannel')}</span>
            <select value={canalPublico} onChange={(e) => setCanalPublico(e.target.value)} className={input}>
              <option value="">{t('dashboard.presentaciones_v.publicSame')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              <OpcionCrear tipo="canal" />
            </select>
            <span className="mt-1 block text-xs text-muted">{t('dashboard.presentaciones_v.publicChannelDesc')}</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.presentaciones_v.acceptRole')}</span>
            <select value={rolAceptadaId} onChange={(e) => setRolAceptadaId(e.target.value)} className={input}>
              <option value="">{t('dashboard.presentaciones_v.acceptRoleNone')}</option>
              {roles.map((r) => <option key={r.id} value={r.id}>@{r.nombre}</option>)}
            </select>
            <span className="mt-1 block text-xs text-muted">{t('dashboard.presentaciones_v.acceptRoleDesc')}</span>
          </label>
        </div>
        {aprobacion && (
          <div className="mt-4 grid gap-4 border-t border-line pt-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.presentaciones_v.rejectMsg')}</span>
                <textarea value={mensajeRechazo} onChange={(e) => setMensajeRechazo(e.target.value)} rows={5} maxLength={1500}
                  className={`${input} resize-y`} placeholder={RECHAZO_FABRICA[idiomaBot]} />
                <span className="mt-1 block text-xs text-muted">{t('dashboard.presentaciones_v.rejectVars')}</span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.presentaciones_v.acceptMsg')}</span>
                <textarea value={mensajeAceptada} onChange={(e) => setMensajeAceptada(e.target.value)} rows={3} maxLength={1500}
                  className={`${input} resize-y`} placeholder={t('dashboard.presentaciones_v.acceptMsgPh')} />
                <span className="mt-1 block text-xs text-muted">{t('dashboard.presentaciones_v.acceptMsgDesc')}</span>
              </label>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.presentaciones_v.rejectPreview')}</p>
              <VistaDiscord texto={ejemploRechazo} />
            </div>
          </div>
        )}
      </div>

      {/* Modo de presentación */}
      <div data-help="presentaciones-formato" className={card}>
        <h3 className="mb-3 font-bold text-fg">{t('dashboard.presentaciones_v.formatTitle')}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setModo('preguntas')}
            className={`rounded-2xl border p-3 text-left transition-colors ${modo === 'preguntas' ? 'border-brand bg-brand/10' : 'border-line hover:border-brand/50'}`}>
            <p className="text-sm font-semibold text-fg">{t('dashboard.presentaciones_v.modeQuestions')}</p>
            <p className="mt-0.5 text-xs text-muted">{t('dashboard.presentaciones_v.modeQuestionsDesc')}</p>
          </button>
          <button type="button" onClick={() => setModo('plantilla')}
            className={`rounded-2xl border p-3 text-left transition-colors ${modo === 'plantilla' ? 'border-brand bg-brand/10' : 'border-line hover:border-brand/50'}`}>
            <p className="text-sm font-semibold text-fg">{t('dashboard.presentaciones_v.modeTemplate')}</p>
            <p className="mt-0.5 text-xs text-muted">{t('dashboard.presentaciones_v.modeTemplateDesc')}</p>
          </button>
        </div>
        {modo === 'plantilla' && (
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.presentaciones_v.templateLabel')}</span>
            <textarea value={plantilla} onChange={(e) => setPlantilla(e.target.value)} rows={5} maxLength={1500}
              className={`${input} resize-none font-mono`} placeholder={'Age: \nWhere you’re from: \nHobbies: '} />
            <span className="mt-1 block text-xs text-muted">{t('dashboard.presentaciones_v.templateNote')}</span>
          </label>
        )}
      </div>

      {/* Preguntas (acordeón) — solo en modo preguntas */}
      {modo === 'preguntas' && (
      <div data-help="presentaciones-preguntas" className={card}>
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
      <div data-help="presentaciones-filtros" className={`${card} ${filtros.length > 0 ? 'border-warning/40' : ''}`}>
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

      {/* Cómo lo ve la gente en Discord (utils/comunidad.js: publicarPanelPresentacion, abrirModalPresentacion, procesarPresentacion) */}
      <div data-help="presentaciones-previa" className={card}>
        <h3 className="font-bold text-fg">{t('dashboard.presentaciones_v.prevTitle')}</h3>
        <p className="mb-3 mt-0.5 text-xs text-muted">{t('dashboard.presentaciones_v.prevHint')}</p>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">{t('dashboard.presentaciones_v.prevStepWindow')}</p>
            <VentanaDiscord titulo={t('dashboard.presentaciones_v.prevModalTitle')}
              campos={modo === 'plantilla'
                ? [{ etiqueta: t('dashboard.presentaciones_v.prevTemplateField'), valor: plantilla.slice(0, 1500), parrafo: true, obligatorio: true }]
                : preguntas.slice(0, 5).map((p) => ({ etiqueta: p.texto || t('dashboard.presentaciones_v.prevQuestion'), parrafo: p.tipo === 'texto', obligatorio: !!p.requerida }))} />
            {modo !== 'plantilla' && preguntas.length > 5 && <p className="mt-1.5 text-xs text-warn">{t('dashboard.presentaciones_v.prevOnlyFive')}</p>}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">{t('dashboard.presentaciones_v.prevStepPost')}</p>
            <VistaDiscord embed={{
              autor: t('dashboard.presentaciones_v.prevAuthor'), titulo: t('dashboard.presentaciones_v.prevPostTitle'), color: configServidor?.colorEmbed || '#5865F2',
              campos: modo === 'plantilla'
                ? [{ nombre: t('dashboard.presentaciones_v.prevIntro'), valor: plantilla || t('dashboard.presentaciones_v.prevAnswer') }]
                : preguntas.slice(0, 5).map((p) => ({ nombre: p.texto || p.id, valor: p.tipo === 'numero' ? '21' : t('dashboard.presentaciones_v.prevAnswer') })),
            }} />
          </div>
        </div>
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
        <EstadoAutoguardado estado={autoguardado} />
        {guardadoOk && <span className="text-sm font-semibold text-success">{t('dashboard.presentaciones_v.savedOk')}</span>}
      </div>

      {/* Presentaciones recibidas */}
      {(pendientes.length > 0 || procesadas.length > 0) && (
        <div data-help="presentaciones-recibidas" className={card}>
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
                      {!p.descartada && p.estado === 'aceptada' && <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">{t('dashboard.presentaciones_v.stAccepted')}</span>}
                      {!p.descartada && p.estado === 'rechazada' && <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">{t('dashboard.presentaciones_v.stRejected')}</span>}
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
                    {p.estado === 'rechazada' && p.motivoRechazo && <p className="mt-2 text-xs text-danger">{t('dashboard.presentaciones_v.reason')}: {p.motivoRechazo}</p>}
                    {/* Pendiente de revisar: aceptar o rechazar con motivo */}
                    {!p.procesada && !p.descartada && (!p.estado || p.estado === 'pendiente') && revision[p._id]?.estado !== 'hecho' && (
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={revision[p._id]?.estado === 'enviando'} onClick={() => revisar(p, true)}
                            className="flex items-center gap-1.5 rounded-xl bg-success px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Check size={13} /> {t('dashboard.presentaciones_v.accept')}</button>
                          <button type="button" disabled={revision[p._id]?.estado === 'enviando'} onClick={() => cambiarRevision(p._id, { rechazando: !revision[p._id]?.rechazando, texto: '' })}
                            className="flex items-center gap-1.5 rounded-xl border border-danger/50 px-3 py-1.5 text-xs font-bold text-danger disabled:opacity-50"><X size={13} /> {t('dashboard.presentaciones_v.reject')}</button>
                        </div>
                        {revision[p._id]?.rechazando && (
                          <div className="flex flex-wrap gap-2">
                            <input value={revision[p._id]?.motivo || ''} onChange={(e) => cambiarRevision(p._id, { motivo: e.target.value, texto: '' })} maxLength={1000}
                              placeholder={t('dashboard.presentaciones_v.reasonPh')} className={`${input} min-w-0 flex-1`} />
                            <button type="button" onClick={() => revisar(p, false)} className="rounded-xl bg-danger px-3 py-1.5 text-xs font-bold text-white">{t('dashboard.presentaciones_v.sendReject')}</button>
                          </div>
                        )}
                      </div>
                    )}
                    {revision[p._id]?.texto && <p className={`mt-2 text-xs font-semibold ${revision[p._id]?.error ? 'text-danger' : 'text-success'}`}>{revision[p._id].texto}</p>}
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
