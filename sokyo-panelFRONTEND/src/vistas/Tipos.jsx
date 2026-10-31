// Tipos de ticket: formulario propio, urgencia, equipo y categoría de cada uno. Más la escala de urgencias.
import { useState } from 'react';
import { useDatos, useAccion } from '../util.js';
import { Aviso, Campo, Cargando, ListaRoles } from '../ui.jsx';

const PREGUNTAS_DEFECTO = [
  { etiqueta: 'Asunto del ticket', placeholder: 'Ej: No puedo acceder a mi cuenta', estilo: 'corto', requerida: true, max: 100 },
  { etiqueta: 'Describe tu problema detalladamente', placeholder: '', estilo: 'largo', requerida: true, max: 1000 }
];

export default function Tipos({ apiG }) {
  const datos = useDatos(() => Promise.all([apiG('/config'), apiG('/discord')]), [apiG]);
  if (datos.error) return <Aviso aviso={{ tipo: 'error', texto: datos.error }} />;
  if (!datos.datos) return <Cargando />;
  const [config, discord] = datos.datos;
  return <Editor apiG={apiG} config={config} discord={discord} />;
}

function Editor({ apiG, config, discord }) {
  const [motivos, setMotivos] = useState(config.motivos.map(m => ({ ...m, preguntas: m.preguntas?.length ? m.preguntas : [] })));
  const [urgencias, setUrgencias] = useState(config.urgencias);
  const [abierto, setAbierto] = useState(motivos[0]?._id || null);
  const [nuevaUrg, setNuevaUrg] = useState({ nombre: '', color: '#e74c3c', nivel: 1 });
  const { ocupado, aviso, setAviso, ejecutar } = useAccion();

  const colorUrg = (n) => urgencias.find(u => u.nombre === n)?.color || '#4b5563';
  const cambiarMotivo = (i, cambios) => setMotivos(ms => ms.map((m, j) => j === i ? { ...m, ...cambios } : m));

  const anadirMotivo = () => {
    const tmp = `nuevo-${Date.now()}`;
    setMotivos(ms => [...ms, { _tmp: tmp, nombre: 'Nuevo tipo', emoji: '🎫', descripcion: '', urgencia: urgencias.find(u => u.nombre === 'Normal')?.nombre || urgencias[0]?.nombre || 'Normal', preguntas: [], rolesStaff: [], categoriaId: null }]);
    setAbierto(tmp);
  };

  const guardar = () => ejecutar(async () => {
    const r1 = await apiG('/config/urgencias', { metodo: 'PUT', cuerpo: { urgencias } });
    const r2 = await apiG('/config/motivos', { metodo: 'PUT', cuerpo: { motivos: motivos.map(m => Object.fromEntries(Object.entries(m).filter(([k]) => k !== '_tmp'))) } });
    setUrgencias(r1.config.urgencias);
    setMotivos(r2.config.motivos);
    setAbierto(null);
  }, 'Guardado. Los cambios se ven al momento en Discord (no hace falta volver a publicar el panel).');

  return (
    <div className="pila">
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      <div className="card">
        <div className="card-cabecera">
          <div><h2>📝 Tipos de ticket</h2><p>Lo que el usuario elige al abrir un ticket. Máximo 25.</p></div>
          <button className="btn btn-secundario" onClick={anadirMotivo} disabled={motivos.length >= 25}>+ Añadir tipo</button>
        </div>

        <div className="pila" style={{ gap: 10 }}>
          {motivos.map((m, i) => {
            const id = m._id || m._tmp;
            const preguntas = m.preguntas?.length ? m.preguntas : null;
            return (
              <div key={id} style={{ border: '1px solid var(--border-color)', borderRadius: 10, background: 'var(--bg-main)' }}>
                <div className="fila-espaciada" style={{ padding: '10px 14px', cursor: 'pointer' }} onClick={() => setAbierto(abierto === id ? null : id)}>
                  <div className="fila">
                    <span style={{ fontSize: '1.2rem' }}>{m.emoji || '🎫'}</span>
                    <strong>{m.nombre}</strong>
                    <span className="insignia" style={{ background: colorUrg(m.urgencia) }}>{m.urgencia}</span>
                    {m.rolesStaff?.length > 0 && <span className="insignia insignia-suave">👥 Equipo propio</span>}
                    <span className="insignia insignia-suave">{(preguntas || PREGUNTAS_DEFECTO).length} preguntas</span>
                  </div>
                  <span>{abierto === id ? '▲' : '▼'}</span>
                </div>

                {abierto === id && (
                  <div className="pila" style={{ padding: '4px 14px 16px', gap: 14 }}>
                    <div className="grid grid-3">
                      <Campo etiqueta="Nombre"><input className="input" maxLength={100} value={m.nombre} onChange={e => cambiarMotivo(i, { nombre: e.target.value })} /></Campo>
                      <Campo etiqueta="Emoji" ayuda="Un emoji normal, ej. 🚨"><input className="input" maxLength={8} value={m.emoji || ''} onChange={e => cambiarMotivo(i, { emoji: e.target.value })} /></Campo>
                      <Campo etiqueta="Urgencia">
                        <select className="input" value={m.urgencia} onChange={e => cambiarMotivo(i, { urgencia: e.target.value })}>
                          {urgencias.map(u => <option key={u.nombre} value={u.nombre}>{u.nombre}</option>)}
                        </select>
                      </Campo>
                    </div>
                    <Campo etiqueta="Descripción en el menú" ayuda="Texto pequeño bajo el nombre (opcional, máx. 100).">
                      <input className="input" maxLength={100} value={m.descripcion || ''} onChange={e => cambiarMotivo(i, { descripcion: e.target.value })} placeholder="Ej: Problemas con pagos o compras" />
                    </Campo>

                    <EditorPreguntas preguntas={preguntas} onCambiar={(p) => cambiarMotivo(i, { preguntas: p })} />

                    <div className="grid grid-2">
                      <Campo etiqueta="Equipo propio (opcional)" ayuda="Si eliges roles, SOLO ellos verán este tipo de ticket. Si no, lo atiende el equipo general.">
                        <ListaRoles roles={discord.roles} seleccion={m.rolesStaff || []} onCambiar={(r) => cambiarMotivo(i, { rolesStaff: r })} />
                      </Campo>
                      <Campo etiqueta="Categoría propia (opcional)" ayuda="Si no eliges, se usa la categoría general de tickets.">
                        <select className="input" value={m.categoriaId || ''} onChange={e => cambiarMotivo(i, { categoriaId: e.target.value || null })}>
                          <option value="">— Categoría general —</option>
                          {discord.categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </Campo>
                    </div>
                    <div>
                      <button className="btn btn-peligro" disabled={motivos.length <= 1} onClick={() => { setMotivos(ms => ms.filter((_, j) => j !== i)); setAbierto(null); }}>🗑️ Eliminar este tipo</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-cabecera"><div><h2>🚥 Niveles de urgencia</h2><p>El nivel más alto aparece primero en el panel. La IA puede subir la urgencia si detecta algo grave.</p></div></div>
        <div className="pila" style={{ gap: 8 }}>
          {[...urgencias].sort((a, b) => b.nivel - a.nivel).map(u => (
            <div key={u.nombre} className="fila-espaciada" style={{ background: 'var(--bg-main)', padding: '10px 14px', borderRadius: 8, borderLeft: `4px solid ${u.color}` }}>
              <div className="fila"><span className="punto" style={{ background: u.color, width: 12, height: 12 }} /><strong>{u.nombre}</strong><span className="insignia insignia-suave">Nivel {u.nivel}</span></div>
              <button className="btn btn-fantasma" disabled={urgencias.length <= 1} onClick={() => setUrgencias(us => us.filter(x => x.nombre !== u.nombre))} aria-label={`Eliminar ${u.nombre}`}>✖</button>
            </div>
          ))}
        </div>
        <div className="fila" style={{ marginTop: 12 }}>
          <input type="color" value={nuevaUrg.color} onChange={e => setNuevaUrg({ ...nuevaUrg, color: e.target.value })} style={{ width: 42, height: 40, border: 'none', background: 'transparent', cursor: 'pointer' }} aria-label="Color" />
          <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Nombre, ej: Crítica" value={nuevaUrg.nombre} onChange={e => setNuevaUrg({ ...nuevaUrg, nombre: e.target.value })} />
          <input className="input" type="number" min={1} max={1000} style={{ width: 90 }} value={nuevaUrg.nivel} onChange={e => setNuevaUrg({ ...nuevaUrg, nivel: Number(e.target.value) })} aria-label="Nivel" />
          <button className="btn btn-exito" disabled={!nuevaUrg.nombre.trim() || urgencias.some(u => u.nombre.toLowerCase() === nuevaUrg.nombre.trim().toLowerCase())}
            onClick={() => { setUrgencias(us => [...us, { ...nuevaUrg, nombre: nuevaUrg.nombre.trim() }]); setNuevaUrg({ nombre: '', color: '#e74c3c', nivel: 1 }); }}>Añadir</button>
        </div>
      </div>

      <div><button className="btn btn-primario btn-grande" disabled={ocupado} onClick={guardar}>💾 Guardar tipos y urgencias</button></div>
    </div>
  );
}

function EditorPreguntas({ preguntas, onCambiar }) {
  const lista = preguntas || PREGUNTAS_DEFECTO;
  const personalizadas = Boolean(preguntas);
  const cambiar = (i, cambios) => onCambiar(lista.map((p, j) => j === i ? { ...p, ...cambios } : p));

  return (
    <div style={{ border: '1px dashed var(--border-color)', borderRadius: 10, padding: 12 }}>
      <div className="fila-espaciada" style={{ marginBottom: 10 }}>
        <div>
          <strong>Formulario</strong>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{personalizadas ? 'Preguntas propias de este tipo (máx. 5, límite de Discord).' : 'Usa las preguntas por defecto: asunto y descripción.'}</div>
        </div>
        {personalizadas
          ? <button className="btn btn-secundario" onClick={() => onCambiar([])}>Volver a las de por defecto</button>
          : <button className="btn btn-secundario" onClick={() => onCambiar(PREGUNTAS_DEFECTO.map(p => ({ ...p })))}>✏️ Personalizar</button>}
      </div>
      {personalizadas && (
        <div className="pila" style={{ gap: 10 }}>
          {lista.map((p, i) => (
            <div key={i} className="grid" style={{ gridTemplateColumns: 'minmax(160px,2fr) minmax(140px,2fr) 110px 90px auto auto', alignItems: 'end', gap: 8 }}>
              <Campo etiqueta={`Pregunta ${i + 1}`}><input className="input" maxLength={45} value={p.etiqueta} onChange={e => cambiar(i, { etiqueta: e.target.value })} /></Campo>
              <Campo etiqueta="Ejemplo (opcional)"><input className="input" maxLength={100} value={p.placeholder || ''} onChange={e => cambiar(i, { placeholder: e.target.value })} /></Campo>
              <Campo etiqueta="Tipo">
                <select className="input" value={p.estilo} onChange={e => cambiar(i, { estilo: e.target.value })}>
                  <option value="corto">Corta</option><option value="largo">Larga</option>
                </select>
              </Campo>
              <Campo etiqueta="Máx."><input className="input" type="number" min={10} max={4000} value={p.max} onChange={e => cambiar(i, { max: Number(e.target.value) })} /></Campo>
              <label className="fila" style={{ gap: 6, paddingBottom: 10, fontSize: '0.85rem' }}><input type="checkbox" checked={p.requerida !== false} onChange={e => cambiar(i, { requerida: e.target.checked })} />Obligatoria</label>
              <button className="btn btn-fantasma" style={{ marginBottom: 4 }} disabled={lista.length <= 1} onClick={() => onCambiar(lista.filter((_, j) => j !== i))} aria-label="Quitar pregunta">✖</button>
            </div>
          ))}
          <div><button className="btn btn-secundario" disabled={lista.length >= 5} onClick={() => onCambiar([...lista, { etiqueta: 'Nueva pregunta', placeholder: '', estilo: 'largo', requerida: true, max: 1000 }])}>+ Añadir pregunta</button></div>
        </div>
      )}
    </div>
  );
}
