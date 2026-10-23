// Vista de Paneles de autoasignación de roles.
// Lista de paneles + editor completo (tipo, apariencia, opciones y roles).
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  MousePointerClick, List, Smile, ShieldCheck, Plus, Pencil, Trash2, X, Send, Hash, Info, GripVertical, Upload,
} from 'lucide-react';
import { Toggle } from '../../ui/primitives';
import { EmojiPicker } from '../../ui/EmojiPicker';
import { API_URL } from '../../../lib/api';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const inputCls = 'w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand';

const TIPOS = [
  { id: 'boton', icon: MousePointerClick },
  { id: 'menu', icon: List },
  { id: 'reaccion', icon: Smile },
  { id: 'verificacion', icon: ShieldCheck },
];
const ESTILOS_BTN = ['primary', 'secondary', 'success', 'danger'];
const COLOR_DEFECTO = '#5865F2';

export default function PanelesView({ dash }) {
  const { t } = useTranslation();
  const { paneles, canales, emojisServidor, rolesDetalle, crearPanel, editarPanel, publicarPanel, eliminarPanel, subirImagenPanel } = dash;
  const [editando, setEditando] = useState(null); // null | {} (nuevo) | panel (editar)

  const nombreCanal = (id) => canales.find((c) => c.id === id)?.nombre;
  const hayBloqueados = rolesDetalle.some((r) => !r.gestionable);

  return (
    <div className="space-y-5">
      <div data-help="paneles-crear" className="flex items-center justify-between">
        <p className="text-sm text-muted">{t('dashboard.paneles_v.intro')}</p>
        <button
          onClick={() => setEditando({})}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-4 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> {t('dashboard.paneles_v.create')}
        </button>
      </div>

      {hayBloqueados && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
          <Info size={16} className="mt-0.5 shrink-0 text-brand" />
          <p className="text-xs text-muted">{t('dashboard.roles_v.hierarchyHint')}</p>
        </div>
      )}

      {paneles.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-2 py-12 text-center`}>
          <MousePointerClick size={32} className="text-muted" />
          <p className="text-sm italic text-muted">{t('dashboard.paneles_v.empty')}</p>
        </div>
      ) : (
        <div data-help="paneles-lista" className="space-y-3">
          {paneles.map((p) => {
            const TipoIcon = (TIPOS.find((x) => x.id === p.tipo) || TIPOS[0]).icon;
            return (
              <div key={p._id} className={`${card} flex items-center gap-4`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><TipoIcon size={18} /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-fg">{p.titulo || t('dashboard.paneles_v.untitled')}</h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span>{t(`dashboard.paneles_v.types.${p.tipo}`)}</span>
                    <span>· {t('dashboard.paneles_v.roleCount', { count: p.items?.length || 0 })}</span>
                    {p.channelId && <span>· <Hash size={11} className="inline" />{nombreCanal(p.channelId) || '—'}</span>}
                    {p.exclusivo && <span>· {t('dashboard.paneles_v.exclusiveTag')}</span>}
                    {p.messageId ? <span className="text-success">· {t('dashboard.paneles_v.published')}</span> : <span className="text-warning">· {t('dashboard.paneles_v.draft')}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => publicarPanel(p._id, p.channelId)} disabled={!p.channelId} className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold text-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-40" title={t('dashboard.paneles_v.publish')}>
                    <Send size={14} /> {p.messageId ? t('dashboard.paneles_v.republish') : t('dashboard.paneles_v.publish')}
                  </button>
                  <button onClick={() => setEditando(p)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:text-fg" title={t('dashboard.paneles_v.edit')}><Pencil size={15} /></button>
                  <button onClick={async () => { if (window.confirm(t('dashboard.paneles_v.confirmDelete'))) await eliminarPanel(p._id); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:border-danger/40 hover:text-danger" title={t('dashboard.paneles_v.delete')}><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {editando && (
          <PanelModal
            panel={editando}
            canales={canales}
            emojis={emojisServidor}
            subirImagen={subirImagenPanel}
            roles={rolesDetalle.filter((r) => r.gestionable)}
            onClose={() => setEditando(null)}
            onGuardar={async (datos) => {
              const res = editando._id ? await editarPanel(editando._id, datos) : await crearPanel(datos);
              if (res?.aviso) alert(res.aviso);
              if (res) setEditando(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Modal editor de panel ---
function PanelModal({ panel, canales, emojis, subirImagen, roles, onClose, onGuardar }) {
  const { t } = useTranslation();
  const editando = !!panel._id;

  const [tipo, setTipo] = useState(panel.tipo || 'boton');
  const [titulo, setTitulo] = useState(panel.titulo ?? '🎭 Choose your roles');
  const [descripcion, setDescripcion] = useState(panel.descripcion ?? 'Click to assign or remove a role.');
  const [color, setColor] = useState(panel.color || COLOR_DEFECTO);
  const [imagen, setImagen] = useState(panel.imagen || '');
  const [imagenArchivo, setImagenArchivo] = useState(panel.imagenArchivo || '');
  const [subiendo, setSubiendo] = useState(false);
  const [channelId, setChannelId] = useState(panel.channelId || '');
  const [exclusivo, setExclusivo] = useState(!!panel.exclusivo);
  const [maxRoles, setMaxRoles] = useState(panel.maxRoles || 0);
  const [permitirQuitar, setPermitirQuitar] = useState(panel.permitirQuitar !== false);
  const [items, setItems] = useState(panel.items?.length ? panel.items.map((i) => ({ ...i })) : [{ roleId: '', emoji: '', label: '', descripcion: '', duracionMin: 0, estilo: 'secondary' }]);
  const [guardando, setGuardando] = useState(false);

  const esVerif = tipo === 'verificacion';

  // Vista previa: la imagen subida (servida por la API) o la URL externa.
  const preview = imagenArchivo ? `${API_URL}/uploads/${imagenArchivo}` : (imagen.trim() || '');

  // Sube un archivo elegido por el usuario (lo lee como base64 y lo manda a la API).
  const onSubirArchivo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-elegir el mismo archivo
    if (!file) return;
    const lector = new FileReader();
    lector.onload = async () => {
      setSubiendo(true);
      const res = await subirImagen(lector.result);
      setSubiendo(false);
      if (res?.archivo) { setImagenArchivo(res.archivo); setImagen(''); }
      else alert(res?.error || 'Couldn’t upload the image');
    };
    lector.readAsDataURL(file);
  };

  const setItem = (idx, campo, valor) => setItems(items.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  const addItem = () => setItems([...items, { roleId: '', emoji: '', label: '', descripcion: '', duracionMin: 0, estilo: 'secondary' }]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const guardar = async () => {
    setGuardando(true);
    // En verificación solo cuenta el primer rol.
    const itemsLimpios = (esVerif ? items.slice(0, 1) : items).filter((it) => it.roleId);
    await onGuardar({ tipo, titulo, descripcion, color, imagen: imagen.trim() || null, imagenArchivo: imagenArchivo || null, channelId: channelId || null, exclusivo, maxRoles, permitirQuitar, items: itemsLimpios });
    setGuardando(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-card p-6 shadow-soft"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-fg">{editando ? t('dashboard.paneles_v.editTitle') : t('dashboard.paneles_v.createTitle')}</h2>
          <button onClick={onClose} className="text-muted transition-colors hover:text-fg"><X size={20} /></button>
        </div>

        {/* Tipo de panel */}
        <label className="mb-2 block text-xs font-semibold text-muted">{t('dashboard.paneles_v.fieldType')}</label>
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIPOS.map((x) => (
            <button
              key={x.id} onClick={() => setTipo(x.id)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-xs font-semibold transition-colors ${tipo === x.id ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:text-fg'}`}
            >
              <x.icon size={18} /> {t(`dashboard.paneles_v.types.${x.id}`)}
            </button>
          ))}
        </div>

        {/* Apariencia */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.paneles_v.fieldChannel')}</label>
            <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={inputCls}>
              <option value="">{t('dashboard.paneles_v.noChannel')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>#{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.paneles_v.fieldColor')}</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-bg" />
              <span className="rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs text-fg">{color}</span>
            </div>
          </div>
        </div>

        <label className="mb-1.5 mt-3 block text-xs font-semibold text-muted">{t('dashboard.paneles_v.fieldTitle')}</label>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputCls} />

        <label className="mb-1.5 mt-3 block text-xs font-semibold text-muted">{t('dashboard.paneles_v.fieldDesc')}</label>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className={`${inputCls} resize-none`} />

        {/* Imagen / GIF del panel: subir un archivo o pegar una URL */}
        <label className="mb-1.5 mt-3 block text-xs font-semibold text-muted">{t('dashboard.paneles_v.fieldImage')}</label>
        <div className="flex gap-2">
          <input value={imagen} onChange={(e) => { setImagen(e.target.value); if (e.target.value) setImagenArchivo(''); }} placeholder={t('dashboard.paneles_v.imagePh')} className={inputCls} />
          <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-line bg-bg px-3.5 text-sm font-semibold text-muted transition-colors hover:text-fg">
            <Upload size={15} /> {subiendo ? t('dashboard.paneles_v.uploading') : t('dashboard.paneles_v.upload')}
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={onSubirArchivo} />
          </label>
        </div>
        {preview && (
          <div className="relative mt-2 inline-block">
            <img src={preview} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="max-h-40 rounded-xl border border-line object-contain" />
            <button onClick={() => { setImagen(''); setImagenArchivo(''); }} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80" title={t('dashboard.paneles_v.removeImage')}><X size={13} /></button>
          </div>
        )}

        {/* Opciones de comportamiento (no aplican a verificación) */}
        {!esVerif && (
          <div className="mt-4 space-y-3 rounded-2xl border border-line bg-bg p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-fg">{t('dashboard.paneles_v.exclusive')}</p>
                <p className="text-xs text-muted">{t('dashboard.paneles_v.exclusiveDesc')}</p>
              </div>
              <Toggle checked={exclusivo} onChange={setExclusivo} />
            </div>
            {!exclusivo && (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-fg">{t('dashboard.paneles_v.maxRoles')}</p>
                  <p className="text-xs text-muted">{t('dashboard.paneles_v.maxRolesDesc')}</p>
                </div>
                <input type="number" min={0} value={maxRoles} onChange={(e) => setMaxRoles(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-20 rounded-xl border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand" />
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-fg">{t('dashboard.paneles_v.allowRemove')}</p>
                <p className="text-xs text-muted">{t('dashboard.paneles_v.allowRemoveDesc')}</p>
              </div>
              <Toggle checked={permitirQuitar} onChange={setPermitirQuitar} />
            </div>
          </div>
        )}

        {/* Roles del panel */}
        <div className="mt-5 flex items-center justify-between">
          <label className="text-xs font-semibold text-muted">{esVerif ? t('dashboard.paneles_v.verifyRole') : t('dashboard.paneles_v.fieldRoles')}</label>
          {!esVerif && <button onClick={addItem} className="flex items-center gap-1 text-xs font-semibold text-brand hover:opacity-80"><Plus size={13} /> {t('dashboard.paneles_v.addRole')}</button>}
        </div>

        <div className="mt-2 space-y-2">
          {(esVerif ? items.slice(0, 1) : items).map((it, idx) => (
            <div key={idx} className="rounded-2xl border border-line bg-bg p-3">
              <div className="flex items-center gap-2">
                {!esVerif && <GripVertical size={15} className="shrink-0 text-muted" />}
                <select value={it.roleId} onChange={(e) => setItem(idx, 'roleId', e.target.value)} className={`${inputCls} flex-1`}>
                  <option value="">{t('dashboard.paneles_v.pickRole')}</option>
                  {roles.map((r) => {
                    // Deshabilita un rol si ya está elegido en OTRA fila (evita duplicados).
                    const usadoEnOtra = items.some((otro, j) => j !== idx && otro.roleId === r.id);
                    return <option key={r.id} value={r.id} disabled={usadoEnOtra}>{r.nombre}{usadoEnOtra ? ' ✓' : ''}</option>;
                  })}
                </select>
                {!esVerif && items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:border-danger/40 hover:text-danger"><X size={14} /></button>
                )}
              </div>

              {/* Campos por rol según el tipo de panel */}
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(tipo === 'reaccion' || tipo === 'boton' || tipo === 'menu') && (
                  <EmojiPicker value={it.emoji || ''} onChange={(v) => setItem(idx, 'emoji', v)} personalizados={emojis} />
                )}
                {(tipo === 'boton' || tipo === 'menu' || tipo === 'reaccion' || esVerif) && (
                  <input value={it.label || ''} onChange={(e) => setItem(idx, 'label', e.target.value)} placeholder={t(tipo === 'reaccion' ? 'dashboard.paneles_v.legendPh' : 'dashboard.paneles_v.labelPh')} className={inputCls} />
                )}
                {tipo === 'menu' && (
                  <input value={it.descripcion || ''} onChange={(e) => setItem(idx, 'descripcion', e.target.value)} placeholder={t('dashboard.paneles_v.itemDescPh')} className={inputCls} />
                )}
                {tipo === 'boton' && (
                  <select value={it.estilo || 'secondary'} onChange={(e) => setItem(idx, 'estilo', e.target.value)} className={inputCls}>
                    {ESTILOS_BTN.map((s) => <option key={s} value={s}>{t(`dashboard.paneles_v.styles.${s}`)}</option>)}
                  </select>
                )}
                {!esVerif && (
                  <label className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-xs text-muted" title={t('dashboard.paneles_v.durationTip')}>
                    <span className="shrink-0">⏱ {t('dashboard.paneles_v.durationLabel')}</span>
                    <input type="number" min={0} value={it.duracionMin || 0} onChange={(e) => setItem(idx, 'duracionMin', Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full min-w-0 bg-transparent text-sm text-fg outline-none" />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Acciones */}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-fg">{t('dashboard.paneles_v.cancel')}</button>
          <button onClick={guardar} disabled={guardando} className="rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50">
            {guardando ? t('dashboard.paneles_v.saving') : t('dashboard.paneles_v.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
