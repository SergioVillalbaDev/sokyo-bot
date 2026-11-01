import { useEffect, useState } from 'react';
import { apiJson, enviar } from './api.js';
import { usePermisos } from './contexto.js';
import { toast } from './toast.js';
import { Aviso, Campo, FilaInterruptor } from './ui.jsx';

// Carga la configuración del servidor + roles/canales para los selectores.
function useAjustes() {
  const { guild } = usePermisos();
  const [config, setConfig] = useState(null);
  const [info, setInfo] = useState({ roles: [], canales: [] });
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    Promise.all([apiJson('/api/config'), apiJson('/api/guild/info').catch(() => ({ roles: [], canales: [] }))])
      .then(([c, i]) => { if (vivo) { setConfig(c); setInfo(i); } })
      .catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [guild.id]);
  return { config, info, error, guildId: guild.id };
}

// Carga la config y monta el formulario con ella ya lista (el formulario se inicializa con useState, sin efectos).
function Cargador({ Formulario, ocultarSiFalla = false }) {
  const { config, info, error, guildId } = useAjustes();
  if (error) return ocultarSiFalla ? null : <Aviso tipo="error">{error}</Aviso>;
  if (!config) return ocultarSiFalla ? null : <div className="muted">Cargando…</div>;
  return <Formulario config={config} info={info} guildId={guildId} />;
}

const Num = ({ valor, onChange, min = 1, max = 999 }) => <input className="input" type="number" min={min} max={max} value={valor ?? ''} onChange={(e) => onChange(Number(e.target.value))} />;
const Selector = ({ valor, onChange, opciones, vacio = '— Ninguno —', prefijo = '' }) => (
  <select className="select" value={valor || ''} onChange={(e) => onChange(e.target.value || null)}>
    <option value="">{vacio}</option>
    {opciones.map((o) => <option key={o.id} value={o.id}>{prefijo}{o.nombre}</option>)}
  </select>
);

function Pagina({ titulo, icono, descripcion, children, onGuardar, guardando }) {
  return (
    <div className="pg">
      <div className="card row">
        <div className="grow"><h3 style={{ margin: 0, fontSize: '1.3rem' }}>{icono} {titulo}</h3><div className="muted" style={{ marginTop: 4 }}>{descripcion}</div></div>
        <button className="btn" onClick={onGuardar} disabled={guardando}>{guardando ? 'Guardando…' : '💾 Guardar cambios'}</button>
      </div>
      {children}
    </div>
  );
}

function useGuardado(guildId, seccion) {
  const [guardando, setGuardando] = useState(false);
  const guardar = async (cuerpo) => {
    setGuardando(true);
    try { await enviar('PUT', `/api/config/${guildId}/seccion/${seccion}`, cuerpo); toast('✅ Ajustes guardados', 'ok'); }
    catch (e) { toast(e.message, 'error'); } finally { setGuardando(false); }
  };
  return [guardando, guardar];
}

function FormAutomatizacion({ config, guildId }) {
  const [f, setF] = useState(() => ({ ...config.automatizacion }));
  const [guardando, guardar] = useGuardado(guildId, 'automatizacion');
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Pagina titulo="Automatización de tickets" icono="🤖" descripcion="El bot vigila los tickets por ti: recuerda al staff y cierra los que se quedan muertos." onGuardar={() => guardar(f)} guardando={guardando}>
      <div className="card pg" style={{ gap: 14 }}>
        <h3>⏰ Recordatorio de SLA</h3>
        <FilaInterruptor titulo="Avisar al staff si un usuario espera demasiado" descripcion="Menciona a quien atiende el ticket (o al rol de staff) en el canal del ticket." checked={f.slaActivo} onChange={(v) => set('slaActivo', v)} />
        <Campo etiqueta="Horas sin respuesta antes de avisar"><Num valor={f.slaHoras} onChange={(v) => set('slaHoras', v)} max={168} /></Campo>
      </div>
      <div className="card pg" style={{ gap: 14 }}>
        <h3>⌛ Cierre por inactividad</h3>
        <FilaInterruptor titulo="Cerrar tickets cuando el usuario no responde" descripcion="Primero se le avisa; si sigue sin escribir, el ticket se cierra y archiva solo (con transcripción y valoración)." checked={f.inactividadActiva} onChange={(v) => set('inactividadActiva', v)} />
        <div className="grid-auto">
          <Campo etiqueta="Avisar tras (horas sin respuesta del usuario)"><Num valor={f.avisoHoras} onChange={(v) => set('avisoHoras', v)} max={720} /></Campo>
          <Campo etiqueta="Cerrar tras el aviso (horas)"><Num valor={f.cierreHoras} onChange={(v) => set('cierreHoras', v)} max={720} /></Campo>
        </div>
      </div>
    </Pagina>
  );
}

