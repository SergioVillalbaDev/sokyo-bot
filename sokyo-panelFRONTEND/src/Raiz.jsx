// Sin sesión → web pública · con sesión → selector de servidor → panel del servidor.
import { useCallback, useState } from 'react'
import { tokenPanel, cerrarSesionPanel, servidorGuardado, guardarServidor } from './api.js'
import Landing from './Landing.jsx'
import Selector from './Selector.jsx'
import App from './App.jsx'

export default function Raiz() {
  const [token, setToken] = useState(tokenPanel())
  const [servidor, setServidor] = useState(servidorGuardado())

  const salir = useCallback(() => { cerrarSesionPanel(); setToken(''); setServidor('') }, [])
  const elegir = useCallback((id) => { guardarServidor(id); setServidor(id) }, [])
  const cambiar = useCallback(() => { guardarServidor(''); setServidor('') }, [])

  if (!token) return <Landing />
  if (!servidor) return <Selector onElegir={elegir} onSalir={salir} />
  return <App guildId={servidor} onCambiarServidor={cambiar} onSalir={salir} />
}
