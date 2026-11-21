// Asistente de primera configuración: eliges qué tipo de servidor tienes y te
// deja en el Inicio una lista de lo que conviene configurar, en orden y con por
// qué, con un botón a cada sección. Se marca solo lo que ya está encendido (y lo
// demás con «Hecho»). Se guarda por servidor en este navegador.
// 1.17.0: lo que el setup rápido sabe dejar listo tiene «⚡ Activar» (un clic, con lo
// recomendado: POST …/setup-rapido con `uno`) y arriba «Activar todo lo que falta».
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wand2, X, CheckCircle2, Circle, ChevronRight, RotateCcw, Zap, Loader2 } from 'lucide-react';
import { ubicacion } from './navConfig';
import { cn } from '../../lib/cn';
import { ACTIVABLE, activarSeccion } from '../../lib/activar';

const TIPOS = {
  gaming: { emoji: '🎮', items: ['prod-bienvenidas', 'mod-automod', 'logs-todos', 'config-niveles', 'seg-verificacion', 'roles-paneles', 'com-mascota', 'com-casino', 'crec-liga', 'com-bromas', 'com-clanes', 'com-temporadas', 'com-salon', 'crec-contadores', 'com-grupos', 'musica', 'voz-temporal', 'com-sorteos', 'tickets-config'] },
  comunidad: { emoji: '💬', items: ['prod-bienvenidas', 'mod-automod', 'logs-todos', 'config-niveles', 'roles-paneles', 'com-mascota', 'com-casino', 'com-bromas', 'com-temporadas', 'com-cumpleanos', 'com-sugerencias', 'com-salon', 'crec-contadores', 'com-dinamicas', 'com-eventos', 'musica', 'voz-temporal'] },
  creador: { emoji: '📺', items: ['prod-bienvenidas', 'mod-automod', 'logs-todos', 'crec-directos', 'config-niveles', 'roles-paneles', 'com-mascota', 'crec-liga', 'com-sugerencias', 'com-salon', 'crec-contadores', 'com-sorteos', 'crec-invitaciones'] },
  estudio: { emoji: '📚', items: ['prod-bienvenidas', 'mod-automod', 'logs-todos', 'roles-paneles', 'com-cumpleanos', 'com-sugerencias', 'crec-contadores', 'prod-anuncios', 'com-eventos', 'voz-temporal', 'tickets-config'] },
  soporte: { emoji: '🛟', items: ['tickets-config', 'prod-bienvenidas', 'mod-automod', 'logs-todos', 'seg-verificacion', 'prod-autorespuestas', 'com-sugerencias', 'crec-contadores', 'prod-anuncios', 'mod-reportes'] },
};

const clave = (guildId) => `sokyoAsistente:${guildId}`;
function leerAsistente(guildId) {
  try { return JSON.parse(localStorage.getItem(clave(guildId)) || 'null'); } catch { return null; }
}
function guardarAsistente(guildId, datos) {
  try { localStorage.setItem(clave(guildId), JSON.stringify(datos)); } catch { /* sin almacenamiento: solo esta vez */ }
}

// ¿Ya está hecho? Lo que tiene interruptor, si está encendido; los tickets, si
// tienen categoría o rol de staff; el resto, si se marcó «Hecho».
function hecho(tab, { estadoModulos, configServidor, hechos }) {
  if (hechos.includes(tab)) return true;
  if (Object.prototype.hasOwnProperty.call(estadoModulos, tab)) return !!estadoModulos[tab];
  if (tab === 'tickets-config') return !!(configServidor?.categoriaTicketsId || configServidor?.rolStaffId);
  return false;
}

