// Páginas legales (Privacidad y Términos). Contenido vía i18n (legal.<page>).
// Necesarias para cobrar con Stripe y cumplir RGPD. Mismo estilo cristal que la
// landing (src/landing.css). `page` = 'privacidad' | 'terminos'.
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import FondoLanding from './FondoLanding';
import '../../landing.css';

export default function Legal({ page = 'privacidad', onBack }) {
  const { t } = useTranslation();
  const data = t(`legal.${page}`, { returnObjects: true }) || {};
  const sections = Array.isArray(data.sections) ? data.sections : [];

  // La landing usa siempre el tema "lima"; las legales mantienen el mismo look.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'lima');
  }, []);

  return (
    <div className="lx">
      <FondoLanding />
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
        <div className="lx-nav lx-nav-flotante mx-auto flex max-w-3xl items-center justify-between rounded-[22px] px-3 py-2.5 sm:px-4">
          <a href="#top" onClick={onBack} className="flex items-center gap-2.5">
            <span className="lx-aro"><img src="/assets/logo-96.webp" alt="Sokyo" width="32" height="32" className="h-8 w-8 object-cover" /></span>
            <span className="text-lg font-extrabold tracking-tight text-fg">{t('landing.nav.brand')}</span>
          </a>
          <button onClick={onBack} className="lx-btn px-3.5 py-2 text-sm">
            <ArrowLeft size={16} /> {t('legal.back')}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
        <div className="lx-card p-6 sm:p-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">{data.title}</h1>
          <p className="mt-2 text-sm text-muted">{data.updated}</p>
          <p className="mt-6 text-base leading-relaxed text-muted">{data.intro}</p>

          <div className="mt-10 space-y-8">
            {sections.map((s) => (
              <section key={s.h}>
                <h2 className="text-lg font-bold text-fg">{s.h}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.p}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
