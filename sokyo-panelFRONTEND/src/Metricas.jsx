import { useEffect, useState } from 'react';
import { apiJson, formatDuracion } from './api.js';
import { Aviso, Estrellas } from './ui.jsx';

const MEDALLAS = ['🥇', '🥈', '🥉'];

function GraficoDias({ datos }) {
  const W = 760, H = 220, P = { t: 14, r: 10, b: 28, l: 30 };
  const max = Math.max(3, ...datos.flatMap((d) => [d.creados, d.cerrados]));
  const ancho = (W - P.l - P.r) / datos.length;
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / max);
  const cada = Math.ceil(datos.length / 8);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tickets creados y cerrados por día">
      {[0, 0.5, 1].map((f) => <g key={f}><line x1={P.l} x2={W - P.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--border-color)" /><text x={P.l - 6} y={y(max * f) + 3} textAnchor="end">{Math.round(max * f)}</text></g>)}
      {datos.map((d, i) => {
        const x = P.l + i * ancho, bw = Math.max(2, ancho * 0.36);
        return (
          <g key={d.fecha}>
            <title>{`${d.fecha}: ${d.creados} creados, ${d.cerrados} cerrados`}</title>
            <rect x={x + ancho * 0.1} y={y(d.creados)} width={bw} height={H - P.b - y(d.creados)} rx="2" fill="#5865F2" />
            <rect x={x + ancho * 0.1 + bw + 1} y={y(d.cerrados)} width={bw} height={H - P.b - y(d.cerrados)} rx="2" fill="#3ba55d" />
            {i % cada === 0 && <text x={x + ancho / 2} y={H - 10} textAnchor="middle">{d.fecha.slice(5)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export default function Metricas() {
  const [dias, setDias] = useState(30);
  const [m, setM] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    apiJson(`/api/metricas?dias=${dias}&offset=${new Date().getTimezoneOffset()}`).then((d) => vivo && (setM(d), setError(''))).catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [dias]);

  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!m) return <div className="muted">Calculando métricas…</div>;

  const maxMotivo = Math.max(1, ...m.porMotivo.map((x) => x.total));
  const maxHora = Math.max(1, ...m.porHora);
  const maxCsat = Math.max(1, ...m.distribucionCsat.map((x) => x.total));
  const kpis = [
    { l: 'Tickets creados', v: m.totales.creados, s: `en los últimos ${m.periodoDias} días`, c: '#5865F2' },
    { l: 'Abiertos ahora', v: m.totales.abiertosAhora, s: `${m.totales.sinAsignar} sin reclamar`, c: m.totales.sinAsignar ? '#faa61a' : '#3ba55d' },
    { l: '1ª respuesta (media)', v: formatDuracion(m.primeraRespuestaMediaMs), s: 'desde que se abre el ticket', c: '#eb459e' },
    { l: 'Resolución (media)', v: formatDuracion(m.resolucionMediaMs), s: 'hasta el cierre', c: '#1abc9c' },
    { l: 'Satisfacción', v: m.csatMedio ? m.csatMedio.toFixed(2) : '—', s: <><Estrellas valor={m.csatMedio} /> · {m.totales.valorados} valoraciones</>, c: '#f1c40f' },
  ];

  return (
    <div className="pg">
      <div className="tabs">{[7, 30, 90].map((d) => <button key={d} className={`tab ${dias === d ? 'activa' : ''}`} onClick={() => setDias(d)}>Últimos {d} días</button>)}</div>

      <div className="kpis">{kpis.map((k) => <div className="kpi" key={k.l} style={{ '--c': k.c }}><div className="v">{k.v}</div><div className="l">{k.l}</div><div className="s">{k.s}</div></div>)}</div>

      <div className="card">
        <h3>📅 Actividad diaria</h3>
        <div className="leyenda" style={{ marginBottom: 8 }}><span><span className="celda" style={{ background: '#5865F2', width: 12, height: 12 }} /> Creados</span><span><span className="celda" style={{ background: '#3ba55d', width: 12, height: 12 }} /> Cerrados</span></div>
        <GraficoDias datos={m.porDia} />
      </div>

      <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="card">
          <h3>🏷️ Por motivo</h3>
          <div className="barras-h">{m.porMotivo.length === 0 && <span className="muted">Sin datos</span>}
            {m.porMotivo.map((x) => <div className="barra-h" key={x.nombre}><span title={x.nombre} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nombre}</span><div className="pista"><div className="relleno" style={{ width: `${(x.total / maxMotivo) * 100}%` }} /></div><strong>{x.total}</strong></div>)}
          </div>
        </div>
        <div className="card">
          <h3>⭐ Valoraciones</h3>
          <div className="barras-h">{[...m.distribucionCsat].reverse().map((x) => <div className="barra-h" key={x.estrellas}><span className="estrellas">{'★'.repeat(x.estrellas)}</span><div className="pista"><div className="relleno" style={{ width: `${(x.total / maxCsat) * 100}%`, background: 'linear-gradient(90deg,#f1c40f,#e67e22)' }} /></div><strong>{x.total}</strong></div>)}</div>
        </div>
      </div>

      <div className="card">
        <h3>🕒 Horas pico</h3>
        <div className="sub">Cuándo se abren más tickets (tu hora local). Más intenso = más tickets.</div>
        <div className="horas">{m.porHora.map((v, h) => <div className="hora" key={h} title={`${h}:00 — ${v} tickets`} style={{ opacity: 0.12 + 0.88 * (v / maxHora) }}>{h}</div>)}</div>
      </div>

      <div className="card">
        <h3>🏆 Ranking del equipo</h3>
        <div className="sub">Según quién reclamó cada ticket en el periodo.</div>
        {m.ranking.length === 0 ? <div className="muted">Todavía nadie ha reclamado tickets en este periodo.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tabla">
              <thead><tr><th>#</th><th>Agente</th><th>Atendidos</th><th>Cerrados</th><th>1ª respuesta</th><th>Resolución</th><th>Satisfacción</th></tr></thead>
              <tbody>{m.ranking.map((r, i) => (
                <tr key={r.id}><td>{MEDALLAS[i] || i + 1}</td><td><strong>{r.nombre}</strong></td><td>{r.atendidos}</td><td>{r.cerrados}</td><td>{formatDuracion(r.primeraRespuestaMediaMs)}</td><td>{formatDuracion(r.resolucionMediaMs)}</td><td><Estrellas valor={r.csat} /> {r.csat ? <small className="muted">{r.csat.toFixed(1)} ({r.valoraciones})</small> : null}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
