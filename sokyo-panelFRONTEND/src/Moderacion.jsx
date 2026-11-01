import { useEffect, useRef, useState } from 'react';
import { apiJson, enviar, avatarPorDefecto } from './api.js';
import { usePermisos } from './contexto.js';
import { toast } from './toast.js';
import { Aviso, Campo, Modal } from './ui.jsx';

const ACCIONES = {
  warn:   { permiso: 'mod.warn', nombre: 'Avisar',    icono: '⚠️', clase: 'amarillo', color: '#f1c40f' },
  mute:   { permiso: 'mod.mute', nombre: 'Silenciar', icono: '🔇', clase: 'gris',     color: '#e67e22' },
  kick:   { permiso: 'mod.kick', nombre: 'Expulsar',  icono: '👢', clase: 'rojo',     color: '#e67e22' },
  ban:    { permiso: 'mod.ban',  nombre: 'Banear',    icono: '🔨', clase: 'rojo',     color: '#e74c3c' },
  unmute: { permiso: 'mod.mute', nombre: 'Quitar silencio', icono: '🔊', clase: 'verde', color: '#2ecc71' },
  unban:  { permiso: 'mod.ban',  nombre: 'Desbanear', icono: '🕊️', clase: 'verde',    color: '#2ecc71' },
};
const TIPOS_SANCION = { warn: ['⚠️', 'Aviso', '#f1c40f'], mute: ['🔇', 'Silencio', '#e67e22'], unmute: ['🔊', 'Silencio retirado', '#2ecc71'], kick: ['👢', 'Expulsión', '#e67e22'], ban: ['🔨', 'Ban', '#e74c3c'], unban: ['🕊️', 'Desban', '#2ecc71'] };

