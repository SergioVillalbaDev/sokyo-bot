// Elige el servidor que quieres gestionar (o añade el bot a otro).
import { useEffect } from 'react';
import { api, ErrorSesion } from './api.js';
import { useDatos, avatarDe } from './util.js';
import { Cargando, Vacio } from './ui.jsx';

function Icono({ s }) {
  return s.icono
    ? <img className="servidor-icono" src={s.icono} alt="" />
    : <div className="servidor-icono">{s.nombre.slice(0, 1).toUpperCase()}</div>;
}

export default function Selector({ onElegir, onSalir }) {
  useEffect(() => { document.documentElement.setAttribute('data-theme', 'dark'); }, []);
  const yo = useDatos(() => api('/api/panel/yo').catch(e => { if (e instanceof ErrorSesion) onSalir(); throw e; }), []);
  const servidores = yo.datos?.servidores || [];
  const conBot = servidores.filter(s => s.botPresente);
  const sinBot = servidores.filter(s => !s.botPresente);

  return (
    <div className="landing">
      <div className="selector">
        <div className="fila-espaciada" style={{ marginBottom: '2rem' }}>
          <div className="logo" style={{ fontWeight: 800, fontSize: '1.35rem' }}>🤖 Sokyo · Panel</div>
          {yo.datos && (
            <div className="fila">
              <img className="avatar" src={avatarDe(yo.datos.usuario.avatar, yo.datos.usuario.username)} alt="" />
              <strong>{yo.datos.usuario.username}</strong>
              <button className="btn btn-secundario" onClick={onSalir}>Salir</button>
            </div>
          )}
        </div>

        <div className="fila-espaciada" style={{ marginBottom: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem' }}>Elige un servidor</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Aparecen los servidores donde eres administrador o formas parte del staff.</p>
          </div>
          <button className="btn btn-secundario" onClick={yo.recargar}>🔄 Actualizar</button>
        </div>

        {yo.cargando && !yo.datos && <Cargando />}
        {yo.error && <div className="aviso aviso-error">⚠️ {yo.error}</div>}

        {yo.datos && conBot.length === 0 && (
          <div className="card"><Vacio icono="🔍">Sokyo todavía no está en ninguno de tus servidores. Añádelo a uno de abajo.</Vacio></div>
        )}

        <div className="grid grid-2">
          {conBot.map(s => (
            <button key={s.id} className="card servidor-card" style={{ cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit' }} onClick={() => onElegir(s.id)}>
              <Icono s={s} />
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '1.05rem' }}>{s.nombre}</strong>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 3 }}>{s.miembros} miembros</div>
              </div>
              <span className={`insignia ${s.acceso === 'admin' ? '' : 'insignia-suave'}`} style={s.acceso === 'admin' ? { background: 'var(--accent-color)' } : undefined}>
                {s.acceso === 'admin' ? 'Admin' : 'Staff'}
              </span>
            </button>
          ))}
        </div>

        {sinBot.length > 0 && (
          <>
            <h2 style={{ fontSize: '1.2rem', margin: '2.5rem 0 1rem' }}>Añade Sokyo a otro servidor</h2>
            <div className="grid grid-2">
              {sinBot.map(s => (
                <div key={s.id} className="card servidor-card">
                  <Icono s={s} />
                  <strong style={{ flex: 1 }}>{s.nombre}</strong>
                  <a className="btn btn-primario" href={s.invitarUrl} target="_blank" rel="noreferrer">➕ Añadir</a>
                </div>
              ))}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '1rem' }}>Cuando lo añadas, pulsa “Actualizar”.</p>
          </>
        )}
      </div>
    </div>
  );
}
