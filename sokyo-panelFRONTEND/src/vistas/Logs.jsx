import { useState } from 'react';
import { useDatos, fechaHora } from '../util.js';
import { Aviso, Cargando, Vacio } from '../ui.jsx';

const CATEGORIAS = [
  ['Todos', '🌐 Todos'], ['Tickets', '🎫 Tickets'], ['IA', '🤖 IA'], ['Configuración', '⚙️ Configuración'],
  ['Mensajes Borrados', '🗑️ Borrados'], ['Mensajes Editados', '✏️ Editados'], ['Entradas', '👋 Entradas'], ['Salidas', '🚶 Salidas']
];

export default function Logs({ apiG }) {
  const datos = useDatos(() => apiG('/logs'), [apiG]);
  const [cat, setCat] = useState('Todos');
  if (datos.cargando && !datos.datos) return <Cargando />;
  const { logs = [], limite = 50, esPremium = false } = datos.datos || {};
  const filtrados = cat === 'Todos' ? logs : logs.filter(l => l.categoria === cat);

  return (
    <div className="pila">
      {datos.error && <Aviso aviso={{ tipo: 'error', texto: datos.error }} />}
      <div className="fila-espaciada">
        <div className="chips">
          {CATEGORIAS.map(([v, t]) => <button key={v} className={`chip ${cat === v ? 'activo' : ''}`} onClick={() => setCat(v)}>{t}</button>)}
        </div>
        <div className="fila">
          <span className={`insignia ${esPremium ? 'insignia-premium' : 'insignia-suave'}`}>Mostrando los últimos {limite} · {esPremium ? '⭐ Premium' : 'Gratis'}</span>
          <button className="btn btn-secundario" onClick={datos.recargar}>🔄</button>
        </div>
      </div>
      {filtrados.length === 0 ? <div className="card"><Vacio>No hay eventos en esta categoría.</Vacio></div> : (
        <div className="pila" style={{ gap: 8 }}>
          {filtrados.map(l => (
            <div key={l._id} className="card" style={{ padding: '0.85rem 1rem', borderLeft: `4px solid ${l.color}` }}>
              <div className="fila-espaciada">
                <strong style={{ color: l.color }}>{l.accion}</strong>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{fechaHora(l.fecha)}</span>
              </div>
              <div style={{ fontSize: '0.9rem', marginTop: 4 }}>👤 {l.usuario}</div>
              {l.detalles && <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 6, whiteSpace: 'pre-wrap', background: 'var(--bg-main)', padding: '6px 8px', borderRadius: 6 }}>{l.detalles}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
