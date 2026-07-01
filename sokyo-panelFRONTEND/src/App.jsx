// src/App.jsx
// Router de la web de staff: Landing (#) ↔ Dashboard (#dashboard).
// El Dashboard requiere sesión de staff (login con Discord), salvo en "modo
// propietario" (cuando el panel tiene configurada VITE_API_KEY).
// El Portal del Cliente se enruta aparte en main.jsx mediante ?portal=1.
import { useState, useEffect, lazy, Suspense } from 'react';
import Landing from './components/landing/Landing';
import { API_URL } from './lib/api';

// Cargados solo cuando hacen falta (rutas #legal y #dashboard): el Dashboard por sí
// solo son ~40 vistas (764 KB de código fuente) que un visitante de la landing —o
// Googlebot— nunca necesita descargar para ver la página pública.
const Legal = lazy(() => import('./components/landing/Legal'));
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const StaffLogin = lazy(() => import('./components/dashboard/StaffLogin'));

const getRoute = () => {
  const h = window.location.hash.replace('#', '');
  if (h.startsWith('dashboard')) return 'dashboard';
  if (h.startsWith('legal')) return 'legal';
  return 'landing';
};

// Qué página legal mostrar según el hash (#legal/terminos vs #legal/privacidad).
const getLegalPage = () => (window.location.hash.includes('terminos') ? 'terminos' : 'privacidad');

const hasApiKey = !!import.meta.env.VITE_API_KEY;

function App() {
  const [route, setRoute] = useState(getRoute);
  const [staffToken, setStaffToken] = useState(() => localStorage.getItem('sokyoStaffToken') || '');
  const [authError, setAuthError] = useState('');

  // Al cargar: capturar el token de staff de la URL (vuelta del login con Discord).
  // Efecto solo-en-montaje: el setState aquí es intencional (leer la URL una vez).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('staff')) return;
    const tk = params.get('token');
    const err = params.get('error');
    if (err) setAuthError(err);
    if (tk) {
      localStorage.setItem('sokyoStaffToken', tk);
      setStaffToken(tk);
    }
    // Limpia la query y entra al dashboard.
    window.history.replaceState({}, '', '/');
    window.location.hash = 'dashboard';
    setRoute('dashboard');
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goDashboard = (e) => {
    if (e) e.preventDefault();
    window.location.hash = 'dashboard';
    setRoute('dashboard');
  };

  const goLanding = () => {
    window.location.hash = '';
    setRoute('landing');
  };

  const logout = () => {
    localStorage.removeItem('sokyoStaffToken');
    setStaffToken('');
    goLanding();
  };

  if (route === 'dashboard') {
    // Requiere sesión de staff, salvo en modo propietario (VITE_API_KEY presente).
    if (!staffToken && !hasApiKey) {
      // Si hubo un error en el login, mostramos la pantalla con el mensaje
      // (si no, entraríamos en un bucle de redirección).
      if (authError) return <Suspense fallback={null}><StaffLogin error={authError} /></Suspense>;
      // Sin sesión y sin error: vamos DIRECTOS al login de Discord, sin
      // pantalla intermedia.
      window.location.href = `${API_URL}/api/auth/discord?state=staff`;
      return null;
    }
    return <Suspense fallback={null}><Dashboard onExitToLanding={goLanding} onLogout={staffToken ? logout : undefined} /></Suspense>;
  }
  if (route === 'legal') {
    return <Suspense fallback={null}><Legal page={getLegalPage()} onBack={(e) => { if (e) e.preventDefault(); goLanding(); }} /></Suspense>;
  }
  return <Landing onEnterDashboard={goDashboard} />;
}

export default App;
