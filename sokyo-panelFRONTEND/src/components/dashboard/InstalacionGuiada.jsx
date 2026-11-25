// Instalación guiada (1.19.0): deja Sokyo listo con preguntas muy fáciles, una por
// pantalla y con botones grandes. Idioma → tipo de servidor → qué quieres (por «packs»)
// → dónde va cada cosa (que Sokyo cree el canal o usar uno tuyo) → quién es tu staff →
// resumen en frases normales → ¡listo! Lo hace el bot con el setup rápido
// (POST /api/config/:guildId/setup-rapido, utils/setupRapido.js); no pisa lo que ya
// tengas y todo queda en «Historial de cambios» con «Deshacer».
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, X, ChevronRight, ChevronLeft, Loader2, CheckCircle2, SkipForward, XCircle, Sparkles, Hash, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';

// Lo recomendado por tipo de servidor (TIPOS en utils/setupRapido.js).
const TIPOS = {
  gaming: { emoji: '🎮', modulos: ['bienvenidas', 'registro', 'niveles', 'automod', 'temporadas', 'votos', 'salon', 'contadores', 'mascota', 'casino', 'bromas', 'liga', 'clanes', 'tienda'] },
  comunidad: { emoji: '💬', modulos: ['bienvenidas', 'registro', 'niveles', 'automod', 'temporadas', 'cumpleanos', 'votos', 'sugerencias', 'salon', 'contadores', 'mascota', 'casino', 'bromas', 'liga', 'tienda'] },
  creador: { emoji: '📺', modulos: ['bienvenidas', 'registro', 'niveles', 'automod', 'votos', 'sugerencias', 'salon', 'contadores', 'mascota', 'liga'] },
  estudio: { emoji: '📚', modulos: ['bienvenidas', 'registro', 'automod', 'cumpleanos', 'sugerencias', 'contadores'] },
  soporte: { emoji: '🛟', modulos: ['bienvenidas', 'registro', 'automod', 'tickets', 'sugerencias', 'contadores'] },
};
// «Packs» en palabras normales: cada uno enciende varias cosas.
const PACKS = [
  { id: 'proteger', emoji: '🛡️', color: '#ef4444', modulos: ['automod', 'registro'] },
  { id: 'bienvenida', emoji: '👋', color: '#22c55e', modulos: ['bienvenidas'] },
  { id: 'participar', emoji: '🎉', color: '#f59e0b', modulos: ['niveles', 'temporadas', 'cumpleanos', 'votos', 'sugerencias', 'salon', 'contadores'] },
  { id: 'diversion', emoji: '🎮', color: '#a855f7', modulos: ['mascota', 'casino', 'bromas', 'liga', 'clanes', 'tienda'] },
  { id: 'ayuda', emoji: '🎫', color: '#3b82f6', modulos: ['tickets'] },
];
const EMOJI = {
  bienvenidas: '👋', registro: '📋', automod: '🛡️', tickets: '🎫', niveles: '📈', temporadas: '🏆', cumpleanos: '🎂', votos: '🗳️',
  sugerencias: '💡', salon: '⭐', contadores: '👥', mascota: '🐾', casino: '🎰', bromas: '🃏', liga: '🥇', clanes: '🛡', tienda: '🛒',
};
// Canal que necesita cada cosa y cómo se llamará si lo crea Sokyo (CANALES/NOMBRES del bot).
const CANALES = [
  { clave: 'bienvenida', modulos: ['bienvenidas'], nombre: ['👋・bienvenida', '👋・welcome'] },
  { clave: 'registro', modulos: ['registro'], nombre: ['📋・registro-sokyo', '📋・sokyo-log'] },
  { clave: 'anuncios', modulos: ['temporadas', 'cumpleanos', 'votos'], nombre: ['🎉・eventos-y-premios', '🎉・events-and-rewards'] },
  { clave: 'soporte', modulos: ['tickets'], nombre: ['🎫・soporte', '🎫・support'] },
  { clave: 'sugerencias', modulos: ['sugerencias'], nombre: ['💡・sugerencias', '💡・suggestions'] },
  { clave: 'salon', modulos: ['salon'], nombre: ['⭐・salon-de-la-fama', '⭐・hall-of-fame'] },
  { clave: 'mascota', modulos: ['mascota', 'liga'], nombre: ['🐾・mascota', '🐾・pet'] },
  { clave: 'casino', modulos: ['casino'], nombre: ['🎰・casino', '🎰・casino'] },
];
const PASOS = ['hola', 'idioma', 'tipo', 'que', 'donde', 'staff', 'resumen'];
const ahoraMs = () => Date.now();
const ICONO = { ok: CheckCircle2, omitido: SkipForward, error: XCircle };
const COLOR = { ok: 'text-success', omitido: 'text-muted', error: 'text-danger' };

