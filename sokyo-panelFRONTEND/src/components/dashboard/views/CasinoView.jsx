// Diversión · Casino (1.16.0) — juegos con oro virtual (tragaperras con bote, ruleta,
// blackjack, crash, minas, cara o cruz, duelos y carreras) y cofres de mascotas.
// Aquí se activa, se eligen los juegos, los límites (apuesta mínima y máxima, tope de
// pérdidas al día) y se ven los números. Lógica del bot en utils/casino.js y utils/cofres.js.
import { useState } from 'react';
import Plegable from '../Plegable';
import { useTranslation } from 'react-i18next';
import { Dices, ShieldCheck, Trophy, Sparkles, Gift, TrendingUp, Settings2, BookOpen, Pin, Swords } from 'lucide-react';
import { Avatar, Toggle } from '../../ui/primitives';
import { tarjeta, CabeceraTarjeta, Campo, SelectCanal, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio, FilaInterruptor } from './modulosShared';
import { useModulo } from '../../../hooks/useModulo';
import { SIMBOLOS, JUEGOS, RAREZAS, COMPANEROS, COFRES, PIEDAD } from '../../../lib/casino';
import { svgMascota, spriteCompanero } from '../../../lib/mascota';
import { API_URL } from '../../../lib/api';

const EMOJI_JUEGO = { tragaperras: '🎰', ruleta: '🎡', blackjack: '🃏', crash: '🚀', minas: '💣', moneda: '🪙', hilo: '🔼', rasca: '🎟️', duelo: '⚔️', carrera: '🏇', plinko: '🔻', rueda: '🎡', loteria: '🎫', dados: '🎲', baccarat: '🂠', bingo: '🎱' };
const ORDEN_R = ['comun', 'rara', 'epica', 'legendaria', 'mitica', 'divina'];

