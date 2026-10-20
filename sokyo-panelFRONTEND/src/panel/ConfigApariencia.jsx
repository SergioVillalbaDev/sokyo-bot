import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAvisoSalida, useCarga } from '../hooks.js';
import { useToast } from '../contexto.js';
import { enlaceDiscord } from '../utils.js';
import { BarraGuardar, Campo } from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';
import Markdown from '../components/Markdown.jsx';

const CAMPOS = ['mensajeSoporteTitulo', 'mensajeSoporteDescripcion', 'footerPersonalizado', 'colorPanel', 'textoBoton', 'mensajeBienvenida'];
const elegir = (config) => Object.fromEntries(CAMPOS.map(c => [c, config[c] ?? '']));

function MensajeBot({ children }) {
  return (
    <div className="discord-msg">
      <img className="avatar" src="/favicon.svg" alt="" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="discord-autor">Sokyo <span className="bot">BOT</span> <span className="hora">Hoy a las 12:00</span></div>
        {children}
      </div>
    </div>
  );
}

function validar(form) {
  const errores = [];
  if (!form.mensajeSoporteTitulo.trim()) errores.push('El título no puede estar vacío.');
  if (!form.mensajeSoporteDescripcion.trim()) errores.push('La descripción no puede estar vacía.');
  if (!form.textoBoton.trim()) errores.push('El botón necesita un texto.');
  if (!/^#[0-9a-f]{6}$/i.test(form.colorPanel)) errores.push('El color debe tener el formato #RRGGBB.');
  return errores;
}

export default function ConfigApariencia({ guildId, config, setConfig, marcarCambios }) {
  const toast = useToast();
  const [form, setForm] = useState(() => elegir(config));
  const [guardando, setGuardando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const discord = useCarga(() => api(`/api/servidores/${guildId}/discord`), [guildId]);
  const canalesEscribibles = (discord.datos?.canales || []).filter(c => c.puedoEscribir);
  const [canalElegido, setCanalElegido] = useState('');
  const canalPanel = canalElegido || (canalesEscribibles.some(c => c.id === config.panelCanalId) ? config.panelCanalId : canalesEscribibles[0]?.id) || '';

  const cambiados = CAMPOS.filter(c => form[c] !== (config[c] ?? ''));
  const hayCambios = cambiados.length > 0;
  const errores = validar(form);
  useEffect(() => { marcarCambios(hayCambios); return () => marcarCambios(false); }, [hayCambios, marcarCambios]);
  useAvisoSalida(hayCambios);

  const cambiar = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }));

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await api(`/api/servidores/${guildId}/config`, { metodo: 'PUT', body: Object.fromEntries(cambiados.map(c => [c, form[c]])) });
      setConfig(r.config);
      setForm(elegir(r.config));
      if (r.panelActualizado === true) toast.exito('Guardado. El panel publicado en Discord se ha actualizado.');
      else if (r.panelActualizado === false) toast.info('Guardado. El panel publicado ya no existe en Discord: vuelve a publicarlo.');
      else toast.exito('Guardado. Publica el panel para verlo en Discord.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const publicar = async () => {
    setPublicando(true);
    try {
      const r = await api(`/api/servidores/${guildId}/panel`, { metodo: 'POST', body: { canalId: canalPanel } });
      setConfig({ ...config, panelCanalId: r.canalId, panelMensajeId: r.mensajeId });
      toast.exito('Panel publicado en Discord.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPublicando(false);
    }
  };

  const color = /^#[0-9a-f]{6}$/i.test(form.colorPanel) ? form.colorPanel : '#5865f2';
  const urgenciaEjemplo = config.motivos?.[0]?.urgencia || 'Normal';
  const colorEjemplo = config.urgencias?.find(u => u.nombre === urgenciaEjemplo)?.color || '#3498db';

  return (
    <>
      <div className="rejilla-config">
        <div className="columna" style={{ gap: 18 }}>
          <section className="tarjeta">
            <div className="tarjeta-cabecera"><div><h3>✏️ Panel de soporte</h3><p>El mensaje público con el botón para abrir tickets.</p></div></div>
            <div className="tarjeta-cuerpo columna" style={{ gap: 16 }}>
              <Campo etiqueta="Título" id="titulo" max={256} valor={form.mensajeSoporteTitulo}>
                <input id="titulo" className="entrada" maxLength={256} value={form.mensajeSoporteTitulo} onChange={cambiar('mensajeSoporteTitulo')} placeholder="🎫 Soporte Técnico Activo" />
              </Campo>
              <Campo etiqueta="Descripción" id="descripcion" max={4000} valor={form.mensajeSoporteDescripcion} ayuda="Admite formato de Discord: **negrita**, *cursiva*, `código`, [enlaces](https://…)">
                <textarea id="descripcion" className="entrada" style={{ minHeight: 140 }} maxLength={4000} value={form.mensajeSoporteDescripcion} onChange={cambiar('mensajeSoporteDescripcion')} />
              </Campo>
              <div className="fila" style={{ gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <Campo etiqueta="Texto del botón" id="boton" max={80} valor={form.textoBoton}>
                    <input id="boton" className="entrada" maxLength={80} value={form.textoBoton} onChange={cambiar('textoBoton')} placeholder="Abrir Ticket" />
                  </Campo>
                </div>
                <Campo etiqueta="Color" id="color">
                  <div className="fila" style={{ gap: 6 }}>
                    <input type="color" className="entrada-color" value={color} onChange={cambiar('colorPanel')} aria-label="Elegir color" />
                    <input id="color" className="entrada" style={{ width: 100 }} maxLength={7} value={form.colorPanel} onChange={cambiar('colorPanel')} />
                  </div>
                </Campo>
              </div>
              <Campo etiqueta="Pie de página" id="pie" max={200} valor={form.footerPersonalizado} ayuda="Aparece en el panel, en los tickets y en los resúmenes por DM.">
                <input id="pie" className="entrada" maxLength={200} value={form.footerPersonalizado} onChange={cambiar('footerPersonalizado')} placeholder="Sistema de Gestión Sokyo" />
              </Campo>
            </div>
          </section>

          <section className="tarjeta">
            <div className="tarjeta-cabecera"><div><h3>👋 Mensaje dentro del ticket</h3><p>Se muestra al abrir cada ticket, bajo la descripción del usuario.</p></div></div>
            <div className="tarjeta-cuerpo">
              <Campo etiqueta="Mensaje de bienvenida" id="bienvenida" max={500} valor={form.mensajeBienvenida}>
                <textarea id="bienvenida" className="entrada" maxLength={500} value={form.mensajeBienvenida} onChange={cambiar('mensajeBienvenida')} placeholder="Un miembro del equipo lo revisará en breve." />
              </Campo>
            </div>
          </section>

          <section className="tarjeta">
            <div className="tarjeta-cabecera"><div><h3>📌 Publicar en Discord</h3><p>Envía el panel a un canal. Si ya estaba publicado, los cambios de texto se aplican solos.</p></div></div>
            <div className="tarjeta-cuerpo columna">
              {config.panelCanalId && config.panelMensajeId && (
                <div className="aviso aviso-exito">
                  <span aria-hidden>✅</span>
                  <span>Publicado en <strong>#{discord.datos?.canales.find(c => c.id === config.panelCanalId)?.nombre || 'canal'}</strong>.{' '}
                    <a href={`${enlaceDiscord(guildId, config.panelCanalId)}/${config.panelMensajeId}`} target="_blank" rel="noopener noreferrer">Ver mensaje</a></span>
                </div>
              )}
              <div className="fila envolver">
                <select className="entrada" style={{ flex: 1, minWidth: 200 }} value={canalPanel} onChange={(e) => setCanalElegido(e.target.value)} aria-label="Canal donde publicar" disabled={!discord.datos}>
                  {!discord.datos && <option>Cargando canales…</option>}
                  {canalesEscribibles.map(c => <option key={c.id} value={c.id}>#{c.nombre}{c.categoria ? ` · ${c.categoria}` : ''}</option>)}
                </select>
                <button className="btn btn-primario" onClick={publicar} disabled={publicando || !canalPanel || hayCambios} title={hayCambios ? 'Guarda los cambios antes de publicar' : undefined}>
                  <Icono nombre="enviar" />{publicando ? 'Publicando…' : 'Publicar panel'}
                </button>
              </div>
              {hayCambios && <span className="texto-3 pequeño">Guarda los cambios antes de publicar.</span>}
              <span className="texto-3 pequeño">También puedes usar <code>/panel</code> en Discord.</span>
            </div>
          </section>
        </div>

        <div className="columna" style={{ gap: 18, position: 'sticky', top: 0 }}>
          <section className="tarjeta">
            <div className="tarjeta-cabecera"><div><h3>👀 Vista previa del panel</h3><p>Así lo verán los usuarios en Discord.</p></div></div>
            <div className="tarjeta-cuerpo">
              <div className="discord">
                <MensajeBot>
                  <div className="discord-embed" style={{ borderColor: color }}>
                    <div className="t">{form.mensajeSoporteTitulo || 'Título del panel'}</div>
                    <div className="d"><Markdown texto={form.mensajeSoporteDescripcion || 'Instrucciones para abrir un ticket…'} /></div>
                    {form.footerPersonalizado && <div className="f">{form.footerPersonalizado}</div>}
                  </div>
                  <span className="discord-boton">📩 {form.textoBoton || 'Abrir Ticket'}</span>
                </MensajeBot>
              </div>
            </div>
          </section>

          <section className="tarjeta">
            <div className="tarjeta-cabecera"><div><h3>🎫 Vista previa de un ticket</h3><p>Primer mensaje del canal privado de cada ticket.</p></div></div>
            <div className="tarjeta-cuerpo">
              <div className="discord">
                <MensajeBot>
                  <div className="d" style={{ fontSize: 14 }}>👋 ¡Hola <span className="mencion">@usuario</span>! Gracias por contactar con soporte.</div>
                  <div className="discord-embed" style={{ borderColor: colorEjemplo }}>
                    <div className="t">🎫 #0042 · No puedo acceder a mi cuenta</div>
                    <div className="d">
                      <span style={{ borderLeft: '3px solid #4e5058', paddingLeft: 8, display: 'block' }}>Desde ayer me sale un error al iniciar sesión.</span>
                      {form.mensajeBienvenida && <em style={{ display: 'block', marginTop: 10 }}>{form.mensajeBienvenida}</em>}
                    </div>
                    <div className="campos">
                      <div><strong>🏷️ Categoría</strong>{config.motivos?.[0]?.nombre || 'Soporte General'}</div>
                      <div><strong>🚨 Prioridad</strong>{urgenciaEjemplo}</div>
                      <div><strong>🙋 Atendido por</strong><em>Sin asignar</em></div>
                    </div>
                    {form.footerPersonalizado && <div className="f">{form.footerPersonalizado}</div>}
                  </div>
                  <div className="fila envolver" style={{ gap: 6 }}>
                    <span className="discord-boton">🙋 Reclamar</span>
                    <span className="discord-boton gris">➕ Añadir usuario</span>
                    <span className="discord-boton rojo">🔒 Cerrar</span>
                  </div>
                </MensajeBot>
              </div>
            </div>
          </section>
        </div>
      </div>

      <BarraGuardar visible={hayCambios} guardando={guardando} errores={errores} onGuardar={guardar} onDescartar={() => setForm(elegir(config))} />
    </>
  );
}
