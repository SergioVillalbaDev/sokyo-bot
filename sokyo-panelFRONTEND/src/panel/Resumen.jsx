import { useState } from 'react';
import { api } from '../api.js';
import { useAhora, useCarga } from '../hooks.js';
import { duracion, haceTiempo, numeroTicket } from '../utils.js';
import { Avatar, AvisoError, Cargando, Estrellas, InsigniaPrioridad, Vacio } from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';

function Kpi({ etiqueta, valor, detalle, destacado }) {
  return (
    <div className={`tarjeta kpi ${destacado ? 'destacado' : ''}`}>
      <span className="etiqueta-kpi">{etiqueta}</span>
      <span className="valor">{valor}</span>
      {detalle && <span className="detalle-kpi">{detalle}</span>}
    </div>
  );
}

// Marcas "limpias" para el eje Y: 0, paso, 2·paso... con un paso de 1, 2, 5, 10...
function escala(maximo) {
  if (maximo <= 4) return { tope: Math.max(maximo, 1), paso: 1 };
  const bruto = maximo / 4;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 5, 10].map(f => f * magnitud).find(p => p >= bruto);
  return { tope: Math.ceil(maximo / paso) * paso, paso };
}

const nombreDia = (fecha) => new Date(`${fecha}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

function GraficaActividad({ dias }) {
  const [activo, setActivo] = useState(null);
  const [comoTabla, setComoTabla] = useState(false);
  const maximo = Math.max(...dias.map(d => Math.max(d.abiertos, d.cerrados)), 0);
  const { tope, paso } = escala(maximo);
  const marcas = [];
  for (let v = 0; v <= tope; v += paso) marcas.push(v);

  return (
    <div className="tarjeta">
      <div className="tarjeta-cabecera">
        <div>
          <h3>Actividad de los últimos 14 días</h3>
          <p>Tickets abiertos y cerrados cada día</p>
        </div>
        <div className="fila">
          <div className="leyenda" aria-hidden={comoTabla}>
            <span className="fila" style={{ gap: 6 }}><span className="muestra s1" />Abiertos</span>
            <span className="fila" style={{ gap: 6 }}><span className="muestra s2" />Cerrados</span>
          </div>
          <button className="btn btn-fantasma btn-icono btn-sm" onClick={() => setComoTabla(v => !v)}
            title={comoTabla ? 'Ver gráfica' : 'Ver como tabla'} aria-label={comoTabla ? 'Ver gráfica' : 'Ver como tabla'}>
            <Icono nombre={comoTabla ? 'grafica' : 'tabla'} />
          </button>
        </div>
      </div>
      <div className="tarjeta-cuerpo">
        {comoTabla ? (
          <div className="tabla-envoltorio" style={{ maxHeight: 260 }}>
            <table className="tabla">
              <thead><tr><th>Día</th><th className="num">Abiertos</th><th className="num">Cerrados</th></tr></thead>
              <tbody>
                {[...dias].reverse().map(d => (
                  <tr key={d.fecha}><td>{nombreDia(d.fecha)}</td><td className="num">{d.abiertos}</td><td className="num">{d.cerrados}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grafica" role="img" aria-label={`Gráfica de actividad: ${dias.reduce((s, d) => s + d.abiertos, 0)} tickets abiertos y ${dias.reduce((s, d) => s + d.cerrados, 0)} cerrados en 14 días`}>
            <div className="grafica-area">
              {marcas.map(v => (
                <div key={v} className={`linea-grid ${v === 0 ? 'linea-base' : ''}`} style={{ bottom: `${(v / tope) * 100}%` }}>
                  <span>{v}</span>
                </div>
              ))}
              {dias.map((d, i) => (
                <div key={d.fecha} className="dia" onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)}
                  onFocus={() => setActivo(i)} onBlur={() => setActivo(null)} tabIndex={0}
                  aria-label={`${nombreDia(d.fecha)}: ${d.abiertos} abiertos, ${d.cerrados} cerrados`}>
                  <div className="barra s1" style={{ height: `${(d.abiertos / tope) * 100}%` }} />
                  <div className="barra s2" style={{ height: `${(d.cerrados / tope) * 100}%` }} />
                  {activo === i && (
                    <div className="tooltip" style={i < 2 ? { left: 0, transform: 'none' } : i > dias.length - 3 ? { left: 'auto', right: 0, transform: 'none' } : undefined}>
                      <div className="negrita" style={{ marginBottom: 4, textTransform: 'capitalize' }}>{nombreDia(d.fecha)}</div>
                      <div className="fila"><span className="muestra s1" />Abiertos <strong style={{ marginLeft: 'auto' }}>{d.abiertos}</strong></div>
                      <div className="fila"><span className="muestra s2" />Cerrados <strong style={{ marginLeft: 'auto' }}>{d.cerrados}</strong></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="eje-x" aria-hidden>
              {dias.map((d, i) => <span key={d.fecha}>{i % 2 === dias.length % 2 ? '' : new Date(`${d.fecha}T12:00:00`).getDate()}</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PorCategoria({ categorias }) {
  const maximo = Math.max(...categorias.map(c => c.total), 1);
  return (
    <div className="tarjeta">
      <div className="tarjeta-cabecera"><div><h3>Tickets por categoría</h3><p>Histórico del servidor</p></div></div>
      <div className="tarjeta-cuerpo">
        {categorias.length === 0 ? <p className="texto-3">Aún no hay datos.</p> : (
          <div className="barras-h">
            {categorias.map(c => (
              <div key={c.motivo} className="fila-barra">
                <span className="recortar">{c.motivo}</span>
                <span className="negrita num">{c.total}{c.abiertos > 0 && <span className="texto-3" style={{ fontWeight: 400 }}> · {c.abiertos} abiertos</span>}</span>
                <div className="pista-barra"><div className="relleno" style={{ width: `${(c.total / maximo) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Resumen({ guildId, config, resumen }) {
  const ahora = useAhora();
  const pendientes = useCarga(() => api(`/api/servidores/${guildId}/tickets?estado=Abierto`), [guildId], { intervalo: 30000 });
  const r = resumen.datos;

  if (resumen.error && !r) return <AvisoError error={resumen.error} onReintentar={resumen.recargar} />;
  if (!r) return <Cargando />;

  const colorDe = (p) => config.urgencias.find(u => u.nombre === p)?.color || '#80848e';
  const nivelDe = (p) => config.urgencias.find(u => u.nombre === p)?.nivel || 0;
  // Lo que necesita atención: esperando al staff, primero lo más urgente y lo que más lleva esperando.
  const atencion = (pendientes.datos || [])
    .filter(t => t.esperando !== 'usuario')
    .sort((a, b) => nivelDe(b.prioridad) - nivelDe(a.prioridad) || new Date(a.ultimaActividad || a.fechaCreacion) - new Date(b.ultimaActividad || b.fechaCreacion))
    .slice(0, 6);

  if (r.total === 0) {
    return (
      <div className="tarjeta">
        <Vacio emoji="🎉" titulo="Todo listo para empezar">
          Todavía no hay tickets. Publica el panel de soporte en Discord con <code>/panel</code> o desde <a href="#/config/apariencia">Panel y textos</a>, y los tickets aparecerán aquí.
        </Vacio>
      </div>
    );
  }

  return (
    <>
      <div className="kpis">
        <Kpi etiqueta="🟢 Abiertos" valor={r.abiertos} detalle={r.sinAsignar ? `${r.sinAsignar} sin asignar` : 'Todos asignados'} />
        <Kpi etiqueta="⏳ Por responder" valor={r.esperandoStaff} detalle="Esperan al staff" destacado={r.esperandoStaff > 0} />
        <Kpi etiqueta="📅 Nuevos (7 días)" valor={r.ultimos7} detalle={`${r.total} en total`} />
        <Kpi etiqueta="⭐ Satisfacción" valor={r.valoracionMedia ? r.valoracionMedia.toFixed(1) : '—'}
          detalle={r.valoraciones ? <span className="fila" style={{ gap: 6 }} title={`${r.valoraciones} valoraciones`}><Estrellas valor={r.valoracionMedia} tamaño={12} />· {r.valoraciones}</span> : 'Sin valoraciones aún'} />
        <Kpi etiqueta="⚡ 1ª respuesta" valor={duracion(r.primeraRespuestaMediaMs)} detalle="Media de 30 días" />
        <Kpi etiqueta="✅ Resolución" valor={duracion(r.resolucionMediaMs)} detalle="Media de 30 días" />
      </div>

      <div className="rejilla-dashboard">
        <div className="columna" style={{ gap: 18 }}>
          <GraficaActividad dias={r.porDia} />
          <div className="tarjeta">
            <div className="tarjeta-cabecera">
              <div><h3>Requieren atención</h3><p>Tickets abiertos esperando respuesta del staff</p></div>
              <a className="btn btn-secundario btn-sm" href="#/tickets">Ver todos</a>
            </div>
            {atencion.length === 0
              ? <Vacio emoji="✨" titulo="¡Al día!">Ningún ticket está esperando respuesta.</Vacio>
              : (
                <div className="lista-atencion">
                  {atencion.map(t => (
                    <a key={t.canalId} href={`#/tickets/${t.canalId}`}>
                      <Avatar src={t.creadorAvatar} nombre={t.creadorNombre} tamaño={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="negrita recortar">{numeroTicket(t)} {t.titulo || t.motivo}</div>
                        <div className="texto-3 pequeño recortar">{t.creadorNombre} · {t.motivo} · {t.asignadoNombre ? `🙋 ${t.asignadoNombre}` : 'Sin asignar'}</div>
                      </div>
                      <div className="columna" style={{ alignItems: 'flex-end', gap: 4 }}>
                        <InsigniaPrioridad nombre={t.prioridad} color={colorDe(t.prioridad)} />
                        <span className="texto-3 pequeño">{haceTiempo(t.ultimaActividad || t.fechaCreacion, ahora)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
          </div>
        </div>

        <div className="columna" style={{ gap: 18 }}>
          <PorCategoria categorias={r.porCategoria} />
          <div className="tarjeta">
            <div className="tarjeta-cabecera"><div><h3>🏆 Staff más activo</h3><p>Tickets atendidos (reclamados)</p></div></div>
            {r.porStaff.length === 0 ? <div className="tarjeta-cuerpo texto-3">Nadie ha reclamado tickets todavía.</div> : (
              <table className="tabla">
                <tbody>
                  {r.porStaff.map((s, i) => (
                    <tr key={s.id}>
                      <td style={{ width: 28 }} className="texto-3 negrita">{i + 1}</td>
                      <td className="negrita">{s.nombre}</td>
                      <td className="num">{s.atendidos}</td>
                      <td>{s.valoracionMedia ? <Estrellas valor={s.valoracionMedia} tamaño={12} /> : <span className="texto-3 pequeño">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
