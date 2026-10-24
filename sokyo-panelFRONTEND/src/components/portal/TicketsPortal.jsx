// Mis tickets: la lista y el chat de cada uno (se refresca solo cada 4 s).
// Recibe portalFetch (con la sesión) desde Portal.jsx.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Send, Ticket as TicketIcon, Inbox, Loader2, ChevronRight, Lock, Star, MessageCircle } from 'lucide-react';
import { Tarjeta, TituloVista, Vacio } from './glass';
import { marcarVisto } from './portalUtils';

const cerrado = (tk) => tk.estado === 'Cerrado';

export default function TicketsPortal({ portalFetch, usuario, ticketId, irA, avisar, nuevas = [], onLeido }) {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    portalFetch('/api/portal/tickets')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('red'))))
      .then((d) => { if (vivo) { setTickets(Array.isArray(d) ? d : []); setError(''); } })
      .catch(() => { if (vivo) setError(t('portal.login.errConexion')); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento]);

  const sel = useMemo(() => (tickets || []).find((tk) => tk.canalId === ticketId) || null, [tickets, ticketId]);

  if (ticketId && sel) {
    return <Chat key={sel.canalId} ticket={sel} portalFetch={portalFetch} usuario={usuario} onVolver={() => irA('tickets')} avisar={avisar} onLeido={onLeido} />;
  }

  const abiertos = (tickets || []).filter((tk) => !cerrado(tk));
  const cerrados = (tickets || []).filter(cerrado);
  const nuevasIds = new Set(nuevas.map((n) => n.canalId));

  return (
    <div>
      <TituloVista icono={TicketIcon} color="#60a5fa" titulo={t('portal.tickets.title')} subtitulo={t('portal.tickets.subtitle')} />

      {error && !tickets && (
        <Vacio icono={Inbox} titulo={t('portal.home.errorTitle')} texto={error}>
          <button onClick={() => setIntento((n) => n + 1)} className="gx-btn mt-3">{t('portal.login.retry')}</button>
        </Vacio>
      )}
      {!error && !tickets && (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="gx-card h-[84px] animate-pulse" />)}
        </div>
      )}
      {tickets && tickets.length === 0 && (
        <Vacio icono={Inbox} titulo={t('portal.tickets.emptyTitle')} texto={t('portal.tickets.emptyDesc')} />
      )}
      {ticketId && tickets && !sel && (
        <p className="mb-4 rounded-2xl border border-line bg-white/[.04] px-4 py-3 text-sm text-muted">{t('portal.tickets.notFound')}</p>
      )}

      {abiertos.length > 0 && (
        <Grupo titulo={t('portal.tickets.openGroup', { count: abiertos.length })}>
          {abiertos.map((tk) => <Fila key={tk.canalId} tk={tk} nueva={nuevasIds.has(tk.canalId)} onClick={() => irA('tickets', tk.canalId)} />)}
        </Grupo>
      )}
      {cerrados.length > 0 && (
        <Grupo titulo={t('portal.tickets.closedGroup', { count: cerrados.length })}>
          {cerrados.map((tk) => <Fila key={tk.canalId} tk={tk} onClick={() => irA('tickets', tk.canalId)} />)}
        </Grupo>
      )}
    </div>
  );
}

function Grupo({ titulo, children }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2.5 px-1 text-xs font-bold uppercase tracking-wider text-muted">{titulo}</h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function Estado({ tk }) {
  const { t } = useTranslation();
  const c = cerrado(tk);
  return (
    <span className="gx-chip shrink-0" style={{ color: c ? 'var(--text-secondary)' : 'var(--success)', borderColor: c ? undefined : 'rgba(74,222,128,.35)' }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c ? 'var(--text-secondary)' : 'var(--success)', boxShadow: c ? 'none' : '0 0 8px var(--success)' }} />
      {c ? t('portal.tickets.closed') : t('portal.tickets.open')}
    </span>
  );
}

function Fila({ tk, nueva = false, onClick }) {
  const { t, i18n } = useTranslation();
  const fecha = new Date(tk.fechaCreacion).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <Tarjeta as="button" pulsable onClick={onClick} className="flex w-full items-center gap-3.5 p-4 text-left">
      <span className="gx-orbe relative h-11 w-11" style={{ '--orbe': cerrado(tk) ? '#475569' : '#3b82f6' }}>
        {cerrado(tk) ? <Lock size={18} /> : <MessageCircle size={19} />}
        {nueva && <span className="gx-punto" aria-label={t('portal.tickets.newReply')}>1</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-fg">{tk.titulo || tk.motivo}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {nueva && <span className="gx-chip text-pink-300" style={{ borderColor: 'rgba(236,72,153,.45)' }}>{t('portal.tickets.newReply')}</span>}
          <span>{tk.motivo}</span><span>·</span><span>{fecha}</span>
          {cerrado(tk) && tk.valoracionCSAT ? <span className="flex items-center gap-0.5 text-amber-300">· {[...Array(tk.valoracionCSAT)].map((_, i) => <Star key={i} size={11} fill="currentColor" />)}</span> : null}
        </span>
      </span>
      <span className="hidden sm:block"><Estado tk={tk} /></span>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </Tarjeta>
  );
}

