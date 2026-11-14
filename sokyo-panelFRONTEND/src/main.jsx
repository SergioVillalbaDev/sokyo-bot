import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Portal from './Portal.jsx'

// Inicio por defecto: Portal del Cliente (diseño móvil). El panel de staff queda en ?panel=1.
const esPanel = new URLSearchParams(window.location.search).has('panel')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {esPanel ? <App /> : <Portal />}
  </StrictMode>,
)
