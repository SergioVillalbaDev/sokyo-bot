// Pie de página. Textos vía i18n.
import { useTranslation } from 'react-i18next';
import { Send, AtSign, MessageCircle } from 'lucide-react';
import { inviteUrl, redes } from '../../lib/landingConfig';
import { APK_URL } from '../../lib/appMovil';
import { EnlacePanel } from './Marcos';

const ICONOS = { discord: MessageCircle, email: AtSign, x: Send };

export default function Footer({ onEnterDashboard }) {
  const { t } = useTranslation();
  const columns = t('landing.footer.columns', { returnObjects: true });

  // Un enlace del footer. Resuelve los hrefs especiales: INVITE (invitar el bot,
  // en pestaña nueva), DASHBOARD (abrir el panel) y APK (descargar la app de
  // Android). El resto son anclas, rutas o mailto:.
  const FooterLink = ({ label, href }) => {
    const cls = 'text-sm text-muted transition-colors hover:text-fg';
    if (href === 'INVITE') return <a href={inviteUrl} target="_blank" rel="noreferrer" className={cls}>{label}</a>;
    if (href === 'DASHBOARD') return <EnlacePanel onEnterDashboard={onEnterDashboard} className={cls}>{label}</EnlacePanel>;
    if (href === 'APK') return <a href={APK_URL} download className={cls}>{label}</a>;
    return <a href={href} className={cls}>{label}</a>;
  };

  return (
    <footer className="lx-diferido relative border-t border-white/[.08] bg-[#05040d]/70">
      {/* Línea de luz arriba del pie */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="lx-aro"><img src="/assets/logo-96.webp" alt="Sokyo" width="34" height="34" loading="lazy" className="h-[34px] w-[34px] object-cover" /></span>
              <span className="text-lg font-extrabold text-fg">{t('landing.nav.brand')}</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted">{t('landing.footer.brandDesc')}</p>
            {/* Solo las redes configuradas en landingConfig (sin enlaces vacíos). */}
            {redes.length > 0 && (
              <div className="mt-5 flex gap-3">
                {redes.map((r) => {
                  const Icon = ICONOS[r.icono] || MessageCircle;
                  return (
                    <a key={r.href} href={r.href} target="_blank" rel="noreferrer" aria-label={r.label} title={r.label} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[.05] text-muted transition-colors hover:text-fg">
                      <Icon size={17} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-fg">{col.title}</h4>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.label}><FooterLink label={l.label} href={l.href} /></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[.08] pt-6 sm:flex-row">
          <p className="text-sm text-muted">© {new Date().getFullYear()} {t('landing.footer.copyright')}</p>
          <p className="text-xs text-muted">{t('landing.footer.madeWith')}</p>
        </div>
      </div>
    </footer>
  );
}
