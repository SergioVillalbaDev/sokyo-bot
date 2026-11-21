// Diversión · Mascota (1.14.0) — la mascota del servidor: nace de un huevo que el
// servidor vota, crece con lo que la cuidan y con lo vivo que está el servidor, y
// desbloquea ventajas para todos. Aquí se ve cómo está, quién la cuida y se ajusta
// dónde vive. Lógica del bot en utils/mascota.js y utils/mascotaNucleo.js.
import { useTranslation } from 'react-i18next';
import { PawPrint, Heart, Settings2, Award, Egg, Lock, CheckCircle2, PauseCircle, RotateCcw, Swords, Sparkles } from 'lucide-react';
import { Avatar, Toggle } from '../../ui/primitives';
import { tarjeta, CabeceraTarjeta, Campo, SelectCanal, SelectRol, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio, FilaInterruptor } from './modulosShared';
import { useModulo } from '../../../hooks/useModulo';
import { ESPECIES, FORMAS, FASES, VENTAJAS, svgMascota } from '../../../lib/mascota';

const colorBarra = (v) => (v >= 60 ? '#22c55e' : v >= 30 ? '#f59e0b' : '#ef4444');

function Barra({ icono, etiqueta, valor }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold">
        <span className="text-fg">{icono} {etiqueta}</span>
        <span className="text-muted">{Math.round(valor)}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(3, valor)}%`, background: colorBarra(valor) }} />
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

export default function MascotaView({ dash }) {
  const { t, i18n } = useTranslation();
  const { canales, roles, accionModulo } = dash;
  const { datos, form, set, guardar, estado, autoguardado } = useModulo(dash, 'mascota');

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const m = datos.mascota;
  const n = (v) => Number(v || 0).toLocaleString(i18n.language);
  const eclosionar = async () => {
    if (!window.confirm(t('dashboard.mascota_v.hatchConfirm'))) return;
    await accionModulo('mascota/eclosionar', 'POST');
  };
  const reiniciar = async () => {
    if (!window.confirm(t('dashboard.mascota_v.resetConfirm'))) return;
    await accionModulo('mascota/reiniciar', 'POST');
  };

  // ---------- La mascota (o el huevo) ----------
  let principal;
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
  } else {
    const esp = ESPECIES[m.especie] || ESPECIES.dragon;
    const forma = m.forma ? FORMAS[m.forma] : null;
    const color = (forma && forma.color) || esp.color;
    const fase = FASES.find((f) => f.id === m.fase) || FASES[0];
    const tam = { cria: 'h-28 w-28', joven: 'h-36 w-36', adulta: 'h-40 w-40', legendaria: 'h-44 w-44' }[m.fase] || 'h-36 w-36';
    const pct = m.nivel >= 50 ? 100 : Math.min(100, (m.xp / m.xpNecesaria) * 100);
    const c = m.contadores || {};
    principal = (
      <div data-help="mascota-ficha" className={`${tarjeta} relative overflow-hidden`}>
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: color }} />
        <div className="relative grid items-center gap-6 md:grid-cols-[240px_1fr]">
          <div className="relative mx-auto grid h-56 w-56 place-items-center">
            <div className="absolute inset-3 rounded-full border-4" style={{ borderColor: `${color}aa`, background: `radial-gradient(circle, ${color}55 0%, ${color}11 60%, transparent 75%)` }} />
            {m.fase === 'legendaria' && <img src={svgMascota('1f451')} alt="" className="absolute top-1 h-12 w-12 drop-shadow" />}
            <img src={svgMascota(esp.svg)} alt="" className={`relative ${tam} drop-shadow-2xl ${m.hibernando ? 'sk-mascota-dormida' : 'sk-mascota'}`} />
            {forma && <img src={svgMascota(forma.svg)} alt="" className="absolute bottom-6 right-6 h-11 w-11 drop-shadow" />}
            {m.hibernando && <img src={svgMascota('1f4a4')} alt="" className="absolute right-8 top-6 h-12 w-12" />}
            {m.animo === 'enferma' && <img src={svgMascota('1f912')} alt="" className="absolute right-8 top-6 h-11 w-11" />}
            {m.animo === 'feliz' && <img src={svgMascota('2728')} alt="" className="absolute left-6 top-8 h-9 w-9" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-3xl font-black text-fg">{m.nombre}</h3>
              <span className="rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: color }}>{t('dashboard.mascota_v.level', { n: m.nivel })}</span>
            </div>
            <p className="mt-1 text-sm font-semibold" style={{ color }}>
              {t(`dashboard.mascota_v.especies.${m.especie}`)} · {fase.emoji} {t(`dashboard.mascota_v.fases.${m.fase}`)}{forma ? ` · ${t(`dashboard.mascota_v.formas.${m.forma}`)}` : ''}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-elevated" title={`${n(m.xp)} / ${n(m.xpNecesaria)} XP`}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
            </div>
            <p className="mt-1 text-[11px] text-muted">{m.nivel >= 50 ? t('dashboard.mascota_v.maxLevel') : t('dashboard.mascota_v.xp', { a: n(m.xp), b: n(m.xpNecesaria) })}</p>
            <div className="mt-4 space-y-3">
              <Barra icono="🍖" etiqueta={t('dashboard.mascota_v.food')} valor={m.hambre} />
              <Barra icono="😊" etiqueta={t('dashboard.mascota_v.joy')} valor={m.alegria} />
              <Barra icono="❤️" etiqueta={t('dashboard.mascota_v.health')} valor={m.salud} />
            </div>
            <p className="mt-4 rounded-2xl border border-line bg-bg px-3 py-2 text-sm text-fg">{t(`dashboard.mascota_v.animo.${m.animo}`, { n: m.nombre })}</p>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Dato icono="💪" valor={n(m.poder)} etiqueta={t('dashboard.mascota_v.power')} />
          <Dato icono="✅" valor={n(c.victorias)} etiqueta={t('dashboard.mascota_v.wins')} />
          <Dato icono="❌" valor={n(c.derrotas)} etiqueta={t('dashboard.mascota_v.losses')} />
          <Dato icono="🔥" valor={n(c.racha)} etiqueta={t('dashboard.mascota_v.streak')} />
          <Dato icono="🪙" valor={n(c.comida)} etiqueta={t('dashboard.mascota_v.eaten')} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.mascota_v.intro')}</p>
      {form.activo && !form.canalId && <Aviso tipo="alerta">{t('dashboard.mascota_v.needChannel')}</Aviso>}

      {principal}

      {/* Ventajas por nivel */}
      <div data-help="mascota-ventajas" className={tarjeta}>
        <CabeceraTarjeta icono={Award} titulo={t('dashboard.mascota_v.perks')} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.mascota_v.perksHint')}</p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {VENTAJAS.map((v) => {
            const activa = m?.ventajas?.includes(v.id);
            const alcanzada = m && m.estado === 'viva' && m.nivel >= v.nivel;
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
        {/* Cuidadores */}
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

        {/* Cómo se cuida */}
        <div data-help="mascota-como" className={tarjeta}>
          <CabeceraTarjeta icono={PawPrint} titulo={t('dashboard.mascota_v.howTitle')} />
          <ul className="mt-4 space-y-2.5 text-sm">
            {['feed', 'pet', 'play', 'server', 'toxic', 'battles'].map((k) => (
              <li key={k} className="flex gap-2.5"><span aria-hidden>{t(`dashboard.mascota_v.how.${k}.e`)}</span><span className="text-fg">{t(`dashboard.mascota_v.how.${k}.t`)}</span></li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted"><Swords size={13} /> {t('dashboard.mascota_v.leagueTip')}</p>
        </div>
      </div>

      {/* Ajustes */}
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
          <div className="space-y-3 self-end">
            <FilaInterruptor titulo={t('dashboard.mascota_v.greet')} desc={t('dashboard.mascota_v.greetHint')}>
              <Toggle checked={form.saludarNuevos !== false} onChange={set('saludarNuevos')} />
            </FilaInterruptor>
            <FilaInterruptor titulo={t('dashboard.mascota_v.alerts')} desc={t('dashboard.mascota_v.alertsHint')}>
              <Toggle checked={form.avisos !== false} onChange={set('avisos')} />
            </FilaInterruptor>
          </div>
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
    </div>
  );
}
