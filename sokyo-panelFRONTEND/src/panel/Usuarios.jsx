import { useState } from 'react';
import { api } from '../api.js';
import { navegar, useAhora, useCarga } from '../hooks.js';
import { fechaLarga, haceTiempo } from '../utils.js';
import { Avatar, AvisoError, Cargando, Estrellas, Vacio } from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';

export default function Usuarios({ guildId }) {
  const ahora = useAhora();
  const [busqueda, setBusqueda] = useState('');
  const usuarios = useCarga(() => api(`/api/servidores/${guildId}/usuarios`), [guildId]);

  if (usuarios.error && !usuarios.datos) return <AvisoError error={usuarios.error} onReintentar={usuarios.recargar} />;
  if (!usuarios.datos) return <Cargando />;

  const texto = busqueda.trim().toLowerCase();
  const lista = usuarios.datos.filter(u => !texto || (u.nombre || '').toLowerCase().includes(texto));
  const verTickets = (u) => navegar(`/tickets?q=${encodeURIComponent(u.nombre)}&estado=todos`);

  return (
    <>
      <div className="barra-herramientas">
        <div className="buscador">
          <Icono nombre="buscar" />
          <input className="entrada" type="search" placeholder="Buscar usuario…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar usuario" />
        </div>
        <div className="espaciador" />
        <span className="texto-3 pequeño">{usuarios.datos.length} usuarios han abierto tickets</span>
      </div>

      <div className="tarjeta">
        {usuarios.datos.length === 0 ? (
          <Vacio emoji="👥" titulo="Aún no hay usuarios">Cuando alguien abra su primer ticket aparecerá aquí.</Vacio>
        ) : lista.length === 0 ? (
          <Vacio emoji="🔍" titulo="Sin resultados">Ningún usuario coincide con «{busqueda}».</Vacio>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th className="num">Tickets</th>
                  <th>Abiertos</th>
                  <th>Valoración media</th>
                  <th>Último ticket</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(u => (
                  <tr key={u._id} className="clicable" onClick={() => verTickets(u)} tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') verTickets(u); }} title={`Ver los tickets de ${u.nombre}`}>
                    <td>
                      <div className="fila" style={{ gap: 10 }}>
                        <Avatar src={u.avatar} nombre={u.nombre} tamaño={32} />
                        <strong>{u.nombre}</strong>
                      </div>
                    </td>
                    <td className="num negrita">{u.totalTickets}</td>
                    <td>
                      {u.ticketsAbiertos > 0
                        ? <span className="insignia insignia-aviso">{u.ticketsAbiertos} abierto{u.ticketsAbiertos === 1 ? '' : 's'}</span>
                        : <span className="insignia insignia-ok">Todo cerrado</span>}
                    </td>
                    <td>
                      {u.ratingMedio
                        ? <span className="fila" style={{ gap: 8 }}><Estrellas valor={u.ratingMedio} /><span className="negrita">{u.ratingMedio.toFixed(1)}</span><span className="texto-3 pequeño">({u.valoraciones})</span></span>
                        : <span className="texto-3 pequeño">Sin valorar</span>}
                    </td>
                    <td className="texto-2" title={fechaLarga(u.ultimoTicket)}>{haceTiempo(u.ultimoTicket, ahora)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