function Chat({ ticket, portalFetch, usuario, onVolver, avisar, onLeido }) {
  const { t } = useTranslation();
  const [mensajes, setMensajes] = useState(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fin = useRef(null);
  const total = useRef(0);
  const esCerrado = cerrado(ticket);

  // Mensajes + refresco cada 4 s. Al leerlos, el aviso de respuesta nueva se apaga.
  useEffect(() => {
    let vivo = true;
    const cargar = () => portalFetch(`/api/portal/tickets/${ticket.canalId}/mensajes`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivo || !Array.isArray(d)) return;
        setMensajes(d);
        const ultimo = d[d.length - 1];
        if (ultimo && marcarVisto(ticket.canalId, ultimo.fecha)) onLeido?.();
      })
      .catch(() => {});
    cargar();
    const id = setInterval(cargar, 4000);
    return () => { vivo = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.canalId]);

  // Baja al final solo cuando llega algo nuevo (no a cada refresco).
  useEffect(() => {
    if (!mensajes) return;
    if (mensajes.length !== total.current) {
      fin.current?.scrollIntoView({ behavior: total.current ? 'smooth' : 'auto', block: 'nearest' });
      total.current = mensajes.length;
    }
  }, [mensajes]);

  const enviar = async (e) => {
    e?.preventDefault();
    const contenido = texto.trim();
    if (!contenido || enviando) return;
    setEnviando(true);
    try {
      const res = await portalFetch(`/api/portal/tickets/${ticket.canalId}/mensajes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contenido }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { avisar(d.error || t('portal.chat.sendError'), 'error'); return; }
      setTexto('');
      const lista = await portalFetch(`/api/portal/tickets/${ticket.canalId}/mensajes`).then((r) => r.json()).catch(() => null);
      if (Array.isArray(lista)) setMensajes(lista);
    } finally { setEnviando(false); }
  };

  return (
    <div>
      <button onClick={onVolver} className="gx-btn mb-4"><ArrowLeft size={16} /> {t('portal.chat.back')}</button>
      <Tarjeta brillo className="overflow-hidden">
        <div className="border-b border-line p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-fg">{ticket.titulo || ticket.motivo}</h2>
            <Estado tk={ticket} />
          </div>
          {ticket.descripcion && <p className="mt-2 text-sm leading-relaxed text-muted">{ticket.descripcion}</p>}
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto p-4 sm:p-5" style={{ minHeight: 320, maxHeight: '55vh' }}>
          {mensajes == null && <div className="m-auto"><Loader2 size={22} className="animate-spin text-muted" /></div>}
          {mensajes && mensajes.length === 0 && <p className="m-auto text-center text-sm text-muted">{t('portal.chat.noMessages')}</p>}
          {(mensajes || []).map((m, i) => {
            const mio = m.usuarioId === usuario?.id;
            return (
              <div key={m._id || i} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm ${mio ? 'gx-burbuja-mia rounded-br-md' : 'gx-burbuja-otra rounded-bl-md text-fg'}`}>
                  <p className={`mb-0.5 text-[11px] font-bold ${mio ? 'text-white/75' : 'text-brand'}`}>{mio ? t('portal.chat.you') : (m.usuario || t('portal.chat.unknownUser'))}</p>
                  {m.contenido && <p className="whitespace-pre-wrap break-words leading-relaxed">{m.contenido}</p>}
                  {(m.imagenes || []).map((url, j) => <img key={j} src={url} alt="" className="mt-2 max-w-full rounded-lg" />)}
                </div>
              </div>
            );
          })}
          <div ref={fin} />
        </div>

        <div className="border-t border-line p-3 sm:p-4">
          {esCerrado ? (
            <p className="flex items-center justify-center gap-2 py-1 text-sm text-muted"><Lock size={14} /> {t('portal.chat.closedNote')}</p>
          ) : (
            <form onSubmit={enviar} className="flex gap-2">
              <input
                value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1900}
                placeholder={t('portal.chat.placeholder')} className="gx-input flex-1" aria-label={t('portal.chat.placeholder')}
              />
              <button type="submit" disabled={!texto.trim() || enviando} className="gx-btn gx-btn-primario shrink-0 px-4" aria-label={t('portal.chat.send')}>
                {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                <span className="hidden sm:inline">{t('portal.chat.send')}</span>
              </button>
            </form>
          )}
        </div>
      </Tarjeta>
    </div>
  );
}
