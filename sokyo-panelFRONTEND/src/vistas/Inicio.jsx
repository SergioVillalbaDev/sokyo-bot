// Resumen del servidor: cifras clave y primeros pasos.
export default function Inicio({ resumen: r, irA }) {
  const s = r.stats;
  const usoIA = r.ia.limite ? Math.min(100, Math.round((r.ia.usos / r.ia.limite) * 100)) : 0;
  const tiempo = s.primeraRespuestaMin == null ? '—' : s.primeraRespuestaMin < 60 ? `${s.primeraRespuestaMin} min` : `${(s.primeraRespuestaMin / 60).toFixed(1)} h`;

  const pasos = [
    { hecho: r.configurado, texto: 'Configura el equipo de soporte', detalle: <>Escribe <code>/setup rol_staff:@TuRol</code> en Discord o elígelo aquí.</>, vista: 'equipo' },
    { hecho: r.ia.disponible && r.ia.activada, texto: 'Activa la IA', detalle: r.ia.disponible ? 'Respuestas automáticas, triaje y ayudas para el staff.' : 'El dueño del bot debe añadir ANTHROPIC_API_KEY al .env.', vista: 'ia' },
    { hecho: r.ia.ticketsEvitados > 0, texto: 'Añade preguntas frecuentes', detalle: 'Con ellas la IA resuelve las dudas repetidas antes de que se abra un ticket.', vista: 'faq' }
  ];
  const pendientes = pasos.filter(p => !p.hecho);

  return (
    <div className="pila">
      {pendientes.length > 0 && (
        <div className="card">
          <h3>🚀 Primeros pasos</h3>
          <div className="pila" style={{ gap: '0.75rem' }}>
            {pasos.map(p => (
              <div key={p.texto} className="fila-espaciada" style={{ opacity: p.hecho ? 0.55 : 1 }}>
                <div>
                  <strong>{p.hecho ? '✅' : '⬜'} {p.texto}</strong>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 2 }}>{p.detalle}</div>
                </div>
                {!p.hecho && r.permisos.admin && <button className="btn btn-secundario" onClick={() => irA(p.vista)}>Ir</button>}
                {!p.hecho && !r.permisos.admin && p.vista === 'faq' && <button className="btn btn-secundario" onClick={() => irA('faq')}>Ir</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-stats">
        <button className="card stat" style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }} onClick={() => irA('tickets')}>
          <span>🎫 Tickets abiertos</span><strong>{s.abiertos}</strong>
        </button>
        <div className="card stat"><span>🙋 Sin reclamar</span><strong style={{ color: s.sinReclamar > 0 ? 'var(--danger)' : undefined }}>{s.sinReclamar}</strong></div>
        <div className="card stat"><span>⏱️ Primera respuesta (30 días)</span><strong>{tiempo}</strong></div>
        <div className="card stat"><span>⭐ Valoración media</span><strong>{s.csatMedio ? s.csatMedio.toFixed(1) : '—'}</strong><span>{s.valoraciones} valoraciones</span></div>
        <div className="card stat"><span>🤖 Tickets evitados por la IA</span><strong style={{ color: 'var(--ia)' }}>{r.ia.ticketsEvitados}</strong></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>🤖 Uso de IA este mes</h3>
          {r.ia.disponible ? (
            <>
              <div className="fila-espaciada" style={{ marginBottom: 8 }}>
                <span>{r.ia.usos} de {r.ia.limite} usos</span>
                <span className={`insignia ${r.ia.activada ? 'insignia-ia' : 'insignia-suave'}`}>{r.ia.activada ? 'Activada' : 'Desactivada'}</span>
              </div>
              <div className="barra"><div style={{ width: `${usoIA}%` }} /></div>
              {!r.plan.premium && usoIA >= 80 && <p style={{ marginTop: 10, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Te queda poco cupo. Premium lo amplía a {3000} usos al mes.</p>}
            </>
          ) : <p style={{ color: 'var(--text-secondary)' }}>La IA no está configurada en este bot (falta <code>ANTHROPIC_API_KEY</code>).</p>}
        </div>
        <div className="card">
          <h3>{r.plan.premium ? '⭐ Plan Premium' : '🆓 Plan gratis'}</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {r.plan.premium
              ? `Sin marca Sokyo, IA ampliada y logs ampliados${r.plan.premiumHasta ? ` hasta el ${new Date(r.plan.premiumHasta).toLocaleDateString('es-ES')}` : ''}.`
              : 'Incluye todo lo esencial. Premium quita la marca Sokyo, amplía la IA y hace que aprenda de cada ticket cerrado.'}
          </p>
          {r.permisos.admin && !r.plan.premium && <button className="btn btn-secundario" style={{ marginTop: 12 }} onClick={() => irA('plan')}>Ver Premium</button>}
        </div>
      </div>
    </div>
  );
}
