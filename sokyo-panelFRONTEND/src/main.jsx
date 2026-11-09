import { StrictMode, lazy, Suspense } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import i18n from './i18n'
import App from './App.jsx'
import { marcarSiEsApp } from './lib/appMovil'
import { aplicarLigero } from './lib/ligero'
import { aplicarAspecto } from './lib/aspecto'
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

// Modo ligero (PCs con pocos recursos y Firefox) y tamaño de letra: antes de pintar nada.
aplicarLigero()
aplicarAspecto()

// Girar la rueda del ratón encima de un campo numérico con el cursor dentro le
// cambia el valor sin querer (un 2 se volvía 1 al bajar por la página). Se quita
// el foco y la rueda desplaza la página, como en el resto de sitios.
document.addEventListener('wheel', (e) => {
  const el = e.target
  if (el instanceof HTMLInputElement && el.type === 'number' && el === document.activeElement) el.blur()
}, { passive: true })

const app = (
  <StrictMode>
    {esPortal ? <Suspense fallback={null}><Portal /></Suspense> : <App />}
  </StrictMode>
)

// La portada llega ya pintada en el HTML (scripts/prerender-portada.js), en el
// idioma que eligió el script de index.html. Si es la portada y el idioma es el
// mismo que el de i18n, React aprovecha lo que ya se ve («hidrata»: no lo vuelve
// a pintar ni reinicia sus animaciones). Si no, lo quita y pinta desde cero.
// Hidrata justo después del siguiente pintado: así lo que ya está en el HTML sale
// en pantalla sin esperar a React (con la pestaña oculta no hay pintado: enseguida).
const raiz = document.getElementById('root')
const { hash, pathname, search } = window.location
const esPortada = !esPortal && !/^#(dashboard|legal)/.test(hash) && !/^\/panel\/?$/i.test(pathname)
  && !new URLSearchParams(search).has('staff')
if (esPortada && raiz.firstElementChild && raiz.getAttribute('data-pre') === i18n.language) {
  const hidratar = () => hydrateRoot(raiz, app)
  if (document.visibilityState === 'hidden') hidratar()
  else requestAnimationFrame(() => setTimeout(hidratar, 0))
} else {
  raiz.replaceChildren()
  createRoot(raiz).render(app)
}