// Tragaperras de adorno: tres rodillos que giran sin parar.
function Maquina() {
  const tira = [...SIMBOLOS, ...SIMBOLOS];
  return (
    <div className="flex gap-2 rounded-3xl border-4 border-amber-400 bg-gradient-to-b from-red-800 to-red-950 p-3 shadow-soft">
      {[1, 2, 3].map((r) => (
        <div key={r} className="h-20 w-16 overflow-hidden rounded-2xl bg-stone-100 shadow-inner">
          <div className={`sk-rodillo ${r === 2 ? 'sk-rodillo-2' : r === 3 ? 'sk-rodillo-3' : ''}`}>
            {tira.map((s, i) => <img key={i} src={svgMascota(s.svg)} alt="" className="mx-auto my-2 h-16 w-12 object-contain p-1" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Cifra({ etiqueta, valor, color }) {
  return (
    <div className="rounded-2xl border border-line bg-bg px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{etiqueta}</p>
      <p className="mt-1 text-xl font-black" style={{ color }}>{valor}</p>
    </div>
  );
}

export default function CasinoView({ dash }) {
  const { t, i18n } = useTranslation();
  const { canales, accionModulo } = dash;
  const { datos, form, set, guardar, estado, autoguardado } = useModulo(dash, 'casino');
  const [cofre, setCofre] = useState('basico');
  const [guia, setGuia] = useState(null);
  const [lobby, setLobby] = useState(null);

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;
  const n = (v) => Math.round(Number(v || 0)).toLocaleString(i18n.language);
  const juegos = form.juegos || {};
  const setJuego = (j) => (v) => set('juegos')({ ...juegos, [j]: v });
  const combate = form.combate || {};
  const setCombate = (k) => (v) => set('combate')({ ...combate, [k]: v });
  const casa = (x) => (x.apostado || 0) - (x.premios || 0);
  const cof = datos.cofres || { porRareza: {}, ultimas: [], abiertos: 0, divinasMundo: 0 };
  const pct = (v) => `${(Math.round(v * 1000) / 10).toLocaleString(i18n.language)}${i18n.language.startsWith('es') ? ' %' : '%'}`;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.casino_v.intro')}</p>
      <Aviso>{t('dashboard.casino_v.virtual')}</Aviso>

      {/* Cómo se juega */}
      <div data-help="casino-como" className={tarjeta}>
        <CabeceraTarjeta icono={BookOpen} titulo={t('dashboard.casino_v.howTitle')} />
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((p) => (
            <li key={p} className="rounded-2xl border border-line bg-bg p-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-400/15 text-sm font-black text-amber-300">{p}</span>
              <p className="mt-2 text-sm text-fg">{t(`dashboard.casino_v.how.p${p}`, { min: form.apuestaMin ?? 10, max: form.apuestaMax ?? 5000 })}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-1.5 text-xs sm:grid-cols-2">
          {JUEGOS.filter((j) => juegos[j] !== false).map((j) => (
            <code key={j} className="truncate rounded-xl border border-line bg-bg px-3 py-1.5 text-fg">{EMOJI_JUEGO[j]} {t(`dashboard.casino_v.ej.${j}`)}</code>
          ))}
        </div>
        {/* Lobby (1.23.0): el mensaje fijo con el desplegable de todos los juegos */}
        <div className="mt-4 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-red-900/30 via-fuchsia-900/20 to-amber-700/20 p-4">
          <p className="text-sm font-extrabold text-fg">🎰 {t('dashboard.casino_v.lobbyTitle')}</p>
          <p className="mt-1 text-xs text-muted">{t('dashboard.casino_v.lobbySub')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={!form.canalId || !form.activo || lobby === 'enviando'}
              onClick={async () => { setLobby('enviando'); const r = await accionModulo('casino/lobby', 'POST', {}); setLobby(r.error ? { tipo: 'alerta', texto: r.error } : { tipo: 'info', texto: t('dashboard.casino_v.lobbyDone') }); }}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-brand px-4 py-2 text-sm font-extrabold text-on-brand shadow-soft disabled:opacity-50">
              <Pin size={14} /> {lobby === 'enviando' ? t('dashboard.casino_v.lobbySending') : datos.config?.lobby?.mensajeId ? t('dashboard.casino_v.lobbyRepost') : t('dashboard.casino_v.lobbyPost')}
            </button>
            {(!form.canalId || !form.activo) && <span className="text-xs text-muted">{t('dashboard.casino_v.lobbyNeed')}</span>}
          </div>
          {lobby && lobby !== 'enviando' && <div className="mt-3"><Aviso tipo={lobby.tipo}>{lobby.texto}</Aviso></div>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={!form.canalId}
            onClick={async () => { const r = await accionModulo('casino/guia', 'POST', {}); setGuia(r.error ? { tipo: 'alerta', texto: r.error } : { tipo: 'info', texto: t('dashboard.casino_v.guidePosted') }); }}
            className="inline-flex items-center gap-2 rounded-2xl border border-line px-4 py-2 text-sm font-bold text-fg hover:border-brand disabled:opacity-50">
            <Pin size={14} /> {t('dashboard.casino_v.postGuide')}
          </button>
          <span className="text-xs text-muted">{form.canalId ? t('dashboard.casino_v.postGuideHint') : t('dashboard.casino_v.postGuideNeed')}</span>
        </div>
        {guia && <div className="mt-3"><Aviso tipo={guia.tipo}>{guia.texto}</Aviso></div>}
      </div>

      {/* Cabecera: la máquina y el bote */}
      <div data-help="casino-bote" className={`${tarjeta} relative overflow-hidden`}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="relative flex flex-col items-center gap-6 sm:flex-row">
          <Maquina />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.casino_v.jackpot')}</p>
            <p className="text-4xl font-black sm:text-5xl"><span aria-hidden>🪙</span> <span className="sk-bote">{n(datos.bote)}</span></p>
            <p className="mt-1 text-sm text-muted">{t('dashboard.casino_v.jackpotHint')}</p>
            {datos.ultimoBote && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-fg">
                <Avatar src={datos.ultimoBote.avatar} name={datos.ultimoBote.nombre} size={18} /> {t('dashboard.casino_v.lastJackpot', { n: datos.ultimoBote.nombre, p: n(datos.ultimoBote.premio) })}
              </p>
            )}
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Cifra etiqueta={t('dashboard.casino_v.betToday')} valor={`🪙 ${n(datos.hoy.apostado)}`} />
          <Cifra etiqueta={t('dashboard.casino_v.paidToday')} valor={`🪙 ${n(datos.hoy.premios)}`} />
          <Cifra etiqueta={t('dashboard.casino_v.house7')} valor={`${casa(datos.semana) >= 0 ? '' : '−'}🪙 ${n(Math.abs(casa(datos.semana)))}`} color={casa(datos.semana) >= 0 ? '#22c55e' : '#ef4444'} />
          <Cifra etiqueta={t('dashboard.casino_v.plays7')} valor={n(datos.semana.jugadas)} />
        </div>
        <p className="relative mt-2 text-[11px] text-muted">{t('dashboard.casino_v.houseHint')}</p>
      </div>

      {/* Juegos */}
      <div data-help="casino-juegos" className={tarjeta}>
        <CabeceraTarjeta icono={Dices} titulo={t('dashboard.casino_v.title')} activo={form.activo} onActivo={set('activo')} />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {JUEGOS.map((j) => {
            const on = juegos[j] !== false;
            const st = datos.porJuego?.[j];
            return (
              <div key={j} className={`rounded-2xl border p-3 transition-colors ${on ? 'border-amber-400/40 bg-amber-400/5' : 'border-line bg-bg opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-3xl leading-none" aria-hidden>{EMOJI_JUEGO[j]}</span>
                  <Toggle checked={on} onChange={setJuego(j)} />
                </div>
                <p className="mt-2 text-sm font-bold text-fg">{t(`dashboard.casino_v.juegos.${j}.n`)}</p>
                <p className="text-xs text-muted">{t(`dashboard.casino_v.juegos.${j}.d`)}</p>
                <p className="mt-2 text-[11px] font-semibold text-muted">{st ? t('dashboard.casino_v.gameStats', { j: n(st.jugadas), a: n(st.apostado) }) : t('dashboard.casino_v.noPlays')}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ajustes y frenos */}
      <div data-help="casino-ajustes" className={tarjeta}>
        <CabeceraTarjeta icono={ShieldCheck} titulo={t('dashboard.casino_v.limits')} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.casino_v.limitsHint')}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo etiqueta={t('dashboard.casino_v.channel')} ayuda={t('dashboard.casino_v.channelHint')}>
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} vacio={t('dashboard.casino_v.anyChannel')} />
          </Campo>
          <Campo etiqueta={t('dashboard.casino_v.news')} ayuda={t('dashboard.casino_v.newsHint')}>
            <SelectCanal canales={canales} value={form.anunciosId} onChange={set('anunciosId')} vacio={t('dashboard.casino_v.noNews')} />
          </Campo>
          <Campo etiqueta={t('dashboard.casino_v.daily')} ayuda={t('dashboard.casino_v.dailyHint')}>
            <Numero value={form.limiteDiario ?? 20000} onChange={set('limiteDiario')} max={100000000} />
          </Campo>
          <Campo etiqueta={t('dashboard.casino_v.min')}><Numero value={form.apuestaMin ?? 10} onChange={set('apuestaMin')} min={1} max={1000000} /></Campo>
          <Campo etiqueta={t('dashboard.casino_v.max')}><Numero value={form.apuestaMax ?? 5000} onChange={set('apuestaMax')} min={1} max={10000000} /></Campo>
          <div className="self-end">
            <FilaInterruptor titulo={t('dashboard.casino_v.chests')} desc={t('dashboard.casino_v.chestsHint')}>
              <Toggle checked={form.cofres !== false} onChange={set('cofres')} />
            </FilaInterruptor>
          </div>
        </div>
        <ul className="mt-4 grid gap-1.5 text-xs text-muted sm:grid-cols-2">
          {['pause', 'refund', 'odds', 'cashback'].map((k) => <li key={k}>✔️ {t(`dashboard.casino_v.safe.${k}`)}</li>)}
        </ul>
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
      </div>

      {/* 1.32.0: combates de compañeros (retos, torre, jefe semanal) */}
      <div data-help="casino-combates" className={tarjeta}>
        <CabeceraTarjeta icono={Swords} titulo={t('dashboard.casino_v.combate.titulo')} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.casino_v.combate.sub')}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FilaInterruptor titulo={t('dashboard.casino_v.combate.activo')} desc={t('dashboard.casino_v.combate.activoHint')}>
            <Toggle checked={combate.activo !== false} onChange={setCombate('activo')} />
          </FilaInterruptor>
          <FilaInterruptor titulo={t('dashboard.casino_v.combate.jefe')} desc={t('dashboard.casino_v.combate.jefeHint')}>
            <Toggle checked={combate.jefe !== false} onChange={setCombate('jefe')} />
          </FilaInterruptor>
          <FilaInterruptor titulo={t('dashboard.casino_v.combate.apuestas')} desc={t('dashboard.casino_v.combate.apuestasHint')}>
            <Toggle checked={combate.apuestas !== false} onChange={setCombate('apuestas')} />
          </FilaInterruptor>
          <Campo etiqueta={t('dashboard.casino_v.combate.apuestaMax')}><Numero value={combate.apuestaMax ?? 5000} onChange={setCombate('apuestaMax')} min={0} max={10000000} /></Campo>
          <Campo etiqueta={t('dashboard.casino_v.combate.canal')} ayuda={t('dashboard.casino_v.combate.canalHint')}>
            <SelectCanal canales={canales} value={combate.canalId} onChange={setCombate('canalId')} vacio={t('dashboard.casino_v.combate.mismoCanal')} />
          </Campo>
        </div>
        <ul className="mt-4 grid gap-1.5 text-xs text-muted sm:grid-cols-2">
          {['c1', 'c2', 'c3', 'c4'].map((k) => <li key={k}>⚔️ {t(`dashboard.casino_v.combate.${k}`)}</li>)}
        </ul>
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
      </div>

      <Plegable id="casino-stats" emoji="📊" titulo={t('dashboard.plegable.casinoStats')} sub={t('dashboard.plegable.casinoStatsSub')}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div data-help="casino-top" className={tarjeta}>
          <CabeceraTarjeta icono={Trophy} titulo={t('dashboard.casino_v.top')} />
          {datos.top.length === 0 ? <Vacio icono={Trophy} titulo={t('dashboard.casino_v.noTop')} /> : (
            <ul className="mt-4 space-y-2">
              {datos.top.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="w-6 text-center">{['🥇', '🥈', '🥉'][i] || <span className="text-xs font-bold text-muted">{i + 1}</span>}</span>
                  <Avatar src={p.avatar} name={p.nombre} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{p.nombre}</span>
                  <span className={`text-sm font-bold ${p.neto >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{p.neto >= 0 ? '+' : '−'}🪙 {n(Math.abs(p.neto))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div data-help="casino-grandes" className={tarjeta}>
          <CabeceraTarjeta icono={TrendingUp} titulo={t('dashboard.casino_v.big')} />
          {datos.grandes.length === 0 ? <Vacio icono={Sparkles} titulo={t('dashboard.casino_v.noBig')} /> : (
            <ul className="mt-4 space-y-2">
              {datos.grandes.map((g, i) => (
                <li key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2">
                  <span className="text-xl" aria-hidden>{EMOJI_JUEGO[g.juego]}</span>
                  <Avatar src={g.avatar} name={g.nombre} size={26} />
                  <span className="min-w-0 flex-1 truncate text-sm text-fg"><b>{g.nombre}</b> <span className="text-muted">· 🪙 {n(g.apuesta)} → </span><b className="text-emerald-400">🪙 {n(g.premio)}</b></span>
                  <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-black text-amber-300">×{g.mult}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      </Plegable>

      {/* Cofres de mascotas */}
      <Plegable id="casino-cofres" emoji="🎁" titulo={t('dashboard.casino_v.chestsTitle')} sub={t('dashboard.plegable.cofresSub')}>
      <div data-help="casino-cofres" className={`${tarjeta} relative overflow-hidden`}>
        <CabeceraTarjeta icono={Gift} titulo={t('dashboard.casino_v.chestsTitle')} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.casino_v.chestsIntro', { n: PIEDAD })}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(COFRES).map(([id, c]) => (
            <button key={id} type="button" onClick={() => setCofre(id)} className={`rounded-2xl border px-4 py-2 text-sm font-bold ${cofre === id ? 'border-brand bg-brand/10 text-fg' : 'border-line text-muted hover:text-fg'}`}>
              {c.emoji} {t(`dashboard.casino_v.cofre.${id}`)} · 🪙 {n(c.precio)}
            </button>
          ))}
        </div>
        {/* Barra de probabilidades */}
        <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-elevated">
          {ORDEN_R.map((r) => {
            const p = COFRES[cofre].prob[r];
            if (!p) return null;
            return <div key={r} className={r === 'divina' ? 'sk-divina' : ''} style={{ width: `${Math.max(p, 0.6)}%`, background: r === 'divina' ? undefined : RAREZAS[r].color }} title={`${t(`dashboard.casino_v.rareza.${r}`)} ${p} %`} />;
          })}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ORDEN_R.map((r) => {
            const lista = Object.entries(COMPANEROS).filter(([, c]) => c.rareza === r);
            const R = RAREZAS[r];
            const divina = r === 'divina';
            return (
              <div key={r} className={`rounded-2xl border p-3 ${divina ? 'border-transparent bg-gradient-to-br from-fuchsia-500/20 via-amber-400/20 to-sky-500/20' : 'border-line bg-bg'}`} style={divina ? undefined : { borderColor: `${R.color}55` }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black" style={{ color: divina ? undefined : R.color }}>
                    {divina ? <><span aria-hidden>🌈</span> <span className="sk-divina-texto">{t('dashboard.casino_v.rareza.divina')}</span></> : t(`dashboard.casino_v.rareza.${r}`)}
                  </p>
                  <span className="text-xs font-bold text-muted">{COFRES[cofre].prob[r]} %</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lista.map(([id]) => (
                    <span key={id} className={`grid h-11 w-11 place-items-center rounded-xl ${divina ? 'bg-black/30 ring-2 ring-amber-300' : 'bg-elevated'}`} title={t(`dashboard.casino_v.comp.${id}`)}>
                      <img src={spriteCompanero(id)} alt="" className="h-10 w-10" />
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">{[R.xp && `✨ +${pct(R.xp)} XP`, R.diario && `🪙 +${pct(R.diario)} ${t('dashboard.casino_v.inDaily')}`, R.vuelta && `🎰 ${pct(R.vuelta)} ${t('dashboard.casino_v.cashback')}`].filter(Boolean).join(' · ')}</p>
                {divina && <p className="mt-1 text-[11px] font-semibold text-amber-300">{t('dashboard.casino_v.divineNote', { count: cof.divinasMundo, n: n(cof.divinasMundo) })}</p>}
              </div>
            );
          })}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.casino_v.lastPulls')}</p>
            {cof.ultimas.length === 0 ? <p className="mt-2 text-sm italic text-muted">{t('dashboard.casino_v.noPulls')}</p> : (
              <ul className="mt-2 space-y-1.5">
                {cof.ultimas.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Avatar src={a.avatar} name={a.nombre} size={22} />
                    <span className="min-w-0 flex-1 truncate text-fg"><b>{a.nombre}</b> <span className="text-muted">→</span> {a.custom ? a.custom.nombre : t(`dashboard.casino_v.comp.${a.companero}`)}</span>
                    <img src={a.custom ? (/^https?:/.test(a.custom.imagen || '') ? a.custom.imagen : `${API_URL}${a.custom.imagen}`) : (COMPANEROS[a.companero] ? spriteCompanero(a.companero) : svgMascota('2b50'))} alt="" className={`h-6 w-6 ${a.custom ? 'rounded-full object-cover object-top' : ''}`} />
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${RAREZAS[a.rareza].color}22`, color: RAREZAS[a.rareza].color }}>{t(`dashboard.casino_v.rareza.${a.rareza}`)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-bg p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.casino_v.pullsHere', { n: n(cof.abiertos) })}</p>
            <ul className="mt-2 space-y-1">
              {ORDEN_R.map((r) => (
                <li key={r} className="flex items-center justify-between text-sm">
                  <span style={{ color: RAREZAS[r].color }}>{t(`dashboard.casino_v.rareza.${r}`)}</span>
                  <span className="font-bold text-fg">{n(cof.porRareza[r])}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      </Plegable>

      <p className="flex items-center gap-2 text-xs text-muted"><Settings2 size={13} /> {t('dashboard.casino_v.commands')}</p>
    </div>
  );
}