export default function Moderacion() {
  const { tiene, catalogo } = usePermisos();
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [sanciones, setSanciones] = useState([]);
  const [accion, setAccion] = useState(null); // { tipo, miembro }
  const [form, setForm] = useState({ razon: '', duracion: '1h', dias: 0 });
  const [enviando, setEnviando] = useState(false);
  const [idManual, setIdManual] = useState('');
  const temporizador = useRef(null);

  const cargarSanciones = () => { if (tiene('mod.historial')) apiJson('/api/moderacion/sanciones').then(setSanciones).catch(() => {}); };
  useEffect(cargarSanciones, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buscar = (texto) => {
    setQ(texto);
    clearTimeout(temporizador.current);
    if (texto.trim().length < 2) { setResultados([]); return; }
    temporizador.current = setTimeout(async () => {
      setBuscando(true);
      try { setResultados(await apiJson(`/api/moderacion/miembros?q=${encodeURIComponent(texto.trim())}`)); } catch (e) { toast(e.message, 'error'); } finally { setBuscando(false); }
    }, 350);
  };

  const abrir = (tipo, miembro) => { setAccion({ tipo, miembro }); setForm({ razon: '', duracion: '1h', dias: 0 }); };

  const ejecutar = async () => {
    setEnviando(true);
    try {
      await enviar('POST', `/api/moderacion/${accion.tipo}`, { usuarioId: accion.miembro.id, razon: form.razon, duracion: accion.tipo === 'mute' ? form.duracion : undefined, dias: accion.tipo === 'ban' ? form.dias : undefined });
      toast(`${ACCIONES[accion.tipo].icono} ${ACCIONES[accion.tipo].nombre}: ${accion.miembro.nombre}`, 'ok');
      setAccion(null); cargarSanciones();
      if (q.trim().length >= 2) buscar(q);
    } catch (e) { toast(e.message, 'error'); } finally { setEnviando(false); }
  };

  const nombrePerm = (id) => catalogo?.permisos.find((p) => p.id === id)?.nombre || id;
  const razonBloqueo = (a, m) => !tiene(ACCIONES[a].permiso) ? `Te falta el permiso de Discord: ${catalogo?.permisos.find((p) => p.id === ACCIONES[a].permiso)?.nativosNombre}` : (m.motivoBloqueo || 'El bot no puede actuar sobre este usuario (jerarquía de roles)');

  return (
    <div className="pg">
      <div className="card">
        <h3>🔐 Tus acciones de moderación</h3>
        <div className="sub">Salen de tus permisos de Discord. Si no puedes hacer algo en Discord, tampoco desde aquí.</div>
        <div className="row">
          {['warn', 'mute', 'kick', 'ban'].map((a) => <span key={a} className={`pill ${tiene(ACCIONES[a].permiso) ? 'panel' : ''}`}>{tiene(ACCIONES[a].permiso) ? '✅' : '🔒'} {ACCIONES[a].icono} {ACCIONES[a].nombre}</span>)}
          <span className={`pill ${tiene('mod.historial') ? 'panel' : ''}`}>{tiene('mod.historial') ? '✅' : '🔒'} 📜 Ver sanciones</span>
        </div>
      </div>

      <div className="card">
        <h3>🔎 Buscar usuario</h3>
        <input className="input" placeholder="Nombre, apodo o ID del usuario…" value={q} onChange={(e) => buscar(e.target.value)} />
        {buscando && <div className="muted small" style={{ marginTop: 10 }}>Buscando…</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {resultados.map((m) => (
            <div className="miembro" key={m.id}>
              <img src={m.avatar || avatarPorDefecto(m.nombre)} alt="" />
              <div>
                <strong>{m.apodo}</strong> <span className="muted small">@{m.nombre}</span>
                <div className="row" style={{ gap: 6, marginTop: 4 }}>
                  {m.rolMasAlto && <span className="rol-chip" style={{ borderColor: `${m.rolMasAlto.color}88` }}><i style={{ background: m.rolMasAlto.color }} />{m.rolMasAlto.nombre}</span>}
                  {m.silenciado && <span className="pill">🔇 Silenciado</span>}
                  {m.motivoBloqueo && <span className="pill">🛡️ {m.motivoBloqueo}</span>}
                </div>
              </div>
              <div className="acciones-mod">
                {['warn', 'mute', 'kick', 'ban'].map((a) => (
                  <button key={a} className={`btn pequeno ${ACCIONES[a].clase} ${m.puede[a] ? '' : 'bloqueado'}`} disabled={!m.puede[a]} title={m.puede[a] ? ACCIONES[a].nombre : razonBloqueo(a, m)} onClick={() => abrir(a, m)}>
                    {m.puede[a] ? ACCIONES[a].icono : '🔒'} {ACCIONES[a].nombre}
                  </button>
                ))}
                {m.silenciado && tiene('mod.mute') && <button className="btn pequeno verde" onClick={() => abrir('unmute', m)}>🔊 Quitar silencio</button>}
              </div>
            </div>
          ))}
          {q.trim().length >= 2 && !buscando && resultados.length === 0 && <div className="muted small">Sin resultados. Para actuar sobre alguien que ya no está en el servidor usa su ID abajo.</div>}
        </div>
      </div>

      {tiene('mod.ban') && (
        <div className="card">
          <h3>🕊️ Desbanear por ID</h3>
          <div className="row"><input className="input grow" placeholder="ID del usuario baneado (17-20 dígitos)" value={idManual} onChange={(e) => setIdManual(e.target.value.trim())} />
            <button className="btn verde" disabled={!/^\d{15,25}$/.test(idManual)} onClick={() => abrir('unban', { id: idManual, nombre: idManual })}>Desbanear</button></div>
        </div>
      )}

      {tiene('mod.historial') ? (
        <div className="card">
          <h3>📜 Últimas sanciones</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {sanciones.length === 0 && <div className="muted">Aún no hay sanciones registradas.</div>}
            {sanciones.slice(0, 25).map((s) => { const [ic, nom, col] = TIPOS_SANCION[s.tipo] || ['•', s.tipo, '#999']; return (
              <div className="sancion" key={s._id} style={{ '--c': col }}>
                <div style={{ fontSize: '1.3rem' }}>{ic}</div>
                <div className="grow"><div><strong>{nom}</strong> · {s.usuarioNombre} <span className="muted small">({s.usuarioId})</span></div>
                  <div className="small muted">{s.razon}</div>
                  <div className="small muted">por <strong>{s.moderadorNombre}</strong>{s.origen === 'panel' ? ' (panel)' : s.origen === 'automod' ? ' (AutoMod)' : ''} · {new Date(s.fecha).toLocaleString('es-ES')}</div></div>
              </div>); })}
          </div>
        </div>
      ) : <Aviso tipo="info">No tienes permiso para ver el historial de sanciones ({nombrePerm('mod.historial')}).</Aviso>}

      {accion && (
        <Modal titulo={`${ACCIONES[accion.tipo].icono} ${ACCIONES[accion.tipo].nombre}: ${accion.miembro.nombre}`} onCerrar={() => setAccion(null)}>
          {accion.tipo === 'ban' && <Aviso tipo="warn">El usuario quedará <strong>baneado del servidor</strong>. Se registrará en el historial y en los logs.</Aviso>}
          {accion.tipo === 'mute' && (
            <Campo etiqueta="Duración" ayuda="Ej: 10m, 2h, 1d (máximo 28 días)">
              <div className="row" style={{ gap: 6 }}>{['10m', '1h', '1d', '7d'].map((d) => <button key={d} className={`btn pequeno ${form.duracion === d ? '' : 'fantasma'}`} onClick={() => setForm({ ...form, duracion: d })}>{d}</button>)}<input className="input" style={{ width: 110 }} value={form.duracion} onChange={(e) => setForm({ ...form, duracion: e.target.value })} /></div>
            </Campo>
          )}
          {accion.tipo === 'ban' && <Campo etiqueta="Borrar mensajes de los últimos…"><select className="select" value={form.dias} onChange={(e) => setForm({ ...form, dias: Number(e.target.value) })}><option value={0}>No borrar</option><option value={1}>1 día</option><option value={3}>3 días</option><option value={7}>7 días</option></select></Campo>}
          <Campo etiqueta="Motivo"><textarea className="textarea" style={{ minHeight: 80 }} maxLength={400} value={form.razon} onChange={(e) => setForm({ ...form, razon: e.target.value })} placeholder="Queda registrado y se envía al usuario por mensaje privado." /></Campo>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn fantasma" onClick={() => setAccion(null)}>Cancelar</button>
            <button className={`btn ${ACCIONES[accion.tipo].clase}`} disabled={enviando} onClick={ejecutar}>{enviando ? 'Aplicando…' : `${ACCIONES[accion.tipo].icono} Confirmar`}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
