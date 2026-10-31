// Componentes compartidos del panel.

export function Aviso({ aviso, onCerrar }) {
  if (!aviso) return null;
  return (
    <div className={`aviso aviso-${aviso.tipo}`} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
      <div className="fila-espaciada">
        <span>{aviso.tipo === 'error' ? '⚠️ ' : aviso.tipo === 'exito' ? '✅ ' : ''}{aviso.texto}</span>
        {onCerrar && <button className="btn btn-fantasma" onClick={onCerrar} aria-label="Cerrar aviso">✖</button>}
      </div>
    </div>
  );
}

export function Campo({ etiqueta, ayuda, children }) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      {children}
      {ayuda && <small>{ayuda}</small>}
    </label>
  );
}

export function Interruptor({ activo, onCambiar, titulo, descripcion, deshabilitado }) {
  return (
    <label className="interruptor" style={deshabilitado ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}>
      <input type="checkbox" checked={activo} disabled={deshabilitado} onChange={e => onCambiar(e.target.checked)} />
      <span className="pista" />
      <span><strong>{titulo}</strong>{descripcion && <small>{descripcion}</small>}</span>
    </label>
  );
}

export function Estrellas({ valor }) {
  if (!valor) return <span style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>Sin valorar</span>;
  return <span aria-label={`${valor} de 5`}>{[1, 2, 3, 4, 5].map(i => <span key={i} style={{ color: i <= valor ? '#f1c40f' : '#4b5563' }}>★</span>)}</span>;
}

export function Vacio({ icono = '📭', children }) {
  return <div className="vacio"><div>{icono}</div>{children}</div>;
}

export function Cargando() {
  return <div className="vacio"><div>⏳</div>Cargando...</div>;
}

// Lista de roles de Discord con casillas
export function ListaRoles({ roles, seleccion, onCambiar }) {
  if (!roles || roles.length === 0) return <small style={{ color: 'var(--text-secondary)' }}>No hay roles en este servidor.</small>;
  const alternar = (id) => onCambiar(seleccion.includes(id) ? seleccion.filter(r => r !== id) : [...seleccion, id]);
  return (
    <div className="lista-check">
      {roles.map(r => (
        <label key={r.id}>
          <input type="checkbox" checked={seleccion.includes(r.id)} onChange={() => alternar(r.id)} />
          <span className="punto" style={{ background: r.color && r.color !== '#000000' ? r.color : '#99aab5' }} />
          {r.nombre}
        </label>
      ))}
    </div>
  );
}
