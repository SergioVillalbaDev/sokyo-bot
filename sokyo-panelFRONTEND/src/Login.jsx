import { urlLogin } from './api.js';

const MENSAJES = {
  denegado: 'Has cancelado el inicio de sesión.',
  estado: 'La sesión de inicio no es válida (posible enlace caducado). Inténtalo de nuevo.',
  oauth: 'No se pudo iniciar sesión con Discord. Inténtalo de nuevo.',
};

export function Login({ error }) {
  return (
    <div className="login-fondo">
      <div className="card login-card">
        <div className="logo">🤖</div>
        <h1>Sokyo Bot</h1>
        <p>Panel del equipo. Entra con tu cuenta de Discord: lo que puedes ver y hacer depende de tus <strong>roles y permisos reales</strong> en el servidor.</p>
        {error && <div className="aviso error" style={{ marginBottom: 16, textAlign: 'left' }}><span>⛔</span><div>{MENSAJES[error] || error}</div></div>}
        <a href={urlLogin} style={{ textDecoration: 'none' }}><button className="btn btn-discord" type="button">🎮 Iniciar sesión con Discord</button></a>
        <ul className="login-lista">
          <li>🔒 Solo pedimos tu identidad básica (no accedemos a tus mensajes).</li>
          <li>🛡️ Los permisos se comprueban siempre en el servidor del bot.</li>
        </ul>
      </div>
    </div>
  );
}

export function SinAcceso({ usuario, onSalir, onReintentar }) {
  return (
    <div className="login-fondo">
      <div className="card login-card">
        <div className="logo">🔒</div>
        <h1>Sin acceso al panel</h1>
        <p>Hola <strong>{usuario?.username}</strong>. No tienes ningún permiso de staff en los servidores donde está el bot. Si crees que es un error, pide a un administrador que te dé un rol de soporte o que te conceda acceso en <strong>Roles y permisos</strong>.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn fantasma" onClick={onReintentar}>🔄 Reintentar</button>
          <button className="btn gris" onClick={onSalir}>Salir</button>
        </div>
      </div>
    </div>
  );
}
