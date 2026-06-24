// Vista de Música (panel admin): reproductor en vivo · config · playlists propias · Spotify OAuth.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Music, Save, Check, Play, Pause, SkipForward, Square, Volume2, Shuffle,
  Plus, Trash2, Search, X, ChevronRight, ChevronDown,
} from 'lucide-react';
import { Card, Toggle } from '../../ui/primitives';
import { apiFetch } from '../../../lib/api';

const VERDE = '#1db954';
const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';

const fmt = (ms) => {
  if (!ms || ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

function Ajuste({ titulo, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-line/60 last:border-0">
      <div className="min-w-0">
        <div className="font-semibold text-fg">{titulo}</div>
        {desc && <div className="text-sm text-muted">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function BotonCtrl({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-bg text-fg transition-colors hover:bg-elevated disabled:opacity-40">
      {children}
    </button>
  );
}

function MsgBanner({ msg }) {
  if (!msg) return null;
  const ok = msg.tipo === 'ok';
  return (
    <div className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
      {msg.texto}
    </div>
  );
}

export default function MusicaView({ dash }) {
  const { configServidor, roles, canales, guildId, guardarMusica } = dash;

  // ── Config form ──
  const [f, setF] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // ── Reproductor en vivo ──
  const [estado, setEstado] = useState(null);
  const gid = guildId || configServidor?.guildId;

  // ── Tab activa ──
  const [tab, setTab] = useState('config');

  // ── Playlists propias ──
  const [playlists, setPlaylists] = useState(null);       // null = sin cargar todavía
  const [playlistActiva, setPlaylistActiva] = useState(null); // { _id, nombre, canciones }
  const [nuevaNombre, setNuevaNombre] = useState('');
  const [busquedaCancion, setBusquedaCancion] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [buscandoCancion, setBuscandoCancion] = useState(false);
  const [plMsg, setPlMsg] = useState(null);
  const debounceRef = useRef(null);

  // ── Spotify ──
  const [spotifyStatus, setSpotifyStatus] = useState(null); // null = sin comprobar
  const [spotifyPlaylists, setSpotifyPlaylists] = useState(null);
  const [cargandoSpotify, setCargandoSpotify] = useState(false);
  const [importando, setImportando] = useState(new Set());
  const [spMsg, setSpMsg] = useState(null);

  // Auto-clear de mensajes
  useEffect(() => {
    if (!plMsg) return;
    const id = setTimeout(() => setPlMsg(null), 3500);
    return () => clearTimeout(id);
  }, [plMsg]);

  useEffect(() => {
    if (!spMsg) return;
    const id = setTimeout(() => setSpMsg(null), 3500);
    return () => clearTimeout(id);
  }, [spMsg]);

  // Limpiar debounce al desmontar
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // Inicializar formulario de configuración
  useEffect(() => {
    const m = configServidor?.musica || {};
    setF({
      activo: m.activo ?? true,
      canalMusicaId: m.canalMusicaId || '',
      djRolId: m.djRolId || '',
      soloMismoCanal: m.soloMismoCanal ?? true,
      volumenDefecto: m.volumenDefecto ?? 60,
      volumenMax: m.volumenMax ?? 150,
      maxCola: m.maxCola ?? 100,
      permitirPlaylists: m.permitirPlaylists ?? true,
      anunciarAhora: m.anunciarAhora ?? true,
      autoSalir: m.autoSalir ?? true,
      fuentes: {
        youtube: m.fuentes?.youtube ?? true,
        spotify: m.fuentes?.spotify ?? true,
        soundcloud: m.fuentes?.soundcloud ?? true,
      },
    });
  }, [configServidor]);

  // Sondeo del reproductor en vivo (cada 3 s)
  const cargarEstado = useCallback(() => {
    if (!gid) return;
    apiFetch(`/api/config/${gid}/musica/estado`)
      .then((r) => r.json())
      .then(setEstado)
      .catch(() => {});
  }, [gid]);

  useEffect(() => {
    cargarEstado();
    const id = setInterval(cargarEstado, 3000);
    return () => clearInterval(id);
  }, [cargarEstado]);

  const set = (campo, valor) => { setGuardado(false); setF((s) => ({ ...s, [campo]: valor })); };
  const setFuente = (k, v) => { setGuardado(false); setF((s) => ({ ...s, fuentes: { ...s.fuentes, [k]: v } })); };

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarMusica(f);
    setGuardando(false);
    setGuardado(ok);
  };

  const control = async (accion, valor) => {
    if (!gid) return;
    await apiFetch(`/api/config/${gid}/musica/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, valor }),
    }).catch(() => {});
    cargarEstado();
  };

  // ══════════════════════════════════════════════
  // PLAYLISTS PROPIAS
  // ══════════════════════════════════════════════

  const cargarPlaylists = useCallback(async () => {
    try {
      const r = await apiFetch('/api/portal/playlists');
      const data = await r.json();
      setPlaylists(Array.isArray(data) ? data : []);
    } catch { setPlaylists([]); }
  }, []);

  useEffect(() => {
    if (tab === 'playlists' && playlists === null) cargarPlaylists();
  }, [tab, playlists, cargarPlaylists]);

  const crearPlaylist = async (e) => {
    e.preventDefault();
    const nombre = nuevaNombre.trim();
    if (!nombre) return;
    try {
      const r = await apiFetch('/api/portal/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      const data = await r.json();
      if (data.error) { setPlMsg({ tipo: 'err', texto: data.error }); return; }
      setNuevaNombre('');
      setPlaylists((prev) => [data, ...(prev || [])]);
    } catch { setPlMsg({ tipo: 'err', texto: 'No se pudo crear la playlist.' }); }
  };

  const borrarPlaylist = async (id) => {
    if (!confirm('¿Borrar esta playlist?')) return;
    try {
      await apiFetch(`/api/portal/playlists/${id}`, { method: 'DELETE' });
      setPlaylists((prev) => prev?.filter((p) => p._id !== id) ?? []);
      if (playlistActiva?._id === id) setPlaylistActiva(null);
    } catch { setPlMsg({ tipo: 'err', texto: 'No se pudo borrar.' }); }
  };

  const togglePlaylist = async (id) => {
    if (playlistActiva?._id === id) {
      setPlaylistActiva(null);
      setBusquedaCancion('');
      setResultadosBusqueda([]);
      return;
    }
    try {
      const r = await apiFetch(`/api/portal/playlists/${id}`);
      const data = await r.json();
      if (data.error) { setPlMsg({ tipo: 'err', texto: data.error }); return; }
      setPlaylistActiva(data);
      setBusquedaCancion('');
      setResultadosBusqueda([]);
    } catch { setPlMsg({ tipo: 'err', texto: 'No se pudo cargar la playlist.' }); }
  };

  const reproducirPlaylist = async (id) => {
    try {
      const r = await apiFetch(`/api/portal/playlists/${id}/reproducir`, { method: 'POST' });
      const data = await r.json();
      setPlMsg(data.error
        ? { tipo: 'err', texto: data.error }
        : { tipo: 'ok', texto: `▶ "${data.nombre}" — ${data.anadidas} canciones añadidas` });
    } catch { setPlMsg({ tipo: 'err', texto: 'No se pudo reproducir.' }); }
  };

  const quitarCancion = async (idx) => {
    if (!playlistActiva) return;
    try {
      const r = await apiFetch(`/api/portal/playlists/${playlistActiva._id}/canciones/${idx}`, { method: 'DELETE' });
      const data = await r.json();
      if (data.error) { setPlMsg({ tipo: 'err', texto: data.error }); return; }
      const nuevas = playlistActiva.canciones.filter((_, i) => i !== idx);
      setPlaylistActiva((prev) => ({ ...prev, canciones: nuevas }));
      setPlaylists((prev) => prev?.map((p) => p._id === playlistActiva._id ? { ...p, total: nuevas.length } : p) ?? prev);
    } catch { setPlMsg({ tipo: 'err', texto: 'No se pudo quitar la canción.' }); }
  };

  const buscarCancion = useCallback((q) => {
    setBusquedaCancion(q);
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResultadosBusqueda([]); return; }
    debounceRef.current = setTimeout(async () => {
      setBuscandoCancion(true);
      try {
        const r = await apiFetch(`/api/portal/musica/buscar?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        setResultadosBusqueda(data.resultados || []);
      } catch { setResultadosBusqueda([]); }
      setBuscandoCancion(false);
    }, 500);
  }, []);

  const añadirCancion = async (track) => {
    if (!playlistActiva) return;
    try {
      const r = await apiFetch(`/api/portal/playlists/${playlistActiva._id}/canciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: track.title,
          author: track.author,
          uri: track.uri,
          artwork: track.artwork,
          duration: track.duration,
        }),
      });
      const data = await r.json();
      if (data.error) { setPlMsg({ tipo: 'err', texto: data.error }); return; }
      setPlaylistActiva((prev) => ({ ...prev, canciones: [...prev.canciones, track] }));
      setPlaylists((prev) => prev?.map((p) => p._id === playlistActiva._id ? { ...p, total: p.total + 1 } : p) ?? prev);
      setBusquedaCancion('');
      setResultadosBusqueda([]);
      setPlMsg({ tipo: 'ok', texto: `"${track.title}" añadida` });
    } catch { setPlMsg({ tipo: 'err', texto: 'No se pudo añadir la canción.' }); }
  };

  // ══════════════════════════════════════════════
  // SPOTIFY
  // ══════════════════════════════════════════════

  const cargarSpotifyStatus = useCallback(async () => {
    try {
      const r = await apiFetch('/api/portal/spotify/status');
      const data = await r.json();
      setSpotifyStatus(data);
    } catch { setSpotifyStatus({ disponible: false }); }
  }, []);

  useEffect(() => {
    if (tab === 'spotify' && spotifyStatus === null) cargarSpotifyStatus();
  }, [tab, spotifyStatus, cargarSpotifyStatus]);

  const conectarSpotify = async () => {
    try {
      const r = await apiFetch('/api/portal/spotify/auth-url');
      const data = await r.json();
      if (data.error) { setSpMsg({ tipo: 'err', texto: data.error }); return; }
      const popup = window.open(data.url, 'spotify-auth', 'width=500,height=700,popup=yes');
      // Detectar cierre del popup y actualizar estado
      const timer = setInterval(() => {
        if (!popup || popup.closed) { clearInterval(timer); cargarSpotifyStatus(); }
      }, 1000);
    } catch { setSpMsg({ tipo: 'err', texto: 'No se pudo obtener la URL de Spotify.' }); }
  };

  const desconectarSpotify = async () => {
    if (!confirm('¿Desconectar tu cuenta de Spotify?')) return;
    try {
      await apiFetch('/api/portal/spotify/disconnect', { method: 'DELETE' });
      setSpotifyStatus((s) => ({ ...s, conectado: false, spotifyUsername: null }));
      setSpotifyPlaylists(null);
      setSpMsg({ tipo: 'ok', texto: 'Spotify desconectado.' });
    } catch { setSpMsg({ tipo: 'err', texto: 'No se pudo desconectar.' }); }
  };

  const cargarSpotifyPlaylists = async () => {
    setCargandoSpotify(true);
    try {
      const r = await apiFetch('/api/portal/spotify/playlists');
      const data = await r.json();
      if (data.error) { setSpMsg({ tipo: 'err', texto: data.error }); }
      else setSpotifyPlaylists(Array.isArray(data) ? data : []);
    } catch { setSpMsg({ tipo: 'err', texto: 'No se pudieron cargar las playlists.' }); }
    setCargandoSpotify(false);
  };

  const importarSpotify = async (pl) => {
    if (importando.has(pl.id)) return;
    setImportando((s) => new Set([...s, pl.id]));
    try {
      const r = await apiFetch(`/api/portal/spotify/playlists/${pl.id}/importar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: pl.nombre }),
      });
      const data = await r.json();
      if (data.error) { setSpMsg({ tipo: 'err', texto: data.error }); }
      else {
        setSpMsg({ tipo: 'ok', texto: `"${data.nombre}" importada con ${data.total} canciones` });
        setPlaylists(null); // forzar recarga de playlists propias al cambiar de tab
      }
    } catch { setSpMsg({ tipo: 'err', texto: 'No se pudo importar la playlist.' }); }
    setImportando((s) => { const n = new Set(s); n.delete(pl.id); return n; });
  };

  const reproducirSpotify = async (uri) => {
    try {
      const r = await apiFetch('/api/portal/musica/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: uri }),
      });
      const data = await r.json();
      setSpMsg(data.error
        ? { tipo: 'err', texto: data.error }
        : { tipo: 'ok', texto: '▶ Playlist añadida a la cola del bot' });
    } catch { setSpMsg({ tipo: 'err', texto: 'No se pudo reproducir.' }); }
  };

  // ══════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════

  if (!f) return <p className="text-muted">Cargando…</p>;

  const actual = estado?.actual;

  return (
    <div className="space-y-6">

      {/* ── PANEL EN VIVO ── */}
      <Card className={card}>
        <div className="mb-4 flex items-center gap-2">
          <Music size={18} style={{ color: VERDE }} />
          <h3 className="text-lg font-bold text-fg">Sonando ahora</h3>
          {estado?.canalVoz && <span className="text-sm text-muted">· 🔊 {estado.canalVoz.nombre}</span>}
        </div>

        {actual ? (
          <>
            <div className="flex items-center gap-4">
              {actual.artwork
                ? <img src={actual.artwork} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                : <div className="flex h-20 w-20 items-center justify-center rounded-2xl text-3xl"
                    style={{ background: `linear-gradient(135deg, ${VERDE}, #128a3e)` }}>🎵</div>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-bold text-fg">{actual.title}</div>
                <div className="truncate text-muted">{actual.author}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full" style={{
                    width: `${actual.duration ? Math.min(100, (estado.posicion / actual.duration) * 100) : 0}%`,
                    background: VERDE,
                  }} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted">
                  <span>{actual.isStream ? 'EN DIRECTO' : fmt(estado.posicion)}</span>
                  <span>{actual.isStream ? '🔴' : fmt(actual.duration)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <BotonCtrl onClick={() => control(estado.pausado ? 'resume' : 'pause')}>
                {estado.pausado ? <Play size={18} /> : <Pause size={18} />}
              </BotonCtrl>
              <BotonCtrl onClick={() => control('skip')}><SkipForward size={18} /></BotonCtrl>
              <BotonCtrl onClick={() => control('stop')}><Square size={18} /></BotonCtrl>
              <BotonCtrl onClick={() => control('shuffle')} disabled={!estado.cola?.length}>
                <Shuffle size={18} />
              </BotonCtrl>
              <div className="ml-auto flex items-center gap-2">
                <Volume2 size={18} className="text-muted" />
                <input type="range" min="0" max={f.volumenMax} defaultValue={estado.volumen ?? 60}
                  onMouseUp={(e) => control('volume', Number(e.target.value))}
                  style={{ accentColor: VERDE }} className="w-32" />
              </div>
            </div>

            {estado.cola?.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="text-sm font-bold text-muted">En cola ({estado.cola.length})</div>
                {estado.cola.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-1.5 text-sm">
                    <span className="w-5 text-center font-bold text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-fg">{c.title}</span>
                    <span className="text-muted">{fmt(c.duration)}</span>
                    <button onClick={() => control('remove', i)} className="text-danger hover:opacity-70">✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="py-6 text-center text-muted">
            No hay nada sonando. Cuando alguien ponga música la verás aquí en directo.
          </p>
        )}
      </Card>

      {/* ── TABS ── */}
      <div className="flex border-b border-line">
        {[['config', 'Configuración'], ['playlists', 'Mis Playlists'], ['spotify', 'Spotify']].map(([tabKey, tabLabel]) => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === tabKey ? 'text-fg' : 'border-transparent text-muted hover:text-fg'}`}
            style={tab === tabKey ? { borderColor: VERDE } : {}}>
            {tabLabel}
          </button>
        ))}
      </div>

      {/* ══ TAB CONFIGURACIÓN ══ */}
      {tab === 'config' && (
        <Card className={card}>
          <h3 className="mb-2 text-lg font-bold text-fg">Configuración del reproductor</h3>

          <Ajuste titulo="Música activada" desc="Interruptor general. Si lo apagas, nadie puede poner música.">
            <Toggle checked={f.activo} onChange={(v) => set('activo', v)} />
          </Ajuste>

          <Ajuste titulo="Canal de música"
            desc="Dónde se publica el panel 'reproduciendo ahora' con sus botones. Vacío = el canal donde se use /play.">
            <select value={f.canalMusicaId} onChange={(e) => set('canalMusicaId', e.target.value)}
              className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg">
              <option value="">Automático</option>
              {(canales || []).map((c) => <option key={c.id} value={c.id}>#{c.nombre}</option>)}
            </select>
          </Ajuste>

          <Ajuste titulo="Rol DJ" desc="Si eliges un rol, solo ese rol (y los admins) controlan la música.">
            <select value={f.djRolId} onChange={(e) => set('djRolId', e.target.value)}
              className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg">
              <option value="">Cualquiera</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </Ajuste>

          <Ajuste titulo="Solo en el mismo canal" desc="Hay que estar en el mismo canal de voz que el bot para controlar.">
            <Toggle checked={f.soloMismoCanal} onChange={(v) => set('soloMismoCanal', v)} />
          </Ajuste>

          <Ajuste titulo="Permitir playlists" desc="Dejar que se encolen playlists enteras de una vez.">
            <Toggle checked={f.permitirPlaylists} onChange={(v) => set('permitirPlaylists', v)} />
          </Ajuste>

          <Ajuste titulo="Anunciar 'reproduciendo ahora'" desc="Mandar un mensaje en Discord cada vez que empieza una canción.">
            <Toggle checked={f.anunciarAhora} onChange={(v) => set('anunciarAhora', v)} />
          </Ajuste>

          <Ajuste titulo="Salir solo del canal" desc="Desconectarse al quedarse sin gente o sin cola.">
            <Toggle checked={f.autoSalir} onChange={(v) => set('autoSalir', v)} />
          </Ajuste>

          <Ajuste titulo="Volumen por defecto" desc={`Volumen al empezar: ${f.volumenDefecto}%`}>
            <input type="range" min="0" max={f.volumenMax} value={f.volumenDefecto}
              onChange={(e) => set('volumenDefecto', Number(e.target.value))}
              style={{ accentColor: VERDE }} className="w-40" />
          </Ajuste>

          <Ajuste titulo="Volumen máximo" desc={`Tope que se puede poner: ${f.volumenMax}%`}>
            <input type="range" min="50" max="300" value={f.volumenMax}
              onChange={(e) => set('volumenMax', Number(e.target.value))}
              style={{ accentColor: VERDE }} className="w-40" />
          </Ajuste>

          <Ajuste titulo="Tamaño máximo de cola" desc="0 = sin límite.">
            <input type="number" min="0" max="1000" value={f.maxCola}
              onChange={(e) => set('maxCola', Number(e.target.value))}
              className="w-24 rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg" />
          </Ajuste>

          <div className="pt-4">
            <div className="mb-2 font-semibold text-fg">Fuentes permitidas</div>
            <div className="flex flex-wrap gap-2">
              {[['youtube', 'YouTube'], ['spotify', 'Spotify'], ['soundcloud', 'SoundCloud']].map(([k, label]) => (
                <button key={k} onClick={() => setFuente(k, !f.fuentes[k])}
                  className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${f.fuentes[k] ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:text-fg'}`}>
                  {f.fuentes[k] && <Check size={14} style={{ color: VERDE }} />} {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button onClick={guardar} disabled={guardando}
              className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50">
              <Save size={16} /> {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {guardado && (
              <span className="flex items-center gap-1 font-semibold" style={{ color: VERDE }}>
                <Check size={16} /> Guardado
              </span>
            )}
          </div>
        </Card>
      )}

      {/* ══ TAB MIS PLAYLISTS ══ */}
      {tab === 'playlists' && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Guarda tus playlists aquí y reprodúcelas en el bot con un clic.
            Para reproducir necesitas estar en un canal de voz de Discord.
          </p>

          <MsgBanner msg={plMsg} />

          {/* Crear nueva playlist */}
          <form onSubmit={crearPlaylist} className="flex gap-2">
            <input value={nuevaNombre} onChange={(e) => setNuevaNombre(e.target.value)}
              placeholder="Nombre de la nueva playlist…"
              className="flex-1 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/50" />
            <button type="submit" disabled={!nuevaNombre.trim()}
              className="flex items-center gap-2 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-elevated disabled:opacity-40">
              <Plus size={16} /> Crear
            </button>
          </form>

          {/* Lista */}
          {playlists === null ? (
            <p className="py-8 text-center text-muted">Cargando playlists…</p>
          ) : playlists.length === 0 ? (
            <p className="py-8 text-center text-muted">Aún no tienes playlists. Crea una arriba.</p>
          ) : (
            <div className="space-y-3">
              {playlists.map((pl) => (
                <div key={pl._id} className={card}>
                  {/* Cabecera */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{ background: '#1db95420' }}>
                      🎵
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-fg">{pl.nombre}</div>
                      <div className="text-xs text-muted">
                        {pl.total} {pl.total === 1 ? 'canción' : 'canciones'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => reproducirPlaylist(pl._id)} title="Reproducir en el bot"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-bg text-fg hover:bg-elevated transition-colors">
                        <Play size={16} style={{ color: VERDE }} />
                      </button>
                      <button onClick={() => togglePlaylist(pl._id)}
                        title={playlistActiva?._id === pl._id ? 'Cerrar' : 'Ver y editar canciones'}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-bg text-fg hover:bg-elevated transition-colors">
                        {playlistActiva?._id === pl._id
                          ? <ChevronDown size={16} />
                          : <ChevronRight size={16} />}
                      </button>
                      <button onClick={() => borrarPlaylist(pl._id)} title="Borrar playlist"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-bg text-danger hover:bg-elevated transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  {playlistActiva?._id === pl._id && (
                    <div className="mt-4 space-y-3 border-t border-line/60 pt-4">
                      {/* Lista de canciones */}
                      {playlistActiva.canciones.length === 0 ? (
                        <p className="py-2 text-center text-sm text-muted">
                          Playlist vacía. Busca canciones abajo para añadirlas.
                        </p>
                      ) : (
                        <div className="max-h-64 space-y-1.5 overflow-y-auto">
                          {playlistActiva.canciones.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-sm">
                              <span className="w-5 shrink-0 text-center font-bold text-muted">{i + 1}</span>
                              {c.artwork && (
                                <img src={c.artwork} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-semibold text-fg">{c.title}</div>
                                {c.author && <div className="truncate text-xs text-muted">{c.author}</div>}
                              </div>
                              <span className="shrink-0 text-muted">{fmt(c.duration)}</span>
                              <button onClick={() => quitarCancion(i)}
                                className="shrink-0 text-danger hover:opacity-70 transition-opacity">
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Buscador para añadir canciones */}
                      <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input value={busquedaCancion}
                          onChange={(e) => buscarCancion(e.target.value)}
                          placeholder="Buscar canción para añadir (nombre, URL de YouTube, Spotify…)"
                          className="w-full rounded-xl border border-line bg-bg py-2.5 pl-9 pr-4 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/50" />
                        {buscandoCancion && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                            Buscando…
                          </span>
                        )}
                      </div>

                      {resultadosBusqueda.length > 0 && (
                        <div className="space-y-1.5">
                          {resultadosBusqueda.map((r, i) => (
                            <button key={i} onClick={() => añadirCancion(r)}
                              className="flex w-full items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5 text-left transition-colors hover:bg-elevated">
                              {r.artwork && (
                                <img src={r.artwork} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-fg">{r.title}</div>
                                <div className="truncate text-xs text-muted">{r.author}</div>
                              </div>
                              <span className="shrink-0 text-xs text-muted">{fmt(r.duration)}</span>
                              <Plus size={14} className="shrink-0" style={{ color: VERDE }} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB SPOTIFY ══ */}
      {tab === 'spotify' && (
        <Card className={card}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full text-base font-bold text-black"
              style={{ background: VERDE }}>
              S
            </div>
            <h3 className="text-lg font-bold text-fg">Conectar con Spotify</h3>
          </div>

          <MsgBanner msg={spMsg} />

          {spotifyStatus === null ? (
            <p className="text-muted">Comprobando estado…</p>

          ) : !spotifyStatus.disponible ? (
            /* Spotify no configurado */
            <div className="rounded-2xl border border-line bg-bg p-5 text-sm">
              <p className="mb-2 font-semibold text-fg">Spotify no está configurado en el servidor</p>
              <p className="text-muted mb-3">
                Para activar la conexión con Spotify, añade estas variables al <code className="rounded bg-elevated px-1">.env</code> del bot y reinícialo:
              </p>
              <pre className="overflow-x-auto rounded-xl bg-elevated p-4 text-xs font-mono leading-relaxed text-fg">
{`SPOTIFY_CLIENT_ID=tu_client_id
SPOTIFY_CLIENT_SECRET=tu_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback`}
              </pre>
              <p className="mt-3 text-muted">
                Regístralos gratis en{' '}
                <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer"
                  className="underline" style={{ color: VERDE }}>
                  developer.spotify.com
                </a>{' '}
                · En la app de Spotify añade la Redirect URI exacta de arriba.
              </p>
            </div>

          ) : !spotifyStatus.conectado ? (
            /* No conectado */
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Conecta tu cuenta de Spotify para ver e importar tus playlists directamente al bot.
                El audio siempre sale de YouTube — no es necesaria una suscripción Premium.
              </p>
              <button onClick={conectarSpotify}
                className="flex items-center gap-3 rounded-2xl px-6 py-3 font-bold text-black transition-opacity hover:opacity-90"
                style={{ background: VERDE }}>
                <span className="text-xl">🎵</span> Conectar con Spotify
              </button>
            </div>

          ) : (
            /* Conectado */
            <div className="space-y-5">
              {/* Info usuario */}
              <div className="flex items-center gap-3">
                {spotifyStatus.spotifyAvatar
                  ? <img src={spotifyStatus.spotifyAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  : <div className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-black"
                      style={{ background: VERDE }}>S</div>}
                <div className="flex-1">
                  <div className="font-bold text-fg">{spotifyStatus.spotifyUsername}</div>
                  <div className="text-xs text-muted">Cuenta de Spotify conectada</div>
                </div>
                <button onClick={desconectarSpotify}
                  className="rounded-xl border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg">
                  Desconectar
                </button>
              </div>

              <p className="text-sm text-muted">
                Para reproducir directamente en el bot necesitas estar en un canal de voz de Discord.
                <br />
                Con «Importar» la playlist se guarda en el bot y la puedes usar desde la pestaña «Mis Playlists».
              </p>

              {/* Cargar playlists de Spotify */}
              {spotifyPlaylists === null ? (
                <button onClick={cargarSpotifyPlaylists} disabled={cargandoSpotify}
                  className="flex items-center gap-2 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-elevated disabled:opacity-50">
                  {cargandoSpotify ? 'Cargando…' : '🎵 Ver mis playlists de Spotify'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-fg">
                      Mis playlists ({spotifyPlaylists.length})
                    </div>
                    <button onClick={cargarSpotifyPlaylists} disabled={cargandoSpotify}
                      className="text-xs text-muted hover:text-fg transition-colors disabled:opacity-50">
                      Actualizar
                    </button>
                  </div>

                  {spotifyPlaylists.length === 0 ? (
                    <p className="text-sm text-muted">No tienes playlists en Spotify.</p>
                  ) : (
                    <div className="max-h-[480px] space-y-2 overflow-y-auto">
                      {spotifyPlaylists.map((pl) => (
                        <div key={pl.id} className="flex items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5">
                          {pl.imagen
                            ? <img src={pl.imagen} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                            : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
                                style={{ background: '#1db95420' }}>🎵</div>}
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-fg">{pl.nombre}</div>
                            <div className="text-xs text-muted">
                              {pl.owner} · {pl.total} canciones
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button onClick={() => reproducirSpotify(pl.uri)}
                              title="Reproducir en el bot (necesitas estar en un canal de voz)"
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-elevated text-fg hover:opacity-80 transition-opacity">
                              <Play size={15} style={{ color: VERDE }} />
                            </button>
                            <button onClick={() => importarSpotify(pl)} disabled={importando.has(pl.id)}
                              title="Importar como playlist propia del bot"
                              className="flex items-center gap-1.5 rounded-xl border border-line bg-elevated px-3 py-2 text-xs font-semibold text-fg transition-opacity hover:opacity-80 disabled:opacity-50">
                              {importando.has(pl.id) ? 'Importando…' : 'Importar'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
