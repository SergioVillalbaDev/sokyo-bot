import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'
import { marcarSiEsApp } from './lib/appMovil'

// Cargado solo en "Mi cuenta": el resto de visitantes (landing pública,
// Googlebot) no necesita descargar el código del portal de usuarios.
// eslint-disable-next-line react-refresh/only-export-components -- entry point, no es un módulo con Fast Refresh
const Portal = lazy(() => import('./Portal.jsx'))

// /cuenta (o /account, /mi-cuenta) -> "Mi cuenta" de cada usuario. ?portal=1 es
// la dirección antigua y sigue valiendo. Si no, la landing y el panel de staff.
const esPortal = /^\/(cuenta|account|mi-cuenta)\/?$/i.test(window.location.pathname)
  || new URLSearchParams(window.location.search).has('portal')

// ¿Abierto desde la app de Android? (se mira antes de que el login cambie la URL)
marcarSiEsApp()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {esPortal ? <Suspense fallback={null}><Portal /></Suspense> : <App />}
  </StrictMode>,
)
