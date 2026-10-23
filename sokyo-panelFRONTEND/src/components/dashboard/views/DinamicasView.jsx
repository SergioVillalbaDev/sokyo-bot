// Comunidad · Dinámicas — mini-juegos automáticos para mantener vivo el servidor.
// Una tarjeta plegable por dinámica; cada una guarda su trozo de config por su
// cuenta (dash.guardarDinamicas({ [clave]: {...} })). De momento se muestra solo
// la recompensa en XP (el oro está cableado en el backend pero oculto aquí).
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown, Info, Save, Plus, Trash2, Check,
  HelpCircle, Coins, Hash, Brain, Flame, Key, Crown, Trophy,
} from 'lucide-react';
import { SubirImagen } from './comunidadShared.jsx';

const card = 'rounded-3xl border border-line bg-card shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';
const label = 'mb-1.5 block text-sm font-semibold text-fg';

// Valores por defecto (espejo del esquema) para tener inputs controlados aunque
// el servidor aún no tenga la dinámica guardada.
const m = (texto = '') => ({ texto, imagen: null });
const DEFAULTS = {
  qotd: { activo: false, canalId: '', hora: 12, xp: 50, mencionRolId: '', preguntas: [], mensajes: { pregunta: m(), acierto: m('⭐ {user} was the first to answer! +{xp} XP 🎉') } },
  gota: { activo: false, canalId: '', cadaMin: 120, ventanaSeg: 60, xp: 75, emoji: '🪙', mensajes: { anuncio: m('React with {emoji} to grab **{xp} XP**!\nOnly the first one gets it. Quick! ⚡'), acierto: m('{emoji} {user} grabbed the drop and wins **{xp} XP**! 🎉'), fallo: m('Nobody grabbed it in time… 😢') } },
  contador: { activo: false, canalId: '', repetirUsuario: false, xp: 1, borrarErrores: true, mensajes: { acierto: m(''), fallo: m('💥 The count broke! The correct number was **{number}**. Start over from **1**!') } },
  trivia: { activo: false, canalId: '', hora: 18, xp: 30, segundos: 30, mensajes: { pregunta: m(), acierto: m('✅ Correct! +{xp} XP'), fallo: m('❌ Wrong answer. Better luck next time!') } },
  reto: { activo: false, canalId: '', objetivo: 20, xp: 40, avisarCanalId: '', mensajes: { acierto: m('🎯 {user} completed the daily challenge! +{xp} XP · Streak 🔥 **{streak}** day(s).') } },
  tesoro: { activo: false, canalId: '', palabra: '', xp: 60, unaVez: true, encontrada: false, mensajes: { acierto: m('🏆 {user} found the secret word!') } },
  miembroSemana: { activo: false, canalId: '', rolId: '', dia: 1, hora: 12, xp: 200, mensajes: { anuncio: m('Congrats {user}! You were the most active member of the week with **{messages}** messages.') } },
  logros: { activo: false, canalId: '', hitosMiembros: [100, 250, 500, 1000, 5000], hitosNivel: [10, 25, 50, 100], mensajes: { miembros: m('We’re now **{members}** members in **{server}**! Thanks for being here 💜'), nivel: m('{user} is the first to reach **level {level}**! 🚀') } },
};

// Slots de mensaje por dinámica y placeholders disponibles en cada uno.
const SLOTS_POR_DIN = {
  qotd: ['pregunta', 'acierto'],
  gota: ['anuncio', 'acierto', 'fallo'],
  contador: ['acierto', 'fallo'],
  trivia: ['pregunta', 'acierto', 'fallo'],
  reto: ['acierto'],
  tesoro: ['acierto'],
  miembroSemana: ['anuncio'],
  logros: ['miembros', 'nivel'],
};
const VARS = {
  qotd: { pregunta: [], acierto: ['user', 'xp'] },
  gota: { anuncio: ['emoji', 'xp'], acierto: ['user', 'xp', 'emoji'], fallo: ['emoji'] },
  contador: { acierto: ['user', 'numero'], fallo: ['user', 'numero'] },
  trivia: { pregunta: [], acierto: ['user', 'xp'], fallo: ['user'] },
  reto: { acierto: ['user', 'xp', 'racha'] },
  tesoro: { acierto: ['user', 'palabra'] },
  miembroSemana: { anuncio: ['user', 'xp', 'mensajes'] },
  logros: { miembros: ['miembros', 'servidor'], nivel: ['user', 'nivel'] },
};