// Ventana para elegir el tipo de servidor.
function ElegirTipo({ onElegir, onCerrar }) {
  const { t } = useTranslation();
  return (
    <div className="sk-velo flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="asistente-titulo" className="sk-glass sk-aparece w-full max-w-2xl rounded-3xl border border-line bg-card p-5 shadow-xl sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-on-brand"><Wand2 size={20} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="asistente-titulo" className="text-lg font-extrabold tracking-tight text-fg">{t('dashboard.asistente.pregunta')}</h2>
            <p className="mt-0.5 text-sm text-muted">{t('dashboard.asistente.preguntaSub')}</p>
          </div>
          <button onClick={onCerrar} className="sk-boton-icono shrink-0" aria-label={t('dashboard.asistente.cerrar')}><X size={17} /></button>
        </div>
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {Object.entries(TIPOS).map(([id, tipo]) => (
            <button key={id} onClick={() => onElegir(id)} className="sk-foco sk-pulsable flex items-start gap-3 rounded-2xl border border-line bg-bg p-4 text-left transition-colors hover:border-brand/50">
              <span className="text-2xl leading-none" aria-hidden="true">{tipo.emoji}</span>
              <span className="min-w-0">
                <span className="block font-bold text-fg">{t(`dashboard.asistente.tipos.${id}.nombre`)}</span>
                <span className="mt-0.5 block text-xs text-muted">{t(`dashboard.asistente.tipos.${id}.desc`)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AsistenteInicio({ guildId, estadoModulos = {}, configServidor, setActiveTab, permitido = () => true, onActivado }) {
  const { t } = useTranslation();
  const [datos, setDatos] = useState(() => leerAsistente(guildId));
  const [eligiendo, setEligiendo] = useState(false);
  const [activando, setActivando] = useState(null); // tab en marcha (o 'todo')
  const [aviso, setAviso] = useState('');
  const [recienActivados, setRecienActivados] = useState([]);
  const guardar = (d) => { setDatos(d); guardarAsistente(guildId, d); };

  const encendidos = Object.values(estadoModulos).filter(Boolean).length;
  const ventana = eligiendo && (
    <ElegirTipo onCerrar={() => setEligiendo(false)} onElegir={(tipo) => { guardar({ tipo, hechos: datos?.hechos || [], oculto: false }); setEligiendo(false); }} />
  );

  // Sin plan todavía: se ofrece en un servidor que aún tiene casi todo apagado.
  if (!datos?.tipo) {
    if (datos?.oculto || !configServidor || encendidos > 2) return ventana || null;
    return (
      <>
        <div className="flex flex-col gap-3 rounded-3xl border border-brand/40 bg-brand/10 p-5 shadow-soft sm:flex-row sm:items-center">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-on-brand"><Wand2 size={20} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-fg">{t('dashboard.asistente.invitacion')}</h3>
            <p className="mt-0.5 text-sm text-muted">{t('dashboard.asistente.invitacionSub')}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => guardar({ oculto: true })} className="sk-foco rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:text-fg">{t('dashboard.asistente.ahoraNo')}</button>
            <button onClick={() => setEligiendo(true)} className="sk-foco rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-on-brand transition-transform hover:scale-[1.02]">{t('dashboard.asistente.empezar')}</button>
          </div>
        </div>
        {ventana}
      </>
    );
  }
  if (datos.oculto) return ventana || null;

  const tipo = TIPOS[datos.tipo] || TIPOS.comunidad;
  const items = tipo.items.filter((tab) => ubicacion(tab) && permitido(tab));
  const hechos = datos.hechos || [];
  const estado = items.map((tab) => ({ tab, ok: hecho(tab, { estadoModulos, configServidor, hechos }) }));
  const listos = estado.filter((x) => x.ok).length;
  const marcar = (tab) => guardar({ ...datos, hechos: hechos.includes(tab) ? hechos.filter((x) => x !== tab) : [...hechos, tab] });
  const pendientesActivables = estado.filter((x) => !x.ok && ACTIVABLE[x.tab] && !recienActivados.includes(x.tab)).map((x) => x.tab);

  // Activa una sección con lo recomendado. Devuelve true si ha ido bien.
  const activarUno = async (tab) => {
    const r = await activarSeccion(guildId, tab, { idioma: configServidor?.idioma, tipo: datos.tipo });
    if (!r.ok) {
      setAviso(r.motivo === 'admin' ? t('dashboard.setup.errAdmin')
        : r.motivo === 'permisos' ? t('dashboard.setup.errPerms', { lista: r.permisos.map((p) => t(`dashboard.setup.perm.${p}`, { defaultValue: p })).join(', ') })
          : r.detalle || t('dashboard.setup.errGeneric'));
      return false;
    }
    setRecienActivados((l) => [...l, tab]);
    return true;
  };
  const activar = async (tab) => {
    setActivando(tab); setAviso('');
    await activarUno(tab);
    setActivando(null);
    onActivado?.();
  };
  const activarTodo = async () => {
    setActivando('todo'); setAviso('');
    for (const tab of pendientesActivables) {
      setActivando(tab);
      if (!(await activarUno(tab))) break;
    }
    setActivando(null);
    onActivado?.();
  };

  return (
    <section className="rounded-3xl border border-line bg-card p-5 shadow-soft" aria-labelledby="asistente-plan">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="asistente-plan" className="flex items-center gap-2 font-bold text-fg">
            <Wand2 size={18} className="text-brand" /> {t('dashboard.asistente.plan', { tipo: t(`dashboard.asistente.tipos.${datos.tipo}.nombre`) })}
          </h3>
          <p className="mt-0.5 text-xs text-muted">{listos === items.length ? t('dashboard.asistente.terminado') : t('dashboard.asistente.progreso', { hechos: listos, total: items.length })}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setEligiendo(true)} className="sk-foco flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-elevated hover:text-fg"><RotateCcw size={13} /> {t('dashboard.asistente.cambiarTipo')}</button>
          <button onClick={() => guardar({ ...datos, oculto: true })} className="sk-foco rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-elevated hover:text-fg">{t('dashboard.asistente.ocultar')}</button>
        </div>
      </div>
      <div className="sk-barra mt-3"><span style={{ width: `${items.length ? Math.round((listos / items.length) * 100) : 0}%` }} /></div>
      {pendientesActivables.length > 0 && (
        <button type="button" onClick={activarTodo} disabled={!!activando}
          className="sk-foco mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-brand px-4 py-2.5 text-sm font-bold text-on-brand shadow-soft transition-transform hover:scale-[1.01] disabled:opacity-60">
          {activando ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
          {t('dashboard.asistente.activarTodo', { count: pendientesActivables.length })}
        </button>
      )}
      {aviso && <p className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{aviso}</p>}
      <ol className="mt-4 grid gap-2 lg:grid-cols-2">
        {estado.map(({ tab, ok: okReal }, i) => {
          const ok = okReal || recienActivados.includes(tab);
          const u = ubicacion(tab);
          const Icono = u?.item.icon;
          return (
            <li key={tab} className={cn('flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2.5', ok && 'opacity-70')} style={{ '--grupo': u?.group.color }}>
              <button onClick={() => marcar(tab)} className="sk-foco shrink-0 rounded-full" aria-pressed={ok} title={ok ? t('dashboard.asistente.desmarcar') : t('dashboard.asistente.marcar')} aria-label={ok ? t('dashboard.asistente.desmarcar') : t('dashboard.asistente.marcar')}>
                {ok ? <CheckCircle2 size={20} className="text-success" /> : <Circle size={20} className="text-muted" />}
              </button>
              {Icono && <span className="sk-icono-grupo h-8 w-8 shrink-0"><Icono size={15} /></span>}
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-sm font-semibold text-fg', ok && 'line-through decoration-muted')}>{i + 1}. {t(`dashboard.nav.items.${tab}`)}</span>
                <span className="block truncate text-xs text-muted">{t(`dashboard.asistente.porque.${tab}`)}</span>
              </span>
              {!ok && ACTIVABLE[tab] && (
                <button onClick={() => activar(tab)} disabled={!!activando} title={t('dashboard.asistente.activarHint')}
                  className="sk-foco flex shrink-0 items-center gap-1 rounded-lg bg-brand/15 px-2 py-1 text-xs font-bold text-brand hover:bg-brand/25 disabled:opacity-50">
                  {activando === tab ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} {t('dashboard.asistente.activar')}
                </button>
              )}
              <button onClick={() => setActiveTab(tab)} className="sk-foco flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-elevated">
                {ok ? t('dashboard.asistente.ver') : t('dashboard.asistente.configurar')} <ChevronRight size={13} />
              </button>
            </li>
          );
        })}
      </ol>
      {ventana}
    </section>
  );
}
