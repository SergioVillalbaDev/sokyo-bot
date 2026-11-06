// Seguridad · Verificación → opciones de la verificación (1.9.15), para la normal y la
// doble bienvenida: requisitos (edad de la cuenta, foto, espera), normas que hay que
// aceptar, el captcha (letras, intentos, tiempo y qué pasa al fallar), lo que pasa al
// verificarse (roles de más, rol «Sin verificar», mensaje y privado), quien no se
// verifica (recordatorio y expulsión) y el canal del registro. Cada bloque se abre y
// se cierra, con un resumen en la cabecera. Se guarda solo (`opcionesEntrada`).
// Bot: utils/puertaEntrada.js.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, ScrollText, Puzzle, PartyPopper, Hourglass, NotebookPen, ChevronDown, X, Info } from 'lucide-react';
import { Toggle } from '../../ui/primitives';
import { useAutoguardado } from '../../../hooks/useAutoguardado';
import { useDesdeServidor } from '../../../hooks/useDesdeServidor';
import EstadoAutoguardado from '../EstadoAutoguardado';
import TextareaCanales from '../TextareaCanales';
import VistaDiscord from '../VistaDiscord';
import { OpcionCrear } from '../CrearAlVuelo';

const card = 'rounded-3xl border border-line bg-card shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';
const etiqueta = 'mb-1.5 block text-sm font-semibold text-fg';
const ayuda = 'mt-1 block text-xs text-muted';

// Lo de fábrica: lo mismo que DEF en utils/puertaEntrada.js.
const DEF = {
  edadMinDias: 0, exigirAvatar: false, esperaMinutos: 0,
  normasActivo: false, normasTexto: '', normasBoton: '',
  captchaLongitud: 5, captchaIntentos: 3, captchaMinutos: 5, captchaFallo: 'esperar',
  rolesExtra: [], rolNoVerificadoId: '',
  mensajeExito: '', dmActivo: false, mensajeDM: '',
  expulsarHoras: 0, recordatorio: true, mensajeExpulsion: '',
  canalRegistroId: '',
};
const formDesde = (o = {}) => ({
  ...DEF, ...o,
  rolesExtra: Array.isArray(o.rolesExtra) ? o.rolesExtra : [], rolNoVerificadoId: o.rolNoVerificadoId || '', canalRegistroId: o.canalRegistroId || '',
});
// Para guardar: sin lo que lleva el bot (desde cuándo cuenta la expulsión).
const paraGuardar = (f) => { const c = { ...f }; delete c.expulsarDesde; return c; };

const EDADES = [0, 1, 3, 7, 14, 30, 90];
const ESPERAS = [0, 1, 2, 5, 10, 30, 60];
const MINUTOS = [1, 2, 3, 5, 10, 15, 30];
const EXPULSAR = [0, 1, 6, 12, 24, 48, 72, 168];
const FALLOS = ['esperar', 'aislar', 'expulsar'];
// Las opciones de un desplegable, con el valor guardado aunque no sea de la lista.
const conValor = (lista, v) => (lista.includes(Number(v)) ? lista : [...lista, Number(v)].sort((a, b) => a - b));

