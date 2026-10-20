import { useState } from 'react';
import { api, descargar } from '../api.js';
import { useAhora, useCarga } from '../hooks.js';
import { useConfirmar, useToast } from '../contexto.js';
import { duracion, enlaceDiscord, fechaLarga, haceTiempo, numeroTicket } from '../utils.js';
import { Avatar, AvisoError, Cargando, Estrellas, InsigniaEspera, InsigniaEstado, InsigniaPrioridad, Vacio } from '../components/ui.jsx';
import Chat from '../components/Chat.jsx';
import Icono from '../components/Icono.jsx';

const ROLES = { Creador: '👤 Creador', Staff: '🛡️ Staff', Invitado: '➕ Invitado' };

function Notas({ ticket, onAñadir, onBorrar }) {
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const notas = [...(ticket.notasInternas || [])].reverse();

  const guardar = async () => {
    if (!texto.trim()) return;
    setGuardando(true);
    if (await onAñadir(texto.trim())) setTexto('');
    setGuardando(false);
  };

  return (
    <div className="tarjeta notas">
      <div className="tarjeta-cabecera">
        <div><h3>🕵️ Notas internas</h3><p>Solo las ve el staff, nunca el usuario.</p></div>
      </div>
      <div className="tarjeta-cuerpo columna" style={{ gap: 10 }}>
        <textarea className="entrada" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000}
          placeholder="Añade un apunte para el equipo…" aria-label="Nueva nota interna" style={{ minHeight: 70 }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) guardar(); }} />
        <button className="btn btn-secundario btn-sm" onClick={guardar} disabled={!texto.trim() || guardando}>
          <Icono nombre="mas" />{guardando ? 'Guardando…' : 'Guardar nota'}
        </button>
        {notas.length === 0
          ? <p className="texto-3 pequeño" style={{ textAlign: 'center', padding: '8px 0' }}>Aún no hay notas.</p>
          : notas.map((n, i) => (
            <div key={n._id || i} className="nota">
              <div className="cabecera">
                <strong>{n.autor}</strong>
                <span className="fila" style={{ gap: 4 }}>
                  {n.fecha && <span title={fechaLarga(n.fecha)}>{fechaLarga(n.fecha)}</span>}
                  {n._id && n.fecha && (
                    <button className="btn btn-fantasma btn-icono btn-sm borrar" style={{ width: 22, minHeight: 22 }} onClick={() => onBorrar(n)} aria-label="Borrar nota" title="Borrar nota">
                      <Icono nombre="papelera" />
                    </button>
                  )}
                </span>
              </div>
              <p>{n.contenido}</p>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function TicketDetalle({ guildId, canalId, config, yo, onCambio }) {
  const toast = useToast();
  const confirmar = useConfirmar();
  const ahora = useAhora();
  const base = `/api/servidores/${guildId}/tickets/${canalId}`;
  const ticket = useCarga(() => api(base), [base], { intervalo: 15000 });
  const mensajes = useCarga(() => api(`${base}/mensajes`), [base], { intervalo: 4000 });
  const [ocupado, setOcupado] = useState(false);
  const t = ticket.datos;

  if (ticket.error?.status === 404) {
    return <div className="tarjeta"><Vacio emoji="🔎" titulo="Ticket no encontrado" accion={<a className="btn btn-secundario" href="#/tickets">Volver a tickets</a>}>Puede que pertenezca a otro servidor o que ya no exista.</Vacio></div>;
  }
  if (!t) return ticket.error ? <AvisoError error={ticket.error} onReintentar={ticket.recargar} /> : <Cargando />;

  const abierto = t.estado === 'Abierto';
  const urgencia = config.urgencias.find(u => u.nombre === t.prioridad);
  const esMio = t.asignadoA && t.asignadoA === yo.id;

  const accion = async (fn, exito) => {
    setOcupado(true);
    try {
      const nuevo = await fn();
      if (nuevo) ticket.mutar(nuevo);
      if (exito) toast.exito(exito);
      onCambio?.();
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const cerrar = async () => {
    const r = await confirmar({
      titulo: `Cerrar ${numeroTicket(t) || 'ticket'}`,
      mensaje: 'El canal se archivará en Discord en modo solo lectura y el usuario recibirá un resumen por DM.',
      campo: { etiqueta: 'Motivo del cierre (opcional)', placeholder: 'Ej: Problema resuelto', ayuda: 'Se incluye en el resumen que recibe el usuario.' },
      textoConfirmar: 'Cerrar ticket',
      peligro: true
    });
    if (r.ok) accion(() => api(`${base}/cerrar`, { metodo: 'PUT', body: { motivo: r.valor } }), 'Ticket cerrado');
  };
  const reabrir = async () => {
    if (await confirmar({ titulo: 'Reabrir ticket', mensaje: 'El usuario podrá volver a escribir y se le avisará en el canal.', textoConfirmar: 'Reabrir' })) {
      accion(() => api(`${base}/reabrir`, { metodo: 'PUT' }), 'Ticket reabierto');
    }
  };
  const asignar = (accionAsignar) => accion(
    () => api(`${base}/asignacion`, { metodo: 'PUT', body: { accion: accionAsignar } }),
    accionAsignar === 'reclamar' ? 'Ahora este ticket es tuyo' : 'El ticket vuelve a estar sin asignar'
  );
  const cambiarPrioridad = (prioridad) => accion(() => api(`${base}/prioridad`, { metodo: 'PUT', body: { prioridad } }), `Prioridad: ${prioridad}`);
  const visibilidad = (visible) => accion(() => api(`${base}/visibilidad`, { metodo: 'PUT', body: { visible } }), visible ? 'Visible en el panel' : 'Ocultado del panel');
  const transcript = async () => {
    try {
      await descargar(`${base}/transcript`, `transcript-${(numeroTicket(t) || 'ticket').replace('#', '')}.html`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const enviar = async (contenido) => {
    try {
      const nuevo = await api(`${base}/mensajes`, { metodo: 'POST', body: { contenido } });
      mensajes.mutar(prev => [...(prev || []), nuevo]);
      ticket.mutar(prev => ({ ...prev, esperando: 'usuario', ultimaActividad: nuevo.fecha }));
    } catch (e) {
      toast.error(e.message);
      throw e;
    }
  };
  const añadirNota = (contenido) => accion(() => api(`${base}/notas`, { metodo: 'POST', body: { contenido } }), 'Nota guardada');
  const borrarNota = async (nota) => {
    if (await confirmar({ titulo: 'Borrar nota', mensaje: '¿Seguro que quieres borrar esta nota interna?', textoConfirmar: 'Borrar', peligro: true })) {
      accion(() => api(`${base}/notas/${nota._id}`, { metodo: 'DELETE' }), 'Nota borrada');
    }
  };

  const participantes = t.participantes?.length ? t.participantes : [{ id: t.creadorId, username: t.creadorNombre, avatar: t.creadorAvatar, rol: 'Creador' }];
  const motivoBloqueo = t.canalEliminado
    ? 'El canal de este ticket se eliminó de Discord. La conversación se conserva aquí como archivo.'
    : 'Este ticket está cerrado. Reábrelo para seguir la conversación.';

  return (
    <>
      <div className="detalle-cabecera">
        <a className="btn btn-secundario btn-icono" href="#/tickets" aria-label="Volver a tickets" title="Volver a tickets"><Icono nombre="atras" /></a>
        <div className="titulo">
          <div className="fila envolver" style={{ gap: 6 }}>
            <span className="texto-3 negrita">{numeroTicket(t) || 'Ticket'}</span>
            <InsigniaEstado ticket={t} />
            <InsigniaPrioridad nombre={t.prioridad} color={urgencia?.color || '#80848e'} />
            <InsigniaEspera ticket={t} />
            {!t.visibleWeb && <span className="insignia">🙈 Oculto</span>}
          </div>
          <h1>{t.titulo || t.motivo}</h1>
        </div>
        <div className="detalle-acciones">
          {abierto && !t.asignadoA && yo.tipo === 'discord' && (
            <button className="btn btn-primario" onClick={() => asignar('reclamar')} disabled={ocupado}><Icono nombre="mano" />Reclamar</button>
          )}
          {abierto && t.asignadoA && (
            <button className="btn btn-secundario" onClick={() => asignar('liberar')} disabled={ocupado} title={esMio ? 'Soltar el ticket' : `Quitárselo a ${t.asignadoNombre}`}>
              <Icono nombre="soltar" />Liberar
            </button>
          )}
          {abierto
            ? <button className="btn btn-peligro" onClick={cerrar} disabled={ocupado}><Icono nombre="candado" />Cerrar</button>
            : !t.canalEliminado && <button className="btn btn-exito" onClick={reabrir} disabled={ocupado}><Icono nombre="abrir" />Reabrir</button>}
          <button className="btn btn-secundario btn-icono" onClick={transcript} title="Descargar transcript (HTML)" aria-label="Descargar transcript"><Icono nombre="descargar" /></button>
          {t.canalExiste && (
            <a className="btn btn-secundario btn-icono" href={enlaceDiscord(guildId, t.canalId)} target="_blank" rel="noopener noreferrer" title="Abrir en Discord" aria-label="Abrir en Discord"><Icono nombre="externo" /></a>
          )}
          <button className="btn btn-secundario btn-icono" onClick={() => visibilidad(!t.visibleWeb)} disabled={ocupado}
            title={t.visibleWeb ? 'Ocultar del panel' : 'Mostrar en el panel'} aria-label={t.visibleWeb ? 'Ocultar del panel' : 'Mostrar en el panel'}>
            <Icono nombre={t.visibleWeb ? 'ojoNo' : 'ojo'} />
          </button>
        </div>
      </div>

      <div className="detalle">
        <div className="lateral info">
          <div className="tarjeta">
            <div className="tarjeta-cabecera"><h3>Información</h3></div>
            <div className="tarjeta-cuerpo" style={{ paddingTop: 8, paddingBottom: 8 }}>
              <dl className="lista-datos">
                <div><dt>Categoría</dt><dd>{t.motivo}</dd></div>
                <div>
                  <dt>Prioridad</dt>
                  <dd>
                    {abierto ? (
                      <select className="entrada entrada-sm" value={t.prioridad} onChange={(e) => cambiarPrioridad(e.target.value)} disabled={ocupado} aria-label="Cambiar prioridad">
                        {[...config.urgencias].sort((a, b) => b.nivel - a.nivel).map(u => <option key={u.nombre} value={u.nombre}>{u.nombre}</option>)}
                        {!urgencia && <option value={t.prioridad}>{t.prioridad}</option>}
                      </select>
                    ) : t.prioridad}
                  </dd>
                </div>
                <div><dt>Atendido por</dt><dd>{t.asignadoNombre || <span className="texto-3">Sin asignar</span>}</dd></div>
                <div><dt>Abierto</dt><dd title={fechaLarga(t.fechaCreacion)}>{haceTiempo(t.fechaCreacion, ahora)}</dd></div>
                <div><dt>Última actividad</dt><dd>{haceTiempo(t.ultimaActividad || t.fechaCreacion, ahora)}</dd></div>
                {t.primeraRespuestaStaff && <div><dt>1ª respuesta</dt><dd>en {duracion(new Date(t.primeraRespuestaStaff) - new Date(t.fechaCreacion))}</dd></div>}
                {!abierto && <div><dt>Cerrado</dt><dd title={fechaLarga(t.fechaCierre)}>{t.fechaCierre ? haceTiempo(t.fechaCierre, ahora) : '—'}{t.cerradoPor ? ` · ${t.cerradoPor}` : ''}</dd></div>}
                {!abierto && t.motivoCierre && <div><dt>Motivo</dt><dd style={{ fontWeight: 400 }}>{t.motivoCierre}</dd></div>}
                {!abierto && <div><dt>Valoración</dt><dd><Estrellas valor={t.valoracionCSAT} /></dd></div>}
              </dl>
              {t.comentarioCSAT && <p className="nota" style={{ borderLeftColor: 'var(--warning)', marginBottom: 8 }}>💬 “{t.comentarioCSAT}”</p>}
            </div>
          </div>

          <div className="tarjeta">
            <div className="tarjeta-cabecera"><h3>👥 Participantes</h3><span className="texto-3 pequeño">{participantes.length}</span></div>
            <div className="tarjeta-cuerpo" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {participantes.map(p => (
                <div key={p.id} className="persona">
                  <Avatar src={p.avatar} nombre={p.username} tamaño={36} />
                  <div style={{ minWidth: 0 }}>
                    <div className="nombre recortar">{p.username}</div>
                    <div className="texto-3 pequeño">{ROLES[p.rol] || p.rol}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="tarjeta conversacion">
          <Chat
            mensajes={mensajes.datos}
            descripcion={t.descripcion}
            puedeEscribir={abierto && t.canalExiste}
            motivoBloqueo={abierto ? 'El canal de Discord no está disponible.' : motivoBloqueo}
            onEnviar={enviar}
            placeholder={`Responder a ${t.creadorNombre}…`}
            ayuda="se enviará al canal de Discord"
          />
        </div>

        <div className="lateral notas-col">
          <Notas ticket={t} onAñadir={añadirNota} onBorrar={borrarNota} />
        </div>
      </div>
    </>
  );
}
