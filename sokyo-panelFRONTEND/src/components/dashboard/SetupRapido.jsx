// Setup rápido (1.11.0): con un botón y unas preguntas, Sokyo queda funcionando en el
// servidor. Tres pasos (idioma y tipo · qué activar y dónde · confirmar) y el resultado
// de cada cosa, con botón a su sección. Lo hace el bot en utils/setupRapido.js
// (POST /api/config/:guildId/setup-rapido, solo administradores): no pisa lo que ya está
// configurado, reutiliza canales y queda en «Historial de cambios» con «Deshacer».
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, X, ChevronRight, ChevronLeft, Loader2, CheckCircle2, SkipForward, XCircle, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';

// Lo mismo que TIPOS en utils/setupRapido.js (lo que se marca por defecto según el tipo).
const TIPOS = {
  gaming: { emoji: '🎮', modulos: ['bienvenidas', 'registro', 'niveles', 'automod', 'temporadas', 'votos', 'salon', 'contadores', 'mascota', 'casino', 'bromas', 'liga', 'clanes'] },
  comunidad: { emoji: '💬', modulos: ['bienvenidas', 'registro', 'niveles', 'automod', 'temporadas', 'cumpleanos', 'votos', 'sugerencias', 'salon', 'contadores', 'mascota', 'casino', 'bromas', 'liga'] },
  creador: { emoji: '📺', modulos: ['bienvenidas', 'registro', 'niveles', 'automod', 'votos', 'sugerencias', 'salon', 'contadores', 'mascota', 'liga'] },
  estudio: { emoji: '📚', modulos: ['bienvenidas', 'registro', 'automod', 'cumpleanos', 'sugerencias', 'contadores'] },
  soporte: { emoji: '🛟', modulos: ['bienvenidas', 'registro', 'automod', 'tickets', 'sugerencias', 'contadores'] },
};
// Por grupos, con su emoji (MODULOS en utils/setupRapido.js).
const EMOJI_MODULO = {
  bienvenidas: '👋', registro: '📋', automod: '🛡️', tickets: '🎫', niveles: '📈',
  temporadas: '🏆', cumpleanos: '🎂', votos: '🗳️', sugerencias: '💡', salon: '⭐', contadores: '👥',
  mascota: '🐾', casino: '🎰', bromas: '🃏', liga: '🥇', clanes: '🛡',
};
const GRUPOS = {
  basico: ['bienvenidas', 'registro', 'automod', 'tickets', 'niveles'],
  comunidad: ['temporadas', 'cumpleanos', 'votos', 'sugerencias', 'salon', 'contadores'],
  diversion: ['mascota', 'casino', 'bromas', 'liga', 'clanes'],
};
// Qué canal necesita cada módulo (CANALES en utils/setupRapido.js).
const CANALES = {
  bienvenida: ['bienvenidas'], registro: ['registro'], anuncios: ['temporadas', 'cumpleanos', 'votos'], soporte: ['tickets'],
  sugerencias: ['sugerencias'], salon: ['salon'], mascota: ['mascota', 'liga'], casino: ['casino'],
};
// Reloj para medir cuánto ha tardado (fuera del componente: no es parte del render).
const ahoraMs = () => Date.now();
const ICONO = { ok: CheckCircle2, omitido: SkipForward, error: XCircle };
const COLOR = { ok: 'text-success', omitido: 'text-muted', error: 'text-danger' };

export function TarjetaSetupRapido({ onAbrir }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-brand/40 bg-brand/10 p-5 shadow-soft sm:flex-row sm:items-center">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-on-brand"><Zap size={20} /></span>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-fg">{t('dashboard.setup.cardTitle')}</h3>
        <p className="mt-0.5 text-sm text-muted">{t('dashboard.setup.cardSub')}</p>
      </div>
      <button type="button" onClick={onAbrir} className="sk-foco flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-on-brand transition-transform hover:scale-[1.02]">
        <Zap size={15} /> {t('dashboard.setup.start')}
      </button>
    </div>
  );
}

