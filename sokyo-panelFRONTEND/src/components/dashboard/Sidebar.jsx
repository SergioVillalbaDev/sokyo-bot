// Sidebar lateral persistente y colapsable — con tarjeta del SERVIDOR de Discord.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight, Home, LayoutDashboard, LogOut, Crown } from 'lucide-react';
import { navGroups } from './navConfig';
import { Avatar } from '../ui/primitives';
import { cn } from '../../lib/cn';
import { getStaffSession } from '../../lib/api';

const esOwner = !!getStaffSession()?.owner;

export default function Sidebar({ activeTab, setActiveTab, collapsed, setCollapsed, onExitToLanding, servidorInfo, esPremium, servidores = [], guildId, setGuildId, permisos, onLogout }) {
  const { t } = useTranslation();
  const [openGroups, setOpenGroups] = useState({ tickets: true, logs: false, config: true });

  // Solo los grupos que el usuario puede ver (según su rol). Sin datos aún → todos.
  const gruposVisibles = navGroups.filter((g) => !permisos || permisos[g.id] !== false);

  // Servidor seleccionado (de la lista) con fallback a la info del endpoint de uso.
  const seleccionado = servidores.find((s) => s.id === guildId);
  const nombreServidor = seleccionado?.nombre || servidorInfo?.nombre || 'Mi Servidor';
  const iconoServidor = seleccionado?.icono || servidorInfo?.icono;

  const toggleGroup = (id) => {
    if (collapsed) { setCollapsed(false); setOpenGroups((g) => ({ ...g, [id]: true })); return; }
    setOpenGroups((g) => ({ ...g, [id]: !g[id] }));
  };

  const inicioActivo = activeTab === 'inicio';

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 270 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative z-20 flex h-screen flex-col bg-sidebar p-3"
    >
      {/* Logo */}
      <div className="flex h-12 items-center gap-2.5 px-2">
        {/* // TODO: DESIGN TEAM — logo oficial */}
        <img src="/assets/logo-placeholder.svg" alt="Sokyo" className="h-8 w-8 shrink-0" />
        <AnimatePresence>
          {!collapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="whitespace-nowrap text-lg font-extrabold tracking-tight text-fg">
              Sokyo<span className="text-gradient-brand"> Bot</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Botón de colapso */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-card text-muted shadow-md transition-colors hover:text-fg"
        aria-label="Colapsar menú"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Tarjeta + SELECTOR del SERVIDOR */}
      <div className={cn('mt-4 flex items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-soft', collapsed && 'justify-center px-0')}>
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

      {/* Navegación */}
      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto pr-1">
        {/* Inicio (standalone) */}
        <button
          onClick={() => setActiveTab('inicio')}
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
                        return (
                          <button
                            key={item.tab}
                            onClick={() => setActiveTab(item.tab)}
                            className={cn(
                              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                              active ? 'bg-gradient-brand font-semibold text-on-brand shadow-md' : 'text-muted hover:bg-elevated hover:text-fg'
                            )}
                          >
                            <item.icon size={16} className="shrink-0" />
                            <span className="truncate">{t(`dashboard.nav.items.${item.tab}`)}</span>
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
    </motion.aside>
  );
}
