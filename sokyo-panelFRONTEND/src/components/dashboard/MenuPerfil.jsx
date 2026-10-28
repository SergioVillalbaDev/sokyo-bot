// Tu foto (abajo del menú lateral): al pulsarla se abre tu menú con «Mi perfil»
// (tu «Mi cuenta», sin volver a entrar con Discord), cambiar de servidor, volver
// a la web y cerrar sesión.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserRound, ArrowLeftRight, Home, LogOut, Loader2, ChevronUp } from 'lucide-react';
import { Avatar } from '../ui/primitives';
import { cn } from '../../lib/cn';
import { abrirMiCuenta } from '../../lib/miCuenta';

export default function MenuPerfil({ sesion, plegado, variosServidores, onCambiarServidor, onExitToLanding, onLogout }) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const [yendo, setYendo] = useState(false);
  const caja = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!caja.current?.contains(e.target)) setAbierto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);

  const opcion = 'sk-foco flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-elevated';
  const cerrarY = (fn) => () => { setAbierto(false); fn?.(); };

  return (
    <div ref={caja} className={cn('relative min-w-0', !plegado && 'flex-1')}>
      <button
        type="button" onClick={() => setAbierto((v) => !v)} aria-haspopup="menu" aria-expanded={abierto}
        className={cn('sk-foco flex w-full min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-elevated', plegado && 'justify-center')}
        title={t('dashboard.perfil.abrir')} aria-label={t('dashboard.perfil.abrir')}
      >
        <Avatar src={sesion.avatar} name={sesion.username} size={28} />
        {!plegado && (
          <>
            <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-fg">{sesion.username}</span>
            <ChevronUp size={14} className={cn('shrink-0 text-muted transition-transform', !abierto && 'rotate-180')} />
          </>
        )}
      </button>

      {abierto && (
        <div role="menu" className="sk-glass sk-aparece absolute bottom-full left-0 z-50 mb-2 w-64 rounded-2xl border border-line bg-card p-1.5 shadow-xl">
          <div className="flex items-center gap-2.5 px-3 pb-2 pt-1.5">
            <Avatar src={sesion.avatar} name={sesion.username} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-fg">{sesion.username}</span>
              <span className="block text-xs text-muted">{t(sesion.owner ? 'dashboard.perfil.dueno' : 'dashboard.perfil.staff')}</span>
            </span>
          </div>
          <button
            role="menuitem" type="button" className={opcion} disabled={yendo}
            onClick={() => { setYendo(true); abrirMiCuenta(); }}
          >
            {yendo ? <Loader2 size={17} className="shrink-0 animate-spin text-brand" /> : <UserRound size={17} className="shrink-0 text-brand" />}
            <span className="min-w-0">
              <span className="block font-semibold text-fg">{t('dashboard.perfil.miCuenta')}</span>
              <span className="block text-xs text-muted">{t('dashboard.perfil.miCuentaDesc')}</span>
            </span>
          </button>
          {variosServidores && (
            <button role="menuitem" type="button" className={opcion} onClick={cerrarY(onCambiarServidor)}>
              <ArrowLeftRight size={17} className="shrink-0 text-muted" /> <span className="font-semibold text-fg">{t('dashboard.perfil.cambiarServidor')}</span>
            </button>
          )}
          <button role="menuitem" type="button" className={opcion} onClick={cerrarY(onExitToLanding)}>
            <Home size={17} className="shrink-0 text-muted" /> <span className="font-semibold text-fg">{t('dashboard.perfil.web')}</span>
          </button>
          {onLogout && (
            <button role="menuitem" type="button" className={cn(opcion, 'hover:bg-danger/10')} onClick={cerrarY(onLogout)}>
              <LogOut size={17} className="shrink-0 text-danger" /> <span className="font-semibold text-danger">{t('dashboard.auth.logout')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
