// Sidebar lateral persistente y colapsable — con tarjeta del SERVIDOR de Discord.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight, Home, LayoutDashboard, LogOut, Crown, X } from 'lucide-react';
import { navGroups } from './navConfig';
import { Avatar } from '../ui/primitives';
import { cn } from '../../lib/cn';
import { getStaffSession } from '../../lib/api';

const esOwner = !!getStaffSession()?.owner;

export default function Sidebar({ activeTab, setActiveTab, collapsed, setCollapsed, mobileOpen, setMobileOpen, onExitToLanding, servidorInfo, esPremium, onRequestUpgrade, servidores = [], guildId, setGuildId, permisos, moduleStatus = {}, onLogout }) {
  const { t } = useTranslation();
  const [openGroups, setOpenGroups] = useState({ tickets: true, logs: false, config: true });

  // Solo los grupos que el usuario puede ver (según su rol). Sin datos aún → todos.
  // Los grupos `owner` solo se muestran a los propietarios del bot (OWNER_IDS).
  const gruposVisibles = navGroups.filter((g) => (!g.owner || esOwner) && (!permisos || permisos[g.id] !== false));

  // Servidor seleccionado (de la lista) con fallback a la info del endpoint de uso.
  const seleccionado = servidores.find((s) => s.id === guildId);
  const nombreServidor = seleccionado?.nombre || servidorInfo?.nombre || 'Mi Servidor';
  const iconoServidor = seleccionado?.icono || servidorInfo?.icono;

  const toggleGroup = (id) => {
    if (collapsed) { setCollapsed(false); setOpenGroups((g) => ({ ...g, [id]: true })); return; }
    setOpenGroups((g) => ({ ...g, [id]: !g[id] }));
  };

  // Navegar a una sección también cierra el drawer en móvil (en escritorio
  // setMobileOpen no afecta nada, el sidebar ya es fijo ahí). Sin esto había
  // que cerrar el menú a mano después de cada toque — incómodo en móvil.
  const irA = (tab) => { setActiveTab(tab); setMobileOpen(false); };

  const inicioActivo = activeTab === 'inicio';

  return (
    <>
      {/* Fondo oscuro detrás del drawer (solo móvil) */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      <aside
        className={cn(
          // Móvil: drawer deslizable fijo a la izquierda.
          'fixed inset-y-0 left-0 z-50 flex h-screen w-[270px] flex-col bg-sidebar p-3 shadow-2xl',
          'transition-[transform,width] duration-300 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Escritorio (lg+): fijo en el layout, sin sombra, con colapso.
          'lg:relative lg:z-20 lg:translate-x-0 lg:shadow-none',
          collapsed ? 'lg:w-20' : 'lg:w-[270px]'
        )}
      >
      {/* Logo */}
      <div className="flex h-12 items-center gap-2.5 px-2">
        <img src="/assets/logo.jpg" alt="Sokyo" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        <AnimatePresence>
          {!collapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="whitespace-nowrap text-lg font-extrabold tracking-tight text-fg">
              Sokyo<span className="text-gradient-brand"> Bot</span>
            </motion.span>
          )}
        </AnimatePresence>

        {/* Cerrar drawer (solo móvil) */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-fg lg:hidden"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Botón de colapso (solo escritorio) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-30 hidden h-6 w-6 items-center justify-center rounded-full border border-line bg-card text-muted shadow-md transition-colors hover:text-fg lg:flex"
        aria-label="Collapse menu"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Tarjeta + SELECTOR del SERVIDOR */}
      <div data-tour="server" className={cn('mt-4 flex items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-soft', collapsed && 'justify-center px-0')}>
        <Avatar src={iconoServidor} name={nombreServidor} size={collapsed ? 36 : 42} />
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-w-0 flex-1">
              {servidores.length > 1 ? (
                <select
                  value={guildId || ''}
                  onChange={(e) => setGuildId(e.target.value)}
                  className="w-full truncate rounded-md border border-line bg-bg px-1.5 py-1 text-sm font-bold text-fg outline-none focus:ring-2 focus:ring-brand/40"
                >
                  {servidores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              ) : (
                <p className="truncate text-sm font-bold text-fg">{nombreServidor}</p>
              )}
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                {esOwner
                  ? <span className="flex items-center gap-1 font-bold text-amber-400"><Crown size={11} /> {t('dashboard.plan.owner')}</span>
                  : esPremium ? <><Crown size={11} className="text-amber-400" /> {t('dashboard.plan.premium')}</> : t('dashboard.plan.free')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Upsell: Subir a Pro (solo servidores Free, no propietario y con acceso
          a la sección de cuenta/facturación). */}
      {!esOwner && !esPremium && (!permisos || permisos.cuenta !== false) && (
        <button
          onClick={() => irA('cuenta-plan')}
          className={cn(
            'mt-3 flex items-center gap-2 rounded-2xl bg-gradient-brand px-3 py-2.5 text-on-brand shadow-soft transition-transform hover:scale-[1.02]',
            collapsed ? 'justify-center' : 'w-full'
          )}
          title={collapsed ? t('dashboard.plan.upgrade') : undefined}
        >
          <Crown size={collapsed ? 18 : 16} className="shrink-0" />
          {!collapsed && (
            <span className="min-w-0 text-left">
              <span className="block text-sm font-bold leading-tight">{t('dashboard.plan.upgrade')}</span>
              <span className="block text-[11px] font-medium opacity-90">{t('dashboard.plan.upgradeSub')}</span>
            </span>
          )}
        </button>
      )}

      {/* Navegación */}
      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto pr-1">
        {/* Inicio (standalone) */}
        <button
          onClick={() => irA('inicio')}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
            inicioActivo ? 'bg-gradient-brand text-on-brand shadow-md' : 'text-muted hover:bg-elevated hover:text-fg',
            collapsed && 'justify-center'
          )}
          title={collapsed ? t('dashboard.inicio') : undefined}
        >
          <LayoutDashboard size={19} className="shrink-0" />
          {!collapsed && <span>{t('dashboard.inicio')}</span>}
        </button>

        {gruposVisibles.map((group) => {
          const open = openGroups[group.id];
          const groupActive = group.items.some((it) => it.tab === activeTab);
          return (
            <div key={group.id}>
              <button
                data-tour={`nav-${group.id}`}
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  groupActive ? 'text-fg' : 'text-muted hover:bg-elevated hover:text-fg',
                  collapsed && 'justify-center'
                )}
                title={collapsed ? t(`dashboard.nav.groups.${group.id}`) : undefined}
              >
                <group.icon size={19} className={cn('shrink-0', groupActive && 'text-brand')} />
                {!collapsed && <span className="flex-1 text-left">{t(`dashboard.nav.groups.${group.id}`)}</span>}
                {!collapsed && <ChevronDown size={16} className={cn('transition-transform', open && 'rotate-180')} />}
              </button>

              <AnimatePresence initial={false}>
                {!collapsed && open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }} className="overflow-hidden"
                  >
                    <div className="mt-1 ml-4 flex flex-col gap-1 border-l border-line pl-3">
                      {group.items.map((item) => {
                        const active = activeTab === item.tab;
                        // Función de pago en un servidor Free (el propietario lo ve todo).
                        const locked = item.premium && !esPremium && !esOwner;
                        // Estado on/off del módulo (si es activable). undefined = no aplica.
                        const estado = Object.prototype.hasOwnProperty.call(moduleStatus, item.tab) ? moduleStatus[item.tab] : undefined;
                        return (
                          <button
                            key={item.tab}
                            onClick={() => (locked ? onRequestUpgrade?.(item.tab) : irA(item.tab))}
                            title={locked ? t('dashboard.plan.upgrade') : (estado === false ? t('dashboard.nav.moduleOff') : (estado === true ? t('dashboard.nav.moduleOn') : undefined))}
                            className={cn(
                              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                              active ? 'bg-gradient-brand font-semibold text-on-brand shadow-md' : 'text-muted hover:bg-elevated hover:text-fg'
                            )}
                          >
                            <item.icon size={16} className="shrink-0" />
                            <span className="flex-1 truncate text-left">{t(`dashboard.nav.items.${item.tab}`)}</span>
                            {estado !== undefined && (
                              <span
                                aria-hidden="true"
                                className={cn('h-2 w-2 shrink-0 rounded-full', estado
                                  ? (active ? 'bg-on-brand' : 'bg-success')
                                  : (active ? 'bg-on-brand/40 ring-1 ring-on-brand/60' : 'bg-line ring-1 ring-muted/40'))}
                              />
                            )}
                            {locked && <Crown size={13} className="shrink-0 text-amber-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Volver a la landing */}
      <button
        onClick={onExitToLanding}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg',
          collapsed && 'justify-center'
        )}
        title={collapsed ? t('dashboard.back') : undefined}
      >
        {collapsed ? <Home size={18} className="shrink-0" /> : <><Home size={18} className="shrink-0" /> <span>{t('dashboard.back')}</span></>}
      </button>

      {/* Cerrar sesión (solo si hay sesión de staff) */}
      {onLogout && (
        <button
          onClick={onLogout}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10',
            collapsed && 'justify-center'
          )}
          title={collapsed ? t('dashboard.auth.logout') : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>{t('dashboard.auth.logout')}</span>}
        </button>
      )}
      </aside>
    </>
  );
}
