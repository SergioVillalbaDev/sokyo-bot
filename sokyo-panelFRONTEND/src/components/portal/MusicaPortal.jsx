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
  if (cargandoEstado) return <p className="mt-4 text-sm text-muted">{t('portal.music.loading')}</p>;

  if (estado?.desactivado) {
    return <Caja icon={Ban} titulo={t('portal.music.disabledTitle')} texto={t('portal.music.disabledDesc')} />;
  }
  if (estado?.sinVoz) {
    return (
      <Caja icon={Headphones} titulo={t('portal.music.joinTitle')} texto={t('portal.music.joinDesc')}>
        <button onClick={cargarEstado} className="mt-3 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand transition-transform hover:scale-[1.03]">
          {t('portal.music.imInNow')}
        </button>
      </Caja>
    );
  }

  const actual = estado?.actual;
  const total = actual?.duration || 0;
  const pct = total > 0 ? Math.min(100, (posLocal / total) * 100) : 0;

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Contexto: dónde está sonando */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Volume2 size={15} /> {t('portal.music.connectedIn')} <strong className="text-fg">{estado?.canalVoz?.nombre}</strong>
        {estado?.guild?.nombre && <span>· {estado.guild.nombre}</span>}
      </div>

      {(aviso || errorMsg) && (
        <div className={`rounded-xl border px-3.5 py-2.5 text-sm font-semibold ${
          errorMsg ? 'border-danger/40 bg-danger/10 text-danger' : 'border-ok/40 bg-ok/10 text-ok'
        }`}>
          {errorMsg || aviso}
        </div>
      )}

      {!puede && (
        <div className="flex items-center gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-sm text-warn">
          <Sliders size={15} /> {t('portal.music.djOnly')}
        </div>
      )}

      {/* SONANDO AHORA */}
      {actual ? (
        <div className="flex flex-wrap gap-4 rounded-2xl border border-line bg-gradient-to-br from-card to-bg p-4">
          <Caratula src={actual.artwork} size={112} />
          <div className="flex min-w-[220px] flex-1 flex-col justify-center gap-1.5">
            <span className="text-xs font-bold tracking-wide text-brand">{t('portal.music.nowPlaying')}</span>
            <a href={actual.uri || '#'} target="_blank" rel="noreferrer" className="text-lg font-bold text-fg hover:underline">{actual.title}</a>
            <p className="text-muted">{actual.author}</p>
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                <div className="h-full rounded-full bg-gradient-brand transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{actual.isStream ? t('portal.music.live') : fmt(posLocal)}</span>
                <span className="flex items-center gap-1">{actual.isStream ? <Radio size={11} className="text-danger" /> : fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Caja icon={Music} titulo={t('portal.music.nothingPlayingTitle')} texto={t('portal.music.nothingPlayingDesc')} />
      )}

      {/* CONTROLES */}
      {actual && (
        <div className="flex flex-wrap items-center gap-2.5">
          <BotonIcono onClick={() => control(estado.pausado ? 'resume' : 'pause')} disabled={!puede} icon={estado.pausado ? Play : Pause} />
          <BotonIcono onClick={() => control('skip')} disabled={!puede} icon={SkipForward} />
          <BotonIcono onClick={() => control('stop')} disabled={!puede} icon={Square} />
          <BotonIcono onClick={() => control('shuffle')} disabled={!puede || !estado.cola?.length} icon={Shuffle} />
          <div className="ml-auto flex items-center gap-2">
            <Volume2 size={17} className="text-muted" />
            <input
              type="range" min="0" max={estado.config?.volumenMax ?? 150} value={estado.volumen ?? 60}
              disabled={!puede}
              onChange={(e) => setEstado((s) => ({ ...s, volumen: Number(e.target.value) }))}
              onMouseUp={(e) => control('volume', Number(e.target.value))}
              onTouchEnd={(e) => control('volume', Number(e.target.value))}
              className="w-28 accent-brand"
            />
            <span className="w-9 text-right text-sm text-muted">{estado.volumen ?? 60}%</span>
          </div>
        </div>
      )}

      {/* BUSCADOR */}
      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} disabled={!puede}
            placeholder={t('portal.music.searchPlaceholder')}
            className="w-full rounded-xl border border-line bg-bg py-3 pl-10 pr-4 text-sm text-fg outline-none transition-shadow focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <button type="submit" disabled={!puede || !q.trim()} className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-5 text-sm font-bold text-on-brand transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50">
          <Play size={15} /> {t('portal.music.play')}
        </button>
      </form>

      {/* RESULTADOS DE BÚSQUEDA */}
      {(buscando || resultados.length > 0) && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-muted">{buscando ? t('portal.music.searching') : t('portal.music.resultsTitle')}</span>
          {resultados.map((r, i) => (
            <Fila key={i} track={r} disabled={!puede} accion={() => reproducir(r.uri || r.title)} icon={Plus} label={t('portal.music.add')} />
          ))}
        </div>
      )}

      {/* COLA */}
      {estado?.cola?.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-muted">{t('portal.music.queueTitle')} ({estado.cola.length})</span>
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
  if (src) return <img src={src} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-xl object-cover" />;
  return (
    <div style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-on-brand">
      <Music size={size * 0.4} />
    </div>
  );
}

function BotonIcono({ onClick, disabled, icon: Icon }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-fg transition-colors enabled:hover:border-brand/50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon size={18} />
    </button>
  );
}

function Fila({ track, pos, accion, icon: Icon, label, disabled, danger }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-card p-2.5">
      {pos && <span className="w-5 text-center text-xs font-bold text-muted">{pos}</span>}
      <Caratula src={track.artwork} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-fg">{track.title}</div>
        <div className="truncate text-xs text-muted">{track.author}{track.duration ? ` · ${fmt(track.duration)}` : ''}</div>
      </div>
      <button
        onClick={accion} disabled={disabled} title={label} aria-label={label}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'bg-danger' : 'bg-gradient-brand'}`}
      >
        <Icon size={16} />
      </button>
    </div>
  );
}

function Caja({ icon: Icon, titulo, texto, children }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-line py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-muted"><Icon size={22} /></span>
      <h3 className="font-bold text-fg">{titulo}</h3>
      <p className="max-w-xs text-sm text-muted">{texto}</p>
      {children}
    </div>
  );
}
