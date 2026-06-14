// Portal del Cliente: los usuarios entran con Discord y gestionan SUS tickets.
import { useState, useEffect } from 'react';
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

  // Tema oscuro fijo para el portal
  useEffect(() => { document.documentElement.setAttribute('data-theme', 'dark'); }, []);

  // Al cargar: capturar token de la URL (vuelta del login) o errores
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
      portalFetch('/api/portal/tickets').then(r => r.json())
    ])
      .then(([yo, tks]) => { setUsuario(yo); setTickets(Array.isArray(tks) ? tks : []); setError(''); })
      .catch(() => { setError('Tu sesión ha caducado. Vuelve a entrar.'); logout(); })
      .finally(() => setCargando(false));
  }, [token]);

  // Refresco del chat abierto cada 4s
  useEffect(() => {
    if (!ticketSel) return;
    const cargar = () => portalFetch(`/api/portal/tickets/${ticketSel.canalId}/mensajes`).then(r => r.json()).then(d => setMensajes(Array.isArray(d) ? d : [])).catch(() => {});
    cargar();
    const id = setInterval(cargar, 4000);
    return () => clearInterval(id);
  }, [ticketSel]);

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

  // ---------- LISTA DE MIS TICKETS ----------
  return (
    <div style={contenedor}>
      <Cabecera usuario={usuario} onLogout={logout} />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
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
