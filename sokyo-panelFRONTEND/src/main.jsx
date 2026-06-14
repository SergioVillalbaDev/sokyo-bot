import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Portal from './Portal.jsx'

// ?portal=1 en la URL -> Portal del Cliente; si no, el panel de staff.
const esPortal = new URLSearchParams(window.location.search).has('portal')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {esPortal ? <Portal /> : <App />}
  </StrictMode>,
)