export default function SetupRapido({ guildId, canales = [], roles = [], onCerrar, onHecho, irA }) {
  const { t, i18n } = useTranslation();
  const [paso, setPaso] = useState(1);
  const [idioma, setIdioma] = useState(i18n.language === 'es' ? 'es' : 'en');
  const [tipo, setTipo] = useState('');
  const [modulos, setModulos] = useState([]);
  const [eleccion, setEleccion] = useState(() => Object.fromEntries(Object.keys(CANALES).map((c) => [c, 'auto'])));
  const [progreso, setProgreso] = useState(0);
  const [enMarcha, setEnMarcha] = useState([]);
  const [segundos, setSegundos] = useState(null);
  const reloj = useRef(null);
  const [rolStaffId, setRolStaffId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const elegirTipo = (id) => { setTipo(id); setModulos(TIPOS[id].modulos); };
  const alternar = (m) => setModulos((l) => (l.includes(m) ? l.filter((x) => x !== m) : [...l, m]));
  const necesarios = Object.keys(CANALES).filter((c) => CANALES[c].some((m) => modulos.includes(m)));

  // `todo`: lo recomendado para el tipo elegido, sin más preguntas (canales automáticos).
  const aplicar = async ({ todo = false } = {}) => {
    const lista = todo ? TIPOS[tipo].modulos : modulos;
    setEnviando(true); setError(''); setEnMarcha(lista); setProgreso(0);
    const inicio = ahoraMs();
    // Mientras el bot trabaja, la lista se va marcando (la de verdad llega al terminar).
    clearInterval(reloj.current);
    reloj.current = setInterval(() => setProgreso((p) => Math.min(lista.length - 1, p + 1)), 650);
    try {
      const canalesElegidos = todo ? {} : Object.fromEntries(necesarios.map((c) => [c, eleccion[c]]));
      const res = await apiFetch(`/api/config/${guildId}/setup-rapido`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idioma, tipo, modulos: lista, canales: canalesElegidos, rolStaffId: rolStaffId || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.codigo === 'permisos_bot'
          ? t('dashboard.setup.errPerms', { lista: (d.permisos || []).map((p) => t(`dashboard.setup.perm.${p}`, { defaultValue: p })).join(', ') })
          : res.status === 403 ? t('dashboard.setup.errAdmin')
            // Los errores llegan con un código: el texto, en el idioma del panel.
            : d.codigo ? t(`dashboard.setup.err.${d.codigo}`, { defaultValue: d.error || t('dashboard.setup.errGeneric') })
              : t('dashboard.setup.errGeneric'));
        return;
      }
      setSegundos(Math.max(1, Math.round((ahoraMs() - inicio) / 1000)));
      setResultado(d);
      onHecho?.();
    } catch { setError(t('dashboard.setup.errGeneric')); }
    finally { clearInterval(reloj.current); setEnviando(false); }
  };

  const Cabecera = (
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-on-brand"><Zap size={20} /></span>
      <div className="min-w-0 flex-1">
        <h2 id="setup-titulo" className="text-lg font-extrabold tracking-tight text-fg">{t('dashboard.setup.title')}</h2>
        <p className="mt-0.5 text-sm text-muted">{resultado ? t('dashboard.setup.doneSub') : t('dashboard.setup.step', { n: paso, total: 3 })}</p>
      </div>
      <button type="button" onClick={onCerrar} className="sk-boton-icono shrink-0" aria-label={t('dashboard.setup.close')}><X size={17} /></button>
    </div>
  );

  const selectCanal = (clave) => (
    <label key={clave} className="block">
      <span className="mb-1 block text-xs font-semibold text-fg">{t(`dashboard.setup.canal.${clave}`)}</span>
      <select value={eleccion[clave]} onChange={(e) => setEleccion((x) => ({ ...x, [clave]: e.target.value }))}
        className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none">
        <option value="auto">{t('dashboard.setup.auto')}</option>
        <option value="nuevo">{t('dashboard.setup.new')}</option>
        {canales.map((c) => <option key={c.id} value={c.id}># {c.nombre || c.name}</option>)}
      </select>
    </label>
  );

  let cuerpo;
  if (enviando) {
    cuerpo = (
      <>
        <p className="mt-5 text-sm font-semibold text-fg">{t('dashboard.setup.working')}</p>
        <div className="sk-barra mt-3"><span style={{ width: `${Math.round(((progreso + 1) / Math.max(1, enMarcha.length + 1)) * 100)}%` }} /></div>
        <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {enMarcha.map((m, i) => (
            <li key={m} className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm transition-colors ${i < progreso ? 'text-fg' : i === progreso ? 'bg-brand/10 text-fg' : 'text-muted'}`}>
              {i < progreso ? <CheckCircle2 size={15} className="shrink-0 text-success" /> : i === progreso ? <Loader2 size={15} className="shrink-0 animate-spin text-brand" /> : <span className="h-[15px] w-[15px] shrink-0 rounded-full border border-line" />}
              <span aria-hidden>{EMOJI_MODULO[m]}</span> {t(`dashboard.setup.paso.${m}`)}
            </li>
          ))}
        </ul>
      </>
    );
  } else if (resultado) {
    cuerpo = (
      <>
        {segundos && <p className="mt-4 rounded-2xl border border-success/40 bg-success/10 px-4 py-2.5 text-sm font-bold text-fg">🎉 {t('dashboard.setup.doneIn', { s: segundos, n: resultado.pasos.filter((p) => p.estado === 'ok').length })}</p>}
        <ul className="mt-5 space-y-2">
          {resultado.pasos.map((p) => {
            const Icono = ICONO[p.estado] || CheckCircle2;
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2.5">
                <Icono size={18} className={`shrink-0 ${COLOR[p.estado]}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fg">{t(`dashboard.setup.paso.${p.id}`)}</span>
                  {p.detalle && <span className="block truncate text-xs text-muted">{p.detalle}</span>}
                </span>
                {p.tab && <button type="button" onClick={() => { irA(p.tab); onCerrar(); }} className="sk-foco flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-elevated">
                  {t('dashboard.setup.see')} <ChevronRight size={13} /></button>}
              </li>
            );
          })}
        </ul>
        {resultado.creados?.length > 0 && <p className="mt-3 text-xs text-muted">{t('dashboard.setup.created', { lista: resultado.creados.map((c) => `#${c.nombre}`).join(', ') })}</p>}
        <p className="mt-3 flex items-start gap-2 text-xs text-muted"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand" /> {t('dashboard.setup.undoTip')}</p>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onCerrar} className="sk-foco rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-on-brand">{t('dashboard.setup.finish')}</button>
        </div>
      </>
    );
  } else if (paso === 1) {
    cuerpo = (
      <>
        <h3 className="mt-5 text-sm font-semibold text-fg">{t('dashboard.setup.qLang')}</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[['es', '🇪🇸 Español'], ['en', '🇬🇧 English']].map(([id, txt]) => (
            <button key={id} type="button" onClick={() => setIdioma(id)} aria-pressed={idioma === id}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${idioma === id ? 'border-brand bg-brand/10 text-fg' : 'border-line text-muted hover:text-fg'}`}>{txt}</button>
          ))}
        </div>
        <h3 className="mt-5 text-sm font-semibold text-fg">{t('dashboard.setup.qType')}</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(TIPOS).map(([id, tp]) => (
            <button key={id} type="button" onClick={() => elegirTipo(id)} aria-pressed={tipo === id}
              className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors ${tipo === id ? 'border-brand bg-brand/10' : 'border-line bg-bg hover:border-brand/50'}`}>
              <span className="text-2xl leading-none" aria-hidden="true">{tp.emoji}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-fg">{t(`dashboard.asistente.tipos.${id}.nombre`)}</span>
                <span className="mt-0.5 block text-xs text-muted">{t(`dashboard.asistente.tipos.${id}.desc`)}</span>
              </span>
            </button>
          ))}
        </div>
        {tipo && (
          <div className="mt-5 rounded-3xl border border-brand/50 bg-gradient-to-br from-brand/15 to-fuchsia-500/10 p-4">
            <p className="text-sm font-bold text-fg">⚡ {t('dashboard.setup.allTitle')}</p>
            <p className="mt-1 text-xs text-muted">{t('dashboard.setup.allSub', { n: TIPOS[tipo].modulos.length })}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {TIPOS[tipo].modulos.map((m) => <span key={m} className="rounded-full border border-line bg-bg px-2 py-0.5 text-[11px] text-fg">{EMOJI_MODULO[m]} {t(`dashboard.setup.paso.${m}`)}</span>)}
            </div>
            <button type="button" onClick={() => aplicar({ todo: true })}
              className="sk-foco mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-brand px-4 py-3 text-base font-extrabold text-on-brand shadow-soft transition-transform hover:scale-[1.01]">
              <Zap size={18} /> {t('dashboard.setup.allBtn')}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">{t('dashboard.setup.orCustom')}</p>
          </div>
        )}
      </>
    );
  } else if (paso === 2) {
    cuerpo = (
      <>
        <h3 className="mt-5 text-sm font-semibold text-fg">{t('dashboard.setup.qModules')}</h3>
        {Object.entries(GRUPOS).map(([g, lista]) => (
          <div key={g} className="mt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{t(`dashboard.setup.grupos.${g}`)}</p>
            <ul className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {lista.map((m) => (
                <li key={m}>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors ${modulos.includes(m) ? 'border-brand bg-brand/10' : 'border-line bg-bg'}`}>
                    <input type="checkbox" checked={modulos.includes(m)} onChange={() => alternar(m)} className="mt-1 accent-[var(--color-brand,#7c5cff)]" />
                    <span className="text-lg leading-none" aria-hidden>{EMOJI_MODULO[m]}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-fg">{t(`dashboard.setup.paso.${m}`)}</span>
                      <span className="block text-xs text-muted">{t(`dashboard.setup.desc.${m}`)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {necesarios.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-semibold text-fg">{t('dashboard.setup.qChannels')}</h3>
            <p className="text-xs text-muted">{t('dashboard.setup.qChannelsHint')}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">{necesarios.map(selectCanal)}</div>
          </>
        )}
        <label className="mt-5 block">
          <span className="mb-1 block text-sm font-semibold text-fg">{t('dashboard.setup.qStaff')}</span>
          <select value={rolStaffId} onChange={(e) => setRolStaffId(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none">
            <option value="">{t('dashboard.setup.noStaff')}</option>
            {roles.filter((r) => r.nombre !== '@everyone').map((r) => <option key={r.id} value={r.id}>@{r.nombre}</option>)}
          </select>
        </label>
      </>
    );
  } else {
    cuerpo = (
      <>
        <h3 className="mt-5 text-sm font-semibold text-fg">{t('dashboard.setup.summary')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-fg">
          <li>🌐 {t('dashboard.setup.sumLang', { idioma: idioma === 'es' ? 'Español' : 'English' })}</li>
          {modulos.map((m) => <li key={m}>✅ {t(`dashboard.setup.paso.${m}`)}</li>)}
          {rolStaffId && <li>🛡️ {t('dashboard.setup.sumStaff', { rol: roles.find((r) => r.id === rolStaffId)?.nombre || '' })}</li>}
        </ul>
        <div className="mt-4 rounded-2xl border border-line bg-elevated px-4 py-3 text-xs text-muted">
          <p className="flex items-start gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand" /> {t('dashboard.setup.safe')}</p>
        </div>
      </>
    );
  }

  const puedeSeguir = paso === 1 ? !!tipo : paso === 2 ? modulos.length > 0 : true;
  return (
    <div className="sk-velo flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !enviando) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="setup-titulo" className="sk-glass sk-aparece max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-card p-5 shadow-xl sm:p-6">
        {Cabecera}
        {cuerpo}
        {error && <p className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{error}</p>}
        {!resultado && !enviando && (
          <div className="mt-6 flex items-center justify-between gap-3">
            <button type="button" onClick={() => (paso === 1 ? onCerrar() : setPaso(paso - 1))} disabled={enviando}
              className="sk-foco flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:text-fg disabled:opacity-50">
              <ChevronLeft size={15} /> {paso === 1 ? t('dashboard.setup.cancel') : t('dashboard.setup.back')}
            </button>
            {paso < 3 ? (
              <button type="button" onClick={() => setPaso(paso + 1)} disabled={!puedeSeguir}
                className="sk-foco flex items-center gap-1 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-50">
                {t('dashboard.setup.next')} <ChevronRight size={15} />
              </button>
            ) : (
              <button type="button" onClick={() => aplicar()} disabled={enviando}
                className="sk-foco flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-50">
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />} {enviando ? t('dashboard.setup.applying') : t('dashboard.setup.apply')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
