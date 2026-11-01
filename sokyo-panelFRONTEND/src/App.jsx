// src/App.jsx
// Router de la web de staff: Landing (#) ↔ Dashboard (#dashboard o /panel).
// El Dashboard requiere sesión de staff (login con Discord), salvo en "modo
// propietario" (cuando el panel tiene configurada VITE_API_KEY).
// El Portal del Cliente se enruta aparte en main.jsx mediante ?portal=1.
import { useState, useEffect, lazy, Suspense } from 'react';
import Landing from './components/landing/Landing';
import { API_URL } from './lib/api';
import { cargarTextosPanel } from './i18n';
import RecargaSiFalla from './components/RecargaSiFalla';

// Cargados solo cuando hacen falta (rutas #legal y #dashboard): el Dashboard por sí
// solo son ~40 vistas (764 KB de código fuente) que un visitante de la landing —o
// Googlebot— nunca necesita descargar para ver la página pública.
// El panel y su login llegan junto con sus textos (i18n: cargarTextosPanel).
// Si los textos no llegan (red del móvil), se reintenta una vez y el panel abre igual.
const conTextosPanel = (cargar) => () => Promise.all([cargar(), cargarTextosPanel().catch(() => cargarTextosPanel()).catch(() => {})]).then(([m]) => m);
const Legal = lazy(() => import('./components/landing/Legal'));
const Dashboard = lazy(conTextosPanel(() => import('./components/dashboard/Dashboard')));
const StaffLogin = lazy(conTextosPanel(() => import('./components/dashboard/StaffLogin')));

const getRoute = () => {
  const h = window.location.hash.replace('#', '');
  if (h.startsWith('dashboard')) return 'dashboard';
  if (h.startsWith('legal')) return 'legal';
  // /panel: dirección directa al panel (la abre la app de Android).
  if (/^\/panel\/?$/i.test(window.location.pathname)) return 'dashboard';
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

  // Sin sesión de staff (ni API key): directos al login de Discord, sin pantalla
  // intermedia. Si hubo un error en el login no (se muestra), o entraríamos en
  // un bucle de redirección. La pestaña pedida (#dashboard/<pestaña>) se recuerda
  // para abrirla al volver del login.
  const irAlLogin = route === 'dashboard' && !staffToken && !hasApiKey && !authError;
  useEffect(() => {
    if (!irAlLogin) return;
    const pestana = window.location.hash.match(/^#dashboard\/([\w-]+)/);
    if (pestana) sessionStorage.setItem('sokyoPestanaTrasLogin', pestana[1]);
    window.location.href = `${API_URL}/api/auth/discord?state=staff`;
  }, [irAlLogin]);

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
    // Desde /panel la landing está en la raíz (si no, /panel volvería al panel).
    if (window.location.pathname !== '/') window.history.replaceState(null, '', '/');
    window.location.hash = '';
    setRoute('landing');
  };

  const logout = () => {
    localStorage.removeItem('sokyoStaffToken');
    // Cambios sin guardar del panel (hooks/useAutoguardado.js): no son para quien entre después.
    try { Object.keys(localStorage).filter((k) => k.startsWith('sokyoBorrador:')).forEach((k) => localStorage.removeItem(k)); } catch { /* sin almacenamiento */ }
    setStaffToken('');
    goLanding();
  };

  // Sesión caducada o inválida: se borra y se vuelve directo al login de Discord.
  const relogin = () => {
    localStorage.removeItem('sokyoStaffToken');
    window.location.href = `${API_URL}/api/auth/discord?state=staff`;
  };

  if (route === 'dashboard') {
    // Requiere sesión de staff, salvo en modo propietario (VITE_API_KEY presente).
    if (!staffToken && !hasApiKey) {
      if (authError) return <Suspense fallback={null}><StaffLogin error={authError} /></Suspense>;
      return null; // redirigiendo al login de Discord (efecto irAlLogin)
    }
    return <RecargaSiFalla><Suspense fallback={null}><Dashboard onExitToLanding={goLanding} onLogout={staffToken ? logout : undefined} onRelogin={staffToken ? relogin : undefined} /></Suspense></RecargaSiFalla>;
  }
  if (route === 'legal') {
    return <Suspense fallback={null}><Legal page={getLegalPage()} onBack={(e) => { if (e) e.preventDefault(); goLanding(); }} /></Suspense>;
  }
  return <Landing onEnterDashboard={goDashboard} />;
}

export default App;
