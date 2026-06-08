// src/App.jsx
import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState('tickets');
  const [ticketsReales, setTicketsReales] = useState([]);
  
  // Estados de Chat
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');

  // --- NUEVOS ESTADOS PARA CONFIGURACIÓN ---
  const [configServidor, setConfigServidor] = useState(null);
  const [motivos, setMotivos] = useState([]);
  const [nuevoMotivo, setNuevoMotivo] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    if (activeTab === 'tickets') {
      cargarTickets();
    } else if (activeTab === 'config') {
      cargarConfiguracion();
    }
  }, [activeTab]);

  // Resto de useEffects (chat) se mantienen igual...
  useEffect(() => {
    let intervalo;
    if (ticketSeleccionado) {
      intervalo = setInterval(() => {
        fetch(`http://localhost:3000/api/mensajes/${ticketSeleccionado.canalId}`)
          .then((respuesta) => respuesta.json())
          .then((datos) => setMensajes(datos))
          .catch((error) => console.error('[Error 1006]', error));
      }, 3000); 
    }
    return () => clearInterval(intervalo);
  }, [ticketSeleccionado]);

  // --- FUNCIONES DE TICKETS Y CHAT ---
  const cargarTickets = () => {
    fetch('http://localhost:3000/api/tickets')
      .then((respuesta) => respuesta.json())
      .then((datos) => setTicketsReales(datos))
      .catch((error) => console.error('[Error 1007]', error));
  };

  const verMensajes = (ticket) => {
    fetch(`http://localhost:3000/api/mensajes/${ticket.canalId}`)
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        setMensajes(datos);
        setTicketSeleccionado(ticket); 
      })
      .catch((error) => console.error('Error al cargar mensajes', error));
  };

  const cerrarMensajes = () => {
    setTicketSeleccionado(null);
    setMensajes([]);
    cargarTickets(); 
  };

  const enviarMensaje = () => {
    if (nuevoMensaje.trim() === '') return; 
    
    fetch(`http://localhost:3000/api/mensajes/${ticketSeleccionado.canalId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'Sokyo', contenido: nuevoMensaje })
    })
    .then((respuesta) => respuesta.json())
    .then(() => setNuevoMensaje(''))
    .catch((error) => console.error('Error al enviar', error));
  };

  const handleCerrarTicket = async (canalId, e) => {
    e.stopPropagation(); 
    if (!window.confirm('¿Estás seguro de que quieres cerrar este ticket en Discord?')) return;
    try {
        const respuesta = await fetch(`http://localhost:3000/api/tickets/${canalId}/cerrar`, { method: 'PUT' });
        if (respuesta.ok) {
            setTicketsReales(ticketsReales.map(t => t.canalId === canalId ? { ...t, estado: 'Cerrado' } : t));
        }
    } catch (error) { console.error('Error', error); }
  };

  const handleOcultarTicket = async (canalId, e) => {
    e.stopPropagation();
    if (!window.confirm('¿Quieres eliminar este ticket del panel web?')) return;
    try {
        const respuesta = await fetch(`http://localhost:3000/api/tickets/${canalId}/ocultar`, { method: 'PUT' });
        if (respuesta.ok) {
            setTicketsReales(ticketsReales.filter(t => t.canalId !== canalId));
            if (ticketSeleccionado && ticketSeleccionado.canalId === canalId) cerrarMensajes();
        }
    } catch (error) { console.error('Error', error); }
  };

  // --- NUEVAS FUNCIONES DE CONFIGURACIÓN ---
  const cargarConfiguracion = () => {
    fetch('http://localhost:3000/api/servidores')
      .then(res => res.json())
      .then(datos => {
        if (datos && datos.length > 0) {
          setConfigServidor(datos[0]); // Cogemos el primer servidor registrado
          setMotivos(datos[0].motivos || ['Fallo Técnico', 'Reportar Usuario', 'Duda de Pago']);
        }
      })
      .catch(error => console.error('Error cargando config:', error));
  };

  const agregarMotivo = () => {
    if (nuevoMotivo.trim() !== '' && !motivos.includes(nuevoMotivo.trim())) {
      setMotivos([...motivos, nuevoMotivo.trim()]);
      setNuevoMotivo('');
    }
  };

  const eliminarMotivo = (motivoABorrar) => {
    setMotivos(motivos.filter(m => m !== motivoABorrar));
  };

  const guardarCambiosConfig = async () => {
    if (!configServidor) return alert('No hay configuración de servidor activa.');
    
    try {
      const respuesta = await fetch(`http://localhost:3000/api/config/${configServidor.guildId}/motivos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivos: motivos })
      });
      
      if (respuesta.ok) {
        alert('✅ ¡Motivos actualizados correctamente!\nEl bot mostrará estas nuevas opciones en Discord a partir de ahora.');
      } else {
        alert('❌ Hubo un error al guardar los cambios.');
      }
    } catch (error) {
      console.error('Error al guardar motivos:', error);
    }
  };

  // --- INTERFAZ VISUAL ---
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand">🤖 Sokyo Bot</div>
        <nav className="nav-menu">
          <div className={`nav-item ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => { setActiveTab('tickets'); setTicketSeleccionado(null); }}>
            🎫 Sistema de Tickets
          </div>
          <div className={`nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
            ⚙️ Configuración
          </div>
          <div className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
            📜 Logs del Bot
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="header">
          <div>
            <h1>
              {activeTab === 'tickets' && 'Gestión de Tickets'}
              {activeTab === 'config' && 'Configuración General'}
              {activeTab === 'logs' && 'Logs del Bot'}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Administra las solicitudes y ajustes de tu servidor.
            </p>
          </div>
          <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>
            {isDark ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
          </button>
        </header>

        {/* --- VISTA 1: TICKETS (Igual que antes) --- */}
        {activeTab === 'tickets' && !ticketSeleccionado && (
          <div className="tickets-grid">
            {ticketsReales.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No hay tickets activos en este momento.</p>
            ) : (
              ticketsReales.map((ticket, index) => (
                <div className="ticket-card" key={index}>
                  <div className="ticket-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span className="ticket-id" style={{ fontWeight: 'bold' }}>#{ticket.creadorNombre || ticket.canalId.substring(0, 5)}</span>
                    <span className="status-badge" style={{ backgroundColor: ticket.estado === 'Cerrado' ? 'transparent' : 'var(--success-bg)', color: ticket.estado === 'Cerrado' ? 'var(--text-secondary)' : 'var(--success-text)', border: ticket.estado === 'Cerrado' ? '1px solid var(--border-color)' : 'none', padding: '4px 8px', borderRadius: '12px', fontSize: '0.85em' }}>
                      {ticket.estado}
                    </span>
                  </div>
                  <div className="ticket-user" style={{ marginBottom: '8px' }}>👤 Usuario: <strong>{ticket.creadorNombre || 'Usuario Desconocido'}</strong></div>
                  <div className="ticket-reason" style={{ marginBottom: '15px', color: 'var(--text-secondary)' }}>🏷️ Motivo: <em>{ticket.motivo || 'Sin especificar'}</em></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="btn-view" onClick={() => verMensajes(ticket)} style={{ width: '100%', padding: '8px', cursor: 'pointer', borderRadius: '5px' }}>💬 Ver Conversación</button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {ticket.estado !== 'Cerrado' && (
                            <button onClick={(e) => handleCerrarTicket(ticket.canalId, e)} style={{ flex: 1, backgroundColor: '#e74c3c', color: 'white', padding: '8px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>🔒 Cerrar</button>
                        )}
                        <button onClick={(e) => handleOcultarTicket(ticket.canalId, e)} style={{ flex: 1, backgroundColor: '#34495e', color: 'white', padding: '8px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>🗑️ Ocultar</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* --- VISTA 2: HISTORIAL DE CHAT (Igual que antes) --- */}
        {activeTab === 'tickets' && ticketSeleccionado && (
           <div className="mensajes-view">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                 <button className="btn-back" onClick={cerrarMensajes} style={{ padding: '8px 12px', cursor: 'pointer' }}>⬅ Volver a los tickets</button>
                 <div style={{ display: 'flex', gap: '10px' }}>
                     {ticketSeleccionado.estado !== 'Cerrado' && (
                         <button onClick={(e) => handleCerrarTicket(ticketSeleccionado.canalId, e)} style={{ backgroundColor: '#e74c3c', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>🔒 Cerrar Ticket</button>
                     )}
                 </div>
             </div>
             <h2>Historial de #{ticketSeleccionado.creadorNombre}</h2>
             <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Motivo: <strong>{ticketSeleccionado.motivo || 'Sin especificar'}</strong> | Estado: {ticketSeleccionado.estado}</p>
             <div className="chat-box">
               {mensajes.length === 0 ? <p className="chat-vacio">No hay mensajes registrados en este ticket.</p> : mensajes.map((msg, index) => (
                   <div key={index} className={`mensaje ${msg.usuario === 'Admin' || msg.usuario === 'Sokyo' ? 'mod' : ''}`}>
                     <span className="mensaje-autor">{msg.usuario || 'Usuario Desconocido'}</span>
                     <span className="mensaje-contenido">{msg.contenido}</span>
                   </div>
               ))}
             </div>
             {ticketSeleccionado.estado !== 'Cerrado' ? (
                 <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                 <input type="text" value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()} placeholder="Escribe una respuesta al ticket..." style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }} />
                 <button onClick={enviarMensaje} style={{ padding: '0 1.5rem', backgroundColor: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Enviar</button>
                 </div>
             ) : (
                 <div style={{ marginTop: '1rem', padding: '1rem', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-secondary)' }}>Este ticket está cerrado. No se pueden enviar más mensajes.</div>
             )}
           </div>
        )}

        {/* --- VISTA 3: CONFIGURACIÓN (¡NUEVO!) --- */}
        {activeTab === 'config' && (
          <div className="config-view" style={{ padding: '20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            
            {configServidor ? (
              <div style={{ maxWidth: '600px' }}>
                <h3 style={{ marginBottom: '10px' }}>🏷️ Categorías de Tickets</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Añade o elimina los motivos que aparecerán en el menú desplegable de Discord cuando un usuario quiera abrir un ticket.
                </p>
                
                {/* Lista interactiva de motivos */}
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: '20px' }}>
                  {motivos.map((motivo, index) => (
                    <li key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', padding: '12px', borderRadius: '6px', marginBottom: '10px', border: '1px solid var(--border-color)' }}>
                      <strong>{motivo}</strong>
                      <button onClick={() => eliminarMotivo(motivo)} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Borrar
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Input para añadir nuevos motivos */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
                  <input 
                    type="text" 
                    value={nuevoMotivo} 
                    onChange={(e) => setNuevoMotivo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && agregarMotivo()}
                    placeholder="Ej: Dudas VIP, Reportar bug..."
                    style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
                  />
                  <button onClick={agregarMotivo} style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '0 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    + Añadir
                  </button>
                </div>

                <hr style={{ borderTop: '1px solid var(--border-color)', borderBottom: 'none', margin: '20px 0' }}/>

                {/* Botón para enviar todo al backend */}
                <button onClick={guardarCambiosConfig} style={{ width: '100%', backgroundColor: 'var(--accent-color)', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1em' }}>
                  💾 Guardar Cambios en Discord
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ fontSize: '1.2em', marginBottom: '10px' }}>⚠️ No se ha encontrado la configuración del servidor.</p>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Asegúrate de haber escrito el comando <strong>!sokyo</strong> en tu servidor de Discord al menos una vez para que la base de datos se inicie.
                </p>
              </div>
            )}

          </div>
        )}

        {/* --- VISTA 4: LOGS (Placeholder) --- */}
        {activeTab === 'logs' && (
          <div className="ticket-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <h2>🚧 Logs en desarrollo</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
              Aquí verás los registros internos del sistema próximamente.
            </p>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;