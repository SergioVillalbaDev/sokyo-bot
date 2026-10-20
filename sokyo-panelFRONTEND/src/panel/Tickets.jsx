import { useState } from 'react';
import { api } from '../api.js';
import { useAhora, useCarga, useDebounce, usePreferencia } from '../hooks.js';
import { useConfirmar, useToast } from '../contexto.js';
import { haceTiempo, numeroTicket } from '../utils.js';
import { Avatar, AvisoError, Estrellas, InsigniaEspera, InsigniaEstado, InsigniaPrioridad, Segmentos, Vacio } from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';

const ESTADOS = [
  { valor: 'Abierto', texto: 'Abiertos' },
  { valor: 'Cerrado', texto: 'Cerrados' },
  { valor: 'todos', texto: 'Todos' },
  { valor: 'ocultos', texto: 'Ocultos' }
];

function TarjetaTicket({ ticket, color, ahora, onCerrar, onReabrir, onVisibilidad, ocupado }) {
  const cerrado = ticket.estado === 'Cerrado';
  return (
    <article className={`ticket-card ${cerrado ? 'cerrado' : ''}`} style={{ '--color-prioridad': color }}>
      <a href={`#/tickets/${ticket.canalId}`} className="columna" style={{ color: 'inherit', textDecoration: 'none', gap: 10 }}>
        <div className="fila-entre">
          <span className="numero">{numeroTicket(ticket) || 'Ticket'}</span>
          <div className="fila" style={{ gap: 6 }}>
            <InsigniaPrioridad nombre={ticket.prioridad} color={color} />
            <InsigniaEstado ticket={ticket} />
          </div>
        </div>
        <h3>{ticket.titulo || ticket.motivo}</h3>
        {ticket.descripcion && ticket.descripcion !== 'Sin descripción' && <p className="descripcion">{ticket.descripcion}</p>}
        <div className="fila" style={{ gap: 8 }}>
          <Avatar src={ticket.creadorAvatar} nombre={ticket.creadorNombre} tamaño={24} />
          <span className="negrita recortar">{ticket.creadorNombre}</span>
        </div>
        <div className="meta">
          <span>🏷️ {ticket.motivo}</span>
          <span>{ticket.asignadoNombre ? <>🙋 <strong>{ticket.asignadoNombre}</strong></> : '🙋 Sin asignar'}</span>
          {cerrado && ticket.valoracionCSAT && <Estrellas valor={ticket.valoracionCSAT} tamaño={12} />}
        </div>
        {!cerrado && <div><InsigniaEspera ticket={ticket} /></div>}
      </a>
      <div className="pie">
        <span className="texto-3" title="Última actividad">🕒 {haceTiempo(ticket.ultimaActividad || ticket.fechaCreacion, ahora)}</span>
        <div className="fila" style={{ gap: 4 }}>
          {!ticket.visibleWeb ? (
            <button className="btn btn-fantasma btn-sm" disabled={ocupado} onClick={() => onVisibilidad(ticket, true)}><Icono nombre="ojo" />Mostrar</button>
          ) : cerrado ? (
            <>
              {!ticket.canalEliminado && <button className="btn btn-fantasma btn-sm" disabled={ocupado} onClick={() => onReabrir(ticket)}><Icono nombre="abrir" />Reabrir</button>}
              <button className="btn btn-fantasma btn-icono btn-sm" disabled={ocupado} onClick={() => onVisibilidad(ticket, false)} title="Ocultar del panel" aria-label="Ocultar del panel"><Icono nombre="ojoNo" /></button>
            </>
          ) : (
            <button className="btn btn-fantasma btn-sm" disabled={ocupado} onClick={() => onCerrar(ticket)}><Icono nombre="candado" />Cerrar</button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Tickets({ guildId, config, yo, consulta }) {
  const toast = useToast();
  const confirmar = useConfirmar();
  const ahora = useAhora();
  const [estadoGuardado, setEstadoGuardado] = usePreferencia('sokyo.filtroEstado', 'Abierto');
  const [estado, setEstado] = useState(consulta.get('estado') || estadoGuardado);
  const [asignacion, setAsignacion] = usePreferencia('sokyo.filtroAsignacion', 'todos');
  const [orden, setOrden] = usePreferencia('sokyo.ordenTickets', 'prioridad');
  const [busqueda, setBusqueda] = useState(consulta.get('q') || '');
  const [ocupado, setOcupado] = useState(null);
  const q = useDebounce(busqueda.trim(), 300);

  const params = new URLSearchParams();
  if (estado === 'ocultos') params.set('ocultos', '1');
  else if (estado !== 'todos') params.set('estado', estado);
  if (q) params.set('q', q);
  const tickets = useCarga(() => api(`/api/servidores/${guildId}/tickets?${params}`), [guildId, estado, q], { intervalo: 15000 });

  const urgencia = (nombre) => config.urgencias.find(u => u.nombre === nombre);
  const cambiarEstado = (valor) => { setEstado(valor); setEstadoGuardado(valor); };

  let lista = tickets.datos || [];
  if (asignacion === 'mios') lista = lista.filter(t => t.asignadoA === yo.id);
  if (asignacion === 'libres') lista = lista.filter(t => !t.asignadoA && t.estado === 'Abierto');
  const actividad = (t) => new Date(t.ultimaActividad || t.fechaCreacion).getTime();
  lista = [...lista].sort((a, b) => {
    if (orden === 'recientes') return new Date(b.fechaCreacion) - new Date(a.fechaCreacion);
    if (orden === 'actividad') return actividad(b) - actividad(a);
    return (a.estado === 'Abierto' ? 0 : 1) - (b.estado === 'Abierto' ? 0 : 1)
      || (urgencia(b.prioridad)?.nivel || 0) - (urgencia(a.prioridad)?.nivel || 0)
      || (a.esperando === 'staff' ? 0 : 1) - (b.esperando === 'staff' ? 0 : 1)
      || new Date(b.fechaCreacion) - new Date(a.fechaCreacion);
  });

  const actualizar = (nuevo) => tickets.mutar(prev => (prev || []).map(t => (t.canalId === nuevo.canalId ? { ...t, ...nuevo } : t)));
  const ejecutar = async (ticket, fn, exito) => {
    setOcupado(ticket.canalId);
    try {
      const nuevo = await fn();
      actualizar(nuevo);
      toast.exito(exito);
      tickets.recargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setOcupado(null);
    }
  };
  const base = (t) => `/api/servidores/${guildId}/tickets/${t.canalId}`;

  const onCerrar = async (t) => {
    const r = await confirmar({
      titulo: `Cerrar ${numeroTicket(t) || 'ticket'}`,
      mensaje: 'El canal se archivará en Discord en modo solo lectura y el usuario recibirá un resumen por DM.',
      campo: { etiqueta: 'Motivo del cierre (opcional)', placeholder: 'Ej: Problema resuelto', ayuda: 'Se incluye en el resumen que recibe el usuario.' },
      textoConfirmar: 'Cerrar ticket',
      peligro: true
    });
    if (r.ok) ejecutar(t, () => api(`${base(t)}/cerrar`, { metodo: 'PUT', body: { motivo: r.valor } }), 'Ticket cerrado');
  };
  const onReabrir = async (t) => {
    if (await confirmar({ titulo: `Reabrir ${numeroTicket(t) || 'ticket'}`, mensaje: 'El usuario podrá volver a escribir y se le avisará en el canal.', textoConfirmar: 'Reabrir' })) {
      ejecutar(t, () => api(`${base(t)}/reabrir`, { metodo: 'PUT' }), 'Ticket reabierto');
    }
  };
  const onVisibilidad = (t, visible) => ejecutar(t, () => api(`${base(t)}/visibilidad`, { metodo: 'PUT', body: { visible } }),
    visible ? 'El ticket vuelve a mostrarse' : 'Ticket ocultado del panel (lo encontrarás en «Ocultos»)');

  return (
    <>
      <div className="barra-herramientas">
        <Segmentos etiqueta="Estado" opciones={ESTADOS} valor={estado} onCambio={cambiarEstado} />
        <div className="buscador">
          <Icono nombre="buscar" />
          <input className="entrada" type="search" placeholder="Buscar asunto, usuario o #nº…" value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar tickets" />
        </div>
        <div className="espaciador" />
        <select className="entrada entrada-sm" style={{ width: 'auto' }} value={asignacion} onChange={(e) => setAsignacion(e.target.value)} aria-label="Filtrar por asignación">
          <option value="todos">Cualquier asignación</option>
          {yo.tipo === 'discord' && <option value="mios">Asignados a mí</option>}
          <option value="libres">Sin asignar</option>
        </select>
        <select className="entrada entrada-sm" style={{ width: 'auto' }} value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar">
          <option value="prioridad">Orden: prioridad</option>
          <option value="recientes">Orden: más recientes</option>
          <option value="actividad">Orden: última actividad</option>
        </select>
      </div>

      <AvisoError error={tickets.datos ? null : tickets.error} onReintentar={tickets.recargar} />

      {!tickets.datos && !tickets.error && (
        <div className="rejilla-tickets">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="esqueleto" style={{ height: 230 }} />)}</div>
      )}

      {tickets.datos && lista.length === 0 && (
        <div className="tarjeta">
          {q || asignacion !== 'todos'
            ? <Vacio emoji="🔍" titulo="Sin resultados">No hay tickets que coincidan con los filtros. Prueba con otra búsqueda.</Vacio>
            : estado === 'Abierto'
              ? <Vacio emoji="🎉" titulo="No hay tickets abiertos">¡Buen trabajo! Todas las solicitudes están atendidas.</Vacio>
              : <Vacio emoji="📭" titulo="Nada por aquí">No hay tickets en esta vista.</Vacio>}
        </div>
      )}

      {lista.length > 0 && (
        <>
          <p className="texto-3 pequeño" style={{ marginBottom: 10 }}>{lista.length} ticket{lista.length === 1 ? '' : 's'}</p>
          <div className="rejilla-tickets">
            {lista.map(t => (
              <TarjetaTicket key={t.canalId} ticket={t} color={urgencia(t.prioridad)?.color || '#80848e'} ahora={ahora}
                ocupado={ocupado === t.canalId} onCerrar={onCerrar} onReabrir={onReabrir} onVisibilidad={onVisibilidad} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
