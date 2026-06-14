// src/App.jsx
// Router simple de la web de staff: Landing (#) ↔ Dashboard (#dashboard).
// El Portal del Cliente se enruta aparte en main.jsx mediante ?portal=1.
import { useState, useEffect } from 'react';
import Landing from './components/landing/Landing';
import Dashboard from './components/dashboard/Dashboard';

const getRoute = () =>
  window.location.hash.replace('#', '').startsWith('dashboard') ? 'dashboard' : 'landing';

function App() {
  const [route, setRoute] = useState(getRoute);

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

  return route === 'dashboard'
    ? <Dashboard onExitToLanding={goLanding} />
    : <Landing onEnterDashboard={goDashboard} />;
}

export default App;
