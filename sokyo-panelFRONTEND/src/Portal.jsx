// Portal del Cliente: los usuarios entran con Discord y gestionan SUS tickets.
import { useCallback, useEffect, useState } from 'react';
import { api, tokenPortal, cerrarSesionPortal, urlLogin, ErrorSesion, ERROR_LOGIN, MENSAJES_ERROR_LOGIN } from './api.js';
import { useDatos, avatarDe, fechaCorta, fechaHora } from './util.js';
import { Estrellas, Vacio, Cargando } from './ui.jsx';

const colorEstado = (estado) => (estado === 'Cerrado' ? 'var(--danger)' : 'var(--success)');

export default function Portal() {
  const [token, setToken] = useState(tokenPortal());
  useEffect(() => { document.documentElement.setAttribute('data-theme', 'dark'); }, []);
  const salir = useCallback(() => { cerrarSesionPortal(); setToken(''); }, []);

  if (!token) {
    const error = MENSAJES_ERROR_LOGIN[ERROR_LOGIN] || (ERROR_LOGIN ? 'No se pudo iniciar sesión.' : '');
    return (
      <div className="landing" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 400, width: '100%', padding: '2.5rem 2rem' }}>
          <div style={{ fontSize: '3em', marginBottom: 10 }}>🎫</div>
          <h1 style={{ marginBottom: 8 }}>Portal de Soporte</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Entra con Discord para ver y responder tus tickets.</p>
          {error && <div className="aviso aviso-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
          <a className="btn btn-primario btn-grande" href={urlLogin('portal')}>Iniciar sesión con Discord</a>
          <div style={{ marginTop: 18 }}><a href="/" style={{ fontSize: '0.88rem' }}>← Volver a la web</a></div>
        </div>
      </div>
    );
  }
  return <MisTickets token={token} onSalir={salir} />;
}

function MisTickets({ token, onSalir }) {
  const pedir = useCallback((ruta, opciones = {}) => api(ruta, { ...opciones, token }).catch(e => {
    if (e instanceof ErrorSesion) onSalir();
    throw e;
  }), [token, onSalir]);
  const datos = useDatos(() => Promise.all([pedir('/api/portal/yo'), pedir('/api/portal/tickets')]), [pedir]);
  const [sel, setSel] = useState(null);
  const [usuario, tickets] = datos.datos || [null, []];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <header className="fila-espaciada" style={{ padding: '14px 24px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
        <strong style={{ fontSize: '1.15rem' }}>🤖 Sokyo · Soporte</strong>
        {usuario && (
          <div className="fila">
            <img className="avatar" src={avatarDe(usuario.avatar, usuario.username)} alt="" />
            <strong>{usuario.username}</strong>
            <button className="btn btn-secundario" onClick={onSalir}>Salir</button>
          </div>
        )}
      </header>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: 20 }}>
        {sel ? <Conversacion pedir={pedir} ticket={sel} usuario={usuario} onVolver={() => { setSel(null); datos.recargar(); }} /> : (
          <>
            <h1 style={{ marginBottom: 4 }}>Mis tickets</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Todas tus solicitudes de soporte, en todos los servidores.</p>
            {datos.error && <div className="aviso aviso-error" style={{ marginBottom: 12 }}>⚠️ {datos.error}</div>}
            {datos.cargando && !datos.datos ? <Cargando /> : tickets.length === 0 ? <div className="card"><Vacio>No has abierto ningún ticket todavía.</Vacio></div> : (
              <div className="pila" style={{ gap: 12 }}>
                {tickets.map(t => (
                  <button key={t.canalId} className="card" style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }} onClick={() => setSel(t)}>
                    <div className="fila-espaciada">
                      <strong style={{ fontSize: '1.05rem' }}>{t.numero ? `#${t.numero} · ` : ''}{t.titulo || t.motivo}</strong>
                      <span className="insignia" style={{ background: colorEstado(t.estado) }}>{t.estado}</span>
                    </div>
                    <div className="fila-espaciada" style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span>{t.servidorNombre ? `🏠 ${t.servidorNombre} · ` : ''}🏷️ {t.motivo} · {fechaCorta(t.fechaCreacion)}</span>
                      {t.estado === 'Cerrado' && <Estrellas valor={t.valoracionCSAT} />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Conversacion({ pedir, ticket, usuario, onVolver }) {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const cerrado = ticket.estado === 'Cerrado';

  useEffect(() => {
    let vivo = true;
    const cargar = () => pedir(`/api/portal/tickets/${ticket.canalId}/mensajes`).then(m => { if (vivo) setMensajes(m); }).catch(() => {});
    cargar();
    const id = setInterval(cargar, 4000);
    return () => { vivo = false; clearInterval(id); };
  }, [pedir, ticket.canalId]);

  const enviar = async () => {
    if (!texto.trim()) return;
    try {
      const r = await pedir(`/api/portal/tickets/${ticket.canalId}/mensajes`, { metodo: 'POST', cuerpo: { contenido: texto } });
      setTexto('');
      setError('');
      setMensajes(m => [...m, r.mensaje]);
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="pila">
      <div><button className="btn btn-secundario" onClick={onVolver}>⬅ Volver a mis tickets</button></div>
      <div className="card">
        <div className="fila-espaciada">
          <h2 style={{ fontSize: '1.25rem' }}>{ticket.titulo || ticket.motivo}</h2>
          <span className="insignia" style={{ background: colorEstado(ticket.estado) }}>{ticket.estado}</span>
        </div>
        {(ticket.respuestas || []).map((r, i) => (
          <div key={i} className="respuesta-form"><strong>{r.pregunta}</strong><span style={{ whiteSpace: 'pre-wrap' }}>{r.respuesta}</span></div>
        ))}
      </div>
      <div className="chat-box">
        {mensajes.length === 0 ? <p className="vacio">Aún no hay mensajes en este ticket.</p> : mensajes.map((m, i) => {
          const mio = m.usuarioId === usuario?.id;
          return (
            <div key={m._id || i} className={`mensaje ${mio ? 'mod' : ''}`}>
              <div className="mensaje-autor">{m.usuario}<small>{fechaHora(m.fecha)}</small></div>
              {m.contenido && <div>{m.contenido}</div>}
              {(m.imagenes || []).map((url, j) => <a key={j} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Adjunto" /></a>)}
            </div>
          );
        })}
      </div>
      {error && <div className="aviso aviso-error">⚠️ {error}</div>}
      {cerrado ? <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Este ticket está cerrado.</div> : (
        <div className="fila" style={{ flexWrap: 'nowrap' }}>
          <input className="input" value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviar()} placeholder="Escribe tu mensaje…" />
          <button className="btn btn-primario" onClick={enviar} disabled={!texto.trim()}>Enviar</button>
        </div>
      )}
    </div>
  );
}
