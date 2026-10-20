// Portal del Cliente: cada usuario entra con Discord y gestiona SUS tickets.
import { useState } from 'react';
import { api } from '../api.js';
import { navegar, useAhora, useCarga, useRuta, useTema } from '../hooks.js';
import { useConfirmar, useToast } from '../contexto.js';
import { enlaceDiscord, fechaLarga, haceTiempo, numeroTicket } from '../utils.js';
import { Avatar, AvisoError, Cargando, Estrellas, InsigniaEstado, Segmentos, SelectorEstrellas, Vacio } from '../components/ui.jsx';
import Chat from '../components/Chat.jsx';
import Icono from '../components/Icono.jsx';
import NuevoTicket from './NuevoTicket.jsx';

function Cabecera({ yo, esStaff, onSalir }) {
  const [tema, alternarTema] = useTema();
  return (
    <header className="portal-cabecera">
      <a href="#/portal" className="marca" style={{ padding: 0, color: 'inherit', textDecoration: 'none' }}>
        <img className="logo" src="/favicon.svg" alt="" />
        <div>Sokyo<small>Portal de soporte</small></div>
      </a>
      <div className="fila">
        {esStaff && <a className="btn btn-secundario btn-sm" href="#/">🛡️ Panel de staff</a>}
        <button className="btn btn-fantasma btn-icono btn-sm" onClick={alternarTema} aria-label="Cambiar tema" title="Cambiar tema"><Icono nombre={tema === 'dark' ? 'sol' : 'luna'} /></button>
        <Avatar src={yo.avatar} nombre={yo.username} tamaño={30} />
        <span className="negrita recortar" style={{ maxWidth: 140 }}>{yo.username}</span>
        <button className="btn btn-fantasma btn-icono btn-sm" onClick={onSalir} aria-label="Cerrar sesión" title="Cerrar sesión"><Icono nombre="salir" /></button>
      </div>
    </header>
  );
}

