// src/App.jsx
// Router de la web de staff: Landing (#) ↔ Dashboard (#dashboard).
// El Dashboard requiere sesión de staff (login con Discord), salvo en "modo
// propietario" (cuando el panel tiene configurada VITE_API_KEY).
// El Portal del Cliente se enruta aparte en main.jsx mediante ?portal=1.
import { useState, useEffect } from 'react';
import Landing from './components/landing/Landing';
import Dashboard from './components/dashboard/Dashboard';
import StaffLogin from './components/dashboard/StaffLogin';

const getRoute = () =>
  window.location.hash.replace('#', '').startsWith('dashboard') ? 'dashboard' : 'landing';

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
    if (!staffToken && !hasApiKey) return <StaffLogin error={authError} />;
    return <Dashboard onExitToLanding={goLanding} onLogout={staffToken ? logout : undefined} />;
  }
  return <Landing onEnterDashboard={goDashboard} />;
}

export default App;
