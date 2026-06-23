// Reproductor de música del PORTAL (lado usuario).
// El usuario, ya conectado a un canal de voz en Discord, busca y pone canciones
// desde la web: "sonando ahora" con carátula y progreso, cola y controles.
// Recibe portalFetch (con el token) desde Portal.jsx.
import { useState, useEffect, useRef, useCallback } from 'react';

const VERDE = '#1db954';

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
    if (!res.ok) return flash(d.error || 'No se pudo añadir.', true);
    if (d.estado) setEstado((e) => ({ ...e, ...d.estado }));
    flash(d.playlist ? `Añadidas ${d.anadidas} canciones de "${d.playlist}".` : `Añadida: ${d.track?.title || 'canción'}.`);
    cargarEstado();
  };

  const control = async (accion, valor) => {
    const res = await portalFetch('/api/portal/musica/control', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, valor }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return flash(d.error || 'No se pudo.', true);
    if (d.estado) { setEstado((e) => ({ ...e, ...d.estado })); if (d.estado.posicion != null) setPosLocal(d.estado.posicion); }
    cargarEstado();
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (q.trim()) { reproducir(q.trim()); setQ(''); setResultados([]); }
  };

  // --- Estados especiales ---
  if (cargandoEstado) return <p style={{ color: 'var(--text-secondary)' }}>Cargando reproductor…</p>;

  if (estado?.desactivado) {
    return <Caja icono="🚫" titulo="Música desactivada" texto="Un administrador ha desactivado la música en este servidor." />;
  }
  if (estado?.sinVoz) {
    return (
      <Caja icono="🎧" titulo="Entra a un canal de voz" texto="Conéctate a un canal de voz en Discord y vuelve aquí para poner música.">
        <button onClick={cargarEstado} style={btn(VERDE)}>🔄 Ya estoy dentro</button>
      </Caja>
    );
  }

  const t = estado?.actual;
  const total = t?.duration || 0;
  const pct = total > 0 ? Math.min(100, (posLocal / total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Contexto: dónde está sonando */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.9em' }}>
        🔊 Conectado en <strong style={{ color: 'var(--text-primary)' }}>{estado?.canalVoz?.nombre}</strong>
        {estado?.guild?.nombre && <span>· {estado.guild.nombre}</span>}
      </div>

      {(aviso || errorMsg) && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', fontWeight: 600,
          background: errorMsg ? 'rgba(231,76,60,0.12)' : 'rgba(29,185,84,0.12)',
          border: `1px solid ${errorMsg ? '#e74c3c' : VERDE}`, color: errorMsg ? '#e74c3c' : VERDE }}>
          {errorMsg ? `⚠️ ${errorMsg}` : `✓ ${aviso}`}
        </div>
      )}

      {!puede && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(241,196,15,0.1)', border: '1px solid #f1c40f', color: '#f1c40f', fontSize: '0.9em' }}>
          🎚️ Solo el rol <strong>DJ</strong> puede controlar la música aquí.
        </div>
      )}

      {/* SONANDO AHORA */}
      {t ? (
        <div style={{ display: 'flex', gap: '18px', background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-main))', border: '1px solid var(--border-color)', borderRadius: '18px', padding: '18px', flexWrap: 'wrap' }}>
          <Caratula src={t.artwork} size={120} />
          <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
            <div style={{ fontSize: '0.72em', fontWeight: 700, letterSpacing: '0.08em', color: VERDE }}>REPRODUCIENDO AHORA</div>
            <a href={t.uri || '#'} target="_blank" rel="noreferrer" style={{ fontSize: '1.25em', fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>{t.title}</a>
            <div style={{ color: 'var(--text-secondary)' }}>{t.author}</div>

            {/* Barra de progreso */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border-color)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: VERDE, transition: 'width 1s linear' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75em', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <span>{t.isStream ? 'EN DIRECTO' : fmt(posLocal)}</span>
                <span>{t.isStream ? '🔴' : fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Caja icono="🎵" titulo="No hay nada sonando" texto="Busca una canción abajo para empezar la fiesta." />
      )}

      {/* CONTROLES */}
      {t && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => control(estado.pausado ? 'resume' : 'pause')} disabled={!puede} style={btnIcono(puede)}>
            {estado.pausado ? '▶️' : '⏸️'}
          </button>
          <button onClick={() => control('skip')} disabled={!puede} style={btnIcono(puede)}>⏭️</button>
          <button onClick={() => control('stop')} disabled={!puede} style={btnIcono(puede)}>⏹️</button>
          <button onClick={() => control('shuffle')} disabled={!puede || !estado.cola?.length} style={btnIcono(puede && estado.cola?.length)}>🔀</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <span style={{ fontSize: '1.1em' }}>🔊</span>
            <input type="range" min="0" max={estado.config?.volumenMax ?? 150} value={estado.volumen ?? 60}
              disabled={!puede}
              onChange={(e) => setEstado((s) => ({ ...s, volumen: Number(e.target.value) }))}
              onMouseUp={(e) => control('volume', Number(e.target.value))}
              onTouchEnd={(e) => control('volume', Number(e.target.value))}
              style={{ accentColor: VERDE, width: '120px' }} />
            <span style={{ width: '38px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85em' }}>{estado.volumen ?? 60}%</span>
          </div>
        </div>
      )}

      {/* BUSCADOR */}
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: '10px' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} disabled={!puede}
          placeholder="Busca una canción o pega una URL de YouTube/Spotify…"
          style={{ flex: 1, padding: '13px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '0.95em' }} />
        <button type="submit" disabled={!puede || !q.trim()} style={btn(VERDE)}>▶️ Poner</button>
      </form>

      {/* RESULTADOS DE BÚSQUEDA */}
      {(buscando || resultados.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.85em' }}>
            {buscando ? 'Buscando…' : 'Resultados — pulsa para añadir'}
          </div>
          {resultados.map((r, i) => (
            <Fila key={i} track={r} disabled={!puede} accion={() => reproducir(r.uri || r.title)} icono="＋" />
          ))}
        </div>
      )}

      {/* COLA */}
      {estado?.cola?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.85em' }}>
            📋 En cola ({estado.cola.length})
          </div>
          {estado.cola.slice(0, 20).map((r, i) => (
            <Fila key={i} track={r} pos={i + 1} disabled={!puede} accion={() => control('remove', i)} icono="✕" />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Subcomponentes ---
function Caratula({ src, size = 56 }) {
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '12px', flexShrink: 0, background: `linear-gradient(135deg, ${VERDE}, #128a3e)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4 }}>🎵</div>
  );
}

function Fila({ track, pos, accion, icono, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '8px 10px' }}>
      {pos && <span style={{ width: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.85em' }}>{pos}</span>}
      <Caratula src={track.artwork} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
        <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {track.author}{track.duration ? ` · ${fmt(track.duration)}` : ''}
        </div>
      </div>
      <button onClick={accion} disabled={disabled} title={icono === '✕' ? 'Quitar' : 'Añadir'}
        style={{ flexShrink: 0, width: '34px', height: '34px', borderRadius: '9px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '1.05em', fontWeight: 700, color: '#fff', opacity: disabled ? 0.4 : 1, background: icono === '✕' ? '#e74c3c' : VERDE }}>
        {icono}
      </button>
    </div>
  );
}

function Caja({ icono, titulo, texto, children }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
      <div style={{ fontSize: '2.6em' }}>{icono}</div>
      <h3 style={{ margin: '8px 0 4px' }}>{titulo}</h3>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 14px' }}>{texto}</p>
      {children}
    </div>
  );
}

const btn = (bg) => ({ padding: '0 20px', background: bg, color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95em' });
const btnIcono = (activo) => ({ width: '46px', height: '46px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: activo ? 'pointer' : 'not-allowed', fontSize: '1.2em', opacity: activo ? 1 : 0.4 });
