import { useCallback, useEffect, useState } from 'react';
import { api, borrarSesion, EVENTO_SESION_CADUCADA, guardarSesion, leerSesion } from './api.js';
import { useCarga, useRuta } from './hooks.js';
import { ProveedorConfirmar, ProveedorToast } from './components/Proveedores.jsx';
import { Cargando } from './components/ui.jsx';
import Login from './Login.jsx';
import Panel from './panel/Panel.jsx';
import Portal from './portal/Portal.jsx';

function Raiz({ errorLogin }) {
  const [sesion, setSesion] = useState(leerSesion);
  const [aviso, setAviso] = useState('');
  const { partes } = useRuta();

  const salir = useCallback((mensaje = '') => {
    borrarSesion();
    setSesion(null);
    setAviso(mensaje);
  }, []);

  useEffect(() => {
    const alCaducar = () => salir('Tu sesión ha caducado. Vuelve a entrar.');
    window.addEventListener(EVENTO_SESION_CADUCADA, alCaducar);
    return () => window.removeEventListener(EVENTO_SESION_CADUCADA, alCaducar);
  }, [salir]);

  const yo = useCarga(() => (sesion ? api('/api/yo', { sesion }) : Promise.resolve(null)), [sesion?.token]);

  if (!sesion) {
    return <Login aviso={aviso} errorLogin={errorLogin} onEntrar={(nueva) => { guardarSesion(nueva); setAviso(''); setSesion(nueva); }} />;
  }
  if (yo.cargando) return <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}><Cargando texto="Entrando…" /></div>;
  if (!yo.datos) {
    return (
      <div className="pantalla-login">
        <div className="tarjeta tarjeta-login">
          <div style={{ fontSize: 40 }}>🔌</div>
          <h1>No se puede conectar</h1>
          <p className="texto-2">{yo.error?.message || 'El bot no responde.'}</p>
          <div className="fila" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primario" onClick={yo.recargar}>Reintentar</button>
            <button className="btn btn-secundario" onClick={() => salir()}>Cerrar sesión</button>
          </div>
        </div>
      </div>
    );
  }

  const esStaff = yo.datos.servidores.length > 0;
  const quierePortal = partes[0] === 'portal';
  if (yo.datos.tipo === 'apikey' || (esStaff && !quierePortal)) return <Panel yo={yo.datos} onSalir={() => salir()} />;
  return <Portal yo={yo.datos} esStaff={esStaff} onSalir={() => salir()} />;
}

export default function App({ errorLogin }) {
  return (
    <ProveedorToast>
      <ProveedorConfirmar>
        <Raiz errorLogin={errorLogin} />
      </ProveedorConfirmar>
    </ProveedorToast>
  );
}
