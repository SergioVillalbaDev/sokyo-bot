// src/App.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import './panel.css';
import { apiJson, enviar, descargar, escucharEventos, getToken, setToken, getGuild, setGuild, avatarPorDefecto, renderPlantilla } from './api.js';
import { PermisosContext, crearChequeos, usePermisos } from './contexto.js';
import { toast } from './toast.js';
import { Toasts } from './ui.jsx';
import { Login, SinAcceso } from './Login.jsx';
import Permisos from './Permisos.jsx';
import Metricas from './Metricas.jsx';
import Moderacion from './Moderacion.jsx';
import Contenido from './Contenido.jsx';
import { Automatizacion, AutoMod, Comunidad, AjustesLimites } from './Ajustes.jsx';

const PERMISOS_MOD = ['mod.historial', 'mod.warn', 'mod.mute', 'mod.kick', 'mod.ban'];

// Apartados del panel: id, nombre, icono y permisos necesarios (basta con uno). null = cualquier miembro del staff.
const APARTADOS = [
  { grupo: '🎫 Tickets' },
  { id: 'tickets-gestion', icono: '📋', nombre: 'Gestión', requiere: ['tickets.ver'] },
  { id: 'tickets-usuarios', icono: '👥', nombre: 'Registro de usuarios', requiere: ['usuarios.ver'] },
  { id: 'metricas', icono: '📈', nombre: 'Métricas del staff', requiere: ['metricas.ver'] },
  { id: 'contenido', icono: '⚡', nombre: 'Respuestas y FAQ', requiere: ['config.contenido'] },
  { id: 'tickets-config', icono: '🛠️', nombre: 'Ajustes de incidencias', requiere: ['config.tickets'] },
  { id: 'automatizacion', icono: '🤖', nombre: 'Automatización', requiere: ['config.automatizacion'] },
  { grupo: '🔨 Servidor' },
  { id: 'moderacion', icono: '🔨', nombre: 'Moderación', requiere: PERMISOS_MOD },
  { id: 'automod', icono: '🛡️', nombre: 'AutoMod', requiere: ['config.automod'] },
  { id: 'comunidad', icono: '🌱', nombre: 'Comunidad', requiere: ['config.comunidad'] },
  { id: 'config-textos', icono: '📝', nombre: 'Textos del bot', requiere: ['config.textos'] },
  { grupo: '📜 Registros' },
  { id: 'logs-todos', icono: '🌐', nombre: 'Todos los eventos', requiere: ['logs.ver'], logs: true },
  { id: 'logs-tickets', icono: '🎫', nombre: 'Actividad de Tickets', requiere: ['logs.ver'], logs: true },
  { id: 'logs-moderacion', icono: '🔨', nombre: 'Moderación y AutoMod', requiere: ['logs.ver'], logs: true },
  { id: 'logs-sistema', icono: '🔐', nombre: 'Permisos y ajustes', requiere: ['logs.ver'], logs: true },
  { id: 'logs-borrados', icono: '🗑️', nombre: 'Mensajes Eliminados', requiere: ['logs.ver'], logs: true },
  { id: 'logs-editados', icono: '✏️', nombre: 'Mensajes Editados', requiere: ['logs.ver'], logs: true },
  { id: 'logs-entradas', icono: '👋', nombre: 'Entradas al Servidor', requiere: ['logs.ver'], logs: true },
  { id: 'logs-salidas', icono: '🚶‍♂️', nombre: 'Salidas del Servidor', requiere: ['logs.ver'], logs: true },
  { grupo: '🔐 Acceso' },
  { id: 'permisos', icono: '🔐', nombre: 'Roles y permisos', requiere: null },
];

const TITULOS = {
  'tickets-gestion': ['Gestión de Tickets', 'Administra las solicitudes activas de tu servidor.'],
  'tickets-usuarios': ['Registro de Usuarios', 'Estadísticas y recuento global de los usuarios en tu servidor.'],
  'metricas': ['Métricas del Staff', 'Tiempos de respuesta, valoraciones y rendimiento del equipo.'],
  'contenido': ['Respuestas rápidas y FAQ', 'Plantillas para el staff y artículos de ayuda automáticos.'],
  'tickets-config': ['Ajustes de Incidencias', 'Configura las reglas, prioridades y motivos de los tickets.'],
  'automatizacion': ['Automatización', 'Recordatorios de SLA y cierre por inactividad.'],
  'moderacion': ['Moderación', 'Sanciona usuarios con los mismos permisos que tienes en Discord.'],
  'automod': ['AutoMod', 'Antispam y antienlaces automáticos.'],
  'comunidad': ['Comunidad', 'Bienvenida, verificación, niveles y sugerencias.'],
  'config-textos': ['Configuración de Textos', 'Personaliza los títulos y descripciones de marca blanca para el bot.'],
  'permisos': ['Roles y Permisos', 'Quién puede acceder a cada apartado del panel y por qué.'],
};

