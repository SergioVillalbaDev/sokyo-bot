// Menú lateral del panel: flotante, de cristal y ordenado en tres bloques
// ("Día a día", "Tu comunidad", "Administración"). Arriba, el servidor que se
// gestiona y un buscador de funciones; dentro de cada grupo, sus secciones con
// el estado del módulo (encendido/apagado) y un candado si es de pago.
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Home, LayoutDashboard, LogOut, Crown, X, Search, Smartphone } from 'lucide-react';
import { navSections, gruposVisibles, tabDeMenu, bloqueadoPorPlan } from './navConfig';
import { Avatar } from '../ui/primitives';
import { cn } from '../../lib/cn';
import MenuPerfil from './MenuPerfil';
import { getStaffSession } from '../../lib/api';
import { enLaAppAndroid } from '../../lib/appMovil';

const sesion = getStaffSession();
const esOwner = !!sesion?.owner;
const enApp = enLaAppAndroid();
const CLAVE_ABIERTOS = 'sokyoMenuAbiertos';
const leerAbiertos = () => { try { return JSON.parse(localStorage.getItem(CLAVE_ABIERTOS) || '{}') || {}; } catch { return {}; } };

export default function Sidebar({
  activeTab, setActiveTab, collapsed, setCollapsed, mobileOpen, setMobileOpen, onExitToLanding,
  servidorInfo, esPremium, onRequestUpgrade, servidores = [], guildId, onCambiarServidor,
  permisos, moduleStatus = {}, onLogout, onBuscar,
}) {
  const { t } = useTranslation();
  // Plegado solo cuenta en escritorio: en el móvil el menú es un cajón ancho.
  const [escritorio, setEscritorio] = useState(() => window.matchMedia?.('(min-width: 1024px)').matches ?? true);
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 1024px)');
    if (!mq) return undefined;
    const cambio = (e) => setEscritorio(e.matches);
    // Safari anterior a la 14 solo tiene addListener.
    if (mq.addEventListener) mq.addEventListener('change', cambio); else mq.addListener(cambio);
    return () => (mq.removeEventListener ? mq.removeEventListener('change', cambio) : mq.removeListener(cambio));
  }, []);
  const plegado = collapsed && escritorio;
  // Grupos abiertos o cerrados a mano (se recuerdan). Sin tocar: abierto el de la sección actual.
  const [abiertos, setAbiertos] = useState(leerAbiertos);

  const grupos = gruposVisibles(permisos, esOwner);
  const porId = Object.fromEntries(grupos.map((g) => [g.id, g]));
  const tabMenu = tabDeMenu(activeTab);

  const seleccionado = servidores.find((s) => s.id === guildId);
  const nombreServidor = seleccionado?.nombre || servidorInfo?.nombre || t('dashboard.sidebar.myServer');
  const iconoServidor = seleccionado?.icono || servidorInfo?.icono;
  const variosServidores = servidores.length > 1;

  const contieneActiva = (g) => g.items.some((it) => it.tab === tabMenu);
  const estaAbierto = (g) => (abiertos[g.id] === undefined ? contieneActiva(g) : abiertos[g.id]);
  const alternar = (g) => {
    if (plegado) { setCollapsed(false); guardar({ ...abiertos, [g.id]: true }); return; }
    guardar({ ...abiertos, [g.id]: !estaAbierto(g) });
  };
  const guardar = (nuevo) => {
    setAbiertos(nuevo);
    try { localStorage.setItem(CLAVE_ABIERTOS, JSON.stringify(nuevo)); } catch { /* no es crítico */ }
  };

  // Al elegir una sección en el móvil, el cajón se cierra solo.
  const irA = (tab) => { setActiveTab(tab); setMobileOpen(false); };

  return (
    <>
      {/* Fondo oscuro detrás del cajón (solo móvil) */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        className={cn('fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition-opacity duration-300 lg:hidden', mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
      />

      <aside
        aria-label={t('dashboard.sidebar.aria')}
        className={cn(
          'sk-sidebar fixed inset-y-0 left-0 z-50 flex h-dvh w-[284px] flex-col rounded-r-[26px] p-3',
          'transition-[transform,width] duration-300 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Escritorio: flotante, con margen y esquinas redondeadas.
          'lg:relative lg:z-20 lg:m-3 lg:mr-0 lg:h-[calc(100dvh-1.5rem)] lg:translate-x-0 lg:rounded-[26px]',
          plegado ? 'lg:w-[78px]' : 'lg:w-[284px]',
        )}
      >
        {/* Marca */}
        <div className={cn('flex h-12 items-center gap-2.5 px-2', plegado && 'lg:justify-center lg:px-0')}>
          <img src="/assets/logo-96.webp" alt="Sokyo" width="36" height="36" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-brand/40" />
          {!plegado && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[17px] font-extrabold tracking-tight text-fg">Sokyo</span>
              <span className="sk-texto-marca block truncate text-[10.5px] font-bold uppercase tracking-[.16em]">{t('dashboard.sidebar.brandSub')}</span>
            </span>
          )}
          <button onClick={() => setMobileOpen(false)} className="sk-foco ml-auto grid h-9 w-9 place-items-center rounded-xl text-muted transition-colors hover:bg-elevated hover:text-fg lg:hidden" aria-label={t('dashboard.sidebar.close')}>
            <X size={18} />
          </button>
        </div>

        {/* Plegar / desplegar (solo escritorio) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sk-foco absolute -right-3 top-7 z-30 hidden h-6 w-6 place-items-center rounded-full border border-line bg-card text-muted shadow-md transition-colors hover:text-fg lg:grid"
          aria-label={plegado ? t('dashboard.sidebar.expand') : t('dashboard.sidebar.collapse')}
          title={plegado ? t('dashboard.sidebar.expand') : t('dashboard.sidebar.collapse')}
        >
          {plegado ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Servidor que se gestiona */}
        <button
          data-tour="server"
          onClick={() => variosServidores && onCambiarServidor?.()}
          disabled={!variosServidores}
          title={variosServidores ? t('dashboard.header.changeServer') : nombreServidor}
          className={cn(
            'sk-foco mt-3 flex items-center gap-3 rounded-2xl border border-line bg-elevated/60 p-2.5 text-left transition-colors enabled:hover:border-brand/40',
            plegado && 'lg:justify-center lg:p-2',
          )}
        >
          <Avatar src={iconoServidor} name={nombreServidor} size={plegado ? 34 : 38} className="ring-2 ring-brand/30" />
          {!plegado && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-fg">{nombreServidor}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-muted">
                {esOwner
                  ? <span className="flex items-center gap-1 text-amber-400"><Crown size={11} /> {t('dashboard.plan.owner')}</span>
                  : esPremium ? <><Crown size={11} className="text-amber-400" /> {t('dashboard.plan.premium')}</> : esPremium === false ? t('dashboard.plan.free') : '\u00a0'}
              </span>
            </span>
          )}
          {!plegado && variosServidores && <ChevronsUpDown size={15} className="shrink-0 text-muted" />}
        </button>

        {/* Buscador de funciones */}
        <button
          data-tour="search"
          onClick={onBuscar}
          className={cn(
            'sk-foco mt-2.5 flex items-center gap-2.5 rounded-xl border border-line bg-bg/60 px-3 py-2 text-sm text-muted transition-colors hover:border-brand/40 hover:text-fg',
            plegado && 'lg:justify-center lg:px-0',
          )}
          title={t('dashboard.search.open')}
        >
          <Search size={16} className="shrink-0" />
          {!plegado && <span className="flex-1 truncate text-left">{t('dashboard.search.sidebar')}</span>}
          {!plegado && <span className="sk-tecla hidden lg:inline-flex">Ctrl K</span>}
        </button>

        {/* Navegación */}
        <nav className="-mr-1.5 mt-3 flex-1 overflow-y-auto pr-1.5" aria-label={t('dashboard.sidebar.navAria')}>
          <button
            onClick={() => irA('inicio')}
            aria-current={activeTab === 'inicio' ? 'page' : undefined}
            className={cn(
              'sk-foco flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold transition-colors',
              activeTab === 'inicio' ? 'sk-nav-activo' : 'text-muted hover:bg-elevated hover:text-fg',
              plegado && 'lg:justify-center',
            )}
            title={plegado ? t('dashboard.inicio') : undefined}
          >
            <span className={cn('sk-icono-grupo h-8 w-8', activeTab === 'inicio' && '!bg-white/20 !text-on-brand !shadow-none')}><LayoutDashboard size={17} /></span>
            {!plegado && <span>{t('dashboard.inicio')}</span>}
          </button>

          {navSections.map((sec) => {
            const gs = sec.groups.map((id) => porId[id]).filter(Boolean);
            if (!gs.length) return null;
            return (
              <div key={sec.id} className="mt-4">
                {!plegado
                  ? <p className="mb-1.5 px-2.5 text-[10.5px] font-bold uppercase tracking-[.14em] text-muted/80">{t(`dashboard.nav.sections.${sec.id}`)}</p>
                  : <div className="mx-auto mb-2 hidden h-px w-8 bg-line lg:block" />}
                <div className="space-y-0.5">
                  {gs.map((g) => {
                    const abierto = estaAbierto(g);
                    const activo = contieneActiva(g);
                    const nombre = t(`dashboard.nav.groups.${g.id}`);
                    return (
                      <div key={g.id} style={{ '--grupo': g.color }}>
                        <button
                          data-tour={`nav-${g.id}`}
                          onClick={() => alternar(g)}
                          aria-expanded={!plegado && abierto}
                          className={cn(
                            'sk-foco flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold transition-colors',
                            activo ? 'text-fg' : 'text-muted hover:bg-elevated hover:text-fg',
                            plegado && 'lg:justify-center',
                          )}
                          title={plegado ? nombre : undefined}
                        >
                          <span className="sk-icono-grupo h-8 w-8"><g.icon size={16} /></span>
                          {!plegado && <span className="flex-1 truncate text-left">{nombre}</span>}
                          {!plegado && <ChevronDown size={15} className={cn('shrink-0 opacity-60 transition-transform', abierto && 'rotate-180')} />}
                        </button>

                        <AnimatePresence initial={false}>
                          {!plegado && abierto && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18 }} className="overflow-hidden"
                            >
                              <div className="mb-1.5 ml-[26px] mt-0.5 flex flex-col gap-0.5 border-l border-line pl-2.5">
                                {g.items.map((item) => {
                                  const act = tabMenu === item.tab;
                                  const bloqueado = bloqueadoPorPlan(item, esPremium, esOwner);
                                  const estado = Object.prototype.hasOwnProperty.call(moduleStatus, item.tab) ? moduleStatus[item.tab] : undefined;
                                  return (
                                    <button
                                      key={item.tab}
                                      onClick={() => (bloqueado ? onRequestUpgrade?.(item.tab) : irA(item.tab))}
                                      aria-current={act ? 'page' : undefined}
                                      title={bloqueado ? t('dashboard.plan.upgrade') : (estado === false ? t('dashboard.nav.moduleOff') : (estado === true ? t('dashboard.nav.moduleOn') : undefined))}
                                      className={cn(
                                        'sk-foco flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] transition-colors',
                                        act ? 'sk-nav-activo font-semibold' : 'text-muted hover:bg-elevated hover:text-fg',
                                      )}
                                    >
                                      <item.icon size={15} className="shrink-0" />
                                      <span className="flex-1 truncate text-left">{t(`dashboard.nav.items.${item.tab}`)}</span>
                                      {estado !== undefined && (
                                        <span
                                          aria-label={estado ? t('dashboard.nav.moduleOn') : t('dashboard.nav.moduleOff')}
                                          className={cn('h-2 w-2 shrink-0 rounded-full', estado
                                            ? (act ? 'bg-on-brand' : 'bg-success shadow-[0_0_8px_var(--success)]')
                                            : (act ? 'bg-on-brand/40' : 'bg-transparent ring-1 ring-muted/60'))}
                                        />
                                      )}
                                      {bloqueado && <Crown size={13} className="shrink-0 text-amber-400" />}
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
                </div>
              </div>
            );
          })}
        </nav>

        {/* Subir a Pro (servidores Free, si puede ver la facturación; mientras carga el plan, nada) */}
        {!esOwner && esPremium === false && (!permisos || permisos.cuenta !== false) && (
          <button
            onClick={() => irA('cuenta-plan')}
            className={cn('sk-foco sk-nav-activo mt-2 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 transition-transform hover:scale-[1.02]', plegado ? 'lg:justify-center lg:px-0' : 'w-full')}
            title={plegado ? t('dashboard.plan.upgrade') : undefined}
          >
            <Crown size={plegado ? 18 : 16} className="shrink-0" />
            {!plegado && (
              <span className="min-w-0 text-left">
                <span className="block text-sm font-bold leading-tight">{t('dashboard.plan.upgrade')}</span>
                <span className="block text-[11px] font-medium opacity-90">{t('dashboard.plan.upgradeSub')}</span>
              </span>
            )}
          </button>
        )}

        {/* Pie: quién ha entrado, volver a la web y salir */}
        <div className={cn('mt-2 flex items-center gap-1 border-t border-line pt-2', plegado && 'lg:flex-col')}>
          {sesion?.username && (
            <MenuPerfil
              sesion={sesion} plegado={plegado} variosServidores={variosServidores}
              onCambiarServidor={onCambiarServidor} onExitToLanding={onExitToLanding} onLogout={onLogout}
            />
          )}
          {/* Acceso directo a la app móvil (dentro de la app ya no hace falta). */}
          {!enApp && (
            <button
              onClick={() => irA('config-app')}
              className={cn('sk-foco grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors hover:bg-elevated hover:text-fg', activeTab === 'config-app' ? 'text-brand' : 'text-muted', !sesion?.username && !plegado && 'ml-auto')}
              title={t('dashboard.sidebar.getApp')} aria-label={t('dashboard.sidebar.getApp')}
            >
              <Smartphone size={17} />
            </button>
          )}
          <button
            onClick={onExitToLanding}
            className={cn('sk-foco grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-elevated hover:text-fg', enApp && !sesion?.username && !plegado && 'ml-auto')}
            title={t('dashboard.back')} aria-label={t('dashboard.back')}
          >
            <Home size={17} />
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="sk-foco grid h-9 w-9 shrink-0 place-items-center rounded-xl text-danger transition-colors hover:bg-danger/10"
              title={t('dashboard.auth.logout')} aria-label={t('dashboard.auth.logout')}
            >
              <LogOut size={17} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
