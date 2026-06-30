// Ajustes de Tickets — TODA la configuración del sistema de tickets en un solo
// sitio, por secciones: Panel, Reglas, Al cerrar, Notificaciones, Urgencias y
// motivos, y Respuestas rápidas. Antes estaba repartida en Comportamiento,
// Reglas y control, Textos y Respuestas rápidas. Reutiliza los handlers del hook
// (auto-guardado por campo donde ya lo había; botón Guardar donde hacía falta).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Save, Pencil, Eye, ShieldCheck, FolderTree, Hash, Clock, UserCheck, Info,
  Star, FileText, MessageSquareWarning, BellRing, Gauge, Tags, Zap, X, Plus,
} from 'lucide-react';
import { Card, Toggle } from '../../ui/primitives';

const field = 'w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg outline-none transition-shadow focus:ring-2 focus:ring-brand/40';
const labelCls = 'text-xs font-bold uppercase tracking-wide text-muted';
const select = 'w-full min-w-[200px] rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/40';
const num = 'w-28 rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/40';
const smallInput = 'rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/40';

// Fila genérica con interruptor.
function Row({ icon: Icon, title, desc, checked, onChange, accent = 'text-brand' }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 ${accent}`}><Icon size={18} /></span>
        <div>
          <p className="text-sm font-semibold text-fg">{title}</p>
          <p className="text-xs text-muted">{desc}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export default function TicketsAjustesView({ dash }) {
  const { t } = useTranslation();
  const {
    configServidor, roles, categorias, esPremium,
    // Panel (textos de marca blanca del ticket)
    tituloMensaje, setTituloMensaje, descripcionMensaje, setDescripcionMensaje,
    footerMensaje, setFooterMensaje, colorEmbed, setColorEmbed, textoBoton, setTextoBoton,
    mensajeBienvenida, setMensajeBienvenida, prefijo,
    categoriaArchivados, setCategoriaArchivados, guardarTextosConfig,
    // Reglas y comportamiento
    guardarReglas, guardarComportamiento,
    // Urgencias y motivos
    urgencias, nuevaUrgNombre, setNuevaUrgNombre, nuevaUrgColor, setNuevaUrgColor,
    nuevaUrgNivel, setNuevaUrgNivel, agregarUrgencia, eliminarUrgencia,
    motivos, nuevoMotivo, setNuevoMotivo, nuevaUrgencia, setNuevaUrgencia,
    agregarMotivo, eliminarMotivo, getColorUrgencia, guardarCambiosConfig,
    // Respuestas rápidas
    guardarMacros,
  } = dash;

  const [macroTitulo, setMacroTitulo] = useState('');
  const [macroContenido, setMacroContenido] = useState('');

  if (!configServidor) {
    return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  }

  const c = configServidor;
  const val = (v, def = true) => (v === undefined || v === null ? def : v);
  const guardarNumero = (campo, valor) => guardarReglas({ [campo]: Math.max(0, parseInt(valor, 10) || 0) });
  const urgenciasOrdenadas = [...urgencias].sort((a, b) => b.nivel - a.nivel);
  const macros = c.respuestasRapidas || [];

  const añadirMacro = () => {
    if (!macroTitulo.trim() || !macroContenido.trim()) return;
    guardarMacros([...macros, { titulo: macroTitulo.trim(), contenido: macroContenido.trim() }]);
    setMacroTitulo(''); setMacroContenido('');
  };
  const eliminarMacro = (i) => guardarMacros(macros.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-xs text-muted shadow-soft">
        <Info size={15} className="text-brand" /> {t('dashboard.behavior_v.autosave')}
      </div>

      {/* ───────── PANEL DEL TICKET ───────── */}
      <Card className="flex flex-col items-start justify-between gap-4 p-6 shadow-soft sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-fg"><Pencil size={18} className="text-brand" /> {t('dashboard.tickets_set.panelTitle')}</h2>
          <p className="mt-1 text-sm text-muted">{t('dashboard.tickets_set.panelDesc')}</p>
        </div>
        <button onClick={guardarTextosConfig} className="flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-on-brand glow-brand transition-transform hover:scale-[1.03]">
          <Save size={16} /> {t('dashboard.texts_v.save')}
        </button>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-5 p-6 shadow-soft">
          <div className="flex flex-col gap-2">
            <label className={labelCls}>{t('dashboard.texts_v.msgTitle')}</label>
            <input type="text" value={tituloMensaje} onChange={(e) => setTituloMensaje(e.target.value)} placeholder="🎫 Support is open" className={field} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>{t('dashboard.texts_v.msgDesc')}</label>
            <textarea value={descripcionMensaje} onChange={(e) => setDescripcionMensaje(e.target.value)} className={`${field} min-h-[100px] resize-y`} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>{t('dashboard.texts_v.footer')}</label>
            <input type="text" value={footerMensaje} onChange={(e) => setFooterMensaje(e.target.value)} className={field} />
            <p className={`text-xs ${esPremium ? 'text-success' : 'text-muted'}`}>{esPremium ? t('dashboard.texts_v.wlPro') : t('dashboard.texts_v.wlFree')}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className={labelCls}>{t('dashboard.texts_v.color')}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={colorEmbed} onChange={(e) => setColorEmbed(e.target.value)} className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
                <input type="text" value={colorEmbed} onChange={(e) => setColorEmbed(e.target.value)} className={field} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelCls}>{t('dashboard.texts_v.btnText')}</label>
              <input type="text" value={textoBoton} onChange={(e) => setTextoBoton(e.target.value)} placeholder="📩 Open a ticket" className={field} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>{t('dashboard.texts_v.welcome')}</label>
            <input type="text" value={mensajeBienvenida} onChange={(e) => setMensajeBienvenida(e.target.value)} className={field} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>{t('dashboard.texts_v.archiveCat')}</label>
            <input type="text" value={categoriaArchivados} onChange={(e) => setCategoriaArchivados(e.target.value)} placeholder="🗄️ Tickets Archivados" className={field} />
            <p className="text-xs text-muted">{t('dashboard.texts_v.archiveHint')}</p>
          </div>
        </Card>

        {/* Vista previa estilo Discord */}
        <Card className="flex flex-col p-6 shadow-soft">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-fg"><Eye size={17} className="text-brand" /> {t('dashboard.texts_v.preview')}</h3>
          <div className="rounded bg-[#2f3136] p-4 text-[#dcddde] shadow-xl" style={{ borderLeft: `4px solid ${colorEmbed || '#5865F2'}` }}>
            <div className="mb-2 text-[1.05rem] font-bold text-white">{tituloMensaje || t('dashboard.texts_v.previewTitle')}</div>
            <div className="mb-3 whitespace-pre-wrap text-sm text-[#b9bbbe]">{descripcionMensaje || t('dashboard.texts_v.previewDesc')}</div>
            <div className="text-xs text-[#72767d]">{footerMensaje || t('dashboard.texts_v.previewFooter')}</div>
          </div>
          <div className="mt-4 w-fit select-none rounded px-4 py-2.5 text-sm font-semibold text-white shadow-md" style={{ backgroundColor: colorEmbed || '#5865F2' }}>
            {textoBoton || '📩 Open a ticket'}
          </div>
          <p className="mt-4 text-xs italic text-muted">{t('dashboard.texts_v.previewNote', { prefix: prefijo || '!' })}</p>
        </Card>
      </div>

      {/* ───────── REGLAS Y CONTROL ───────── */}
      <Card className="p-6 shadow-soft">
        <h3 className="mb-3 flex items-center gap-2 font-bold text-fg"><ShieldCheck size={18} className="text-brand" /> {t('dashboard.tickets_set.rulesTitle')}</h3>
        <div className="divide-y divide-line">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-brand"><ShieldCheck size={18} /></span>
              <div><p className="text-sm font-semibold text-fg">{t('dashboard.rules_v.staff')}</p><p className="text-xs text-muted">{t('dashboard.rules_v.staffDesc')}</p></div>
            </div>
            <select value={c.rolStaffId || ''} onChange={(e) => guardarReglas({ rolStaffId: e.target.value || null })} className={select} style={{ maxWidth: 260 }}>
              <option value="">{t('dashboard.rules_v.onlyAdmins')}</option>
              {roles.map((rol) => <option key={rol.id} value={rol.id}>{rol.nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-brand"><FolderTree size={18} /></span>
              <div><p className="text-sm font-semibold text-fg">{t('dashboard.rules_v.category')}</p><p className="text-xs text-muted">{t('dashboard.rules_v.categoryDesc')}</p></div>
            </div>
            <select value={c.categoriaTicketsId || ''} onChange={(e) => guardarReglas({ categoriaTicketsId: e.target.value || null })} className={select} style={{ maxWidth: 260 }}>
              <option value="">{t('dashboard.rules_v.noCategory')}</option>
              {categorias.map((cat) => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-brand"><Hash size={18} /></span>
              <div><p className="text-sm font-semibold text-fg">{t('dashboard.rules_v.limit')}</p><p className="text-xs text-muted">{t('dashboard.rules_v.limitDesc')}</p></div>
            </div>
            <input type="number" min="0" defaultValue={c.maxTicketsAbiertos ?? 0} onBlur={(e) => guardarNumero('maxTicketsAbiertos', e.target.value)} className={num} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-brand"><Clock size={18} /></span>
              <div><p className="text-sm font-semibold text-fg">{t('dashboard.rules_v.autoclose')}</p><p className="text-xs text-muted">{t('dashboard.rules_v.autocloseDesc')}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="0" defaultValue={c.autoCierreDias ?? 0} onBlur={(e) => guardarNumero('autoCierreDias', e.target.value)} className={num} />
              <span className="text-sm text-muted">{t('dashboard.rules_v.days')}</span>
            </div>
          </div>
          <Row icon={UserCheck} title={t('dashboard.rules_v.autoAssign')} desc={t('dashboard.rules_v.autoAssignDesc')} checked={!!c.autoAsignar} onChange={(v) => guardarReglas({ autoAsignar: v })} />
        </div>
        {roles.length === 0 && <p className="mt-2 text-xs italic text-muted">{t('dashboard.rules_v.noRoles')}</p>}
      </Card>

      {/* ───────── AL CERRAR ───────── */}
      <Card className="p-6 shadow-soft">
        <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><FileText size={18} className="text-brand" /> {t('dashboard.behavior_v.onClose')}</h3>
        <div className="divide-y divide-line">
          <Row icon={Star} accent="text-amber-400" title={t('dashboard.behavior_v.csat')} desc={t('dashboard.behavior_v.csatDesc')} checked={val(c.ratingActivo)} onChange={(v) => guardarComportamiento({ ratingActivo: v })} />
          <Row icon={FileText} accent="text-emerald-400" title={t('dashboard.behavior_v.transcript')} desc={t('dashboard.behavior_v.transcriptDesc')} checked={val(c.enviarTranscript)} onChange={(v) => guardarComportamiento({ enviarTranscript: v })} />
          <Row icon={MessageSquareWarning} title={t('dashboard.behavior_v.closeNotice')} desc={t('dashboard.behavior_v.closeNoticeDesc')} checked={val(c.avisoCierreCanal)} onChange={(v) => guardarComportamiento({ avisoCierreCanal: v })} />
        </div>
      </Card>

      {/* ───────── NOTIFICACIONES ───────── */}
      <Card className="p-6 shadow-soft">
        <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><BellRing size={18} className="text-brand" /> {t('dashboard.behavior_v.notifications')}</h3>
        <div className="divide-y divide-line">
          <Row icon={BellRing} title={t('dashboard.behavior_v.pingTeam')} desc={t('dashboard.behavior_v.pingTeamDesc')} checked={val(c.pingSoporte, false)} onChange={(v) => guardarComportamiento({ pingSoporte: v })} />
          {val(c.pingSoporte, false) && (
            <div className="flex items-center justify-between gap-4 py-3.5">
              <p className="text-sm text-muted">{t('dashboard.behavior_v.roleToMention')}</p>
              <select value={c.rolSoporteId || ''} onChange={(e) => guardarComportamiento({ rolSoporteId: e.target.value || null })} className="min-w-[180px] rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/40">
                <option value="">{t('dashboard.behavior_v.selectRole')}</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
          )}
        </div>
        {val(c.pingSoporte, false) && roles.length === 0 && <p className="mt-2 text-xs italic text-muted">{t('dashboard.behavior_v.noRoles')}</p>}
      </Card>

      {/* ───────── URGENCIAS Y MOTIVOS ───────── */}
      <Card className="flex flex-col items-start justify-between gap-4 p-6 shadow-soft sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-fg"><Gauge size={18} className="text-brand" /> {t('dashboard.incidents_v.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('dashboard.incidents_v.subtitle')}</p>
        </div>
        <button onClick={guardarCambiosConfig} className="flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-on-brand glow-brand transition-transform hover:scale-[1.03]">
          <Save size={16} /> {t('dashboard.incidents_v.save')}
        </button>
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col p-6">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-fg"><Gauge size={18} className="text-brand" /> {t('dashboard.incidents_v.sla')}</h3>
          <ul className="mb-5 flex max-h-[340px] flex-col gap-2.5 overflow-y-auto">
            {urgenciasOrdenadas.map((u, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl bg-bg px-4 py-3" style={{ border: `1px solid ${u.color}40`, borderLeft: `4px solid ${u.color}` }}>
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: u.color, boxShadow: `0 0 8px ${u.color}` }} />
                  <strong className="text-fg">{u.nombre}</strong>
                  <span className="rounded-full border border-line bg-card px-2 py-0.5 text-xs text-muted">{t('dashboard.incidents_v.level', { n: u.nivel })}</span>
                </div>
                <button onClick={() => eliminarUrgencia(u.nombre)} className="text-muted transition-colors hover:text-danger"><X size={16} /></button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-line bg-bg p-4">
            <input type="color" value={nuevaUrgColor} onChange={(e) => setNuevaUrgColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
            <input type="text" value={nuevaUrgNombre} onChange={(e) => setNuevaUrgNombre(e.target.value)} placeholder={t('dashboard.incidents_v.urgPlaceholder')} className={`${smallInput} min-w-[120px] flex-1`} />
            <input type="number" value={nuevaUrgNivel} onChange={(e) => setNuevaUrgNivel(e.target.value)} min="1" max="1000" className={`${smallInput} w-20`} />
            <button onClick={agregarUrgencia} className="flex items-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2.5 text-sm font-bold text-on-brand transition-transform hover:scale-[1.03]"><Plus size={15} /> {t('dashboard.incidents_v.add')}</button>
          </div>
        </Card>
        <Card className="flex flex-col p-6">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-fg"><Tags size={18} className="text-brand" /> {t('dashboard.incidents_v.categories')}</h3>
          <ul className="mb-5 flex max-h-[340px] flex-col gap-2.5 overflow-y-auto">
            {motivos.map((motivo, index) => {
              const nombre = typeof motivo === 'string' ? motivo : motivo.nombre;
              const urgencia = typeof motivo === 'string' ? 'Normal' : motivo.urgencia;
              const colorUrg = getColorUrgencia(urgencia);
              return (
                <li key={index} className="flex items-center justify-between rounded-xl border border-line bg-bg px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <strong className="text-fg">{nombre}</strong>
                    <span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: colorUrg }}>{urgencia}</span>
                  </div>
                  <button onClick={() => eliminarMotivo(motivo)} className="text-muted transition-colors hover:text-danger"><X size={16} /></button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-line bg-bg p-4">
            <input type="text" value={nuevoMotivo} onChange={(e) => setNuevoMotivo(e.target.value)} placeholder={t('dashboard.incidents_v.motivoPlaceholder')} className={`${smallInput} min-w-[150px] flex-1`} />
            <select value={nuevaUrgencia} onChange={(e) => setNuevaUrgencia(e.target.value)} className={`${smallInput} cursor-pointer`}>
              {urgencias.map((u, i) => <option key={i} value={u.nombre}>{u.nombre}</option>)}
            </select>
            <button onClick={agregarMotivo} className="flex items-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2.5 text-sm font-bold text-on-brand transition-transform hover:scale-[1.03]"><Plus size={15} /> {t('dashboard.incidents_v.add')}</button>
          </div>
        </Card>
      </div>

      {/* ───────── RESPUESTAS RÁPIDAS ───────── */}
      <Card className="flex flex-col gap-3 p-6 shadow-soft">
        <h3 className="flex items-center gap-2 font-bold text-fg"><Zap size={18} className="text-brand" /> {t('dashboard.macros_v.title')}</h3>
        <p className="-mt-1 text-sm text-muted">{t('dashboard.macros_v.subtitle')}</p>
        <p className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-xs text-muted"><Info size={14} className="text-brand" /> {t('dashboard.macros_v.hint')}</p>
        <input type="text" value={macroTitulo} onChange={(e) => setMacroTitulo(e.target.value)} placeholder={t('dashboard.macros_v.newTitle')} maxLength={100} className={field} />
        <textarea value={macroContenido} onChange={(e) => setMacroContenido(e.target.value)} placeholder={t('dashboard.macros_v.newContent')} maxLength={2000} className={`${field} min-h-[90px] resize-y`} />
        <button onClick={añadirMacro} className="flex w-fit items-center gap-1.5 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand transition-transform hover:scale-[1.03]"><Plus size={15} /> {t('dashboard.macros_v.add')}</button>
        {macros.length === 0 ? (
          <p className="py-2 text-center text-sm italic text-muted">{t('dashboard.macros_v.empty')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {macros.map((m, i) => (
              <div key={i} className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-bg p-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-fg">{m.titulo}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{m.contenido}</p>
                </div>
                <button onClick={() => eliminarMacro(i)} className="shrink-0 text-muted transition-colors hover:text-danger" aria-label="Eliminar"><X size={18} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