function Seccion({ id, abierta, onAbrir, Icono, color, titulo, desc, resumen, activo, children }) {
  return (
    <div className={card} data-help={`verif-op-${id}`}>
      <button type="button" onClick={() => onAbrir(abierta ? null : id)} aria-expanded={abierta}
        className="flex w-full items-center gap-3 p-4 text-left sm:p-5">
        <span className="sk-icono-grupo h-9 w-9 shrink-0" style={{ '--grupo': color }}><Icono size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-fg">{titulo}</span>
          <span className="block text-xs text-muted">{desc}</span>
        </span>
        {resumen && (
          <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline ${activo ? 'bg-success/10 text-success' : 'bg-elevated text-muted'}`}>{resumen}</span>
        )}
        <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${abierta ? 'rotate-180' : ''}`} />
      </button>
      {abierta && <div className="space-y-4 border-t border-line p-4 sm:p-5">{children}</div>}
    </div>
  );
}

export default function OpcionesEntrada({ dash, modo }) {
  const { t } = useTranslation();
  const { configServidor, roles = [], canales = [], servidorInfo, guardarOpcionesEntrada } = dash;
  const [form, setForm] = useState(() => formDesde());
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState('requisitos');

  useDesdeServidor(configServidor, () => { if (configServidor) setForm(formDesde(configServidor.opcionesEntrada || {})); });
  const guardar = async () => {
    const r = await guardarOpcionesEntrada(paraGuardar(form));
    if (r === true) { setError(''); return true; }
    setError(r?.codigo === 'mismo-rol' ? t('dashboard.verif_v.op.errSameRole') : (r?.error || t('dashboard.verif_v.op.saveErr')));
    return false;
  };
  const autoguardado = useAutoguardado(form, guardar, { listo: !!configServidor, borrador: 'opciones-entrada', restaurar: (v) => setForm(formDesde(v || {})) });
  const cambiar = (parche) => setForm((f) => ({ ...f, ...parche }));

  const nombreRol = (id) => roles.find((r) => r.id === id)?.nombre || '?';
  const servidor = servidorInfo?.nombre || 'Nébula';
  const variables = { user: '@Alex', usuario: '@Alex', mention: '@Alex', server: servidor, servidor, horas: form.expulsarHoras, hours: form.expulsarHoras };
  const on = t('dashboard.verif_v.op.on');
  const off = t('dashboard.verif_v.op.off');
  const dias = (n) => (n ? t('dashboard.verif_v.op.ageDays', { n }) : t('dashboard.verif_v.op.ageNone'));
  const horas = (n) => (!n ? t('dashboard.verif_v.op.kickNever') : n % 24 === 0 && n >= 48 ? t('dashboard.verif_v.op.kickDays', { n: n / 24 }) : t('dashboard.verif_v.op.kickHours', { n }));
  const requisitos = [form.edadMinDias > 0 && dias(form.edadMinDias), form.exigirAvatar && '🖼️', form.esperaMinutos > 0 && t('dashboard.verif_v.op.waitMin', { n: form.esperaMinutos })].filter(Boolean);
  const alVerificarse = form.rolesExtra.length + (form.rolNoVerificadoId ? 1 : 0) + (form.dmActivo ? 1 : 0) + (form.mensajeExito.trim() ? 1 : 0);
  const sel = (v) => (ev) => cambiar({ [v]: Number(ev.target.value) });
  const props = (id) => ({ id, abierta: abierta === id, onAbrir: setAbierta });

  return (
    <div className="space-y-3">
      {/* Requisitos para verificarse */}
      <Seccion {...props('requisitos')} Icono={ShieldAlert} color="#f97316" titulo={t('dashboard.verif_v.op.reqTitle')} desc={t('dashboard.verif_v.op.reqDesc')}
        resumen={requisitos.length ? requisitos.join(' · ') : off} activo={requisitos.length > 0}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={etiqueta}>{t('dashboard.verif_v.op.age')}</span>
            <select value={form.edadMinDias} onChange={sel('edadMinDias')} className={input}>
              {conValor(EDADES, form.edadMinDias).map((n) => <option key={n} value={n}>{dias(n)}</option>)}
            </select>
            <span className={ayuda}>{t('dashboard.verif_v.op.ageDesc')}</span>
          </label>
          <label className="block">
            <span className={etiqueta}>{t('dashboard.verif_v.op.wait')}</span>
            <select value={form.esperaMinutos} onChange={sel('esperaMinutos')} className={input}>
              {conValor(ESPERAS, form.esperaMinutos).map((n) => <option key={n} value={n}>{n ? t('dashboard.verif_v.op.waitMin', { n }) : t('dashboard.verif_v.op.waitNone')}</option>)}
            </select>
            <span className={ayuda}>{t('dashboard.verif_v.op.waitDesc')}</span>
          </label>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0"><span className="block text-sm font-semibold text-fg">{t('dashboard.verif_v.op.avatar')}</span><span className="block text-xs text-muted">{t('dashboard.verif_v.op.avatarDesc')}</span></span>
          <Toggle checked={form.exigirAvatar} onChange={(v) => cambiar({ exigirAvatar: v })} />
        </div>
      </Seccion>

      {/* Normas que hay que aceptar */}
      <Seccion {...props('normas')} Icono={ScrollText} color="#a855f7" titulo={t('dashboard.verif_v.op.rulesTitle')} desc={t('dashboard.verif_v.op.rulesDesc')}
        resumen={form.normasActivo && modo !== 'ab' ? on : off} activo={form.normasActivo && modo !== 'ab'}>
        {modo === 'ab' ? (
          <p className="flex items-start gap-2 text-sm text-muted"><Info size={15} className="mt-0.5 shrink-0 text-brand" /> {t('dashboard.verif_v.op.rulesAb')}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-fg">{t('dashboard.verif_v.op.rulesTitle')}</span>
              <Toggle checked={form.normasActivo} onChange={(v) => cambiar({ normasActivo: v })} />
            </div>
            {form.normasActivo && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <label className="block">
                    <span className={etiqueta}>{t('dashboard.verif_v.op.rulesText')}</span>
                    <TextareaCanales canales={canales} value={form.normasTexto} onChange={(ev) => cambiar({ normasTexto: ev.target.value })} onValor={(val) => cambiar({ normasTexto: val })}
                      rows={6} maxLength={4000} placeholder={t('dashboard.verif_v.op.rulesPh')} className={`${input} resize-y`} />
                  </label>
                  <label className="block">
                    <span className={etiqueta}>{t('dashboard.verif_v.op.rulesButton')}</span>
                    <input value={form.normasBoton} maxLength={80} onChange={(ev) => cambiar({ normasBoton: ev.target.value })} placeholder={t('dashboard.verif_v.op.rulesButtonPh')} className={input} />
                  </label>
                </div>
                {/* Así lo ve (utils/puertaEntrada.js: pantallaNormas) */}
                <VistaDiscord embed={{ titulo: t('dashboard.verif_v.op.prevRulesTitle'), descripcion: `${form.normasTexto.trim() || t('dashboard.verif_v.op.rulesPh')}\n\n-# ${t('dashboard.verif_v.op.prevRulesFoot')}`, color: configServidor?.colorEmbed || '#5865F2' }}
                  botones={[{ texto: form.normasBoton.trim() || t('dashboard.verif_v.op.rulesButtonPh'), estilo: 'verde' }]} />
              </div>
            )}
          </>
        )}
      </Seccion>

      {/* Captcha */}
      <Seccion {...props('captcha')} Icono={Puzzle} color="#22d3ee" titulo={t('dashboard.verif_v.op.capTitle')} desc={t('dashboard.verif_v.op.capDesc')}
        resumen={modo === 'captcha' ? `${form.captchaLongitud} · ×${form.captchaIntentos}` : off} activo={modo === 'captcha'}>
        {modo !== 'captcha' && <p className="flex items-start gap-2 text-xs text-muted"><Info size={14} className="mt-0.5 shrink-0 text-brand" /> {t('dashboard.verif_v.op.capOnly')}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={etiqueta}>{t('dashboard.verif_v.op.capLength')}</span>
            <select value={form.captchaLongitud} onChange={sel('captchaLongitud')} className={input}>{[4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <label className="block">
            <span className={etiqueta}>{t('dashboard.verif_v.op.capTries')}</span>
            <select value={form.captchaIntentos} onChange={sel('captchaIntentos')} className={input}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <label className="block">
            <span className={etiqueta}>{t('dashboard.verif_v.op.capMinutes')}</span>
            <select value={form.captchaMinutos} onChange={sel('captchaMinutos')} className={input}>{conValor(MINUTOS, form.captchaMinutos).map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
        </div>
        <div>
          <p className={etiqueta} id="op-fallo">{t('dashboard.verif_v.op.capFail')}</p>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-labelledby="op-fallo">
            {FALLOS.map((f) => (
              <button key={f} type="button" role="radio" aria-checked={form.captchaFallo === f} onClick={() => cambiar({ captchaFallo: f })}
                className={`rounded-2xl border p-3 text-left transition-colors ${form.captchaFallo === f ? 'border-brand bg-brand/10' : 'border-line bg-bg hover:border-brand/50'}`}>
                <span className="block text-sm font-semibold text-fg">{t(`dashboard.verif_v.op.fail_${f}`)}</span>
                <span className="text-xs text-muted">{t(`dashboard.verif_v.op.fail_${f}Desc`)}</span>
              </button>
            ))}
          </div>
        </div>
      </Seccion>

      {/* Al verificarse */}
      <Seccion {...props('al')} Icono={PartyPopper} color="#22c55e" titulo={t('dashboard.verif_v.op.doneTitle')} desc={t('dashboard.verif_v.op.doneDesc')}
        resumen={alVerificarse ? `${alVerificarse} · ${on}` : off} activo={alVerificarse > 0}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className={etiqueta}>{t('dashboard.verif_v.op.extraRoles')}</span>
            {form.rolesExtra.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {form.rolesExtra.map((id) => (
                  <span key={id} className="flex items-center gap-1 rounded-full border border-line bg-bg px-2.5 py-1 text-xs font-semibold text-fg">
                    @{nombreRol(id)}
                    <button type="button" onClick={() => cambiar({ rolesExtra: form.rolesExtra.filter((x) => x !== id) })} className="text-muted hover:text-danger" aria-label={`× @${nombreRol(id)}`}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            {form.rolesExtra.length < 10 && (
              <select value="" onChange={(ev) => { if (ev.target.value) cambiar({ rolesExtra: [...form.rolesExtra, ev.target.value] }); }} className={input}>
                <option value="">{t('dashboard.verif_v.op.extraRolesPh')}</option>
                {roles.filter((r) => !form.rolesExtra.includes(r.id)).map((r) => <option key={r.id} value={r.id}>@{r.nombre}</option>)}
                <OpcionCrear tipo="rol" />
              </select>
            )}
            <span className={ayuda}>{t('dashboard.verif_v.op.extraRolesDesc')}</span>
          </div>
          <label className="block">
            <span className={etiqueta}>{t('dashboard.verif_v.op.unverified')}</span>
            <select value={form.rolNoVerificadoId} onChange={(ev) => cambiar({ rolNoVerificadoId: ev.target.value })} className={input}>
              <option value="">{t('dashboard.verif_v.op.unverifiedPh')}</option>
              {roles.map((r) => <option key={r.id} value={r.id}>@{r.nombre}</option>)}
              <OpcionCrear tipo="rol" />
            </select>
            <span className={ayuda}>{t('dashboard.verif_v.op.unverifiedDesc')}</span>
          </label>
        </div>
        <label className="block">
          <span className={etiqueta}>{t('dashboard.verif_v.op.success')}</span>
          <textarea value={form.mensajeExito} onChange={(ev) => cambiar({ mensajeExito: ev.target.value })} rows={2} maxLength={1500} placeholder={t('dashboard.verif_v.op.successPh')} className={`${input} resize-y`} />
          <span className={ayuda}>{t('dashboard.verif_v.op.successDesc')}</span>
        </label>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-fg">{t('dashboard.verif_v.op.dm')}</span>
          <Toggle checked={form.dmActivo} onChange={(v) => cambiar({ dmActivo: v })} />
        </div>
        {form.dmActivo && (
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <textarea value={form.mensajeDM} onChange={(ev) => cambiar({ mensajeDM: ev.target.value })} rows={3} maxLength={1500} placeholder={t('dashboard.verif_v.op.dmPh')} className={`${input} resize-y`} aria-label={t('dashboard.verif_v.op.dm')} />
              <span className={ayuda}>{t('dashboard.verif_v.op.dmDesc')}</span>
            </label>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.verif_v.op.prevDm')}</p>
              <VistaDiscord texto={form.mensajeDM.trim() || t('dashboard.verif_v.op.dmPh')} variables={variables} />
            </div>
          </div>
        )}
      </Seccion>

      {/* Quien no se verifica */}
      <Seccion {...props('tarde')} Icono={Hourglass} color="#ef4444" titulo={t('dashboard.verif_v.op.lateTitle')} desc={t('dashboard.verif_v.op.lateDesc')}
        resumen={horas(form.expulsarHoras)} activo={form.expulsarHoras > 0}>
        <label className="block max-w-sm">
          <span className={etiqueta}>{t('dashboard.verif_v.op.kick')}</span>
          <select value={form.expulsarHoras} onChange={sel('expulsarHoras')} className={input}>
            {conValor(EXPULSAR, form.expulsarHoras).map((n) => <option key={n} value={n}>{horas(n)}</option>)}
          </select>
        </label>
        {form.expulsarHoras > 0 && (
          <>
            <p className="flex items-start gap-2 rounded-xl border border-line bg-elevated px-3 py-2 text-xs text-muted"><Info size={14} className="mt-0.5 shrink-0 text-brand" /> {t('dashboard.verif_v.op.kickNote')}</p>
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0"><span className="block text-sm font-semibold text-fg">{t('dashboard.verif_v.op.reminder')}</span><span className="block text-xs text-muted">{t('dashboard.verif_v.op.reminderDesc')}</span></span>
              <Toggle checked={form.recordatorio} onChange={(v) => cambiar({ recordatorio: v })} />
            </div>
            <label className="block">
              <span className={etiqueta}>{t('dashboard.verif_v.op.kickMsg')}</span>
              <textarea value={form.mensajeExpulsion} onChange={(ev) => cambiar({ mensajeExpulsion: ev.target.value })} rows={3} maxLength={1500} placeholder={t('dashboard.verif_v.op.kickMsgPh')} className={`${input} resize-y`} />
              <span className={ayuda}>{t('dashboard.verif_v.op.kickMsgDesc')}</span>
            </label>
          </>
        )}
      </Seccion>

      {/* Canal del registro */}
      <Seccion {...props('registro')} Icono={NotebookPen} color="#60a5fa" titulo={t('dashboard.verif_v.op.logTitle')} desc={t('dashboard.verif_v.op.logDesc')}
        resumen={form.canalRegistroId ? `#${canales.find((c) => c.id === form.canalRegistroId)?.nombre || '?'}` : off} activo={!!form.canalRegistroId}>
        <label className="block max-w-sm">
          <select value={form.canalRegistroId} onChange={(ev) => cambiar({ canalRegistroId: ev.target.value })} className={input} aria-label={t('dashboard.verif_v.op.logTitle')}>
            <option value="">{t('dashboard.verif_v.op.logPh')}</option>
            {canales.map((c) => <option key={c.id} value={c.id}>#{c.nombre}</option>)}
            <OpcionCrear tipo="canal" />
          </select>
        </label>
      </Seccion>

      <div className="flex flex-wrap items-center gap-3 px-1">
        <EstadoAutoguardado estado={autoguardado} />
        {error && <span className="text-xs font-semibold text-danger">{error}</span>}
      </div>
    </div>
  );
}
