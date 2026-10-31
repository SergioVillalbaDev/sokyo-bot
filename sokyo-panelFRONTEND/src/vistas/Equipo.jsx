// Equipo de soporte, categoría de tickets y canal de logs.
import { useState } from 'react';
import { useDatos, useAccion } from '../util.js';
import { Aviso, Campo, Cargando, Interruptor, ListaRoles } from '../ui.jsx';

export default function Equipo({ apiG, recargarResumen }) {
  const datos = useDatos(() => Promise.all([apiG('/config'), apiG('/discord')]), [apiG]);
  if (datos.error) return <Aviso aviso={{ tipo: 'error', texto: datos.error }} />;
  if (!datos.datos) return <Cargando />;
  const [config, discord] = datos.datos;
  return <Formulario apiG={apiG} config={config} discord={discord} onGuardado={recargarResumen} />;
}

function Formulario({ apiG, config, discord, onGuardado }) {
  const [f, setF] = useState({
    rolesStaff: config.rolesStaff || [],
    categoriaTicketsId: config.categoriaTicketsId || '',
    canalLogsId: config.canalLogsId || '',
    maxTicketsPorUsuario: config.maxTicketsPorUsuario || 2,
    mencionarStaff: config.mencionarStaff !== false
  });
  const { ocupado, aviso, setAviso, ejecutar } = useAccion();
  const cambiar = (campo) => (valor) => setF(x => ({ ...x, [campo]: valor }));

  const guardar = () => ejecutar(async () => {
    await apiG('/config/equipo', { metodo: 'PUT', cuerpo: { ...f, categoriaTicketsId: f.categoriaTicketsId || null, canalLogsId: f.canalLogsId || null } });
    onGuardado();
  }, 'Cambios guardados. Se aplican a los tickets nuevos.');

  return (
    <div className="pila">
      <div className="aviso aviso-info">💡 Atajo: en Discord, <code>/setup rol_staff:@TuRol</code> configura todo esto de una vez y publica el panel.</div>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      <div className="grid grid-2">
        <div className="card">
          <h3>🛡️ Equipo de soporte</h3>
          <Campo etiqueta="Roles que atienden los tickets" ayuda="Verán todos los tickets salvo los tipos que tengan su propio equipo (se configura en “Tipos de ticket”).">
            <ListaRoles roles={discord.roles} seleccion={f.rolesStaff} onCambiar={cambiar('rolesStaff')} />
          </Campo>
          <div style={{ marginTop: 14 }}>
            <Interruptor activo={f.mencionarStaff} onCambiar={cambiar('mencionarStaff')} titulo="Avisar al equipo en cada ticket nuevo" descripcion="Menciona a los roles del equipo en el primer mensaje del ticket." />
          </div>
        </div>
        <div className="card pila" style={{ gap: 14 }}>
          <h3 style={{ marginBottom: 0 }}>📁 Canales</h3>
          <Campo etiqueta="Categoría de los tickets" ayuda="Donde se crean los canales de ticket.">
            <select className="input" value={f.categoriaTicketsId} onChange={e => cambiar('categoriaTicketsId')(e.target.value)}>
              <option value="">— Sin categoría —</option>
              {discord.categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Canal de logs" ayuda="El bot publicará ahí lo que pasa (tickets, mensajes borrados, entradas…).">
            <select className="input" value={f.canalLogsId} onChange={e => cambiar('canalLogsId')(e.target.value)}>
              <option value="">— Solo en el panel web —</option>
              {discord.canales.map(c => <option key={c.id} value={c.id}>#{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Tickets abiertos a la vez por usuario" ayuda="Evita que alguien abra muchos tickets seguidos.">
            <input className="input" type="number" min={1} max={10} value={f.maxTicketsPorUsuario} onChange={e => cambiar('maxTicketsPorUsuario')(e.target.value)} style={{ maxWidth: 120 }} />
          </Campo>
        </div>
      </div>
      <div><button className="btn btn-primario btn-grande" disabled={ocupado} onClick={guardar}>💾 Guardar cambios</button></div>
    </div>
  );
}
