// Editor de Tipos de Sanción — el admin diseña sus propias "plantillas" de
// sanción (nombre, acción, duración, color…). Cada una será un botón en el
// Centro de Mando.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Hammer, Plus, Pencil, Trash2, X } from 'lucide-react';
import { EmojiPicker } from '../../ui/EmojiPicker';
import { ACCIONES, accionMeta, aUnidad, aMinutos, textoDuracion } from '../../../lib/sanciones';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const inputCls = 'w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand';

export default function TiposSancionView({ dash }) {
  const { t } = useTranslation();
  const { tiposSancion, crearTipoSancion, editarTipoSancion, eliminarTipoSancion } = dash;
  const [editando, setEditando] = useState(null);

  return (
    <div className="space-y-5">
      <div data-help="tipos-crear" className="flex items-center justify-between">
        <p className="text-sm text-muted">{t('dashboard.mod_v.tiposIntro')}</p>
        <button onClick={() => setEditando({})} className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-4 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90">
          <Plus size={16} /> {t('dashboard.mod_v.newType')}
        </button>
      </div>

      {tiposSancion.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-2 py-12 text-center`}>
          <Hammer size={32} className="text-muted" />
          <p className="text-sm italic text-muted">{t('dashboard.mod_v.noTypes')}</p>
        </div>
      ) : (
        <div data-help="tipos-lista" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tiposSancion.map((tipo) => {
            const meta = accionMeta(tipo.accion);
            const Icono = meta.icon;
            return (
              <motion.div key={tipo._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${card} relative`} style={{ borderTop: `3px solid ${tipo.color || meta.color}` }}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: `${tipo.color || meta.color}22`, color: tipo.color || meta.color }}>
                    {tipo.emoji || <Icono size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-fg">{tipo.nombre}</h3>
                    <p className="text-xs text-muted">{t(`dashboard.mod_v.actions.${tipo.accion}`)} · {textoDuracion(tipo.duracionMin, t)}</p>
                  </div>
                </div>
                {tipo.descripcion && <p className="mt-3 text-xs text-muted">{tipo.descripcion}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setEditando(tipo)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-fg"><Pencil size={14} /></button>
                  <button onClick={async () => { if (window.confirm(t('dashboard.mod_v.confirmDeleteType', { name: tipo.nombre }))) await eliminarTipoSancion(tipo._id); }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-danger/40 hover:text-danger"><Trash2 size={14} /></button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {editando && (
          <TipoModal
            tipo={editando}
            onClose={() => setEditando(null)}
            onGuardar={async (datos) => {
              const ok = editando._id ? await editarTipoSancion(editando._id, datos) : await crearTipoSancion(datos);
              if (ok) setEditando(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TipoModal({ tipo, onClose, onGuardar }) {
  const { t } = useTranslation();
  const editando = !!tipo._id;
  const dur = aUnidad(tipo.duracionMin || 0);

  const [nombre, setNombre] = useState(tipo.nombre || '');
  const [accion, setAccion] = useState(tipo.accion || 'aviso');
  const [valor, setValor] = useState(dur.valor);
  const [unidad, setUnidad] = useState(dur.unidad);
  const [borrarMensajesHoras, setBorrarMensajesHoras] = useState(tipo.borrarMensajesHoras || 0);
  const [color, setColor] = useState(tipo.color || accionMeta(tipo.accion || 'aviso').color);
  const [emoji, setEmoji] = useState(tipo.emoji || '');
  const [descripcion, setDescripcion] = useState(tipo.descripcion || '');
  const [guardando, setGuardando] = useState(false);

  const usaDuracion = accion === 'timeout' || accion === 'ban';

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    await onGuardar({
      nombre: nombre.trim(), accion,
      duracionMin: usaDuracion ? aMinutos(Number(valor) || 0, unidad) : 0,
      borrarMensajesHoras: accion === 'ban' ? Number(borrarMensajesHoras) || 0 : 0,
      color, emoji: emoji || null, descripcion: descripcion.trim() || null,
    });
    setGuardando(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.2 }} onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-card p-6 shadow-soft">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-fg">{editando ? t('dashboard.mod_v.editType') : t('dashboard.mod_v.newType')}</h2>
          <button onClick={onClose} className="text-muted transition-colors hover:text-fg"><X size={20} /></button>
        </div>

        {/* Acción */}
        <label className="mb-2 block text-xs font-semibold text-muted">{t('dashboard.mod_v.action')}</label>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ACCIONES.map((a) => (
            <button key={a.id} onClick={() => { setAccion(a.id); setColor(a.color); }} className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-semibold transition-colors ${accion === a.id ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:text-fg'}`}>
              <a.icon size={18} style={{ color: a.color }} /> {t(`dashboard.mod_v.actions.${a.id}`)}
            </button>
          ))}
        </div>

        {/* Nombre */}
        <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.mod_v.typeName')}</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('dashboard.mod_v.typeNamePh')} className={`${inputCls} mb-4`} />

        {/* Duración (timeout / ban) */}
        {usaDuracion && (
          <>
            <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.mod_v.duration')}</label>
            <div className="mb-1 flex gap-2">
              <input type="number" min={0} value={valor} onChange={(e) => setValor(Math.max(0, parseInt(e.target.value, 10) || 0))} className={inputCls} />
              <select value={unidad} onChange={(e) => setUnidad(e.target.value)} className={inputCls}>
                <option value="min">{t('dashboard.mod_v.unitMin')}</option>
                <option value="horas">{t('dashboard.mod_v.unitHours')}</option>
                <option value="dias">{t('dashboard.mod_v.unitDays')}</option>
              </select>
            </div>
            <p className="mb-4 text-xs text-muted">{accion === 'ban' && Number(valor) === 0 ? t('dashboard.mod_v.banPermanentHint') : t('dashboard.mod_v.timeoutMaxHint')}</p>
          </>
        )}

        {/* Borrar mensajes (solo ban) */}
        {accion === 'ban' && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg p-3">
            <div>
              <p className="text-sm font-semibold text-fg">{t('dashboard.mod_v.deleteMessages')}</p>
              <p className="text-xs text-muted">{t('dashboard.mod_v.deleteMessagesHint')}</p>
            </div>
            <input type="number" min={0} max={168} value={borrarMensajesHoras} onChange={(e) => setBorrarMensajesHoras(Math.min(168, Math.max(0, parseInt(e.target.value, 10) || 0)))} className="w-20 rounded-xl border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand" />
          </div>
        )}

        {/* Apariencia */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.mod_v.color')}</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-bg" />
              <span className="rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs text-fg">{color}</span>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.mod_v.emoji')}</label>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>
        </div>

        <label className="mb-1.5 mt-3 block text-xs font-semibold text-muted">{t('dashboard.mod_v.descriptionOpt')}</label>
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder={t('dashboard.mod_v.descriptionPh')} className={inputCls} />

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-fg">{t('dashboard.mod_v.cancel')}</button>
          <button onClick={guardar} disabled={guardando || !nombre.trim()} className="rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50">
            {guardando ? t('dashboard.mod_v.saving') : t('dashboard.mod_v.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