function FormAutoMod({ config, guildId }) {
  const [f, setF] = useState(() => ({ activo: config.automod.activo, antiSpam: { ...config.automod.antiSpam }, antiEnlaces: { ...config.automod.antiEnlaces, texto: (config.automod.antiEnlaces.dominiosPermitidos || []).join('\n') } }));
  const [guardando, guardar] = useGuardado(guildId, 'automod');
  const spam = (k, v) => setF({ ...f, antiSpam: { ...f.antiSpam, [k]: v } });
  const links = (k, v) => setF({ ...f, antiEnlaces: { ...f.antiEnlaces, [k]: v } });
  const enviarForm = () => guardar({ activo: f.activo, antiSpam: f.antiSpam, antiEnlaces: { activo: f.antiEnlaces.activo, dominiosPermitidos: f.antiEnlaces.texto.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean) } });
  return (
    <Pagina titulo="AutoMod" icono="🛡️" descripcion="Protección automática del servidor. Quien tenga «Gestionar mensajes» queda exento." onGuardar={enviarForm} guardando={guardando}>
      <FilaInterruptor titulo="Activar AutoMod" descripcion="Interruptor general. Los tickets no pasan por el AutoMod." checked={f.activo} onChange={(v) => setF({ ...f, activo: v })} />
      <div className="card pg" style={{ gap: 14, opacity: f.activo ? 1 : 0.55 }}>
        <h3>💬 Antispam</h3>
        <FilaInterruptor titulo="Silenciar a quien envía demasiados mensajes seguidos" checked={f.antiSpam.activo} onChange={(v) => spam('activo', v)} />
        <div className="grid-auto">
          <Campo etiqueta="Mensajes…"><Num valor={f.antiSpam.mensajes} onChange={(v) => spam('mensajes', v)} min={3} max={30} /></Campo>
          <Campo etiqueta="…en estos segundos"><Num valor={f.antiSpam.segundos} onChange={(v) => spam('segundos', v)} min={2} max={60} /></Campo>
          <Campo etiqueta="Silencio (minutos)"><Num valor={f.antiSpam.minutosMute} onChange={(v) => spam('minutosMute', v)} max={1440} /></Campo>
        </div>
      </div>
      <div className="card pg" style={{ gap: 14, opacity: f.activo ? 1 : 0.55 }}>
        <h3>🔗 Antienlaces</h3>
        <FilaInterruptor titulo="Borrar mensajes con enlaces externos" descripcion="Incluye invitaciones de Discord." checked={f.antiEnlaces.activo} onChange={(v) => links('activo', v)} />
        <Campo etiqueta="Dominios permitidos" ayuda="Uno por línea. Ej: youtube.com (admite subdominios)."><textarea className="textarea" value={f.antiEnlaces.texto} onChange={(e) => links('texto', e.target.value)} placeholder={'youtube.com\ntenor.com'} /></Campo>
      </div>
    </Pagina>
  );
}

