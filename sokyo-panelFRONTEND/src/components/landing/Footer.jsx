// Pie de página. Textos vía i18n.
import { useTranslation } from 'react-i18next';
import { Send, AtSign, MessageCircle } from 'lucide-react';
import { inviteUrl } from '../../lib/landingConfig';

export default function Footer({ onEnterDashboard }) {
  const { t } = useTranslation();
  const columns = t('landing.footer.columns', { returnObjects: true });

  // Un enlace del footer. Resuelve los hrefs especiales: INVITE (invitar el bot,
  // en pestaña nueva) y DASHBOARD (abrir el panel). El resto son anclas o rutas.
  const FooterLink = ({ label, href }) => {
    const cls = 'text-sm text-muted transition-colors hover:text-fg';
    if (href === 'INVITE') return <a href={inviteUrl} target="_blank" rel="noreferrer" className={cls}>{label}</a>;
    if (href === 'DASHBOARD') return <a href="#dashboard" onClick={onEnterDashboard} className={cls}>{label}</a>;
    return <a href={href} className={cls}>{label}</a>;
  };

  return (
    <footer className="border-t border-line bg-sidebar">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              {/* // TODO: DESIGN TEAM — logo oficial */}
              <img src="/assets/logo-placeholder.svg" alt="Sokyo" width="36" height="36" className="h-9 w-9" />
              <span className="text-lg font-extrabold text-fg">{t('landing.nav.brand')}</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted">{t('landing.footer.brandDesc')}</p>
            <div className="mt-5 flex gap-3">
              {/* // TODO: DESIGN TEAM — URLs reales de redes sociales */}
              {[MessageCircle, AtSign, Send].map((Icon, i) => (
                <a key={i} href="#" className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card text-muted transition-colors hover:text-fg">
                  <Icon size={17} />
                </a>
              ))}
            </div>
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

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row">
          <p className="text-sm text-muted">© {new Date().getFullYear()} {t('landing.footer.copyright')}</p>
          <p className="text-xs text-muted">{t('landing.footer.madeWith')}</p>
        </div>
      </div>
    </footer>
  );
}
