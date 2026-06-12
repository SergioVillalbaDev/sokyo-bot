// src/App.jsx
import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState('tickets-gestion'); 
  const [isTicketsMenuOpen, setIsTicketsMenuOpen] = useState(true);
  const [isConfigMenuOpen, setIsConfigMenuOpen] = useState(true); // Controla el nuevo desplegable de configuración
  
  const [ticketsReales, setTicketsReales] = useState([]);
  
  // Estados de Chat y Notas
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [nuevaNota, setNuevaNota] = useState(''); 

  // Estados de Configuración de Textos (Marca Blanca)
  const [configServidor, setConfigServidor] = useState(null);
  const [tituloMensaje, setTituloMensaje] = useState('');
  const [descripcionMensaje, setDescripcionMensaje] = useState('');
  const [footerMensaje, setFooterMensaje] = useState('');

  // Estados de Incidencias
  const [motivos, setMotivos] = useState([]);
  const [nuevoMotivo, setNuevoMotivo] = useState('');
  const [nuevaUrgencia, setNuevaUrgencia] = useState('Normal'); 
  
  // Estados de Urgencias (SLAs)
  const [urgencias, setUrgencias] = useState([]);
  const [nuevaUrgNombre, setNuevaUrgNombre] = useState('');
  const [nuevaUrgColor, setNuevaUrgColor] = useState('#e74c3c');
  const [nuevaUrgNivel, setNuevaUrgNivel] = useState(1);

  const [usuariosStats, setUsuariosStats] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    if (activeTab === 'tickets-gestion') cargarTickets();
    else if (activeTab === 'tickets-config' || activeTab === 'config' || activeTab === 'config-textos') cargarConfiguracion();
    else if (activeTab === 'tickets-usuarios') cargarUsuariosStats();
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

  const cargarTickets = () => {
    fetch('http://localhost:3000/api/tickets')
      .then(res => res.json())
      .then(datos => setTicketsReales(datos));
  };

  const cargarUsuariosStats = () => {
    fetch('http://localhost:3000/api/usuarios/stats')
      .then(res => res.json())
      .then(datos => setUsuariosStats(datos));
  };

  const verMensajes = (ticket) => {
    fetch(`http://localhost:3000/api/mensajes/${ticket.canalId}`)
      .then(res => res.json())
      .then(datos => {
        setMensajes(datos);
        setTicketSeleccionado(ticket); 
      });
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
    .then(() => setNuevoMensaje(''));
  };

  const agregarNotaInterna = async () => {
    if (nuevaNota.trim() === '') return;
    try {
        const res = await fetch(`http://localhost:3000/api/tickets/${ticketSeleccionado.canalId}/notas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contenido: nuevaNota, autor: 'Admin' }) 
        });
        const data = await res.json();
        if (data.success) {
            setTicketSeleccionado(data.ticket); 
            setTicketsReales(ticketsReales.map(t => t.canalId === data.ticket.canalId ? data.ticket : t));
            setNuevaNota('');
        }
    } catch (error) {
        console.error('Error al añadir nota:', error);
    }
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
    if (res.ok) {
        setTicketsReales(ticketsReales.filter(t => t.canalId !== canalId));
        if (ticketSeleccionado?.canalId === canalId) cerrarMensajes();
    }
  };

  const cargarConfiguracion = () => {
    fetch('http://localhost:3000/api/servidores')
      .then(res => res.json())
      .then(datos => {
        if (datos && datos.length > 0) {
          setConfigServidor(datos[0]); 
          setMotivos(datos[0].motivos || []);
          setUrgencias(datos[0].urgencias || [
            { nombre: 'Urgente', color: '#e74c3c', nivel: 4 },
            { nombre: 'Alta', color: '#e67e22', nivel: 3 },
            { nombre: 'Normal', color: '#3498db', nivel: 2 },
            { nombre: 'Baja', color: '#95a5a6', nivel: 1 }
          ]);
          // Inicializamos los textos de Marca Blanca que vienen de la BBDD
          setTituloMensaje(datos[0].mensajeSoporteTitulo || '🎫 Soporte Técnico Activo');
          setDescripcionMensaje(datos[0].mensajeSoporteDescripcion || 'Haz clic en el botón de abajo para abrir un ticket de soporte.');
          setFooterMensaje(datos[0].footerPersonalizado || 'Sistema de Gestión Sokyo');
        }
      });
  };

  const agregarUrgencia = () => {
    if (nuevaUrgNombre.trim() !== '') {
      if (!urgencias.some(u => u.nombre.toLowerCase() === nuevaUrgNombre.trim().toLowerCase())) {
        setUrgencias([...urgencias, { nombre: nuevaUrgNombre.trim(), color: nuevaUrgColor, nivel: Number(nuevaUrgNivel) }]);
        setNuevaUrgNombre('');
        setNuevaUrgNivel(1);
      } else alert('Ese nombre de urgencia ya existe.');
    }
  };

  const eliminarUrgencia = (nombreUrg) => { setUrgencias(urgencias.filter(u => u.nombre !== nombreUrg)); };

  const agregarMotivo = () => {
    if (nuevoMotivo.trim() !== '') {
      const existe = motivos.some(m => (typeof m === 'string' ? m : m.nombre).toLowerCase() === nuevoMotivo.trim().toLowerCase());
      if (!existe) {
        setMotivos([...motivos, { nombre: nuevoMotivo.trim(), urgencia: nuevaUrgencia }]);
        setNuevoMotivo('');
      } else alert('Esa categoría ya existe.');
    }
  };

  const eliminarMotivo = (motivoABorrar) => {
    setMotivos(motivos.filter(m => (typeof m === 'string' ? m : m.nombre) !== (typeof motivoABorrar === 'string' ? motivoABorrar : motivoABorrar.nombre)));
  };

  const guardarCambiosConfig = async () => {
    if (!configServidor) return;
    const motivosFormateados = motivos.map(m => typeof m === 'string' ? { nombre: m, urgencia: 'Normal' } : m);

    await fetch(`http://localhost:3000/api/config/${configServidor.guildId}/motivos`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivos: motivosFormateados })
    });
    await fetch(`http://localhost:3000/api/config/${configServidor.guildId}/urgencias`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urgencias: urgencias })
    });
    alert('✅ ¡Sistema de Tickets actualizado en Discord exitosamente!');
    setMotivos(motivosFormateados);
  };

  // --- NUEVA FUNCIÓN: Guardar Textos de Personalización ---
  const guardarTextosConfig = async () => {
    if (!configServidor) return;
    try {
      const respuesta = await fetch(`http://localhost:3000/api/config/${configServidor.guildId}/textos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: tituloMensaje,
          descripcion: descripcionMensaje,
          footer: footerMensaje
        })
      });
      if (respuesta.ok) {
        alert('✅ ¡Textos del panel de soporte actualizados correctamente!');
      } else {
        alert('❌ Hubo un error al guardar los textos personalizados.');
      }
    } catch (error) {
      console.error('Error al guardar textos:', error);
    }
  };

  const getTicketsOrdenados = () => {
    return [...ticketsReales].sort((a, b) => {
      const nivelA = urgencias.find(u => u.nombre === a.prioridad)?.nivel || 0;
      const nivelB = urgencias.find(u => u.nombre === b.prioridad)?.nivel || 0;
      return nivelB - nivelA;
    });
  };

  const getColorUrgencia = (nombreUrgencia) => {
    const urg = urgencias.find(u => u.nombre === nombreUrgencia);
    return urg ? urg.color : '#34495e';
  };

  const renderEstrellas = (puntuacion) => {
    if (!puntuacion) return <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>Sin valorar</span>;
    return (
        <div style={{ display: 'flex', gap: '3px' }}>
            {[...Array(5)].map((_, i) => (
                <span key={i} style={{ color: i < puntuacion ? '#f1c40f' : '#34495e', fontSize: '1.2em' }}>★</span>
            ))}
        </div>
    );
  };

  return (
    <div className="app-container">
      <aside className="sidebar hide-on-print">
        <div className="brand">🤖 Sokyo Bot</div>
        <nav className="nav-menu">
          
          {/* DESPLEGABLE 1: SISTEMA DE TICKETS */}
          <div className="nav-group" style={{ marginBottom: '5px' }}>
            <div className="nav-item" onClick={() => setIsTicketsMenuOpen(!isTicketsMenuOpen)} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>🎫 Sistema de Tickets</span>
              <span>{isTicketsMenuOpen ? '▼' : '▶'}</span>
            </div>
            {isTicketsMenuOpen && (
              <div className="nav-submenu" style={{ paddingLeft: '15px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div className={`nav-item ${activeTab === 'tickets-gestion' ? 'active' : ''}`} onClick={() => { setActiveTab('tickets-gestion'); setTicketSeleccionado(null); }}>📋 Gestión</div>
                <div className={`nav-item ${activeTab === 'tickets-usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('tickets-usuarios')}>👥 Registro de usuarios</div>
                <div className={`nav-item ${activeTab === 'tickets-config' ? 'active' : ''}`} onClick={() => setActiveTab('tickets-config')}>🛠️ Ajustes de Incidencias</div>
              </div>
            )}
          </div>
          
          {/* DESPLEGABLE 2: CONFIGURACIÓN GENERAL (NUEVO REORGANIZADO) */}
          <div className="nav-group" style={{ marginBottom: '5px' }}>
            <div className="nav-item" onClick={() => setIsConfigMenuOpen(!isConfigMenuOpen)} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>⚙️ Configuración</span>
              <span>{isConfigMenuOpen ? '▼' : '▶'}</span>
            </div>
            {isConfigMenuOpen && (
              <div className="nav-submenu" style={{ paddingLeft: '15px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div className={`nav-item ${activeTab === 'config-textos' ? 'active' : ''}`} onClick={() => setActiveTab('config-textos')}>📝 Configuración de Textos</div>
                <div className={`nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>🔌 Módulos del Bot</div>
              </div>
            )}
          </div>

          <div className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>📜 Logs del Bot</div>
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
              {activeTab === 'logs' && 'Logs del Sistema'}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {activeTab === 'tickets-usuarios' ? 'Estadísticas y recuento global de los usuarios en tu servidor.' : 
               activeTab === 'tickets-config' ? 'Configura las reglas, prioridades y motivos de los tickets.' :
               activeTab === 'config-textos' ? 'Personaliza los títulos y descripciones de marca blanca para el bot.' :
               activeTab === 'logs' ? 'Supervisa el funcionamiento y los errores internos del bot.' : 
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
                    <span className="ticket-id" style={{ fontWeight: 'bold' }}>#{ticket.creadorNombre || ticket.canalId.substring(0, 5)}</span>
                    <span style={{ fontSize: '0.75em', padding: '4px 10px', borderRadius: '12px', backgroundColor: borderHex, color: '#fff', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                      {ticket.prioridad || 'Normal'}
                    </span>
                  </div>
                  <div className="ticket-user" style={{ marginBottom: '8px' }}>👤 Usuario: <strong>{ticket.creadorNombre}</strong></div>
                  <div className="ticket-reason" style={{ marginBottom: '15px', color: 'var(--text-secondary)' }}>🏷️ Motivo: <em>{ticket.motivo}</em></div>
                  
                  {ticket.estado === 'Cerrado' && (
                    <div style={{ marginBottom: '15px', backgroundColor: 'rgba(241, 196, 15, 0.1)', padding: '10px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(241, 196, 15, 0.3)' }}>
                        <span style={{ fontSize: '0.75em', color: '#f1c40f', fontWeight: 'bold' }}>VALORACIÓN:</span>
                        {renderEstrellas(ticket.valoracionCSAT)}
                    </div>
                  )}

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

        {/* --- VISTA: CHAT Y NOTAS INTERNAS --- */}
        {activeTab === 'tickets-gestion' && ticketSeleccionado && (
           <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
             <div className="hide-on-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)' }}>
                 <div>
                    <button onClick={cerrarMensajes} style={{ padding: '8px 15px', cursor: 'pointer', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontWeight: 'bold', marginRight: '15px' }}>⬅ Volver</button>
                    <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>Ticket #{ticketSeleccionado.creadorNombre}</span>
                 </div>
                 {ticketSeleccionado.estado !== 'Cerrado' && (
                     <button onClick={(e) => handleCerrarTicket(ticketSeleccionado.canalId, e)} style={{ backgroundColor: '#e74c3c', color: 'white', padding: '8px 15px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🔒 Cerrar Ticket</button>
                 )}
             </div>

             <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flexWrap: 'wrap' }}>
                 <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', minWidth: '300px' }}>
                     <div className="chat-box" style={{ flex: 1, marginBottom: '15px', minHeight: '400px' }}>
                        {mensajes.length === 0 ? (
                            <p className="chat-vacio" style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '50px' }}>No hay mensajes registrados en este ticket.</p>
                        ) : (
                            mensajes.map((msg, index) => (
                                <div key={index} className={`mensaje ${msg.usuario === 'Admin' || msg.usuario === 'Sokyo' ? 'mod' : ''}`}>
                                    <span className="mensaje-autor" style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>{msg.usuario || 'Usuario Desconocido'}</span>
                                    {msg.contenido && <span className="mensaje-contenido">{msg.contenido}</span>}
                                </div>
                            ))
                        )}
                     </div>
                     {ticketSeleccionado.estado !== 'Cerrado' ? (
                         <div className="hide-on-print" style={{ display: 'flex', gap: '10px' }}>
                            <input type="text" value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()} placeholder="Escribe una respuesta al ticket..." style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }} />
                            <button onClick={enviarMensaje} style={{ padding: '0 20px', backgroundColor: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Enviar</button>
                         </div>
                     ) : (
                         <div className="hide-on-print" style={{ padding: '15px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-secondary)' }}>Este ticket está cerrado.</div>
                     )}
                 </div>

                 <div className="hide-on-print" style={{ flex: '1 1 30%', minWidth: '280px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid #f39c12', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: 'rgba(243, 156, 18, 0.1)', padding: '15px', borderBottom: '1px solid #f39c12' }}>
                        <h3 style={{ margin: 0, color: '#f39c12', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1em' }}>🕵️‍♂️ Notas Internas</h3>
                        <p style={{ margin: '5px 0 0 0', fontSize: '0.8em', color: 'var(--text-secondary)' }}>Visibles solo para el Staff web.</p>
                    </div>
                    <div style={{ padding: '15px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '200px' }}>
                        {ticketSeleccionado.notasInternas && ticketSeleccionado.notasInternas.length > 0 ? (
                            ticketSeleccionado.notasInternas.map((nota, i) => (
                                <div key={i} style={{ backgroundColor: 'var(--bg-main)', borderLeft: '3px solid #f39c12', padding: '10px 12px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                    <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                                        <strong>{nota.autor}</strong>
                                        <span>{new Date(nota.fecha).toLocaleDateString()}</span>
                                    </div>
                                    <div style={{ fontSize: '0.9em', lineHeight: '1.4' }}>{nota.contenido}</div>
                                </div>
                            ))
                        ) : (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>No hay anotaciones privadas.</p>
                        )}
                    </div>
                    <div style={{ padding: '15px', borderTop: '1px dashed var(--border-color)', backgroundColor: 'var(--bg-main)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <textarea value={nuevaNota} onChange={(e) => setNuevaNota(e.target.value)} placeholder="Añade un apunte secreto..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', resize: 'vertical', minHeight: '70px', outline: 'none' }}></textarea>
                        <button onClick={agregarNotaInterna} style={{ backgroundColor: '#f39c12', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>+ Guardar Nota</button>
                    </div>
                 </div>
             </div>
           </div>
        )}

        {/* --- VISTA: REGISTRO DE USUARIOS --- */}
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
                      <th style={{ padding: '15px', fontWeight: 'bold' }}>Rating Medio (CSAT)</th>
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
                           <span style={{ backgroundColor: 'var(--bg-main)', padding: '5px 10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>{user.totalTickets}</span>
                        </td>
                        <td style={{ padding: '15px' }}>
                           {user.ticketsAbiertos > 0 ? (
                             <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>{user.ticketsAbiertos} abierto(s)</span>
                           ) : (
                             <span style={{ color: '#2ecc71' }}>Todo cerrado</span>
                           )}
                        </td>
                        <td style={{ padding: '15px' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                               {renderEstrellas(Math.round(user.ratingMedio || 0))}
                               <span style={{ fontSize: '0.9em', fontWeight: 'bold', color: user.ratingMedio ? '#f1c40f' : 'var(--text-secondary)' }}>
                                   {user.ratingMedio ? user.ratingMedio.toFixed(1) : '0.0'}
                               </span>
                           </div>
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

        {/* --- VISTA NUEVA: CONFIGURACIÓN DE TEXTOS (MARCA BLANCA) --- */}
        {activeTab === 'config-textos' && configServidor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '20px 25px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
               <div>
                  <h2 style={{ margin: 0, fontSize: '1.4em' }}>Marca Blanca</h2>
                  <p style={{ margin: '5px 0 0 0', color: 'var(--text-secondary)' }}>Personaliza los textos del mensaje incrustado (Embed) con el que los usuarios abren tickets.</p>
               </div>
               <button onClick={guardarTextosConfig} style={{ backgroundColor: 'var(--accent-color)', color: 'white', padding: '12px 25px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1em', boxShadow: '0 4px 12px rgba(41, 128, 185, 0.3)' }}>
                 💾 Guardar Textos
               </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '25px' }}>
              {/* Formulario de Inputs */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1em' }}>✏️ Editar Contenido</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85em', fontWeight: 'bold' }}>Título del Mensaje</label>
                  <input type="text" value={tituloMensaje} onChange={(e) => setTituloMensaje(e.target.value)} placeholder="Ej: 🎫 Soporte Técnico Activo" style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85em', fontWeight: 'bold' }}>Descripción / Instrucciones</label>
                  <textarea value={descripcionMensaje} onChange={(e) => setDescripcionMensaje(e.target.value)} placeholder="Escribe las instrucciones para los usuarios..." style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none', minHeight: '120px', resize: 'vertical' }}></textarea>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85em', fontWeight: 'bold' }}>Pie de Página (Footer)</label>
                  <input type="text" value={footerMensaje} onChange={(e) => setFooterMensaje(e.target.value)} placeholder="Ej: Sistema de Gestión Sokyo" style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', outline: 'none' }} />
                </div>
              </div>

              {/* Vista Previa Estilo Discord */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1em' }}>👀 Vista Previa (Mensaje de Discord)</h3>
                <div style={{ backgroundColor: '#2f3136', borderRadius: '4px', padding: '15px', borderLeft: '4px solid #5865F2', color: '#dcddde', fontFamily: 'sans-serif', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1.1em', marginBottom: '8px' }}>{tituloMensaje || 'Título del panel'}</div>
                  <div style={{ fontSize: '0.95em', whiteSpace: 'pre-wrap', marginBottom: '12px', color: '#b9bbbe' }}>{descripcionMensaje || 'Aquí aparecerán las instrucciones que escribas a la izquierda.'}</div>
                  <div style={{ fontSize: '0.75em', color: '#72767d', marginTop: '10px' }}>{footerMensaje || 'Pie de página'}</div>
                </div>
                <div style={{ marginTop: '15px', backgroundColor: '#4f545c', color: 'white', padding: '10px 18px', borderRadius: '4px', textAlign: 'center', fontSize: '0.9em', fontWeight: '600', maxWidth: '160px', opacity: 0.8, userSelect: 'none' }}>
                  📩 Abrir Ticket
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VISTA: AJUSTES DE INCIDENCIAS --- */}
        {activeTab === 'tickets-config' && configServidor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '20px 25px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
               <div>
                  <h2 style={{ margin: 0, fontSize: '1.4em' }}>Service Desk</h2>
                  <p style={{ margin: '5px 0 0 0', color: 'var(--text-secondary)' }}>Configura las reglas de enrutamiento y prioridades de tu servidor.</p>
               </div>
               <button onClick={guardarCambiosConfig} style={{ backgroundColor: 'var(--accent-color)', color: 'white', padding: '12px 25px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1em', boxShadow: '0 4px 12px rgba(41, 128, 185, 0.3)', transition: 'transform 0.2s' }}>
                 💾 Guardar y Sincronizar
               </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '25px' }}>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>🚥 Niveles de Urgencia (SLA)</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.9em' }}>Crea etiquetas de prioridad. El nivel más alto disparará la alerta máxima.</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', flex: 1, overflowY: 'auto', maxHeight: '350px' }}>
                  {urgencias.sort((a,b) => b.nivel - a.nivel).map((u, i) => (
                    <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', padding: '12px 16px', borderRadius: '8px', marginBottom: '10px', border: `1px solid ${u.color}40`, borderLeft: `4px solid ${u.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                         <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: u.color, boxShadow: `0 0 8px ${u.color}` }}></div>
                         <strong style={{ fontSize: '1.05em' }}>{u.nombre}</strong> 
                         <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>Nivel {u.nivel}</span>
                      </div>
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
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.9em' }}>Motivos que los usuarios verán en Discord.</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', flex: 1, overflowY: 'auto', maxHeight: '350px' }}>
                  {motivos.map((motivo, index) => {
                    const nombre = typeof motivo === 'string' ? motivo : motivo.nombre;
                    const urgencia = typeof motivo === 'string' ? 'Normal' : motivo.urgencia;
                    const colorUrg = getColorUrgencia(urgencia);
                    return (
                      <li key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', padding: '12px 16px', borderRadius: '8px', marginBottom: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                           <strong style={{ fontSize: '1.05em' }}>{nombre}</strong>
                           <span style={{ fontSize: '0.75em', backgroundColor: colorUrg, color: '#fff', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{urgencia}</span>
                        </div>
                        <button onClick={() => eliminarMotivo(motivo)} style={{ backgroundColor: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '1.2em' }}>✖</button>
                      </li>
                    );
                  })}
                </ul>
                <div style={{ backgroundColor: 'var(--bg-main)', padding: '15px', borderRadius: '8px', border: '1px dashed var(--border-color)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="text" value={nuevoMotivo} onChange={(e) => setNuevoMotivo(e.target.value)} placeholder="Ej: Fallo de Pago" style={{ flex: 1, minWidth: '150px', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  <select value={nuevaUrgencia} onChange={(e) => setNuevaUrgencia(e.target.value)} style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none', colorScheme: isDark ? 'dark' : 'light' }}>
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
            <div style={{ fontSize: '3em', marginBottom: '15px' }}>🔌</div>
            <h2>Módulos del Bot</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 30px auto', lineHeight: '1.6' }}>
              Desde aquí podrás encender o apagar las diferentes funcionalidades de Sokyo Bot en tu servidor. 
              Si no vas a usar la economía o la música, podrás desactivarlas con un solo clic.
            </p>
            <div style={{ display: 'inline-block', padding: '10px 20px', backgroundColor: 'rgba(52, 152, 219, 0.1)', color: '#3498db', borderRadius: '8px', fontWeight: 'bold', border: '1px solid rgba(52, 152, 219, 0.3)' }}>
               🚀 Próximamente en desarrollo
            </div>
          </div>
        )}

        {/* --- VISTA: LOGS --- */}
        {activeTab === 'logs' && (
          <div className="ticket-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <h2>🚧 Logs en desarrollo</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Aquí verás los registros internos del sistema próximamente.</p>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;