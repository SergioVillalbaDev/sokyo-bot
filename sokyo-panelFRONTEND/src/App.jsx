// src/App.jsx
import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState('tickets-gestion'); 
  
  // Controles de menús desplegables
  const [isTicketsMenuOpen, setIsTicketsMenuOpen] = useState(true);
  const [isConfigMenuOpen, setIsConfigMenuOpen] = useState(true); 
  const [isLogsMenuOpen, setIsLogsMenuOpen] = useState(false);
  
  const [ticketsReales, setTicketsReales] = useState([]);
  
  // Estados de Chat y Notas
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [nuevaNota, setNuevaNota] = useState(''); 

  // Estados de Configuración de Textos
  const [configServidor, setConfigServidor] = useState(null);
  const [tituloMensaje, setTituloMensaje] = useState('');
  const [descripcionMensaje, setDescripcionMensaje] = useState('');
  const [footerMensaje, setFooterMensaje] = useState('');

  // Estados de Incidencias
  const [motivos, setMotivos] = useState([]);
  const [nuevoMotivo, setNuevoMotivo] = useState('');
  const [nuevaUrgencia, setNuevaUrgencia] = useState('Normal'); 
  const [urgencias, setUrgencias] = useState([]);
  const [nuevaUrgNombre, setNuevaUrgNombre] = useState('');
  const [nuevaUrgColor, setNuevaUrgColor] = useState('#e74c3c');
  const [nuevaUrgNivel, setNuevaUrgNivel] = useState(1);

  const [usuariosStats, setUsuariosStats] = useState([]);
  
  // Estados de Logs y Plan
  const [logsRegistrados, setLogsRegistrados] = useState([]);
  const [limiteLogs, setLimiteLogs] = useState(50);
  const [esPremium, setEsPremium] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    if (activeTab === 'tickets-gestion') cargarTickets();
    else if (activeTab === 'tickets-config' || activeTab === 'config' || activeTab === 'config-textos') cargarConfiguracion();
    else if (activeTab === 'tickets-usuarios') cargarUsuariosStats();
    else if (activeTab.startsWith('logs-')) cargarLogs();
  }, [activeTab]);

  useEffect(() => {
    let intervalo;
    if (ticketSeleccionado && activeTab === 'tickets-gestion') {
      intervalo = setInterval(() => {
        fetch(`http://192.168.1.168:3000/api/mensajes/${ticketSeleccionado.canalId}`)
          .then(res => res.json())
          .then(datos => setMensajes(datos))
          .catch(err => console.error(err));
      }, 3000); 
    }
    return () => clearInterval(intervalo);
  }, [ticketSeleccionado, activeTab]);

  const cargarTickets = () => fetch('http://localhost:3000/api/tickets').then(res => res.json()).then(datos => setTicketsReales(datos));
  const cargarUsuariosStats = () => fetch('http://localhost:3000/api/usuarios/stats').then(res => res.json()).then(datos => setUsuariosStats(datos));
  
  const cargarLogs = () => {
    fetch('http://localhost:3000/api/logs')
      .then(res => res.json())
      .then(datos => {
          setLogsRegistrados(datos.logs || []);
          setLimiteLogs(datos.limite || 50);
          setEsPremium(datos.esPremium || false);
      })
      .catch(err => console.error(err));
  };

  const verMensajes = (ticket) => {
    fetch(`http://localhost:3000/api/mensajes/${ticket.canalId}`).then(res => res.json()).then(datos => { setMensajes(datos); setTicketSeleccionado(ticket); });
  };

  const cerrarMensajes = () => { setTicketSeleccionado(null); setMensajes([]); cargarTickets(); };

  const enviarMensaje = () => {
    if (nuevoMensaje.trim() === '') return; 
    fetch(`http://localhost:3000/api/mensajes/${ticketSeleccionado.canalId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'Sokyo', contenido: nuevoMensaje }) }).then(() => setNuevoMensaje(''));
  };

  const agregarNotaInterna = async () => {
    if (nuevaNota.trim() === '') return;
    try {
        const res = await fetch(`http://localhost:3000/api/tickets/${ticketSeleccionado.canalId}/notas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contenido: nuevaNota, autor: 'Admin' }) });
        const data = await res.json();
        if (data.success) { setTicketSeleccionado(data.ticket); setTicketsReales(ticketsReales.map(t => t.canalId === data.ticket.canalId ? data.ticket : t)); setNuevaNota(''); }
    } catch (error) { console.error(error); }
  };

  const handleCerrarTicket = async (canalId, e) => {
    e.stopPropagation(); 
    if (!window.confirm('¿Cerrar ticket en Discord?')) return;
    const res = await fetch(`http://localhost:3000/api/tickets/${canalId}/cerrar`, { method: 'PUT' });
    if (res.ok) setTicketsReales(ticketsReales.map(t => t.canalId === canalId ? { ...t, estado: 'Cerrado' } : t));
  };

  const handleOcultarTicket = async (canalId, e) => {
    e.stopPropagation();
    if (!window.confirm('¿Ocultar del panel web?')) return;
    const res = await fetch(`http://localhost:3000/api/tickets/${canalId}/ocultar`, { method: 'PUT' });
    if (res.ok) { setTicketsReales(ticketsReales.filter(t => t.canalId !== canalId)); if (ticketSeleccionado?.canalId === canalId) cerrarMensajes(); }
  };

  const cargarConfiguracion = () => {
    fetch('http://localhost:3000/api/servidores').then(res => res.json()).then(datos => {
        if (datos && datos.length > 0) {
          setConfigServidor(datos[0]); setMotivos(datos[0].motivos || []);
          setUrgencias(datos[0].urgencias || [{ nombre: 'Urgente', color: '#e74c3c', nivel: 4 }, { nombre: 'Alta', color: '#e67e22', nivel: 3 }, { nombre: 'Normal', color: '#3498db', nivel: 2 }, { nombre: 'Baja', color: '#95a5a6', nivel: 1 }]);
          setTituloMensaje(datos[0].mensajeSoporteTitulo || '🎫 Soporte Técnico Activo'); setDescripcionMensaje(datos[0].mensajeSoporteDescripcion || 'Haz clic en el botón de abajo para abrir un ticket de soporte.'); setFooterMensaje(datos[0].footerPersonalizado || 'Sistema de Gestión Sokyo');
        }
    });
  };

  const agregarUrgencia = () => { if (nuevaUrgNombre.trim() !== '' && !urgencias.some(u => u.nombre.toLowerCase() === nuevaUrgNombre.trim().toLowerCase())) { setUrgencias([...urgencias, { nombre: nuevaUrgNombre.trim(), color: nuevaUrgColor, nivel: Number(nuevaUrgNivel) }]); setNuevaUrgNombre(''); setNuevaUrgNivel(1); } };
  const eliminarUrgencia = (nombreUrg) => setUrgencias(urgencias.filter(u => u.nombre !== nombreUrg));
  const agregarMotivo = () => { if (nuevoMotivo.trim() !== '' && !motivos.some(m => (typeof m === 'string' ? m : m.nombre).toLowerCase() === nuevoMotivo.trim().toLowerCase())) { setMotivos([...motivos, { nombre: nuevoMotivo.trim(), urgencia: nuevaUrgencia }]); setNuevoMotivo(''); } };
  const eliminarMotivo = (motivoABorrar) => setMotivos(motivos.filter(m => (typeof m === 'string' ? m : m.nombre) !== (typeof motivoABorrar === 'string' ? motivoABorrar : motivoABorrar.nombre)));

  const guardarCambiosConfig = async () => {
    if (!configServidor) return;
    const motivosFormateados = motivos.map(m => typeof m === 'string' ? { nombre: m, urgencia: 'Normal' } : m);
    await fetch(`http://localhost:3000/api/config/${configServidor.guildId}/motivos`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivos: motivosFormateados }) });
    await fetch(`http://localhost:3000/api/config/${configServidor.guildId}/urgencias`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urgencias: urgencias }) });
    alert('✅ ¡Sistema de Tickets actualizado en Discord exitosamente!'); setMotivos(motivosFormateados);
  };

  const guardarTextosConfig = async () => {
    if (!configServidor) return;
    const res = await fetch(`http://localhost:3000/api/config/${configServidor.guildId}/textos`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: tituloMensaje, descripcion: descripcionMensaje, footer: footerMensaje }) });
    if (res.ok) alert('✅ Textos actualizados!');
  };

  const getTicketsOrdenados = () => [...ticketsReales].sort((a, b) => (urgencias.find(u => u.nombre === b.prioridad)?.nivel || 0) - (urgencias.find(u => u.nombre === a.prioridad)?.nivel || 0));
  const getColorUrgencia = (nombreUrgencia) => urgencias.find(u => u.nombre === nombreUrgencia)?.color || '#34495e';
  const renderEstrellas = (puntuacion) => !puntuacion ? <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>Sin valorar</span> : <div style={{ display: 'flex', gap: '3px' }}>{[...Array(5)].map((_, i) => <span key={i} style={{ color: i < puntuacion ? '#f1c40f' : '#34495e', fontSize: '1.2em' }}>★</span>)}</div>;

  const obtenerParticipantes = (ticket) => {
      if (ticket.participantes && ticket.participantes.length > 0) return ticket.participantes;
      const avatarFallback = ticket.creadorAvatar || `https://ui-avatars.com/api/?name=${ticket.creadorNombre}&background=2c3e50&color=fff`;
      const implicados = [{ id: '1', username: ticket.creadorNombre, avatar: avatarFallback, rol: 'Creador' }];
      if (ticket.asignadoNombre) {
          implicados.push({ id: '2', username: ticket.asignadoNombre, avatar: `https://ui-avatars.com/api/?name=${ticket.asignadoNombre}&background=2c3e50&color=fff`, rol: 'Staff' });
      }
      return implicados;
  };

  const obtenerLogsFiltrados = () => {
      if (activeTab === 'logs-todos') return logsRegistrados;
      if (activeTab === 'logs-borrados') return logsRegistrados.filter(log => log.categoria === 'Mensajes Borrados');
      if (activeTab === 'logs-editados') return logsRegistrados.filter(log => log.categoria === 'Mensajes Editados');
      if (activeTab === 'logs-entradas') return logsRegistrados.filter(log => log.categoria === 'Entradas');
      if (activeTab === 'logs-salidas') return logsRegistrados.filter(log => log.categoria === 'Salidas');
      return logsRegistrados; 
  };

  return (
    <div className="app-container">
      <aside className="sidebar hide-on-print">
        <div className="brand">🤖 Sokyo Bot</div>
        <nav className="nav-menu">
          
          <div className="nav-group" style={{ marginBottom: '5px' }}>
            <div className="nav-item" onClick={() => setIsTicketsMenuOpen(!isTicketsMenuOpen)} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>🎫 Sistema de Tickets</span><span>{isTicketsMenuOpen ? '▼' : '▶'}</span>
            </div>
            {isTicketsMenuOpen && (
              <div className="nav-submenu" style={{ paddingLeft: '15px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div className={`nav-item ${activeTab === 'tickets-gestion' ? 'active' : ''}`} onClick={() => { setActiveTab('tickets-gestion'); setTicketSeleccionado(null); }}>📋 Gestión</div>
                <div className={`nav-item ${activeTab === 'tickets-usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('tickets-usuarios')}>👥 Registro de usuarios</div>
                <div className={`nav-item ${activeTab === 'tickets-config' ? 'active' : ''}`} onClick={() => setActiveTab('tickets-config')}>🛠️ Ajustes de Incidencias</div>
              </div>
            )}
          </div>
          
          <div className="nav-group" style={{ marginBottom: '5px' }}>
            <div className="nav-item" onClick={() => setIsLogsMenuOpen(!isLogsMenuOpen)} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>📜 Logs del Bot</span><span>{isLogsMenuOpen ? '▼' : '▶'}</span>
            </div>
            {isLogsMenuOpen && (
              <div className="nav-submenu" style={{ paddingLeft: '15px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div className={`nav-item ${activeTab === 'logs-todos' ? 'active' : ''}`} onClick={() => setActiveTab('logs-todos')}>🌐 Todos los eventos</div>
                <div className={`nav-item ${activeTab === 'logs-borrados' ? 'active' : ''}`} onClick={() => setActiveTab('logs-borrados')}>🗑️ Mensajes Eliminados</div>
                <div className={`nav-item ${activeTab === 'logs-editados' ? 'active' : ''}`} onClick={() => setActiveTab('logs-editados')}>✏️ Mensajes Editados</div>
                <div className={`nav-item ${activeTab === 'logs-entradas' ? 'active' : ''}`} onClick={() => setActiveTab('logs-entradas')}>👋 Entradas al Servidor</div>
                <div className={`nav-item ${activeTab === 'logs-salidas' ? 'active' : ''}`} onClick={() => setActiveTab('logs-salidas')}>🚶‍♂️ Salidas del Servidor</div>
              </div>
            )}
          </div>

          <div className="nav-group" style={{ marginBottom: '5px' }}>
            <div className="nav-item" onClick={() => setIsConfigMenuOpen(!isConfigMenuOpen)} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>⚙️ Configuración</span><span>{isConfigMenuOpen ? '▼' : '▶'}</span>
            </div>
            {isConfigMenuOpen && (
              <div className="nav-submenu" style={{ paddingLeft: '15px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div className={`nav-item ${activeTab === 'config-textos' ? 'active' : ''}`} onClick={() => setActiveTab('config-textos')}>📝 Configuración de Textos</div>
                <div className={`nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>🔌 Módulos del Bot</div>
              </div>
            )}
          </div>

        </nav>
      </aside>

      <main className="main-content print-full-width">
        <header className="header hide-on-print">
          <div>
            <h1>
              {activeTab === 'tickets-gestion' && 'Gestión de Tickets'}
              {activeTab === 'tickets-usuarios' && 'Registro de Usuarios'}
              {activeTab === 'tickets-config' && 'Ajustes de Incidencias'}
              {activeTab === 'config-textos' && 'Configuración de Textos'}
              {activeTab === 'config' && 'Configuración General'}
              {activeTab.startsWith('logs') && 'Registro de Auditoría'}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {activeTab === 'tickets-usuarios' ? 'Estadísticas y recuento global de los usuarios en tu servidor.' : 
               activeTab === 'tickets-config' ? 'Configura las reglas, prioridades y motivos de los tickets.' :
               activeTab === 'config-textos' ? 'Personaliza los títulos y descripciones de marca blanca para el bot.' :
               activeTab.startsWith('logs') ? 'Supervisa el funcionamiento interno y eventos clave del servidor.' : 
               activeTab === 'config' ? 'Activa o desactiva módulos globales del bot.' :
               'Administra las solicitudes activas de tu servidor.'}
            </p>
          </div>
          <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>{isDark ? '☀️ Claro' : '🌙 Oscuro'}</button>
        </header>

        {/* --- VISTA: GESTIÓN DE TICKETS --- */}
        {activeTab === 'tickets-gestion' && !ticketSeleccionado && (
          <div className="tickets-grid">
            {getTicketsOrdenados().map((ticket, index) => {
              const borderHex = getColorUrgencia(ticket.prioridad);
              return (
                <div className="ticket-card" key={index} style={{ borderTop: `4px solid ${borderHex}`, position: 'relative' }}>
                  <div className="ticket-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span className="ticket-id" style={{ fontWeight: 'bold', fontSize: '1.1em', color: 'var(--text-primary)' }}>{ticket.titulo || ticket.motivo || 'Ticket de Soporte'}</span>
                    <span style={{ fontSize: '0.75em', padding: '4px 10px', borderRadius: '12px', backgroundColor: borderHex, color: '#fff', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{ticket.prioridad || 'Normal'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        
                        {/* AQUI ESTÁ LA FOTO EN LA TARJETA */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <img src={ticket.creadorAvatar || `https://ui-avatars.com/api/?name=${ticket.creadorNombre}&background=2c3e50&color=fff`} alt="avatar" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                            <strong>{ticket.creadorNombre}</strong>
                        </div>

                        <span>🏷️ <em>{ticket.motivo}</em></span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'flex-start', paddingBottom: '4px', borderBottom: '1px dashed var(--border-color)' }}>
                        <span>🛡️ Atendido por: {ticket.asignadoNombre ? <strong style={{ color: 'var(--accent-color)' }}>{ticket.asignadoNombre}</strong> : <em style={{ opacity: 0.6 }}>Sin reclamar</em>}</span>
                     </div>
                  </div>
                  {ticket.descripcion && <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'var(--bg-main)', borderRadius: '6px', fontSize: '0.9em', fontStyle: 'italic', borderLeft: `3px solid ${borderHex}` }}>"{ticket.descripcion.substring(0, 60)}..."</div>}
                  {ticket.estado === 'Cerrado' && <div style={{ marginBottom: '15px', backgroundColor: 'rgba(241, 196, 15, 0.1)', padding: '10px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(241, 196, 15, 0.3)' }}><span style={{ fontSize: '0.75em', color: '#f1c40f', fontWeight: 'bold' }}>VALORACIÓN:</span>{renderEstrellas(ticket.valoracionCSAT)}</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="btn-view" onClick={() => verMensajes(ticket)} style={{ width: '100%', padding: '8px', borderRadius: '5px' }}>💬 Ver Conversación</button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {ticket.estado !== 'Cerrado' && <button onClick={(e) => handleCerrarTicket(ticket.canalId, e)} style={{ flex: 1, backgroundColor: '#e74c3c', color: 'white', padding: '8px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>🔒 Cerrar</button>}
                        <button onClick={(e) => handleOcultarTicket(ticket.canalId, e)} style={{ flex: 1, backgroundColor: '#34495e', color: 'white', padding: '8px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>🗑️ Ocultar</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- VISTA: CHAT (3 COLUMNAS) --- */}
        {activeTab === 'tickets-gestion' && ticketSeleccionado && (
           <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
             <div className="hide-on-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)' }}>
                 <div><button onClick={cerrarMensajes} style={{ padding: '8px 15px', cursor: 'pointer', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontWeight: 'bold', marginRight: '15px' }}>⬅ Volver</button><span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>Ticket: {ticketSeleccionado.titulo || ticketSeleccionado.creadorNombre}</span></div>
                 {ticketSeleccionado.estado !== 'Cerrado' && <button onClick={(e) => handleCerrarTicket(ticketSeleccionado.canalId, e)} style={{ backgroundColor: '#e74c3c', color: 'white', padding: '8px 15px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🔒 Cerrar Ticket</button>}
             </div>
             <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flexWrap: 'wrap' }}>
                 <div className="hide-on-print" style={{ flex: '1 1 20%', minWidth: '220px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: 'rgba(52, 152, 219, 0.1)', padding: '15px', borderBottom: '1px solid var(--accent-color)' }}><h3 style={{ margin: 0, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1em' }}>👥 Implicados</h3></div>
                    <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' }}>
                        {obtenerParticipantes(ticketSeleccionado).map((p, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-main)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <img src={p.avatar} alt="avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}><strong style={{ fontSize: '0.95em', color: 'var(--text-primary)' }}>{p.username}</strong><span style={{ fontSize: '0.75em', color: 'var(--text-secondary)' }}>{p.rol || 'Usuario'}</span></div>
                            </div>
                        ))}
                    </div>
                 </div>
                 <div style={{ flex: '2 1 40%', display: 'flex', flexDirection: 'column', minWidth: '350px' }}>
                     {ticketSeleccionado.descripcion && <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '15px', borderLeft: '4px solid var(--accent-color)' }}><strong style={{ display: 'block', marginBottom: '5px', color: 'var(--accent-color)' }}>Asunto Inicial:</strong><p style={{ margin: 0, fontStyle: 'italic', lineHeight: '1.5' }}>{ticketSeleccionado.descripcion}</p></div>}
                     <div className="chat-box" style={{ flex: 1, marginBottom: '15px', minHeight: '400px' }}>
                        {mensajes.length === 0 ? <p className="chat-vacio" style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '50px' }}>No hay mensajes registrados en este ticket.</p> : (
                            mensajes.map((msg, index) => (
                                <div key={index} className={`mensaje ${msg.usuario === 'Admin' || msg.usuario === 'Sokyo' ? 'mod' : ''}`}><span className="mensaje-autor" style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>{msg.usuario || 'Usuario Desconocido'}</span>{msg.contenido && <span className="mensaje-contenido">{msg.contenido}</span>}</div>
                            ))
                        )}
                     </div>
                     {ticketSeleccionado.estado !== 'Cerrado' ? (
                         <div className="hide-on-print" style={{ display: 'flex', gap: '10px' }}><input type="text" value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()} placeholder="Escribe una respuesta al ticket..." style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }} /><button onClick={enviarMensaje} style={{ padding: '0 20px', backgroundColor: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Enviar</button></div>
                     ) : <div className="hide-on-print" style={{ padding: '15px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-secondary)' }}>Este ticket está cerrado.</div>}
                 </div>
                 <div className="hide-on-print" style={{ flex: '1 1 25%', minWidth: '250px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid #f39c12', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: 'rgba(243, 156, 18, 0.1)', padding: '15px', borderBottom: '1px solid #f39c12' }}><h3 style={{ margin: 0, color: '#f39c12', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1em' }}>🕵️‍♂️ Notas Internas</h3><p style={{ margin: '5px 0 0 0', fontSize: '0.8em', color: 'var(--text-secondary)' }}>Visibles solo para el Staff web.</p></div>
                    <div style={{ padding: '15px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '200px' }}>
                        {ticketSeleccionado.notasInternas && ticketSeleccionado.notasInternas.length > 0 ? (
                            ticketSeleccionado.notasInternas.map((nota, i) => (
                                <div key={i} style={{ backgroundColor: 'var(--bg-main)', borderLeft: '3px solid #f39c12', padding: '10px 12px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}><div style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}><strong>{nota.autor}</strong><span>{new Date(nota.fecha).toLocaleDateString()}</span></div><div style={{ fontSize: '0.9em', lineHeight: '1.4' }}>{nota.contenido}</div></div>
                            ))
                        ) : <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>No hay anotaciones privadas.</p>}
                    </div>
                    <div style={{ padding: '15px', borderTop: '1px dashed var(--border-color)', backgroundColor: 'var(--bg-main)', display: 'flex', flexDirection: 'column', gap: '10px' }}><textarea value={nuevaNota} onChange={(e) => setNuevaNota(e.target.value)} placeholder="Añade un apunte secreto..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', resize: 'vertical', minHeight: '70px', outline: 'none' }}></textarea><button onClick={agregarNotaInterna} style={{ backgroundColor: '#f39c12', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>+ Guardar Nota</button></div>
                 </div>
             </div>
           </div>
        )}

        {/* --- VISTA: REGISTRO DE USUARIOS --- */}
        {activeTab === 'tickets-usuarios' && (
          <div className="usuarios-view">
            {usuariosStats.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No hay datos de usuarios registrados.</p> : (
              <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead><tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}><th style={{ padding: '15px' }}>Usuario</th><th style={{ padding: '15px' }}>Total Tickets</th><th style={{ padding: '15px' }}>Tickets Abiertos</th><th style={{ padding: '15px' }}>Rating Medio</th><th style={{ padding: '15px' }}>Última Actividad</th></tr></thead>
                  <tbody>
                    {usuariosStats.map((user, index) => (
                      <tr key={user._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        
                        {/* AQUI ESTA LA FOTO EN LA TABLA DE USUARIOS */}
                        <td style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.nombre}&background=2c3e50&color=fff`} alt="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                            <strong>{user.nombre}</strong>
                        </td>

                        <td style={{ padding: '15px' }}><span style={{ backgroundColor: 'var(--bg-main)', padding: '5px 10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>{user.totalTickets}</span></td>
                        <td style={{ padding: '15px' }}>{user.ticketsAbiertos > 0 ? <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>{user.ticketsAbiertos} abierto(s)</span> : <span style={{ color: '#2ecc71' }}>Todo cerrado</span>}</td>
                        <td style={{ padding: '15px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{renderEstrellas(Math.round(user.ratingMedio || 0))}<span style={{ fontSize: '0.9em', fontWeight: 'bold', color: user.ratingMedio ? '#f1c40f' : 'var(--text-secondary)' }}>{user.ratingMedio ? user.ratingMedio.toFixed(1) : '0.0'}</span></div></td>
                        <td style={{ padding: '15px', color: 'var(--text-secondary)', fontSize: '0.9em' }}>{user.ultimoTicket ? new Date(user.ultimoTicket).toLocaleDateString() : 'Desconocida'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- VISTA: CONFIGURACIÓN DE TEXTOS --- */}
        {activeTab === 'config-textos' && configServidor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '20px 25px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
               <div><h2 style={{ margin: 0, fontSize: '1.4em' }}>Marca Blanca</h2><p style={{ margin: '5px 0 0 0', color: 'var(--text-secondary)' }}>Personaliza los textos del mensaje incrustado (Embed).</p></div>
               <button onClick={guardarTextosConfig} style={{ backgroundColor: 'var(--accent-color)', color: 'white', padding: '12px 25px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1em', boxShadow: '0 4px 12px rgba(41, 128, 185, 0.3)' }}>💾 Guardar Textos</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '25px' }}>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1em' }}>✏️ Editar Contenido</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}><label style={{ fontSize: '0.85em', fontWeight: 'bold' }}>Título del Mensaje</label><input type="text" value={tituloMensaje} onChange={(e) => setTituloMensaje(e.target.value)} placeholder="Ej: 🎫 Soporte Técnico Activo" style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}><label style={{ fontSize: '0.85em', fontWeight: 'bold' }}>Descripción / Instrucciones</label><textarea value={descripcionMensaje} onChange={(e) => setDescripcionMensaje(e.target.value)} placeholder="Escribe las instrucciones..." style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none', minHeight: '120px', resize: 'vertical' }}></textarea></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}><label style={{ fontSize: '0.85em', fontWeight: 'bold' }}>Pie de Página (Footer)</label><input type="text" value={footerMensaje} onChange={(e) => setFooterMensaje(e.target.value)} placeholder="Ej: Sistema de Gestión" style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }} /></div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1em' }}>👀 Vista Previa (Mensaje de Discord)</h3>
                <div style={{ backgroundColor: '#2f3136', borderRadius: '4px', padding: '15px', borderLeft: '4px solid #5865F2', color: '#dcddde', fontFamily: 'sans-serif', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1.1em', marginBottom: '8px' }}>{tituloMensaje || 'Título del panel'}</div>
                  <div style={{ fontSize: '0.95em', whiteSpace: 'pre-wrap', marginBottom: '12px', color: '#b9bbbe' }}>{descripcionMensaje || 'Aquí aparecerán las instrucciones...'}</div>
                  <div style={{ fontSize: '0.75em', color: '#72767d', marginTop: '10px' }}>{footerMensaje || 'Pie de página'}</div>
                </div>
                <div style={{ marginTop: '15px', backgroundColor: '#4f545c', color: 'white', padding: '10px 18px', borderRadius: '4px', textAlign: 'center', fontSize: '0.9em', fontWeight: '600', maxWidth: '160px', opacity: 0.8, userSelect: 'none' }}>📩 Abrir Ticket</div>
              </div>
            </div>
          </div>
        )}

        {/* --- VISTA: AJUSTES DE INCIDENCIAS --- */}
        {activeTab === 'tickets-config' && configServidor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '20px 25px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
               <div><h2 style={{ margin: 0, fontSize: '1.4em' }}>Service Desk</h2><p style={{ margin: '5px 0 0 0', color: 'var(--text-secondary)' }}>Configura las reglas de enrutamiento y prioridades.</p></div>
               <button onClick={guardarCambiosConfig} style={{ backgroundColor: 'var(--accent-color)', color: 'white', padding: '12px 25px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1em', boxShadow: '0 4px 12px rgba(41, 128, 185, 0.3)' }}>💾 Guardar y Sincronizar</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '25px' }}>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>🚥 Niveles de Urgencia (SLA)</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', flex: 1, overflowY: 'auto', maxHeight: '350px' }}>
                  {urgencias.sort((a,b) => b.nivel - a.nivel).map((u, i) => (
                    <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', padding: '12px 16px', borderRadius: '8px', marginBottom: '10px', border: `1px solid ${u.color}40`, borderLeft: `4px solid ${u.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: u.color, boxShadow: `0 0 8px ${u.color}` }}></div><strong style={{ fontSize: '1.05em' }}>{u.nombre}</strong> <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>Nivel {u.nivel}</span></div>
                      <button onClick={() => eliminarUrgencia(u.nombre)} style={{ backgroundColor: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '1.2em' }}>✖</button>
                    </li>
                  ))}
                </ul>
                <div style={{ backgroundColor: 'var(--bg-main)', padding: '15px', borderRadius: '8px', border: '1px dashed var(--border-color)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="color" value={nuevaUrgColor} onChange={(e) => setNuevaUrgColor(e.target.value)} style={{ width: '38px', height: '38px', padding: '0', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }} />
                  <input type="text" value={nuevaUrgNombre} onChange={(e) => setNuevaUrgNombre(e.target.value)} placeholder="Ej: Mondongo" style={{ flex: 1, minWidth: '120px', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  <input type="number" value={nuevaUrgNivel} onChange={(e) => setNuevaUrgNivel(e.target.value)} min="1" max="1000" style={{ width: '80px', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  <button onClick={agregarUrgencia} style={{ backgroundColor: '#2ecc71', color: 'white', padding: '10px 15px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Añadir</button>
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>🏷️ Categorías del Menú</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', flex: 1, overflowY: 'auto', maxHeight: '350px' }}>
                  {motivos.map((motivo, index) => {
                    const nombre = typeof motivo === 'string' ? motivo : motivo.nombre; const urgencia = typeof motivo === 'string' ? 'Normal' : motivo.urgencia; const colorUrg = getColorUrgencia(urgencia);
                    return (
                      <li key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', padding: '12px 16px', borderRadius: '8px', marginBottom: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}><strong style={{ fontSize: '1.05em' }}>{nombre}</strong><span style={{ fontSize: '0.75em', backgroundColor: colorUrg, color: '#fff', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{urgencia}</span></div>
                        <button onClick={() => eliminarMotivo(motivo)} style={{ backgroundColor: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '1.2em' }}>✖</button>
                      </li>
                    );
                  })}
                </ul>
                <div style={{ backgroundColor: 'var(--bg-main)', padding: '15px', borderRadius: '8px', border: '1px dashed var(--border-color)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="text" value={nuevoMotivo} onChange={(e) => setNuevoMotivo(e.target.value)} placeholder="Ej: Fallo de Pago" style={{ flex: 1, minWidth: '150px', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  <select value={nuevaUrgencia} onChange={(e) => setNuevaUrgencia(e.target.value)} style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}>
                    {urgencias.map((u, i) => (<option key={i} value={u.nombre} style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}>{u.nombre}</option>))}
                  </select>
                  <button onClick={agregarMotivo} style={{ backgroundColor: '#2ecc71', color: 'white', padding: '10px 15px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Añadir</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VISTA: CONFIGURACIÓN GENERAL --- */}
        {activeTab === 'config' && (
          <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '3em', marginBottom: '15px' }}>🔌</div><h2>Módulos del Bot</h2><p style={{ color: 'var(--text-secondary)' }}>Activa o desactiva módulos globales.</p><div style={{ display: 'inline-block', padding: '10px 20px', backgroundColor: 'rgba(52, 152, 219, 0.1)', color: '#3498db', borderRadius: '8px', fontWeight: 'bold' }}>🚀 Próximamente en desarrollo</div>
          </div>
        )}

        {/* --- NUEVA VISTA FILTRADA DE LOGS --- */}
        {activeTab.startsWith('logs-') && (
          <div className="logs-view" style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '20px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>📜 Registro de Auditoría</h2>
                    <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0 0', fontSize: '0.9em' }}>Monitorizando la actividad del servidor en tiempo real.</p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-main)', padding: '8px 15px', borderRadius: '20px', border: `1px solid ${esPremium ? '#f1c40f' : 'var(--border-color)'}` }}>
                    <span style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>Capacidad: <strong style={{ color: 'var(--text-primary)' }}>{logsRegistrados.length} / {limiteLogs}</strong></span>
                    {esPremium ? (
                        <span style={{ fontSize: '0.75em', backgroundColor: 'rgba(241, 196, 15, 0.2)', color: '#f1c40f', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold' }}>⭐ Premium</span>
                    ) : (
                        <span style={{ fontSize: '0.75em', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Free Plan</span>
                    )}
                </div>
            </div>
            
            {obtenerLogsFiltrados().length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '3em', marginBottom: '10px' }}>📭</div>
                    No hay eventos registrados en esta categoría.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {obtenerLogsFiltrados().map((log, index) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', backgroundColor: 'var(--bg-main)', padding: '15px', borderRadius: '8px', borderLeft: `4px solid ${log.color}`, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <strong style={{ fontSize: '1.1em', color: log.color }}>{log.accion}</strong>
                                    <span style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>{new Date(log.fecha).toLocaleString('es-ES')}</span>
                                </div>
                                <div style={{ marginBottom: '5px' }}>👤 Usuario implicado: <strong>{log.usuario}</strong></div>
                                {log.detalles && <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{log.detalles}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

export default App;