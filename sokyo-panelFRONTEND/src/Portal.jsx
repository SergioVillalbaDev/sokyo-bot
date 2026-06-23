// Portal del Cliente: los usuarios entran con Discord y gestionan SUS tickets.
import { useState, useEffect, useRef } from 'react';
import { PRESETS_TARJETA } from './presetsTarjeta';
import MusicaPortal from './components/portal/MusicaPortal';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function Portal() {
  const [token, setToken] = useState(localStorage.getItem('portalToken') || '');
  const [usuario, setUsuario] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [ticketSel, setTicketSel] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [vista, setVista] = useState('tickets');
  const [tarjeta, setTarjeta] = useState({ colorAcento: '#5865F2', fondoTipo: 'color', fondoColor: '#1e2030', colorSecundario: '#9b59b6', fondoImagen: '', preset: null });
  const [guardadoT, setGuardadoT] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewUrlRef = useRef('');
  const [catalogo, setCatalogo] = useState({ ocultos: [], personalizados: [] });

  // Tema oscuro fijo para el portal
  useEffect(() => { document.documentElement.setAttribute('data-theme', 'dark'); }, []);

  // Al cargar: capturar token de la URL (vuelta del login) o errores.
  // Efecto solo-en-montaje: el setState aquí es intencional (leer la URL una vez).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    const err = params.get('error');
    if (err) setError(err === 'denegado' ? 'Has cancelado el inicio de sesión.' : 'No se pudo iniciar sesión con Discord.');
    if (t) {
      localStorage.setItem('portalToken', t);
      setToken(t);
      window.history.replaceState({}, '', '/?portal=1'); // limpia el token de la URL
    }
  }, []);

  const portalFetch = (path, options = {}) => fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
  });

  const logout = () => { localStorage.removeItem('portalToken'); setToken(''); setUsuario(null); setTickets([]); setTicketSel(null); };

  // Cargar usuario + tickets cuando hay token
  useEffect(() => {
    if (!token) return;
    setCargando(true);
    Promise.all([
      portalFetch('/api/portal/yo').then(r => { if (r.status === 401) throw new Error('sesion'); return r.json(); }),
      portalFetch('/api/portal/tickets').then(r => r.json()),
      portalFetch('/api/portal/tarjeta').then(r => r.json()).catch(() => ({})),
      portalFetch('/api/portal/presets').then(r => r.json()).catch(() => ({ ocultos: [], personalizados: [] }))
    ])
      .then(([yo, tks, tj, cat]) => {
        setUsuario(yo); setTickets(Array.isArray(tks) ? tks : []); setError('');
        setCatalogo({ ocultos: cat?.ocultos || [], personalizados: cat?.personalizados || [] });
        if (tj && tj.colorAcento) setTarjeta({ colorAcento: tj.colorAcento, fondoTipo: tj.fondoTipo || 'color', fondoColor: tj.fondoColor || '#1e2030', colorSecundario: tj.colorSecundario || '#9b59b6', fondoImagen: tj.fondoImagen || '', preset: tj.preset || null });
      })
      .catch(() => { setError('Tu sesión ha caducado. Vuelve a entrar.'); logout(); })
      .finally(() => setCargando(false));
  }, [token]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Refresco del chat abierto cada 4s
  useEffect(() => {
    if (!ticketSel) return;
    const cargar = () => portalFetch(`/api/portal/tickets/${ticketSel.canalId}/mensajes`).then(r => r.json()).then(d => setMensajes(Array.isArray(d) ? d : [])).catch(() => {});
    cargar();
    const id = setInterval(cargar, 4000);
    return () => clearInterval(id);
  }, [ticketSel]);

  // Vista previa REAL: pide al bot la imagen (PNG o GIF) con los ajustes
  // actuales. Con debounce para no saturar al cambiar colores rápido.
  useEffect(() => {
    if (!token || vista !== 'tarjeta') return;
    const id = setTimeout(() => {
      setPreviewLoading(true);
      portalFetch('/api/portal/tarjeta/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tarjeta),
      })
        .then(r => (r.ok ? r.blob() : Promise.reject(new Error('preview'))))
        .then(blob => {
          const url = URL.createObjectURL(blob);
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = url;
          setPreviewUrl(url);
        })
        .catch(() => {})
        .finally(() => setPreviewLoading(false));
    }, 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarjeta, token, vista]);

  const enviar = async () => {
    if (!nuevoMensaje.trim()) return;
    const res = await portalFetch(`/api/portal/tickets/${ticketSel.canalId}/mensajes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido: nuevoMensaje })
    });
    if (res.ok) {
      setNuevoMensaje('');
      const d = await portalFetch(`/api/portal/tickets/${ticketSel.canalId}/mensajes`).then(r => r.json());
      setMensajes(Array.isArray(d) ? d : []);
    }
  };

  const setT = (campo, valor) => { setGuardadoT(false); setTarjeta(t => ({ ...t, [campo]: valor })); };
  // Edición manual de un color/fondo: deja de coincidir con un preset, lo deselecciona.
  const setManual = (campo, valor) => { setGuardadoT(false); setTarjeta(t => ({ ...t, [campo]: valor, preset: null })); };
  // Aplica un diseño prediseñado: vuelca sus colores. Los premium están
  // bloqueados para no-premium; los personalizados gratis los puede usar todo el mundo.
  const aplicarPreset = (p) => {
    if (p.premium !== false && !usuario?.esPremium) return; // bloqueado
    setGuardadoT(false);
    setTarjeta(t => ({ ...t, colorAcento: p.colorAcento, fondoColor: p.fondoColor, colorSecundario: p.colorSecundario, fondoTipo: p.fondoTipo, preset: p.id }));
  };
  const guardarTarjeta = async () => {
    const res = await portalFetch('/api/portal/tarjeta', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tarjeta)
    });
    setGuardadoT(res.ok);
  };
  // Sube un archivo del ordenador como fondo.
  // La tarjeta se genera a 900x270 px: exigimos al menos ese tamaño para que
  // no salga borrosa (imágenes más grandes con el mismo ratio valen igual).
  const ANCHO_MIN = 900, ALTO_MIN = 270;
  const subirFondo = (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const lector = new FileReader();
    lector.onload = () => {
      // Comprobamos las dimensiones reales cargando la imagen en memoria.
      const img = new Image();
      img.onload = async () => {
        if (img.naturalWidth < ANCHO_MIN || img.naturalHeight < ALTO_MIN) {
          setError(`La imagen es demasiado pequeña (${img.naturalWidth}×${img.naturalHeight}). Mínimo ${ANCHO_MIN}×${ALTO_MIN} px.`);
          return;
        }
        const res = await portalFetch('/api/portal/tarjeta/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datos: lector.result })
        });
        const data = await res.json().catch(() => ({}));
        if (data.url) setT('fondoImagen', data.url);
        else setError(data.error || 'No se pudo subir la imagen');
      };
      img.onerror = () => setError('No se pudo leer la imagen.');
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  };

  const colorEstado = (estado) => estado === 'Cerrado' ? '#e74c3c' : '#2ecc71';
  const renderEstrellas = (p) => !p ? null : <span style={{ color: '#f1c40f' }}>{'★'.repeat(p)}{'☆'.repeat(5 - p)}</span>;

  // ---------- PANTALLA DE LOGIN ----------
  if (!token) {
    return (
      <div style={pantallaCentro}>
        <div style={tarjetaLogin}>
          <div style={{ fontSize: '3em', marginBottom: '10px' }}>🎫</div>
          <h1 style={{ margin: '0 0 8px 0' }}>Portal de Soporte</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '25px' }}>Inicia sesión para ver y gestionar tus tickets.</p>
          {error && <div style={bannerError}>⚠️ {error}</div>}
          <a href={`${API_URL}/api/auth/discord`} style={botonDiscord}>
            <span style={{ fontSize: '1.2em' }}>🔗</span> Iniciar sesión con Discord
          </a>
        </div>
      </div>
    );
  }

  // ---------- VISTA DE UN TICKET (CHAT) ----------
  if (ticketSel) {
    const cerrado = ticketSel.estado === 'Cerrado';
    return (
      <div style={contenedor}>
        <Cabecera usuario={usuario} onLogout={logout} />
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
          <button onClick={() => { setTicketSel(null); setMensajes([]); }} style={botonVolver}>⬅ Volver a mis tickets</button>
          <div style={{ marginTop: '15px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.3em' }}>{ticketSel.titulo || ticketSel.motivo}</h2>
                <span style={{ fontSize: '0.8em', padding: '4px 12px', borderRadius: '12px', backgroundColor: colorEstado(ticketSel.estado), color: '#fff', fontWeight: 'bold' }}>{ticketSel.estado}</span>
              </div>
              {ticketSel.descripcion && <p style={{ color: 'var(--text-secondary)', margin: '10px 0 0 0', fontStyle: 'italic' }}>{ticketSel.descripcion}</p>}
            </div>
            <div className="chat-box" style={{ minHeight: '350px', maxHeight: '50vh', overflowY: 'auto', padding: '20px' }}>
              {mensajes.length === 0
                ? <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>Aún no hay mensajes en este ticket.</p>
                : mensajes.map((m, i) => {
                    const mio = m.usuarioId === usuario?.id;
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: mio ? 'flex-end' : 'flex-start', marginBottom: '10px' }}>
                        <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: '12px', backgroundColor: mio ? 'var(--accent-color)' : 'var(--bg-main)', color: mio ? '#fff' : 'var(--text-primary)' }}>
                          <div style={{ fontSize: '0.75em', opacity: 0.8, marginBottom: '3px' }}>{m.usuario}</div>
                          <div>{m.contenido}</div>
                          {m.imagenes && m.imagenes.map((url, j) => <img key={j} src={url} alt="adjunto" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '6px' }} />)}
                        </div>
                      </div>
                    );
                  })}
            </div>
            <div style={{ padding: '15px 20px', borderTop: '1px solid var(--border-color)' }}>
              {cerrado
                ? <p style={{ textAlign: 'center', color: 'var(--text-secondary)', margin: 0 }}>Este ticket está cerrado.</p>
                : <div style={{ display: 'flex', gap: '10px' }}>
                    <input value={nuevoMensaje} onChange={e => setNuevoMensaje(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviar()} placeholder="Escribe tu mensaje..." style={input} />
                    <button onClick={enviar} style={botonEnviar}>Enviar</button>
                  </div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- MI TARJETA DE NIVEL (personalización) ----------
  if (vista === 'tarjeta') {
    // Presets de fábrica (sin los ocultados por el admin) + los personalizados.
    const presetsEfectivos = [
      ...PRESETS_TARJETA.filter(p => !catalogo.ocultos.includes(p.id)).map(p => ({ ...p, premium: true })),
      ...catalogo.personalizados.map(p => ({
        id: p.id, nombre: p.nombre, colorAcento: p.colorAcento, fondoColor: p.fondoColor,
        colorSecundario: p.colorSecundario, fondoTipo: p.fondoTipo || 'degradado', animado: false, premium: !!p.premium,
        swatch: p.fondoTipo === 'color' ? p.fondoColor : `linear-gradient(135deg, ${p.fondoColor}, ${p.colorSecundario})`,
      })),
    ];
    return (
      <div style={contenedor}>
        <Cabecera usuario={usuario} onLogout={logout} />
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
          <Nav vista={vista} setVista={setVista} />
          <h1 style={{ marginBottom: '5px' }}>🎨 Mi tarjeta de nivel</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>Personaliza tu tarjeta de rango. Los <strong>colores</strong> son gratis y se aplican en todos los servidores. La <strong style={{ color: '#f1c40f' }}>imagen propia es premium</strong> y solo se ve en servidores con Premium activo.</p>

          {/* Vista previa REAL: la misma imagen que genera el bot (PNG o GIF animado) */}
          <div style={{ marginTop: '15px', position: 'relative', borderRadius: '16px', overflow: 'hidden', aspectRatio: '900 / 270', backgroundColor: '#0b0b14' }}>
            {previewUrl
              ? <img src={previewUrl} alt="Vista previa de tu tarjeta" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Generando vista previa…</div>}
            {previewLoading && <div style={{ position: 'absolute', top: '10px', right: '12px', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '0.78em', padding: '4px 9px', borderRadius: '6px' }}>Actualizando…</div>}
          </div>

          {/* Controles */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Color de acento</span>
              <input type="color" value={tarjeta.colorAcento} onChange={e => setManual('colorAcento', e.target.value)} style={{ width: '54px', height: '36px', border: 'none', background: 'none', cursor: 'pointer' }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Tipo de fondo</span>
              <select value={tarjeta.fondoTipo} onChange={e => setManual('fondoTipo', e.target.value)} style={{ ...input, flex: 'none', width: '160px' }}>
                <option value="color">Color sólido</option>
                <option value="degradado">Degradado</option>
                <option value="imagen" disabled={!usuario?.esPremium}>Imagen propia ⭐ Premium</option>
              </select>
            </label>

            {/* Color de fondo: para sólido y degradado */}
            {(tarjeta.fondoTipo === 'color' || tarjeta.fondoTipo === 'degradado') && (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>Color de fondo</span>
                <input type="color" value={tarjeta.fondoColor} onChange={e => setManual('fondoColor', e.target.value)} style={{ width: '54px', height: '36px', border: 'none', background: 'none', cursor: 'pointer' }} />
              </label>
            )}

            {/* Color secundario: solo en degradado */}
            {tarjeta.fondoTipo === 'degradado' && (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>Color secundario</span>
                <input type="color" value={tarjeta.colorSecundario} onChange={e => setManual('colorSecundario', e.target.value)} style={{ width: '54px', height: '36px', border: 'none', background: 'none', cursor: 'pointer' }} />
              </label>
            )}

            {/* Imagen propia: premium */}
            {tarjeta.fondoTipo === 'imagen' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontWeight: 600 }}>Imagen de fondo <strong style={{ color: '#f1c40f' }}>⭐ Premium</strong></span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={tarjeta.fondoImagen} onChange={e => setT('fondoImagen', e.target.value)} placeholder="Pega una URL o sube un archivo →" style={input} />
                  <label style={{ ...botonEnviar, padding: '0 18px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                    Subir
                    <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={subirFondo} style={{ display: 'none' }} />
                  </label>
                </div>
                <span style={{ fontSize: '0.82em', color: 'var(--text-secondary)' }}>Recomendado: 900×270 px (ratio 10:3). Mínimo 900×270. Solo se aplica en servidores con Premium.</span>
                {tarjeta.fondoImagen && <button onClick={() => setT('fondoImagen', '')} style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85em' }}>Quitar imagen</button>}
              </div>
            )}
            {/* Diseños prediseñados (los premium bloqueados para free) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <span style={{ fontWeight: 600 }}>Diseños prediseñados</span>
              {!usuario?.esPremium && <span style={{ fontSize: '0.82em', color: 'var(--text-secondary)' }}>Los marcados con 🔒 son Premium. Hazte Premium para desbloquear esos diseños únicos.</span>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                {presetsEfectivos.map(p => {
                  const bloqueado = p.premium !== false && !usuario?.esPremium;
                  const activo = tarjeta.preset === p.id;
                  return (
                    <button key={p.id} onClick={() => aplicarPreset(p)} disabled={bloqueado}
                      style={{ position: 'relative', padding: 0, border: activo ? `2px solid ${p.colorAcento}` : '2px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', cursor: bloqueado ? 'not-allowed' : 'pointer', background: 'none' }}>
                      <div style={{ height: '54px', background: p.swatch || `linear-gradient(135deg, ${p.fondoColor}, ${p.colorSecundario})`, position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '8px', bottom: '6px', width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${p.colorAcento}` }} />
                        {p.animado && <div style={{ position: 'absolute', right: '6px', top: '6px', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '0.62em', fontWeight: 700, padding: '2px 5px', borderRadius: '5px' }}>✨ GIF</div>}
                        {bloqueado && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3em' }}>🔒</div>}
                      </div>
                      <div style={{ padding: '5px', fontSize: '0.8em', fontWeight: 600, color: 'var(--text-primary)' }}>{p.nombre}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button onClick={guardarTarjeta} style={{ ...botonEnviar, padding: '10px 22px' }}>Guardar tarjeta</button>
              {guardadoT && <span style={{ color: '#2ecc71', fontWeight: 600 }}>✓ Guardado</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- MÚSICA ----------
  if (vista === 'musica') {
    return (
      <div style={contenedor}>
        <Cabecera usuario={usuario} onLogout={logout} />
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
          <Nav vista={vista} setVista={setVista} />
          <h1 style={{ marginBottom: '5px' }}>🎵 Música</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>Pon música en tu canal de voz: busca o pega una URL y controla la cola desde aquí.</p>
          <MusicaPortal portalFetch={portalFetch} />
        </div>
      </div>
    );
  }

  // ---------- LISTA DE MIS TICKETS ----------
  return (
    <div style={contenedor}>
      <Cabecera usuario={usuario} onLogout={logout} />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <Nav vista={vista} setVista={setVista} />
        <h1 style={{ marginBottom: '5px' }}>Mis Tickets</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>Aquí tienes todas tus solicitudes de soporte.</p>
        {error && <div style={bannerError}>⚠️ {error}</div>}
        {cargando ? <p style={{ color: 'var(--text-secondary)' }}>Cargando...</p>
          : tickets.length === 0
            ? <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)' }}><div style={{ fontSize: '3em' }}>📭</div>No has abierto ningún ticket todavía.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tickets.map((t, i) => (
                  <div key={i} onClick={() => setTicketSel(t)} style={tarjetaTicket}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '1.1em' }}>{t.titulo || t.motivo}</strong>
                      <span style={{ fontSize: '0.75em', padding: '3px 10px', borderRadius: '12px', backgroundColor: colorEstado(t.estado), color: '#fff', fontWeight: 'bold' }}>{t.estado}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                      <span>🏷️ {t.motivo} · {new Date(t.fechaCreacion).toLocaleDateString('es-ES')}</span>
                      {t.estado === 'Cerrado' && renderEstrellas(t.valoracionCSAT)}
                    </div>
                  </div>
                ))}
              </div>}
      </div>
    </div>
  );
}

