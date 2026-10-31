// Paneles: el mensaje con el botón para abrir tickets. Se pueden tener varios (uno por canal).
import { useState } from 'react';
import { useDatos, useAccion } from '../util.js';
import { Aviso, Campo, Cargando } from '../ui.jsx';

const PIE_GRATIS = '⚡ Sokyo · Tickets con IA para Discord';

export default function Paneles({ apiG, resumen, irA }) {
  const datos = useDatos(() => Promise.all([apiG('/config'), apiG('/discord')]), [apiG]);
  if (datos.error) return <Aviso aviso={{ tipo: 'error', texto: datos.error }} />;
  if (!datos.datos) return <Cargando />;
  const [config, discord] = datos.datos;
  return <Editor apiG={apiG} config={config} discord={discord} premium={resumen.plan.premium} irA={irA} />;
}

function Editor({ apiG, config, discord, premium, irA }) {
  const [paneles, setPaneles] = useState(config.paneles);
  const [footer, setFooter] = useState(config.footerPersonalizado || '');
  const [sel, setSel] = useState(0);
  const [canal, setCanal] = useState('');
  const { ocupado, aviso, setAviso, ejecutar } = useAccion();
  const p = paneles[sel] || paneles[0];
  const cambiar = (cambios) => setPaneles(ps => ps.map((x, i) => i === sel ? { ...x, ...cambios } : x));
  const motivosSel = p.motivos?.length ? config.motivos.filter(m => p.motivos.includes(m._id)) : config.motivos;

  const guardar = async () => {
    const r = await apiG('/config/paneles', { metodo: 'PUT', cuerpo: { paneles, footer } });
    setPaneles(r.config.paneles);
    return r.config.paneles;
  };

  const publicar = () => ejecutar(async () => {
    const guardados = await guardar();
    const panel = guardados[sel] || guardados[0];
    const r = await apiG(`/paneles/${panel._id}/publicar`, { metodo: 'POST', cuerpo: { canalId: canal } });
    return r;
  }, 'Panel publicado en Discord.');

  const alternarMotivo = (id) => {
    const actuales = p.motivos?.length ? p.motivos : [];
    cambiar({ motivos: actuales.includes(id) ? actuales.filter(x => x !== id) : [...actuales, id] });
  };

  return (
    <div className="pila">
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      <div className="fila">
        {paneles.map((x, i) => (
          <button key={x._id || i} className={`chip ${i === sel ? 'activo' : ''}`} onClick={() => setSel(i)}>🧩 {x.nombre}</button>
        ))}
        <button className="chip" disabled={paneles.length >= 10} onClick={() => { setPaneles(ps => [...ps, { nombre: `Panel ${ps.length + 1}`, titulo: '🎫 Soporte', descripcion: 'Pulsa el botón para abrir un ticket.', color: '#5865F2', textoBoton: '📩 Abrir Ticket', motivos: [] }]); setSel(paneles.length); }}>+ Nuevo panel</button>
      </div>

      <div className="grid grid-2">
        <div className="card pila" style={{ gap: 14 }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 110px', gap: 10 }}>
            <Campo etiqueta="Nombre interno"><input className="input" maxLength={50} value={p.nombre} onChange={e => cambiar({ nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Color"><input type="color" className="input" style={{ padding: 2, height: 40 }} value={p.color || '#5865F2'} onChange={e => cambiar({ color: e.target.value })} /></Campo>
          </div>
          <Campo etiqueta="Título"><input className="input" maxLength={256} value={p.titulo} onChange={e => cambiar({ titulo: e.target.value })} /></Campo>
          <Campo etiqueta="Descripción / instrucciones"><textarea className="input" rows={5} maxLength={4000} value={p.descripcion} onChange={e => cambiar({ descripcion: e.target.value })} /></Campo>
          <Campo etiqueta="Texto del botón"><input className="input" maxLength={80} value={p.textoBoton} onChange={e => cambiar({ textoBoton: e.target.value })} /></Campo>
          <Campo etiqueta="Tipos de ticket de este panel" ayuda="Si no marcas ninguno, salen todos. Si marcas solo uno, el botón abre su formulario directamente.">
            <div className="lista-check">
              {config.motivos.map(m => (
                <label key={m._id}><input type="checkbox" checked={(p.motivos || []).includes(m._id)} onChange={() => alternarMotivo(m._id)} />{m.emoji} {m.nombre}</label>
              ))}
            </div>
          </Campo>
          <Campo etiqueta={<>Pie de página {!premium && <span className="insignia insignia-premium">⭐ Premium</span>}</>} ayuda={premium ? 'Se muestra en todos los paneles y mensajes del bot.' : 'En el plan gratis se muestra la marca de Sokyo.'}>
            <input className="input" maxLength={200} disabled={!premium} value={premium ? footer : PIE_GRATIS} onChange={e => setFooter(e.target.value)} />
          </Campo>
          {!premium && <button className="btn btn-fantasma" style={{ alignSelf: 'flex-start', color: 'var(--accent-color)' }} onClick={() => irA('plan')}>Quitar la marca con Premium →</button>}
          <div className="fila">
            <button className="btn btn-primario" disabled={ocupado} onClick={() => ejecutar(guardar, 'Paneles guardados. Los paneles ya publicados se actualizan al volver a publicarlos.')}>💾 Guardar</button>
            <button className="btn btn-fantasma" disabled={paneles.length <= 1} onClick={() => { setPaneles(ps => ps.filter((_, i) => i !== sel)); setSel(0); }}>🗑️ Eliminar panel</button>
          </div>
        </div>

        <div className="pila">
          <div className="card">
            <h3>👀 Vista previa en Discord</h3>
            <div style={{ background: '#313338', padding: 14, borderRadius: 8 }}>
              <div className="discord-embed" style={{ borderLeftColor: p.color || '#5865F2' }}>
                <div className="t">{p.titulo || 'Título'}</div>
                <div className="d">{p.descripcion}</div>
                <div className="f">{premium ? (footer || PIE_GRATIS) : PIE_GRATIS}</div>
              </div>
              <div className="discord-botones">
                <span className="discord-boton">{p.textoBoton || '📩 Abrir Ticket'}</span>
                {!premium && <span className="discord-boton gris">⚡ Añadir Sokyo a tu servidor ↗</span>}
              </div>
              <div style={{ color: '#949ba4', fontSize: '0.8rem', marginTop: 12 }}>
                Al pulsar: {motivosSel.length === 1 ? `formulario de “${motivosSel[0].nombre}”` : `menú con ${motivosSel.length} tipos (${motivosSel.map(m => m.nombre).join(', ')})`}
              </div>
            </div>
          </div>
          <div className="card">
            <h3>📤 Publicar en un canal</h3>
            <div className="fila">
              <select className="input" style={{ flex: 1, minWidth: 180 }} value={canal} onChange={e => setCanal(e.target.value)}>
                <option value="">Elige un canal…</option>
                {discord.canales.map(c => <option key={c.id} value={c.id}>#{c.nombre}</option>)}
              </select>
              <button className="btn btn-primario" disabled={!canal || ocupado} onClick={publicar}>Publicar</button>
            </div>
            <small style={{ display: 'block', color: 'var(--text-secondary)', marginTop: 8 }}>También puedes usar <code>/panel</code> en Discord.</small>
          </div>
        </div>
      </div>
    </div>
  );
}
