// Diversión · Mascota — la mascota del servidor. Nace de un huevo que el servidor
// vota, crece con lo que la cuidan y con lo vivo que está el servidor y desbloquea
// ventajas para todos. Desde 1.15.0 tiene personalidad, se entrena, tiene tienda
// (comida, accesorios y hábitats), logros, diario y sorpresas. Pestañas: Estado,
// Aspecto, Combate, Diario y Ajustes. Lógica del bot en utils/mascota*.js.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PawPrint, Heart, Settings2, Award, Egg, Lock, CheckCircle2, PauseCircle, RotateCcw, Swords, Sparkles,
  Shirt, BookOpen, Activity, Store, Trophy, Check,
} from 'lucide-react';
import { Avatar, Toggle } from '../../ui/primitives';
import { tarjeta, CabeceraTarjeta, Campo, SelectCanal, SelectRol, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio, FilaInterruptor } from './modulosShared';
import { useModulo } from '../../../hooks/useModulo';
import {
  ESPECIES, FORMAS, FASES, VENTAJAS, PERSONALIDADES, STATS, COMIDAS, ACCESORIOS, HABITATS, POSICIONES, TAM_ACCESORIO,
  LOGROS, ENERGIA_ENTRENO, svgMascota,
} from '../../../lib/mascota';

const colorBarra = (v) => (v >= 60 ? '#22c55e' : v >= 30 ? '#f59e0b' : '#ef4444');

