// Páginas legales (Privacidad y Términos). Contenido vía i18n (legal.<page>).
// Necesarias para cobrar con Stripe y cumplir RGPD. Mantienen el tema oscuro de
// la landing. `page` = 'privacidad' | 'terminos'.
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';

export default function Legal({ page = 'privacidad', onBack }) {
  const { t } = useTranslation();
  const data = t(`legal.${page}`, { returnObjects: true }) || {};
  const sections = Array.isArray(data.sections) ? data.sections : [];

  // La landing usa siempre el tema "lima"; las legales mantienen el mismo look.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'lima');
  }, []);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <a href="#top" onClick={onBack} className="flex items-center gap-2.5">
            <img src="/assets/logo.jpg" alt="Sokyo" className="h-8 w-8 rounded-full object-cover" />
            <span className="text-lg font-extrabold tracking-tight text-fg">{t('landing.nav.brand')}</span>
          </a>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
          >
            <ArrowLeft size={16} /> {t('legal.back')}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
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
      </main>
    </div>
  );
}
