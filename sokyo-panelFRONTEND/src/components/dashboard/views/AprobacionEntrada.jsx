// Seguridad · Verificación → «Aprobación del staff» (1.9.13). Desde 1.9.15 se elige
// quién tiene que esperar: nadie (entran al momento, lo de fábrica), todos o solo los
// sospechosos (cuenta muy nueva, sin foto o una respuesta marcada con 🕵️). La
// solicitud (con lo que respondió en las preguntas al entrar) llega a un canal con
// «Aceptar» y «Rechazar», y también sale aquí abajo. Al rechazar, le llega un privado
// con el motivo. Bot: utils/preguntasEntrada.js (requiereAprobacion, solicitarAprobacion,
// revisarSolicitud) y utils/puertaEntrada.js (motivosRevision).
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserCheck, Check, X, RefreshCw, AlertTriangle, DoorOpen, ShieldCheck, ScanEye } from 'lucide-react';
import { OpcionCrear } from '../CrearAlVuelo';
import { useAutoguardado } from '../../../hooks/useAutoguardado';
import { useDesdeServidor } from '../../../hooks/useDesdeServidor';
import EstadoAutoguardado from '../EstadoAutoguardado';
import VistaDiscord from '../VistaDiscord';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

// Privados de fábrica: los mismos que utils/preguntasEntrada.js (RECHAZO_ENTRADA y
// ACEPTADA_ENTRADA; un test comprueba que no se separan).
const RECHAZO_FABRICA = {
  es: 'Hola {user}, tu verificación en **{server}** no ha sido aceptada.\n**Motivo:** {motivo}\n\nSi crees que es un error, puedes volver a intentarlo desde el canal de verificación.',
  en: 'Hi {user}, your verification on **{server}** wasn’t accepted.\n**Reason:** {motivo}\n\nIf you think it’s a mistake, you can try again from the verification channel.',
};
const ACEPTADA_FABRICA = {
  es: '✅ ¡Hola {user}! El staff ha aceptado tu verificación en **{server}**: ya puedes entrar. ¡Bienvenido/a!',
  en: '✅ Hi {user}! The staff accepted your verification on **{server}**: you can come in now. Welcome!',
};
// El aviso del canal del staff (utils/preguntasEntrada.js → avisarStaff y filaRevision),
// en el idioma del bot.
const AVISO_STAFF = {
  es: { titulo: '🚪 Nueva verificación por revisar', desc: '{user} quiere entrar al servidor.', ok: '✅ Aceptar', no: '❌ Rechazar' },
  en: { titulo: '🚪 New verification to review', desc: '{user} wants to join the server.', ok: '✅ Accept', no: '❌ Reject' },
};

const VACIO = { aprobacionModo: 'nunca', cuentaOn: true, revisarCuentaDias: 7, revisarSinAvatar: true, rolAvisoId: '', canalRevisionId: '', mensajeRechazo: '', mensajeAceptada: '' };
const MODOS = [['nunca', DoorOpen], ['siempre', ShieldCheck], ['sospechosos', ScanEye]];
// Lo guardado (o un borrador) → el formulario (antes de 1.9.15 solo había `aprobacion`:
// sí o no). La casilla de la edad va aparte de los días: vaciar el número no la apaga.
const formDesde = (pe = {}) => {
  const dias = Number(pe.revisarCuentaDias);
  const guardadoACero = pe.revisarCuentaDias != null && pe.revisarCuentaDias !== '' && Number.isFinite(dias) && dias <= 0;
  return {
    aprobacionModo: ['nunca', 'siempre', 'sospechosos'].includes(pe.aprobacionModo) ? pe.aprobacionModo : (pe.aprobacion ? 'siempre' : 'nunca'),
    cuentaOn: typeof pe.cuentaOn === 'boolean' ? pe.cuentaOn : !guardadoACero,
    revisarCuentaDias: pe.revisarCuentaDias === '' ? '' : (dias > 0 ? dias : 7),
    revisarSinAvatar: pe.revisarSinAvatar !== false,
    rolAvisoId: pe.rolAvisoId || '', canalRevisionId: pe.canalRevisionId || '', mensajeRechazo: pe.mensajeRechazo || '', mensajeAceptada: pe.mensajeAceptada || '',
  };
};

