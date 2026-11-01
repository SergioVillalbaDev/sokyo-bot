import { useEffect, useState } from 'react';
import { apiJson, enviar } from './api.js';
import { toast } from './toast.js';
import { Aviso, Campo } from './ui.jsx';

function Editor({ tipo, items, recargar }) {
  const esMacro = tipo === 'macros';
  const vacio = esMacro ? { nombre: '', contenido: '' } : { titulo: '', palabras: '', contenido: '' };
  const [sel, setSel] = useState(null);       // item en edición (null = nuevo)
  const [f, setF] = useState(vacio);

  const editar = (it) => { setSel(it); setF(esMacro ? { nombre: it.nombre, contenido: it.contenido } : { titulo: it.titulo, palabras: it.palabras.join(', '), contenido: it.contenido }); };
  const nuevo = () => { setSel(null); setF(vacio); };

  const guardar = async () => {
    try {
      if (sel) await enviar('PUT', `/api/${tipo}/${sel._id}`, f); else await enviar('POST', `/api/${tipo}`, f);
      toast('✅ Guardado', 'ok'); nuevo(); recargar();
    } catch (e) { toast(e.message, 'error'); }
  };
  const borrar = async (it) => {
    if (!window.confirm(`¿Borrar «${it.nombre || it.titulo}»?`)) return;
    try { await enviar('DELETE', `/api/${tipo}/${it._id}`); toast('Eliminado', 'ok'); if (sel?._id === it._id) nuevo(); recargar(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="editor" style={{ gridTemplateColumns: 'minmax(260px, 340px) 1fr' }}>
      <div className="lista-roles">
        <button className="btn verde" onClick={nuevo}>➕ {esMacro ? 'Nueva respuesta' : 'Nuevo artículo'}</button>
        {items.length === 0 && <div className="muted small" style={{ padding: 8 }}>Todavía no hay nada. ¡Crea el primero!</div>}
        {items.map((it) => (
          <div key={it._id} className={`rol-item ${sel?._id === it._id ? 'sel' : ''}`} style={{ '--c': '#5865F2' }} onClick={() => editar(it)}>
            <div className="grow"><div className="n">{esMacro ? `⚡ ${it.nombre}` : `📖 ${it.titulo}`}</div><div className="m">{esMacro ? `${it.usos} usos` : `${it.visitas} vistas · ${it.palabras.length} palabras clave`}</div></div>
            <button className="btn pequeno fantasma" onClick={(e) => { e.stopPropagation(); borrar(it); }} aria-label="Borrar">🗑️</button>
          </div>
        ))}
      </div>
      <div className="card pg" style={{ gap: 14 }}>
        <h3>{sel ? '✏️ Editar' : '➕ Crear'} {esMacro ? 'respuesta rápida' : 'artículo de ayuda'}</h3>
        {esMacro ? (
          <>
            <Campo etiqueta="Nombre" ayuda="Se usa con /macro nombre y en el desplegable del panel. Sin espacios."><input className="input" value={f.nombre} disabled={!!sel} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="saludo-inicial" /></Campo>
            <Campo etiqueta="Mensaje" ayuda="Variables: {usuario} {staff} {ticket} {servidor}"><textarea className="textarea" value={f.contenido} onChange={(e) => setF({ ...f, contenido: e.target.value })} placeholder="¡Hola {usuario}! Soy {staff}, ¿en qué puedo ayudarte?" /></Campo>
          </>
        ) : (
          <>
            <Campo etiqueta="Título"><input className="input" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="¿Cómo recupero mi contraseña?" /></Campo>
            <Campo etiqueta="Palabras clave" ayuda="Separadas por comas. Si el usuario las escribe al abrir un ticket, el bot le sugerirá este artículo antes."><input className="input" value={f.palabras} onChange={(e) => setF({ ...f, palabras: e.target.value })} placeholder="contraseña, password, olvidé" /></Campo>
            <Campo etiqueta="Contenido"><textarea className="textarea" style={{ minHeight: 160 }} value={f.contenido} onChange={(e) => setF({ ...f, contenido: e.target.value })} /></Campo>
          </>
        )}
        <div className="row"><button className="btn" onClick={guardar} disabled={!f.contenido.trim() || (esMacro ? !f.nombre.trim() : !f.titulo.trim())}>💾 Guardar</button>{sel && <button className="btn fantasma" onClick={nuevo}>Cancelar</button>}</div>
      </div>
    </div>
  );
}

export default function Contenido() {
  const [tab, setTab] = useState('macros');
  const [datos, setDatos] = useState({ macros: [], faq: [] });
  const [error, setError] = useState('');

  const recargar = () => Promise.all([apiJson('/api/macros'), apiJson('/api/faq')]).then(([macros, faq]) => { setDatos({ macros, faq }); setError(''); }).catch((e) => setError(e.message));
  useEffect(() => { recargar(); }, []);

  if (error) return <Aviso tipo="error">{error}</Aviso>;
  return (
    <div className="pg">
      <div className="tabs"><button className={`tab ${tab === 'macros' ? 'activa' : ''}`} onClick={() => setTab('macros')}>⚡ Respuestas rápidas</button><button className={`tab ${tab === 'faq' ? 'activa' : ''}`} onClick={() => setTab('faq')}>📚 Base de conocimiento (FAQ)</button></div>
      <Aviso>{tab === 'macros' ? 'Las respuestas rápidas las usa el staff desde el panel o con /macro en Discord, sin escribir lo mismo mil veces.' : 'Antes de abrir un ticket, el bot sugiere estos artículos si coinciden con lo que escribe el usuario. Muchos tickets se resuelven solos.'}</Aviso>
      <Editor key={tab} tipo={tab} items={datos[tab]} recargar={recargar} />
    </div>
  );
}
