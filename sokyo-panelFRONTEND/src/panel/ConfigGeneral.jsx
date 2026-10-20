import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAvisoSalida, useCarga } from '../hooks.js';
import { useToast } from '../contexto.js';
import { fechaLarga } from '../utils.js';
import { AvisoError, BarraGuardar, Campo, Interruptor } from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';

const MODULOS = [
  { clave: 'valoraciones', titulo: '⭐ Encuesta de satisfacción', descripcion: 'Al cerrar un ticket, el usuario recibe por DM unas estrellas para valorar la atención.' },
  { clave: 'transcriptDM', titulo: '📄 Copia de la conversación por DM', descripcion: 'Envía al usuario un archivo con toda la conversación al cerrar su ticket.' },
  { clave: 'mencionarStaff', titulo: '🔔 Avisar al staff', descripcion: 'Menciona a los roles de staff cada vez que se abre un ticket nuevo.' },
  { clave: 'logsMensajes', titulo: '✏️ Auditoría de mensajes', descripcion: 'Registra los mensajes editados y borrados de todo el servidor.' },
  { clave: 'logsMiembros', titulo: '👋 Auditoría de miembros', descripcion: 'Registra quién entra y sale del servidor (avisa de cuentas recién creadas).' }
];

const elegir = (config) => ({
  rolesStaff: config.rolesStaff || [],
  categoriaTicketsId: config.categoriaTicketsId || '',
  canalTranscriptsId: config.canalTranscriptsId || '',
  canalLogsId: config.canalLogsId || '',
  maxTicketsPorUsuario: config.maxTicketsPorUsuario || 1,
  modulos: Object.fromEntries(MODULOS.map(m => [m.clave, config.modulos?.[m.clave] !== false]))
});

function SelectorCanal({ id, valor, opciones, onCambio, vacio }) {
  return (
    <select id={id} className="entrada" value={valor} onChange={(e) => onCambio(e.target.value)}>
      <option value="">{vacio}</option>
      {opciones.map(c => (
        <option key={c.id} value={c.id}>
          {c.categoria !== undefined ? '#' : ''}{c.nombre}{c.categoria ? ` · ${c.categoria}` : ''}{c.puedoEscribir === false ? ' (el bot no puede escribir)' : ''}
        </option>
      ))}
    </select>
  );
}