export default function AprobacionEntrada({ dash, rolAccesoId }) {
  const { t } = useTranslation();
  const { configServidor, canales = [], roles = [], servidorInfo, guardarPreguntasEntrada, cargarVerificaciones, revisarVerificacion } = dash;
  const [form, setForm] = useState(VACIO);
  const [lista, setLista] = useState(null); // { pendientes, revisadas }
  const [errorLista, setErrorLista] = useState(false); // no se ha podido cargar (sin acceso o sin conexión)
  const [vista, setVista] = useState('staff'); // vista previa: 'staff' | 'rechazo' | 'aceptada'
  const [revision, setRevision] = useState({}); // id -> { rechazando, motivo, estado, texto, error }

  useDesdeServidor(configServidor, () => {
    if (!configServidor) return;
    setForm(formDesde(configServidor.preguntasEntrada || {}));
  });
  // Sin la casilla de la edad = 0 días (no cuenta); con ella y el número vacío, 7.
  const guardar = async () => {
    const { cuentaOn, ...datos } = form;
    return (await guardarPreguntasEntrada({ ...datos, revisarCuentaDias: cuentaOn ? (Number(form.revisarCuentaDias) || 7) : 0 })) === true;
  };
  const activa = form.aprobacionModo !== 'nunca';
  const autoguardado = useAutoguardado(form, guardar, { listo: !!configServidor, borrador: 'aprobacion-entrada', restaurar: (v) => setForm(formDesde(v || {})) });
  const cambiar = (parche) => setForm((f) => ({ ...f, ...parche }));

  const recargar = useCallback(async () => {
    const d = await cargarVerificaciones();
    setErrorLista(!d);
    if (d) setLista(d);
  }, [cargarVerificaciones]);
  // Se lee al abrir y cada 15 s (llegan solicitudes nuevas mientras se mira).
  useEffect(() => {
    let vivo = true;
    const leer = () => cargarVerificaciones().then((d) => { if (!vivo) return; setErrorLista(!d); if (d) setLista(d); });
    leer();
    const id = setInterval(leer, 15000);
    return () => { vivo = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configServidor?.guildId]);

  const cambiarRevision = (id, parche) => setRevision((r) => ({ ...r, [id]: { ...(r[id] || {}), ...parche } }));
  const revisar = async (s, aceptar) => {
    const motivo = revision[s._id]?.motivo || '';
    if (!aceptar && !motivo.trim()) { cambiarRevision(s._id, { texto: t('dashboard.verif_v.ap.reasonNeeded'), error: true }); return; }
    cambiarRevision(s._id, { estado: 'enviando', texto: '', error: false });
    const r = await revisarVerificacion(s._id, aceptar, motivo);
    if (r.ok) {
      cambiarRevision(s._id, { estado: 'hecho', solicitud: s, rechazando: false, error: false, texto: aceptar ? (r.fallo ? t('dashboard.verif_v.ap.acceptedRoles') : t('dashboard.verif_v.ap.acceptedOk')) : (r.aviso ? t('dashboard.verif_v.ap.rejectedOk') : t('dashboard.verif_v.ap.rejectedNoDm')) });
      recargar();
    } else {
      const clave = { 'ya-revisada': 'errDone', 'no-esta': 'errGone' }[r.codigo] || 'errReview';
      cambiarRevision(s._id, { estado: '', error: true, texto: t(`dashboard.verif_v.ap.${clave}`) });
    }
  };

  const idiomaBot = configServidor?.idioma === 'es' ? 'es' : 'en';
  // Las mismas variables que rellena el bot (rellenar en utils/preguntasEntrada.js).
  const servidor = servidorInfo?.nombre || 'Nébula';
  const motivoEj = t('dashboard.verif_v.ap.exampleReason');
  const variables = { user: '@Alex', usuario: '@Alex', server: servidor, servidor, motivo: motivoEj, reason: motivoEj };
  const aviso = AVISO_STAFF[idiomaBot];
  // Lo respondido de ejemplo: la primera respuesta de cada pregunta (como mucho 3).
  const camposEj = (configServidor?.preguntasEntrada?.preguntas || [])
    .filter((q) => q?.texto && (q.opciones || []).some((o) => o?.etiqueta)).slice(0, 3)
    .map((q) => { const o = q.opciones.find((x) => x?.etiqueta); return { nombre: q.texto, valor: `${o.emoji ? `${o.emoji} ` : ''}${o.etiqueta}` }; });
  const previas = {
    staff: <VistaDiscord embed={{ titulo: aviso.titulo, descripcion: aviso.desc.replace('{user}', '@Alex'), campos: camposEj, pie: 'alex · 123456789012345678', color: configServidor?.colorEmbed || '#5865F2' }} botones={[{ texto: aviso.ok, estilo: 'verde' }, { texto: aviso.no, estilo: 'rojo' }]} />,
    rechazo: <VistaDiscord texto={form.mensajeRechazo.trim() || RECHAZO_FABRICA[idiomaBot]} variables={variables} />,
    aceptada: <VistaDiscord texto={form.mensajeAceptada.trim() || ACEPTADA_FABRICA[idiomaBot]} variables={variables} />,
  };
  const fecha = (d) => new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  const pendientes = lista?.pendientes || [];
  // Las ya revisadas aquí siguen a la vista con su resultado (al recargar dejan de
  // estar pendientes y, si no, el «✅ Aceptada» se iba con ellas).
  const hechas = Object.values(revision).filter((r) => r.estado === 'hecho' && r.solicitud && !pendientes.some((p) => p._id === r.solicitud._id)).map((r) => r.solicitud);
  const visibles = [...pendientes, ...hechas];

  return (
    <div data-help="verif-aprobacion" className={card}>
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 font-bold text-fg"><UserCheck size={18} className="text-brand" /> {t('dashboard.verif_v.ap.title')}</h3>
        <p className="mt-1 text-xs leading-snug text-muted">{t('dashboard.verif_v.ap.desc')}</p>
      </div>

      {/* Quién espera al staff: nadie, todos o solo los sospechosos (1.9.15) */}
      <p className="mb-2 mt-4 text-sm font-semibold text-fg" id="ap-modo">{t('dashboard.verif_v.ap.modeTitle')}</p>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-labelledby="ap-modo">
        {MODOS.map(([m, Icono]) => {
          const sel = form.aprobacionModo === m;
          const clave = m.charAt(0).toUpperCase() + m.slice(1);
          return (
            <button key={m} type="button" role="radio" aria-checked={sel} onClick={() => cambiar({ aprobacionModo: m })}
              className={`flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${sel ? 'border-brand bg-brand/10' : 'border-line bg-bg hover:border-brand/50'}`}>
              <Icono size={18} className="mt-0.5 shrink-0 text-brand" />
              <span><span className="block text-sm font-semibold text-fg">{t(`dashboard.verif_v.ap.mode${clave}`)}</span><span className="text-xs text-muted">{t(`dashboard.verif_v.ap.mode${clave}Desc`)}</span></span>
            </button>
          );
        })}
      </div>
      {!activa && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-xs font-semibold text-success">
          <Check size={14} className="mt-0.5 shrink-0" /> {t('dashboard.verif_v.ap.offNote')}
        </p>
      )}

      {/* Qué cuenta como sospechoso */}
      {form.aprobacionModo === 'sospechosos' && (
        <div className="mt-3 space-y-2 rounded-2xl border border-line bg-bg p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.verif_v.ap.suspTitle')}</p>
          <label className="flex flex-wrap items-center gap-2 text-sm text-fg">
            <input type="checkbox" className="accent-brand" checked={form.cuentaOn} onChange={(e) => cambiar({ cuentaOn: e.target.checked })} />
            {t('dashboard.verif_v.ap.suspAge')}
            <input type="number" min={1} max={365} value={form.revisarCuentaDias} disabled={!form.cuentaOn} onChange={(e) => cambiar({ revisarCuentaDias: e.target.value })}
              className="w-20 rounded-lg border border-line bg-card px-2 py-1 text-sm text-fg focus:border-brand focus:outline-none disabled:opacity-40" aria-label={t('dashboard.verif_v.ap.suspAgeDays')} />
            {t('dashboard.verif_v.ap.suspAgeDays')}
          </label>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" className="accent-brand" checked={form.revisarSinAvatar} onChange={(e) => cambiar({ revisarSinAvatar: e.target.checked })} /> {t('dashboard.verif_v.ap.suspAvatar')}
          </label>
          <p className="flex items-center gap-2 text-sm text-fg"><span aria-hidden="true">🕵️</span> {t('dashboard.verif_v.ap.suspAnswer')}</p>
          <p className="text-xs text-muted">{t('dashboard.verif_v.ap.suspNote')}</p>
        </div>
      )}

      {activa && (!form.canalRevisionId || !rolAccesoId) && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {!form.canalRevisionId ? t('dashboard.verif_v.ap.noChannel') : t('dashboard.verif_v.ap.noRole')}
        </p>
      )}

      {activa && (
        <div className="mt-4 grid gap-4 border-t border-line pt-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.verif_v.ap.channel')}</span>
              <select value={form.canalRevisionId} onChange={(e) => cambiar({ canalRevisionId: e.target.value })} className={input}>
                <option value="">{t('dashboard.verif_v.ap.channelPh')}</option>
                {canales.map((c) => <option key={c.id} value={c.id}>#{c.nombre}</option>)}
                <OpcionCrear tipo="canal" />
              </select>
              <span className="mt-1 block text-xs text-muted">{t('dashboard.verif_v.ap.channelDesc')}</span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.verif_v.ap.pingRole')}</span>
              <select value={form.rolAvisoId} onChange={(e) => cambiar({ rolAvisoId: e.target.value })} className={input}>
                <option value="">{t('dashboard.verif_v.ap.pingRolePh')}</option>
                {roles.map((r) => <option key={r.id} value={r.id}>@{r.nombre}</option>)}
              </select>
              <span className="mt-1 block text-xs text-muted">{t('dashboard.verif_v.ap.pingRoleDesc')}</span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.verif_v.ap.rejectMsg')}</span>
              <textarea value={form.mensajeRechazo} onChange={(e) => cambiar({ mensajeRechazo: e.target.value })} rows={4} maxLength={1500} placeholder={RECHAZO_FABRICA[idiomaBot]} className={`${input} resize-y`} />
              <span className="mt-1 block text-xs text-muted">{t('dashboard.verif_v.ap.vars')}</span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.verif_v.ap.acceptMsg')}</span>
              <textarea value={form.mensajeAceptada} onChange={(e) => cambiar({ mensajeAceptada: e.target.value })} rows={3} maxLength={1500} placeholder={ACEPTADA_FABRICA[idiomaBot]} className={`${input} resize-y`} />
              <span className="mt-1 block text-xs text-muted">{t('dashboard.verif_v.ap.acceptVars')}</span>
            </label>
            <EstadoAutoguardado estado={autoguardado} />
          </div>
          <div>
            <div className="mb-2 flex flex-wrap gap-1.5" role="tablist" aria-label={t('dashboard.verif_v.ap.preview')}>
              {['staff', 'rechazo', 'aceptada'].map((v) => (
                <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setVista(v)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${vista === v ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:text-fg'}`}>
                  {t(`dashboard.verif_v.ap.prev_${v}`)}
                </button>
              ))}
            </div>
            {previas[vista]}
          </div>
        </div>
      )}

      {/* Solicitudes por revisar (también llegan al canal con sus botones) */}
      {(activa || visibles.length > 0) && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-fg">
              {t('dashboard.verif_v.ap.pending')}
              {pendientes.length > 0 && <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">{pendientes.length}</span>}
            </p>
            <button type="button" onClick={recargar} className="rounded-xl border border-line p-2 text-muted transition-colors hover:text-fg" aria-label={t('dashboard.verif_v.ap.refresh')} title={t('dashboard.verif_v.ap.refresh')}><RefreshCw size={14} /></button>
          </div>
          {errorLista && (
            <p className="mb-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t('dashboard.verif_v.ap.errList')}
            </p>
          )}
          {visibles.length === 0 ? (errorLista ? null : (
            <p className="py-3 text-center text-sm italic text-muted">{t('dashboard.verif_v.ap.empty')}</p>
          )) : (
            <div className="space-y-3">
              {visibles.map((s) => (
                <div key={s._id} className="rounded-2xl border border-line bg-bg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-fg">@{s.userTag || s.userId}</p>
                    <span className="text-xs text-muted">{fecha(s.fecha)}</span>
                  </div>
                  {(s.motivos || []).length > 0 && (
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                      <span className="font-semibold text-warning">⚠️ {t('dashboard.verif_v.ap.why')}:</span>
                      {s.motivos.map((m) => <span key={m} className="rounded-full bg-warning/10 px-2 py-0.5 font-semibold text-warning">{t(`dashboard.verif_v.ap.motivo_${m}`)}</span>)}
                    </p>
                  )}
                  {(s.resumen || []).length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {s.resumen.map((r, i) => <p key={i} className="text-xs text-muted"><span className="font-medium text-fg">{r.pregunta}:</span> {r.respuesta}</p>)}
                    </div>
                  )}
                  {revision[s._id]?.estado !== 'hecho' && (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={revision[s._id]?.estado === 'enviando'} onClick={() => revisar(s, true)}
                          className="flex items-center gap-1.5 rounded-xl bg-success px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Check size={13} /> {t('dashboard.verif_v.ap.accept')}</button>
                        <button type="button" disabled={revision[s._id]?.estado === 'enviando'} onClick={() => cambiarRevision(s._id, { rechazando: !revision[s._id]?.rechazando, texto: '' })}
                          className="flex items-center gap-1.5 rounded-xl border border-danger/50 px-3 py-1.5 text-xs font-bold text-danger disabled:opacity-50"><X size={13} /> {t('dashboard.verif_v.ap.reject')}</button>
                      </div>
                      {revision[s._id]?.rechazando && (
                        <div className="flex flex-wrap gap-2">
                          <input value={revision[s._id]?.motivo || ''} onChange={(e) => cambiarRevision(s._id, { motivo: e.target.value, texto: '' })} maxLength={1000}
                            placeholder={t('dashboard.verif_v.ap.reasonPh')} className={`${input} min-w-0 flex-1`} />
                          <button type="button" onClick={() => revisar(s, false)} className="rounded-xl bg-danger px-3 py-1.5 text-xs font-bold text-white">{t('dashboard.verif_v.ap.sendReject')}</button>
                        </div>
                      )}
                    </div>
                  )}
                  {revision[s._id]?.texto && <p className={`mt-2 text-xs font-semibold ${revision[s._id]?.error ? 'text-danger' : 'text-success'}`}>{revision[s._id].texto}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
