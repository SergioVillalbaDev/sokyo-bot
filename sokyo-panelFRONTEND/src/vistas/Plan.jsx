// Plan actual y comparativa con Premium.
const SOPORTE_URL = import.meta.env.VITE_SOPORTE_URL || '';

const FILAS = [
  ['Tickets, formularios y paneles', 'Ilimitados', 'Ilimitados'],
  ['Panel web y portal de usuarios', '✅', '✅'],
  ['Usos de IA al mes', '30', '3.000'],
  ['La IA aprende de los tickets cerrados', '—', '✅'],
  ['Eventos de log en el panel', '50', '500'],
  ['Marca “⚡ Sokyo” en el pie y botón de invitación', 'Sí', 'No (marca blanca)'],
  ['Pie de página propio', '—', '✅']
];

export default function Plan({ resumen }) {
  const { premium, premiumHasta } = resumen.plan;
  return (
    <div className="pila">
      <div className={`aviso ${premium ? 'aviso-exito' : 'aviso-info'}`}>
        {premium
          ? <>⭐ Este servidor tiene <strong>Premium</strong>{premiumHasta ? ` hasta el ${new Date(premiumHasta).toLocaleDateString('es-ES')}` : ''}.</>
          : <>Este servidor usa el <strong>plan gratis</strong>.</>}
      </div>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="tabla">
          <thead><tr><th></th><th>Gratis</th><th>⭐ Premium</th></tr></thead>
          <tbody>
            {FILAS.map(([nombre, gratis, prem]) => (
              <tr key={nombre}><td>{nombre}</td><td style={{ color: 'var(--text-secondary)' }}>{gratis}</td><td><strong>{prem}</strong></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {!premium && (
        <div className="card">
          <h3>¿Quieres Premium?</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            El equipo de Sokyo lo activa para tu servidor. Indica el nombre del servidor y su ID: <code>{resumen.servidor.id}</code>
          </p>
          {SOPORTE_URL && <a className="btn btn-primario" href={SOPORTE_URL} target="_blank" rel="noreferrer">Hablar con el equipo de Sokyo</a>}
        </div>
      )}
    </div>
  );
}
