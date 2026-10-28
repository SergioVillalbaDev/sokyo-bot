// Vista de Categorías y canales — crea/edita/elimina categorías y canales de
// texto, voz, anuncios, foro y escenario con todas las opciones de Discord
// (tema, NSFW, modo lento, bitrate, límite de usuarios, permisos por rol...).
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FolderTree, FolderPlus, Plus, Pencil, Trash2, X, ChevronDown,
  Hash, Volume2, Megaphone, MessagesSquare, Radio, Check, Minus, Search, Move, CheckCircle2, Info, Lock, ChevronsDownUp, ChevronsUpDown,
} from 'lucide-react';
import OrdenarCanales from './OrdenarCanales';
import { Toggle } from '../../ui/primitives';
import { ESTILOS_FUENTE, aplicarEstilo } from '../../../lib/fancyText';

const card = 'rounded-3xl border border-line bg-card shadow-soft';
const ICONO_TIPO = { texto: Hash, voz: Volume2, anuncios: Megaphone, foro: MessagesSquare, escenario: Radio };
const COLOR_DEFECTO = '#99AAB5';
// Tipos que Discord solo deja crear en servidores con la Comunidad activada.
const SOLO_COMUNIDAD = new Set(['anuncios', 'escenario']);
const colorVisible = (c) => (!c || c === '#000000' ? COLOR_DEFECTO : c);

