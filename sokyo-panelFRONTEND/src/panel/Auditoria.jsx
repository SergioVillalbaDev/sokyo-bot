import { useState } from 'react';
import { api } from '../api.js';
import { useAhora, useCarga, useDebounce } from '../hooks.js';
import { fechaLarga, haceTiempo } from '../utils.js';
import { AvisoError, Segmentos, Vacio } from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';
import Markdown from '../components/Markdown.jsx';

const CATEGORIAS = [
  { valor: '', texto: '🌐 Todo' },
  { valor: 'Tickets', texto: '🎫 Tickets' },
  { valor: 'Mensajes Borrados', texto: '🗑️ Borrados' },
  { valor: 'Mensajes Editados', texto: '✏️ Editados' },
  { valor: 'Entradas', texto: '👋 Entradas' },
  { valor: 'Salidas', texto: '🚶 Salidas' }
];

export default function Auditoria({ guildId, config }) {
  const ahora = useAhora();
  const [categoria, setCategoria] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const q = useDebounce(busqueda.trim(), 300);

  const params = new URLSearchParams();
  if (categoria) params.set('categoria', categoria);
  if (q) params.set('q', q);
  const logs = useCarga(() => api(`/api/servidores/${guildId}/logs?${params}`), [guildId, categoria, q], { intervalo: 20000 });
  // Nombres de canales y roles para mostrar las menciones (<#id>) de forma legible.
  const discord = useCarga(() => api(`/api/servidores/${guildId}/discord`), [guildId]);
  const canales = Object.fromEntries([...(discord.datos?.canales || []), ...(discord.datos?.categorias || [])].map(c => [c.id, c.nombre]));
  const roles = Object.fromEntries((discord.datos?.roles || []).map(r => [r.id, r.nombre]));

  const d = logs.datos;
  const desactivados = [
    config.modulos?.logsMensajes === false && 'mensajes',
    config.modulos?.logsMiembros === false && 'entradas y salidas'
  ].filter(Boolean);

  return (
    <>
      <div className="barra-herramientas">
        <Segmentos etiqueta="Categoría" opciones={CATEGORIAS} valor={categoria} onCambio={setCategoria} />
        <div className="buscador">
          <Icono nombre="buscar" />
          <input className="entrada" type="search" placeholder="Buscar en el registro…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar en el registro" />
        </div>
        <div className="espaciador" />
        {d && (
          <span className={`insignia ${d.esPremium ? 'insignia-aviso' : ''}`} title="Eventos más recientes que se muestran según tu plan">
            {d.esPremium ? '⭐ Premium' : 'Plan gratuito'} · últimos {d.limite}
          </span>
        )}
      </div>

      {desactivados.length > 0 && (
        <div className="aviso aviso-info" style={{ marginBottom: 16 }}>
          <span aria-hidden>ℹ️</span>
          <span>La auditoría de {desactivados.join(' y ')} está desactivada. Actívala en <a href="#/config/general">Ajustes generales</a>.</span>
        </div>
      )}

      <AvisoError error={d ? null : logs.error} onReintentar={logs.recargar} />

      <div className="tarjeta">
        {!d && !logs.error && <div className="columna" style={{ padding: 16 }}>{[0, 1, 2, 3].map(i => <div key={i} className="esqueleto" style={{ height: 64 }} />)}</div>}
        {d && d.logs.length === 0 && (
          <Vacio emoji="📭" titulo={q ? 'Sin resultados' : 'Sin eventos'}>
            {q ? `Nada coincide con «${q}».` : 'Todavía no se ha registrado nada en esta categoría.'}
          </Vacio>
        )}
        {d?.logs.map(log => (
          <div key={log._id} className="log">
            <span className="franja" style={{ background: log.color }} aria-hidden />
            <div className="cuerpo">
              <div className="fila-entre" style={{ alignItems: 'baseline' }}>
                <span className="accion">{log.accion}</span>
                <span className="texto-3 pequeño" title={fechaLarga(log.fecha)} style={{ whiteSpace: 'nowrap' }}>{haceTiempo(log.fecha, ahora)}</span>
              </div>
              <div className="texto-2 pequeño">👤 {log.usuario} · <span className="texto-3">{log.categoria}</span></div>
              {log.detalles && (
                <div className="detalles">
                  <Markdown texto={log.detalles} canales={canales} roles={roles} usuarios={log.usuarioId ? { [log.usuarioId]: log.usuario } : {}} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
