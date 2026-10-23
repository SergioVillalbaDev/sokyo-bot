// Vista de Roles y permisos — panel mejorado para crear/editar/repartir roles
// de Discord sin pelearse con la interfaz nativa.
//
// Diseño: lista VERTICAL (una fila por rol). Cada fila es un desplegable que
// muestra los permisos y los miembros que tienen el rol, con buscador para
// asignar nuevos y botón para quitárselo a cada uno.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { UsersRound, Plus, Pencil, Trash2, X, Lock, ChevronDown, Search, UserPlus, Loader2, ShieldAlert, Globe, MessageSquare, Volume2, Wrench, Info } from 'lucide-react';
import { Card, Badge, Avatar, Toggle } from '../../ui/primitives';
import { ESTILOS_FUENTE, aplicarEstilo } from '../../../lib/fancyText';

const card = 'rounded-3xl border border-line bg-card shadow-soft';
const COLOR_DEFECTO = '#99AAB5';
const colorVisible = (c) => (!c || c === '#000000' ? COLOR_DEFECTO : c);

// Permisos "sensibles" que conviene resaltar (en color de aviso).
const PERMISOS_CLAVE = new Set([
  'Administrator', 'BanMembers', 'KickMembers', 'ModerateMembers',
  'ManageGuild', 'ManageRoles', 'ManageChannels', 'ManageMessages', 'ManageWebhooks', 'MentionEveryone',
]);

