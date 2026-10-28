import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'
import { marcarSiEsApp } from './lib/appMovil'
import { aplicarLigero } from './lib/ligero'
import './ligero.css'

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

// Modo ligero (PCs con pocos recursos y Firefox): antes de pintar nada.
aplicarLigero()

// Girar la rueda del ratón encima de un campo numérico con el cursor dentro le
// cambia el valor sin querer (un 2 se volvía 1 al bajar por la página). Se quita
// el foco y la rueda desplaza la página, como en el resto de sitios.
document.addEventListener('wheel', (e) => {
  const el = e.target
  if (el instanceof HTMLInputElement && el.type === 'number' && el === document.activeElement) el.blur()
}, { passive: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {esPortal ? <Suspense fallback={null}><Portal /></Suspense> : <App />}
  </StrictMode>,
)