const primerApartadoPermitido = (tiene) => APARTADOS.find((a) => a.id && (!a.requiere || a.requiere.some(tiene)))?.id || 'permisos';

// ================================ RAÍZ: sesión, servidor y permisos ================================
function App() {
  // Al volver del login con Discord la URL trae el token de sesión (o un error): se lee UNA vez al arrancar.
  const [token, setTokenState] = useState(() => { const t = new URLSearchParams(window.location.search).get('staffToken'); if (t) setToken(t); return getToken(); });
  const [errorLogin, setErrorLogin] = useState(() => new URLSearchParams(window.location.search).get('error') || '');
  const [sesion, setSesion] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [guildId, setGuildId] = useState(getGuild());
  const [cargando, setCargando] = useState(!!getToken());
  const [isDark, setIsDark] = useState(true);

  useEffect(() => { document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light'); }, [isDark]);

  // Limpia el token de la barra de direcciones.
  useEffect(() => { if (window.location.search) window.history.replaceState({}, '', '/'); }, []);

  const salir = useCallback(() => { setToken(''); setTokenState(''); setSesion(null); setCargando(false); }, []);
  useEffect(() => {
    window.addEventListener('sokyo:sesion-caducada', salir);
    return () => window.removeEventListener('sokyo:sesion-caducada', salir);
  }, [salir]);

  const pedirSesion = () => Promise.all([apiJson('/api/staff/yo'), apiJson('/api/permisos/catalogo')]);
  const aplicarSesion = useCallback(([yo, cat]) => {
    setSesion(yo); setCatalogo(cat);
    const elegido = yo.servidores.find((s) => s.id === getGuild()) || yo.servidores[0];
    if (elegido) { setGuild(elegido.id); setGuildId(elegido.id); }
  }, []);
  const refrescarSesion = useCallback(() => pedirSesion().then(aplicarSesion).catch(() => {}), [aplicarSesion]);

  // Primera carga de la sesión (en cuanto hay token).
  useEffect(() => {
    if (!token) return undefined;
    let vivo = true;
    pedirSesion().then((r) => vivo && aplicarSesion(r))
      .catch((e) => { if (vivo && e.status !== 401) setErrorLogin('No se pudo conectar con la API del bot.'); })
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [token, aplicarSesion]);
  // Los permisos se vuelven a leer cada minuto: si te quitan un rol, el panel se entera solo.
  useEffect(() => { if (!token) return undefined; const id = setInterval(refrescarSesion, 60_000); return () => clearInterval(id); }, [token, refrescarSesion]);

  const cambiarGuild = (id) => { setGuild(id); setGuildId(id); };

  if (!token) return <><Login error={errorLogin} /><Toasts /></>;
  if (cargando && !sesion) return <div className="login-fondo"><div className="muted">Cargando tu sesión…</div></div>;
  if (!sesion || sesion.servidores.length === 0) return <SinAcceso usuario={sesion?.usuario} onSalir={salir} onReintentar={refrescarSesion} />;

  const guild = sesion.servidores.find((s) => s.id === guildId) || sesion.servidores[0];
  const chequeos = crearChequeos(guild.permisos);
  const valor = { ...chequeos, rango: guild.rango, catalogo, usuario: sesion.usuario, guild: { id: guild.id, nombre: guild.nombre } };

  return (
    <PermisosContext.Provider value={valor}>
      <Panel key={guild.id} sesion={sesion} servidores={sesion.servidores} guild={guild} cambiarGuild={cambiarGuild} salir={salir} isDark={isDark} setIsDark={setIsDark} />
      <Toasts />
    </PermisosContext.Provider>
  );
}

// Botón de acción protegido por permiso: si falta, se ve bloqueado con un candado y explica por qué.
function BotonPermiso({ permiso, children, estilo, onClick, ...resto }) {
  const { tiene, catalogo } = usePermisos();
  const ok = tiene(permiso);
  const nombre = catalogo?.permisos.find((p) => p.id === permiso)?.nombre || permiso;
  return <button {...resto} disabled={!ok} title={ok ? undefined : `🔒 Necesitas el permiso: ${nombre}`} onClick={ok ? onClick : undefined} style={{ ...estilo, opacity: ok ? 1 : 0.45, cursor: ok ? 'pointer' : 'not-allowed' }}>{ok ? children : <>🔒 {children}</>}</button>;
}

// ================================ PANEL ================================
function Panel({ sesion, servidores, guild, cambiarGuild, salir, isDark, setIsDark }) {
  const { tiene, catalogo } = usePermisos();
  const [activeTab, setActiveTab] = useState(() => primerApartadoPermitido(tiene));
  const [ticketsReales, setTicketsReales] = useState([]);
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [nuevaNota, setNuevaNota] = useState('');
  const [macros, setMacros] = useState([]);

  // Filtros de la lista de tickets
  const [filtros, setFiltros] = useState({ q: '', estado: '', prioridad: '', asignado: '', motivo: '' });

  // Configuración
  const [configServidor, setConfigServidor] = useState(null);
  const [tituloMensaje, setTituloMensaje] = useState('');
  const [descripcionMensaje, setDescripcionMensaje] = useState('');
  const [footerMensaje, setFooterMensaje] = useState('');
  const [motivos, setMotivos] = useState([]);
  const [nuevoMotivo, setNuevoMotivo] = useState('');
  const [nuevaUrgencia, setNuevaUrgencia] = useState('Normal');
  const [urgencias, setUrgencias] = useState([]);
  const [nuevaUrgNombre, setNuevaUrgNombre] = useState('');
  const [nuevaUrgColor, setNuevaUrgColor] = useState('#e74c3c');
  const [nuevaUrgNivel, setNuevaUrgNivel] = useState(1);

  const [usuariosStats, setUsuariosStats] = useState([]);
  const [logsRegistrados, setLogsRegistrados] = useState([]);
  const [limiteLogs, setLimiteLogs] = useState(50);
  const [esPremium, setEsPremium] = useState(false);
  const [errorConexion, setErrorConexion] = useState('');

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [enVivo, setEnVivo] = useState(false);
  const [nuevosSinVer, setNuevosSinVer] = useState(0);
  const refs = useRef({});
  useEffect(() => { refs.current = { activeTab, ticketSeleccionado }; });

  const reportarError = (contexto) => (err) => {
    console.error(`Error ${contexto}:`, err);
    if (err.status === 403) setErrorConexion('🔒 No tienes permiso para ver esto. Si crees que es un error, pide acceso a un administrador.');
    else setErrorConexion(`No se pudo conectar con la API — ${err.message}`);
  };
  const avisarError = (err) => toast(err.status === 403 ? `🔒 ${err.message}` : err.message, 'error');

  // ---------- Carga de datos ----------
  const cargarTickets = useCallback(() => {
    if (!tiene('tickets.ver')) return Promise.resolve();
    const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();
    return apiJson(`/api/tickets${qs ? `?${qs}` : ''}`).then((d) => { setTicketsReales(d); setErrorConexion(''); }).catch(reportarError('cargando tickets'));
  }, [filtros, tiene]);

  const cargarConfiguracion = useCallback(() => apiJson('/api/config').then((c) => {
    setErrorConexion('');
    setConfigServidor(c); setMotivos(c.motivos || []);
    setUrgencias(c.urgencias || []);
    setTituloMensaje(c.mensajeSoporteTitulo || ''); setDescripcionMensaje(c.mensajeSoporteDescripcion || ''); setFooterMensaje(c.footerPersonalizado || '');
  }).catch(reportarError('cargando configuración')), []);

  const cargarUsuariosStats = () => apiJson('/api/usuarios/stats').then((d) => { setUsuariosStats(d); setErrorConexion(''); }).catch(reportarError('cargando usuarios'));
  const cargarLogs = () => apiJson('/api/logs').then((d) => { setLogsRegistrados(d.logs || []); setLimiteLogs(d.limite || 50); setEsPremium(d.esPremium || false); setErrorConexion(''); }).catch(reportarError('cargando logs'));

  useEffect(() => { cargarConfiguracion(); if (tiene('tickets.macros')) apiJson('/api/macros').then(setMacros).catch(() => {}); }, [cargarConfiguracion, tiene]);

  // Los filtros del listado se aplican con un pequeño retardo (para no saturar al escribir).
  useEffect(() => {
    if (activeTab !== 'tickets-gestion') return undefined;
    const id = setTimeout(cargarTickets, filtros.q ? 300 : 0);
    return () => clearTimeout(id);
  }, [filtros, activeTab, cargarTickets]);

  useEffect(() => {
    if (activeTab === 'tickets-config' || activeTab === 'config-textos') cargarConfiguracion();
    else if (activeTab === 'tickets-usuarios') cargarUsuariosStats();
    else if (activeTab.startsWith('logs-')) cargarLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ---------- Tiempo real (SSE) ----------
  useEffect(() => {
    if (!tiene('tickets.ver')) return undefined;
    return escucharEventos((tipo, datos) => {
      if (datos.guildId !== guild.id) return;
      const { activeTab: tab, ticketSeleccionado: abierto } = refs.current;
      if (tipo === 'ticket:nuevo') {
        toast(`🎫 Nuevo ticket de ${datos.usuario}: ${datos.titulo}`, 'nuevo');
        if (tab !== 'tickets-gestion') setNuevosSinVer((n) => n + 1);
      }
      if ((tipo === 'ticket:nuevo' || tipo === 'ticket:actualizado') && tab === 'tickets-gestion') cargarTickets();
      if (tipo === 'mensaje:nuevo' && abierto?.canalId === datos.canalId) apiJson(`/api/mensajes/${datos.canalId}`).then(setMensajes).catch(() => {});
      if (tipo === 'ticket:actualizado' && abierto?.canalId === datos.canalId) apiJson('/api/tickets').then((l) => { const t = l.find((x) => x.canalId === datos.canalId); if (t) setTicketSeleccionado(t); }).catch(() => {});
    }, setEnVivo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guild.id]);

  // Sin conexión en vivo, se refresca el chat abierto cada 4 s.
  useEffect(() => {
    if (enVivo || !ticketSeleccionado || activeTab !== 'tickets-gestion') return undefined;
    const id = setInterval(() => apiJson(`/api/mensajes/${ticketSeleccionado.canalId}`).then(setMensajes).catch(() => {}), 4000);
    return () => clearInterval(id);
  }, [enVivo, ticketSeleccionado, activeTab]);

  useEffect(() => { document.title = nuevosSinVer > 0 ? `(${nuevosSinVer}) Sokyo Panel` : 'Sokyo Panel'; }, [nuevosSinVer]);

  // ---------- Acciones de tickets ----------
  const verMensajes = (ticket) => apiJson(`/api/mensajes/${ticket.canalId}`).then((d) => { setMensajes(d); setTicketSeleccionado(ticket); }).catch(avisarError);
  const cerrarMensajes = () => { setTicketSeleccionado(null); setMensajes([]); cargarTickets(); };
  const actualizarTicket = (t) => { setTicketsReales((l) => l.map((x) => (x.canalId === t.canalId ? t : x))); setTicketSeleccionado((s) => (s?.canalId === t.canalId ? t : s)); };

  const enviarMensaje = () => {
    if (nuevoMensaje.trim() === '') return;
    enviar('POST', `/api/mensajes/${ticketSeleccionado.canalId}`, { contenido: nuevoMensaje }).then(() => setNuevoMensaje('')).catch(avisarError);
  };

  const usarMacro = (nombre) => {
    const m = macros.find((x) => x.nombre === nombre);
    if (!m) return;
    setNuevoMensaje(renderPlantilla(m.contenido, { usuario: ticketSeleccionado.creadorNombre, staff: sesion.usuario.username, ticket: ticketSeleccionado.titulo || ticketSeleccionado.motivo, servidor: guild.nombre }));
  };

  const agregarNotaInterna = async () => {
    if (nuevaNota.trim() === '') return;
    try { const data = await enviar('POST', `/api/tickets/${ticketSeleccionado.canalId}/notas`, { contenido: nuevaNota }); actualizarTicket(data.ticket); setNuevaNota(''); } catch (e) { avisarError(e); }
  };

  const accionTicket = async (canalId, accion, confirmacion, e) => {
    if (e) e.stopPropagation();
    if (confirmacion && !window.confirm(confirmacion)) return;
    try {
      const data = await enviar('PUT', `/api/tickets/${canalId}/${accion}`);
      if (accion === 'ocultar') { setTicketsReales((l) => l.filter((t) => t.canalId !== canalId)); if (ticketSeleccionado?.canalId === canalId) cerrarMensajes(); }
      else if (data.ticket) actualizarTicket(data.ticket);
    } catch (err) { avisarError(err); }
  };

  const exportarCsv = () => descargar('/api/tickets/exportar', 'tickets.csv').catch(avisarError);
  const descargarTranscripcion = (t) => descargar(`/api/tickets/${t.canalId}/transcripcion`, `transcripcion-${t.creadorNombre}.html`).catch(avisarError);

  // ---------- Configuración ----------
  const agregarUrgencia = () => { if (nuevaUrgNombre.trim() !== '' && !urgencias.some((u) => u.nombre.toLowerCase() === nuevaUrgNombre.trim().toLowerCase())) { setUrgencias([...urgencias, { nombre: nuevaUrgNombre.trim(), color: nuevaUrgColor, nivel: Number(nuevaUrgNivel) }]); setNuevaUrgNombre(''); setNuevaUrgNivel(1); } };
  const eliminarUrgencia = (nombreUrg) => setUrgencias(urgencias.filter((u) => u.nombre !== nombreUrg));
  const agregarMotivo = () => { if (nuevoMotivo.trim() !== '' && !motivos.some((m) => (typeof m === 'string' ? m : m.nombre).toLowerCase() === nuevoMotivo.trim().toLowerCase())) { setMotivos([...motivos, { nombre: nuevoMotivo.trim(), urgencia: nuevaUrgencia }]); setNuevoMotivo(''); } };
  const eliminarMotivo = (m) => setMotivos(motivos.filter((x) => (typeof x === 'string' ? x : x.nombre) !== (typeof m === 'string' ? m : m.nombre)));

  const guardarCambiosConfig = async () => {
    try {
      const motivosFormateados = motivos.map((m) => (typeof m === 'string' ? { nombre: m, urgencia: 'Normal' } : m));
      await enviar('PUT', `/api/config/${guild.id}/motivos`, { motivos: motivosFormateados });
      await enviar('PUT', `/api/config/${guild.id}/urgencias`, { urgencias });
      toast('✅ ¡Sistema de Tickets actualizado en Discord!', 'ok'); setMotivos(motivosFormateados);
    } catch (e) { avisarError(e); }
  };
  const guardarTextosConfig = async () => {
    try { await enviar('PUT', `/api/config/${guild.id}/textos`, { titulo: tituloMensaje, descripcion: descripcionMensaje, footer: footerMensaje }); toast('✅ ¡Textos actualizados!', 'ok'); } catch (e) { avisarError(e); }
  };

  // ---------- Helpers de pintado ----------
  const getTicketsOrdenados = () => [...ticketsReales].sort((a, b) => (urgencias.find((u) => u.nombre === b.prioridad)?.nivel || 0) - (urgencias.find((u) => u.nombre === a.prioridad)?.nivel || 0));
  const getColorUrgencia = (n) => urgencias.find((u) => u.nombre === n)?.color || '#34495e';
  const renderEstrellas = (p) => !p ? <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>Sin valorar</span> : <div style={{ display: 'flex', gap: '3px' }}>{[...Array(5)].map((_, i) => <span key={i} style={{ color: i < p ? '#f1c40f' : '#34495e', fontSize: '1.2em' }}>★</span>)}</div>;
  const obtenerParticipantes = (ticket) => {
    if (ticket.participantes && ticket.participantes.length > 0) return ticket.participantes;
    const implicados = [{ id: '1', username: ticket.creadorNombre, avatar: ticket.creadorAvatar || avatarPorDefecto(ticket.creadorNombre), rol: 'Creador' }];
    if (ticket.asignadoNombre) implicados.push({ id: '2', username: ticket.asignadoNombre, avatar: avatarPorDefecto(ticket.asignadoNombre), rol: 'Staff' });
    return implicados;
  };
  const CATEGORIAS_LOGS = { 'logs-tickets': ['Tickets'], 'logs-moderacion': ['Moderación', 'AutoMod'], 'logs-sistema': ['Permisos', 'Configuración'], 'logs-borrados': ['Mensajes Borrados'], 'logs-editados': ['Mensajes Editados'], 'logs-entradas': ['Entradas'], 'logs-salidas': ['Salidas'] };
  const obtenerLogsFiltrados = () => (CATEGORIAS_LOGS[activeTab] ? logsRegistrados.filter((l) => CATEGORIAS_LOGS[activeTab].includes(l.categoria)) : logsRegistrados);

  const nombresPermisos = (ids) => ids.map((id) => catalogo?.permisos.find((p) => p.id === id)?.nombre || id).join(' o ');
  const estiloBtn = (bg) => ({ flex: 1, backgroundColor: bg, color: 'white', padding: '8px', border: 'none', borderRadius: '5px' });

  const apartadoActual = APARTADOS.find((a) => a.id === activeTab);
  const sinAcceso = apartadoActual?.requiere && !apartadoActual.requiere.some(tiene);
  const [titulo, subtitulo] = TITULOS[activeTab] || (activeTab.startsWith('logs') ? ['Registro de Auditoría', 'Supervisa el funcionamiento interno y eventos clave del servidor.'] : ['', '']);
  const esMio = (t) => t.asignadoA === sesion.usuario.id;
  const motivosFiltro = [...new Set([...(configServidor?.motivos || []).map((m) => m.nombre)])];

  return (
    <div className={`app-container ${menuAbierto ? 'menu-abierto' : ''}`}>
      <aside className="sidebar hide-on-print">
        <div className="brand">🤖 Sokyo Bot</div>

        <div className="usuario-chip">
          <img src={sesion.usuario.avatar || avatarPorDefecto(sesion.usuario.username)} alt="" />
          <div style={{ minWidth: 0 }}><div className="nombre">{sesion.usuario.username}</div><span className={`rango ${guild.rango}`}>{guild.rango}</span></div>
          <button className="btn pequeno fantasma" style={{ marginLeft: 'auto' }} onClick={salir} title="Cerrar sesión" aria-label="Cerrar sesión">⎋</button>
        </div>
        {servidores.length > 1 && (
          <select className="select selector-guild" value={guild.id} onChange={(e) => cambiarGuild(e.target.value)} aria-label="Servidor">
            {servidores.map((s) => <option key={s.id} value={s.id}>🏠 {s.nombre}</option>)}
          </select>
        )}
        {servidores.length === 1 && <div className="muted small" style={{ marginBottom: 10, paddingLeft: 4 }}>🏠 {guild.nombre}</div>}

        <nav className="nav-menu">
          {APARTADOS.map((a) => {
            if (a.grupo) return <div className="nav-sep" key={a.grupo}>{a.grupo}</div>;
            const permitido = !a.requiere || a.requiere.some(tiene);
            return (
              <div key={a.id} className={`nav-item ${activeTab === a.id ? 'active' : ''} ${permitido ? '' : 'bloqueada'}`}
                title={permitido ? undefined : `🔒 Necesitas: ${nombresPermisos(a.requiere)}`}
                onClick={() => { setMenuAbierto(false); setErrorConexion(''); setActiveTab(a.id); if (a.id === 'tickets-gestion') { setTicketSeleccionado(null); setNuevosSinVer(0); } }}>
                <span>{a.icono} {a.nombre}</span>
                {!permitido && <span className="candado">🔒</span>}
                {a.id === 'tickets-gestion' && nuevosSinVer > 0 && <span className="badge-contador">{nuevosSinVer}</span>}
              </div>
            );
          })}
        </nav>
        <div className="estado-vivo"><span className={`punto ${enVivo ? 'on' : ''}`} />{enVivo ? 'En vivo' : 'Sin conexión en vivo'}</div>
      </aside>

      <main className="main-content print-full-width">
        <header className="header hide-on-print">
          <button className="btn fantasma btn-menu" onClick={() => setMenuAbierto(!menuAbierto)} aria-label="Menú" aria-expanded={menuAbierto}>☰</button>
          <div style={{ flex: 1 }}><h1>{titulo}</h1><p style={{ color: 'var(--text-secondary)' }}>{subtitulo}</p></div>
          <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>{isDark ? '☀️ Claro' : '🌙 Oscuro'}</button>
        </header>

        {errorConexion && (
          <div className="aviso error" style={{ marginBottom: 20 }}><span>⚠️</span><div>{errorConexion}</div></div>
        )}

        {sinAcceso && (
          <div className="card" style={{ textAlign: 'center', padding: 50 }}>
            <div style={{ fontSize: '3.4rem' }}>🔒</div>
            <h2>No tienes acceso a este apartado</h2>
            <p className="muted" style={{ margin: '10px 0 18px' }}>Necesitas el permiso <strong>{nombresPermisos(apartadoActual.requiere)}</strong>.</p>
            <button className="btn" onClick={() => setActiveTab('permisos')}>🔐 Ver qué roles lo tienen</button>
          </div>
        )}

        {!sinAcceso && activeTab === 'permisos' && <Permisos />}
        {!sinAcceso && activeTab === 'metricas' && <Metricas />}
        {!sinAcceso && activeTab === 'moderacion' && <Moderacion />}
        {!sinAcceso && activeTab === 'contenido' && <Contenido />}
        {!sinAcceso && activeTab === 'automatizacion' && <Automatizacion />}
        {!sinAcceso && activeTab === 'automod' && <AutoMod />}
        {!sinAcceso && activeTab === 'comunidad' && <Comunidad />}

        {/* --- VISTA: GESTIÓN DE TICKETS --- */}
        {!sinAcceso && activeTab === 'tickets-gestion' && !ticketSeleccionado && (
          <>
            <div className="filtros hide-on-print">
              <input className="input buscar" placeholder="🔎 Buscar tickets o texto de chats…" value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value })} />
              <select className="select" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}><option value="">Todos los estados</option><option value="Abierto">🟢 Abiertos</option><option value="Cerrado">🔒 Cerrados</option></select>
              <select className="select" value={filtros.prioridad} onChange={(e) => setFiltros({ ...filtros, prioridad: e.target.value })}><option value="">Toda prioridad</option>{urgencias.map((u) => <option key={u.nombre} value={u.nombre}>{u.nombre}</option>)}</select>
              <select className="select" value={filtros.asignado} onChange={(e) => setFiltros({ ...filtros, asignado: e.target.value })}><option value="">Todos</option><option value="yo">🙋 Míos</option><option value="ninguno">🆓 Sin reclamar</option></select>
              <select className="select" value={filtros.motivo} onChange={(e) => setFiltros({ ...filtros, motivo: e.target.value })}><option value="">Todo motivo</option>{motivosFiltro.map((m) => <option key={m} value={m}>{m}</option>)}</select>
              <BotonPermiso permiso="tickets.exportar" className="btn fantasma" onClick={exportarCsv}>📥 Exportar CSV</BotonPermiso>
            </div>
            {ticketsReales.length === 0 && <div className="card" style={{ textAlign: 'center' }}><div style={{ fontSize: '2.5rem' }}>📭</div><div className="muted">No hay tickets con estos filtros.</div></div>}
            <div className="tickets-grid">
              {getTicketsOrdenados().map((ticket) => {
                const borderHex = getColorUrgencia(ticket.prioridad);
                return (
                  <div className="ticket-card" key={ticket.canalId} style={{ borderTop: `4px solid ${borderHex}`, position: 'relative' }}>
                    <div className="ticket-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span className="ticket-id" style={{ fontWeight: 'bold', fontSize: '1.1em', color: 'var(--text-primary)' }}>{ticket.titulo || ticket.motivo || 'Ticket de Soporte'}</span>
                      <span style={{ fontSize: '0.75em', padding: '4px 10px', borderRadius: '12px', backgroundColor: borderHex, color: '#fff', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{ticket.prioridad || 'Normal'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <img src={ticket.creadorAvatar || avatarPorDefecto(ticket.creadorNombre)} alt="avatar" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                          <strong>{ticket.creadorNombre}</strong>
                        </div>
                        <span>🏷️ <em>{ticket.motivo}</em></span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '4px', borderBottom: '1px dashed var(--border-color)' }}>
                        <span>🛡️ Atendido por: {ticket.asignadoNombre ? <strong style={{ color: 'var(--accent-color)' }}>{esMio(ticket) ? 'Ti' : ticket.asignadoNombre}</strong> : <em style={{ opacity: 0.6 }}>Sin reclamar</em>}</span>
                        {ticket.estado === 'Abierto' && !ticket.asignadoA && <BotonPermiso permiso="tickets.reclamar" className="btn pequeno" onClick={() => accionTicket(ticket.canalId, 'reclamar')}>🙋 Reclamar</BotonPermiso>}
                      </div>
                    </div>
                    {ticket.descripcion && <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'var(--bg-main)', borderRadius: '6px', fontSize: '0.9em', fontStyle: 'italic', borderLeft: `3px solid ${borderHex}` }}>"{ticket.descripcion.substring(0, 60)}..."</div>}
                    {ticket.estado === 'Cerrado' && <div style={{ marginBottom: '15px', backgroundColor: 'rgba(241, 196, 15, 0.1)', padding: '10px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(241, 196, 15, 0.3)' }}><span style={{ fontSize: '0.75em', color: '#f1c40f', fontWeight: 'bold' }}>VALORACIÓN:</span>{renderEstrellas(ticket.valoracionCSAT)}</div>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button className="btn-view" onClick={() => verMensajes(ticket)} style={{ width: '100%', padding: '8px', borderRadius: '5px' }}>💬 Ver Conversación</button>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {ticket.estado !== 'Cerrado'
                          ? <BotonPermiso permiso="tickets.cerrar" estilo={estiloBtn('#e74c3c')} onClick={(e) => accionTicket(ticket.canalId, 'cerrar', '¿Cerrar ticket en Discord?', e)}>🔒 Cerrar</BotonPermiso>
                          : <BotonPermiso permiso="tickets.reabrir" estilo={estiloBtn('#2ecc71')} onClick={(e) => accionTicket(ticket.canalId, 'reabrir', '¿Reabrir este ticket en Discord?', e)}>🔓 Reabrir</BotonPermiso>}
                        <BotonPermiso permiso="tickets.ocultar" estilo={estiloBtn('#34495e')} onClick={(e) => accionTicket(ticket.canalId, 'ocultar', '¿Ocultar del panel web?', e)}>🗑️ Ocultar</BotonPermiso>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* --- VISTA: CHAT (3 COLUMNAS) --- */}
        {!sinAcceso && activeTab === 'tickets-gestion' && ticketSeleccionado && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="hide-on-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 10 }}>
              <div><button onClick={cerrarMensajes} style={{ padding: '8px 15px', cursor: 'pointer', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontWeight: 'bold', marginRight: '15px' }}>⬅ Volver</button><span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>Ticket: {ticketSeleccionado.titulo || ticketSeleccionado.creadorNombre}</span></div>
              <div className="row">
                <BotonPermiso permiso="tickets.exportar" className="btn fantasma pequeno" onClick={() => descargarTranscripcion(ticketSeleccionado)}>📄 Transcripción</BotonPermiso>
                {ticketSeleccionado.estado === 'Abierto' && !ticketSeleccionado.asignadoA && <BotonPermiso permiso="tickets.reclamar" className="btn" onClick={() => accionTicket(ticketSeleccionado.canalId, 'reclamar')}>🙋 Reclamar</BotonPermiso>}
                {ticketSeleccionado.estado === 'Abierto' && ticketSeleccionado.asignadoA && (esMio(ticketSeleccionado) || tiene('tickets.reasignar')) && <BotonPermiso permiso="tickets.reclamar" className="btn gris" onClick={() => accionTicket(ticketSeleccionado.canalId, 'soltar', '¿Liberar este ticket para que lo reclame otra persona?')}>🆓 Soltar</BotonPermiso>}
                {ticketSeleccionado.estado !== 'Cerrado'
                  ? <BotonPermiso permiso="tickets.cerrar" className="btn rojo" onClick={() => accionTicket(ticketSeleccionado.canalId, 'cerrar', '¿Cerrar ticket en Discord?')}>🔒 Cerrar Ticket</BotonPermiso>
                  : <BotonPermiso permiso="tickets.reabrir" className="btn verde" onClick={() => accionTicket(ticketSeleccionado.canalId, 'reabrir', '¿Reabrir este ticket en Discord?')}>🔓 Reabrir Ticket</BotonPermiso>}
              </div>
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
                      <div key={msg._id || index} className={`mensaje ${msg.usuarioId !== ticketSeleccionado.creadorId ? 'mod' : ''}`}>
                        <span className="mensaje-autor" style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>{msg.usuario || 'Usuario Desconocido'}</span>
                        {msg.contenido && <span className="mensaje-contenido">{msg.contenido}</span>}
                        {msg.imagenes?.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer noopener" style={{ display: 'block', marginTop: 6 }}><img src={u} alt="adjunto" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8 }} /></a>)}
                      </div>
                    ))
                  )}
                </div>
                {ticketSeleccionado.estado === 'Cerrado'
                  ? <div className="hide-on-print" style={{ padding: '15px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-secondary)' }}>Este ticket está cerrado.</div>
                  : !tiene('tickets.responder')
                    ? <div className="aviso warn hide-on-print"><span>🔒</span><div>No tienes permiso para responder desde el panel ({nombresPermisos(['tickets.responder'])}).</div></div>
                    : (
                      <div className="hide-on-print">
                        {tiene('tickets.macros') && macros.length > 0 && (
                          <div className="macros-barra"><span className="small muted">⚡ Respuesta rápida:</span>
                            <select className="select" style={{ width: 'auto', minWidth: 200 }} value="" onChange={(e) => usarMacro(e.target.value)}><option value="">Elegir plantilla…</option>{macros.map((m) => <option key={m._id} value={m.nombre}>{m.nombre}</option>)}</select>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '10px' }}><input type="text" value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()} placeholder="Escribe una respuesta al ticket..." style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }} /><button onClick={enviarMensaje} style={{ padding: '0 20px', backgroundColor: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Enviar</button></div>
                      </div>
                    )}
              </div>
              <div className="hide-on-print" style={{ flex: '1 1 25%', minWidth: '250px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid #f39c12', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ backgroundColor: 'rgba(243, 156, 18, 0.1)', padding: '15px', borderBottom: '1px solid #f39c12' }}><h3 style={{ margin: 0, color: '#f39c12', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1em' }}>🕵️‍♂️ Notas Internas</h3><p style={{ margin: '5px 0 0 0', fontSize: '0.8em', color: 'var(--text-secondary)' }}>Visibles solo para el Staff web.</p></div>
                <div style={{ padding: '15px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '200px' }}>
                  {ticketSeleccionado.notasInternas && ticketSeleccionado.notasInternas.length > 0 ? (
                    ticketSeleccionado.notasInternas.map((nota, i) => (
                      <div key={i} style={{ backgroundColor: 'var(--bg-main)', borderLeft: '3px solid #f39c12', padding: '10px 12px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}><div style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}><strong>{nota.autor}</strong><span>{nota.fecha ? new Date(nota.fecha).toLocaleDateString() : ''}</span></div><div style={{ fontSize: '0.9em', lineHeight: '1.4' }}>{nota.contenido}</div></div>
                    ))
                  ) : <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>No hay anotaciones privadas.</p>}
                </div>
                {tiene('tickets.notas')
                  ? <div style={{ padding: '15px', borderTop: '1px dashed var(--border-color)', backgroundColor: 'var(--bg-main)', display: 'flex', flexDirection: 'column', gap: '10px' }}><textarea value={nuevaNota} onChange={(e) => setNuevaNota(e.target.value)} placeholder="Añade un apunte secreto..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', resize: 'vertical', minHeight: '70px', outline: 'none' }}></textarea><button onClick={agregarNotaInterna} style={{ backgroundColor: '#f39c12', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>+ Guardar Nota</button></div>
                  : <div className="small muted" style={{ padding: 14, textAlign: 'center' }}>🔒 No tienes permiso para escribir notas.</div>}
              </div>
            </div>
          </div>
        )}

        {/* --- VISTA: REGISTRO DE USUARIOS --- */}
        {!sinAcceso && activeTab === 'tickets-usuarios' && (
          <div className="usuarios-view">
            {usuariosStats.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No hay datos de usuarios registrados.</p> : (
              <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead><tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}><th style={{ padding: '15px' }}>Usuario</th><th style={{ padding: '15px' }}>Total Tickets</th><th style={{ padding: '15px' }}>Tickets Abiertos</th><th style={{ padding: '15px' }}>Rating Medio</th><th style={{ padding: '15px' }}>Última Actividad</th></tr></thead>
                  <tbody>
                    {usuariosStats.map((user) => (
                      <tr key={user._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        
                        {/* AQUI ESTA LA FOTO EN LA TABLA DE USUARIOS */}
                        <td style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img src={user.avatar || avatarPorDefecto(user.nombre)} alt="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
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
        {!sinAcceso && activeTab === 'config-textos' && configServidor && (
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
        {!sinAcceso && activeTab === 'tickets-config' && configServidor && (
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
          <AjustesLimites />
          </div>
        )}

        {/* --- NUEVA VISTA FILTRADA DE LOGS --- */}
        {!sinAcceso && activeTab.startsWith('logs-') && (
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
