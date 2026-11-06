// Seguridad · Verificación → «Preguntas al entrar» (1.9.12). Tras el botón o el
// captcha (o la doble bienvenida), el bot hace estas preguntas una a una con un
// desplegable; cada respuesta puede dar un rol y abrir una categoría (juegos). El rol
// de acceso se da al terminar. Bot: utils/preguntasEntrada.js. Se guarda solo.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListChecks, Plus, Trash2, ArrowUp, ArrowDown, X, Sparkles, AlertTriangle } from 'lucide-react';
import { Toggle } from '../../ui/primitives';
import { useAutoguardado } from '../../../hooks/useAutoguardado';
import { useDesdeServidor } from '../../../hooks/useDesdeServidor';
import EstadoAutoguardado from '../EstadoAutoguardado';
import VistaDiscord from '../VistaDiscord';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';
const mini = 'min-w-0 rounded-xl border border-line bg-bg px-2 py-1.5 text-xs text-fg focus:border-brand focus:outline-none';
const MAX_PREGUNTAS = 10;
const MAX_OPCIONES = 25;

let contador = 0;
const nuevoId = (p) => `${p}${Date.now().toString(36)}${(contador++).toString(36)}`;
const opcionVacia = () => ({ id: nuevoId('o'), etiqueta: '', emoji: '', descripcion: '', rolId: '', categoriaId: '', revisar: false });
const preguntaVacia = () => ({ id: nuevoId('q'), texto: '', descripcion: '', multiple: false, obligatoria: true, opciones: [opcionVacia(), opcionVacia()] });

