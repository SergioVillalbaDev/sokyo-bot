// Pantalla de login del staff (OAuth de Discord con state=staff).
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LogIn, AlertTriangle } from 'lucide-react';
import { API_URL } from '../../lib/api';
import LanguageSwitcher from '../LanguageSwitcher';

export default function StaffLogin({ error }) {
  const { t } = useTranslation();

  // Tema oscuro fijo para la pantalla de login.
  useEffect(() => { document.documentElement.setAttribute('data-theme', 'lima'); }, []);

  const mensajeError = error === 'denegado' ? t('dashboard.auth.errDenied')
    : error === 'nostaff' ? t('dashboard.auth.errNoStaff')
    : error ? t('dashboard.auth.errOauth') : '';

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 text-fg">
      <div className="absolute right-5 top-5"><LanguageSwitcher /></div>
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 text-center shadow-soft">
        <img src="/assets/logo-placeholder.svg" alt="Sokyo" className="mx-auto h-14 w-14" />
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-fg">{t('dashboard.auth.loginTitle')}</h1>
        <p className="mt-2 text-sm text-muted">{t('dashboard.auth.loginSubtitle')}</p>

        {mensajeError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-left text-sm text-danger">
            <AlertTriangle size={16} className="shrink-0" /> {mensajeError}
          </div>
        )}

        <a
          href={`${API_URL}/api/auth/discord?state=staff`}
          className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#5865F2]/40 transition-transform hover:scale-[1.03]"
        >
          <LogIn size={18} /> {t('dashboard.auth.loginButton')}
        </a>
      </div>
    </div>
  );
}