function Barra({ icono, etiqueta, valor, color }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold">
        <span className="text-fg">{icono} {etiqueta}</span>
        <span className="text-muted">{Math.round(valor)}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(3, valor)}%`, background: color || colorBarra(valor) }} />
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor, icono }) {
  return (
    <div className="rounded-2xl border border-line bg-bg px-3 py-2.5 text-center">
      <p className="text-lg font-black text-fg">{icono} {valor}</p>
      <p className="text-[11px] text-muted">{etiqueta}</p>
    </div>
  );
}

// La mascota en su hábitat, con su accesorio (se le puede pasar otro para probarlo sin guardarlo).
function Escena({ m, accesorio, habitat, tamano = 'grande' }) {
  const esp = ESPECIES[m.especie] || ESPECIES.dragon;
  const forma = m.forma ? FORMAS[m.forma] : null;
  const color = (forma && forma.color) || esp.color;
  const hab = HABITATS[habitat || 'prado'] || HABITATS.prado;
  const acc = accesorio ? ACCESORIOS[accesorio] : null;
  const caja = tamano === 'grande' ? 'h-60 w-full sm:w-60' : 'h-36 w-full';
  const lado = tamano === 'grande'
    ? ({ cria: 112, joven: 136, adulta: 152, legendaria: 164 }[m.fase] || 136)
    : ({ cria: 64, joven: 76, adulta: 86, legendaria: 92 }[m.fase] || 76);
  const pos = acc ? (POSICIONES[m.especie] || POSICIONES.zorro)[acc.slot] : null;
  const tamAcc = acc ? lado * TAM_ACCESORIO[acc.slot] : 0;
  return (
    <div className={`relative grid ${caja} shrink-0 place-items-center overflow-hidden rounded-3xl`} style={{ background: `linear-gradient(180deg, ${hab.fondo[0]}, ${hab.fondo[1]})` }}>
      <img src={svgMascota(hab.decor[0])} alt="" className="absolute bottom-2 left-2 h-1/4 opacity-90" />
      <img src={svgMascota(hab.decor[1])} alt="" className="absolute right-3 top-3 h-[14%] opacity-90" />
      <div className="absolute inset-[12%] rounded-full" style={{ background: `radial-gradient(circle, ${color}66 0%, ${color}11 60%, transparent 72%)` }} />
      <div className="relative" style={{ width: lado, height: lado }}>
        <img src={svgMascota(esp.svg)} alt="" className={`h-full w-full drop-shadow-2xl ${m.hibernando ? 'sk-mascota-dormida' : 'sk-mascota'}`} />
        {acc && (
          <img src={svgMascota(acc.svg)} alt="" className="absolute drop-shadow" style={{ width: tamAcc, height: tamAcc, left: lado * pos.x - tamAcc / 2, top: lado * pos.y - tamAcc / 2 }} />
        )}
        {!acc && m.fase === 'legendaria' && <img src={svgMascota('1f451')} alt="" className="absolute left-1/2 -translate-x-1/2" style={{ width: lado * 0.34, top: -lado * 0.22 }} />}
      </div>
      {forma && <img src={svgMascota(forma.svg)} alt="" className="absolute bottom-4 right-5 h-9 w-9 drop-shadow" />}
      {m.hibernando && <img src={svgMascota('1f4a4')} alt="" className="absolute right-6 top-8 h-10 w-10" />}
      {m.animo === 'enferma' && <img src={svgMascota('1f912')} alt="" className="absolute right-6 top-8 h-9 w-9" />}
      {m.animo === 'feliz' && <img src={svgMascota('2728')} alt="" className="absolute left-5 top-6 h-7 w-7" />}
    </div>
  );
}

const PESTANAS = [
  { id: 'estado', icono: Activity },
  { id: 'aspecto', icono: Shirt },
  { id: 'combate', icono: Swords },
  { id: 'diario', icono: BookOpen },
  { id: 'ajustes', icono: Settings2 },
];

export default function MascotaView({ dash }) {
  const { t, i18n } = useTranslation();
  const { canales, roles, accionModulo } = dash;
  const { datos, form, set, guardar, estado, autoguardado } = useModulo(dash, 'mascota');
  const [pestana, setPestana] = useState('estado');
  const [vista, setVista] = useState(null); // { accesorio, habitat } para probar
  const [aviso, setAviso] = useState(null);

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const m = datos.mascota;
  const viva = m && m.estado === 'viva';
  const n = (v) => Number(v || 0).toLocaleString(i18n.language);
  const lang = i18n.language.startsWith('es') ? 'es' : 'en';
  const accion = async (ruta, metodo, cuerpo, ok) => {
    const r = await accionModulo(ruta, metodo, cuerpo);
    setAviso(r.error ? { tipo: 'alerta', texto: r.error } : ok ? { tipo: 'info', texto: ok } : null);
    return r;
  };
  const eclosionar = async () => { if (window.confirm(t('dashboard.mascota_v.hatchConfirm'))) await accion('mascota/eclosionar', 'POST'); };
  const reiniciar = async () => { if (window.confirm(t('dashboard.mascota_v.resetConfirm'))) await accion('mascota/reiniciar', 'POST'); };

  // ---------- Sin mascota o en el huevo ----------
  let principal = null;
  if (!m) {
    principal = (
      <div className={tarjeta}>
        <Vacio icono={Egg} titulo={t(form.activo ? 'dashboard.mascota_v.eggSoon' : 'dashboard.mascota_v.noPet')} sub={t(form.activo ? 'dashboard.mascota_v.eggSoonSub' : 'dashboard.mascota_v.noPetSub')} />
      </div>
    );
  } else if (m.estado === 'huevo') {
    const v = m.votacion || { especies: {}, nombres: [] };
    const total = Object.values(v.especies || {}).reduce((a, b) => a + b, 0);
    const nombres = [...(v.nombres || [])].sort((a, b) => b.votos - a.votos);
    principal = (
      <div data-help="mascota-huevo" className={`${tarjeta} overflow-hidden`}>
        <div className="grid items-center gap-6 md:grid-cols-[220px_1fr]">
          <div className="relative mx-auto grid h-52 w-52 place-items-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/30 via-fuchsia-500/10 to-transparent blur-xl" />
            <img src={svgMascota('1f95a')} alt="" className="sk-mascota-huevo relative h-36 w-36 drop-shadow-xl" />
          </div>
          <div>
            <h3 className="text-xl font-black text-fg">{t('dashboard.mascota_v.eggTitle')}</h3>
            <p className="mt-1 text-sm text-muted">{t('dashboard.mascota_v.eggSub', { hora: v.fin ? new Date(v.fin).toLocaleString(i18n.language, { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : '—' })}</p>
            <div className="mt-4 space-y-2">
              {Object.entries(ESPECIES).map(([id, e]) => {
                const votos = v.especies?.[id] || 0;
                const pct = total ? (votos / total) * 100 : 0;
                return (
                  <div key={id} className="flex items-center gap-3">
                    <img src={svgMascota(e.svg)} alt="" className="h-7 w-7" />
                    <span className="w-20 text-sm font-semibold text-fg">{t(`dashboard.mascota_v.especies.${id}`)}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-elevated">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: e.color }} />
                    </div>
                    <span className="w-8 text-right text-xs font-bold text-muted">{votos}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.mascota_v.names')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {nombres.length === 0 ? <span className="text-sm italic text-muted">{t('dashboard.mascota_v.noNames')}</span>
                : nombres.slice(0, 12).map((x, i) => (
                  <span key={x.nombre} className={`rounded-full border px-3 py-1 text-sm font-semibold ${i === 0 && x.votos ? 'border-brand bg-brand/10 text-fg' : 'border-line text-muted'}`}>{x.nombre} · {x.votos} 🗳️</span>
                ))}
            </div>
            <button type="button" onClick={eclosionar} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:opacity-90">
              <Sparkles size={15} /> {t('dashboard.mascota_v.hatchNow')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Viva ----------
  const esp = viva ? (ESPECIES[m.especie] || ESPECIES.dragon) : null;
  const forma = viva && m.forma ? FORMAS[m.forma] : null;
  const color = viva ? ((forma && forma.color) || esp.color) : '#a78bfa';
  const per = viva ? PERSONALIDADES[m.personalidad] : null;
  const c = (m && m.contadores) || {};

  const ficha = viva && (
    <div data-help="mascota-ficha" className={`${tarjeta} relative overflow-hidden`}>
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: color }} />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <Escena m={m} accesorio={m.accesorio} habitat={m.habitat} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-3xl font-black text-fg">{m.nombre}</h3>
            <span className="rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: color }}>{t('dashboard.mascota_v.level', { n: m.nivel })}</span>
          </div>
          <p className="mt-1 text-sm font-semibold" style={{ color }}>
            {t(`dashboard.mascota_v.especies.${m.especie}`)} · {(FASES.find((f) => f.id === m.fase) || FASES[0]).emoji} {t(`dashboard.mascota_v.fases.${m.fase}`)}{forma ? ` · ${t(`dashboard.mascota_v.formas.${m.forma}`)}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {per && <span className="rounded-full border border-line bg-bg px-3 py-1 text-xs font-semibold text-fg" title={t(`dashboard.mascota_v.pers.${m.personalidad}.desc`)}>{per.emoji} {t(`dashboard.mascota_v.pers.${m.personalidad}.n`)}</span>}
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-fg">🏆 {m.logros.length}/{LOGROS.length}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-elevated" title={`${n(m.xp)} / ${n(m.xpNecesaria)} XP`}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.nivel >= 50 ? 100 : Math.min(100, (m.xp / m.xpNecesaria) * 100)}%`, background: color }} />
          </div>
          <p className="mt-1 text-[11px] text-muted">{m.nivel >= 50 ? t('dashboard.mascota_v.maxLevel') : t('dashboard.mascota_v.xp', { a: n(m.xp), b: n(m.xpNecesaria) })}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Barra icono="🍖" etiqueta={t('dashboard.mascota_v.food')} valor={m.hambre} />
            <Barra icono="😊" etiqueta={t('dashboard.mascota_v.joy')} valor={m.alegria} />
            <Barra icono="❤️" etiqueta={t('dashboard.mascota_v.health')} valor={m.salud} />
            <Barra icono="⚡" etiqueta={t('dashboard.mascota_v.energy')} valor={m.energia} color="#38bdf8" />
          </div>
          <p className="mt-4 rounded-2xl border border-line bg-bg px-3 py-2 text-sm text-fg">{t(`dashboard.mascota_v.animo.${m.animo}`, { n: m.nombre })}</p>
        </div>
      </div>
    </div>
  );

  // ---------- Pestaña Estado ----------
  const estadoTab = (
    <>
      {ficha || principal}
      <div data-help="mascota-ventajas" className={tarjeta}>
        <CabeceraTarjeta icono={Award} titulo={t('dashboard.mascota_v.perks')} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.mascota_v.perksHint')}</p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {VENTAJAS.map((v) => {
            const activa = m?.ventajas?.includes(v.id);
            const alcanzada = viva && m.nivel >= v.nivel;
            const Icono = activa ? CheckCircle2 : alcanzada ? PauseCircle : Lock;
            return (
              <li key={v.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${activa ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-line bg-bg'}`}>
                <span className="text-2xl leading-none" aria-hidden>{v.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fg">{t(`dashboard.mascota_v.ventajas.${v.id}`)}</span>
                  <span className="block text-xs text-muted">{t('dashboard.mascota_v.fromLevel', { n: v.nivel })}{alcanzada && !activa ? ` · ${t('dashboard.mascota_v.paused')}` : ''}</span>
                </span>
                <Icono size={18} className={activa ? 'text-emerald-400' : 'text-muted'} />
              </li>
            );
          })}
        </ol>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div data-help="mascota-cuidadores" className={tarjeta}>
          <CabeceraTarjeta icono={Heart} titulo={t('dashboard.mascota_v.carers')} />
          {m?.cuidador && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/5 px-3 py-2">
              <span className="text-xl" aria-hidden>🏅</span>
              <Avatar src={m.cuidador.avatar} name={m.cuidador.nombre} size={28} />
              <span className="text-sm text-fg">{t('dashboard.mascota_v.carerOfMonth', { n: m.cuidador.nombre })}</span>
            </div>
          )}
          {datos.cuidadores.length === 0 ? <Vacio icono={Heart} titulo={t('dashboard.mascota_v.noCarers')} sub={t('dashboard.mascota_v.noCarersSub')} /> : (
            <ul className="mt-4 space-y-2">
              {datos.cuidadores.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="w-6 text-center">{['🥇', '🥈', '🥉'][i] || <span className="text-xs font-bold text-muted">{i + 1}</span>}</span>
                  <Avatar src={p.avatar} name={p.nombre} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{p.nombre}</span>
                  <span className="text-xs text-muted">{t('dashboard.mascota_v.points', { n: n(p.puntos) })}{p.oro ? ` · 🪙 ${n(p.oro)}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div data-help="mascota-como" className={tarjeta}>
          <CabeceraTarjeta icono={PawPrint} titulo={t('dashboard.mascota_v.howTitle')} />
          <ul className="mt-4 space-y-2.5 text-sm">
            {['feed', 'pet', 'play', 'train', 'shop', 'talk', 'server', 'toxic', 'surprise', 'battles'].map((k) => (
              <li key={k} className="flex gap-2.5"><span aria-hidden>{t(`dashboard.mascota_v.how.${k}.e`)}</span><span className="text-fg">{t(`dashboard.mascota_v.how.${k}.t`)}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );

  // ---------- Pestaña Aspecto ----------
  const verAcc = vista?.accesorio !== undefined ? vista.accesorio : m?.accesorio;
  const verHab = vista?.habitat || m?.habitat;
  const ponerAcc = async (id) => {
    if (id && !m.accesorios.includes(id)) return setVista({ ...(vista || {}), accesorio: id });
    setVista(null);
    await accion('mascota/vestir', 'PUT', { tipo: 'accesorio', id }, t('dashboard.mascota_v.dressed'));
  };
  const ponerHab = async (id) => {
    if (!m.habitats.includes(id)) return setVista({ ...(vista || {}), habitat: id });
    setVista(null);
    await accion('mascota/vestir', 'PUT', { tipo: 'habitat', id }, t('dashboard.mascota_v.dressed'));
  };
  const comprar = async (id, precio) => {
    if (!window.confirm(t('dashboard.mascota_v.buyConfirm', { n: precio }))) return;
    setVista(null);
    await accion('mascota/comprar', 'POST', { id }, t('dashboard.mascota_v.bought'));
  };
  const probando = vista && ((vista.accesorio && !m?.accesorios?.includes(vista.accesorio)) || (vista.habitat && !m?.habitats?.includes(vista.habitat)));
  const aspectoTab = viva ? (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <div className={`${tarjeta} h-fit lg:sticky lg:top-4`}>
        <Escena m={m} accesorio={verAcc} habitat={verHab} />
        <p className="mt-3 text-center text-sm font-bold text-fg">{m.nombre}</p>
        {probando && <p className="mt-1 text-center text-xs font-semibold text-amber-400">{t('dashboard.mascota_v.preview')}</p>}
        <p className="mt-3 text-xs text-muted">{t('dashboard.mascota_v.lookHint')}</p>
      </div>
      <div className="space-y-5">
        <div data-help="mascota-accesorios" className={tarjeta}>
          <CabeceraTarjeta icono={Shirt} titulo={t('dashboard.mascota_v.accessories')} />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => ponerAcc(null)} className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm ${!m.accesorio ? 'border-brand bg-brand/10' : 'border-line bg-bg hover:border-brand/50'}`}>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-elevated text-lg">✖️</span>
              <span className="font-semibold text-fg">{t('dashboard.mascota_v.noAccessory')}</span>
            </button>
            {Object.entries(ACCESORIOS).map(([id, a]) => {
              const tiene = m.accesorios.includes(id);
              const puesto = m.accesorio === id;
              return (
                <div key={id} className={`rounded-2xl border p-2.5 ${puesto ? 'border-brand bg-brand/10' : verAcc === id ? 'border-amber-400/60 bg-amber-400/5' : 'border-line bg-bg'}`}>
                  <button type="button" onClick={() => (tiene ? ponerAcc(id) : setVista({ ...(vista || {}), accesorio: id }))} className="flex w-full items-center gap-2 text-left">
                    <img src={svgMascota(a.svg)} alt="" className="h-9 w-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-fg">{t(`dashboard.mascota_v.acc.${id}`)}</span>
                      <span className="block text-[11px] text-muted">{puesto ? t('dashboard.mascota_v.wearing') : tiene ? t('dashboard.mascota_v.owned') : a.soloLogro ? t('dashboard.mascota_v.byAchievement') : `🪙 ${n(a.precio)}`}</span>
                    </span>
                    {puesto && <Check size={16} className="text-brand" />}
                  </button>
                  {!tiene && !a.soloLogro && verAcc === id && (
                    <button type="button" onClick={() => comprar(id, a.precio)} className="mt-2 w-full rounded-xl bg-brand px-2 py-1.5 text-xs font-bold text-white hover:opacity-90">{t('dashboard.mascota_v.buyFor', { n: n(a.precio) })}</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div data-help="mascota-habitats" className={tarjeta}>
          <CabeceraTarjeta icono={PawPrint} titulo={t('dashboard.mascota_v.habitats')} />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(HABITATS).map(([id, h]) => {
              const tiene = m.habitats.includes(id);
              const puesto = m.habitat === id;
              return (
                <div key={id} className={`overflow-hidden rounded-2xl border ${puesto ? 'border-brand' : verHab === id ? 'border-amber-400/60' : 'border-line'}`}>
                  <button type="button" onClick={() => ponerHab(id)} className="block w-full text-left">
                    <div className="relative h-16" style={{ background: `linear-gradient(180deg, ${h.fondo[0]}, ${h.fondo[1]})` }}>
                      <img src={svgMascota(h.decor[0])} alt="" className="absolute bottom-1 left-1 h-7" />
                      <img src={svgMascota(h.decor[1])} alt="" className="absolute right-1.5 top-1.5 h-5" />
                    </div>
                    <div className="bg-bg px-2.5 py-1.5">
                      <span className="block truncate text-xs font-semibold text-fg">{t(`dashboard.mascota_v.hab.${id}`)}</span>
                      <span className="block text-[11px] text-muted">{puesto ? t('dashboard.mascota_v.wearing') : tiene ? t('dashboard.mascota_v.owned') : `🪙 ${n(h.precio)}`}</span>
                    </div>
                  </button>
                  {!tiene && verHab === id && (
                    <button type="button" onClick={() => comprar(id, h.precio)} className="w-full bg-brand px-2 py-1.5 text-xs font-bold text-white hover:opacity-90">{t('dashboard.mascota_v.buyFor', { n: n(h.precio) })}</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div data-help="mascota-comidas" className={tarjeta}>
          <CabeceraTarjeta icono={Store} titulo={t('dashboard.mascota_v.foods')} />
          <p className="mt-1 text-xs text-muted">{t('dashboard.mascota_v.foodsHint')}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(COMIDAS).map(([id, f]) => (
              <div key={id} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2">
                <img src={svgMascota(f.svg)} alt="" className="h-8 w-8" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fg">{t(`dashboard.mascota_v.food_.${id}`)}</span>
                  <span className="block text-[11px] text-muted">{Object.entries(f.efecto).map(([k, v]) => `+${v} ${{ hambre: '🍖', alegria: '😊', salud: '❤️', energia: '⚡' }[k]}`).join(' ')}</span>
                </span>
                <button type="button" onClick={() => comprar(id, f.precio)} className="shrink-0 rounded-xl border border-line px-3 py-1.5 text-xs font-bold text-fg hover:border-brand">🪙 {n(f.precio)}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ) : principal;

  // ---------- Pestaña Combate ----------
  const st = (m && m.stats) || {};
  const combateTab = viva ? (
    <>
      <div data-help="mascota-atributos" className={tarjeta}>
        <CabeceraTarjeta icono={Swords} titulo={t('dashboard.mascota_v.trainTitle')} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.mascota_v.trainHint', { e: ENERGIA_ENTRENO })}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {Object.entries(STATS).map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line bg-bg p-4">
              <p className="flex items-center justify-between text-sm font-bold text-fg"><span>{v.emoji} {t(`dashboard.mascota_v.stat.${k}`)}</span><span className="text-xl font-black">{st[k] || 5}</span></p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-gradient-to-r from-brand to-fuchsia-500" style={{ width: `${st[k] || 5}%` }} /></div>
              <p className="mt-2 text-[11px] text-muted">{t(`dashboard.mascota_v.statDesc.${k}`)}</p>
              {per && per.entrena === k && <p className="mt-1 text-[11px] font-semibold text-emerald-400">{t('dashboard.mascota_v.persBonus')}</p>}
            </div>
          ))}
        </div>
        <div className="mt-4"><Barra icono="⚡" etiqueta={t('dashboard.mascota_v.energy')} valor={m.energia} color="#38bdf8" /></div>
      </div>
      <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Dato icono="💪" valor={n(m.poder)} etiqueta={t('dashboard.mascota_v.power')} />
        <Dato icono="✅" valor={n(c.victorias)} etiqueta={t('dashboard.mascota_v.wins')} />
        <Dato icono="❌" valor={n(c.derrotas)} etiqueta={t('dashboard.mascota_v.losses')} />
        <Dato icono="🔥" valor={n(c.racha)} etiqueta={t('dashboard.mascota_v.streak')} />
        <Dato icono="🏅" valor={n(c.mejorRacha)} etiqueta={t('dashboard.mascota_v.bestStreak')} />
      </div>
      <div data-help="mascota-habilidad" className={tarjeta}>
        <CabeceraTarjeta icono={Sparkles} titulo={t('dashboard.mascota_v.skillTitle')} />
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-bg p-4">
          <img src={svgMascota(esp.svg)} alt="" className="h-14 w-14" />
          <div>
            <p className="text-sm font-bold text-fg">🌟 {t(`dashboard.mascota_v.skill.${m.especie}.n`)}</p>
            <p className="text-xs text-muted">{t(`dashboard.mascota_v.skill.${m.especie}.d`)}</p>
          </div>
        </div>
        <ul className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-3">
          <li>💥 {t('dashboard.mascota_v.combatCrit')}</li>
          <li>💨 {t('dashboard.mascota_v.combatDodge')}</li>
          <li>🛡️ {t('dashboard.mascota_v.combatDef')}</li>
        </ul>
        <button type="button" onClick={() => dash.setActiveTab('crec-liga')} className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-fg hover:border-brand"><Trophy size={13} /> {t('dashboard.mascota_v.goLeague')}</button>
      </div>
    </>
  ) : principal;

  // ---------- Pestaña Diario ----------
  const diarioTab = viva ? (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div data-help="mascota-diario" className={tarjeta}>
        <CabeceraTarjeta icono={BookOpen} titulo={t('dashboard.mascota_v.diary', { n: m.nombre })} />
        {m.diario.length === 0 ? <Vacio icono={BookOpen} titulo={t('dashboard.mascota_v.noDiary')} /> : (
          <ol className="relative mt-5 space-y-4 border-l-2 border-line pl-5">
            {m.diario.map((r, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-card bg-brand" />
                <p className="text-sm text-fg">{r[lang]}</p>
                <p className="text-[11px] text-muted">{new Date(r.fecha).toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div data-help="mascota-logros" className={`${tarjeta} h-fit`}>
        <CabeceraTarjeta icono={Trophy} titulo={t('dashboard.mascota_v.achievements', { a: m.logros.length, b: LOGROS.length })} />
        <ul className="mt-4 grid grid-cols-2 gap-2">
          {LOGROS.map((l) => {
            const ok = m.logros.includes(l.id);
            return (
              <li key={l.id} className={`rounded-2xl border p-2.5 text-center ${ok ? 'border-amber-400/50 bg-amber-400/10' : 'border-line bg-bg opacity-60'}`}>
                <p className={`text-2xl ${ok ? '' : 'grayscale'}`}>{ok ? l.emoji : '🔒'}</p>
                <p className="mt-1 text-[11px] font-semibold leading-tight text-fg">{t(`dashboard.mascota_v.logro.${l.id}`)}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  ) : principal;

  // ---------- Pestaña Ajustes ----------
  const ajustesTab = (
    <div data-help="mascota-config" className={tarjeta}>
      <CabeceraTarjeta icono={Settings2} titulo={t('dashboard.mascota_v.title')} activo={form.activo} onActivo={set('activo')} />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Campo etiqueta={t('dashboard.mascota_v.channel')} ayuda={t('dashboard.mascota_v.channelHint')}>
          <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} vacio={t('dashboard.mascota_v.noChannel')} />
        </Campo>
        <Campo etiqueta={t('dashboard.mascota_v.carerRole')} ayuda={t('dashboard.mascota_v.carerRoleHint')}>
          <SelectRol roles={roles} value={form.rolCuidadorId} onChange={set('rolCuidadorId')} vacio={t('dashboard.mascota_v.noRole')} />
        </Campo>
        <Campo etiqueta={t('dashboard.mascota_v.hello')} ayuda={t('dashboard.mascota_v.helloHint')}>
          <Numero value={form.horaSaludo ?? 10} onChange={set('horaSaludo')} max={23} />
        </Campo>
        <Campo etiqueta={t('dashboard.mascota_v.surprisesDay')} ayuda={t('dashboard.mascota_v.surprisesDayHint')}>
          <Numero value={form.eventosPorDia ?? 2} onChange={set('eventosPorDia')} min={1} max={4} />
        </Campo>
        <FilaInterruptor titulo={t('dashboard.mascota_v.surprises')} desc={t('dashboard.mascota_v.surprisesHint')}>
          <Toggle checked={form.eventos !== false} onChange={set('eventos')} />
        </FilaInterruptor>
        <FilaInterruptor titulo={t('dashboard.mascota_v.greet')} desc={t('dashboard.mascota_v.greetHint')}>
          <Toggle checked={form.saludarNuevos !== false} onChange={set('saludarNuevos')} />
        </FilaInterruptor>
        <FilaInterruptor titulo={t('dashboard.mascota_v.alerts')} desc={t('dashboard.mascota_v.alertsHint')}>
          <Toggle checked={form.avisos !== false} onChange={set('avisos')} />
        </FilaInterruptor>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} />
        {m && (
          <button type="button" onClick={reiniciar} className="inline-flex items-center gap-2 rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-muted hover:border-danger hover:text-danger">
            <RotateCcw size={13} /> {t('dashboard.mascota_v.reset')}
          </button>
        )}
      </div>
    </div>
  );

  const contenido = { estado: estadoTab, aspecto: aspectoTab, combate: combateTab, diario: diarioTab, ajustes: ajustesTab }[pestana];

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.mascota_v.intro')}</p>
      {form.activo && !form.canalId && <Aviso tipo="alerta">{t('dashboard.mascota_v.needChannel')}</Aviso>}
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-card p-1">
        {PESTANAS.map(({ id, icono: Icono }) => (
          <button key={id} type="button" role="tab" aria-selected={pestana === id} onClick={() => { setPestana(id); setVista(null); setAviso(null); }}
            className={`inline-flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-1.5 py-2 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-3 sm:text-sm ${pestana === id ? 'bg-brand text-white shadow-soft' : 'text-muted hover:text-fg'}`}>
            <Icono size={15} className="hidden shrink-0 min-[400px]:block" /> {t(`dashboard.mascota_v.tabs.${id}`)}
          </button>
        ))}
      </div>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      {contenido}
    </div>
  );
}
