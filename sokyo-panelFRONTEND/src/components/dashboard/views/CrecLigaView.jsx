// Crecimiento · Liga Sokyo (1.14.0) — clasificación mensual de servidores: puntos por
// los votos de los miembros, por el oro con el que lo impulsan y por los combates de
// su mascota. El podio sale destacado el mes siguiente en /servidores y en la Red
// Sokyo. Lógica del bot en utils/liga.js.
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Swords, Rocket, Vote, Settings2, Crown, CalendarClock } from 'lucide-react';
import { Toggle } from '../../ui/primitives';
import { tarjeta, CabeceraTarjeta, Campo, SelectCanal, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio, FilaInterruptor } from './modulosShared';
import { useAutoguardado } from '../../../hooks/useAutoguardado';
import { ESPECIES, svgMascota } from '../../../lib/mascota';

const DIV = {
  bronce: { emoji: '🥉', color: '#b45309' },
  plata: { emoji: '🥈', color: '#94a3b8' },
  oro: { emoji: '🥇', color: '#eab308' },
  diamante: { emoji: '💎', color: '#38bdf8' },
  leyenda: { emoji: '👑', color: '#a855f7' },
};
const MEDALLAS = ['🥇', '🥈', '🥉'];

export default function CrecLigaView({ dash }) {
  const { t, i18n } = useTranslation();
  const idiomaPanel = i18n.language;
  const { canales, cargarCrecimiento, guardarCrecimiento, setActiveTab, guildId } = dash;
  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null);
  const [estado, setEstado] = useState('');

  const cargar = useCallback(async () => {
    const r = await cargarCrecimiento('liga');
    if (r.error) { setDatos({ error: r.error }); return; }
    setDatos(r);
    setForm(r.config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idiomaPanel]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    setEstado('guardando');
    const r = await guardarCrecimiento('liga', form);
    if (r.error) { setEstado(r.error); return false; }
    setEstado('ok');
    return true;
  };
  const autoguardado = useAutoguardado(form, guardar, { listo: !!form, borrador: 'crec-liga', restaurar: setForm });

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;
  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setEstado(''); };
  const n = (v) => Number(v || 0).toLocaleString(i18n.language);
  const div = DIV[datos.division] || DIV.bronce;
  const reglas = datos.reglas || {};
  const divisiones = reglas.divisiones || [];
  const desde = (divisiones.find((d) => d.id === datos.division) || { desde: 0 }).desde;
  const hasta = datos.siguiente ? desde + (datos.puntos - desde) + datos.siguiente.faltan : null;
  const pct = hasta ? Math.min(100, ((datos.puntos - desde) / (hasta - desde)) * 100) : 100;
  const dias = datos.diasRestantes ?? 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.liga_v.intro')}</p>
      {form.activo && !datos.mascotaActiva && form.combates !== false && (
        <Aviso accion={<button type="button" className="font-semibold underline" onClick={() => setActiveTab('com-mascota')}>{t('dashboard.liga_v.goPet')}</button>}>{t('dashboard.liga_v.needPet')}</Aviso>
      )}
      {datos.anterior?.destacado && <Aviso>{t('dashboard.liga_v.featured', { pos: datos.anterior.posicion })}</Aviso>}

      {/* Dónde estáis */}
      <div data-help="liga-resumen" className={`${tarjeta} relative overflow-hidden`}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-25 blur-3xl" style={{ background: div.color }} />
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-3xl border-2 text-5xl" style={{ borderColor: div.color, background: `${div.color}22` }}>{div.emoji}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.liga_v.month', { mes: new Date(`${datos.mes}-15T12:00:00Z`).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' }) })}</p>
            <p className="text-2xl font-black text-fg">{t(`dashboard.liga_v.div.${datos.division}`)}</p>
            <p className="text-sm text-muted">
              {datos.posicion ? t('dashboard.liga_v.position', { pos: datos.posicion, total: datos.total }) : t('dashboard.liga_v.noPoints')}
              {' · '}{t('dashboard.liga_v.points', { n: n(datos.puntos) })}
            </p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-elevated">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: div.color }} />
            </div>
            <p className="mt-1 text-[11px] text-muted">{datos.siguiente ? t('dashboard.liga_v.next', { n: n(datos.siguiente.faltan), div: t(`dashboard.liga_v.div.${datos.siguiente.id}`) }) : t('dashboard.liga_v.top')}</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-3 py-2 text-sm text-fg"><CalendarClock size={15} className="text-muted" /> {t('dashboard.liga_v.daysLeft', { count: dias })}</div>
        </div>
        <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
          {[
            { k: 'votos', icono: Vote, color: '#38bdf8' },
            { k: 'impulsos', icono: Rocket, color: '#f59e0b' },
            { k: 'combates', icono: Swords, color: '#ef4444' },
          ].map(({ k, icono: Icono, color }) => (
            <div key={k} className="rounded-2xl border border-line bg-bg p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted"><Icono size={14} style={{ color }} /> {t(`dashboard.liga_v.src.${k}`)}</p>
              <p className="mt-1 text-xl font-black text-fg">{n(datos.desglose[k])}</p>
              <p className="text-[11px] text-muted">{t(`dashboard.liga_v.srcHint.${k}`, { v: reglas.puntosVoto, o: reglas.oroPorPunto, tope: n(reglas.topeOroDia), w: reglas.victoria, l: reglas.derrota })}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Clasificación */}
        <div data-help="liga-clasificacion" className={tarjeta}>
          <CabeceraTarjeta icono={Trophy} titulo={t('dashboard.liga_v.standings')} />
          {datos.top.length === 0 ? <Vacio icono={Trophy} titulo={t('dashboard.liga_v.emptyTitle')} sub={t('dashboard.liga_v.emptySub')} /> : (
            <ol className="mt-4 space-y-2">
              {datos.top.map((s) => {
                const d = DIV[s.division] || DIV.bronce;
                const mio = s.id === guildId;
                return (
                  <li key={s.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${mio ? 'border-brand bg-brand/10' : 'border-line bg-bg'}`}>
                    <span className="w-7 shrink-0 text-center text-lg">{MEDALLAS[s.posicion - 1] || <span className="text-sm font-bold text-muted">{s.posicion}</span>}</span>
                    {s.icono ? <img src={s.icono} alt="" className="h-8 w-8 shrink-0 rounded-xl" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-elevated text-xs font-bold text-muted">{s.nombre.slice(0, 2)}</span>}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{s.nombre}{mio ? ` · ${t('dashboard.liga_v.you')}` : ''}</span>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${d.color}22`, color: d.color }}>{t(`dashboard.liga_v.div.${s.division}`)}</span>
                    <span className="w-14 shrink-0 text-right text-xs font-bold text-fg">{n(s.puntos)}</span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-4 flex items-center gap-2 text-xs text-muted"><Crown size={13} className="text-amber-400" /> {t('dashboard.liga_v.podiumPrize')}</p>
        </div>

        {/* Combates */}
        <div data-help="liga-combates" className={tarjeta}>
          <CabeceraTarjeta icono={Swords} titulo={t('dashboard.liga_v.battles')} />
          <p className="mt-1 text-xs text-muted">{t('dashboard.liga_v.battlesHint', { h: reglas.horaCombate })}</p>
          {datos.combates.length === 0 ? <Vacio icono={Swords} titulo={t('dashboard.liga_v.noBattles')} sub={t('dashboard.liga_v.noBattlesSub')} /> : (
            <ul className="mt-4 space-y-2">
              {datos.combates.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2">
                  <img src={svgMascota((ESPECIES[c.yo.especie] || ESPECIES.dragon).svg)} alt="" className="h-8 w-8 shrink-0" />
                  <span className="text-xs font-bold text-muted">VS</span>
                  {c.rival.especie ? <img src={svgMascota((ESPECIES[c.rival.especie] || ESPECIES.dragon).svg)} alt="" className="h-8 w-8 shrink-0" /> : <span className="text-2xl" aria-hidden>👾</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">{c.rival.nombre || t('dashboard.liga_v.wild')}{c.rival.servidor ? <span className="font-normal text-muted"> · {c.rival.servidor}</span> : null}</span>
                    <span className="block text-[11px] text-muted">{new Date(c.hora).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })} · 📣 {c.yo.animos} · 💪 {c.yo.poder} vs {c.rival.poder}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${c.gana === null ? 'bg-elevated text-muted' : c.gana ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                    {c.gana === null ? t('dashboard.liga_v.pending') : c.gana ? t('dashboard.liga_v.won') : t('dashboard.liga_v.lost')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Ajustes */}
      <div data-help="liga-config" className={tarjeta}>
        <CabeceraTarjeta icono={Settings2} titulo={t('dashboard.liga_v.title')} activo={form.activo} onActivo={set('activo')} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.liga_v.titleHint')}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.liga_v.channel')} ayuda={t('dashboard.liga_v.channelHint')}>
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} vacio={t('dashboard.liga_v.noChannel')} />
          </Campo>
          <div className="self-end">
            <FilaInterruptor titulo={t('dashboard.liga_v.fights')} desc={t('dashboard.liga_v.fightsHint')}>
              <Toggle checked={form.combates !== false} onChange={set('combates')} />
            </FilaInterruptor>
          </div>
        </div>
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
      </div>
    </div>
  );
}
