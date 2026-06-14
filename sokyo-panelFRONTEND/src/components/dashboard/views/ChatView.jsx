// Vista de conversación de un ticket — 3 columnas: Implicados | Chat | Notas.
import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Unlock, Send, Users, StickyNote, Plus } from 'lucide-react';
import { Avatar, Card } from '../../ui/primitives';

export default function ChatView({ dash }) {
  const {
    ticketSeleccionado: ticket, mensajes, nuevoMensaje, setNuevoMensaje, enviarMensaje,
    nuevaNota, setNuevaNota, agregarNotaInterna, obtenerParticipantes,
    cerrarMensajes, handleCerrarTicket, handleReabrirTicket,
  } = dash;

  const cerrado = ticket.estado === 'Cerrado';
  const esStaff = (autor) => autor === 'Admin' || autor === 'Sokyo';

  return (
    <div className="flex h-full flex-col">
      {/* Barra superior */}
      <div className="mb-5 flex items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={cerrarMensajes}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <span className="text-lg font-bold text-fg">
            {ticket.titulo || ticket.creadorNombre}
          </span>
        </div>
        {!cerrado ? (
          <button
            onClick={(e) => handleCerrarTicket(ticket.canalId, e)}
            className="flex items-center gap-1.5 rounded-lg bg-danger/15 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/25"
          >
            <Lock size={15} /> Cerrar Ticket
          </button>
        ) : (
          <button
            onClick={(e) => handleReabrirTicket(ticket.canalId, e)}
            className="flex items-center gap-1.5 rounded-lg bg-ok/15 px-4 py-2 text-sm font-semibold text-ok transition-colors hover:bg-ok/25"
          >
            <Unlock size={15} /> Reabrir Ticket
          </button>
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[260px_1fr_300px]">
        {/* Columna izquierda: Implicados */}
        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line bg-brand/10 px-4 py-3.5">
            <Users size={18} className="text-brand" />
            <h3 className="font-bold text-brand">Implicados</h3>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto p-4">
            {obtenerParticipantes(ticket).map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-bg p-2.5">
                <Avatar src={p.avatar} name={p.username} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{p.username}</p>
                  <p className="text-xs text-muted">{p.rol || 'Usuario'}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Columna central: Chat */}
        <div className="flex min-w-0 flex-col">
          {ticket.descripcion && (
            <Card className="mb-4 p-4" style={{ borderLeft: '4px solid var(--accent-color)' }}>
              <p className="mb-1 text-sm font-bold text-brand">Asunto Inicial</p>
              <p className="text-sm italic leading-relaxed text-muted">{ticket.descripcion}</p>
            </Card>
          )}

          <Card className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5" style={{ minHeight: 360, maxHeight: '52vh' }}>
              {mensajes.length === 0 ? (
                <p className="m-auto text-center text-sm italic text-muted">No hay mensajes registrados en este ticket.</p>
              ) : (
                mensajes.map((msg, i) => {
                  const mine = esStaff(msg.usuario);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                          mine
                            ? 'rounded-br-sm bg-gradient-brand text-on-brand'
                            : 'rounded-bl-sm border border-line bg-bg text-fg'
                        }`}
                      >
                        <p className={`mb-1 text-xs font-semibold ${mine ? 'text-on-brand/70' : 'text-brand'}`}>
                          {msg.usuario || 'Usuario Desconocido'}
                        </p>
                        {msg.contenido && <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.contenido}</p>}
                        {msg.imagenes && msg.imagenes.map((url, j) => (
                          <img key={j} src={url} alt="adjunto" className="mt-2 max-w-full rounded-lg" />
                        ))}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Caja de envío */}
            <div className="border-t border-line p-3">
              {cerrado ? (
                <p className="py-2 text-center text-sm text-muted">Este ticket está cerrado.</p>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nuevoMensaje}
                    onChange={(e) => setNuevoMensaje(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()}
                    placeholder="Escribe una respuesta al ticket..."
                    className="flex-1 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-fg outline-none transition-shadow focus:ring-2 focus:ring-brand/40"
                  />
                  <button
                    onClick={enviarMensaje}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-on-brand transition-transform hover:scale-[1.03]"
                  >
                    <Send size={15} /> Enviar
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Columna derecha: Notas internas */}
        <Card className="flex flex-col overflow-hidden border-amber-500/30">
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <StickyNote size={18} className="text-amber-500" />
              <h3 className="font-bold text-amber-500">Notas Internas</h3>
            </div>
            <p className="mt-1 text-xs text-muted">Visibles solo para el Staff web.</p>
          </div>

          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4" style={{ minHeight: 180 }}>
            {ticket.notasInternas && ticket.notasInternas.length > 0 ? (
              ticket.notasInternas.map((nota, i) => (
                <div key={i} className="rounded-lg border-l-[3px] border-amber-500 bg-bg p-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted">
                    <strong className="text-fg">{nota.autor}</strong>
                    <span>{nota.fecha ? new Date(nota.fecha).toLocaleDateString() : ''}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-fg">{nota.contenido}</p>
                </div>
              ))
            ) : (
              <p className="mt-6 text-center text-sm italic text-muted">No hay anotaciones privadas.</p>
            )}
          </div>

          <div className="flex flex-col gap-2.5 border-t border-line bg-bg p-3">
            <textarea
              value={nuevaNota}
              onChange={(e) => setNuevaNota(e.target.value)}
              placeholder="Añade un apunte secreto..."
              className="min-h-[70px] w-full resize-y rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-fg outline-none transition-shadow focus:ring-2 focus:ring-amber-500/40"
            />
            <button
              onClick={agregarNotaInterna}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <Plus size={15} /> Guardar Nota
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