export function TarjetaInstalacion({ onAbrir }) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onAbrir}
      className="sk-foco group relative flex w-full flex-col gap-3 overflow-hidden rounded-3xl border-2 border-brand/50 bg-gradient-to-br from-brand/20 via-fuchsia-500/10 to-transparent p-5 text-left shadow-soft transition-transform hover:scale-[1.005] sm:flex-row sm:items-center">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-on-brand shadow-soft"><Zap size={26} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-black text-fg">{t('dashboard.guia.tarjeta')}</span>
        <span className="mt-0.5 block text-sm text-muted">{t('dashboard.guia.tarjetaSub')}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-gradient-brand px-5 py-3 text-sm font-extrabold text-on-brand">
        {t('dashboard.guia.empezar')} <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function Opcion({ activo, onClick, emoji, titulo, sub, color }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo}
      className={`sk-foco flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all ${activo ? 'scale-[1.01] border-brand bg-brand/10 shadow-soft' : 'border-line bg-bg hover:border-brand/40'}`}
      style={activo && color ? { borderColor: color, background: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}>
      <span className="text-3xl leading-none" aria-hidden>{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-fg">{titulo}</span>
        {sub && <span className="mt-0.5 block text-sm text-muted">{sub}</span>}
      </span>
      <span className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${activo ? 'border-brand bg-brand text-on-brand' : 'border-line'}`}>{activo && <CheckCircle2 size={14} />}</span>
    </button>
  );
}

export default function InstalacionGuiada({ guildId, canales = [], roles = [], onCerrar, onHecho, irA }) {
  const { t, i18n } = useTranslation();
  const [paso, setPaso] = useState(0);
  const [idioma, setIdioma] = useState(i18n.language.startsWith('es') ? 'es' : 'en');
  const [tipo, setTipo] = useState('');
  const [modulos, setModulos] = useState([]);
  const [abierto, setAbierto] = useState(null); // pack con «Personalizar» abierto
  const [donde, setDonde] = useState({});        // clave -> 'auto' | id de canal
  const [rolStaffId, setRolStaffId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [segundos, setSegundos] = useState(null);
  const [error, setError] = useState('');
  const reloj = useRef(null);

  const es = idioma === 'es';
  const nombreCanal = (c) => (es ? c.nombre[0] : c.nombre[1]);
  const necesarios = CANALES.filter((c) => c.modulos.some((m) => modulos.includes(m)));
  const textuales = canales; // /api/servidor/canales ya da solo los de texto
  const elegirTipo = (id) => { setTipo(id); setModulos(TIPOS[id].modulos); };
  const packActivo = (p) => p.modulos.some((m) => modulos.includes(m));
  const alternarPack = (p) => setModulos((l) => (packActivo(p) ? l.filter((m) => !p.modulos.includes(m)) : [...new Set([...l, ...p.modulos.filter((m) => tipo !== 'estudio' || !['casino', 'bromas'].includes(m))])]));
  const alternar = (m) => setModulos((l) => (l.includes(m) ? l.filter((x) => x !== m) : [...l, m]));
  const pasoId = PASOS[paso];

  const aplicar = async () => {
    setEnviando(true); setError(''); setProgreso(0);
    const inicio = ahoraMs();
    clearInterval(reloj.current);
    reloj.current = setInterval(() => setProgreso((p) => Math.min(modulos.length - 1, p + 1)), 500);
    try {
      const res = await apiFetch(`/api/config/${guildId}/setup-rapido`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idioma, tipo, modulos, canales: Object.fromEntries(necesarios.map((c) => [c.clave, donde[c.clave] || 'auto'])), rolStaffId: rolStaffId || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.codigo === 'permisos_bot'
          ? t('dashboard.setup.errPerms', { lista: (d.permisos || []).map((p) => t(`dashboard.setup.perm.${p}`, { defaultValue: p })).join(', ') })
          : res.status === 403 ? t('dashboard.setup.errAdmin')
            : d.codigo ? t(`dashboard.setup.err.${d.codigo}`, { defaultValue: d.error || t('dashboard.setup.errGeneric') }) : t('dashboard.setup.errGeneric'));
        return;
      }
      setSegundos(Math.max(1, Math.round((ahoraMs() - inicio) / 1000)));
      setResultado(d);
      onHecho?.();
    } catch { setError(t('dashboard.setup.errGeneric')); }
    finally { clearInterval(reloj.current); setEnviando(false); }
  };

  // ------------------------------------------------------------------ pantallas
  let pantalla;
  if (enviando) {
    pantalla = (
      <div className="py-6 text-center">
        <Loader2 size={44} className="mx-auto animate-spin text-brand" />
        <p className="mt-4 text-xl font-black text-fg">{t('dashboard.guia.trabajando')}</p>
        <div className="mx-auto mt-4 max-w-md text-left">
          {modulos.map((m, i) => (
            <p key={m} className={`flex items-center gap-2 py-1 text-sm ${i < progreso ? 'text-fg' : i === progreso ? 'font-bold text-fg' : 'text-muted'}`}>
              {i < progreso ? <CheckCircle2 size={16} className="text-success" /> : i === progreso ? <Loader2 size={16} className="animate-spin text-brand" /> : <span className="h-4 w-4 rounded-full border border-line" />}
              {EMOJI[m]} {t(`dashboard.setup.paso.${m}`)}
            </p>
          ))}
        </div>
      </div>
    );
  } else if (resultado) {
    pantalla = (
      <div>
        <div className="rounded-3xl bg-gradient-to-br from-success/25 to-brand/10 p-6 text-center">
          <p className="text-5xl" aria-hidden>🎉</p>
          <p className="mt-2 text-2xl font-black text-fg">{t('dashboard.guia.listo')}</p>
          <p className="mt-1 text-sm text-muted">{t('dashboard.guia.listoSub', { s: segundos, n: resultado.pasos.filter((p) => p.estado === 'ok').length })}</p>
        </div>
        <p className="mt-5 text-sm font-bold text-fg">{t('dashboard.guia.ahora')}</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {['probar', 'mascota', 'afinar', 'ayuda'].map((k) => (
            <li key={k} className="rounded-2xl border border-line bg-bg px-3 py-2.5 text-sm text-fg">{t(`dashboard.guia.siguiente.${k}`)}</li>
          ))}
        </ul>
        <details className="mt-4 rounded-2xl border border-line bg-bg p-3">
          <summary className="cursor-pointer text-sm font-semibold text-fg">{t('dashboard.guia.verDetalle')}</summary>
          <ul className="mt-3 space-y-1.5">
            {resultado.pasos.map((p) => {
              const I = ICONO[p.estado] || CheckCircle2;
              return (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <I size={16} className={`shrink-0 ${COLOR[p.estado]}`} />
                  <span className="min-w-0 flex-1 truncate text-fg">{t(`dashboard.setup.paso.${p.id}`)}{p.detalle ? <span className="text-muted"> · {p.detalle}</span> : null}</span>
                  {p.tab && <button type="button" onClick={() => { irA(p.tab); onCerrar(); }} className="shrink-0 text-xs font-semibold text-brand">{t('dashboard.setup.see')}</button>}
                </li>
              );
            })}
          </ul>
        </details>
      </div>
    );
  } else if (pasoId === 'hola') {
    pantalla = (
      <div className="py-4 text-center">
        <p className="text-6xl" aria-hidden>👋</p>
        <h2 className="mt-3 text-2xl font-black text-fg sm:text-3xl">{t('dashboard.guia.hola')}</h2>
        <p className="mx-auto mt-2 max-w-md text-base text-muted">{t('dashboard.guia.holaSub')}</p>
        <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm text-fg">
          {['p1', 'p2', 'p3'].map((k) => <li key={k} className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" /> {t(`dashboard.guia.promesa.${k}`)}</li>)}
        </ul>
      </div>
    );
  } else if (pasoId === 'idioma') {
    pantalla = (
      <>
        <h2 className="text-2xl font-black text-fg">{t('dashboard.guia.qIdioma')}</h2>
        <p className="mt-1 text-sm text-muted">{t('dashboard.guia.qIdiomaSub')}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Opcion activo={idioma === 'es'} onClick={() => setIdioma('es')} emoji="🇪🇸" titulo="Español" />
          <Opcion activo={idioma === 'en'} onClick={() => setIdioma('en')} emoji="🇬🇧" titulo="English" />
        </div>
      </>
    );
  } else if (pasoId === 'tipo') {
    pantalla = (
      <>
        <h2 className="text-2xl font-black text-fg">{t('dashboard.guia.qTipo')}</h2>
        <p className="mt-1 text-sm text-muted">{t('dashboard.guia.qTipoSub')}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {Object.entries(TIPOS).map(([id, tp]) => (
            <Opcion key={id} activo={tipo === id} onClick={() => elegirTipo(id)} emoji={tp.emoji} titulo={t(`dashboard.asistente.tipos.${id}.nombre`)} sub={t(`dashboard.asistente.tipos.${id}.desc`)} />
          ))}
        </div>
      </>
    );
  } else if (pasoId === 'que') {
    pantalla = (
      <>
        <h2 className="text-2xl font-black text-fg">{t('dashboard.guia.qQue')}</h2>
        <p className="mt-1 text-sm text-muted">{t('dashboard.guia.qQueSub')}</p>
        <div className="mt-5 space-y-3">
          {PACKS.map((p) => (
            <div key={p.id}>
              <Opcion activo={packActivo(p)} onClick={() => alternarPack(p)} emoji={p.emoji} color={p.color} titulo={t(`dashboard.guia.pack.${p.id}.t`)} sub={t(`dashboard.guia.pack.${p.id}.d`)} />
              {p.modulos.length > 1 && (
                <button type="button" onClick={() => setAbierto(abierto === p.id ? null : p.id)} className="ml-4 mt-1 text-xs font-semibold text-brand">
                  {abierto === p.id ? t('dashboard.guia.cerrarDetalle') : t('dashboard.guia.personalizar', { n: p.modulos.filter((m) => modulos.includes(m)).length, total: p.modulos.length })}
                </button>
              )}
              {abierto === p.id && (
                <div className="ml-4 mt-2 flex flex-wrap gap-2">
                  {p.modulos.map((m) => (
                    <button key={m} type="button" onClick={() => alternar(m)} aria-pressed={modulos.includes(m)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${modulos.includes(m) ? 'border-brand bg-brand/10 text-fg' : 'border-line text-muted'}`}>
                      {EMOJI[m]} {t(`dashboard.setup.paso.${m}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    );
  } else if (pasoId === 'donde') {
    pantalla = (
      <>
        <h2 className="text-2xl font-black text-fg">{t('dashboard.guia.qDonde')}</h2>
        <p className="mt-1 text-sm text-muted">{t('dashboard.guia.qDondeSub')}</p>
        <div className="mt-5 space-y-3">
          {necesarios.map((c) => {
            const v = donde[c.clave] || 'auto';
            return (
              <div key={c.clave} className="rounded-2xl border border-line bg-bg p-4">
                <p className="text-base font-bold text-fg">{t(`dashboard.guia.donde.${c.clave}`)}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => setDonde((d) => ({ ...d, [c.clave]: 'auto' }))} aria-pressed={v === 'auto'}
                    className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm ${v === 'auto' ? 'border-brand bg-brand/10 text-fg' : 'border-line text-muted'}`}>
                    <Sparkles size={16} className="shrink-0 text-brand" />
                    <span><b>{t('dashboard.guia.crealo')}</b><span className="block text-xs text-muted">#{nombreCanal(c)}</span></span>
                  </button>
                  <label className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm ${v !== 'auto' ? 'border-brand bg-brand/10' : 'border-line'}`}>
                    <Hash size={16} className="shrink-0 text-muted" />
                    <select value={v === 'auto' ? '' : v} onChange={(e) => setDonde((d) => ({ ...d, [c.clave]: e.target.value || 'auto' }))}
                      className="w-full bg-transparent text-sm text-fg outline-none" aria-label={t('dashboard.guia.usarMio')}>
                      <option value="">{t('dashboard.guia.usarMio')}</option>
                      {textuales.map((x) => <option key={x.id} value={x.id}># {x.nombre || x.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  } else if (pasoId === 'staff') {
    pantalla = (
      <>
        <h2 className="text-2xl font-black text-fg">{t('dashboard.guia.qStaff')}</h2>
        <p className="mt-1 text-sm text-muted">{t('dashboard.guia.qStaffSub')}</p>
        <div className="mt-5 grid gap-3">
          <Opcion activo={!rolStaffId} onClick={() => setRolStaffId('')} emoji="🙋" titulo={t('dashboard.guia.staffNadie')} sub={t('dashboard.guia.staffNadieSub')} />
          <label className={`rounded-2xl border-2 p-4 ${rolStaffId ? 'border-brand bg-brand/10' : 'border-line bg-bg'}`}>
            <span className="flex items-center gap-2 text-base font-bold text-fg"><ShieldCheck size={18} className="text-brand" /> {t('dashboard.guia.staffRol')}</span>
            <select value={rolStaffId} onChange={(e) => setRolStaffId(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-fg">
              <option value="">{t('dashboard.guia.elegirRol')}</option>
              {roles.filter((r) => r.nombre !== '@everyone').map((r) => <option key={r.id} value={r.id}>@{r.nombre}</option>)}
            </select>
          </label>
        </div>
      </>
    );
  } else {
    const frases = [
      t('dashboard.guia.res.idioma', { idioma: es ? 'español' : 'English' }),
      ...necesarios.map((c) => t(`dashboard.guia.res.${c.clave}`, { canal: donde[c.clave] && donde[c.clave] !== 'auto' ? `#${(canales.find((x) => x.id === donde[c.clave])?.nombre) || ''}` : `#${nombreCanal(c)}` })),
      ...modulos.filter((m) => ['automod', 'niveles', 'contadores', 'bromas', 'clanes', 'liga', 'tienda'].includes(m)).map((m) => t(`dashboard.guia.res.m_${m}`)),
      rolStaffId ? t('dashboard.guia.res.staff', { rol: roles.find((r) => r.id === rolStaffId)?.nombre || '' }) : null,
    ].filter(Boolean);
    pantalla = (
      <>
        <h2 className="text-2xl font-black text-fg">{t('dashboard.guia.qResumen')}</h2>
        <p className="mt-1 text-sm text-muted">{t('dashboard.guia.qResumenSub')}</p>
        <ul className="mt-5 space-y-2">
          {frases.map((f, i) => <li key={i} className="flex items-start gap-2 rounded-2xl border border-line bg-bg px-3 py-2.5 text-sm text-fg"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" /> {f}</li>)}
        </ul>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand" /> {t('dashboard.setup.safe')}</p>
      </>
    );
  }

  // ------------------------------------------------------------------ navegación
  const saltaDonde = pasoId === 'que' && necesarios.length === 0;
  const puede = { hola: true, idioma: true, tipo: !!tipo, que: modulos.length > 0, donde: true, staff: true, resumen: true }[pasoId];
  const siguiente = () => setPaso((p) => Math.min(PASOS.length - 1, p + (saltaDonde ? 2 : 1)));
  const atras = () => setPaso((p) => Math.max(0, p - (PASOS[p] === 'staff' && necesarios.length === 0 ? 2 : 1)));

  return (
    <div className="sk-velo flex items-stretch justify-center p-0 sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !enviando) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-label={t('dashboard.guia.titulo')} className="sk-glass sk-aparece flex max-h-dvh w-full max-w-2xl flex-col overflow-hidden border border-line bg-card shadow-xl sm:max-h-[92vh] sm:rounded-3xl">
        {/* Cabecera con los puntos de progreso */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-brand text-on-brand"><Zap size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-fg">{t('dashboard.guia.titulo')}</p>
            {!resultado && !enviando && (
              <div className="mt-1 flex gap-1" aria-label={t('dashboard.guia.pasoDe', { n: paso + 1, total: PASOS.length })}>
                {PASOS.map((p, i) => <span key={p} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= paso ? 'bg-brand' : 'bg-elevated'}`} />)}
              </div>
            )}
          </div>
          {!enviando && <button type="button" onClick={onCerrar} className="sk-boton-icono shrink-0" aria-label={t('dashboard.setup.close')}><X size={17} /></button>}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          {pantalla}
          {error && <p className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{error}</p>}
        </div>
        {/* Botones de abajo, siempre a mano */}
        {!enviando && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            {resultado ? <span /> : (
              <button type="button" onClick={() => (paso === 0 ? onCerrar() : atras())} className="sk-foco flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted hover:text-fg">
                <ChevronLeft size={16} /> {paso === 0 ? t('dashboard.setup.cancel') : t('dashboard.setup.back')}
              </button>
            )}
            {resultado ? (
              <button type="button" onClick={onCerrar} className="sk-foco rounded-2xl bg-gradient-brand px-6 py-3 text-base font-extrabold text-on-brand">{t('dashboard.guia.terminar')}</button>
            ) : pasoId === 'resumen' ? (
              <button type="button" onClick={aplicar} className="sk-foco flex items-center gap-2 rounded-2xl bg-gradient-brand px-6 py-3 text-base font-extrabold text-on-brand shadow-soft transition-transform hover:scale-[1.02]">
                <Zap size={18} /> {t('dashboard.guia.dejarlo')}
              </button>
            ) : (
              <button type="button" onClick={siguiente} disabled={!puede}
                className="sk-foco flex items-center gap-1.5 rounded-2xl bg-gradient-brand px-6 py-3 text-base font-extrabold text-on-brand disabled:opacity-40">
                {paso === 0 ? t('dashboard.guia.vamos') : t('dashboard.setup.next')} <ChevronRight size={17} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