export default function PreguntasEntrada({ dash, rolAccesoId }) {
  const { t } = useTranslation();
  const { configServidor, roles = [], categorias = [], canales = [], guardarPreguntasEntrada } = dash;
  const [activo, setActivo] = useState(false);
  const [preguntas, setPreguntas] = useState([]);
  const [error, setError] = useState('');
  const [vista, setVista] = useState(0); // pregunta que se ve en la vista previa

  useDesdeServidor(configServidor, () => {
    if (!configServidor) return;
    const pe = configServidor.preguntasEntrada || {};
    setActivo(!!pe.activo);
    setPreguntas(Array.isArray(pe.preguntas) ? pe.preguntas.map((q) => ({ ...preguntaVacia(), ...q, opciones: (q.opciones || []).map((o) => ({ ...opcionVacia(), ...o, rolId: o.rolId || '', categoriaId: o.categoriaId || '' })) })) : []);
  });

  const guardar = async () => {
    const r = await guardarPreguntasEntrada({ activo, preguntas });
    if (r === true) { setError(''); return true; }
    setError(r?.error || t('dashboard.verif_v.q.saveErr'));
    return false;
  };
  const autoguardado = useAutoguardado([activo, preguntas], guardar, {
    listo: !!configServidor, borrador: 'preguntas-entrada', restaurar: ([a, q]) => { setActivo(!!a); setPreguntas(Array.isArray(q) ? q : []); },
  });

  const cambiarPregunta = (i, parche) => setPreguntas((l) => l.map((q, j) => (j === i ? { ...q, ...parche } : q)));
  const cambiarOpcion = (i, k, parche) => setPreguntas((l) => l.map((q, j) => (j === i ? { ...q, opciones: q.opciones.map((o, m) => (m === k ? { ...o, ...parche } : o)) } : q)));
  const mover = (i, d) => setPreguntas((l) => { const c = [...l]; const [x] = c.splice(i, 1); c.splice(i + d, 0, x); return c; });
  // Ejemplo listo para cambiar: edad, de dónde, anuncios y juegos.
  const usarEjemplo = () => {
    const ej = t('dashboard.verif_v.q.example', { returnObjects: true });
    if (!Array.isArray(ej)) return;
    setPreguntas(ej.map((q) => ({ ...preguntaVacia(), texto: q.texto, multiple: !!q.multiple, obligatoria: q.obligatoria !== false, opciones: q.opciones.map((o) => ({ ...opcionVacia(), etiqueta: o.etiqueta, emoji: o.emoji || '' })) })));
    setActivo(true);
  };

  const validas = preguntas.filter((q) => q.texto.trim() && q.opciones.some((o) => o.etiqueta.trim()));
  const qVista = validas[Math.min(vista, Math.max(0, validas.length - 1))];
  const iVista = qVista ? validas.indexOf(qVista) : 0;

  return (
    <div data-help="verif-preguntas" className={card}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-bold text-fg"><ListChecks size={18} className="text-brand" /> {t('dashboard.verif_v.q.title')}</h3>
          <p className="mt-1 text-xs leading-snug text-muted">{t('dashboard.verif_v.q.desc')}</p>
        </div>
        <Toggle checked={activo} onChange={setActivo} />
      </div>

      {activo && !rolAccesoId && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t('dashboard.verif_v.q.noRole')}
        </p>
      )}

      <div className="mt-4 grid gap-5 border-t border-line pt-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {preguntas.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line p-4 text-center">
              <p className="text-sm text-muted">{t('dashboard.verif_v.q.empty')}</p>
              <button type="button" onClick={usarEjemplo} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-2 text-xs font-bold text-white">
                <Sparkles size={14} /> {t('dashboard.verif_v.q.useExample')}
              </button>
            </div>
          )}
          {preguntas.map((q, i) => (
            <div key={q.id} className="rounded-2xl border border-line bg-bg p-3" onFocus={() => setVista(Math.max(0, validas.indexOf(q)))}>
              <div className="flex items-start gap-2">
                <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-bold text-brand">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-2">
                  <input value={q.texto} maxLength={256} onChange={(e) => cambiarPregunta(i, { texto: e.target.value })} placeholder={t('dashboard.verif_v.q.questionPh')} className={input} />
                  <input value={q.descripcion} maxLength={1500} onChange={(e) => cambiarPregunta(i, { descripcion: e.target.value })} placeholder={t('dashboard.verif_v.q.descPh')} className={`${input} text-xs`} />
                  <div className="flex flex-wrap gap-4 text-xs text-muted">
                    <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" className="accent-brand" checked={!!q.multiple} onChange={(e) => cambiarPregunta(i, { multiple: e.target.checked })} /> {t('dashboard.verif_v.q.multiple')}</label>
                    <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" className="accent-brand" checked={q.obligatoria !== false} onChange={(e) => cambiarPregunta(i, { obligatoria: e.target.checked })} /> {t('dashboard.verif_v.q.required')}</label>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} className="rounded-lg p-1 text-muted hover:text-fg disabled:opacity-30" aria-label={t('dashboard.verif_v.q.up')}><ArrowUp size={14} /></button>
                  <button type="button" disabled={i === preguntas.length - 1} onClick={() => mover(i, 1)} className="rounded-lg p-1 text-muted hover:text-fg disabled:opacity-30" aria-label={t('dashboard.verif_v.q.down')}><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => setPreguntas((l) => l.filter((_, j) => j !== i))} className="rounded-lg p-1 text-muted hover:text-danger" aria-label={t('dashboard.verif_v.q.remove')}><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Opciones: texto, emoji, rol que da y categoría que abre */}
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{t('dashboard.verif_v.q.options')}</p>
                {q.opciones.map((o, k) => (
                  <div key={o.id} className="grid grid-cols-[3.2rem_1fr_auto_auto] items-center gap-2 sm:grid-cols-[3.2rem_1.2fr_1fr_1fr_auto_auto]">
                    <input value={o.emoji} maxLength={64} onChange={(e) => cambiarOpcion(i, k, { emoji: e.target.value })} placeholder="🎮" className={`${mini} text-center`} aria-label={t('dashboard.verif_v.q.emoji')} />
                    <input value={o.etiqueta} maxLength={100} onChange={(e) => cambiarOpcion(i, k, { etiqueta: e.target.value })} placeholder={t('dashboard.verif_v.q.optionPh')} className={mini} aria-label={t('dashboard.verif_v.q.option')} />
                    <select value={o.rolId} onChange={(e) => cambiarOpcion(i, k, { rolId: e.target.value })} className={`${mini} col-span-2 sm:col-span-1`} aria-label={t('dashboard.verif_v.q.role')}>
                      <option value="">{t('dashboard.verif_v.q.noRoleOpt')}</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>@{r.nombre}</option>)}
                    </select>
                    <select value={o.categoriaId} onChange={(e) => cambiarOpcion(i, k, { categoriaId: e.target.value })} disabled={!o.rolId} className={`${mini} col-span-2 sm:col-span-1 disabled:opacity-40`} aria-label={t('dashboard.verif_v.q.category')} title={t('dashboard.verif_v.q.categoryHint')}>
                      <option value="">{t('dashboard.verif_v.q.noCategory')}</option>
                      {categorias.length > 0 && <optgroup label={t('dashboard.verif_v.q.groupCategories')}>{categorias.map((c) => <option key={c.id} value={c.id}>📁 {c.nombre}</option>)}</optgroup>}
                      {canales.length > 0 && <optgroup label={t('dashboard.verif_v.q.groupChannels')}>{canales.map((c) => <option key={c.id} value={c.id}>#{c.nombre}</option>)}</optgroup>}
                    </select>
                    {/* 🕵️ Revisar (aprobación «Solo los sospechosos», 1.9.15) */}
                    <button type="button" role="switch" aria-checked={!!o.revisar} onClick={() => cambiarOpcion(i, k, { revisar: !o.revisar })} title={t('dashboard.verif_v.q.review')} aria-label={t('dashboard.verif_v.q.review')}
                      className={`rounded-lg px-1.5 py-1 text-sm transition-opacity ${o.revisar ? 'bg-warning/15 opacity-100 ring-1 ring-warning/50' : 'opacity-35 hover:opacity-80'}`}>🕵️</button>
                    <button type="button" onClick={() => cambiarPregunta(i, { opciones: q.opciones.filter((_, m) => m !== k) })} className="justify-self-end rounded-lg p-1 text-muted hover:text-danger" aria-label={t('dashboard.verif_v.q.removeOption')}><X size={14} /></button>
                  </div>
                ))}
                {q.opciones.length < MAX_OPCIONES && (
                  <button type="button" onClick={() => cambiarPregunta(i, { opciones: [...q.opciones, opcionVacia()] })} className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline">
                    <Plus size={13} /> {t('dashboard.verif_v.q.addOption')}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            {preguntas.length < MAX_PREGUNTAS && (
              <button type="button" onClick={() => setPreguntas((l) => [...l, preguntaVacia()])} className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-2 text-xs font-bold text-fg transition-colors hover:border-brand">
                <Plus size={14} /> {t('dashboard.verif_v.q.add')}
              </button>
            )}
            <EstadoAutoguardado estado={autoguardado} />
            {error && <span className="text-xs font-semibold text-danger">{error}</span>}
          </div>
          <p className="text-xs text-muted">{t('dashboard.verif_v.q.categoryNote')}</p>
        </div>

        {/* Vista previa: la pregunta tal cual la ve quien entra (utils/preguntasEntrada.js: pantallaPregunta) */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.verif_v.q.preview')}</p>
          {qVista ? (
            <>
              <VistaDiscord
                embed={{
                  color: configServidor?.colorEmbed || '#5865F2', titulo: qVista.texto,
                  descripcion: `${qVista.descripcion ? `${qVista.descripcion}\n\n` : ''}-# ${t('dashboard.verif_v.q.progress', { n: iVista + 1, total: validas.length })}${qVista.multiple ? t('dashboard.verif_v.q.severalNote') : ''}`,
                }}
                menu={{ placeholder: qVista.multiple ? t('dashboard.verif_v.q.pickSeveral') : t('dashboard.verif_v.q.pickOne') }}
                botones={[...(iVista > 0 ? [{ texto: t('dashboard.verif_v.q.back'), estilo: 'gris' }] : []), ...(qVista.obligatoria === false ? [{ texto: t('dashboard.verif_v.q.skip'), estilo: 'gris' }] : [])]} />
              <ul className="mt-2 space-y-1 rounded-xl border border-line bg-bg p-2 text-xs text-muted">
                {qVista.opciones.filter((o) => o.etiqueta.trim()).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-fg">{o.emoji} {o.etiqueta}</span>
                    {o.rolId && <span className="shrink-0">→ @{roles.find((r) => r.id === o.rolId)?.nombre || '?'}</span>}
                  </li>
                ))}
              </ul>
              {validas.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {validas.map((q, j) => (
                    <button key={q.id} type="button" onClick={() => setVista(j)} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${j === iVista ? 'bg-brand text-on-brand' : 'bg-elevated text-muted'}`}>{j + 1}</button>
                  ))}
                </div>
              )}
            </>
          ) : <p className="text-sm italic text-muted">{t('dashboard.verif_v.q.previewEmpty')}</p>}
        </div>
      </div>
    </div>
  );
}