function Nav({ vista, setVista }) {
  const tab = (id, etiqueta) => (
    <button onClick={() => setVista(id)} style={{
      padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 600,
      backgroundColor: vista === id ? 'var(--accent-color)' : 'transparent', color: vista === id ? '#fff' : 'var(--text-secondary)',
    }}>{etiqueta}</button>
  );
  return <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>{tab('tickets', '🎫 Mis Tickets')}{tab('tarjeta', '🎨 Mi tarjeta')}{tab('musica', '🎵 Música')}</div>;
}

function Cabecera({ usuario, onLogout }) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 25px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ fontWeight: 'bold', fontSize: '1.2em' }}>🤖 Sokyo · Soporte</div>
      {usuario && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={usuario.avatar || `https://ui-avatars.com/api/?name=${usuario.username}&background=2c3e50&color=fff`} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          <span style={{ fontWeight: '600' }}>{usuario.username}</span>
          <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Salir</button>
        </div>
      )}
    </header>
  );
}

// --- estilos ---
const contenedor = { minHeight: '100vh', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' };
const pantallaCentro = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' };
const tarjetaLogin = { backgroundColor: 'var(--bg-secondary)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center', maxWidth: '380px', width: '90%' };
const botonDiscord = { display: 'inline-flex', alignItems: 'center', gap: '10px', backgroundColor: '#5865F2', color: '#fff', padding: '14px 24px', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold', fontSize: '1em' };
const tarjetaTicket = { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px 18px', cursor: 'pointer' };
const botonVolver = { padding: '8px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontWeight: 'bold', cursor: 'pointer' };
const input = { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' };
const botonEnviar = { padding: '0 20px', backgroundColor: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' };
const bannerError = { backgroundColor: 'rgba(231,76,60,0.12)', border: '1px solid #e74c3c', color: '#e74c3c', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontWeight: '600' };

export default Portal;
