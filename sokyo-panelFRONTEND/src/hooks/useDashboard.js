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

  // Servidor (guild) seleccionado en el panel + lista de servidores del bot.
  const [guildId, setGuildIdState] = useState(() => localStorage.getItem('sokyoGuild') || '');
  const [servidores, setServidores] = useState([]);
  const setGuildId = (id) => { setGuildIdState(id); localStorage.setItem('sokyoGuild', id || ''); };
  // Sufijo de query con el servidor activo (para filtrar las llamadas a la API).
  const gp = () => (guildId ? `?guildId=${guildId}` : '');

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
  // Personalización / marca (Fase 2)
  const [colorEmbed, setColorEmbed] = useState('#5865F2');
  const [textoBoton, setTextoBoton] = useState('📩 Abrir Ticket');
  const [mensajeBienvenida, setMensajeBienvenida] = useState('Un miembro del equipo lo revisará en breve.');
  const [prefijo, setPrefijo] = useState('!');
  const [categoriaArchivados, setCategoriaArchivados] = useState('🗄️ Tickets Archivados');

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
  const [ping, setPing] = useState(null);
  const [servidorInfo, setServidorInfo] = useState({ nombre: 'Mi Servidor', icono: null });

  // Roles y categorías del servidor (para los selectores de Comportamiento/Reglas)
  const [roles, setRoles] = useState([]);
  const [categorias, setCategorias] = useState([]);

  // Gestión de roles (panel mejorado): lista detallada + catálogo de permisos.
  const [rolesDetalle, setRolesDetalle] = useState([]);
  const [permisosCatalogo, setPermisosCatalogo] = useState([]);
  // Paneles de autoasignación de roles + canales y emojis del servidor.
  const [paneles, setPaneles] = useState([]);
  const [canales, setCanales] = useState([]);
  const [emojisServidor, setEmojisServidor] = useState([]);
  const [stickers, setStickers] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [catalogoPresets, setCatalogoPresets] = useState({ ocultos: [], personalizados: [] });
  // Seguridad: reportes de usuarios.
  const [reportes, setReportes] = useState([]);
  // Productividad: anuncios programados + presets de anuncio.
  const [anuncios, setAnuncios] = useState([]);
  const [presetsAnuncio, setPresetsAnuncio] = useState([]);
  // Difusión (solo IDs autorizadas): permiso + nº de servidores del bot.
  const [esBroadcaster, setEsBroadcaster] = useState(false);
  const [servidoresBot, setServidoresBot] = useState(0);

  // Moderación (Centro de Mando).
  const [tiposSancion, setTiposSancion] = useState([]);
  const [sanciones, setSanciones] = useState([]);
  const [statsSancion, setStatsSancion] = useState(null);
  // Usuario a preseleccionar al saltar al Centro de Mando desde otra vista.
  const [objetivoMod, setObjetivoMod] = useState(null);

  // Secciones del panel que el usuario actual puede ver (según su rol en el servidor).
  const [misPermisos, setMisPermisos] = useState(null);

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

  const cargarUso = () => apiFetch(`/api/stats/uso${gp()}`).then(procesarRespuesta).then((datos) => {
    setUsoStats(datos);
    if (datos.servidor) setServidorInfo(datos.servidor);
    if (typeof datos.esPremium === 'boolean') setEsPremium(datos.esPremium);
    setErrorConexion('');
  }).catch(reportarError('cargando uso'));

  const cargarPing = () => apiFetch('/api/ping')
  .then(procesarRespuesta)
  .then((datos) => setPing(datos.ping))
  .catch(() => setPing(null));
 
  const cargarRoles = () => apiFetch(`/api/servidor/roles${gp()}`).then(procesarRespuesta).then((datos) => setRoles(Array.isArray(datos) ? datos : [])).catch(reportarError('cargando roles'));
  const cargarCategorias = () => apiFetch(`/api/servidor/categorias${gp()}`).then(procesarRespuesta).then((datos) => setCategorias(Array.isArray(datos) ? datos : [])).catch(reportarError('cargando categorías'));

  // --- Gestión de roles (panel mejorado) ---
  const cargarRolesDetalle = () => apiFetch(`/api/roles${gp()}`).then(procesarRespuesta).then((datos) => { setRolesDetalle(Array.isArray(datos) ? datos : []); setErrorConexion(''); }).catch(reportarError('cargando roles'));
  const cargarPermisosCatalogo = () => apiFetch('/api/roles/catalogo').then(procesarRespuesta).then((datos) => setPermisosCatalogo(Array.isArray(datos) ? datos : [])).catch(reportarError('cargando catálogo de permisos'));

  // Crea un rol y refresca la lista. Devuelve true/false según el resultado.
  const crearRol = async ({ nombre, color, permisos }) => {
    try {
      const res = await apiFetch('/api/roles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, nombre, color, permisos }),
      });
      const data = await res.json();
      if (data.success) { await cargarRolesDetalle(); return true; }
    } catch (error) { console.error('Error creando rol:', error); }
    return false;
  };

  // Edita un rol existente (nombre / color / permisos) y refresca la lista.
  const editarRol = async (roleId, { nombre, color, permisos }) => {
    try {
      const res = await apiFetch(`/api/roles/${roleId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, nombre, color, permisos }),
      });
      const data = await res.json();
      if (data.success) { await cargarRolesDetalle(); return true; }
    } catch (error) { console.error('Error editando rol:', error); }
    return false;
  };

  // Elimina un rol (con confirmación previa) y refresca la lista.
  const eliminarRol = async (roleId) => {
    try {
      const res = await apiFetch(`/api/roles/${roleId}${gp()}`, { method: 'DELETE' });
      if (res.ok) { await cargarRolesDetalle(); return true; }
    } catch (error) { console.error('Error eliminando rol:', error); }
    return false;
  };

  // Miembros que tienen un rol concreto (para el desplegable). Devuelve un array.
  const listarMiembrosRol = async (roleId) => {
    try {
      const res = await apiFetch(`/api/roles/${roleId}/miembros${gp()}`);
      const datos = await res.json();
      return Array.isArray(datos) ? datos : [];
    } catch (error) { console.error('Error listando miembros del rol:', error); return []; }
  };

  // Busca miembros del servidor por nombre (para elegir a quién asignar). Devuelve un array.
  const buscarMiembros = async (q) => {
    try {
      const sep = gp() ? '&' : '?';
      const res = await apiFetch(`/api/servidor/miembros${gp()}${sep}q=${encodeURIComponent(q || '')}`);
      const datos = await res.json();
      return Array.isArray(datos) ? datos : [];
    } catch (error) { console.error('Error buscando miembros:', error); return []; }
  };

  // Asigna un rol a un miembro y refresca los contadores de la lista.
  const asignarRolMiembro = async (roleId, userId) => {
    try {
      const res = await apiFetch(`/api/roles/${roleId}/miembros`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, userId }),
      });
      if (res.ok) { await cargarRolesDetalle(); return true; }
    } catch (error) { console.error('Error asignando rol:', error); }
    return false;
  };

  // Quita un rol a un miembro y refresca los contadores de la lista.
  const quitarRolMiembro = async (roleId, userId) => {
    try {
      const res = await apiFetch(`/api/roles/${roleId}/miembros/${userId}${gp()}`, { method: 'DELETE' });
      if (res.ok) { await cargarRolesDetalle(); return true; }
    } catch (error) { console.error('Error quitando rol:', error); }
    return false;
  };

  // Guarda el autorol al entrar (personas + bots) y refresca la config.
  const guardarAutoRoles = async ({ autoRoles, autoRolesBots }) => {
    if (!configServidor) return false;
    try {
      const res = await apiFetch(`/api/config/${configServidor.guildId}/autoroles`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoRoles, autoRolesBots }),
      });
      const data = await res.json();
      if (data.success && data.config) { setConfigServidor(data.config); return true; }
    } catch (error) { console.error('Error guardando autoroles:', error); }
    return false;
  };

  // --- Paneles de autoasignación de roles ---
  const cargarPaneles = () => apiFetch(`/api/paneles${gp()}`).then(procesarRespuesta).then((datos) => setPaneles(Array.isArray(datos) ? datos : [])).catch(reportarError('cargando paneles'));
  const cargarCanales = () => apiFetch(`/api/servidor/canales${gp()}`).then(procesarRespuesta).then((datos) => setCanales(Array.isArray(datos) ? datos : [])).catch(reportarError('cargando canales'));
  const cargarEmojisServidor = () => apiFetch(`/api/servidor/emojis${gp()}`).then(procesarRespuesta).then((datos) => setEmojisServidor(Array.isArray(datos) ? datos : [])).catch(reportarError('cargando emojis'));
  const cargarStickers = () => apiFetch(`/api/servidor/stickers${gp()}`).then(procesarRespuesta).then((datos) => setStickers(Array.isArray(datos) ? datos : [])).catch(reportarError('cargando stickers'));

  // Crea un emoji desde una imagen (dataURL). Refresca la lista. Devuelve {error} si falla.
  const crearEmoji = async ({ nombre, datos }) => {
    try {
      const res = await apiFetch('/api/servidor/emojis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId, nombre, datos }) });
      const data = await res.json();
      if (data.success) { await cargarEmojisServidor(); return data; }
      return { error: data.error || 'No se pudo crear' };
    } catch (error) { console.error('Error creando emoji:', error); return { error: 'Fallo de conexión' }; }
  };
  const eliminarEmoji = async (emojiId) => {
    try { const res = await apiFetch(`/api/servidor/emojis/${emojiId}${gp()}`, { method: 'DELETE' }); if (res.ok) { await cargarEmojisServidor(); return true; } }
    catch (error) { console.error('Error eliminando emoji:', error); }
    return false;
  };
  const crearSticker = async ({ nombre, datos }) => {
    try {
      const res = await apiFetch('/api/servidor/stickers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId, nombre, datos }) });
      const data = await res.json();
      if (data.success) { await cargarStickers(); return data; }
      return { error: data.error || 'No se pudo crear' };
    } catch (error) { console.error('Error creando sticker:', error); return { error: 'Fallo de conexión' }; }
  };
  const eliminarSticker = async (stickerId) => {
    try { const res = await apiFetch(`/api/servidor/stickers/${stickerId}${gp()}`, { method: 'DELETE' }); if (res.ok) { await cargarStickers(); return true; } }
    catch (error) { console.error('Error eliminando sticker:', error); }
    return false;
  };

  // --- Niveles / XP ---
  const cargarRanking = () => apiFetch(`/api/niveles/ranking${gp()}`).then(procesarRespuesta).then((datos) => setRanking(Array.isArray(datos) ? datos : [])).catch(reportarError('cargando ranking'));
  // Catálogo GLOBAL de presets de tarjeta (no depende del servidor).
  const cargarCatalogoPresets = () => apiFetch('/api/presets-tarjeta').then(procesarRespuesta).then((datos) => setCatalogoPresets({ ocultos: datos?.ocultos || [], personalizados: datos?.personalizados || [] })).catch(reportarError('cargando catálogo de presets'));
  const guardarCatalogoPresets = async (datos) => {
    try {
      const res = await apiFetch('/api/presets-tarjeta', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
      });
      const data = await res.json();
      if (data.success) { setCatalogoPresets({ ocultos: data.ocultos || [], personalizados: data.personalizados || [] }); return true; }
    } catch (error) { console.error('Error guardando catálogo de presets:', error); }
    return false;
  };
  const guardarNiveles = async (cambios) => {
    if (!configServidor) return false;
    try {
      const res = await apiFetch(`/api/config/${configServidor.guildId}/niveles`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios),
      });
      const data = await res.json();
      if (data.success && data.config) { setConfigServidor(data.config); return true; }
    } catch (error) { console.error('Error guardando niveles:', error); }
    return false;
  };

  // Crea un panel (el backend lo publica si trae canal). Refresca la lista.
  const crearPanel = async (datos) => {
    try {
      const res = await apiFetch('/api/paneles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, ...datos }),
      });
      const data = await res.json();
      if (data.success) { await cargarPaneles(); return data; }
    } catch (error) { console.error('Error creando panel:', error); }
    return null;
  };

  // Edita un panel existente y lo republica. Refresca la lista.
  const editarPanel = async (id, datos) => {
    try {
      const res = await apiFetch(`/api/paneles/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const data = await res.json();
      if (data.success) { await cargarPaneles(); return data; }
    } catch (error) { console.error('Error editando panel:', error); }
    return null;
  };

  // Publica / republica un panel (opcionalmente con un canal nuevo).
  const publicarPanel = async (id, channelId) => {
    try {
      const res = await apiFetch(`/api/paneles/${id}/publicar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      if (data.success) { await cargarPaneles(); return true; }
      return data;
    } catch (error) { console.error('Error publicando panel:', error); }
    return null;
  };

  // Sube una imagen/gif (dataURL base64) para un panel. Devuelve { archivo, url } o { error }.
  const subirImagenPanel = async (dataUrl) => {
    try {
      const res = await apiFetch('/api/paneles/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos: dataUrl }),
      });
      const data = await res.json();
      return data.success ? data : { error: data.error || 'Fallo al subir' };
    } catch (error) { console.error('Error subiendo imagen:', error); return { error: 'Fallo al subir' }; }
  };

  // Elimina un panel (y su mensaje publicado). Refresca la lista.
  const eliminarPanel = async (id) => {
    try {
      const res = await apiFetch(`/api/paneles/${id}`, { method: 'DELETE' });
      if (res.ok) { await cargarPaneles(); return true; }
    } catch (error) { console.error('Error eliminando panel:', error); }
    return false;
  };

  // --- MODERACIÓN (Centro de Mando) ---
  const cargarTiposSancion = () => apiFetch(`/api/sanciones/tipos${gp()}`).then(procesarRespuesta).then((datos) => setTiposSancion(Array.isArray(datos) ? datos : [])).catch(reportarError('cargando tipos de sanción'));
  const cargarSanciones = () => apiFetch(`/api/sanciones${gp()}`).then(procesarRespuesta).then((datos) => setSanciones(Array.isArray(datos) ? datos : [])).catch(reportarError('cargando registro'));
  const cargarStatsSancion = () => apiFetch(`/api/sanciones/stats${gp()}`).then(procesarRespuesta).then((datos) => setStatsSancion(datos)).catch(reportarError('cargando estadísticas'));

  // CRUD de tipos de sanción.
  const crearTipoSancion = async (datos) => {
    try {
      const res = await apiFetch('/api/sanciones/tipos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId, ...datos }) });
      const data = await res.json();
      if (data.success) { await cargarTiposSancion(); return true; }
    } catch (error) { console.error('Error creando tipo de sanción:', error); }
    return false;
  };
  const editarTipoSancion = async (id, datos) => {
    try {
      const res = await apiFetch(`/api/sanciones/tipos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
      const data = await res.json();
      if (data.success) { await cargarTiposSancion(); return true; }
    } catch (error) { console.error('Error editando tipo de sanción:', error); }
    return false;
  };
  const eliminarTipoSancion = async (id) => {
    try {
      const res = await apiFetch(`/api/sanciones/tipos/${id}`, { method: 'DELETE' });
      if (res.ok) { await cargarTiposSancion(); return true; }
    } catch (error) { console.error('Error eliminando tipo de sanción:', error); }
    return false;
  };

  // Ficha de un miembro (para el Centro de Mando). Devuelve el objeto o null.
  const cargarMiembro = async (userId) => {
    try {
      const res = await apiFetch(`/api/servidor/miembro/${userId}${gp()}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (error) { console.error('Error cargando miembro:', error); return null; }
  };

  // Resumen de actividad de un usuario (último mensaje, voz, conteo).
  const cargarActividad = async (userId) => {
    try {
      const res = await apiFetch(`/api/servidor/actividad/${userId}${gp()}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (error) { console.error('Error cargando actividad:', error); return null; }
  };

  // Registro de mensajes recientes de un usuario. Devuelve un array.
  const cargarMensajesUsuario = async (userId) => {
    try {
      const res = await apiFetch(`/api/servidor/mensajes/${userId}${gp()}`);
      const datos = await res.json();
      return Array.isArray(datos) ? datos : [];
    } catch (error) { console.error('Error cargando mensajes del usuario:', error); return []; }
  };

  // Aplica una sanción a un usuario (por tipoId guardado o por acción rápida).
  // Devuelve { success, sancion } o { error }.
  const aplicarSancion = async (payload) => {
    try {
      const res = await apiFetch('/api/sanciones/aplicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId, ...payload }) });
      const data = await res.json();
      if (data.success) { cargarStatsSancion(); return data; }
      return { error: data.error || 'No se pudo aplicar' };
    } catch (error) { console.error('Error aplicando sanción:', error); return { error: 'Fallo de conexión' }; }
  };

  // Revoca una sanción (desbanea / quita aislamiento).
  const revocarSancion = async (id) => {
    try {
      const res = await apiFetch(`/api/sanciones/${id}/revocar`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { await cargarSanciones(); cargarStatsSancion(); return true; }
    } catch (error) { console.error('Error revocando sanción:', error); }
    return false;
  };

  // Guarda los ajustes de moderación (canal de registro + aviso por MD) y refresca la config.
  const guardarModLog = async (cambios) => {
    if (!configServidor) return false;
    try {
      const res = await apiFetch(`/api/config/${configServidor.guildId}/modlog`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios),
      });
      const data = await res.json();
      if (data.success && data.config) { setConfigServidor(data.config); return true; }
    } catch (error) { console.error('Error guardando ajustes de moderación:', error); }
    return false;
  };

  // Guarda la configuración del automoderador y refresca la config.
  const guardarAutomod = async (automod) => {
    if (!configServidor) return false;
    try {
      const res = await apiFetch(`/api/config/${configServidor.guildId}/automod`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ automod }),
      });
      const data = await res.json();
      if (data.success && data.config) { setConfigServidor(data.config); return true; }
    } catch (error) { console.error('Error guardando automod:', error); }
    return false;
  };

  // --- SEGURIDAD: verificación ---
  const guardarVerificacion = async (verificacion) => {
    if (!configServidor) return false;
    try {
      const res = await apiFetch(`/api/config/${configServidor.guildId}/verificacion`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verificacion }),
      });
      const data = await res.json();
      if (data.success && data.config) { setConfigServidor(data.config); return true; }
    } catch (error) { console.error('Error guardando verificación:', error); }
    return false;
  };
  const publicarVerificacion = async () => {
    if (!configServidor) return { error: 'Sin servidor' };
    try {
      const res = await apiFetch(`/api/seguridad/${configServidor.guildId}/verificacion/publicar`, { method: 'POST' });
      const data = await res.json();
      return data.success ? data : { error: data.error || 'No se pudo publicar' };
    } catch (error) { console.error('Error publicando verificación:', error); return { error: 'Fallo de red' }; }
  };

  // --- SEGURIDAD: reportes ---
  const guardarReportes = async (reportesCfg) => {
    if (!configServidor) return false;
    try {
      const res = await apiFetch(`/api/config/${configServidor.guildId}/reportes`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportes: reportesCfg }),
      });
      const data = await res.json();
      if (data.success && data.config) { setConfigServidor(data.config); return true; }
    } catch (error) { console.error('Error guardando reportes:', error); }
    return false;
  };
  const cargarReportes = () => apiFetch(`/api/reportes${gp()}`).then(procesarRespuesta).then((d) => setReportes(Array.isArray(d) ? d : [])).catch(reportarError('cargando reportes'));
  const actualizarReporte = async (id, estado) => {
    try {
      const res = await apiFetch(`/api/reportes/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }),
      });
      const data = await res.json();
      if (data.success && data.reporte) { setReportes((prev) => prev.map((r) => r._id === id ? data.reporte : r)); return true; }
    } catch (error) { console.error('Error actualizando reporte:', error); }
    return false;
  };
  const abrirTicketReporte = async (id) => {
    try {
      const res = await apiFetch(`/api/reportes/${id}/ticket`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (data.reporte) setReportes((prev) => prev.map((r) => r._id === id ? data.reporte : r));
        return data;
      }
      return { error: data.error || 'No se pudo abrir el ticket' };
    } catch (error) { console.error('Error abriendo ticket desde reporte:', error); return { error: 'Fallo de red' }; }
  };

  // --- SEGURIDAD: backup (exportar / importar config) ---
  const exportarConfig = async () => {
    if (!configServidor) return false;
    try {
      const res = await apiFetch(`/api/config/${configServidor.guildId}/export`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `sokyo-config-${configServidor.guildId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch (error) { console.error('Error exportando config:', error); return false; }
  };
  const importarConfig = async (objeto) => {
    if (!configServidor) return false;
    try {
      const res = await apiFetch(`/api/config/${configServidor.guildId}/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(objeto),
      });
      const data = await res.json();
      if (data.success && data.config) { setConfigServidor(data.config); return true; }
    } catch (error) { console.error('Error importando config:', error); }
    return false;
  };

  // --- PAGOS: estado del plan + subir / gestionar suscripción (Stripe) ---
  const [billing, setBilling] = useState(null);
  const cargarEstadoBilling = () =>
    apiFetch(`/api/billing/estado${gp()}`).then(procesarRespuesta)
      .then((d) => setBilling(d))
      .catch(reportarError('cargando estado de pago'));
  const irACheckout = async (plan, intervalo) => {
    const gid = guildId || (configServidor && configServidor.guildId);
    if (!gid) return { error: 'Selecciona un servidor' };
    try {
      const res = await apiFetch('/api/billing/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: gid, plan, intervalo }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return { ok: true }; }
      return { error: data.error || 'No se pudo iniciar el pago' };
    } catch (error) { console.error('Error en checkout:', error); return { error: 'Fallo de red' }; }
  };
  const abrirPortalPago = async () => {
    const gid = guildId || (configServidor && configServidor.guildId);
    if (!gid) return { error: 'Selecciona un servidor' };
    try {
      const res = await apiFetch('/api/billing/portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: gid }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return { ok: true }; }
      return { error: data.error || 'No se pudo abrir el portal' };
    } catch (error) { console.error('Error abriendo portal:', error); return { error: 'Fallo de red' }; }
  };

  // --- IA en tickets (Pro): resumen / respuesta sugerida ---
  const iaTicket = async (canalId, accion) => {
    try {
      const res = await apiFetch(`/api/tickets/${canalId}/ia/${accion}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.texto) return { texto: data.texto };
      return { error: data.error || 'La IA no respondió' };
    } catch (error) { console.error('Error IA:', error); return { error: 'Fallo de red' }; }
  };
  // Descarga el transcript HTML del ticket (Pro).
  const descargarTranscript = async (canalId) => {
    try {
      const res = await apiFetch(`/api/tickets/${canalId}/transcript`);
      if (!res.ok) { const d = await res.json().catch(() => ({})); return { error: d.error || 'No disponible' }; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `transcript-${canalId}.html`;
      a.click();
      URL.revokeObjectURL(url);
      return { ok: true };
    } catch (error) { console.error('Error transcript:', error); return { error: 'Fallo de red' }; }
  };

  // --- ANALÍTICA (Pro) ---
  const [analitica, setAnalitica] = useState(null);
  const cargarAnalitica = (dias = 30) => {
    const sep = gp() ? '&' : '?';
    return apiFetch(`/api/stats/analitica${gp()}${sep}dias=${dias}`).then(procesarRespuesta)
      .then(setAnalitica)
      .catch(reportarError('cargando analítica'));
  };

  // --- PRODUCTIVIDAD: auto-respuestas / triggers ---
  const guardarAutoRespuestas = async (autoRespuestas) => {
    if (!configServidor) return false;
    try {
      const res = await apiFetch(`/api/config/${configServidor.guildId}/autorespuestas`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoRespuestas }),
      });
      const data = await res.json();
      if (data.success && data.config) { setConfigServidor(data.config); return true; }
    } catch (error) { console.error('Error guardando auto-respuestas:', error); }
    return false;
  };

  // --- PRODUCTIVIDAD: constructor de embeds (enviar ahora) ---
  const enviarEmbed = async ({ canalId, contenido, embed }) => {
    if (!configServidor) return { error: 'Sin servidor' };
    try {
      const res = await apiFetch(`/api/embed/${configServidor.guildId}/enviar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canalId, contenido, embed }),
      });
      const data = await res.json();
      return data.success ? data : { error: data.error || 'No se pudo enviar' };
    } catch (error) { console.error('Error enviando embed:', error); return { error: 'Fallo de red' }; }
  };

  // --- PRODUCTIVIDAD: anuncios programados ---
  const cargarAnuncios = () => apiFetch(`/api/anuncios${gp()}`).then(procesarRespuesta).then((d) => setAnuncios(Array.isArray(d) ? d : [])).catch(reportarError('cargando anuncios'));
  const crearAnuncio = async (payload) => {
    try {
      const res = await apiFetch('/api/anuncios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId, ...payload }) });
      const data = await res.json();
      if (data.success) { await cargarAnuncios(); return data; }
      return { error: data.error || 'No se pudo crear' };
    } catch (error) { console.error('Error creando anuncio:', error); return { error: 'Fallo de red' }; }
  };
  const eliminarAnuncio = async (id) => {
    try { const res = await apiFetch(`/api/anuncios/${id}`, { method: 'DELETE' }); if (res.ok) { await cargarAnuncios(); return true; } }
    catch (error) { console.error('Error borrando anuncio:', error); }
    return false;
  };

  // --- PRODUCTIVIDAD: presets de anuncio (mensajes guardados) ---
  const cargarPresetsAnuncio = () => apiFetch(`/api/anuncios/presets${gp()}`).then(procesarRespuesta).then((d) => setPresetsAnuncio(Array.isArray(d) ? d : [])).catch(reportarError('cargando presets'));
  const guardarPresetAnuncio = async (payload) => {
    try {
      const res = await apiFetch('/api/anuncios/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId, ...payload }) });
      const data = await res.json();
      if (data.success) { await cargarPresetsAnuncio(); return data; }
      return { error: data.error || 'No se pudo guardar' };
    } catch (error) { console.error('Error guardando preset:', error); return { error: 'Fallo de red' }; }
  };
  const eliminarPresetAnuncio = async (id) => {
    try { const res = await apiFetch(`/api/anuncios/presets/${id}`, { method: 'DELETE' }); if (res.ok) { await cargarPresetsAnuncio(); return true; } }
    catch (error) { console.error('Error borrando preset:', error); }
    return false;
  };

  // --- PRODUCTIVIDAD: difusión (solo IDs autorizadas en BROADCAST_IDS) ---
  const cargarBroadcast = () => apiFetch('/api/broadcast/permitido').then(procesarRespuesta)
    .then((d) => { setEsBroadcaster(!!(d && d.permitido)); setServidoresBot((d && d.servidores) || 0); })
    .catch(() => { setEsBroadcaster(false); });
  const difundir = async ({ alcance, guildId: gid, canalId, contenido, embed }) => {
    try {
      const res = await apiFetch('/api/broadcast/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alcance, guildId: gid, canalId, contenido, embed }),
      });
      const data = await res.json();
      return data.success ? data : { error: data.error || 'No se pudo difundir' };
    } catch (error) { console.error('Error difundiendo:', error); return { error: 'Fallo de red' }; }
  };

  // Carga qué secciones puede ver el usuario actual en el servidor seleccionado.
  const cargarMisPermisos = () => apiFetch(`/api/mis-permisos${gp()}`).then(procesarRespuesta).then((d) => setMisPermisos(d && d.areas ? d.areas : null)).catch(() => setMisPermisos(null));

  // Guarda acceso al panel + roles de moderación + distribución de secciones.
  const guardarAcceso = async ({ rolesPanelAcceso, rolesModeracion, accesoAreas }) => {
    if (!configServidor) return false;
    try {
      const res = await apiFetch(`/api/config/${configServidor.guildId}/acceso`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rolesPanelAcceso, rolesModeracion, accesoAreas }),
      });
      const data = await res.json();
      if (data.success && data.config) { setConfigServidor(data.config); cargarMisPermisos(); return true; }
    } catch (error) { console.error('Error guardando acceso:', error); }
    return false;
  };

  // Sube una imagen de prueba (dataURL). Devuelve { archivo, url } o { error }.
  const subirPrueba = async (dataUrl) => {
    try {
      const res = await apiFetch('/api/sanciones/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datos: dataUrl }) });
      const data = await res.json();
      return data.success ? data : { error: data.error || 'Fallo al subir' };
    } catch (error) { console.error('Error subiendo prueba:', error); return { error: 'Fallo al subir' }; }
  };

  // Guarda las etiquetas de un ticket y refresca la lista + el ticket abierto.
  const guardarEtiquetas = async (canalId, etiquetas) => {
    try {
      const res = await apiFetch(`/api/tickets/${canalId}/etiquetas`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etiquetas }),
      });
      const data = await res.json();
      if (data.success && data.ticket) {
        setTicketsReales(ticketsReales.map((t) => t.canalId === canalId ? data.ticket : t));
        if (ticketSeleccionado?.canalId === canalId) setTicketSeleccionado(data.ticket);
      }
    } catch (error) { console.error('Error guardando etiquetas:', error); }
  };

  // Guarda las respuestas rápidas (macros) y refresca la config.
  const guardarMacros = async (respuestasRapidas) => {
    if (!configServidor) return false;
    try {
      const res = await apiFetch(`/api/config/${configServidor.guildId}/macros`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ respuestasRapidas }),
      });
      const data = await res.json();
      if (data.success && data.config) { setConfigServidor(data.config); return true; }
    } catch (error) { console.error('Error guardando macros:', error); }
    return false;
  };

  // Guarda reglas (rol staff, categoría, límite, auto-cierre) y refresca la config.
  const guardarReglas = async (cambios) => {
    if (!configServidor) return;
    try {
      const res = await apiFetch(`/api/config/${configServidor.guildId}/reglas`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios),
      });
      const data = await res.json();
      if (data.success && data.config) { setConfigServidor(data.config); return true; }
    } catch (error) { console.error('Error guardando reglas:', error); }
    return false;
  };

  // Guarda los ajustes de comportamiento y refresca la config en memoria.
  const guardarComportamiento = async (cambios) => {
    if (!configServidor) return;
    try {
      const res = await apiFetch(`/api/config/${configServidor.guildId}/comportamiento`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios),
      });
      const data = await res.json();
      if (data.success && data.config) { setConfigServidor(data.config); return true; }
    } catch (error) { console.error('Error guardando comportamiento:', error); }
    return false;
  };

  const cargarServidores = () => apiFetch(`/api/guilds`).then(procesarRespuesta).then((datos) => setServidores(Array.isArray(datos) ? datos : [])).catch(reportarError('cargando servidores'));
  const cargarTickets = () => apiFetch(`/api/tickets${gp()}`).then(procesarRespuesta).then((datos) => { setTicketsReales(datos); setErrorConexion(''); }).catch(reportarError('cargando tickets'));
  const cargarUsuariosStats = () => apiFetch(`/api/usuarios/stats${gp()}`).then(procesarRespuesta).then((datos) => { setUsuariosStats(datos); setErrorConexion(''); }).catch(reportarError('cargando usuarios'));

  const cargarLogs = () => {
    apiFetch(`/api/logs${gp()}`)
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
    apiFetch(`/api/servidores${gp()}`).then(procesarRespuesta).then((datos) => {
      setErrorConexion('');
      if (datos && datos.length > 0) {
        setConfigServidor(datos[0]); setMotivos(datos[0].motivos || []);
        setUrgencias(datos[0].urgencias || [{ nombre: 'Urgente', color: '#e74c3c', nivel: 4 }, { nombre: 'Alta', color: '#e67e22', nivel: 3 }, { nombre: 'Normal', color: '#3498db', nivel: 2 }, { nombre: 'Baja', color: '#95a5a6', nivel: 1 }]);
        setTituloMensaje(datos[0].mensajeSoporteTitulo || '🎫 Soporte Técnico Activo'); setDescripcionMensaje(datos[0].mensajeSoporteDescripcion || 'Haz clic en el botón de abajo para abrir un ticket de soporte.'); setFooterMensaje(datos[0].footerPersonalizado || 'Sistema de Gestión Sokyo');
        setColorEmbed(datos[0].colorEmbed || '#5865F2');
        setTextoBoton(datos[0].textoBoton || '📩 Abrir Ticket');
        setMensajeBienvenida(datos[0].mensajeBienvenida || 'Un miembro del equipo lo revisará en breve.');
        setPrefijo(datos[0].prefijo || '!');
        setCategoriaArchivados(datos[0].categoriaArchivados || '🗄️ Tickets Archivados');
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
    const res = await apiFetch(`/api/config/${configServidor.guildId}/textos`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: tituloMensaje, descripcion: descripcionMensaje, footer: footerMensaje,
        colorEmbed, textoBoton, mensajeBienvenida, prefijo, categoriaArchivados,
      }),
    });
    if (res.ok) { const data = await res.json().catch(() => null); if (data?.config) setConfigServidor(data.config); alert('✅ Personalización actualizada!'); }
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

  // Carga la lista de servidores del bot una vez al montar.
  useEffect(() => {
    cargarServidores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el tema guardado es premium y el plan deja de serlo, vuelve a 'lima'.
  // Si aún no hay servidor elegido, selecciona el primero disponible.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isPremiumTheme(theme) && !esPremium) {
      setThemeState('lima');
      localStorage.setItem('sokyoTheme', 'lima');
    }
  }, [esPremium, theme]);

  useEffect(() => {
    if (!guildId && servidores.length > 0) setGuildId(servidores[0].id);
  }, [servidores, guildId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Recarga qué secciones puede ver el usuario al cambiar de servidor.
  useEffect(() => {
    if (guildId) cargarMisPermisos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  // Recarga los datos de la pestaña activa (también al cambiar de servidor).
  useEffect(() => {
    if (activeTab === 'inicio') { cargarUso(); cargarTickets(); cargarLogs(); cargarUsuariosStats(); cargarConfiguracion(); cargarPing(); }
    else if (activeTab === 'tickets-gestion') { cargarTickets(); cargarConfiguracion(); }
    else if (activeTab === 'config-comportamiento') { cargarConfiguracion(); cargarRoles(); }
    else if (activeTab === 'config-reglas') { cargarConfiguracion(); cargarRoles(); cargarCategorias(); }
    else if (activeTab === 'config-acceso') { cargarConfiguracion(); cargarRoles(); }
    else if (activeTab === 'config-expresiones') { cargarEmojisServidor(); cargarStickers(); }
    else if (activeTab === 'config-niveles') { cargarConfiguracion(); cargarCanales(); cargarRoles(); cargarRanking(); cargarCatalogoPresets(); }
    else if (activeTab === 'roles-gestion') { cargarRolesDetalle(); cargarPermisosCatalogo(); }
    else if (activeTab === 'roles-autorol') { cargarConfiguracion(); cargarRolesDetalle(); }
    else if (activeTab === 'roles-paneles') { cargarRolesDetalle(); cargarPaneles(); cargarCanales(); cargarEmojisServidor(); }
    else if (activeTab === 'mod-centro') { cargarTiposSancion(); cargarStatsSancion(); cargarSanciones(); }
    else if (activeTab === 'mod-tipos') { cargarTiposSancion(); }
    else if (activeTab === 'mod-automod') { cargarConfiguracion(); cargarRoles(); cargarCanales(); }
    else if (activeTab === 'seg-verificacion') { cargarConfiguracion(); cargarRoles(); cargarCanales(); }
    else if (activeTab === 'seg-reportes' || activeTab === 'mod-reportes') { cargarConfiguracion(); cargarCanales(); cargarReportes(); }
    else if (activeTab === 'seg-backup') { cargarConfiguracion(); }
    else if (activeTab === 'cuenta-plan') { cargarConfiguracion(); cargarEstadoBilling(); }
    else if (activeTab === 'datos-analitica') { cargarConfiguracion(); cargarAnalitica(); }
    else if (activeTab === 'prod-autorespuestas') { cargarConfiguracion(); }
    else if (activeTab === 'prod-embeds') { cargarConfiguracion(); cargarCanales(); cargarPresetsAnuncio(); cargarBroadcast(); }
    else if (activeTab === 'prod-anuncios') { cargarConfiguracion(); cargarCanales(); cargarAnuncios(); cargarPresetsAnuncio(); }
    else if (activeTab === 'mod-registro') { cargarSanciones(); cargarTiposSancion(); cargarConfiguracion(); cargarCanales(); }
    else if (activeTab === 'tickets-config' || activeTab === 'config' || activeTab === 'config-textos' || activeTab === 'config-macros') cargarConfiguracion();
    else if (activeTab === 'tickets-usuarios') cargarUsuariosStats();
    else if (activeTab.startsWith('logs-')) cargarLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, guildId]);

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
    // multi-servidor
    guildId, setGuildId, servidores,
    // buscador
    query, setQuery,
    // uso de memoria / servidor
    usoStats, servidorInfo,
    // comportamiento (Fase 1)
    roles, guardarComportamiento,
    // reglas (Fase 3)
    categorias, guardarReglas,
    // gestión de roles (panel mejorado)
    rolesDetalle, permisosCatalogo, crearRol, editarRol, eliminarRol,
    listarMiembrosRol, buscarMiembros, asignarRolMiembro, quitarRolMiembro,
    // sistema de roles: autorol + paneles
    guardarAutoRoles,
    paneles, canales, emojisServidor, crearPanel, editarPanel, publicarPanel, eliminarPanel, subirImagenPanel,
    // moderación (Centro de Mando)
    tiposSancion, sanciones, statsSancion, objetivoMod, setObjetivoMod,
    cargarTiposSancion, cargarSanciones, cargarStatsSancion,
    crearTipoSancion, editarTipoSancion, eliminarTipoSancion,
    cargarMiembro, cargarActividad, cargarMensajesUsuario, aplicarSancion, revocarSancion, subirPrueba, guardarModLog,
    // automoderador
    guardarAutomod,
    // seguridad
    guardarVerificacion, publicarVerificacion,
    reportes, guardarReportes, cargarReportes, actualizarReporte, abrirTicketReporte,
    exportarConfig, importarConfig,
    // pagos / suscripción (Stripe)
    billing, cargarEstadoBilling, irACheckout, abrirPortalPago,
    // IA en tickets + transcript + analítica (Pro)
    iaTicket, descargarTranscript, analitica, cargarAnalitica,
    // productividad: auto-respuestas, embeds, anuncios programados
    guardarAutoRespuestas, enviarEmbed,
    anuncios, cargarAnuncios, crearAnuncio, eliminarAnuncio,
    presetsAnuncio, cargarPresetsAnuncio, guardarPresetAnuncio, eliminarPresetAnuncio,
    esBroadcaster, servidoresBot, difundir,
    subirImagen: subirImagenPanel, // subida genérica de imágenes a /uploads
    // acceso y permisos
    guardarAcceso, misPermisos,
    // emojis y stickers
    stickers, crearEmoji, eliminarEmoji, crearSticker, eliminarSticker,
    // niveles
    ranking, guardarNiveles,
    catalogoPresets, guardarCatalogoPresets,
    // productividad: macros + etiquetas
    guardarMacros, guardarEtiquetas,
    // tickets
    ticketsReales, ticketSeleccionado, setTicketSeleccionado,
    // chat / notas
    mensajes, nuevoMensaje, setNuevoMensaje, nuevaNota, setNuevaNota,
    // config textos
    configServidor, tituloMensaje, setTituloMensaje, descripcionMensaje, setDescripcionMensaje, footerMensaje, setFooterMensaje,
    // personalización (Fase 2)
    colorEmbed, setColorEmbed, textoBoton, setTextoBoton, mensajeBienvenida, setMensajeBienvenida, prefijo, setPrefijo, categoriaArchivados, setCategoriaArchivados,
    // incidencias
    motivos, nuevoMotivo, setNuevoMotivo, nuevaUrgencia, setNuevaUrgencia,
    urgencias, nuevaUrgNombre, setNuevaUrgNombre, nuevaUrgColor, setNuevaUrgColor, nuevaUrgNivel, setNuevaUrgNivel,
    // usuarios
    usuariosStats,
    // logs
    logsRegistrados, limiteLogs, esPremium,
    // errores
    errorConexion, ping,
    // acciones
    verMensajes, cerrarMensajes, enviarMensaje, agregarNotaInterna,
    handleCerrarTicket, handleReabrirTicket, handleOcultarTicket,
    agregarUrgencia, eliminarUrgencia, agregarMotivo, eliminarMotivo,
    guardarCambiosConfig, guardarTextosConfig,
    // helpers
    getTicketsOrdenados, getColorUrgencia, obtenerParticipantes, obtenerLogsFiltrados,
  };
}