const ICONOS = {
  qotd: HelpCircle, gota: Coins, contador: Hash, trivia: Brain,
  reto: Flame, tesoro: Key, miembroSemana: Crown, logros: Trophy,
};

const ORDEN = ['qotd', 'gota', 'contador', 'trivia', 'reto', 'tesoro', 'miembroSemana', 'logros'];

// --- Campos reutilizables ---
function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded accent-brand" />
      <span className="text-sm text-fg">{children}</span>
    </label>
  );
}

function CanalSelect({ value, onChange, canales, placeholder, allowAny }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={input}>
      <option value="">{allowAny ? placeholder : `— ${placeholder} —`}</option>
      {canales.map((c) => <option key={c.id} value={c.id}>#{c.nombre}</option>)}
    </select>
  );
}

export default function DinamicasView({ dash }) {
  const { t } = useTranslation();
  const { configServidor, canales = [], roles = [], guardarDinamicas, subirImagen } = dash;
  const din = configServidor?.dinamicas || {};

  const [form, setForm] = useState({});
  const [abierta, setAbierta] = useState('qotd');
  const [estado, setEstado] = useState({}); // por dinámica: 'saving' | 'saved' | 'error'

  // Inicializa/recarga el formulario cuando llega la config del servidor.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const next = {};
    for (const k of ORDEN) next[k] = { ...DEFAULTS[k], ...(din[k] || {}) };
    setForm(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = (dyn, campo, valor) => {
    setForm((f) => ({ ...f, [dyn]: { ...f[dyn], [campo]: valor } }));
    setEstado((s) => ({ ...s, [dyn]: undefined }));
  };
  // Setter para un campo (texto/imagen) de un mensaje concreto de la dinámica.
  const setMsg = (dyn, slot, campo, valor) => {
    setForm((f) => ({
      ...f,
      [dyn]: { ...f[dyn], mensajes: { ...f[dyn].mensajes, [slot]: { ...(f[dyn].mensajes?.[slot] || {}), [campo]: valor } } },
    }));
    setEstado((s) => ({ ...s, [dyn]: undefined }));
  };

  const guardar = async (dyn) => {
    setEstado((s) => ({ ...s, [dyn]: 'saving' }));
    const ok = await guardarDinamicas({ [dyn]: form[dyn] });
    setEstado((s) => ({ ...s, [dyn]: ok ? 'saved' : 'error' }));
  };

  const dias = t('dashboard.dinamicas_v.days', { returnObjects: true });

  if (!form.qotd) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;

  // Cuerpo de cada dinámica (campos propios). Devuelve JSX.
  const cuerpos = {
    qotd: (f) => (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><span className={label}>{t('dashboard.dinamicas_v.channel')}</span><CanalSelect value={f.canalId} onChange={(v) => set('qotd', 'canalId', v)} canales={canales} placeholder={t('dashboard.dinamicas_v.channelPh')} /></div>
          <div><span className={label}>{t('dashboard.dinamicas_v.hour')}</span><input type="number" min={0} max={23} value={f.hora} onChange={(e) => set('qotd', 'hora', e.target.value)} className={input} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><span className={label}>{t('dashboard.dinamicas_v.xp')}</span><input type="number" min={0} value={f.xp} onChange={(e) => set('qotd', 'xp', e.target.value)} className={input} /></div>
          <div>
            <span className={label}>{t('dashboard.dinamicas_v.qotdMention')}</span>
            <select value={f.mencionRolId || ''} onChange={(e) => set('qotd', 'mencionRolId', e.target.value)} className={input}>
              <option value="">{t('dashboard.dinamicas_v.roleNone')}</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
        </div>
        <div>
          <span className={label}>{t('dashboard.dinamicas_v.qotdQuestions')}</span>
          <textarea
            rows={5}
            value={(f.preguntas || []).join('\n')}
            onChange={(e) => set('qotd', 'preguntas', e.target.value.split('\n'))}
            className={input}
            placeholder={t('dashboard.dinamicas_v.qotdQuestionsPh')}
          />
          <p className="mt-1 text-xs text-muted">{t('dashboard.dinamicas_v.qotdQuestionsHint', { n: (f.preguntas || []).filter((q) => q.trim()).length })}</p>
        </div>
      </div>
    ),
    gota: (f) => (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><span className={label}>{t('dashboard.dinamicas_v.channel')}</span><CanalSelect value={f.canalId} onChange={(v) => set('gota', 'canalId', v)} canales={canales} placeholder={t('dashboard.dinamicas_v.channelPh')} /></div>
          <div><span className={label}>{t('dashboard.dinamicas_v.gotaEmoji')}</span><input value={f.emoji} onChange={(e) => set('gota', 'emoji', e.target.value)} className={input} maxLength={8} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><span className={label}>{t('dashboard.dinamicas_v.gotaEvery')}</span><input type="number" min={1} value={f.cadaMin} onChange={(e) => set('gota', 'cadaMin', e.target.value)} className={input} /></div>
          <div><span className={label}>{t('dashboard.dinamicas_v.gotaWindow')}</span><input type="number" min={5} value={f.ventanaSeg} onChange={(e) => set('gota', 'ventanaSeg', e.target.value)} className={input} /></div>
          <div><span className={label}>{t('dashboard.dinamicas_v.xp')}</span><input type="number" min={0} value={f.xp} onChange={(e) => set('gota', 'xp', e.target.value)} className={input} /></div>
        </div>
      </div>
    ),
    contador: (f) => (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><span className={label}>{t('dashboard.dinamicas_v.channel')}</span><CanalSelect value={f.canalId} onChange={(v) => set('contador', 'canalId', v)} canales={canales} placeholder={t('dashboard.dinamicas_v.channelPh')} /></div>
          <div><span className={label}>{t('dashboard.dinamicas_v.xp')}</span><input type="number" min={0} value={f.xp} onChange={(e) => set('contador', 'xp', e.target.value)} className={input} /></div>
        </div>
        <div className="space-y-2">
          <Toggle checked={f.repetirUsuario} onChange={(v) => set('contador', 'repetirUsuario', v)}>{t('dashboard.dinamicas_v.contadorRepeat')}</Toggle>
          <Toggle checked={f.borrarErrores} onChange={(v) => set('contador', 'borrarErrores', v)}>{t('dashboard.dinamicas_v.contadorDelete')}</Toggle>
        </div>
      </div>
    ),
    trivia: (f) => (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><span className={label}>{t('dashboard.dinamicas_v.channel')}</span><CanalSelect value={f.canalId} onChange={(v) => set('trivia', 'canalId', v)} canales={canales} placeholder={t('dashboard.dinamicas_v.channelPh')} /></div>
          <div><span className={label}>{t('dashboard.dinamicas_v.hour')}</span><input type="number" min={0} max={23} value={f.hora} onChange={(e) => set('trivia', 'hora', e.target.value)} className={input} /></div>
          <div><span className={label}>{t('dashboard.dinamicas_v.xp')}</span><input type="number" min={0} value={f.xp} onChange={(e) => set('trivia', 'xp', e.target.value)} className={input} /></div>
        </div>
        <div><span className={label}>{t('dashboard.dinamicas_v.triviaSeconds')}</span><input type="number" min={5} value={f.segundos} onChange={(e) => set('trivia', 'segundos', e.target.value)} className={`${input} sm:max-w-[200px]`} /></div>
        <TriviaBanco dash={dash} />
      </div>
    ),
    reto: (f) => (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><span className={label}>{t('dashboard.dinamicas_v.retoChannel')}</span><CanalSelect value={f.canalId} onChange={(v) => set('reto', 'canalId', v)} canales={canales} placeholder={t('dashboard.dinamicas_v.anyChannel')} allowAny /></div>
          <div><span className={label}>{t('dashboard.dinamicas_v.retoGoal')}</span><input type="number" min={1} value={f.objetivo} onChange={(e) => set('reto', 'objetivo', e.target.value)} className={input} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><span className={label}>{t('dashboard.dinamicas_v.xp')}</span><input type="number" min={0} value={f.xp} onChange={(e) => set('reto', 'xp', e.target.value)} className={input} /></div>
          <div><span className={label}>{t('dashboard.dinamicas_v.retoNotify')}</span><CanalSelect value={f.avisarCanalId} onChange={(v) => set('reto', 'avisarCanalId', v)} canales={canales} placeholder={t('dashboard.dinamicas_v.retoNotifyPh')} allowAny /></div>
        </div>
      </div>
    ),
    tesoro: (f) => (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><span className={label}>{t('dashboard.dinamicas_v.tesoroWord')}</span><input value={f.palabra} onChange={(e) => set('tesoro', 'palabra', e.target.value)} className={input} placeholder={t('dashboard.dinamicas_v.tesoroWordPh')} /></div>
          <div><span className={label}>{t('dashboard.dinamicas_v.tesoroChannel')}</span><CanalSelect value={f.canalId} onChange={(v) => set('tesoro', 'canalId', v)} canales={canales} placeholder={t('dashboard.dinamicas_v.anyChannel')} allowAny /></div>
        </div>
        <div><span className={label}>{t('dashboard.dinamicas_v.xp')}</span><input type="number" min={0} value={f.xp} onChange={(e) => set('tesoro', 'xp', e.target.value)} className={`${input} sm:max-w-[200px]`} /></div>
        <Toggle checked={f.unaVez} onChange={(v) => set('tesoro', 'unaVez', v)}>{t('dashboard.dinamicas_v.tesoroOnce')}</Toggle>
        {f.encontrada && <p className="text-xs text-warning">{t('dashboard.dinamicas_v.tesoroFound')}</p>}
      </div>
    ),
    miembroSemana: (f) => (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><span className={label}>{t('dashboard.dinamicas_v.channel')}</span><CanalSelect value={f.canalId} onChange={(v) => set('miembroSemana', 'canalId', v)} canales={canales} placeholder={t('dashboard.dinamicas_v.channelPh')} /></div>
          <div>
            <span className={label}>{t('dashboard.dinamicas_v.msRole')}</span>
            <select value={f.rolId || ''} onChange={(e) => set('miembroSemana', 'rolId', e.target.value)} className={input}>
              <option value="">{t('dashboard.dinamicas_v.roleNone')}</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <span className={label}>{t('dashboard.dinamicas_v.msDay')}</span>
            <select value={f.dia} onChange={(e) => set('miembroSemana', 'dia', parseInt(e.target.value, 10))} className={input}>
              {Array.isArray(dias) && dias.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div><span className={label}>{t('dashboard.dinamicas_v.hour')}</span><input type="number" min={0} max={23} value={f.hora} onChange={(e) => set('miembroSemana', 'hora', e.target.value)} className={input} /></div>
          <div><span className={label}>{t('dashboard.dinamicas_v.xp')}</span><input type="number" min={0} value={f.xp} onChange={(e) => set('miembroSemana', 'xp', e.target.value)} className={input} /></div>
        </div>
      </div>
    ),
    logros: (f) => (
      <div className="space-y-4">
        <div><span className={label}>{t('dashboard.dinamicas_v.channel')}</span><CanalSelect value={f.canalId} onChange={(v) => set('logros', 'canalId', v)} canales={canales} placeholder={t('dashboard.dinamicas_v.channelPh')} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><span className={label}>{t('dashboard.dinamicas_v.logrosMembers')}</span><input value={(f.hitosMiembros || []).join(', ')} onChange={(e) => set('logros', 'hitosMiembros', parseNums(e.target.value))} className={input} placeholder="100, 250, 500" /></div>
          <div><span className={label}>{t('dashboard.dinamicas_v.logrosLevels')}</span><input value={(f.hitosNivel || []).join(', ')} onChange={(e) => set('logros', 'hitosNivel', parseNums(e.target.value))} className={input} placeholder="10, 25, 50" /></div>
        </div>
        <p className="text-xs text-muted">{t('dashboard.dinamicas_v.logrosHint')}</p>
      </div>
    ),
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.dinamicas_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.dinamicas_v.note')}</p>
      </div>

      <div data-help="dinamicas-lista" className="space-y-3">
        {ORDEN.map((dyn) => {
          const f = form[dyn];
          const Icono = ICONOS[dyn];
          const open = abierta === dyn;
          const st = estado[dyn];
          return (
            <div key={dyn} className={card}>
              <button
                type="button"
                onClick={() => setAbierta(open ? null : dyn)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${f.activo ? 'bg-brand/15 text-brand' : 'bg-elevated text-muted'}`}>
                  <Icono size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-fg">{t(`dashboard.dinamicas_v.items.${dyn}.name`)}</span>
                    {f.activo && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase text-success">{t('dashboard.dinamicas_v.on')}</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{t(`dashboard.dinamicas_v.items.${dyn}.desc`)}</span>
                </span>
                <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="border-t border-line p-4 sm:p-5">
                  <div className="mb-4">
                    <Toggle checked={f.activo} onChange={(v) => set(dyn, 'activo', v)}>
                      <span className="font-semibold">{t('dashboard.dinamicas_v.active')}</span>
                    </Toggle>
                  </div>

                  {cuerpos[dyn](f)}

                  <MensajesSection dyn={dyn} f={f} setMsg={setMsg} subirImagen={subirImagen} t={t} />

                  <div className="mt-5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => guardar(dyn)}
                      disabled={st === 'saving'}
                      className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Save size={15} /> {st === 'saving' ? t('dashboard.dinamicas_v.saving') : t('dashboard.dinamicas_v.save')}
                    </button>
                    {st === 'saved' && <span className="flex items-center gap-1 text-sm font-semibold text-success"><Check size={14} /> {t('dashboard.dinamicas_v.saved')}</span>}
                    {st === 'error' && <span className="text-sm font-semibold text-danger">{t('dashboard.dinamicas_v.error')}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function parseNums(str) {
  return String(str).split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0);
}

// Sección "Mensajes": un editor (texto + imagen/GIF por link o PC) por cada slot
// que tiene la dinámica (acierto, fallo, anuncio…).
function MensajesSection({ dyn, f, setMsg, subirImagen, t }) {
  const slots = SLOTS_POR_DIN[dyn] || [];
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h4 className="mb-3 text-sm font-bold text-fg">{t('dashboard.dinamicas_v.msgSection')}</h4>
      <div className="space-y-3">
        {slots.map((slot) => {
          const msg = f.mensajes?.[slot] || {};
          const vars = VARS[dyn]?.[slot] || [];
          const esContadorAcierto = dyn === 'contador' && slot === 'acierto';
          return (
            <div key={slot} className="rounded-xl border border-line bg-bg p-3">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="text-xs font-semibold text-fg">{t(`dashboard.dinamicas_v.slots.${slot}`)}</span>
                {vars.length > 0 && (
                  <span className="text-[10px] text-muted">{t('dashboard.dinamicas_v.msgVars')}: {vars.map((v) => `{${v}}`).join(' ')}</span>
                )}
              </div>
              <textarea
                rows={2}
                value={msg.texto || ''}
                onChange={(e) => setMsg(dyn, slot, 'texto', e.target.value)}
                className={input}
                maxLength={1000}
                placeholder={esContadorAcierto ? t('dashboard.dinamicas_v.contadorAciertoHint') : t('dashboard.dinamicas_v.msgTextPh')}
              />
              <div className="mt-2">
                <SubirImagen value={msg.imagen || ''} onChange={(v) => setMsg(dyn, slot, 'imagen', v)} subirImagen={subirImagen} titulo={t('dashboard.dinamicas_v.msgImage')} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Sub-bloque: banco de preguntas de la trivia (crear / borrar).
function TriviaBanco({ dash }) {
  const { t } = useTranslation();
  const { trivia = [], crearTrivia, eliminarTrivia } = dash;
  const [pregunta, setPregunta] = useState('');
  const [opciones, setOpciones] = useState(['', '']);
  const [correcta, setCorrecta] = useState(0);
  const [estado, setEstado] = useState('');

  const setOp = (i, v) => setOpciones((o) => o.map((x, idx) => (idx === i ? v : x)));
  const addOp = () => setOpciones((o) => (o.length < 4 ? [...o, ''] : o));
  const delOp = (i) => setOpciones((o) => o.filter((_, idx) => idx !== i));

  const crear = async () => {
    setEstado('saving');
    const ops = opciones.map((o) => o.trim()).filter(Boolean);
    const r = await crearTrivia({ pregunta, opciones: ops, correcta: Math.min(correcta, ops.length - 1) });
    if (r?.error) { setEstado(`error:${r.error}`); return; }
    setPregunta(''); setOpciones(['', '']); setCorrecta(0); setEstado('');
  };

  return (
    <div className="rounded-2xl border border-line bg-bg p-4">
      <h4 className="mb-3 font-bold text-fg">{t('dashboard.dinamicas_v.triviaBank')}</h4>

      {trivia.length === 0 ? (
        <p className="py-3 text-center text-sm italic text-muted">{t('dashboard.dinamicas_v.triviaEmpty')}</p>
      ) : (
        <div className="mb-4 space-y-2">
          {trivia.map((q) => (
            <div key={q._id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-fg">{q.pregunta}</p>
                <p className="truncate text-xs text-muted">{q.opciones?.[q.correcta]} ✓</p>
              </div>
              <button type="button" onClick={() => eliminarTrivia(q._id)} className="shrink-0 text-muted transition-colors hover:text-danger"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <input value={pregunta} onChange={(e) => setPregunta(e.target.value)} className={input} placeholder={t('dashboard.dinamicas_v.triviaQuestionPh')} maxLength={300} />
        {opciones.map((op, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="trivia-correcta" checked={correcta === i} onChange={() => setCorrecta(i)} className="h-4 w-4 accent-brand" title={t('dashboard.dinamicas_v.triviaCorrect')} />
            <input value={op} onChange={(e) => setOp(i, e.target.value)} className={input} placeholder={`${t('dashboard.dinamicas_v.triviaOption')} ${i + 1}`} maxLength={100} />
            {opciones.length > 2 && <button type="button" onClick={() => delOp(i)} className="shrink-0 rounded-xl border border-line px-2.5 py-2 text-muted hover:text-danger"><Trash2 size={13} /></button>}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          {opciones.length < 4 && (
            <button type="button" onClick={addOp} className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-1.5 text-xs text-muted hover:border-brand hover:text-brand">
              <Plus size={13} /> {t('dashboard.dinamicas_v.triviaAddOption')}
            </button>
          )}
          <button
            type="button"
            onClick={crear}
            disabled={estado === 'saving' || !pregunta.trim() || opciones.filter((o) => o.trim()).length < 2}
            className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            <Plus size={13} /> {t('dashboard.dinamicas_v.triviaAdd')}
          </button>
          {estado.startsWith('error:') && <span className="text-xs font-semibold text-danger">{estado.slice(6)}</span>}
        </div>
      </div>
    </div>
  );
}
