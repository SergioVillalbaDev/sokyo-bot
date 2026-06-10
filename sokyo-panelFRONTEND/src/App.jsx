// src/App.jsx
import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [isDark, setIsDark] = useState(true);
  
  // Cambiamos el estado inicial a la sub-pestaña de gestión
  const [activeTab, setActiveTab] = useState('tickets-gestion'); 
  const [isTicketsMenuOpen, setIsTicketsMenuOpen] = useState(true); // Controla el desplegable
  
  const [ticketsReales, setTicketsReales] = useState([]);
  
  // Estados de Chat
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');

  // Estados de Configuración
  const [configServidor, setConfigServidor] = useState(null);
  const [motivos, setMotivos] = useState([]);
  const [nuevoMotivo, setNuevoMotivo] = useState('');

  // Estados del Registro de Usuarios
  const [usuariosStats, setUsuariosStats] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    if (activeTab === 'tickets-gestion') {
      cargarTickets();
    } else if (activeTab === 'config') {
      cargarConfiguracion();
    } else if (activeTab === 'tickets-usuarios') {
      cargarUsuariosStats();
    }
  }, [activeTab]);

  useEffect(() => {
    let intervalo;
    if (ticketSeleccionado && activeTab === 'tickets-gestion') {
      intervalo = setInterval(() => {
        fetch(`http://localhost:3000/api/mensajes/${ticketSeleccionado.canalId}`)
          .then((respuesta) => respuesta.json())
          .then((datos) => setMensajes(datos))
          .catch((error) => console.error('[Error 1006]', error));
      }, 3000); 
    }
    return () => clearInterval(intervalo);
  }, [ticketSeleccionado, activeTab]);

  // --- FUNCIONES DE TICKETS Y CHAT ---
  const cargarTickets = () => {
    fetch('http://localhost:3000/api/tickets')
      .then((respuesta) => respuesta.json())
      .then((datos) => setTicketsReales(datos))
      .catch((error) => console.error('[Error 1007]', error));
  };

  const cargarUsuariosStats = () => {
    fetch('http://localhost:3000/api/usuarios/stats')
      .then((respuesta) => respuesta.json())
      .then((datos) => setUsuariosStats(datos))
      .catch((error) => console.error('Error al cargar stats:', error));
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

  const descargarTicketTXT = () => {
    if (!ticketSeleccionado || mensajes.length === 0) {
      return alert('No hay mensajes en este ticket para descargar.');
    }

    let contenidoTxt = `=== TRANSCRIPCIÓN DEL TICKET ===\n`;
    contenidoTxt += `Usuario: ${ticketSeleccionado.creadorNombre}\n`;
    contenidoTxt += `Motivo: ${ticketSeleccionado.motivo || 'Sin especificar'}\n`;
    contenidoTxt += `Fecha de descarga: ${new Date().toLocaleString()}\n`;
    contenidoTxt += `=================================\n\n`;

    mensajes.forEach(msg => {
      const fecha = msg.fecha ? new Date(msg.fecha).toLocaleTimeString() : '';
      contenidoTxt += `[${fecha}] ${msg.usuario}:\n`;
      if (msg.contenido) contenidoTxt += `${msg.contenido}\n`;
      if (msg.imagenes && msg.imagenes.length > 0) {
        contenidoTxt += `[Adjuntos]: ${msg.imagenes.join(', ')}\n`;
      }
      contenidoTxt += `\n`; 
    });

    const blob = new Blob([contenidoTxt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticket-${ticketSeleccionado.creadorNombre}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const descargarTicketPDF = () => {
      // Activa el menú de impresión nativo del navegador, que permite guardar como PDF preservando el diseño y las fotos.
      window.print();
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
          setConfigServidor(datos[0]); 
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
      <aside className="sidebar hide-on-print">
        <div className="brand">🤖 Sokyo Bot</div>
        <nav className="nav-menu">
          
          {/* DESPLEGABLE DE TICKETS */}
          <div className="nav-group" style={{ marginBottom: '5px' }}>
            <div 
              className="nav-item" 
              onClick={() => setIsTicketsMenuOpen(!isTicketsMenuOpen)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>🎫 Sistema de Tickets</span>
              <span style={{ fontSize: '0.8em', transition: 'transform 0.3s', transform: isTicketsMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </div>
            
            {isTicketsMenuOpen && (
              <div className="nav-submenu" style={{ paddingLeft: '15px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div 
                  className={`nav-item ${activeTab === 'tickets-gestion' ? 'active' : ''}`} 
                  onClick={() => { setActiveTab('tickets-gestion'); setTicketSeleccionado(null); }}
                  style={{ fontSize: '0.9em', padding: '8px 15px' }}
                >
                  📋 Gestión
                </div>
                <div 
                  className={`nav-item ${activeTab === 'tickets-usuarios' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('tickets-usuarios')}
                  style={{ fontSize: '0.9em', padding: '8px 15px' }}
                >
                  👥 Registro de usuarios
                </div>
              </div>
            )}
          </div>

          <div className={`nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
            ⚙️ Configuración
          </div>
          <div className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
            📜 Logs del Bot
          </div>
        </nav>
      </aside>

      <main className="main-content print-full-width">
        <header className="header hide-on-print">
          <div>
            <h1>
              {activeTab === 'tickets-gestion' && 'Gestión de Tickets'}
              {activeTab === 'tickets-usuarios' && 'Registro de Usuarios'}
              {activeTab === 'config' && 'Configuración General'}
              {activeTab === 'logs' && 'Logs del Bot'}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {activeTab === 'tickets-usuarios' ? 'Estadísticas y recuento global de los usuarios en tu servidor.' : 'Administra las solicitudes y ajustes de tu servidor.'}
            </p>
          </div>
          <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>
            {isDark ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
          </button>
        </header>

        {/* --- VISTA 1.A: GESTIÓN DE TICKETS --- */}
        {activeTab === 'tickets-gestion' && !ticketSeleccionado && (
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

        {/* --- VISTA 1.B: HISTORIAL DE CHAT --- */}
        {activeTab === 'tickets-gestion' && ticketSeleccionado && (
           <div className="mensajes-view">
             
             {/* PANEL DE BOTONES MEJORADO */}
             <div className="hide-on-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                 <button className="btn-back" onClick={cerrarMensajes} style={{ padding: '8px 15px', cursor: 'pointer', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                    ⬅ Volver
                 </button>
                 
                 <div style={{ display: 'flex', gap: '10px' }}>
                     <button onClick={descargarTicketTXT} style={{ backgroundColor: '#3498db', color: 'white', padding: '8px 15px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                         📝 .TXT
                     </button>
                     <button onClick={descargarTicketPDF} style={{ backgroundColor: '#9b59b6', color: 'white', padding: '8px 15px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                         📄 PDF
                     </button>
                     
                     {ticketSeleccionado.estado !== 'Cerrado' && (
                         <button onClick={(e) => handleCerrarTicket(ticketSeleccionado.canalId, e)} style={{ backgroundColor: '#e74c3c', color: 'white', padding: '8px 15px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                            🔒 Cerrar Ticket
                         </button>
                     )}
                 </div>
             </div>

             <h2>Historial de #{ticketSeleccionado.creadorNombre}</h2>
             <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Motivo: <strong>{ticketSeleccionado.motivo || 'Sin especificar'}</strong> | Estado: {ticketSeleccionado.estado}</p>
             
             <div className="chat-box">
                {mensajes.length === 0 ? (
                    <p className="chat-vacio">No hay mensajes registrados en este ticket.</p>
                ) : (
                    mensajes.map((msg, index) => (
                        <div key={index} className={`mensaje ${msg.usuario === 'Admin' || msg.usuario === 'Sokyo' ? 'mod' : ''}`}>
                            <span className="mensaje-autor">{msg.usuario || 'Usuario Desconocido'}</span>
                            
                            {/* Texto del mensaje */}
                            {msg.contenido && (
                                <span className="mensaje-contenido">{msg.contenido}</span>
                            )}

                            {/* Renderizado dinámico de imágenes */}
                            {msg.imagenes && msg.imagenes.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                                    {msg.imagenes.map((url, imgIndex) => (
                                        <a href={url} target="_blank" rel="noopener noreferrer" key={imgIndex}>
                                            <img 
                                                src={url} 
                                                alt="Adjunto del ticket" 
                                                style={{ 
                                                    maxWidth: '100%', 
                                                    maxHeight: '250px', 
                                                    borderRadius: '8px', 
                                                    border: '1px solid var(--border-color)',
                                                    cursor: 'pointer',
                                                    objectFit: 'contain'
                                                }} 
                                            />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
             </div>

             {ticketSeleccionado.estado !== 'Cerrado' ? (
                 <div className="hide-on-print" style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                    <input type="text" value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()} placeholder="Escribe una respuesta al ticket..." style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }} />
                    <button onClick={enviarMensaje} style={{ padding: '0 1.5rem', backgroundColor: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Enviar</button>
                 </div>
             ) : (
                 <div className="hide-on-print" style={{ marginTop: '1rem', padding: '1rem', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-secondary)' }}>Este ticket está cerrado. No se pueden enviar más mensajes.</div>
             )}
           </div>
        )}

        {/* --- VISTA 2: REGISTRO DE USUARIOS --- */}
        {activeTab === 'tickets-usuarios' && (
          <div className="usuarios-view">
            {usuariosStats.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No hay datos de usuarios registrados todavía.</p>
            ) : (
              <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '15px', fontWeight: 'bold' }}>Usuario</th>
                      <th style={{ padding: '15px', fontWeight: 'bold' }}>Total Tickets</th>
                      <th style={{ padding: '15px', fontWeight: 'bold' }}>Tickets Abiertos</th>
                      <th style={{ padding: '15px', fontWeight: 'bold' }}>Última Actividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosStats.map((user, index) => (
                      <tr key={user._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                           <div style={{ width: '30px', height: '30px', backgroundColor: 'var(--accent-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                              {user.nombre.charAt(0).toUpperCase()}
                           </div>
                           <strong>{user.nombre}</strong>
                        </td>
                        <td style={{ padding: '15px' }}>
                           <span style={{ backgroundColor: 'var(--bg-main)', padding: '5px 10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                             {user.totalTickets}
                           </span>
                        </td>
                        <td style={{ padding: '15px' }}>
                           {user.ticketsAbiertos > 0 ? (
                             <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>{user.ticketsAbiertos} abierto(s)</span>
                           ) : (
                             <span style={{ color: '#2ecc71' }}>Todo cerrado</span>
                           )}
                        </td>
                        <td style={{ padding: '15px', color: 'var(--text-secondary)', fontSize: '0.9em' }}>
                          {user.ultimoTicket ? new Date(user.ultimoTicket).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Desconocida'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- VISTA 3: CONFIGURACIÓN --- */}
        {activeTab === 'config' && (
          <div className="config-view" style={{ padding: '20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            
            {configServidor ? (
              <div style={{ maxWidth: '600px' }}>
                <h3 style={{ marginBottom: '10px' }}>🏷️ Categorías de Tickets</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Añade o elimina los motivos que aparecerán en el menú desplegable de Discord cuando un usuario quiera abrir un ticket.
                </p>
                
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

        {/* --- VISTA 4: LOGS --- */}
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