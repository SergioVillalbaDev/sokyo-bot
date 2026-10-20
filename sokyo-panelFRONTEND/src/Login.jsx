import { useState } from 'react';
import { api, urlLoginDiscord } from './api.js';
import { useCarga } from './hooks.js';
import Icono from './components/Icono.jsx';

const ERRORES = {
  denegado: 'Has cancelado el inicio de sesión con Discord.',
  estado: 'La sesión de inicio caducó o se abrió en otra pestaña. Vuelve a intentarlo.',
  oauth: 'Discord no pudo completar el inicio de sesión. Inténtalo de nuevo.'
};

export default function Login({ onEntrar, aviso, errorLogin }) {
  const config = useCarga(() => api('/api/auth/config', { sesion: null }), []);
  const [modoClave, setModoClave] = useState(false);
  const [clave, setClave] = useState('');
  const [comprobando, setComprobando] = useState(false);
  const [error, setError] = useState(errorLogin ? ERRORES[errorLogin] || 'No se pudo iniciar sesión.' : '');

  const recordarDestino = () => {
    try { sessionStorage.setItem('sokyo.destino', window.location.hash.slice(1) || '/'); } catch { /* sin almacenamiento */ }
  };

  const entrarConClave = async (e) => {
    e.preventDefault();
    if (!clave.trim()) return;
    setComprobando(true);
    setError('');
    const sesion = { tipo: 'apikey', token: clave.trim() };
    try {
      await api('/api/yo', { sesion });
      onEntrar(sesion);
    } catch (err) {
      setError(err.status === 401 ? 'La clave no es correcta.' : err.message);
    } finally {
      setComprobando(false);
    }
  };

  const discordActivo = config.datos?.discord;
  const claveActiva = config.datos?.apiKey;

  return (
    <div className="pantalla-login">
      <main className="tarjeta tarjeta-login">
        <img className="logo" src="/favicon.svg" alt="" />
        <div>
          <h1>Sokyo · Soporte</h1>
          <p className="texto-2" style={{ marginTop: 6 }}>Entra para gestionar el soporte o consultar tus tickets.</p>
        </div>

        {aviso && <div className="aviso aviso-info"><span aria-hidden>ℹ️</span><span>{aviso}</span></div>}
        {error && <div className="aviso aviso-error" role="alert"><span aria-hidden>⚠️</span><span>{error}</span></div>}

        {config.cargando && <div className="cargador" style={{ margin: '8px auto' }} />}
        {config.error && (
          <div className="aviso aviso-error" role="alert">
            <span aria-hidden>🔌</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <strong>No se puede conectar con el bot</strong>
              <span className="pequeño">{config.error.message}</span>
            </div>
            <button className="btn btn-sm btn-secundario" onClick={config.recargar}>Reintentar</button>
          </div>
        )}

        {config.datos && !modoClave && (
          <>
            {discordActivo ? (
              <a className="btn btn-discord" href={urlLoginDiscord()} onClick={recordarDestino}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.61 1.25a18.27 18.27 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.74 19.74 0 0 0-4.88 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1-.01.13c-.6.35-1.22.65-1.87.89a.08.08 0 0 0-.04.11c.36.7.78 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.84 19.84 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42z" /></svg>
                Entrar con Discord
              </a>
            ) : (
              <div className="aviso aviso-alerta" style={{ textAlign: 'left' }}>
                <span aria-hidden>🔧</span>
                <span>El login con Discord no está configurado en el bot (faltan <code>DISCORD_CLIENT_ID</code> y <code>DISCORD_CLIENT_SECRET</code>).</span>
              </div>
            )}
            <p className="texto-3 pequeño">
              El staff entra al panel de gestión; el resto de usuarios, a su portal de tickets.
            </p>
            {claveActiva && (
              <>
                <div className="separador">o</div>
                <button className="btn btn-fantasma btn-sm" onClick={() => setModoClave(true)}>
                  <Icono nombre="candado" /> Acceso de administrador con clave
                </button>
              </>
            )}
          </>
        )}

        {modoClave && (
          <form className="columna" onSubmit={entrarConClave} style={{ textAlign: 'left' }}>
            <div className="campo">
              <label htmlFor="clave">Clave de la API</label>
              <input id="clave" className="entrada" type="password" autoComplete="current-password" autoFocus
                value={clave} onChange={(e) => setClave(e.target.value)} placeholder="La API_KEY del .env del bot" />
              <span className="ayuda">Da acceso completo al panel. No la compartas.</span>
            </div>
            <button className="btn btn-primario btn-bloque" disabled={comprobando || !clave.trim()}>
              {comprobando ? 'Comprobando…' : 'Entrar'}
            </button>
            <button type="button" className="btn btn-fantasma btn-sm" onClick={() => { setModoClave(false); setError(''); }}>
              <Icono nombre="atras" /> Volver
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
