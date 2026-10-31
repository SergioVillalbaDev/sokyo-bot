import { useState } from 'react';
import { useDatos, avatarDe, fechaCorta } from '../util.js';
import { Aviso, Cargando, Estrellas, Vacio } from '../ui.jsx';

export default function Usuarios({ apiG }) {
  const stats = useDatos(() => apiG('/usuarios/stats'), [apiG]);
  const [busqueda, setBusqueda] = useState('');
  if (stats.cargando && !stats.datos) return <Cargando />;
  const lista = (stats.datos || []).filter(u => !busqueda || (u.nombre || '').toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div className="pila">
      {stats.error && <Aviso aviso={{ tipo: 'error', texto: stats.error }} />}
      <input className="input" style={{ maxWidth: 320 }} placeholder="🔍 Buscar usuario" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      {lista.length === 0 ? <div className="card"><Vacio>No hay datos de usuarios todavía.</Vacio></div> : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tabla">
            <thead><tr><th>Usuario</th><th>Tickets</th><th>Abiertos</th><th>Valoración media</th><th>Último ticket</th></tr></thead>
            <tbody>
              {lista.map(u => (
                <tr key={u._id}>
                  <td><span className="fila"><img className="avatar" src={avatarDe(u.avatar, u.nombre)} alt="" /><strong>{u.nombre}</strong></span></td>
                  <td>{u.totalTickets}</td>
                  <td>{u.ticketsAbiertos > 0 ? <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{u.ticketsAbiertos} abierto(s)</span> : <span style={{ color: 'var(--success)' }}>Todo cerrado</span>}</td>
                  <td><span className="fila" style={{ gap: 6 }}><Estrellas valor={Math.round(u.ratingMedio || 0)} />{u.ratingMedio ? <strong>{u.ratingMedio.toFixed(1)}</strong> : null}</span></td>
                  <td style={{ color: 'var(--text-secondary)' }}>{fechaCorta(u.ultimoTicket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
