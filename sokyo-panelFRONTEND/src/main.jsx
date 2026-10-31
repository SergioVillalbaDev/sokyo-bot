import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ES_PORTAL } from './api.js'
import Raiz from './Raiz.jsx'
import Portal from './Portal.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {ES_PORTAL ? <Portal /> : <Raiz />}
  </StrictMode>,
)
