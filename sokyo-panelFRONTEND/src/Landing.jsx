// Web pública: qué es Sokyo, cómo empezar y acceso al panel y al portal.
import { useEffect } from 'react';
import { api, urlLogin, ERROR_LOGIN, MENSAJES_ERROR_LOGIN } from './api.js';
import { useDatos } from './util.js';

const SOPORTE_URL = import.meta.env.VITE_SOPORTE_URL || '';
const formato = (n) => new Intl.NumberFormat('es-ES').format(n || 0);

const FUNCIONES = [
  { ico: '🤖', t: 'IA que responde sola', d: 'Antes de abrir un ticket, la IA busca en tus preguntas frecuentes y en tickets ya resueltos. Si la respuesta está ahí, el usuario la tiene al momento y tu equipo no recibe nada.' },
  { ico: '📝', t: 'Formularios por tipo', d: 'Cada tipo de ticket hace sus propias preguntas. "Apelar ban" pide quién y cuándo; "Pagos" pide el ID de compra. Llegan con toda la información.' },
  { ico: '👥', t: 'Cada equipo, sus tickets', d: 'Los tickets de Donaciones solo los ve Tesorería; los reportes, Moderación. Con su propia categoría y su propio rol.' },
  { ico: '🖥️', t: 'Panel web para tu staff', d: 'Responde, cierra, deja notas internas y pide un resumen o una respuesta sugerida a la IA. Cada persona entra con su cuenta de Discord.' },
  { ico: '🌐', t: 'Portal para tus usuarios', d: 'Tus usuarios ven el estado de sus tickets y responden desde la web, sin buscar el canal en Discord.' },
  { ico: '📜', t: 'Logs y auditoría', d: 'Mensajes borrados y editados, entradas y salidas, y todo lo que pasa en los tickets. En el panel y en un canal de Discord.' }
];

function BotonInvitar({ url, grande }) {
  if (!url) return null;
  return <a className={`btn btn-primario${grande ? ' btn-grande' : ''}`} href={url} target="_blank" rel="noreferrer">➕ Añadir a Discord</a>;
}

