import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'

// Cargado solo si llega ?portal=1: el resto de visitantes (landing pública,
// Googlebot) no necesita descargar el código del Portal del Cliente.
// eslint-disable-next-line react-refresh/only-export-components -- entry point, no es un módulo con Fast Refresh
const Portal = lazy(() => import('./Portal.jsx'))

// ?portal=1 en la URL -> Portal del Cliente; si no, el panel de staff.
const esPortal = new URLSearchParams(window.location.search).has('portal')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {esPortal ? <Suspense fallback={null}><Portal /></Suspense> : <App />}
  </StrictMode>,
)
