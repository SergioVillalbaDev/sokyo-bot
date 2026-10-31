// Base de conocimiento: lo que la IA usa para responder antes de abrir un ticket.
import { useState } from 'react';
import { useDatos, useAccion } from '../util.js';
import { Aviso, Campo, Cargando, Vacio } from '../ui.jsx';

const VACIO = { pregunta: '', respuesta: '' };

export default function Faq({ apiG, resumen, irA }) {
  const faq = useDatos(() => apiG('/faq'), [apiG]);
  const [editando, setEditando] = useState(null); // null | { _id?, pregunta, respuesta }
  const [busqueda, setBusqueda] = useState('');
  const { ocupado, aviso, setAviso, ejecutar } = useAccion();

  const guardar = () => ejecutar(async () => {
    const cuerpo = { pregunta: editando.pregunta, respuesta: editando.respuesta };
    const r = editando._id
      ? await apiG(`/faq/${editando._id}`, { metodo: 'PUT', cuerpo })
      : await apiG('/faq', { metodo: 'POST', cuerpo });
    faq.setDatos(lista => editando._id ? lista.map(a => a._id === r._id ? r : a) : [r, ...(lista || [])]);
    setEditando(null);
  }, editando?._id ? 'Artículo actualizado.' : 'Artículo añadido. La IA ya lo usará.');

  const borrar = (a) => ejecutar(async () => {
    if (!window.confirm(`¿Borrar “${a.pregunta}”?`)) return;
    await apiG(`/faq/${a._id}`, { metodo: 'DELETE' });
    faq.setDatos(lista => lista.filter(x => x._id !== a._id));
  });

  if (faq.cargando && !faq.datos) return <Cargando />;
  const q = busqueda.toLowerCase();
  const lista = (faq.datos || []).filter(a => !q || a.pregunta.toLowerCase().includes(q) || a.respuesta.toLowerCase().includes(q));

  return (
    <div className="pila">
      <div className="aviso aviso-ia">
        🤖 Cuando alguien va a abrir un ticket, la IA busca aquí. Si la respuesta está, se la da al momento y el ticket no llega a tu equipo.
        {!resumen.ia.disponible && ' (La IA no está configurada en este bot todavía.)'}
        {resumen.ia.disponible && !resumen.ia.deflexion && resumen.permisos.admin && <> La respuesta automática está desactivada: <button className="btn btn-fantasma" style={{ color: 'var(--ia)', padding: 0 }} onClick={() => irA('ia')}>actívala aquí</button>.</>}
      </div>
      <Aviso aviso={aviso || (faq.error && { tipo: 'error', texto: faq.error })} onCerrar={() => setAviso(null)} />

      <div className="fila-espaciada">
        <input className="input" style={{ maxWidth: 320 }} placeholder="🔍 Buscar en la FAQ" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <button className="btn btn-primario" onClick={() => setEditando({ ...VACIO })}>+ Nuevo artículo</button>
      </div>

      {editando && (
        <div className="card">
          <h3>{editando._id ? '✏️ Editar artículo' : '➕ Nuevo artículo'}</h3>
          <div className="pila" style={{ gap: 12 }}>
            <Campo etiqueta="Pregunta" ayuda="Escríbela como la haría un usuario.">
              <input className="input" maxLength={300} value={editando.pregunta} onChange={e => setEditando({ ...editando, pregunta: e.target.value })} placeholder="¿Cómo recupero mi cuenta?" />
            </Campo>
            <Campo etiqueta="Respuesta" ayuda="Pasos concretos. Puedes usar formato de Discord (**negrita**, listas…).">
              <textarea className="input" rows={6} maxLength={4000} value={editando.respuesta} onChange={e => setEditando({ ...editando, respuesta: e.target.value })} />
            </Campo>
            <div className="fila">
              <button className="btn btn-primario" disabled={ocupado || !editando.pregunta.trim() || !editando.respuesta.trim()} onClick={guardar}>💾 Guardar</button>
              <button className="btn btn-secundario" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {lista.length === 0 ? (
        <div className="card"><Vacio icono="📚">{busqueda ? 'Nada coincide con tu búsqueda.' : 'Aún no hay preguntas frecuentes. Añade las dudas que más se repiten, o usa “📚 Convertir en FAQ” dentro de un ticket resuelto.'}</Vacio></div>
      ) : (
        <div className="pila" style={{ gap: 10 }}>
          {lista.map(a => (
            <div key={a._id} className="card" style={{ padding: '1rem 1.15rem' }}>
              <div className="fila-espaciada" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{a.pregunta}</strong>
                  <p style={{ color: 'var(--text-secondary)', marginTop: 6, whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>{a.respuesta}</p>
                </div>
                <div className="fila" style={{ flexShrink: 0 }}>
                  <span className="insignia insignia-ia" title="Veces que la IA resolvió una consulta con este artículo">🤖 {a.usos}</span>
                  <button className="btn btn-secundario" onClick={() => setEditando({ _id: a._id, pregunta: a.pregunta, respuesta: a.respuesta })}>Editar</button>
                  <button className="btn btn-fantasma" onClick={() => borrar(a)} aria-label="Borrar">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