export default function CanalesView({ dash }) {
  const { t } = useTranslation();
  const {
    estructuraCanales, permisosCanalCatalogo, roles,
    crearCategoriaCanal, editarCategoriaCanal, eliminarCategoriaCanal,
    crearCanalServidor, editarCanalServidor, eliminarCanalServidor, reordenarCanales,
  } = dash;
  // Modo "Mover y ordenar" (arrastrar y soltar) y aviso tras guardar algo:
  // { tipo: 'ok' | 'info', texto }.
  // false = lista normal · { foco, compacto } = modo ordenar (foco: categoría a
  // la que llevar la vista; compacto: solo las categorías, sin sus canales).
  const [ordenando, setOrdenando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const avisar = (tipo, texto) => { setAviso({ tipo, texto }); setTimeout(() => setAviso((a) => (a?.texto === texto ? null : a)), tipo === 'ok' ? 3500 : 9000); };
  // Tras guardar en un modal: se cierra y se cuenta qué ha pasado (o el error se
  // queda en el modal para corregir y reintentar).
  const trasGuardar = (r, cerrar) => {
    if (!r.ok) return mensajeDeError(r);
    cerrar();
    if (r.aviso === 'limite_nombre') avisar('info', t('dashboard.canales_v.renameLimit', { min: r.minutos }));
    else if (r.aviso === 'en_cola') avisar('info', t('dashboard.canales_v.saveQueued'));
    else avisar('ok', t('dashboard.canales_v.savedOk'));
    return null;
  };

  // Qué ha fallado, con lo que hay que hacer (lo dice la API en `codigo`).
  const nombrePermiso = (flag) => t(`dashboard.canales_v.perms.${flag}`, { defaultValue: t(`dashboard.roles_v.perms.${flag}`, flag) });
  const mensajeDeError = ({ error, codigo, canales: nombres = [], permisos = [], detalle = '' }) => {
    const c = (k, extra) => t(`dashboard.canales_v.${k}`, extra);
    const lista = (xs) => xs.map((x) => `«${x}»`).join(', ');
    if (error === 'tiempo') return c('saveTimeout');
    if (codigo === 'requiere_comunidad') return c('errCommunity');
    if (codigo === 'sin_permiso_servidor') return c('orderNoPermServer');
    if (codigo === 'sin_permiso' && nombres.length) return c('errPermChannels', { lista: lista(nombres) });
    if (codigo === 'sin_permiso') return c('orderNoPerm');
    if (codigo === 'permisos_bot') return c('errPermBot', { lista: lista(permisos.map(nombrePermiso)) });
    if (codigo === 'max_canales') return c('errMax');
    if (codigo === 'limite') return c('orderRateLimit');
    if (codigo === 'discord' && detalle) return c('errDiscord', { detalle });
    return c('saveError');
  };

  const { categorias = [], sinCategoria = [], comunidad = true, permisosBot = null } = estructuraCanales || {};
  // Categorías plegadas en la lista (para ver muchas de un vistazo).
  const [plegadas, setPlegadas] = useState(() => new Set());
  const todasPlegadas = categorias.length > 0 && categorias.every((c) => plegadas.has(c.id));
  const alternarPlegada = (id) => setPlegadas((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Modal de categoría: null = cerrado · {} = creando · {categoria} = editando.
  const [editandoCategoria, setEditandoCategoria] = useState(null);
  // Modal de canal: null = cerrado · {categoriaId} = creando dentro de esa categoría · {canal} = editando.
  const [editandoCanal, setEditandoCanal] = useState(null);

  if (ordenando) {
    return (
      <OrdenarCanales
        estructura={estructuraCanales || { categorias: [], sinCategoria: [] }}
        foco={ordenando.foco || null} compactoInicial={!!ordenando.compacto}
        onGuardar={reordenarCanales}
        onCerrar={(r) => {
          setOrdenando(false);
          if (!r) return;
          // Canales que ya no existían (una sala de voz temporal, un ticket borrado…): se saltaron.
          const saltados = r.ignorados ? ` ${t('dashboard.canales_v.orderSkipped', { count: r.ignorados })}` : '';
          if (r.aviso === 'en_cola') avisar('info', t('dashboard.canales_v.orderQueued') + saltados);
          else avisar(saltados ? 'info' : 'ok', t('dashboard.canales_v.orderSaved') + saltados);
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.canales_v.intro')}</p>
      {/* Siempre a la vista al bajar por la lista: no hay que volver arriba para mover o crear. */}
      <div className="sk-flotante sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-line px-3 py-2.5 shadow-lg">
        {categorias.length > 0 && (
          <button
            onClick={() => setPlegadas(todasPlegadas ? new Set() : new Set(categorias.map((c) => c.id)))}
            className="flex items-center gap-2 rounded-2xl border border-line px-3.5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-brand"
          >
            {todasPlegadas ? <ChevronsUpDown size={16} /> : <ChevronsDownUp size={16} />}
            <span className="hidden sm:inline">{t(todasPlegadas ? 'dashboard.canales_v.expandAll' : 'dashboard.canales_v.collapseAll')}</span>
          </button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => setOrdenando({})}
            disabled={categorias.length === 0 && sinCategoria.length === 0}
            className="flex items-center gap-2 rounded-2xl border border-brand/40 bg-brand/10 px-4 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand disabled:opacity-40"
          >
            <Move size={16} className="text-brand" /> {t('dashboard.canales_v.reorder')}
          </button>
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

      <AnimatePresence>
        {aviso && (
          <motion.p
            key={aviso.texto} role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={aviso.tipo === 'ok'
              ? 'flex items-center gap-2 rounded-2xl border border-success/40 bg-success/10 px-4 py-2.5 text-sm font-semibold text-success'
              : 'flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm font-medium text-fg'}
          >
            {aviso.tipo === 'ok' ? <CheckCircle2 size={16} /> : <Info size={16} className="mt-0.5 shrink-0 text-amber-400" />} {aviso.texto}
          </motion.p>
        )}
      </AnimatePresence>

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
              abierto={!plegadas.has(cat.id)} onAlternar={() => alternarPlegada(cat.id)}
              onMover={() => setOrdenando({ foco: cat.id, compacto: true })}
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
            roles={roles} catalogo={permisosCanalCatalogo} permisosBot={permisosBot}
            onClose={() => setEditandoCategoria(null)}
            onGuardar={async (datos) => trasGuardar(
              editandoCategoria.id ? await editarCategoriaCanal(editandoCategoria.id, datos) : await crearCategoriaCanal(datos),
              () => setEditandoCategoria(null),
            )}
          />
        )}
        {editandoCanal && (
          <CanalModal
            estado={editandoCanal}
            categorias={categorias} roles={roles} catalogo={permisosCanalCatalogo} permisosBot={permisosBot} comunidad={comunidad}
            onClose={() => setEditandoCanal(null)}
            onGuardar={async (datos) => trasGuardar(
              editandoCanal.canal ? await editarCanalServidor(editandoCanal.canal.id, datos) : await crearCanalServidor(datos),
              () => setEditandoCanal(null),
            )}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Fila de categoría (desplegable con sus canales dentro) ---
function CategoriaRow({ categoria, index, abierto, onAlternar, onMover, onEditar, onEliminar, onAddCanal, onEditarCanal, onEliminarCanal }) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: index * 0.03 }}
      className={card}
    >
      <div className="flex items-center gap-3 p-4">
        <button onClick={onAlternar} aria-expanded={abierto} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
          <FolderTree size={16} className="shrink-0 text-brand" />
          <span className="truncate font-bold text-fg">{categoria.nombre}</span>
          <span className="ml-1 shrink-0 text-xs text-muted">{categoria.canales.length}</span>
        </button>
        <div className="flex shrink-0 gap-2">
          <button onClick={onMover} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:border-brand hover:text-brand" title={t('dashboard.canales_v.moveThis')} aria-label={t('dashboard.canales_v.moveThis')}>
            <Move size={15} />
          </button>
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
// `permisosBot`: los que el bot puede dar (null = no se sabe, se deja todo).
function EditorPermisos({ overwrites, setOverwrites, roles, catalogo, permisosBot }) {
  const { t } = useTranslation();
  const etiquetaPermiso = (flag) => t(`dashboard.canales_v.perms.${flag}`, { defaultValue: t(`dashboard.roles_v.perms.${flag}`, flag) });
  const bloqueado = (flag) => Array.isArray(permisosBot) && !permisosBot.includes(flag);
  const [busqueda, setBusqueda] = useState('');

  const colorDe = (id) => colorVisible((roles || []).find((r) => r.id === id)?.color);

  const disponibles = (roles || [])
    .filter((r) => !overwrites.some((o) => o.id === r.id))
    .filter((r) => !busqueda.trim() || r.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  // Clic directo en un rol de la lista: se añade al instante (sin desplegable ni botón aparte).
  const añadir = (rolId) => {
    const rol = roles.find((r) => r.id === rolId);
    setOverwrites([...overwrites, { id: rolId, nombre: rol?.nombre || rolId, allow: [], deny: [] }]);
  };

  const quitar = (id) => setOverwrites(overwrites.filter((o) => o.id !== id));

  // Ciclo: heredar -> permitir -> denegar -> heredar. Uno que el bot no tiene solo
  // se puede quitar (Discord no le deja darlo).
  const ciclar = (id, flag) => {
    setOverwrites(overwrites.map((o) => {
      if (o.id !== id) return o;
      const enAllow = o.allow.includes(flag);
      const enDeny = o.deny.includes(flag);
      if (bloqueado(flag)) return { ...o, allow: o.allow.filter((f) => f !== flag), deny: o.deny.filter((f) => f !== flag) };
      if (enAllow) return { ...o, allow: o.allow.filter((f) => f !== flag), deny: [...o.deny, flag] };
      if (enDeny) return { ...o, deny: o.deny.filter((f) => f !== flag) };
      return { ...o, allow: [...o.allow, flag] };
    }));
  };

  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-muted">{t('dashboard.canales_v.fieldPerms')}</label>

      {overwrites.length === 0 ? (
        <p className="mb-2 text-sm italic text-muted">{t('dashboard.canales_v.noOverwrites')}</p>
      ) : (
        <p className="mb-2 text-xs text-muted">{t('dashboard.canales_v.permsHelp')}</p>
      )}

      <div className="space-y-3">
        {overwrites.map((o) => (
          <div key={o.id} className="rounded-2xl border border-line bg-bg p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-fg">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorDe(o.id) }} />
                {o.nombre}
              </span>
              <button onClick={() => quitar(o.id)} className="text-muted transition-colors hover:text-danger"><X size={15} /></button>
            </div>
            <div className="space-y-2.5">
              {(catalogo || []).map((grupo) => (
                <div key={grupo.grupo}>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{t(`dashboard.canales_v.groups.${grupo.grupo}`, grupo.grupo)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {grupo.permisos.map((flag) => {
                      const estado = o.allow.includes(flag) ? 'allow' : o.deny.includes(flag) ? 'deny' : 'neutral';
                      const sinPermiso = bloqueado(flag);
                      const desc = t(`dashboard.roles_v.permsDesc.${flag}`, '');
                      const titulo = sinPermiso ? t('dashboard.canales_v.permLocked') : `${estado === 'allow' ? t('dashboard.canales_v.permAllow') : estado === 'deny' ? t('dashboard.canales_v.permDeny') : t('dashboard.canales_v.permNeutral')}${desc ? ` · ${desc}` : ''}`;
                      const estilos = {
                        allow: 'border-success/40 bg-success/10 text-success',
                        deny: 'border-danger/40 bg-danger/10 text-danger',
                        neutral: 'border-line text-muted',
                      };
                      const Icono = sinPermiso && estado === 'neutral' ? Lock : estado === 'allow' ? Check : estado === 'deny' ? X : Minus;
                      return (
                        <button
                          key={flag} type="button" onClick={() => ciclar(o.id, flag)}
                          disabled={sinPermiso && estado === 'neutral'}
                          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${estilos[estado]}`}
                          title={titulo} aria-label={`${etiquetaPermiso(flag)}: ${titulo}`}
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

      {(roles || []).length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-muted">{t('dashboard.canales_v.addOverwrite')}</p>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder={t('dashboard.canales_v.searchRolePlaceholder')}
              className="w-full rounded-xl border border-line bg-bg py-2.5 pl-9 pr-3 text-sm text-fg outline-none focus:border-brand"
            />
          </div>
          <div className="mt-2 max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-line p-1.5">
            {disponibles.length === 0 ? (
              <p className="px-2.5 py-2 text-xs italic text-muted">{t('dashboard.canales_v.noMoreRoles')}</p>
            ) : disponibles.map((r) => (
              <button
                key={r.id} onClick={() => añadir(r.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-elevated"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorVisible(r.color) }} />
                <span className="min-w-0 flex-1 truncate text-fg">{r.nombre}</span>
                {typeof r.miembros === 'number' && (
                  <span className="shrink-0 text-xs text-muted">{t('dashboard.roles_v.memberCount', { count: r.miembros })}</span>
                )}
                <Plus size={14} className="shrink-0 text-muted" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Modal de crear / editar CATEGORÍA ---
function CategoriaModal({ categoria, roles, catalogo, permisosBot, onClose, onGuardar }) {
  const { t } = useTranslation();
  const editando = !!categoria.id;

  const [nombre, setNombre] = useState(categoria.nombre || '');
  const [estiloFuente, setEstiloFuente] = useState('normal');
  const [overwrites, setOverwrites] = useState((categoria.overwrites || []).filter((o) => o.tipo !== 'miembro'));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const nombreFinal = aplicarEstilo(nombre.trim(), estiloFuente);

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true); setError(null);
    const fallo = await onGuardar({ nombre: nombreFinal, overwrites: overwrites.map(({ id, allow, deny }) => ({ id, allow, deny })) });
    setGuardando(false);
    if (fallo) setError(fallo);
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
          <EditorPermisos overwrites={overwrites} setOverwrites={setOverwrites} roles={roles} catalogo={catalogo} permisosBot={permisosBot} />
        </div>

        {error && <p role="alert" className="mt-5 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>}
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
function CanalModal({ estado, categorias, roles, catalogo, permisosBot, comunidad = true, onClose, onGuardar }) {
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
  const [error, setError] = useState(null);

  const esTexto = ['texto', 'anuncios', 'foro'].includes(tipo);
  const conModoLento = tipo !== 'anuncios'; // Discord no lo admite en los de anuncios
  const faltaComunidad = !editando && !comunidad && SOLO_COMUNIDAD.has(tipo);
  const esVoz = ['voz', 'escenario'].includes(tipo);
  const nombreFinal = aplicarEstilo(nombre.trim(), estiloFuente);

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true); setError(null);
    const datos = {
      nombre: nombreFinal, categoriaId: categoriaId || null,
      overwrites: overwrites.map(({ id, allow, deny }) => ({ id, allow, deny })),
    };
    if (!editando) datos.tipo = tipo;
    if (esTexto) { datos.topic = topic; datos.nsfw = nsfw; if (conModoLento) datos.slowmode = slowmode; }
    if (esVoz) { datos.bitrate = bitrate * 1000; datos.userLimit = userLimit; }
    const fallo = await onGuardar(datos);
    setGuardando(false);
    if (fallo) setError(fallo);
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
              {Object.keys(ICONO_TIPO).map((id) => (
                <option key={id} value={id} disabled={!comunidad && SOLO_COMUNIDAD.has(id)}>
                  {t(`dashboard.canales_v.types.${id}`)}{!comunidad && SOLO_COMUNIDAD.has(id) ? ` (${t('dashboard.canales_v.needsCommunity')})` : ''}
                </option>
              ))}
            </select>
            {!comunidad && (
              <p className="-mt-2 mb-4 flex items-start gap-2 text-xs text-muted"><Info size={14} className="mt-px shrink-0 text-brand" /> {t('dashboard.canales_v.communityNote')}</p>
            )}
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

            {conModoLento && (
              <>
                <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.canales_v.fieldSlowmode')}</label>
                <input type="number" min={0} max={21600} value={slowmode} onChange={(e) => setSlowmode(Math.max(0, parseInt(e.target.value, 10) || 0))} className="mb-4 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand" />
              </>
            )}
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
          <EditorPermisos overwrites={overwrites} setOverwrites={setOverwrites} roles={roles} catalogo={catalogo} permisosBot={permisosBot} />
        </div>

        {error && <p role="alert" className="mt-5 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-fg">{t('dashboard.canales_v.cancel')}</button>
          <button onClick={guardar} disabled={guardando || !nombre.trim() || faltaComunidad} className="rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {guardando ? t('dashboard.canales_v.saving') : t('dashboard.canales_v.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