export default function ConfigGeneral({ guildId, config, setConfig, marcarCambios }) {
  const toast = useToast();
  const discord = useCarga(() => api(`/api/servidores/${guildId}/discord`), [guildId]);
  const [form, setForm] = useState(() => elegir(config));
  const [guardando, setGuardando] = useState(false);

  const hayCambios = JSON.stringify(form) !== JSON.stringify(elegir(config));
  useEffect(() => { marcarCambios(hayCambios); return () => marcarCambios(false); }, [hayCambios, marcarCambios]);
  useAvisoSalida(hayCambios);

  const errores = [];
  const max = Number(form.maxTicketsPorUsuario);
  if (!Number.isInteger(max) || max < 1 || max > 10) errores.push('El límite de tickets debe estar entre 1 y 10.');

  const roles = discord.datos?.roles || [];
  const rolPorId = Object.fromEntries(roles.map(r => [r.id, r]));
  const rolesDisponibles = roles.filter(r => !form.rolesStaff.includes(r.id) && !r.gestionado);
  const poner = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await api(`/api/servidores/${guildId}/config`, {
        metodo: 'PUT',
        body: {
          ...form,
          categoriaTicketsId: form.categoriaTicketsId || null,
          canalTranscriptsId: form.canalTranscriptsId || null,
          canalLogsId: form.canalLogsId || null,
          maxTicketsPorUsuario: max
        }
      });
      setConfig(r.config);
      setForm(elegir(r.config));
      toast.exito('Ajustes guardados.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <AvisoError error={discord.datos ? null : discord.error} onReintentar={discord.recargar} />
      <div className="rejilla-config">
        <div className="columna" style={{ gap: 18 }}>
          <section className="tarjeta">
            <div className="tarjeta-cabecera"><div><h3>🛡️ Equipo de soporte</h3><p>Quién ve y gestiona los tickets (además de los administradores).</p></div></div>
            <div className="tarjeta-cuerpo columna">
              <div className="chips-seleccion">
                {form.rolesStaff.length === 0 && <span className="texto-3 pequeño">Sin roles: solo los administradores y quien pueda gestionar canales atenderán los tickets.</span>}
                {form.rolesStaff.map(id => (
                  <span key={id} className="chip-rol">
                    <span className="punto-color" style={{ background: rolPorId[id]?.color && rolPorId[id].color !== '#000000' ? rolPorId[id].color : 'var(--text-3)' }} />
                    {rolPorId[id]?.nombre || 'Rol eliminado'}
                    <button onClick={() => poner('rolesStaff', form.rolesStaff.filter(r => r !== id))} aria-label={`Quitar ${rolPorId[id]?.nombre || 'rol'}`}><Icono nombre="cerrar" /></button>
                  </span>
                ))}
              </div>
              <select className="entrada" value="" onChange={(e) => e.target.value && poner('rolesStaff', [...form.rolesStaff, e.target.value])}
                disabled={!discord.datos || form.rolesStaff.length >= 10} aria-label="Añadir rol de staff">
                <option value="">{discord.datos ? '➕ Añadir un rol de staff…' : 'Cargando roles…'}</option>
                {rolesDisponibles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              <span className="texto-3 pequeño">Al añadir o quitar un rol, se actualizan también los permisos de los tickets que ya existen.</span>
            </div>
          </section>

          <section className="tarjeta">
            <div className="tarjeta-cabecera"><div><h3>📁 Canales</h3><p>Dónde se crean los tickets y adónde van los registros.</p></div></div>
            <div className="tarjeta-cuerpo columna" style={{ gap: 16 }}>
              <Campo etiqueta="Categoría de los tickets nuevos" id="categoria" ayuda="Los tickets cerrados se mueven a «🗄️ Tickets Archivados» automáticamente.">
                <SelectorCanal id="categoria" valor={form.categoriaTicketsId} opciones={discord.datos?.categorias || []} vacio="— Sin categoría —" onCambio={(v) => poner('categoriaTicketsId', v)} />
              </Campo>
              <Campo etiqueta="Canal de transcripts" id="transcripts" ayuda="Al cerrar un ticket se publica aquí un resumen con la conversación completa en HTML.">
                <SelectorCanal id="transcripts" valor={form.canalTranscriptsId} opciones={discord.datos?.canales || []} vacio="— Desactivado —" onCambio={(v) => poner('canalTranscriptsId', v)} />
              </Campo>
              <Campo etiqueta="Canal de auditoría" id="logs" ayuda="Además de en el panel, cada evento de la auditoría se publicará en este canal.">
                <SelectorCanal id="logs" valor={form.canalLogsId} opciones={discord.datos?.canales || []} vacio="— Desactivado —" onCambio={(v) => poner('canalLogsId', v)} />
              </Campo>
            </div>
          </section>
        </div>

        <div className="columna" style={{ gap: 18 }}>
          <section className="tarjeta">
            <div className="tarjeta-cabecera"><div><h3>🎫 Límites</h3><p>Evita que un usuario abra muchos tickets a la vez.</p></div></div>
            <div className="tarjeta-cuerpo">
              <Campo etiqueta="Tickets abiertos a la vez por usuario" id="limite" ayuda="Si lo supera, el bot le enseña su ticket abierto en vez de crear otro.">
                <input id="limite" className="entrada" type="number" min="1" max="10" style={{ width: 120 }} value={form.maxTicketsPorUsuario}
                  onChange={(e) => poner('maxTicketsPorUsuario', e.target.value === '' ? '' : Number(e.target.value))} />
              </Campo>
            </div>
          </section>

          <section className="tarjeta">
            <div className="tarjeta-cabecera"><div><h3>🔌 Módulos</h3><p>Activa o desactiva funciones del bot.</p></div></div>
            <div className="tarjeta-cuerpo" style={{ paddingTop: 4, paddingBottom: 4 }}>
              {MODULOS.map(m => (
                <Interruptor key={m.clave} titulo={m.titulo} descripcion={m.descripcion} activo={form.modulos[m.clave]}
                  onCambio={(v) => poner('modulos', { ...form.modulos, [m.clave]: v })} />
              ))}
            </div>
          </section>

          <section className="tarjeta">
            <div className="tarjeta-cabecera"><div><h3>💎 Plan</h3><p>Determina cuántos eventos de auditoría se muestran.</p></div></div>
            <div className="tarjeta-cuerpo fila-entre">
              {config.premiumActivo
                ? <span className="insignia insignia-aviso">⭐ Premium{config.premiumHasta ? ` hasta el ${fechaLarga(config.premiumHasta)}` : ''}</span>
                : <span className="insignia">Plan gratuito</span>}
              <span className="texto-3 pequeño">{config.premiumActivo ? '150 eventos visibles' : '50 eventos visibles'}</span>
            </div>
          </section>
        </div>
      </div>

      <BarraGuardar visible={hayCambios} guardando={guardando} errores={errores} onGuardar={guardar} onDescartar={() => setForm(elegir(config))} />
    </>
  );
}
