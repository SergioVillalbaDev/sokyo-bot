// Gestión de tickets: listado + conversación con ayudas de IA.
import { useEffect, useMemo, useState } from 'react';
import { useDatos, useAccion, avatarDe, fechaHora } from '../util.js';
import { Aviso, Cargando, Estrellas, Vacio } from '../ui.jsx';

const SENTIMIENTO = { tranquilo: '🙂 Tranquilo', preocupado: '😟 Preocupado', enfadado: '😠 Enfadado' };

export default function Tickets({ apiG, resumen, recargarResumen }) {
  const lista = useDatos(() => apiG('/tickets'), [apiG]);
  const [filtro, setFiltro] = useState('Abierto');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const { ocupado, aviso, setAviso, ejecutar } = useAccion();

  const nivel = (p) => resumen.urgencias.find(u => u.nombre === p)?.nivel || 0;
  const color = (p) => resumen.urgencias.find(u => u.nombre === p)?.color || '#4b5563';

  const tickets = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (lista.datos || [])
      .filter(t => filtro === 'Todos' || t.estado === filtro)
      .filter(t => !q || [t.titulo, t.motivo, t.creadorNombre, t.numero && `#${t.numero}`].some(v => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => (nivel(b.prioridad) - nivel(a.prioridad)) || (new Date(b.fechaCreacion) - new Date(a.fechaCreacion)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista.datos, filtro, busqueda, resumen.urgencias]);

  const actualizar = (ticket) => {
    lista.setDatos(ts => (ts || []).map(t => t.canalId === ticket.canalId ? { ...t, ...ticket } : t));
    recargarResumen();
  };

  const accion = (canalId, tipo) => ejecutar(async () => {
    const preguntas = { cerrar: '¿Cerrar este ticket? Se archivará en Discord y el usuario recibirá la encuesta.', reabrir: '¿Reabrir este ticket?', ocultar: '¿Ocultar este ticket del panel web? (no se borra de Discord)' };
    if (!window.confirm(preguntas[tipo])) return;
    const r = await apiG(`/tickets/${canalId}/${tipo}`, { metodo: 'PUT' });
    if (tipo === 'ocultar') {
      lista.setDatos(ts => ts.filter(t => t.canalId !== canalId));
      setSeleccionado(null);
    } else {
      actualizar(r.ticket);
    }
  });

  if (seleccionado) {
    const ticket = (lista.datos || []).find(t => t.canalId === seleccionado) || null;
    return <Detalle apiG={apiG} resumen={resumen} base={ticket} canalId={seleccionado} color={color}
      onVolver={() => { setSeleccionado(null); lista.recargar(); }} onAccion={accion} onActualizar={actualizar} aviso={aviso} setAviso={setAviso} />;
  }

  return (
    <div className="pila">
      <div className="fila-espaciada">
        <div className="chips">
          {['Abierto', 'Cerrado', 'Todos'].map(f => (
            <button key={f} className={`chip ${filtro === f ? 'activo' : ''}`} onClick={() => setFiltro(f)}>
              {f === 'Abierto' ? '🟢 Abiertos' : f === 'Cerrado' ? '🔒 Cerrados' : '📋 Todos'}
            </button>
          ))}
        </div>
        <div className="fila">
          <input className="input" style={{ width: 240 }} placeholder="🔍 Buscar por asunto, usuario o #número" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <button className="btn btn-secundario" onClick={lista.recargar} disabled={ocupado}>🔄</button>
        </div>
      </div>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      {lista.error && <Aviso aviso={{ tipo: 'error', texto: lista.error }} />}
      {lista.cargando && !lista.datos ? <Cargando /> : tickets.length === 0 ? (
        <div className="card"><Vacio icono={filtro === 'Abierto' ? '🎉' : '📭'}>{filtro === 'Abierto' ? 'No hay tickets abiertos. ¡Todo al día!' : 'No hay tickets aquí.'}</Vacio></div>
      ) : (
        <div className="tickets-grid">
          {tickets.map(t => (
            <div className="ticket-card" key={t.canalId} style={{ borderTop: `4px solid ${color(t.prioridad)}` }}>
              <div className="fila-espaciada" style={{ alignItems: 'flex-start' }}>
                <span className="titulo">{t.numero ? <span style={{ color: 'var(--text-secondary)' }}>#{t.numero} </span> : null}{t.titulo || t.motivo}</span>
                <span className="insignia" style={{ background: color(t.prioridad) }}>{t.prioridad}</span>
              </div>
              <div className="ticket-meta">
                <span className="fila" style={{ gap: 6 }}><img className="avatar" style={{ width: 20, height: 20 }} src={avatarDe(t.creadorAvatar, t.creadorNombre)} alt="" /><strong>{t.creadorNombre}</strong></span>
                <span>🏷️ {t.motivo}</span>
              </div>
              <div className="ticket-meta">
                <span>🛡️ {t.asignadoNombre ? <strong style={{ color: 'var(--accent-color)' }}>{t.asignadoNombre}</strong> : <em>Sin reclamar</em>}</span>
                <span>{fechaHora(t.fechaCreacion)}</span>
              </div>
              {t.ia?.resumen && <div className="ticket-cita" style={{ borderLeftColor: 'var(--ia)' }}>🤖 {t.ia.resumen}{t.ia.sentimiento === 'enfadado' ? ' · 😠' : ''}</div>}
              {!t.ia?.resumen && t.descripcion && <div className="ticket-cita" style={{ borderLeftColor: color(t.prioridad) }}>“{t.descripcion.slice(0, 90)}{t.descripcion.length > 90 ? '…' : ''}”</div>}
              {t.estado === 'Cerrado' && <div className="fila-espaciada" style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--text-secondary)' }}>Valoración</span><Estrellas valor={t.valoracionCSAT} /></div>}
              <button className="btn btn-primario btn-bloque" onClick={() => setSeleccionado(t.canalId)}>💬 Ver conversación</button>
              <div className="fila" style={{ flexWrap: 'nowrap' }}>
                {t.estado !== 'Cerrado'
                  ? <button className="btn btn-peligro" style={{ flex: 1 }} disabled={ocupado} onClick={() => accion(t.canalId, 'cerrar')}>🔒 Cerrar</button>
                  : <button className="btn btn-exito" style={{ flex: 1 }} disabled={ocupado} onClick={() => accion(t.canalId, 'reabrir')}>🔓 Reabrir</button>}
                <button className="btn btn-secundario" style={{ flex: 1 }} disabled={ocupado} onClick={() => accion(t.canalId, 'ocultar')}>🙈 Ocultar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Detalle({ apiG, resumen, base, canalId, color, onVolver, onAccion, onActualizar, aviso, setAviso }) {
  const datos = useDatos(() => apiG(`/tickets/${canalId}`), [apiG, canalId]);
  const ticket = datos.datos || base;
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState('');
  const [resumenIA, setResumenIA] = useState(null);
  const [notaIA, setNotaIA] = useState('');
  const [traducciones, setTraducciones] = useState(null);
  const [articulo, setArticulo] = useState(null);
  const ia = useAccion();
  const envio = useAccion();
  const iaOk = resumen.ia.disponible && resumen.ia.activada;

  // Conversación en directo (se refresca cada 4 s)
  useEffect(() => {
    let vivo = true;
    const cargar = () => apiG(`/tickets/${canalId}/mensajes`).then(m => { if (vivo) setMensajes(m); }).catch(() => {});
    cargar();
    const id = setInterval(cargar, 4000);
    return () => { vivo = false; clearInterval(id); };
  }, [apiG, canalId]);

  if (!ticket) return <Cargando />;
  const cerrado = ticket.estado === 'Cerrado';
  const participantes = ticket.participantes?.length ? ticket.participantes : [{ id: ticket.creadorId, username: ticket.creadorNombre, avatar: ticket.creadorAvatar, rol: 'Creador' }];
  const respuestas = ticket.respuestas?.length ? ticket.respuestas : [{ pregunta: 'Asunto', respuesta: ticket.titulo }, { pregunta: 'Descripción', respuesta: ticket.descripcion }];

  const enviar = () => envio.ejecutar(async () => {
    if (!texto.trim()) return;
    const r = await apiG(`/tickets/${canalId}/mensajes`, { metodo: 'POST', cuerpo: { contenido: texto } });
    setTexto('');
    setNotaIA('');
    setMensajes(m => [...m, r.mensaje]);
  });

  const guardarNota = () => envio.ejecutar(async () => {
    if (!nota.trim()) return;
    const r = await apiG(`/tickets/${canalId}/notas`, { metodo: 'POST', cuerpo: { contenido: nota } });
    datos.setDatos(r.ticket);
    setNota('');
  });

  const pedirIA = (accion) => ia.ejecutar(async () => {
    const r = await apiG(`/tickets/${canalId}/ia/${accion}`, { metodo: 'POST' });
    if (accion === 'resumen') setResumenIA(r);
    if (accion === 'sugerencia') { setTexto(r.respuesta); setNotaIA(r.nota_para_staff || ''); }
    if (accion === 'traduccion') setTraducciones(Object.fromEntries(r.traducciones.map(t => [t.indice, t.texto])));
    if (accion === 'articulo') setArticulo({ pregunta: r.pregunta, respuesta: r.respuesta });
  });

  const guardarArticulo = () => ia.ejecutar(async () => {
    await apiG('/faq', { metodo: 'POST', cuerpo: articulo });
    setArticulo(null);
  }, '✅ Guardado en las preguntas frecuentes. La IA ya lo usará para responder.');

  const accionTicket = async (tipo) => {
    await onAccion(canalId, tipo);
    if (tipo !== 'ocultar') datos.recargar();
    onActualizar({ canalId });
  };

  return (
    <div className="pila">
      <div className="fila-espaciada hide-on-print" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-color)' }}>
        <div className="fila">
          <button className="btn btn-secundario" onClick={onVolver}>⬅ Volver</button>
          <strong style={{ fontSize: '1.15rem' }}>{ticket.numero ? `#${ticket.numero} · ` : ''}{ticket.titulo || ticket.motivo}</strong>
          <span className="insignia" style={{ background: color(ticket.prioridad) }}>{ticket.prioridad}</span>
          <span className={`insignia ${cerrado ? '' : 'insignia-suave'}`} style={cerrado ? { background: 'var(--danger)' } : undefined}>{ticket.estado}</span>
        </div>
        <div className="fila">
          {!cerrado
            ? <button className="btn btn-peligro" onClick={() => accionTicket('cerrar')}>🔒 Cerrar ticket</button>
            : <button className="btn btn-exito" onClick={() => accionTicket('reabrir')}>🔓 Reabrir</button>}
        </div>
      </div>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      <div className="detalle">
        {/* Columna izquierda: formulario, implicados y análisis IA */}
        <div className="columna hide-on-print">
          <div className="card">
            <h3>📝 Formulario</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>🏷️ {ticket.motivo} · {fechaHora(ticket.fechaCreacion)}</div>
            {respuestas.map((r, i) => (
              <div className="respuesta-form" key={i}><strong>{r.pregunta}</strong><span style={{ whiteSpace: 'pre-wrap' }}>{r.respuesta || '—'}</span></div>
            ))}
          </div>

          {(ticket.ia?.resumen || resumenIA) && (
            <div className="card" style={{ borderColor: 'rgba(155,89,182,0.5)' }}>
              <h3 style={{ color: 'var(--ia)' }}>🤖 Análisis IA</h3>
              {resumenIA ? (
                <div className="pila" style={{ gap: 8, fontSize: '0.9rem' }}>
                  <p>{resumenIA.resumen}</p>
                  <p><strong>Estado:</strong> {resumenIA.estado}</p>
                  <p><strong>Siguiente paso:</strong> {resumenIA.siguiente_paso}</p>
                  <div className="fila"><span className="insignia insignia-suave">🌐 {resumenIA.idioma}</span><span className="insignia insignia-suave">{SENTIMIENTO[resumenIA.sentimiento] || resumenIA.sentimiento}</span></div>
                </div>
              ) : (
                <div className="pila" style={{ gap: 8, fontSize: '0.9rem' }}>
                  <p>{ticket.ia.resumen}</p>
                  <div className="fila">
                    {ticket.ia.idioma && <span className="insignia insignia-suave">🌐 {ticket.ia.idioma}</span>}
                    {ticket.ia.sentimiento && <span className="insignia insignia-suave">{SENTIMIENTO[ticket.ia.sentimiento] || ticket.ia.sentimiento}</span>}
                  </div>
                  {ticket.ia.motivoUrgencia && <small style={{ color: 'var(--text-secondary)' }}>Urgencia sugerida: <strong>{ticket.ia.urgenciaSugerida}</strong> — {ticket.ia.motivoUrgencia}</small>}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <h3>👥 Implicados</h3>
            <div className="pila" style={{ gap: 10 }}>
              {participantes.map(p => (
                <div key={p.id} className="fila">
                  <img className="avatar" src={avatarDe(p.avatar, p.username)} alt="" />
                  <div><strong style={{ display: 'block' }}>{p.username}</strong><small style={{ color: 'var(--text-secondary)' }}>{p.rol || 'Usuario'}</small></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Centro: conversación */}
        <div className="columna">
          <div className="card hide-on-print" style={{ padding: '0.85rem 1rem' }}>
            <div className="fila-espaciada">
              <strong style={{ color: 'var(--ia)' }}>🤖 Ayuda de la IA</strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{iaOk ? 'Cada acción gasta 1 uso' : resumen.ia.disponible ? 'Desactivada en este servidor' : 'No configurada en el bot'}</span>
            </div>
            <div className="fila" style={{ marginTop: 10 }}>
              <button className="btn btn-ia" disabled={!iaOk || ia.ocupado || cerrado} onClick={() => pedirIA('sugerencia')}>✨ Sugerir respuesta</button>
              <button className="btn btn-secundario" disabled={!iaOk || ia.ocupado} onClick={() => pedirIA('resumen')}>🧠 Resumen</button>
              <button className="btn btn-secundario" disabled={!iaOk || ia.ocupado} onClick={() => pedirIA('traduccion')}>🌐 Traducir</button>
              <button className="btn btn-secundario" disabled={!iaOk || ia.ocupado} onClick={() => pedirIA('articulo')}>📚 Convertir en FAQ</button>
              {ia.ocupado && <span style={{ color: 'var(--ia)' }}>Pensando…</span>}
            </div>
          </div>
          <Aviso aviso={ia.aviso} onCerrar={() => ia.setAviso(null)} />

          {articulo && (
            <div className="card aviso-ia">
              <h3>📚 Nuevo artículo para la FAQ</h3>
              <div className="pila" style={{ gap: 10 }}>
                <input className="input" value={articulo.pregunta} onChange={e => setArticulo({ ...articulo, pregunta: e.target.value })} />
                <textarea className="input" rows={5} value={articulo.respuesta} onChange={e => setArticulo({ ...articulo, respuesta: e.target.value })} />
                <div className="fila"><button className="btn btn-ia" disabled={ia.ocupado} onClick={guardarArticulo}>💾 Guardar en la FAQ</button><button className="btn btn-secundario" onClick={() => setArticulo(null)}>Descartar</button></div>
              </div>
            </div>
          )}

          <div className="chat-box">
            {mensajes.length === 0 ? <p className="vacio">Aún no hay mensajes en este ticket.</p> : mensajes.map((m, i) => {
              const delUsuario = m.usuarioId === ticket.creadorId;
              return (
                <div key={m._id || i} className={`mensaje ${delUsuario ? '' : 'mod'}`}>
                  <div className="mensaje-autor">{m.usuario || 'Desconocido'}<small>{fechaHora(m.fecha)}{m.desdeWeb ? ' · web' : ''}</small></div>
                  {m.contenido && <div>{m.contenido}</div>}
                  {(m.imagenes || []).map((url, j) => <a key={j} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Adjunto" /></a>)}
                  {traducciones?.[i] && traducciones[i] !== m.contenido && <div className="traduccion">🌐 {traducciones[i]}</div>}
                </div>
              );
            })}
          </div>

          {!cerrado ? (
            <div className="pila hide-on-print" style={{ gap: 8 }}>
              {notaIA && <div className="aviso aviso-ia">🤖 Antes de enviar: {notaIA}</div>}
              <textarea className="input" rows={3} value={texto} onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(); }}
                placeholder="Escribe una respuesta… (Ctrl+Enter para enviar). Se publicará en Discord con tu nombre." />
              <div className="fila-espaciada">
                <Aviso aviso={envio.aviso} />
                <button className="btn btn-primario" disabled={envio.ocupado || !texto.trim()} onClick={enviar}>📨 Enviar</button>
              </div>
            </div>
          ) : <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Este ticket está cerrado.{ticket.valoracionCSAT ? <> Valoración: <Estrellas valor={ticket.valoracionCSAT} /></> : ''}</div>}
        </div>

        {/* Derecha: notas internas */}
        <div className="columna hide-on-print">
          <div className="card" style={{ borderColor: 'rgba(240,160,32,0.6)' }}>
            <h3 style={{ color: 'var(--warning)' }}>🕵️ Notas internas</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: -6, marginBottom: 10 }}>Solo las ve el staff en el panel.</p>
            <div className="pila" style={{ gap: 8, marginBottom: 12 }}>
              {(ticket.notasInternas || []).length === 0 && <small style={{ color: 'var(--text-secondary)' }}>Sin notas todavía.</small>}
              {(ticket.notasInternas || []).map((n, i) => (
                <div key={i} style={{ background: 'var(--bg-main)', borderLeft: '3px solid var(--warning)', padding: '8px 10px', borderRadius: 6 }}>
                  <div className="fila-espaciada" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}><strong>{n.autor}</strong><span>{fechaHora(n.fecha)}</span></div>
                  <div style={{ fontSize: '0.9rem', marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.contenido}</div>
                </div>
              ))}
            </div>
            <textarea className="input" rows={3} value={nota} onChange={e => setNota(e.target.value)} placeholder="Añade un apunte privado…" />
            <button className="btn btn-bloque" style={{ background: 'var(--warning)', color: '#fff', marginTop: 8 }} disabled={envio.ocupado || !nota.trim()} onClick={guardarNota}>+ Guardar nota</button>
          </div>
        </div>
      </div>
    </div>
  );
}