function ListaTickets({ yo }) {
  const ahora = useAhora();
  const [filtro, setFiltro] = useState('Abierto');
  const tickets = useCarga(() => api('/api/portal/tickets'), [], { intervalo: 20000 });

  if (tickets.error && !tickets.datos) return <AvisoError error={tickets.error} onReintentar={tickets.recargar} />;
  if (!tickets.datos) return <Cargando />;

  const todos = tickets.datos;
  const abiertos = todos.filter(t => t.estado === 'Abierto');
  const lista = filtro === 'todos' ? todos : todos.filter(t => t.estado === filtro);
  const sinValorar = todos.filter(t => t.estado === 'Cerrado' && !t.valoracionCSAT && t.creadorId === yo.id).length;

  return (
    <>
      <div className="fila-entre envolver">
        <div>
          <h1>Hola, {yo.username} 👋</h1>
          <p className="texto-2" style={{ marginTop: 4 }}>Aquí tienes tus solicitudes de soporte.</p>
        </div>
        <a className="btn btn-primario" href="#/portal/nuevo"><Icono nombre="mas" />Nuevo ticket</a>
      </div>

      {sinValorar > 0 && (
        <div className="aviso aviso-info">
          <span aria-hidden>⭐</span>
          <span>Tienes {sinValorar} ticket{sinValorar === 1 ? '' : 's'} cerrado{sinValorar === 1 ? '' : 's'} sin valorar. ¡Tu opinión nos ayuda a mejorar!</span>
        </div>
      )}

      <Segmentos etiqueta="Filtrar tickets" valor={filtro} onCambio={setFiltro} opciones={[
        { valor: 'Abierto', texto: 'Abiertos', cuenta: abiertos.length },
        { valor: 'Cerrado', texto: 'Cerrados', cuenta: todos.length - abiertos.length },
        { valor: 'todos', texto: 'Todos', cuenta: todos.length }
      ]} />

      {lista.length === 0 ? (
        <div className="tarjeta">
          {todos.length === 0
            ? <Vacio emoji="🎫" titulo="Aún no has abierto ningún ticket" accion={<a className="btn btn-primario" href="#/portal/nuevo">Abrir mi primer ticket</a>}>Si necesitas ayuda, abre un ticket y el equipo te responderá lo antes posible.</Vacio>
            : <Vacio emoji="📭" titulo="Nada por aquí">No tienes tickets en esta vista.</Vacio>}
        </div>
      ) : (
        <div className="columna" style={{ gap: 10 }}>
          {lista.map(t => (
            <a key={t.canalId} className="tarjeta portal-ticket" href={`#/portal/${t.canalId}`}>
              <Avatar src={t.servidor?.icono} nombre={t.servidor?.nombre || '?'} tamaño={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fila" style={{ gap: 6 }}>
                  <span className="texto-3 pequeño negrita">{numeroTicket(t)}</span>
                  <strong className="recortar">{t.titulo || t.motivo}</strong>
                </div>
                <div className="texto-3 pequeño recortar">
                  {t.servidor?.nombre ? `${t.servidor.nombre} · ` : ''}🏷️ {t.motivo} · {haceTiempo(t.ultimaActividad || t.fechaCreacion, ahora)}
                </div>
              </div>
              <div className="columna" style={{ alignItems: 'flex-end', gap: 4 }}>
                <InsigniaEstado ticket={t} />
                {t.estado === 'Abierto' && t.esperando === 'usuario' && <span className="insignia insignia-acento">💬 Te han respondido</span>}
                {t.estado === 'Cerrado' && t.valoracionCSAT && <Estrellas valor={t.valoracionCSAT} tamaño={12} />}
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function Valoracion({ ticket, onGuardado }) {
  const toast = useToast();
  const [editando, setEditando] = useState(!ticket.valoracionCSAT);
  const [valor, setValor] = useState(ticket.valoracionCSAT || 0);
  const [comentario, setComentario] = useState(ticket.comentarioCSAT || '');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    try {
      const nuevo = await api(`/api/portal/tickets/${ticket.canalId}/valoracion`, { metodo: 'POST', body: { valoracion: valor, comentario } });
      onGuardado(nuevo);
      setEditando(false);
      toast.exito('¡Gracias por tu valoración!');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (!editando) {
    return (
      <div className="tarjeta tarjeta-cuerpo fila-entre envolver">
        <div className="columna" style={{ gap: 4 }}>
          <span className="negrita">Tu valoración</span>
          <Estrellas valor={ticket.valoracionCSAT} tamaño={20} />
          {ticket.comentarioCSAT && <span className="texto-2">“{ticket.comentarioCSAT}”</span>}
        </div>
        <button className="btn btn-secundario btn-sm" onClick={() => setEditando(true)}>Cambiar</button>
      </div>
    );
  }
  return (
    <div className="tarjeta tarjeta-cuerpo columna">
      <div>
        <h3>⭐ ¿Qué tal te hemos atendido?</h3>
        <p className="texto-3 pequeño">Valora del 1 al 5 y, si quieres, déjanos un comentario.</p>
      </div>
      <SelectorEstrellas valor={valor} onCambio={setValor} />
      <textarea className="entrada" maxLength={500} placeholder="¿Qué hicimos bien? ¿Qué podemos mejorar? (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
      <div className="fila">
        <button className="btn btn-primario" onClick={enviar} disabled={!valor || enviando}>{enviando ? 'Enviando…' : 'Enviar valoración'}</button>
        {ticket.valoracionCSAT && <button className="btn btn-fantasma" onClick={() => setEditando(false)}>Cancelar</button>}
      </div>
    </div>
  );
}

function DetalleTicket({ canalId, yo }) {
  const toast = useToast();
  const confirmar = useConfirmar();
  const ticket = useCarga(() => api(`/api/portal/tickets/${canalId}`), [canalId], { intervalo: 15000 });
  const mensajes = useCarga(() => api(`/api/portal/tickets/${canalId}/mensajes`), [canalId], { intervalo: 4000 });
  const [cerrando, setCerrando] = useState(false);
  const t = ticket.datos;

  if (ticket.error?.status === 404) {
    return <div className="tarjeta"><Vacio emoji="🔎" titulo="Ticket no encontrado" accion={<a className="btn btn-secundario" href="#/portal">Volver a mis tickets</a>}>Este ticket no existe o no es tuyo.</Vacio></div>;
  }
  if (!t) return ticket.error ? <AvisoError error={ticket.error} onReintentar={ticket.recargar} /> : <Cargando />;

  const abierto = t.estado === 'Abierto';
  const esCreador = t.creadorId === yo.id;

  const enviar = async (contenido) => {
    try {
      const nuevo = await api(`/api/portal/tickets/${canalId}/mensajes`, { metodo: 'POST', body: { contenido } });
      mensajes.mutar(prev => [...(prev || []), nuevo]);
    } catch (e) {
      toast.error(e.message);
      throw e;
    }
  };

  const cerrar = async () => {
    const ok = await confirmar({
      titulo: '¿Cerrar este ticket?',
      mensaje: 'Hazlo si tu problema ya está resuelto. Recibirás una copia de la conversación por Discord.',
      textoConfirmar: 'Sí, cerrar ticket',
      peligro: true
    });
    if (!ok) return;
    setCerrando(true);
    try {
      ticket.mutar(await api(`/api/portal/tickets/${canalId}/cerrar`, { metodo: 'PUT' }));
      toast.exito('Ticket cerrado. ¡Gracias!');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCerrando(false);
    }
  };

  return (
    <>
      <div className="detalle-cabecera" style={{ marginBottom: 0 }}>
        <a className="btn btn-secundario btn-icono" href="#/portal" aria-label="Volver a mis tickets" title="Volver"><Icono nombre="atras" /></a>
        <div className="titulo">
          <div className="fila envolver" style={{ gap: 6 }}>
            <span className="texto-3 negrita">{numeroTicket(t)}</span>
            <InsigniaEstado ticket={t} />
            {t.servidor && <span className="insignia">{t.servidor.nombre}</span>}
          </div>
          <h1>{t.titulo || t.motivo}</h1>
          <p className="texto-3 pequeño" style={{ marginTop: 4 }}>
            🏷️ {t.motivo} · Abierto el {fechaLarga(t.fechaCreacion)} · {t.asignadoNombre ? `Te atiende ${t.asignadoNombre}` : 'Pendiente de asignar'}
          </p>
        </div>
        <div className="detalle-acciones">
          {!t.canalEliminado && (
            <a className="btn btn-secundario btn-sm" href={enlaceDiscord(t.guildId, t.canalId)} target="_blank" rel="noopener noreferrer"><Icono nombre="externo" />Abrir en Discord</a>
          )}
          {abierto && esCreador && <button className="btn btn-peligro-suave btn-sm" onClick={cerrar} disabled={cerrando}><Icono nombre="candado" />{cerrando ? 'Cerrando…' : 'Cerrar ticket'}</button>}
        </div>
      </div>

      {!abierto && esCreador && <Valoracion key={t.valoracionCSAT || 0} ticket={t} onGuardado={(nuevo) => ticket.mutar(nuevo)} />}
      {!abierto && t.motivoCierre && <div className="aviso aviso-info"><span aria-hidden>🔒</span><span><strong>Motivo del cierre</strong>{t.motivoCierre}</span></div>}

      <div className="tarjeta">
        <Chat
          modo="burbujas"
          miId={yo.id}
          mensajes={mensajes.datos}
          descripcion={t.descripcion}
          puedeEscribir={abierto && !t.canalEliminado}
          motivoBloqueo="Este ticket está cerrado. Si necesitas más ayuda, abre uno nuevo."
          onEnviar={enviar}
          placeholder="Escribe tu mensaje…"
          ayuda="el equipo lo recibe al momento"
        />
      </div>
    </>
  );
}

export default function Portal({ yo, esStaff, onSalir }) {
  const { partes } = useRuta();
  const seccion = partes[0] === 'portal' ? partes[1] : undefined;

  let contenido;
  if (seccion === 'nuevo') contenido = <NuevoTicket onCreado={(t) => navegar(`/portal/${t.canalId}`)} />;
  else if (seccion) contenido = <DetalleTicket key={seccion} canalId={seccion} yo={yo} />;
  else contenido = <ListaTickets yo={yo} />;

  return (
    <div className="portal">
      <Cabecera yo={yo} esStaff={esStaff} onSalir={onSalir} />
      <main className="portal-cuerpo">{contenido}</main>
    </div>
  );
}
