// Reproductor de música del PORTAL (lado usuario).
// El usuario, ya conectado a un canal de voz en Discord, busca y pone canciones
// desde la web: "sonando ahora" con carátula y progreso, cola y controles.
// Recibe portalFetch (con el token) desde Portal.jsx.
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Play, Pause, SkipForward, Square, Shuffle, Volume2, Search, Plus, X,
  Music, Headphones, Ban, Radio, Sliders,
} from 'lucide-react';
import { Tarjeta, Vacio } from './glass';

// Formatea milisegundos a "3:45".
const fmt = (ms) => {
  if (!ms || ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

export default function MusicaPortal({ portalFetch }) {
  const { t } = useTranslation();
  const [estado, setEstado] = useState(null);
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [posLocal, setPosLocal] = useState(0); // progreso suave entre sondeos
  const debounceRef = useRef(null);

  const puede = estado?.puedeControlar !== false;

  // --- Cargar estado (sondeo cada 3s) ---
  const cargarEstado = useCallback(() => {
    portalFetch('/api/portal/musica/estado')
      .then((r) => r.json())
      .then((d) => { setEstado(d); if (d?.posicion != null) setPosLocal(d.posicion); })
      .catch(() => {})
      .finally(() => setCargandoEstado(false));
  }, [portalFetch]);

  useEffect(() => {
    cargarEstado();
    const id = setInterval(cargarEstado, 3000);
    return () => clearInterval(id);
  }, [cargarEstado]);

  // Progreso suave: avanza el reloj localmente entre sondeos si está sonando.
  useEffect(() => {
    if (!estado?.reproduciendo || estado?.pausado || estado?.actual?.isStream) return;
    const id = setInterval(() => setPosLocal((p) => p + 1000), 1000);
    return () => clearInterval(id);
  }, [estado?.reproduciendo, estado?.pausado, estado?.actual?.isStream]);

  // --- Buscar (con debounce) ---
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!q.trim()) { setResultados([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBuscando(true);
      portalFetch(`/api/portal/musica/buscar?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((d) => setResultados(Array.isArray(d.resultados) ? d.resultados : []))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 450);
    return () => clearTimeout(debounceRef.current);
  }, [q, portalFetch]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const flash = (msg, esError = false) => {
    if (esError) { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 4000); }
    else { setAviso(msg); setTimeout(() => setAviso(''), 3000); }
  };

  // --- Acciones ---
  const reproducir = async (query) => {
    setErrorMsg('');
    const res = await portalFetch('/api/portal/musica/play', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return flash(d.error || t('portal.music.errAdd'), true);
    if (d.estado) setEstado((e) => ({ ...e, ...d.estado }));
    flash(d.playlist ? t('portal.music.addedSongs', { n: d.anadidas, playlist: d.playlist }) : t('portal.music.addedOne', { title: d.track?.title || query }));
    cargarEstado();
  };

  const control = async (accion, valor) => {
    const res = await portalFetch('/api/portal/musica/control', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, valor }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return flash(d.error || t('portal.music.errAction'), true);
    if (d.estado) { setEstado((e) => ({ ...e, ...d.estado })); if (d.estado.posicion != null) setPosLocal(d.estado.posicion); }
    cargarEstado();
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (q.trim()) { reproducir(q.trim()); setQ(''); setResultados([]); }
  };

  // --- Estados especiales ---
  if (cargandoEstado) {
    return <div className="flex flex-col gap-4" aria-busy="true"><div className="gx-card h-44 animate-pulse" /><div className="gx-card h-14 animate-pulse" /></div>;
  }

  if (estado?.desactivado) {
    return <Vacio icono={Ban} titulo={t('portal.music.disabledTitle')} texto={t('portal.music.disabledDesc')} />;
  }
  if (estado?.sinVoz) {
    return (
      <Vacio icono={Headphones} titulo={t('portal.music.joinTitle')} texto={t('portal.music.joinDesc')}>
        <button onClick={cargarEstado} className="gx-btn gx-btn-primario mt-3">{t('portal.music.imInNow')}</button>
      </Vacio>
    );
  }

  const actual = estado?.actual;
  const total = actual?.duration || 0;
  const pct = total > 0 ? Math.min(100, (posLocal / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Contexto: dónde está sonando */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="gx-chip"><Volume2 size={13} className="text-pink-300" /> {t('portal.music.connectedIn')} <strong className="text-fg">{estado?.canalVoz?.nombre}</strong></span>
        {estado?.guild?.nombre && <span className="gx-chip">{estado.guild.nombre}</span>}
      </div>

      {(aviso || errorMsg) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
          errorMsg ? 'border-danger/40 bg-danger/10 text-danger' : 'border-ok/40 bg-ok/10 text-ok'
        }`}>
          {errorMsg || aviso}
        </div>
      )}

      {!puede && (
        <div className="flex items-center gap-2 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          <Sliders size={15} /> {t('portal.music.djOnly')}
        </div>
      )}

      {/* SONANDO AHORA */}
      {actual ? (
        <Tarjeta brillo halo className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="relative mx-auto shrink-0 sm:mx-0">
            <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-violet-500/40 to-pink-500/40 blur-2xl" aria-hidden="true" />
            <Caratula src={actual.artwork} size={136} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="gx-texto-neon text-xs font-extrabold tracking-[.2em]">{t('portal.music.nowPlaying')}</span>
            <a href={actual.uri || '#'} target="_blank" rel="noreferrer" className="truncate text-xl font-extrabold text-fg hover:underline">{actual.title}</a>
            <p className="truncate text-muted">{actual.author}</p>
            <div className="mt-2">
              <div className="gx-barra"><span className="transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} /></div>
              <div className="mt-1.5 flex justify-between text-xs text-muted">
                <span>{actual.isStream ? t('portal.music.live') : fmt(posLocal)}</span>
                <span className="flex items-center gap-1">{actual.isStream ? <Radio size={11} className="text-danger" /> : fmt(total)}</span>
              </div>
            </div>
            {/* CONTROLES */}
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <BotonIcono onClick={() => control(estado.pausado ? 'resume' : 'pause')} disabled={!puede} icon={estado.pausado ? Play : Pause} label={estado.pausado ? t('portal.music.resume') : t('portal.music.pause')} grande />
              <BotonIcono onClick={() => control('skip')} disabled={!puede} icon={SkipForward} label={t('portal.music.skip')} />
              <BotonIcono onClick={() => control('stop')} disabled={!puede} icon={Square} label={t('portal.music.stop')} />
              <BotonIcono onClick={() => control('shuffle')} disabled={!puede || !estado.cola?.length} icon={Shuffle} label={t('portal.music.shuffle')} />
              <div className="ml-auto flex items-center gap-2">
                <Volume2 size={17} className="text-muted" />
                <input
                  type="range" min="0" max={estado.config?.volumenMax ?? 150} value={estado.volumen ?? 60}
                  disabled={!puede} aria-label={t('portal.music.volume')}
                  onChange={(e) => setEstado((s) => ({ ...s, volumen: Number(e.target.value) }))}
                  onMouseUp={(e) => control('volume', Number(e.target.value))}
                  onTouchEnd={(e) => control('volume', Number(e.target.value))}
                  onKeyUp={(e) => control('volume', Number(e.target.value))}
                  className="w-28 accent-fuchsia-400"
                />
                <span className="w-10 text-right text-sm text-muted">{estado.volumen ?? 60}%</span>
              </div>
            </div>
          </div>
        </Tarjeta>
      ) : (
        <Vacio icono={Music} titulo={t('portal.music.nothingPlayingTitle')} texto={t('portal.music.nothingPlayingDesc')} />
      )}

      {/* BUSCADOR */}
      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} disabled={!puede}
            placeholder={t('portal.music.searchPlaceholder')} aria-label={t('portal.music.searchPlaceholder')}
            className="gx-input py-3.5 pl-10"
          />
        </div>
        <button type="submit" disabled={!puede || !q.trim()} className="gx-btn gx-btn-primario shrink-0 px-5">
          <Play size={15} /> <span className="hidden sm:inline">{t('portal.music.play')}</span>
        </button>
      </form>

      {/* RESULTADOS DE BÚSQUEDA */}
      {(buscando || resultados.length > 0) && (
        <div className="flex flex-col gap-2">
          <span className="px-1 text-xs font-bold uppercase tracking-wider text-muted">{buscando ? t('portal.music.searching') : t('portal.music.resultsTitle')}</span>
          {resultados.map((r, i) => (
            <Fila key={i} track={r} disabled={!puede} accion={() => reproducir(r.uri || r.title)} icon={Plus} label={t('portal.music.add')} />
          ))}
        </div>
      )}

      {/* COLA */}
      {estado?.cola?.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="px-1 text-xs font-bold uppercase tracking-wider text-muted">{t('portal.music.queueTitle')} ({estado.cola.length})</span>
          {estado.cola.slice(0, 20).map((r, i) => (
            <Fila key={i} track={r} pos={i + 1} disabled={!puede} accion={() => control('remove', i)} icon={X} label={t('portal.music.remove')} danger />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Subcomponentes ---
function Caratula({ src, size = 56 }) {
  if (src) return <img src={src} alt="" style={{ width: size, height: size }} className="relative shrink-0 rounded-2xl object-cover shadow-[0_10px_30px_-10px_rgba(0,0,0,.8)]" />;
  return (
    <div style={{ width: size, height: size }} className="relative flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 text-white">
      <Music size={size * 0.4} />
    </div>
  );
}

function BotonIcono({ onClick, disabled, icon: Icon, label, grande = false }) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={`${grande ? 'gx-btn-primario h-12 w-12' : 'h-11 w-11'} gx-btn rounded-full p-0`}
    >
      <Icon size={grande ? 20 : 18} />
    </button>
  );
}

function Fila({ track, pos, accion, icon: Icon, label, disabled, danger }) {
  return (
    <div className="gx-card flex items-center gap-3 p-2.5" style={{ borderRadius: 16 }}>
      {pos && <span className="w-5 text-center text-xs font-bold text-muted">{pos}</span>}
      <Caratula src={track.artwork} size={42} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-fg">{track.title}</div>
        <div className="truncate text-xs text-muted">{track.author}{track.duration ? ` · ${fmt(track.duration)}` : ''}</div>
      </div>
      <button
        onClick={accion} disabled={disabled} title={label} aria-label={label}
        className={`gx-btn h-9 w-9 shrink-0 rounded-xl p-0 ${danger ? 'hover:!border-rose-400/60 hover:!text-rose-300' : 'gx-btn-primario'}`}
      >
        <Icon size={16} />
      </button>
    </div>
  );
}
