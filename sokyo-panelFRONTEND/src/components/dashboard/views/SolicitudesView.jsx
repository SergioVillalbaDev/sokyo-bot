// Tu comunidad · Solicitudes — formularios (p. ej. «Quiero ser moderador») con un
// botón en Discord; las respuestas llegan al staff, que acepta (el bot da el rol)
// o rechaza. Lógica del bot en utils/solicitudes.js.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, FileText, Plus, Trash2, Send, Loader2, Check, X, ChevronDown, ExternalLink } from 'lucide-react';
import { Avatar, Toggle } from '../../ui/primitives';
import { tarjeta, campo, CabeceraTarjeta, Campo, SelectCanal, SelectRol, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio, FilaInterruptor } from './modulosShared';
import { useModulo, useRelativo } from '../../../hooks/useModulo';
import VistaDiscord from '../VistaDiscord';

const MAX_FORMULARIOS = 10;
const MAX_PREGUNTAS = 5;
const COLOR = { pendiente: 'bg-warning/15 text-warning', aceptada: 'bg-success/15 text-success', rechazada: 'bg-danger/15 text-danger' };

export default function SolicitudesView({ dash }) {
  const { t } = useTranslation();
  const { canales, roles, accionModulo } = dash;
  const { datos, setDatos, form, set, guardar, estado, autoguardado } = useModulo(dash, 'solicitudes');
  const relativo = useRelativo();
  const [abierto, setAbierto] = useState(0);
  const [publicar, setPublicar] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [aviso, setAviso] = useState('');
  const [verSol, setVerSol] = useState(null);

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const forms = form.formularios || [];
  const ponerForms = (lista) => set('formularios')(lista);
  const cambiarForm = (i, k, v) => ponerForms(forms.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  const nuevoForm = () => {
    ponerForms([...forms, { id: Math.random().toString(36).slice(2, 10), nombre: t('dashboard.solic_v.newFormName'), emoji: '📝', descripcion: '', preguntas: [t('dashboard.solic_v.q1'), t('dashboard.solic_v.q2')], rolId: null, abierto: true, esperaDias: 7, mensajeAceptado: '' }]);
    setAbierto(forms.length);
  };
  const quitarForm = (i) => { if (window.confirm(t('dashboard.solic_v.confirmDelete', { n: forms[i].nombre }))) ponerForms(forms.filter((_, j) => j !== i)); };

  const publicarPanel = async () => {
    setPublicar('enviando');
    if (autoguardado === 'pendiente' || autoguardado === 'guardando') await guardar();
    const r = await accionModulo('solicitudes/publicar');
    setPublicar(r.error ? r.error : r.url || 'ok');
  };
  const resolver = async (s, aceptar) => {
    let motivo = '';
    if (!aceptar) {
      motivo = window.prompt(t('dashboard.solic_v.reasonPrompt'), '');
      if (motivo === null) return;
    }
    setOcupado(s.id); setAviso('');
    const r = await accionModulo(`solicitudes/${s.id}/resolver`, 'POST', { aceptar, motivo });
    setOcupado('');
    if (r.error) { setAviso(r.error); return; }
    if (r.aviso) setAviso(r.aviso);
    setDatos((d) => ({ ...d, solicitudes: d.solicitudes.map((x) => (x.id === s.id ? r.solicitud : x)) }));
  };
  const pendientes = datos.solicitudes.filter((s) => s.estado === 'pendiente').length;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.solic_v.intro')}</p>
      {form.activo && (!form.canalId || !form.canalRevisionId) && <Aviso tipo="alerta">{t('dashboard.solic_v.needChannels')}</Aviso>}

      <div data-help="solic-config" className={tarjeta}>
        <CabeceraTarjeta icono={ClipboardCheck} titulo={t('dashboard.solic_v.title')} activo={form.activo} onActivo={set('activo')} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.solic_v.channel')} ayuda={t('dashboard.solic_v.channelHint')}>
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} />
          </Campo>
          <Campo etiqueta={t('dashboard.solic_v.review')} ayuda={t('dashboard.solic_v.reviewHint')}>
            <SelectCanal canales={canales} value={form.canalRevisionId} onChange={set('canalRevisionId')} />
          </Campo>
          <Campo etiqueta={t('dashboard.solic_v.panelTitle')} className="sm:col-span-2">
            <input maxLength={200} value={form.titulo || ''} onChange={(e) => set('titulo')(e.target.value)} className={campo} />
          </Campo>
          <Campo etiqueta={t('dashboard.solic_v.panelDesc')} className="sm:col-span-2">
            <textarea rows={2} maxLength={2000} value={form.descripcion || ''} onChange={(e) => set('descripcion')(e.target.value)} className={`${campo} resize-y`} />
          </Campo>
          {/* El mensaje del panel, como lo arma el bot (utils/solicitudes.js: mensajePanel). */}
          <div className="sm:col-span-2">
            <VistaDiscord
              embed={{
                titulo: form.titulo || t('dashboard.solic_v.defaultTitle'), color: '#8b5cf6',
                descripcion: [form.descripcion || '', '', ...forms.filter((f) => f.abierto !== false && f.nombre).map((f) => `${f.emoji || '📝'} **${f.nombre}**${f.descripcion ? ` — ${f.descripcion}` : ''}`)].join('\n').trim(),
                pie: forms.some((f) => f.abierto !== false && f.nombre) ? '' : t('dashboard.solic_v.noOpen'),
              }}
              botones={forms.filter((f) => f.abierto !== false && f.nombre).slice(0, 25).map((f) => ({ texto: `${f.emoji || '📝'} ${f.nombre}`, estilo: 'azul' }))} />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <h4 className="flex items-center gap-2 text-sm font-bold text-fg"><FileText size={16} className="text-brand" /> {t('dashboard.solic_v.forms', { n: forms.length, max: MAX_FORMULARIOS })}</h4>
          {forms.length < MAX_FORMULARIOS && (
            <button type="button" onClick={nuevoForm} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-fg hover:border-brand"><Plus size={14} /> {t('dashboard.solic_v.addForm')}</button>
          )}
        </div>
        {forms.length === 0 && <p className="mt-3 text-sm text-muted">{t('dashboard.solic_v.noForms')}</p>}
        <div className="mt-3 space-y-2">
          {forms.map((f, i) => (
            <div key={f.id} className="rounded-2xl border border-line bg-bg">
              <button type="button" onClick={() => setAbierto(abierto === i ? -1 : i)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="text-xl">{f.emoji || '📝'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{f.nombre || '—'}</span>
                  <span className="block text-xs text-muted">{t('dashboard.solic_v.questionsCount', { count: (f.preguntas || []).filter((p) => p.trim()).length })}{f.abierto === false ? ` · ${t('dashboard.solic_v.closed')}` : ''}</span>
                </span>
                <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${abierto === i ? 'rotate-180' : ''}`} />
              </button>
              {abierto === i && (
                <div className="space-y-4 border-t border-line px-4 py-4">
                  <div className="grid gap-3 sm:grid-cols-[80px_1fr]">
                    <Campo etiqueta={t('dashboard.solic_v.emoji')}><input maxLength={64} value={f.emoji || ''} onChange={(e) => cambiarForm(i, 'emoji', e.target.value)} className={campo} /></Campo>
                    <Campo etiqueta={t('dashboard.solic_v.name')}><input maxLength={80} value={f.nombre || ''} onChange={(e) => cambiarForm(i, 'nombre', e.target.value)} className={campo} /></Campo>
                  </div>
                  <Campo etiqueta={t('dashboard.solic_v.desc')}><input maxLength={200} value={f.descripcion || ''} onChange={(e) => cambiarForm(i, 'descripcion', e.target.value)} className={campo} placeholder={t('dashboard.solic_v.descPh')} /></Campo>
                  <div>
                    <span className="text-xs font-semibold text-muted">{t('dashboard.solic_v.questions')}</span>
                    <p className="mb-2 text-xs text-muted">{t('dashboard.solic_v.questionsHint', { max: MAX_PREGUNTAS })}</p>
                    <div className="space-y-2">
                      {(f.preguntas || []).map((p, k) => (
                        <div key={k} className="flex gap-2">
                          <input maxLength={300} value={p} onChange={(e) => cambiarForm(i, 'preguntas', f.preguntas.map((x, z) => (z === k ? e.target.value : x)))} className={campo} placeholder={t('dashboard.solic_v.questionPh')} />
                          <button type="button" onClick={() => cambiarForm(i, 'preguntas', f.preguntas.filter((_, z) => z !== k))} className="shrink-0 rounded-xl border border-line px-2.5 text-muted hover:text-danger" aria-label={t('dashboard.solic_v.removeQuestion')}><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                    {(f.preguntas || []).length < MAX_PREGUNTAS && (
                      <button type="button" onClick={() => cambiarForm(i, 'preguntas', [...(f.preguntas || []), ''])} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand"><Plus size={13} /> {t('dashboard.solic_v.addQuestion')}</button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo etiqueta={t('dashboard.solic_v.role')} ayuda={t('dashboard.solic_v.roleHint')}>
                      <SelectRol roles={roles} value={f.rolId} onChange={(v) => cambiarForm(i, 'rolId', v || null)} vacio={t('dashboard.solic_v.noRole')} />
                    </Campo>
                    <Campo etiqueta={t('dashboard.solic_v.wait')} ayuda={t('dashboard.solic_v.waitHint')}>
                      <Numero value={f.esperaDias ?? 7} onChange={(v) => cambiarForm(i, 'esperaDias', v)} max={365} />
                    </Campo>
                  </div>
                  <Campo etiqueta={t('dashboard.solic_v.accepted')} ayuda={t('dashboard.solic_v.acceptedHint')}>
                    <textarea rows={2} maxLength={1000} value={f.mensajeAceptado || ''} onChange={(e) => cambiarForm(i, 'mensajeAceptado', e.target.value)} className={`${campo} resize-y`} />
                  </Campo>
                  <VistaDiscord texto={f.mensajeAceptado || t('dashboard.solic_v.defaultAccepted', { nombre: f.nombre || '…', servidor: 'Nébula Gaming' })} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <FilaInterruptor titulo={t('dashboard.solic_v.open')} desc={t('dashboard.solic_v.openHint')}>
                      <Toggle checked={f.abierto !== false} onChange={(v) => cambiarForm(i, 'abierto', v)} />
                    </FilaInterruptor>
                    <button type="button" onClick={() => quitarForm(i)} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-muted hover:text-danger"><Trash2 size={13} /> {t('dashboard.solic_v.deleteForm')}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} />
          <button type="button" onClick={publicarPanel} disabled={publicar === 'enviando' || !form.canalId || !forms.length}
            className="flex items-center gap-2 rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-brand disabled:opacity-50">
            {publicar === 'enviando' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {form.panelMensajeId ? t('dashboard.solic_v.update') : t('dashboard.solic_v.publish')}
          </button>
          {publicar && publicar !== 'enviando' && (/^https?:/.test(publicar) || publicar === 'ok'
            ? <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={15} /> {t('dashboard.solic_v.published')} {/^https?:/.test(publicar) && <a href={publicar} target="_blank" rel="noreferrer" className="underline"><ExternalLink size={13} /></a>}</span>
            : <span className="text-sm font-semibold text-danger">{publicar}</span>)}
        </div>
        <p className="mt-2 text-xs text-muted">{t('dashboard.solic_v.publishHint')}</p>
      </div>

      <div data-help="solic-lista" className={tarjeta}>
        <CabeceraTarjeta icono={ClipboardCheck} titulo={t('dashboard.solic_v.inbox', { count: pendientes })} />
        {aviso && <div className="mt-3"><Aviso tipo="alerta">{aviso}</Aviso></div>}
        {datos.solicitudes.length === 0 ? (
          <Vacio icono={ClipboardCheck} titulo={t('dashboard.solic_v.emptyTitle')} sub={t('dashboard.solic_v.emptySub')} />
        ) : (
          <ul className="mt-4 space-y-2">
            {datos.solicitudes.map((s) => (
              <li key={s.id} className="rounded-2xl border border-line bg-bg">
                <button type="button" onClick={() => setVerSol(verSol === s.id ? null : s.id)} className="flex w-full flex-wrap items-center gap-3 px-3 py-2.5 text-left">
                  <Avatar src={s.usuario?.avatar} name={s.usuario?.nombre || '?'} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">{s.usuario?.nombre}</span>
                    <span className="block text-xs text-muted">{s.formulario} · {relativo(s.fecha)}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${COLOR[s.estado]}`}>{t(`dashboard.solic_v.estados.${s.estado}`)}</span>
                  <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${verSol === s.id ? 'rotate-180' : ''}`} />
                </button>
                {verSol === s.id && (
                  <div className="space-y-3 border-t border-line px-4 py-3">
                    {s.respuestas.map((r, k) => (
                      <div key={k}>
                        <p className="text-xs font-semibold text-muted">{r.pregunta}</p>
                        <p className="whitespace-pre-wrap break-words text-sm text-fg">{r.respuesta || '—'}</p>
                      </div>
                    ))}
                    {s.estado === 'pendiente' ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => resolver(s, true)} disabled={ocupado === s.id} className="flex items-center gap-1.5 rounded-xl bg-success/15 px-3 py-2 text-xs font-bold text-success hover:bg-success/25 disabled:opacity-50">
                          {ocupado === s.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {t('dashboard.solic_v.accept')}
                        </button>
                        <button type="button" onClick={() => resolver(s, false)} disabled={ocupado === s.id} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-bold text-muted hover:text-danger disabled:opacity-50">
                          <X size={13} /> {t('dashboard.solic_v.reject')}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted">{t('dashboard.solic_v.reviewedBy', { quien: s.revisadoPor || '—' })}{s.motivo ? ` · «${s.motivo}»` : ''}</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