// Categorías de permisos (en orden de aparición). Cada una con su icono y los
// flags que contiene. Lo que no esté en ninguna lista cae en "avanzado".
const CATEGORIAS = [
  { id: 'moderacion', icon: ShieldAlert, flags: ['KickMembers', 'BanMembers', 'ModerateMembers', 'ManageNicknames', 'ManageRoles'] },
  { id: 'general', icon: Globe, flags: ['ViewChannel', 'CreateInstantInvite', 'ChangeNickname', 'AddReactions'] },
  { id: 'texto', icon: MessageSquare, flags: ['SendMessages', 'SendTTSMessages', 'ManageMessages', 'EmbedLinks', 'AttachFiles', 'ReadMessageHistory', 'MentionEveryone', 'UseExternalEmojis', 'UseExternalStickers', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads', 'ManageThreads', 'UseApplicationCommands', 'SendPolls', 'UseExternalApps'] },
  { id: 'voz', icon: Volume2, flags: ['Connect', 'Speak', 'Stream', 'MuteMembers', 'DeafenMembers', 'MoveMembers', 'UseVAD', 'PrioritySpeaker', 'RequestToSpeak', 'UseSoundboard', 'UseExternalSounds', 'UseEmbeddedActivities'] },
];
// Índice flag -> categoría, para clasificar rápido.
const CAT_DE_FLAG = new Map(CATEGORIAS.flatMap((c) => c.flags.map((f) => [f, c.id])));

// Convierte un flag en texto legible si no hay traducción ("BanMembers" → "Ban Members").
const humanizar = (flag) => flag.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

export default function RolesView({ dash }) {
  const { t } = useTranslation();
  const { rolesDetalle, permisosCatalogo, crearRol, editarRol } = dash;

  // El modal: null = cerrado · {} = creando · {rol} = editando ese rol.
  const [editando, setEditando] = useState(null);

  // ¿Hay roles que el bot no puede gestionar? (están por encima en la jerarquía)
  const hayBloqueados = rolesDetalle.some((r) => !r.gestionable);

  return (
    <div className="space-y-5">
      {/* Cabecera con el botón de crear */}
      <div data-help="roles-crear" className="flex items-center justify-between">
        <p className="text-sm text-muted">{t('dashboard.roles_v.intro')}</p>
        <button
          onClick={() => setEditando({})}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-4 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> {t('dashboard.roles_v.create')}
        </button>
      </div>

      {/* Aviso de jerarquía si hay roles bloqueados */}
      {hayBloqueados && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
          <Info size={16} className="mt-0.5 shrink-0 text-brand" />
          <p className="text-xs text-muted">{t('dashboard.roles_v.hierarchyHint')}</p>
        </div>
      )}

      {/* Lista vertical de roles */}
      {rolesDetalle.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-2 p-12 text-center`}>
          <UsersRound size={32} className="text-muted" />
          <p className="text-sm italic text-muted">{t('dashboard.roles_v.empty')}</p>
        </div>
      ) : (
        <div data-help="roles-lista" className="space-y-3">
          {rolesDetalle.map((rol, i) => (
            <RolRow key={rol.id} rol={rol} index={i} dash={dash} onEditar={() => setEditando(rol)} />
          ))}
        </div>
      )}

      {/* Modal de crear / editar */}
      <AnimatePresence>
        {editando && (
          <RolModal
            rol={editando}
            catalogo={permisosCatalogo}
            onClose={() => setEditando(null)}
            onGuardar={async (datos) => {
              const ok = editando.id ? await editarRol(editando.id, datos) : await crearRol(datos);
              if (ok) setEditando(null);
              return ok;
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Una fila de rol (desplegable con permisos + miembros) ---
function RolRow({ rol, index, dash, onEditar }) {
  const { t } = useTranslation();
  const { listarMiembrosRol, buscarMiembros, asignarRolMiembro, quitarRolMiembro, eliminarRol } = dash;

  const [abierto, setAbierto] = useState(false);
  const [miembros, setMiembros] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Buscador para asignar
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  const etiquetaPermiso = (flag) => t(`dashboard.roles_v.perms.${flag}`, humanizar(flag));

  // Abre/cierra la fila; al abrir por primera vez carga los miembros.
  const alternar = async () => {
    const nuevo = !abierto;
    setAbierto(nuevo);
    if (nuevo) {
      setCargando(true);
      setMiembros(await listarMiembrosRol(rol.id));
      setCargando(false);
    }
  };

  const refrescarMiembros = async () => setMiembros(await listarMiembrosRol(rol.id));

  // Busca miembros. Con la caja vacía muestra los primeros (el backend devuelve
  // los primeros 10), así al enfocar ya ves una lista sin escribir nada.
  const onBuscar = async (q) => {
    setBusqueda(q);
    setBuscando(true);
    const encontrados = await buscarMiembros(q);
    // Ocultamos a los que ya tienen el rol.
    const yaTienen = new Set(miembros.map((m) => m.id));
    setResultados(encontrados.filter((m) => !yaTienen.has(m.id)));
    setBuscando(false);
  };

  const asignar = async (userId) => {
    if (await asignarRolMiembro(rol.id, userId)) {
      setBusqueda(''); setResultados([]);
      await refrescarMiembros();
    }
  };

  const quitar = async (userId) => {
    if (await quitarRolMiembro(rol.id, userId)) await refrescarMiembros();
  };

  const color = colorVisible(rol.color);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: index * 0.03 }}
      className={card}
      style={{ borderLeft: `5px solid ${color}` }}
    >
      {/* Cabecera de la fila (clic = desplegar) */}
      <div className="flex items-center gap-3 p-4">
        <button onClick={alternar} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
          <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: color }} />
          <span className="truncate font-bold text-fg">{rol.nombre}</span>
          {!rol.gestionable && <Lock size={13} className="shrink-0 text-muted" title={t('dashboard.roles_v.locked')} />}
          <span className="ml-1 shrink-0 text-xs text-muted">
            {t('dashboard.roles_v.memberCount', { count: rol.miembros })}
            {rol.permisos.length > 0 && ` · ${t('dashboard.roles_v.permCount', { count: rol.permisos.length })}`}
          </span>
        </button>

        <div className="flex shrink-0 gap-2">
          <button
            onClick={onEditar}
            disabled={!rol.gestionable}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
            title={t('dashboard.roles_v.edit')}
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={async () => { if (window.confirm(t('dashboard.roles_v.confirmDelete', { name: rol.nombre }))) await eliminarRol(rol.id); }}
            disabled={!rol.gestionable}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
            title={t('dashboard.roles_v.delete')}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Contenido desplegable */}
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-line p-4">
              {/* Permisos del rol */}
              <PermisosLista permisos={rol.permisos} etiquetaPermiso={etiquetaPermiso} />

              {/* Buscador para asignar el rol a un miembro */}
              {rol.gestionable && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.roles_v.assignTitle')}</p>
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      value={busqueda}
                      onChange={(e) => onBuscar(e.target.value)}
                      onFocus={() => { if (resultados.length === 0) onBuscar(busqueda); }}
                      placeholder={t('dashboard.roles_v.searchPlaceholder')}
                      className="w-full rounded-xl border border-line bg-bg py-2.5 pl-9 pr-3 text-sm text-fg outline-none focus:border-brand"
                    />
                    {buscando && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted" />}
                  </div>
                  {resultados.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {resultados.map((m) => (
                        <div key={m.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-bg px-3 py-2">
                          <Avatar src={m.avatar} name={m.displayName} size={28} />
                          <span className="min-w-0 flex-1 truncate text-sm text-fg">{m.displayName}</span>
                          <button
                            onClick={() => asignar(m.id)}
                            className="flex items-center gap-1 rounded-lg bg-gradient-brand px-2.5 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                          >
                            <UserPlus size={13} /> {t('dashboard.roles_v.assign')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Miembros que tienen el rol */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.roles_v.membersTitle')}</p>
                {cargando ? (
                  <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" /> {t('dashboard.roles_v.loading')}</p>
                ) : miembros.length === 0 ? (
                  <p className="text-sm italic text-muted">{t('dashboard.roles_v.noMembers')}</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {miembros.map((m) => (
                      <div key={m.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-bg px-3 py-2">
                        <Avatar src={m.avatar} name={m.displayName} size={28} />
                        <span className="min-w-0 flex-1 truncate text-sm text-fg">{m.displayName}</span>
                        {rol.gestionable && (
                          <button
                            onClick={() => quitar(m.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-danger/40 hover:text-danger"
                            title={t('dashboard.roles_v.removeMember')}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Lista de permisos de un rol (agrupada por categoría) ---
// · Sin permisos → texto suave.
// · Con Administrador → banner único de "acceso total" (no listamos los 40).
// · Resto → un bloque por categoría (Moderación / General / Texto / Voz / Avanzado).
function PermisosLista({ permisos, etiquetaPermiso }) {
  const { t } = useTranslation();

  if (permisos.length === 0) {
    return (
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.roles_v.fieldPerms')}</p>
        <p className="text-sm italic text-muted">{t('dashboard.roles_v.noPerms')}</p>
      </div>
    );
  }

  // Administrador lo concede todo: lo mostramos como un único banner.
  if (permisos.includes('Administrator')) {
    return (
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.roles_v.fieldPerms')}</p>
        <div className="flex items-center gap-2.5 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3">
          <ShieldAlert size={18} className="shrink-0 text-warning" />
          <div>
            <p className="text-sm font-bold text-warning">{t('dashboard.roles_v.adminFull')}</p>
            <p className="text-xs text-warning/80">{t('dashboard.roles_v.adminFullDesc')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Repartimos cada permiso en su categoría (lo no clasificado → "avanzado").
  const porCategoria = { moderacion: [], general: [], texto: [], voz: [], avanzado: [] };
  permisos.forEach((flag) => porCategoria[CAT_DE_FLAG.get(flag) || 'avanzado'].push(flag));

  // Bloques a pintar: las 4 categorías conocidas + "avanzado", solo si tienen algo.
  const bloques = [
    ...CATEGORIAS.map((c) => ({ id: c.id, icon: c.icon, flags: porCategoria[c.id] })),
    { id: 'avanzado', icon: Wrench, flags: porCategoria.avanzado },
  ].filter((b) => b.flags.length > 0);

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.roles_v.fieldPerms')}</p>
      <div className="space-y-2">
        {bloques.map((b) => (
          <CategoriaBloque key={b.id} bloque={b} etiquetaPermiso={etiquetaPermiso} />
        ))}
      </div>
    </div>
  );
}

// --- Un bloque de categoría de permisos (colapsable) ---
// "Avanzado" arranca colapsado; el resto, abierto.
function CategoriaBloque({ bloque, etiquetaPermiso }) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(bloque.id !== 'avanzado');
  const Icono = bloque.icon;

  return (
    <div className="rounded-2xl border border-line bg-bg">
      <button onClick={() => setAbierto((v) => !v)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left">
        <Icono size={15} className="shrink-0 text-brand" />
        <span className="flex-1 text-sm font-semibold text-fg">{t(`dashboard.roles_v.cats.${bloque.id}`, bloque.id)}</span>
        <span className="text-xs text-muted">{bloque.flags.length}</span>
        <ChevronDown size={15} className={`text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 px-3.5 pb-3.5">
              {bloque.flags.map((flag) => (
                <Badge key={flag} color={PERMISOS_CLAVE.has(flag) ? 'var(--warning)' : undefined}>{etiquetaPermiso(flag)}</Badge>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Modal (formulario) de creación / edición de un rol ---
function RolModal({ rol, catalogo, onClose, onGuardar }) {
  const { t } = useTranslation();
  const editando = !!rol.id;

  const [nombre, setNombre] = useState(rol.nombre || '');
  const [estiloFuente, setEstiloFuente] = useState('normal');
  const [color, setColor] = useState(colorVisible(rol.color));
  const [permisos, setPermisos] = useState(new Set(rol.permisos || []));
  const [guardando, setGuardando] = useState(false);

  const etiquetaPermiso = (flag) => t(`dashboard.roles_v.perms.${flag}`, humanizar(flag));

  const togglePermiso = (flag) => {
    const next = new Set(permisos);
    next.has(flag) ? next.delete(flag) : next.add(flag);
    setPermisos(next);
  };

  // El nombre final lleva aplicado el estilo de fuente elegido.
  const nombreFinal = aplicarEstilo(nombre.trim(), estiloFuente);

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    await onGuardar({ nombre: nombreFinal, color, permisos: [...permisos] });
    setGuardando(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-card p-6 shadow-soft"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-fg">
            {editando ? t('dashboard.roles_v.editTitle') : t('dashboard.roles_v.createTitle')}
          </h2>
          <button onClick={onClose} className="text-muted transition-colors hover:text-fg"><X size={20} /></button>
        </div>

        {/* Nombre */}
        <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.roles_v.fieldName')}</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={t('dashboard.roles_v.fieldNamePh')}
          className="mb-4 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand"
        />

        {/* Estilo de fuente (caracteres Unicode) */}
        <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.roles_v.fieldFont')}</label>
        <select
          value={estiloFuente}
          onChange={(e) => setEstiloFuente(e.target.value)}
          className="mb-2 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand"
        >
          {ESTILOS_FUENTE.map((id) => (
            <option key={id} value={id}>{t(`dashboard.roles_v.fonts.${id}`)} · {aplicarEstilo('Abc', id)}</option>
          ))}
        </select>
        {estiloFuente !== 'normal' && nombre.trim() && (
          <p className="mb-4 text-sm text-muted">{t('dashboard.roles_v.fontPreview')}: <span className="font-semibold text-fg">{nombreFinal}</span></p>
        )}

        {/* Color */}
        <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.roles_v.fieldColor')}</label>
        <div className="mb-5 flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-bg"
          />
          <span className="rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-sm text-fg">{color}</span>
        </div>

        {/* Permisos agrupados */}
        <label className="mb-2 block text-xs font-semibold text-muted">{t('dashboard.roles_v.fieldPerms')}</label>
        <div className="space-y-4">
          {catalogo.map((grupo) => (
            <Card key={grupo.grupo} className="p-3.5">
              <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted">{t(`dashboard.roles_v.groups.${grupo.grupo}`, grupo.grupo)}</p>
              <div className="space-y-2.5">
                {grupo.permisos.map((flag) => (
                  <div key={flag} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-fg">{etiquetaPermiso(flag)}</span>
                    <Toggle checked={permisos.has(flag)} onChange={() => togglePermiso(flag)} />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Aviso si Administrador está activo */}
        {permisos.has('Administrator') && (
          <p className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            {t('dashboard.roles_v.adminWarning')}
          </p>
        )}

        {/* Acciones */}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-fg">
            {t('dashboard.roles_v.cancel')}
          </button>
          <button
            onClick={guardar}
            disabled={guardando || !nombre.trim()}
            className="rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? t('dashboard.roles_v.saving') : t('dashboard.roles_v.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
