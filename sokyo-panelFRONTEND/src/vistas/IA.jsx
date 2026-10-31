// Ajustes de la IA del servidor.
import { useState } from 'react';
import { useAccion } from '../util.js';
import { Aviso, Interruptor } from '../ui.jsx';

export default function IA({ apiG, resumen, recargarResumen, irA }) {
  const ia = resumen.ia;
  const [f, setF] = useState({ activada: ia.activada, deflexion: ia.deflexion, triaje: ia.triaje });
  const { ocupado, aviso, setAviso, ejecutar } = useAccion();
  const pct = ia.limite ? Math.min(100, Math.round((ia.usos / ia.limite) * 100)) : 0;

  const guardar = () => ejecutar(async () => {
    await apiG('/config/ia', { metodo: 'PUT', cuerpo: f });
    recargarResumen();
  }, 'Ajustes de IA guardados.');

  return (
    <div className="pila">
      {!ia.disponible && (
        <div className="aviso aviso-error">
          ⚠️ La IA no está configurada en este bot. Quien aloja el bot debe añadir <code>ANTHROPIC_API_KEY</code> en el archivo <code>.env</code> y reiniciarlo.
        </div>
      )}
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      <div className="grid grid-stats">
        <div className="card stat"><span>Usos este mes</span><strong>{ia.usos} <span style={{ fontSize: '1rem' }}>/ {ia.limite}</span></strong><div className="barra" style={{ marginTop: 6 }}><div style={{ width: `${pct}%` }} /></div></div>
        <div className="card stat"><span>Tickets evitados</span><strong style={{ color: 'var(--ia)' }}>{ia.ticketsEvitados}</strong><span>consultas que la IA resolvió sola</span></div>
        <div className="card stat"><span>Plan</span><strong>{resumen.plan.premium ? '⭐ Premium' : 'Gratis'}</strong><span>{resumen.plan.premium ? 'IA ampliada' : 'Premium amplía el cupo a 3.000'}</span></div>
      </div>

      <div className="card pila" style={{ gap: 18 }}>
        <Interruptor activo={f.activada} onCambiar={(v) => setF({ ...f, activada: v })} deshabilitado={!ia.disponible}
          titulo="IA activada en este servidor" descripcion="Interruptor general. Si lo apagas, no se gasta ningún uso." />
        <Interruptor activo={f.deflexion} onCambiar={(v) => setF({ ...f, deflexion: v })} deshabilitado={!ia.disponible || !f.activada}
          titulo="🤖 Responder antes de abrir el ticket"
          descripcion="Cuando alguien rellena el formulario, la IA busca en tus preguntas frecuentes y en tickets ya resueltos. Si encuentra la respuesta, se la da al momento con dos botones: “Solucionado” o “Abrir ticket igualmente”. Solo funciona si hay preguntas frecuentes." />
        <Interruptor activo={f.triaje} onCambiar={(v) => setF({ ...f, triaje: v })} deshabilitado={!ia.disponible || !f.activada}
          titulo="🚥 Triaje automático"
          descripcion="Al abrir un ticket, la IA detecta el idioma, el ánimo del usuario y si es más urgente de lo que parece (cuenta robada, pagos, acoso…). Si lo es, sube la prioridad y lo avisa en el canal." />
        <div className="fila">
          <button className="btn btn-primario" disabled={ocupado || !ia.disponible} onClick={guardar}>💾 Guardar</button>
          <button className="btn btn-secundario" onClick={() => irA('faq')}>📚 Gestionar preguntas frecuentes</button>
        </div>
      </div>

      <div className="card">
        <h3>✨ Ayudas para el staff</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Dentro de cada ticket del panel tienes: <strong>Sugerir respuesta</strong> (borrador en el idioma del usuario),
          <strong> Resumen</strong> (para ponerte al día en segundos), <strong>Traducir</strong> la conversación y
          <strong> Convertir en FAQ</strong> (crea un artículo a partir de un ticket resuelto). En Discord, <code>/ticket resumen</code>.
          {resumen.plan.premium && ' Con Premium, además, cada ticket cerrado se resume solo y la IA lo usa para resolver consultas parecidas.'}
        </p>
      </div>
    </div>
  );
}
