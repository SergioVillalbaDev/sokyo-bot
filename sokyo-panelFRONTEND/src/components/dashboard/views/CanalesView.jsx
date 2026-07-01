// Vista de Categorías y canales — crea/edita/elimina categorías y canales de
// texto, voz, anuncios, foro y escenario con todas las opciones de Discord
// (tema, NSFW, modo lento, bitrate, límite de usuarios, permisos por rol...).
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FolderTree, FolderPlus, Plus, Pencil, Trash2, X, ChevronDown,
  Hash, Volume2, Megaphone, MessagesSquare, Radio, Check, Minus,
} from 'lucide-react';
import { Toggle } from '../../ui/primitives';
import { ESTILOS_FUENTE, aplicarEstilo } from '../../../lib/fancyText';

const card = 'rounded-3xl border border-line bg-card shadow-soft';
const ICONO_TIPO = { texto: Hash, voz: Volume2, anuncios: Megaphone, foro: MessagesSquare, escenario: Radio };

export default function CanalesView({ dash }) {
  const { t } = useTranslation();
  const {
    estructuraCanales, permisosCanalCatalogo, roles,
    crearCategoriaCanal, editarCategoriaCanal, eliminarCategoriaCanal,
    crearCanalServidor, editarCanalServidor, eliminarCanalServidor,
  } = dash;

  const { categorias = [], sinCategoria = [] } = estructuraCanales || {};

  // Modal de categoría: null = cerrado · {} = creando · {categoria} = editando.
  const [editandoCategoria, setEditandoCategoria] = useState(null);
  // Modal de canal: null = cerrado · {categoriaId} = creando dentro de esa categoría · {canal} = editando.
  const [editandoCanal, setEditandoCanal] = useState(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{t('dashboard.canales_v.intro')}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setEditandoCanal({ categoriaId: null })}
            className="flex items-center gap-2 rounded-2xl border border-line px-4 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand"
          >
            <Plus size={16} /> {t('dashboard.canales_v.addChannel')}
          </button>
          <button
            onClick={() => setEditandoCategoria({})}
            className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-4 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90"
          >
            <FolderPlus size={16} /> {t('dashboard.canales_v.createCategory')}
          </button>
        </div>
      </div>

      {categorias.length === 0 && sinCategoria.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-2 p-12 text-center`}>
          <FolderTree size={32} className="text-muted" />
          <p className="text-sm italic text-muted">{t('dashboard.canales_v.noCategories')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categorias.map((cat, i) => (
            <CategoriaRow
              key={cat.id} categoria={cat} index={i}
              onEditar={() => setEditandoCategoria(cat)}
              onEliminar={async () => { if (window.confirm(t('dashboard.canales_v.confirmDeleteCategory', { name: cat.nombre }))) await eliminarCategoriaCanal(cat.id); }}
              onAddCanal={() => setEditandoCanal({ categoriaId: cat.id })}
              onEditarCanal={(canal) => setEditandoCanal({ canal })}
              onEliminarCanal={async (canal) => { if (window.confirm(t('dashboard.canales_v.confirmDeleteChannel', { name: canal.nombre }))) await eliminarCanalServidor(canal.id); }}
            />
          ))}

          {sinCategoria.length > 0 && (
            <div className={card}>
              <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
                <FolderTree size={16} className="text-muted" />
                <span className="text-sm font-bold text-fg">{t('dashboard.canales_v.uncategorized')}</span>
              </div>
              <div className="space-y-1.5 p-3">
                {sinCategoria.map((canal) => (
                  <CanalRow
                    key={canal.id} canal={canal}
                    onEditar={() => setEditandoCanal({ canal })}
                    onEliminar={async () => { if (window.confirm(t('dashboard.canales_v.confirmDeleteChannel', { name: canal.nombre }))) await eliminarCanalServidor(canal.id); }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {editandoCategoria && (
          <CategoriaModal
            categoria={editandoCategoria}
            roles={roles} catalogo={permisosCanalCatalogo}
            onClose={() => setEditandoCategoria(null)}
            onGuardar={async (datos) => {
              const ok = editandoCategoria.id ? await editarCategoriaCanal(editandoCategoria.id, datos) : await crearCategoriaCanal(datos);
              if (ok) setEditandoCategoria(null);
              return ok;
            }}
          />
        )}
        {editandoCanal && (
          <CanalModal
            estado={editandoCanal}
            categorias={categorias} roles={roles} catalogo={permisosCanalCatalogo}
            onClose={() => setEditandoCanal(null)}
            onGuardar={async (datos) => {
              const ok = editandoCanal.canal ? await editarCanalServidor(editandoCanal.canal.id, datos) : await crearCanalServidor(datos);
              if (ok) setEditandoCanal(null);
              return ok;
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Fila de categoría (desplegable con sus canales dentro) ---
function CategoriaRow({ categoria, index, onEditar, onEliminar, onAddCanal, onEditarCanal, onEliminarCanal }) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: index * 0.03 }}
      className={card}
    >
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => setAbierto((v) => !v)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
          <FolderTree size={16} className="shrink-0 text-brand" />
          <span className="truncate font-bold text-fg">{categoria.nombre}</span>
          <span className="ml-1 shrink-0 text-xs text-muted">{categoria.canales.length}</span>
        </button>
        <div className="flex shrink-0 gap-2">
          <button onClick={onAddCanal} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:text-fg" title={t('dashboard.canales_v.addChannel')}>
            <Plus size={15} />
          </button>
          <button onClick={onEditar} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:text-fg" title={t('dashboard.canales_v.edit')}>
            <Pencil size={15} />
          </button>
          <button onClick={onEliminar} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:border-danger/40 hover:text-danger" title={t('dashboard.canales_v.delete')}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {abierto && categoria.canales.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }} className="overflow-hidden"
          >
            <div className="space-y-1.5 border-t border-line p-3">
              {categoria.canales.map((canal) => (
                <CanalRow key={canal.id} canal={canal} onEditar={() => onEditarCanal(canal)} onEliminar={() => onEliminarCanal(canal)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Fila de un canal individual ---
function CanalRow({ canal, onEditar, onEliminar }) {
  const { t } = useTranslation();
  const Icono = ICONO_TIPO[canal.tipo] || Hash;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-bg px-3.5 py-2.5">
      <Icono size={15} className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate text-sm text-fg">{canal.nombre}</span>
      {canal.nsfw && <span className="shrink-0 rounded-md bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">NSFW</span>}
      <span className="shrink-0 text-xs text-muted">{t(`dashboard.canales_v.types.${canal.tipo}`)}</span>
      <button onClick={onEditar} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-fg" title={t('dashboard.canales_v.edit')}>
        <Pencil size={13} />
      </button>
      <button onClick={onEliminar} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-danger" title={t('dashboard.canales_v.delete')}>
        <X size={14} />
      </button>
    </div>
  );
}

// --- Editor de permisos por rol (overwrites), reutilizado en ambos modales ---
function EditorPermisos({ overwrites, setOverwrites, roles, catalogo }) {
  const { t } = useTranslation();
  const etiquetaPermiso = (flag) => t(`dashboard.roles_v.perms.${flag}`, flag);
  const [rolNuevo, setRolNuevo] = useState('');

  const disponibles = (roles || []).filter((r) => !overwrites.some((o) => o.id === r.id));

  const añadir = () => {
    if (!rolNuevo) return;
    const rol = roles.find((r) => r.id === rolNuevo);
    setOverwrites([...overwrites, { id: rolNuevo, nombre: rol?.nombre || rolNuevo, allow: [], deny: [] }]);
    setRolNuevo('');
  };

  const quitar = (id) => setOverwrites(overwrites.filter((o) => o.id !== id));

  // Ciclo: heredar -> permitir -> denegar -> heredar.
  const ciclar = (id, flag) => {
    setOverwrites(overwrites.map((o) => {
      if (o.id !== id) return o;
      const enAllow = o.allow.includes(flag);
      const enDeny = o.deny.includes(flag);
      if (enAllow) return { ...o, allow: o.allow.filter((f) => f !== flag), deny: [...o.deny, flag] };
      if (enDeny) return { ...o, deny: o.deny.filter((f) => f !== flag) };
      return { ...o, allow: [...o.allow, flag] };
    }));
  };

  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-muted">{t('dashboard.canales_v.fieldPerms')}</label>

      {overwrites.length === 0 && (
        <p className="mb-2 text-sm italic text-muted">{t('dashboard.canales_v.noOverwrites')}</p>
      )}

      <div className="space-y-3">
        {overwrites.map((o) => (
          <div key={o.id} className="rounded-2xl border border-line bg-bg p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-sm font-bold text-fg">{o.nombre}</span>
              <button onClick={() => quitar(o.id)} className="text-muted transition-colors hover:text-danger"><X size={15} /></button>
            </div>
            <div className="space-y-2.5">
              {(catalogo || []).map((grupo) => (
                <div key={grupo.grupo}>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{t(`dashboard.canales_v.groups.${grupo.grupo}`, grupo.grupo)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {grupo.permisos.map((flag) => {
                      const estado = o.allow.includes(flag) ? 'allow' : o.deny.includes(flag) ? 'deny' : 'neutral';
                      const estilos = {
                        allow: 'border-success/40 bg-success/10 text-success',
                        deny: 'border-danger/40 bg-danger/10 text-danger',
                        neutral: 'border-line text-muted',
                      };
                      const Icono = estado === 'allow' ? Check : estado === 'deny' ? X : Minus;
                      return (
                        <button
                          key={flag} onClick={() => ciclar(o.id, flag)}
                          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors ${estilos[estado]}`}
                          title={estado === 'allow' ? t('dashboard.canales_v.permAllow') : estado === 'deny' ? t('dashboard.canales_v.permDeny') : t('dashboard.canales_v.permNeutral')}
                        >
                          <Icono size={11} /> {etiquetaPermiso(flag)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {disponibles.length > 0 && (
        <div className="mt-3 flex gap-2">
          <select
            value={rolNuevo} onChange={(e) => setRolNuevo(e.target.value)}
            className="flex-1 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand"
          >
            <option value="">{t('dashboard.canales_v.pickRole')}</option>
            {disponibles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          <button onClick={añadir} disabled={!rolNuevo} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-40">
            {t('dashboard.canales_v.addOverwrite')}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Modal de crear / editar CATEGORÍA ---
function CategoriaModal({ categoria, roles, catalogo, onClose, onGuardar }) {
  const { t } = useTranslation();
  const editando = !!categoria.id;

  const [nombre, setNombre] = useState(categoria.nombre || '');
  const [estiloFuente, setEstiloFuente] = useState('normal');
  const [overwrites, setOverwrites] = useState((categoria.overwrites || []).filter((o) => o.tipo !== 'miembro'));
  const [guardando, setGuardando] = useState(false);

  const nombreFinal = aplicarEstilo(nombre.trim(), estiloFuente);

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    await onGuardar({ nombre: nombreFinal, overwrites: overwrites.map(({ id, allow, deny }) => ({ id, allow, deny })) });
    setGuardando(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }} onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-card p-6 shadow-soft"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-fg">{editando ? t('dashboard.canales_v.categoryModal.editTitle') : t('dashboard.canales_v.categoryModal.createTitle')}</h2>
          <button onClick={onClose} className="text-muted transition-colors hover:text-fg"><X size={20} /></button>
        </div>

        <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.canales_v.fieldName')}</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('dashboard.canales_v.fieldNamePh')} className="mb-4 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand" />

        <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.canales_v.fieldFont')}</label>
        <select value={estiloFuente} onChange={(e) => setEstiloFuente(e.target.value)} className="mb-2 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand">
          {ESTILOS_FUENTE.map((id) => <option key={id} value={id}>{t(`dashboard.roles_v.fonts.${id}`)} · {aplicarEstilo('Abc', id)}</option>)}
        </select>
        {estiloFuente !== 'normal' && nombre.trim() && (
          <p className="mb-4 text-sm text-muted">{t('dashboard.canales_v.fontPreview')}: <span className="font-semibold text-fg">{nombreFinal}</span></p>
        )}

        <div className="mb-2">
          <EditorPermisos overwrites={overwrites} setOverwrites={setOverwrites} roles={roles} catalogo={catalogo} />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-fg">{t('dashboard.canales_v.cancel')}</button>
          <button onClick={guardar} disabled={guardando || !nombre.trim()} className="rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {guardando ? t('dashboard.canales_v.saving') : t('dashboard.canales_v.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Modal de crear / editar CANAL ---
function CanalModal({ estado, categorias, roles, catalogo, onClose, onGuardar }) {
  const { t } = useTranslation();
  const canal = estado.canal || null;
  const editando = !!canal;

  const [tipo, setTipo] = useState(canal?.tipo || 'texto');
  const [nombre, setNombre] = useState(canal?.nombre || '');
  const [estiloFuente, setEstiloFuente] = useState('normal');
  const [categoriaId, setCategoriaId] = useState(canal?.categoriaId || estado.categoriaId || '');
  const [topic, setTopic] = useState(canal?.topic || '');
  const [nsfw, setNsfw] = useState(!!canal?.nsfw);
  const [slowmode, setSlowmode] = useState(canal?.slowmode || 0);
  const [bitrate, setBitrate] = useState(canal?.bitrate ? Math.round(canal.bitrate / 1000) : 64);
  const [userLimit, setUserLimit] = useState(canal?.userLimit || 0);
  const [overwrites, setOverwrites] = useState((canal?.overwrites || []).filter((o) => o.tipo !== 'miembro'));
  const [guardando, setGuardando] = useState(false);

  const esTexto = ['texto', 'anuncios', 'foro'].includes(tipo);
  const esVoz = ['voz', 'escenario'].includes(tipo);
  const nombreFinal = aplicarEstilo(nombre.trim(), estiloFuente);

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    const datos = {
      nombre: nombreFinal, categoriaId: categoriaId || null,
      overwrites: overwrites.map(({ id, allow, deny }) => ({ id, allow, deny })),
    };
    if (!editando) datos.tipo = tipo;
    if (esTexto) { datos.topic = topic; datos.nsfw = nsfw; datos.slowmode = slowmode; }
    if (esVoz) { datos.bitrate = bitrate * 1000; datos.userLimit = userLimit; }
    await onGuardar(datos);
    setGuardando(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }} onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-card p-6 shadow-soft"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-fg">{editando ? t('dashboard.canales_v.channelModal.editTitle') : t('dashboard.canales_v.channelModal.createTitle')}</h2>
          <button onClick={onClose} className="text-muted transition-colors hover:text-fg"><X size={20} /></button>
        </div>

        {!editando && (
          <>
            <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.canales_v.fieldType')}</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="mb-4 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand">
              {Object.keys(ICONO_TIPO).map((id) => <option key={id} value={id}>{t(`dashboard.canales_v.types.${id}`)}</option>)}
            </select>
          </>
        )}

        <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.canales_v.fieldName')}</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('dashboard.canales_v.fieldNamePh')} className="mb-4 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand" />

        <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.canales_v.fieldFont')}</label>
        <select value={estiloFuente} onChange={(e) => setEstiloFuente(e.target.value)} className="mb-2 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand">
          {ESTILOS_FUENTE.map((id) => <option key={id} value={id}>{t(`dashboard.roles_v.fonts.${id}`)} · {aplicarEstilo('Abc', id)}</option>)}
        </select>
        {estiloFuente !== 'normal' && nombre.trim() && (
          <p className="mb-4 text-sm text-muted">{t('dashboard.canales_v.fontPreview')}: <span className="font-semibold text-fg">{nombreFinal}</span></p>
        )}

        <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.canales_v.fieldCategory')}</label>
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="mb-4 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand">
          <option value="">{t('dashboard.canales_v.fieldNoCategory')}</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        {esTexto && (
          <>
            <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.canales_v.fieldTopic')}</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('dashboard.canales_v.fieldTopicPh')} className="mb-4 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand" />

            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-fg">{t('dashboard.canales_v.fieldNsfw')}</span>
              <Toggle checked={nsfw} onChange={() => setNsfw((v) => !v)} />
            </div>

            <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.canales_v.fieldSlowmode')}</label>
            <input type="number" min={0} max={21600} value={slowmode} onChange={(e) => setSlowmode(Math.max(0, parseInt(e.target.value, 10) || 0))} className="mb-4 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand" />
          </>
        )}

        {esVoz && (
          <>
            <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.canales_v.fieldBitrate')}</label>
            <input type="number" min={8} max={384} value={bitrate} onChange={(e) => setBitrate(Math.max(8, parseInt(e.target.value, 10) || 64))} className="mb-4 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand" />

            <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.canales_v.fieldUserLimit')}</label>
            <input type="number" min={0} max={99} value={userLimit} onChange={(e) => setUserLimit(Math.max(0, parseInt(e.target.value, 10) || 0))} className="mb-4 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand" />
          </>
        )}

        <div className="mb-2">
          <EditorPermisos overwrites={overwrites} setOverwrites={setOverwrites} roles={roles} catalogo={catalogo} />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-fg">{t('dashboard.canales_v.cancel')}</button>
          <button onClick={guardar} disabled={guardando || !nombre.trim()} className="rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {guardando ? t('dashboard.canales_v.saving') : t('dashboard.canales_v.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
