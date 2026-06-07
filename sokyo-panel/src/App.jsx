// src/App.jsx
import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState('tickets');
  const [ticketsReales, setTicketsReales] = useState([]);
  
  // Estados para manejar el sistema de chat
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  
  // 1. EL ESTADO DEL NUEVO MENSAJE (¡Ahora en su sitio correcto!)
  const [nuevoMensaje, setNuevoMensaje] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    if (activeTab === 'tickets') {
      cargarTickets();
    }
  }, [activeTab]);

  useEffect(() => {
    let intervalo;

    if (ticketSeleccionado) {
      intervalo = setInterval(() => {
        fetch(`http://localhost:3000/api/mensajes/${ticketSeleccionado.canalId}`)
          .then((respuesta) => respuesta.json())
          .then((datos) => {
            setMensajes(datos);
          })
          .catch((error) => console.error('[Error 1006] Error al recargar el chat:', error));
      }, 3000); 
    }

    return () => clearInterval(intervalo);
  }, [ticketSeleccionado]);

  const cargarTickets = () => {
    fetch('http://localhost:3000/api/tickets')
      .then((respuesta) => respuesta.json())
      .then((datos) => setTicketsReales(datos))
      .catch((error) => console.error('[Error 1007] Error al cargar tickets:', error));
  };

  const verMensajes = (ticket) => {
    fetch(`http://localhost:3000/api/mensajes/${ticket.canalId}`)
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        setMensajes(datos);
        setTicketSeleccionado(ticket); 
      })
      .catch((error) => console.error('Error al cargar mensajes:', error));
  };

  const cerrarMensajes = () => {
    setTicketSeleccionado(null);
    setMensajes([]);
    cargarTickets(); 
  };

  // 2. LA FUNCIÓN PARA ENVIAR EL MENSAJE (¡Antes del return!)
  const enviarMensaje = () => {
    if (nuevoMensaje.trim() === '') return; 
    
    fetch(`http://localhost:3000/api/mensajes/${ticketSeleccionado.canalId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        usuario: 'Sokyo', 
        contenido: nuevoMensaje 
      })
    })
    .then((respuesta) => respuesta.json())
    .then(() => {
      setNuevoMensaje(''); 
    })
    .catch((error) => console.error('Error al enviar mensaje:', error));
  };

  // --- A PARTIR DE AQUÍ EMPIEZA LO VISUAL ---
  return (
    <div className="app-container">
      
      <aside className="sidebar">
        <div className="brand">🤖 Sokyo Bot</div>
        <nav className="nav-menu">
          <div 
            className={`nav-item ${activeTab === 'tickets' ? 'active' : ''}`}
            onClick={() => { setActiveTab('tickets'); setTicketSeleccionado(null); }}
          >
            🎫 Sistema de Tickets
          </div>
          <div 
            className={`nav-item ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            ⚙️ Configuración
          </div>
          <div 
            className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            📜 Logs del Bot
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="header">
          <div>
            <h1>{activeTab === 'tickets' ? 'Gestión de Tickets' : 'Panel en construcción'}</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Administra las solicitudes de soporte de tu servidor.
            </p>
          </div>
          <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>
            {isDark ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
          </button>
        </header>

        {/* VISTA 1: CUADRÍCULA DE TICKETS */}
        {activeTab === 'tickets' && !ticketSeleccionado && (
          <div className="tickets-grid">
            {ticketsReales.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No hay tickets en la base de datos todavía.</p>
            ) : (
              ticketsReales.map((ticket, index) => (
                <div className="ticket-card" key={index}>
                  <div className="ticket-header">
                    <span className="ticket-id">#ticket-{ticket.creadorNombre || ticket.canalId.substring(0, 5)}</span>
                    <span 
                      className="status-badge"
                      style={{
                        backgroundColor: ticket.estado === 'Cerrado' ? 'transparent' : 'var(--success-bg)',
                        color: ticket.estado === 'Cerrado' ? 'var(--text-secondary)' : 'var(--success-text)',
                        border: ticket.estado === 'Cerrado' ? '1px solid var(--border-color)' : 'none'
                      }}
                    >
                      {ticket.estado}
                    </span>
                  </div>
                  <div className="ticket-user">
                    👤 Creado por: <strong>{ticket.creadorNombre || 'Usuario Desconocido'}</strong>
                  </div>
                  <button className="btn-view" onClick={() => verMensajes(ticket)}>
                    Ver Mensajes
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* VISTA 2: HISTORIAL DE MENSAJES */}
        {activeTab === 'tickets' && ticketSeleccionado && (
          <div className="mensajes-view">
            <button className="btn-back" onClick={cerrarMensajes}>
              ⬅ Volver a los tickets
            </button>
            
            <h2>Historial de #ticket-{ticketSeleccionado.creadorNombre}</h2>
            
            <div className="chat-box">
              {mensajes.length === 0 ? (
                <p className="chat-vacio">No hay mensajes registrados en este ticket.</p>
              ) : (
                mensajes.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`mensaje ${msg.usuario === 'Admin' || msg.usuario === 'Sokyo' ? 'mod' : ''}`} 
                  >
                    <span className="mensaje-autor">{msg.usuario || 'Usuario Desconocido'}</span>
                    <span className="mensaje-contenido">{msg.contenido}</span>
                  </div>
                ))
              )}
            </div>

            {/* 3. ¡AQUÍ VA EL RECUADRO PARA ESCRIBIR! */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
              <input 
                type="text" 
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()} 
                placeholder="Escribe una respuesta al ticket..." 
                style={{ 
                  flex: 1, 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-color)', 
                  backgroundColor: 'var(--bg-main)', 
                  color: 'var(--text-primary)' 
                }}
              />
              <button 
                onClick={enviarMensaje}
                style={{ 
                  padding: '0 1.5rem', 
                  backgroundColor: 'var(--accent-color)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontWeight: '600' 
                }}
              >
                Enviar
              </button>
            </div>

          </div>
        )}

        {/* OTRAS PESTAÑAS */}
        {activeTab !== 'tickets' && (
          <div className="ticket-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <h2>🚧 Módulo en desarrollo</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
              Esta función estará disponible próximamente.
            </p>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;