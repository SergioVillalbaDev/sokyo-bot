// Panel de staff de un servidor: menú lateral + vistas.
import { useCallback, useEffect, useState } from 'react';
import { api, ErrorSesion } from './api.js';
import { useDatos, avatarDe } from './util.js';
import { Cargando } from './ui.jsx';
import Inicio from './vistas/Inicio.jsx';
import Tickets from './vistas/Tickets.jsx';
import Usuarios from './vistas/Usuarios.jsx';
import Faq from './vistas/Faq.jsx';
import Equipo from './vistas/Equipo.jsx';
import Tipos from './vistas/Tipos.jsx';
import Paneles from './vistas/Paneles.jsx';
import IA from './vistas/IA.jsx';
import Plan from './vistas/Plan.jsx';
import Logs from './vistas/Logs.jsx';

const VISTAS = {
  inicio: { titulo: 'Inicio', sub: 'Cómo va el soporte de tu servidor.', icono: '📊', C: Inicio },
  tickets: { titulo: 'Tickets', sub: 'Atiende las solicitudes de tu servidor.', icono: '🎫', C: Tickets },
  usuarios: { titulo: 'Usuarios', sub: 'Quién abre tickets y cómo valora la atención.', icono: '👥', C: Usuarios },
  faq: { titulo: 'Preguntas frecuentes', sub: 'La base de conocimiento que usa la IA para responder sola.', icono: '📚', C: Faq },
  equipo: { titulo: 'Equipo y canales', sub: 'Quién atiende los tickets y dónde se crean.', icono: '🛡️', C: Equipo, admin: true },
  tipos: { titulo: 'Tipos de ticket', sub: 'Formularios, urgencias y equipo de cada tipo de consulta.', icono: '📝', C: Tipos, admin: true },
  paneles: { titulo: 'Paneles', sub: 'Los mensajes con el botón para abrir tickets.', icono: '🧩', C: Paneles, admin: true },
  ia: { titulo: 'Inteligencia artificial', sub: 'Respuestas automáticas, triaje y ayudas para el staff.', icono: '🤖', C: IA, admin: true },
  plan: { titulo: 'Plan', sub: 'Tu plan actual y lo que incluye Premium.', icono: '⭐', C: Plan, admin: true },
  logs: { titulo: 'Registro de auditoría', sub: 'Lo que ha pasado en el servidor.', icono: '📜', C: Logs }
};

const GRUPOS = [
  { titulo: 'Soporte', vistas: ['inicio', 'tickets', 'usuarios', 'faq'] },
  { titulo: 'Configuración', vistas: ['equipo', 'tipos', 'paneles', 'ia', 'plan'] },
  { titulo: 'Registro', vistas: ['logs'] }
];

const temaGuardado = () => { try { return localStorage.getItem('sokyoTema') || 'dark'; } catch { return 'dark'; } };

export default function App({ guildId, onCambiarServidor, onSalir }) {
  const [tema, setTema] = useState(temaGuardado);
  const [vista, setVista] = useState('inicio');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem('sokyoTema', tema); } catch { /* sin almacenamiento */ }
  }, [tema]);

  // Todas las llamadas del servidor pasan por aquí: si la sesión caduca, vuelve a la web.
  const apiG = useCallback((ruta, opciones) => api(`/api/g/${guildId}${ruta}`, opciones).catch(e => {
    if (e instanceof ErrorSesion) onSalir();
    throw e;
  }), [guildId, onSalir]);

  const resumen = useDatos(() => apiG('/resumen'), [apiG]);
  const r = resumen.datos;

  if (!r) {
    return (
      <div className="landing" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {resumen.error ? (
          <div className="card" style={{ maxWidth: 440, textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem' }}>🚫</div>
            <h2 style={{ margin: '0.5rem 0' }}>No puedes entrar a este servidor</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{resumen.error}</p>
            <button className="btn btn-primario" onClick={onCambiarServidor}>Elegir otro servidor</button>
          </div>
        ) : <Cargando />}
      </div>
    );
  }

  const esAdmin = r.permisos.admin;
  const actual = VISTAS[vista]?.admin && !esAdmin ? 'inicio' : vista;
  const { C } = VISTAS[actual];

  return (
    <div className="app-container">
      <aside className="sidebar hide-on-print">
        <div className="brand">🤖 Sokyo</div>
        <div className="servidor-actual" onClick={onCambiarServidor} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onCambiarServidor()} title="Cambiar de servidor">
          {r.servidor.icono ? <img className="avatar" src={r.servidor.icono} alt="" /> : <div className="avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{r.servidor.nombre[0]}</div>}
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.servidor.nombre}</strong>
            <small>{r.plan.premium ? '⭐ Premium' : 'Plan gratis'} · cambiar</small>
          </div>
        </div>
        <nav className="nav-menu">
          {GRUPOS.map(g => {
            const visibles = g.vistas.filter(v => esAdmin || !VISTAS[v].admin);
            if (visibles.length === 0) return null;
            return (
              <div key={g.titulo} style={{ display: 'contents' }}>
                <div className="nav-titulo">{g.titulo}</div>
                {visibles.map(v => (
                  <button key={v} className={`nav-item ${actual === v ? 'active' : ''}`} onClick={() => setVista(v)}>
                    <span>{VISTAS[v].icono}</span> {VISTAS[v].titulo}
                    {v === 'tickets' && r.stats.sinReclamar > 0 && <span className="contador" title="Sin reclamar">{r.stats.sinReclamar}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="main-content print-full-width">
        <header className="header hide-on-print">
          <div>
            <h1>{VISTAS[actual].titulo}</h1>
            <p>{VISTAS[actual].sub}</p>
          </div>
          <div className="header-acciones">
            <button className="theme-toggle" onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}>{tema === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}</button>
            <img className="avatar" src={avatarDe(r.usuario.avatar, r.usuario.username)} alt="" title={r.usuario.username} />
            <button className="btn btn-secundario" onClick={onSalir}>Salir</button>
          </div>
        </header>

        <C apiG={apiG} resumen={r} recargarResumen={resumen.recargar} irA={setVista} />
      </main>
    </div>
  );
}
