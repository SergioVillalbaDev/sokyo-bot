// ============================================================================
// useDashboard — TODA la lógica del panel de staff (estado + efectos + fetch).
// ----------------------------------------------------------------------------
// Este hook contiene EXACTAMENTE la misma lógica que tenía el antiguo App.jsx:
// los mismos useState, useEffect, llamadas fetch y handlers. Se ha extraído a
// un hook para que la nueva UI (Tailwind + Framer Motion) la consuma sin
// cambiar el comportamiento. NO se ha alterado ninguna llamada a la API.
// ============================================================================
import { useState, useEffect } from 'react';
import { apiFetch, API_URL, procesarRespuesta } from '../lib/api';
import { isValidTheme, isPremiumTheme } from '../lib/themes';

export function useDashboard() {
  // Tema persistido. Si el guardado es premium pero el plan no lo es, cae a 'lima'.
  const [theme, setThemeState] = useState(() => {
    const guardado = localStorage.getItem('sokyoTheme');
    return guardado && isValidTheme(guardado) ? guardado : 'lima';
  });
  const [activeTab, setActiveTab] = useState('inicio');

  // Texto del buscador del header (filtra la rejilla de tickets)
  const [query, setQuery] = useState('');

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

  // Uso de memoria del plan + datos del servidor de Discord (vista Inicio)
  const [usoStats, setUsoStats] = useState(null);
  const [servidorInfo, setServidorInfo] = useState({ nombre: 'Mi Servidor', icono: null });

  // Mensaje de error de conexión con la API (se muestra como banner)
  const [errorConexion, setErrorConexion] = useState('');

  // Cambia de tema (valida y persiste). Bloquea temas premium en plan Free.
  const setTheme = (id) => {
    if (!isValidTheme(id)) return;
    if (isPremiumTheme(id) && !esPremium) return; // bloqueado sin Premium
    setThemeState(id);
    localStorage.setItem('sokyoTheme', id);
  };

  const reportarError = (contexto) => (err) => {
    console.error(`Error ${contexto}:`, err);
    setErrorConexion(`No se pudo conectar con la API en ${API_URL} — ${err.message}`);
  };

  const cargarUso = () => apiFetch(`/api/stats/uso`).then(procesarRespuesta).then((datos) => {
    setUsoStats(datos);
    if (datos.servidor) setServidorInfo(datos.servidor);
    if (typeof datos.esPremium === 'boolean') setEsPremium(datos.esPremium);
    setErrorConexion('');
  }).catch(reportarError('cargando uso'));

  const cargarTickets = () => apiFetch(`/api/tickets`).then(procesarRespuesta).then((datos) => { setTicketsReales(datos); setErrorConexion(''); }).catch(reportarError('cargando tickets'));
  const cargarUsuariosStats = () => apiFetch(`/api/usuarios/stats`).then(procesarRespuesta).then((datos) => { setUsuariosStats(datos); setErrorConexion(''); }).catch(reportarError('cargando usuarios'));

  const cargarLogs = () => {
    apiFetch(`/api/logs`)
      .then(procesarRespuesta)
      .then((datos) => {
        setLogsRegistrados(datos.logs || []);
        setLimiteLogs(datos.limite || 50);
        setEsPremium(datos.esPremium || false);
        setErrorConexion('');
      })
      .catch(reportarError('cargando logs'));
  };

  const verMensajes = (ticket) => {
    apiFetch(`/api/mensajes/${ticket.canalId}`).then((res) => res.json()).then((datos) => { setMensajes(datos); setTicketSeleccionado(ticket); });
  };

  const cerrarMensajes = () => { setTicketSeleccionado(null); setMensajes([]); cargarTickets(); };

  const enviarMensaje = () => {
    if (nuevoMensaje.trim() === '') return;
    apiFetch(`/api/mensajes/${ticketSeleccionado.canalId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'Sokyo', contenido: nuevoMensaje }) }).then(() => setNuevoMensaje(''));
  };

  const agregarNotaInterna = async () => {
    if (nuevaNota.trim() === '') return;
    try {
      const res = await apiFetch(`/api/tickets/${ticketSeleccionado.canalId}/notas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contenido: nuevaNota, autor: 'Admin' }) });
      const data = await res.json();
      if (data.success) { setTicketSeleccionado(data.ticket); setTicketsReales(ticketsReales.map((t) => t.canalId === data.ticket.canalId ? data.ticket : t)); setNuevaNota(''); }
    } catch (error) { console.error(error); }
  };

  const handleCerrarTicket = async (canalId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('¿Cerrar ticket en Discord?')) return;
    const res = await apiFetch(`/api/tickets/${canalId}/cerrar`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autor: 'Admin' }) });
    if (res.ok) {
      setTicketsReales(ticketsReales.map((t) => t.canalId === canalId ? { ...t, estado: 'Cerrado' } : t));
      if (ticketSeleccionado?.canalId === canalId) setTicketSeleccionado({ ...ticketSeleccionado, estado: 'Cerrado' });
    }
  };

  const handleReabrirTicket = async (canalId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('¿Reabrir este ticket en Discord?')) return;
    const res = await apiFetch(`/api/tickets/${canalId}/reabrir`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autor: 'Admin' }) });
    if (res.ok) {
      setTicketsReales(ticketsReales.map((t) => t.canalId === canalId ? { ...t, estado: 'Abierto' } : t));
      if (ticketSeleccionado?.canalId === canalId) setTicketSeleccionado({ ...ticketSeleccionado, estado: 'Abierto' });
    }
  };

  const handleOcultarTicket = async (canalId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('¿Ocultar del panel web?')) return;
    const res = await apiFetch(`/api/tickets/${canalId}/ocultar`, { method: 'PUT' });
    if (res.ok) { setTicketsReales(ticketsReales.filter((t) => t.canalId !== canalId)); if (ticketSeleccionado?.canalId === canalId) cerrarMensajes(); }
  };

  const cargarConfiguracion = () => {
    apiFetch(`/api/servidores`).then(procesarRespuesta).then((datos) => {
      setErrorConexion('');
      if (datos && datos.length > 0) {
        setConfigServidor(datos[0]); setMotivos(datos[0].motivos || []);
        setUrgencias(datos[0].urgencias || [{ nombre: 'Urgente', color: '#e74c3c', nivel: 4 }, { nombre: 'Alta', color: '#e67e22', nivel: 3 }, { nombre: 'Normal', color: '#3498db', nivel: 2 }, { nombre: 'Baja', color: '#95a5a6', nivel: 1 }]);
        setTituloMensaje(datos[0].mensajeSoporteTitulo || '🎫 Soporte Técnico Activo'); setDescripcionMensaje(datos[0].mensajeSoporteDescripcion || 'Haz clic en el botón de abajo para abrir un ticket de soporte.'); setFooterMensaje(datos[0].footerPersonalizado || 'Sistema de Gestión Sokyo');
      }
    }).catch(reportarError('cargando configuración'));
  };

  const agregarUrgencia = () => { if (nuevaUrgNombre.trim() !== '' && !urgencias.some((u) => u.nombre.toLowerCase() === nuevaUrgNombre.trim().toLowerCase())) { setUrgencias([...urgencias, { nombre: nuevaUrgNombre.trim(), color: nuevaUrgColor, nivel: Number(nuevaUrgNivel) }]); setNuevaUrgNombre(''); setNuevaUrgNivel(1); } };
  const eliminarUrgencia = (nombreUrg) => setUrgencias(urgencias.filter((u) => u.nombre !== nombreUrg));
  const agregarMotivo = () => { if (nuevoMotivo.trim() !== '' && !motivos.some((m) => (typeof m === 'string' ? m : m.nombre).toLowerCase() === nuevoMotivo.trim().toLowerCase())) { setMotivos([...motivos, { nombre: nuevoMotivo.trim(), urgencia: nuevaUrgencia }]); setNuevoMotivo(''); } };
  const eliminarMotivo = (motivoABorrar) => setMotivos(motivos.filter((m) => (typeof m === 'string' ? m : m.nombre) !== (typeof motivoABorrar === 'string' ? motivoABorrar : motivoABorrar.nombre)));

  const guardarCambiosConfig = async () => {
    if (!configServidor) return;
    const motivosFormateados = motivos.map((m) => typeof m === 'string' ? { nombre: m, urgencia: 'Normal' } : m);
    await apiFetch(`/api/config/${configServidor.guildId}/motivos`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivos: motivosFormateados }) });
    await apiFetch(`/api/config/${configServidor.guildId}/urgencias`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urgencias: urgencias }) });
    alert('✅ ¡Sistema de Tickets actualizado en Discord exitosamente!'); setMotivos(motivosFormateados);
  };

  const guardarTextosConfig = async () => {
    if (!configServidor) return;
    const res = await apiFetch(`/api/config/${configServidor.guildId}/textos`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: tituloMensaje, descripcion: descripcionMensaje, footer: footerMensaje }) });
    if (res.ok) alert('✅ Textos actualizados!');
  };

  const getTicketsOrdenados = () => [...ticketsReales].sort((a, b) => (urgencias.find((u) => u.nombre === b.prioridad)?.nivel || 0) - (urgencias.find((u) => u.nombre === a.prioridad)?.nivel || 0));
  const getColorUrgencia = (nombreUrgencia) => urgencias.find((u) => u.nombre === nombreUrgencia)?.color || '#34495e';

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
    if (activeTab === 'logs-tickets') return logsRegistrados.filter((log) => log.categoria === 'Tickets');
    if (activeTab === 'logs-borrados') return logsRegistrados.filter((log) => log.categoria === 'Mensajes Borrados');
    if (activeTab === 'logs-editados') return logsRegistrados.filter((log) => log.categoria === 'Mensajes Editados');
    if (activeTab === 'logs-entradas') return logsRegistrados.filter((log) => log.categoria === 'Entradas');
    if (activeTab === 'logs-salidas') return logsRegistrados.filter((log) => log.categoria === 'Salidas');
    return logsRegistrados;
  };

  // --- Efectos (declarados tras las funciones que utilizan) ---
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Si el tema guardado es premium y el plan deja de serlo, vuelve a 'lima'.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isPremiumTheme(theme) && !esPremium) {
      setThemeState('lima');
      localStorage.setItem('sokyoTheme', 'lima');
    }
  }, [esPremium, theme]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (activeTab === 'inicio') { cargarUso(); cargarTickets(); cargarLogs(); cargarUsuariosStats(); }
    else if (activeTab === 'tickets-gestion') cargarTickets();
    else if (activeTab === 'tickets-config' || activeTab === 'config' || activeTab === 'config-textos') cargarConfiguracion();
    else if (activeTab === 'tickets-usuarios') cargarUsuariosStats();
    else if (activeTab.startsWith('logs-')) cargarLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    let intervalo;
    if (ticketSeleccionado && activeTab === 'tickets-gestion') {
      intervalo = setInterval(() => {
        apiFetch(`/api/mensajes/${ticketSeleccionado.canalId}`)
          .then((res) => res.json())
          .then((datos) => setMensajes(datos))
          .catch((err) => console.error(err));
      }, 3000);
    }
    return () => clearInterval(intervalo);
  }, [ticketSeleccionado, activeTab]);

  return {
    // estado tema / navegación
    theme, setTheme, activeTab, setActiveTab,
    // buscador
    query, setQuery,
    // uso de memoria / servidor
    usoStats, servidorInfo,
    // tickets
    ticketsReales, ticketSeleccionado, setTicketSeleccionado,
    // chat / notas
    mensajes, nuevoMensaje, setNuevoMensaje, nuevaNota, setNuevaNota,
    // config textos
    configServidor, tituloMensaje, setTituloMensaje, descripcionMensaje, setDescripcionMensaje, footerMensaje, setFooterMensaje,
    // incidencias
    motivos, nuevoMotivo, setNuevoMotivo, nuevaUrgencia, setNuevaUrgencia,
    urgencias, nuevaUrgNombre, setNuevaUrgNombre, nuevaUrgColor, setNuevaUrgColor, nuevaUrgNivel, setNuevaUrgNivel,
    // usuarios
    usuariosStats,
    // logs
    logsRegistrados, limiteLogs, esPremium,
    // errores
    errorConexion,
    // acciones
    verMensajes, cerrarMensajes, enviarMensaje, agregarNotaInterna,
    handleCerrarTicket, handleReabrirTicket, handleOcultarTicket,
    agregarUrgencia, eliminarUrgencia, agregarMotivo, eliminarMotivo,
    guardarCambiosConfig, guardarTextosConfig,
    // helpers
    getTicketsOrdenados, getColorUrgencia, obtenerParticipantes, obtenerLogsFiltrados,
  };
}
