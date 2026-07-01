// Vista de conversación de un ticket — 3 columnas: Implicados | Chat | Notas.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Lock, Unlock, Send, Users, StickyNote, Plus, Zap, Tag, X, History, Sparkles, FileDown, Loader2 } from 'lucide-react';
import { Avatar, Card } from '../../ui/primitives';

export default function ChatView({ dash }) {
  const { t } = useTranslation();
  const {
    ticketSeleccionado: ticket, mensajes, nuevoMensaje, setNuevoMensaje, enviarMensaje,
    nuevaNota, setNuevaNota, agregarNotaInterna, obtenerParticipantes,
    cerrarMensajes, handleCerrarTicket, handleReabrirTicket, configServidor, guardarEtiquetas,
    ticketsReales, verMensajes, esPremium, iaTicket, descargarTranscript,
  } = dash;

  // Asistente IA: resumen / respuesta sugerida (con cuota mensual por servidor).
  const iaActiva = !!(configServidor && configServidor.iaActiva);
  const [iaCargando, setIaCargando] = useState(''); // '', 'resumen', 'sugerir'
  const [iaResumen, setIaResumen] = useState('');
  const [iaError, setIaError] = useState('');
  const [iaUso, setIaUso] = useState(null); // { usos, cuota }
  const pedirIA = async (accion) => {
    setIaError(''); setIaCargando(accion);
    const r = await iaTicket(ticket.canalId, accion);
    setIaCargando('');
    if (r.iaUsos != null) setIaUso({ usos: r.iaUsos, cuota: r.iaCuota });
    if (r.error) { setIaError(r.error); return; }
    if (accion === 'sugerir') setNuevoMensaje((prev) => (prev ? `${prev} ${r.texto}` : r.texto));
    else setIaResumen(r.texto);
  };
  const bajarTranscript = async (format) => {
    const r = await descargarTranscript(ticket.canalId, format);
    if (r.error) setIaError(r.error);
  };

  // Historial: otros tickets del mismo usuario (derivado de los ya cargados).
  const historial = (ticketsReales || []).filter((tk) => tk.creadorId === ticket.creadorId && tk.canalId !== ticket.canalId);

  const [macrosOpen, setMacrosOpen] = useState(false);
  const macros = (configServidor && configServidor.respuestasRapidas) || [];
  const insertarMacro = (texto) => {
    setNuevoMensaje((prev) => (prev ? `${prev} ${texto}` : texto));
    setMacrosOpen(false);
  };

  // Etiquetas del ticket
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');
  const tags = ticket.etiquetas || [];
  const addTag = () => {
    const v = nuevaEtiqueta.trim();
    if (!v || tags.includes(v)) { setNuevaEtiqueta(''); return; }
    guardarEtiquetas(ticket.canalId, [...tags, v]);
    setNuevaEtiqueta('');
  };
  const removeTag = (tag) => guardarEtiquetas(ticket.canalId, tags.filter((x) => x !== tag));

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
            <ArrowLeft size={16} /> {t('dashboard.chat_v.back')}
          </button>
          <span className="text-lg font-bold text-fg">
            {ticket.titulo || ticket.creadorNombre}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {esPremium && (
            <>
              <button
                type="button"
                onClick={() => bajarTranscript('html')}
                title={t('dashboard.chat_v.transcript')}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
              >
                <FileDown size={15} /> {t('dashboard.chat_v.transcript')}
              </button>
              <button
                type="button"
                onClick={() => bajarTranscript('pdf')}
                title={t('dashboard.chat_v.transcriptPdf')}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
              >
                <FileDown size={15} /> {t('dashboard.chat_v.transcriptPdf')}
              </button>
            </>
          )}
          {!cerrado ? (
            <button
              onClick={(e) => handleCerrarTicket(ticket.canalId, e)}
              className="flex items-center gap-1.5 rounded-lg bg-danger/15 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/25"
            >
              <Lock size={15} /> {t('dashboard.chat_v.close')}
            </button>
          ) : (
            <button
              onClick={(e) => handleReabrirTicket(ticket.canalId, e)}
              className="flex items-center gap-1.5 rounded-lg bg-ok/15 px-4 py-2 text-sm font-semibold text-ok transition-colors hover:bg-ok/25"
            >
              <Unlock size={15} /> {t('dashboard.chat_v.reopen')}
            </button>
          )}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[260px_1fr_300px]">
        {/* Columna izquierda: Implicados + Historial */}
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line bg-brand/10 px-4 py-3.5">
              <Users size={18} className="text-brand" />
              <h3 className="font-bold text-brand">{t('dashboard.chat_v.involved')}</h3>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto p-4">
              {obtenerParticipantes(ticket).map((p, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-bg p-2.5">
                  <Avatar src={p.avatar} name={p.username} size={40} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">{p.username}</p>
                    <p className="text-xs text-muted">{p.rol || t('dashboard.chat_v.user')}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Historial del usuario */}
          <Card className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3.5">
              <History size={18} className="text-muted" />
              <h3 className="font-bold text-fg">{t('dashboard.chat_v.history')}</h3>
              <span className="ml-auto rounded-full bg-elevated px-2 py-0.5 text-xs font-semibold text-muted">{historial.length}</span>
            </div>
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto p-3">
              {historial.length === 0 ? (
                <p className="px-1 py-2 text-center text-xs italic text-muted">{t('dashboard.chat_v.historyNone')}</p>
              ) : (
                historial.map((h, i) => (
                  <button
                    key={h.canalId || i}
                    onClick={() => verMensajes(h)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-left transition-colors hover:border-brand/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-fg">{h.titulo || h.motivo}</p>
                      <p className="text-[10px] text-muted">{new Date(h.fechaCreacion).toLocaleDateString()}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ backgroundColor: h.estado === 'Cerrado' ? 'var(--danger)' : 'var(--success)', color: '#fff' }}
                    >
                      {h.estado}
                    </span>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Columna central: Chat */}
        <div className="flex min-w-0 flex-col">
          {ticket.descripcion && (
            <Card className="mb-4 p-4" style={{ borderLeft: '4px solid var(--accent-color)' }}>
              <p className="mb-1 text-sm font-bold text-brand">{t('dashboard.chat_v.subject')}</p>
              <p className="text-sm italic leading-relaxed text-muted">{ticket.descripcion}</p>
            </Card>
          )}

          {/* Etiquetas */}
          <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted"><Tag size={14} /> {t('dashboard.chat_v.tags')}</span>
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-semibold text-brand">
                {tag}
                {!cerrado && (
                  <button onClick={() => removeTag(tag)} className="transition-opacity hover:opacity-70" aria-label="Quitar"><X size={12} /></button>
                )}
              </span>
            ))}
            {!cerrado && (
              <input
                type="text"
                value={nuevaEtiqueta}
                onChange={(e) => setNuevaEtiqueta(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder={t('dashboard.chat_v.addTag')}
                maxLength={30}
                className="min-w-[120px] flex-1 rounded-lg border border-line bg-bg px-2.5 py-1 text-xs text-fg outline-none focus:ring-2 focus:ring-brand/40"
              />
            )}
          </Card>

          {/* Asistente IA (cuota mensual) */}
          {iaActiva && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-brand/5 p-3">
              <span className="flex items-center gap-1.5 text-xs font-bold text-brand"><Sparkles size={14} /> {t('dashboard.chat_v.aiTitle')}</span>
              {iaUso && <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] font-bold text-muted">{t('dashboard.chat_v.aiUsage', { usos: iaUso.usos, cuota: iaUso.cuota })}</span>}
              <button
                type="button"
                onClick={() => pedirIA('resumen')}
                disabled={!!iaCargando}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-brand disabled:opacity-50"
              >
                {iaCargando === 'resumen' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {t('dashboard.chat_v.aiSummarize')}
              </button>
              {!cerrado && (
                <button
                  type="button"
                  onClick={() => pedirIA('sugerir')}
                  disabled={!!iaCargando}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-brand disabled:opacity-50"
                >
                  {iaCargando === 'sugerir' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {t('dashboard.chat_v.aiSuggest')}
                </button>
              )}
            </div>
          )}
          {iaError && <p className="mb-3 text-xs font-semibold text-danger">{iaError}</p>}
          {iaResumen && (
            <Card className="mb-4 p-4" style={{ borderLeft: '4px solid var(--brand)' }}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-bold text-brand"><Sparkles size={14} /> {t('dashboard.chat_v.aiSummaryTitle')}</p>
                <button type="button" onClick={() => setIaResumen('')} className="text-muted transition-opacity hover:opacity-70" aria-label="Cerrar"><X size={15} /></button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{iaResumen}</p>
            </Card>
          )}

          <Card className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5" style={{ minHeight: 360, maxHeight: '52vh' }}>
              {mensajes.length === 0 ? (
                <p className="m-auto text-center text-sm italic text-muted">{t('dashboard.chat_v.noMessages')}</p>
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
                          {msg.usuario || t('dashboard.chat_v.unknownUser')}
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
                <p className="py-2 text-center text-sm text-muted">{t('dashboard.chat_v.closedNote')}</p>
              ) : (
                <div className="flex gap-2">
                  {/* Respuestas rápidas (macros) */}
                  <div className="relative">
                    <button
                      onClick={() => setMacrosOpen((o) => !o)}
                      title={t('dashboard.chat_macros.button')}
                      className="flex h-full items-center justify-center rounded-xl border border-line bg-bg px-3 text-amber-400 transition-colors hover:bg-elevated"
                    >
                      <Zap size={17} />
                    </button>
                    <AnimatePresence>
                      {macrosOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-full left-0 z-30 mb-2 max-h-64 w-64 overflow-y-auto rounded-2xl border border-line bg-card p-1.5 shadow-soft"
                        >
                          {macros.length === 0 ? (
                            <p className="px-3 py-2 text-xs italic text-muted">{t('dashboard.chat_macros.empty')}</p>
                          ) : (
                            macros.map((m, i) => (
                              <button
                                key={i}
                                onClick={() => insertarMacro(m.contenido)}
                                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-elevated"
                              >
                                <span className="font-semibold">{m.titulo}</span>
                                <span className="mt-0.5 block truncate text-xs text-muted">{m.contenido}</span>
                              </button>
                            ))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <input
                    type="text"
                    value={nuevoMensaje}
                    onChange={(e) => setNuevoMensaje(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()}
                    placeholder={t('dashboard.chat_v.reply')}
                    className="flex-1 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-fg outline-none transition-shadow focus:ring-2 focus:ring-brand/40"
                  />
                  <button
                    onClick={enviarMensaje}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-on-brand transition-transform hover:scale-[1.03]"
                  >
                    <Send size={15} /> {t('dashboard.chat_v.send')}
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
              <h3 className="font-bold text-amber-500">{t('dashboard.chat_v.notes')}</h3>
            </div>
            <p className="mt-1 text-xs text-muted">{t('dashboard.chat_v.notesSub')}</p>
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
              <p className="mt-6 text-center text-sm italic text-muted">{t('dashboard.chat_v.noNotes')}</p>
            )}
          </div>

          <div className="flex flex-col gap-2.5 border-t border-line bg-bg p-3">
            <textarea
              value={nuevaNota}
              onChange={(e) => setNuevaNota(e.target.value)}
              placeholder={t('dashboard.chat_v.addNote')}
              className="min-h-[70px] w-full resize-y rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-fg outline-none transition-shadow focus:ring-2 focus:ring-amber-500/40"
            />
            <button
              onClick={agregarNotaInterna}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <Plus size={15} /> {t('dashboard.chat_v.saveNote')}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
