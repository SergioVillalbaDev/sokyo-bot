import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { guardarSesion } from './api.js';

// Vuelta del login con Discord: el bot redirige a "#token=..." o "#error=...".
// Guardamos la sesión y limpiamos la URL antes de pintar nada.
let errorLogin = null;
const fragmento = new URLSearchParams(window.location.hash.slice(1));
if (fragmento.has('token') || fragmento.has('error')) {
  if (fragmento.get('token')) guardarSesion({ tipo: 'discord', token: fragmento.get('token') });
  errorLogin = fragmento.get('error');
  let destino = '/';
  try {
    destino = sessionStorage.getItem('sokyo.destino') || '/';
    sessionStorage.removeItem('sokyo.destino');
  } catch { /* sin almacenamiento */ }
  window.history.replaceState(null, '', `${window.location.pathname}#${destino}`);
}

// Enlaces de versiones anteriores al portal (?portal=1)
if (new URLSearchParams(window.location.search).has('portal')) {
  window.history.replaceState(null, '', `${window.location.pathname}#/portal`);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App errorLogin={errorLogin} />
  </StrictMode>
);
