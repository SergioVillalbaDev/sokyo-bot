import { useCallback, useRef, useState } from 'react';
import { api } from '../api.js';
import { navegar, useCarga, usePreferencia, useRuta, useTema } from '../hooks.js';
import { useConfirmar } from '../contexto.js';
import { Avatar, AvisoError, Cargando, Vacio } from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';
import Resumen from './Resumen.jsx';
import Tickets from './Tickets.jsx';
import TicketDetalle from './TicketDetalle.jsx';
import Usuarios from './Usuarios.jsx';
import Auditoria from './Auditoria.jsx';
import ConfigCategorias from './ConfigCategorias.jsx';
import ConfigApariencia from './ConfigApariencia.jsx';
import ConfigGeneral from './ConfigGeneral.jsx';

const SECCIONES = [
  {
    titulo: 'Soporte',
    items: [
      { ruta: '/', emoji: '📊', texto: 'Resumen' },
      { ruta: '/tickets', emoji: '🎫', texto: 'Tickets', contador: true },
      { ruta: '/usuarios', emoji: '👥', texto: 'Usuarios' }
    ]
  },
  { titulo: 'Seguridad', items: [{ ruta: '/auditoria', emoji: '📜', texto: 'Auditoría' }] },
  {
    titulo: 'Configuración',
    items: [
      { ruta: '/config/categorias', emoji: '🏷️', texto: 'Categorías y prioridades' },
      { ruta: '/config/apariencia', emoji: '🎨', texto: 'Panel y textos' },
      { ruta: '/config/general', emoji: '⚙️', texto: 'Ajustes generales' }
    ]
  }
];

const CABECERAS = {
  '/': ['Resumen', 'Cómo va el soporte del servidor de un vistazo.'],
  '/tickets': ['Tickets', 'Todas las solicitudes de soporte. Pulsa una para abrir la conversación.'],
  '/usuarios': ['Usuarios', 'Quién abre tickets y cómo valora la atención recibida.'],
  '/auditoria': ['Auditoría', 'Registro de lo que ocurre en el servidor: tickets, mensajes y miembros.'],
  '/config/categorias': ['Categorías y prioridades', 'Lo que el usuario elige al abrir un ticket y su urgencia.'],
  '/config/apariencia': ['Panel y textos', 'Personaliza el mensaje de soporte y los textos del bot (marca blanca).'],
  '/config/general': ['Ajustes generales', 'Equipo de soporte, canales, límites y módulos del bot.']
};