function FormComunidad({ config, info, guildId }) {
  const [f, setF] = useState(() => ({ bienvenida: { ...config.bienvenida }, niveles: { ...config.niveles, recompensas: [...(config.niveles.recompensas || [])] }, sugerenciasCanalId: config.sugerenciasCanalId }));
  const [guardando, guardar] = useGuardado(guildId, 'comunidad');
  const bien = (k, v) => setF({ ...f, bienvenida: { ...f.bienvenida, [k]: v } });
  const niv = (k, v) => setF({ ...f, niveles: { ...f.niveles, [k]: v } });
  const setRecomp = (i, k, v) => niv('recompensas', f.niveles.recompensas.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <Pagina titulo="Comunidad" icono="🌱" descripcion="Bienvenida, verificación, niveles y sugerencias." onGuardar={() => guardar(f)} guardando={guardando}>
      <div className="card pg" style={{ gap: 14 }}>
        <h3>👋 Bienvenida</h3>
        <Campo etiqueta="Auto-rol al entrar" ayuda="El bot necesita estar por encima de este rol en la jerarquía."><Selector valor={f.bienvenida.autoRolId} onChange={(v) => bien('autoRolId', v)} opciones={info.roles} prefijo="@" /></Campo>
        <FilaInterruptor titulo="Verificación con botón" descripcion="Publica el botón con /setup-verificacion en el canal que quieras." checked={f.bienvenida.verificacionActiva} onChange={(v) => bien('verificacionActiva', v)} />
        <Campo etiqueta="Rol que se da al verificarse"><Selector valor={f.bienvenida.verificacionRolId} onChange={(v) => bien('verificacionRolId', v)} opciones={info.roles} prefijo="@" /></Campo>
      </div>
      <div className="card pg" style={{ gap: 14 }}>
        <h3>🏆 Niveles</h3>
        <FilaInterruptor titulo="Sistema de niveles por mensajes" descripcion="Comandos /rank y /top. Los tickets no dan XP." checked={f.niveles.activo} onChange={(v) => niv('activo', v)} />
        <Campo etiqueta="Canal de avisos de subida de nivel" ayuda="Si lo dejas vacío, se avisa en el mismo canal."><Selector valor={f.niveles.canalId} onChange={(v) => niv('canalId', v)} opciones={info.canales} prefijo="#" vacio="— El mismo canal —" /></Campo>
        <strong style={{ fontSize: '.85rem' }}>🎁 Roles de recompensa</strong>
        {f.niveles.recompensas.map((r, i) => (
          <div className="row" key={i}>
            <span className="muted small">Nivel</span><div style={{ width: 90 }}><Num valor={r.nivel} onChange={(v) => setRecomp(i, 'nivel', v)} max={500} /></div>
            <div className="grow"><Selector valor={r.rolId} onChange={(v) => setRecomp(i, 'rolId', v)} opciones={info.roles} prefijo="@" vacio="Elige un rol…" /></div>
            <button className="btn pequeno fantasma" onClick={() => niv('recompensas', f.niveles.recompensas.filter((_, j) => j !== i))}>✖</button>
          </div>
        ))}
        <div><button className="btn fantasma pequeno" onClick={() => niv('recompensas', [...f.niveles.recompensas, { nivel: 5, rolId: '' }])}>➕ Añadir recompensa</button></div>
      </div>
      <div className="card pg" style={{ gap: 14 }}>
        <h3>💡 Sugerencias</h3>
        <Campo etiqueta="Canal donde se publican" ayuda="Los miembros usan /sugerir; el staff las resuelve con /sugerencia resolver."><Selector valor={f.sugerenciasCanalId} onChange={(v) => setF({ ...f, sugerenciasCanalId: v })} opciones={info.canales} prefijo="#" /></Campo>
      </div>
    </Pagina>
  );
}

// Límites y archivo de tickets (se muestra dentro de «Ajustes de incidencias»).
function FormLimites({ config, info, guildId }) {
  const [f, setF] = useState(() => ({ ...config.tickets }));
  const [guardando, guardar] = useGuardado(guildId, 'tickets');
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <div className="card pg" style={{ gap: 14 }}>
      <div className="row"><h3 className="grow" style={{ margin: 0 }}>🛡️ Límites, FAQ y archivo</h3><button className="btn" onClick={() => guardar(f)} disabled={guardando}>{guardando ? 'Guardando…' : '💾 Guardar'}</button></div>
      <div className="grid-auto">
        <Campo etiqueta="Máx. tickets abiertos por usuario"><Num valor={f.maxAbiertosPorUsuario} onChange={(v) => set('maxAbiertosPorUsuario', v)} max={20} /></Campo>
        <Campo etiqueta="Espera entre tickets (segundos)"><Num valor={f.cooldownSegundos} onChange={(v) => set('cooldownSegundos', v)} min={0} max={3600} /></Campo>
        <Campo etiqueta="Rol de staff (ve los tickets y recibe avisos)"><Selector valor={f.rolStaffId} onChange={(v) => set('rolStaffId', v)} opciones={info.roles} prefijo="@" /></Campo>
        <Campo etiqueta="Canal de archivo de transcripciones"><Selector valor={f.canalTranscriptsId} onChange={(v) => set('canalTranscriptsId', v)} opciones={info.canales} prefijo="#" /></Campo>
      </div>
      <FilaInterruptor titulo="Sugerir artículos de la FAQ antes de abrir el ticket" checked={f.faqActiva} onChange={(v) => set('faqActiva', v)} />
    </div>
  );
}

export const Automatizacion = () => <Cargador Formulario={FormAutomatizacion} />;
export const AutoMod = () => <Cargador Formulario={FormAutoMod} />;
export const Comunidad = () => <Cargador Formulario={FormComunidad} />;
export const AjustesLimites = () => <Cargador Formulario={FormLimites} ocultarSiFalla />;