export default function Landing() {
  useEffect(() => { document.documentElement.setAttribute('data-theme', 'dark'); }, []);
  const info = useDatos(() => api('/api/publico/info', { token: '' }), []);
  const datos = info.datos;
  const errorLogin = MENSAJES_ERROR_LOGIN[ERROR_LOGIN] || (ERROR_LOGIN ? 'No se pudo iniciar sesión.' : '');

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="logo">🤖 Sokyo</div>
        <div className="fila">
          <a className="btn btn-secundario" href="/?portal=1">🎫 Mis tickets</a>
          <a className="btn btn-secundario" href={urlLogin('panel')}>🔐 Panel de staff</a>
          <BotonInvitar url={datos?.invitarUrl} />
        </div>
      </nav>

      <section className="landing-seccion hero">
        <div>
          <span className="insignia insignia-ia">Nuevo · IA integrada</span>
          <h1 style={{ marginTop: '1rem' }}>Tickets para Discord que <em>se responden solos.</em></h1>
          <p>
            Formularios para cada tipo de consulta, un panel web para tu staff y una IA que resuelve las dudas
            repetidas antes de que lleguen a tu equipo. Se configura en un minuto con <code>/setup</code>.
          </p>
          {errorLogin && <div className="aviso aviso-error" style={{ marginBottom: '1rem' }}>⚠️ {errorLogin}</div>}
          <div className="fila">
            <BotonInvitar url={datos?.invitarUrl} grande />
            <a className="btn btn-secundario btn-grande" href={urlLogin('panel')}>Entrar al panel</a>
          </div>
          {datos && (
            <div className="hero-stats">
              <div><strong>{formato(datos.servidores)}</strong><span>servidores</span></div>
              <div><strong>{formato(datos.ticketsGestionados)}</strong><span>tickets gestionados</span></div>
              <div><strong>1 min</strong><span>para configurarlo</span></div>
            </div>
          )}
          {info.error && <p style={{ fontSize: '0.9rem', marginTop: '1rem' }}>⚠️ {info.error}</p>}
        </div>

        <div className="demo" aria-label="Ejemplo de conversación en Discord">
          <div className="demo-msg">
            <div className="av" style={{ background: '#f0a020' }}>🙂</div>
            <div><b>Laura</b><br />Abre un ticket: <i>"No me llega el código para recuperar la cuenta"</i></div>
          </div>
          <div className="demo-msg">
            <div className="av" style={{ background: '#5865F2' }}>🤖</div>
            <div style={{ flex: 1 }}>
              <b>Sokyo</b><span className="bot">BOT</span>
              <div className="discord-embed" style={{ borderLeftColor: '#9b59b6', marginTop: 6 }}>
                <div className="t">🤖 Puede que esto te ayude</div>
                <div className="d">Revisa la carpeta de spam. Si no está, ve a <b>Ajustes → Seguridad → Reenviar código</b>. El código caduca a los 10 minutos.</div>
              </div>
              <div className="discord-botones">
                <span className="discord-boton" style={{ background: '#248046' }}>✅ Sí, solucionado</span>
                <span className="discord-boton gris">📩 No, abrir ticket</span>
              </div>
            </div>
          </div>
          <div className="demo-msg">
            <div className="av" style={{ background: '#f0a020' }}>🙂</div>
            <div><b>Laura</b><br />✅ ¡Solucionado! <span style={{ color: '#949ba4' }}>(tu staff no ha tenido que hacer nada)</span></div>
          </div>
        </div>
      </section>

      <section className="landing-seccion">
        <div className="seccion-titulo">
          <h2>Todo lo que necesita tu equipo de soporte</h2>
          <p>Gratis para empezar. Sin código, sin configuraciones eternas.</p>
        </div>
        <div className="grid grid-3">
          {FUNCIONES.map(f => (
            <div key={f.t} className="card feature">
              <div className="ico">{f.ico}</div>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-seccion">
        <div className="seccion-titulo"><h2>Listo en 3 pasos</h2></div>
        <div className="grid grid-3">
          <div className="card paso"><div className="n">1</div><div><h3>Añádelo</h3><p style={{ color: 'var(--text-secondary)' }}>Pulsa “Añadir a Discord” y elige tu servidor.</p></div></div>
          <div className="card paso"><div className="n">2</div><div><h3>Escribe /setup</h3><p style={{ color: 'var(--text-secondary)' }}><code>/setup rol_staff:@Soporte</code> crea la categoría, los logs y publica el panel.</p></div></div>
          <div className="card paso"><div className="n">3</div><div><h3>Personaliza</h3><p style={{ color: 'var(--text-secondary)' }}>Desde el panel web: formularios, equipos, preguntas frecuentes e IA.</p></div></div>
        </div>
      </section>

      <section className="landing-seccion">
        <div className="seccion-titulo"><h2>Planes</h2></div>
        <div className="grid grid-2" style={{ maxWidth: 820, margin: '0 auto' }}>
          <div className="card plan">
            <h3>Gratis</h3>
            <ul>
              <li>✅ Tickets, formularios y paneles ilimitados</li>
              <li>✅ Panel web y portal de usuarios</li>
              <li>✅ IA incluida (30 usos al mes)</li>
              <li>✅ Logs (últimos 50 eventos en el panel)</li>
              <li>• Lleva la marca “⚡ Sokyo” en el pie</li>
            </ul>
            <BotonInvitar url={datos?.invitarUrl} />
          </div>
          <div className="card plan destacado">
            <h3>⭐ Premium</h3>
            <ul>
              <li>✅ Todo lo del plan gratis</li>
              <li>✅ Sin marca Sokyo y con tu propio pie de página</li>
              <li>✅ IA ampliada (3.000 usos al mes)</li>
              <li>✅ La IA aprende de cada ticket cerrado</li>
              <li>✅ Logs ampliados (500 eventos)</li>
            </ul>
            {SOPORTE_URL
              ? <a className="btn btn-primario" href={SOPORTE_URL} target="_blank" rel="noreferrer">Hablar con nosotros</a>
              : <span className="insignia insignia-premium">Pídelo al equipo de Sokyo</span>}
          </div>
        </div>
      </section>

      <footer className="landing-pie">
        Sokyo · Sistema de tickets con IA para Discord · <a href="/?portal=1">Mis tickets</a>
      </footer>
    </div>
  );
}