export default function Panel({ yo, onSalir }) {
  const { ruta, partes, consulta } = useRuta();
  const [tema, alternarTema] = useTema();
  const confirmar = useConfirmar();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [servidorGuardado, setServidorGuardado] = usePreferencia('sokyo.servidor', null);
  const cambiosPendientes = useRef(false);
  const marcarCambios = useCallback((valor) => { cambiosPendientes.current = valor; }, []);

  const servidor = yo.servidores.find(s => s.id === servidorGuardado) || yo.servidores[0];
  const guildId = servidor?.id;

  const datos = useCarga(() => (guildId ? api(`/api/servidores/${guildId}`) : Promise.resolve(null)), [guildId]);
  const resumen = useCarga(() => (guildId ? api(`/api/servidores/${guildId}/resumen`) : Promise.resolve(null)), [guildId], { intervalo: 30000 });
  const config = datos.datos?.config;
  const setConfig = useCallback((nueva) => datos.mutar(prev => ({ ...prev, config: nueva })), [datos]);

  // Si hay cambios sin guardar en la configuración, preguntamos antes de salir de la página.
  const irA = async (e, destino) => {
    e.preventDefault();
    setMenuAbierto(false);
    if (cambiosPendientes.current) {
      const salir = await confirmar({
        titulo: '¿Salir sin guardar?',
        mensaje: 'Tienes cambios sin guardar en esta página. Si sales, se perderán.',
        textoConfirmar: 'Salir sin guardar',
        peligro: true
      });
      if (!salir) return;
      cambiosPendientes.current = false;
    }
    navegar(destino);
  };

  const cambiarServidor = async (id) => {
    if (cambiosPendientes.current && !(await confirmar({ titulo: '¿Cambiar de servidor?', mensaje: 'Perderás los cambios sin guardar.', textoConfirmar: 'Cambiar', peligro: true }))) return;
    cambiosPendientes.current = false;
    setServidorGuardado(id);
    if (partes[0] === 'tickets' && partes[1]) navegar('/tickets');
  };

  const rutaBase = partes[0] === 'tickets' ? '/tickets' : ruta;
  const [titulo, subtitulo] = partes[0] === 'tickets' && partes[1]
    ? ['Ticket', 'Conversación, datos y notas internas del ticket.']
    : (CABECERAS[ruta] || CABECERAS['/']);
  const pendientes = resumen.datos?.esperandoStaff || 0;

  let vista;
  if (!servidor) {
    vista = <Vacio emoji="🤖" titulo="El bot no está en ningún servidor">Invita a Sokyo a tu servidor de Discord y vuelve a cargar esta página.</Vacio>;
  } else if (datos.error && !config) {
    vista = <AvisoError error={datos.error} onReintentar={datos.recargar} />;
  } else if (!config) {
    vista = <Cargando />;
  } else {
    const comunes = { guildId, config, setConfig, yo, servidor: datos.datos.servidor };
    const conCambios = { ...comunes, marcarCambios };
    if (partes[0] === 'tickets' && partes[1]) vista = <TicketDetalle key={partes[1]} {...comunes} canalId={partes[1]} onCambio={resumen.recargar} />;
    else if (partes[0] === 'tickets') vista = <Tickets key={`${guildId}?${consulta}`} {...comunes} consulta={consulta} />;
    else if (partes[0] === 'usuarios') vista = <Usuarios key={guildId} {...comunes} />;
    else if (partes[0] === 'auditoria') vista = <Auditoria key={guildId} {...comunes} />;
    else if (ruta === '/config/categorias') vista = <ConfigCategorias key={guildId} {...conCambios} />;
    else if (ruta === '/config/apariencia') vista = <ConfigApariencia key={guildId} {...conCambios} />;
    else if (ruta === '/config/general') vista = <ConfigGeneral key={guildId} {...conCambios} />;
    else vista = <Resumen key={guildId} {...comunes} resumen={resumen} />;
  }

  return (
    <div className="layout">
      {menuAbierto && <div className="fondo-menu" onClick={() => setMenuAbierto(false)} aria-hidden />}
      <aside className={`sidebar ${menuAbierto ? 'abierta' : ''}`} aria-label="Navegación principal">
        <div className="marca">
          <img className="logo" src="/favicon.svg" alt="" />
          <div>Sokyo<small>Panel de soporte</small></div>
        </div>

        {yo.servidores.length > 0 && (
          <div className="selector-servidor">
            <Avatar src={servidor?.icono} nombre={servidor?.nombre} tamaño={26} />
            <select className="entrada" aria-label="Servidor" value={guildId} onChange={(e) => cambiarServidor(e.target.value)} disabled={yo.servidores.length === 1}>
              {yo.servidores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        )}

        <nav className="nav">
          {SECCIONES.map(seccion => (
            <div key={seccion.titulo} className="columna" style={{ gap: 2 }}>
              <div className="nav-titulo">{seccion.titulo}</div>
              {seccion.items.map(item => (
                <a key={item.ruta} href={`#${item.ruta}`} onClick={(e) => irA(e, item.ruta)}
                  className={`nav-item ${rutaBase === item.ruta ? 'activo' : ''}`} aria-current={rutaBase === item.ruta ? 'page' : undefined}>
                  <span className="emoji" aria-hidden>{item.emoji}</span>
                  {item.texto}
                  {item.contador && pendientes > 0 && <span className="contador-nav" title="Tickets esperando respuesta del staff">{pendientes}</span>}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-pie">
          <div className="tarjeta-usuario">
            <Avatar src={yo.avatar} nombre={yo.username} tamaño={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nombre recortar">{yo.username}</div>
              <div className="texto-3 pequeño">{yo.tipo === 'apikey' ? 'Acceso con clave' : 'Staff'}</div>
            </div>
            <button className="btn btn-fantasma btn-icono btn-sm" onClick={onSalir} title="Cerrar sesión" aria-label="Cerrar sesión"><Icono nombre="salir" /></button>
          </div>
          {yo.tipo === 'discord' && (
            <a className="nav-item" href="#/portal" onClick={(e) => irA(e, '/portal')}><span className="emoji" aria-hidden>🙋</span>Mis tickets como usuario</a>
          )}
        </div>
      </aside>

      <div className="contenido">
        <header className="topbar">
          <button className="btn btn-fantasma btn-icono boton-menu" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú"><Icono nombre="menu" /></button>
          <div className="titulos">
            <h1 className="recortar">{titulo}</h1>
            <p className="recortar">{subtitulo}</p>
          </div>
          <button className="btn btn-secundario btn-icono" onClick={alternarTema} title={tema === 'dark' ? 'Tema claro' : 'Tema oscuro'} aria-label="Cambiar tema">
            <Icono nombre={tema === 'dark' ? 'sol' : 'luna'} />
          </button>
        </header>
        <main className="vista">
          <div className="vista-ancha">{vista}</div>
        </main>
      </div>
    </div>
  );
}
