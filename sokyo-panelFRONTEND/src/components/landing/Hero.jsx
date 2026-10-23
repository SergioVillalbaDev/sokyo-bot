// Hero de la landing — layout asimétrico (texto + maqueta del producto).
// Textos vía i18n (src/i18n/locales/*).
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Plus, ArrowRight, Zap, Star, Lock, MessageSquare } from 'lucide-react';
import { inviteUrl, prioridadBar } from '../../lib/landingConfig';

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.08, ease: 'easeOut' } }),
};

const trustIcons = [
  <Zap size={15} className="text-amber-400" />,
  <Lock size={15} className="text-emerald-400" />,
  <Star size={15} className="text-brand" />,
];

export default function Hero({ onEnterDashboard }) {
  const { t } = useTranslation();
  const trust = t('landing.hero.trust', { returnObjects: true });

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.25] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute -top-32 right-[-10%] h-[420px] w-[520px] rounded-full bg-brand/15 blur-[130px]" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
        <div className="text-center lg:text-left">
          <motion.div
            variants={fadeUp} initial="hidden" animate="show"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-3.5 py-1.5 text-xs font-medium text-muted backdrop-blur"
          >
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" />
            {t('landing.hero.badge')}
          </motion.div>

          <motion.h1
            variants={fadeUp} custom={1} initial="hidden" animate="show"
            className="mt-6 font-extrabold leading-[1.05] tracking-tight text-fg text-[clamp(1.75rem,6.5vw,3.5rem)]"
          >
            <span className="block whitespace-nowrap">{t('landing.hero.titleLine1')}</span>
            <span className="block whitespace-nowrap text-gradient-brand">{t('landing.hero.titleLine2')}</span>
          </motion.h1>

          <motion.p
            variants={fadeUp} custom={2} initial="hidden" animate="show"
            className="mx-auto mt-6 max-w-xl text-lg text-muted lg:mx-0"
          >
            {t('landing.hero.subtitle')}
          </motion.p>

          <motion.div
            variants={fadeUp} custom={3} initial="hidden" animate="show"
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start"
          >
            <a
              href={inviteUrl}
              target="_blank" rel="noreferrer"
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#5865F2]/40 transition-transform hover:scale-[1.03] sm:w-auto"
            >
              <Plus size={18} /> {t('landing.hero.ctaPrimary')}
            </a>
            <button
              onClick={onEnterDashboard}
              className="group flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-card px-7 py-3.5 text-base font-semibold text-fg transition-colors hover:bg-elevated sm:w-auto"
            >
              {t('landing.hero.ctaSecondary')}
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </motion.div>

          <motion.div
            variants={fadeUp} custom={4} initial="hidden" animate="show"
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted lg:justify-start"
          >
            {trust.map((txt, i) => (
              <span key={txt} className="flex items-center gap-1.5">{trustIcons[i]} {txt}</span>
            ))}
          </motion.div>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

function ProductPreview() {
  const { t } = useTranslation();
  const preview = t('landing.hero.preview', { returnObjects: true });

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.9, delay: 0.35, ease: 'easeOut' }}
      className="relative mx-auto w-full max-w-xl"
    >
      {/*
        // TODO: DESIGN TEAM — ANIMACIÓN/ILUSTRACIÓN DEL HERO
        #hero-svg-animation: hueco reservado para la animación SVG/Lottie final.
        Borrad el contenido interno y meted el vuestro (proporción ~4:3 / 5:4).
      */}
      <div id="hero-svg-animation" className="relative">
        <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-black/50 ring-1 ring-white/5">
          <div className="flex items-center gap-2 border-b border-line bg-sidebar px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400/80" />
            <span className="h-3 w-3 rounded-full bg-amber-400/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
            <div className="ml-3 flex-1 rounded-md bg-bg px-3 py-1 text-center text-[11px] text-muted">{preview.url}</div>
          </div>

          <div className="flex">
            <div className="flex w-12 flex-col items-center gap-3 border-r border-line bg-sidebar py-4">
              <div className="h-7 w-7 rounded-lg bg-gradient-brand" />
              <div className="h-7 w-7 rounded-lg bg-brand/20" />
              <div className="h-7 w-7 rounded-lg bg-elevated" />
              <div className="h-7 w-7 rounded-lg bg-elevated" />
            </div>

            <div className="flex-1 space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-28 rounded bg-fg/70" />
                <div className="h-6 w-16 rounded-full bg-elevated" />
              </div>

              {preview.tickets.map((row, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-line bg-bg">
                  <div className={`h-1 w-full ${prioridadBar[i] || 'bg-brand'}`} />
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-elevated" />
                      <div>
                        <div className="text-xs font-semibold text-fg">{row.t}</div>
                        <div className="text-[10px] text-muted">{row.n}</div>
                      </div>
                    </div>
                    <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] font-bold text-muted">{row.p}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
          transition={{ opacity: { delay: 1, duration: 0.4 }, scale: { delay: 1, duration: 0.4 }, y: { delay: 1.4, duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
          className="absolute -left-6 top-24 hidden items-center gap-2 rounded-xl border border-line bg-elevated/95 px-3 py-2 shadow-xl backdrop-blur sm:flex"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-400"><Star size={15} /></span>
          <div>
            <div className="text-[11px] font-bold text-fg">{preview.toast1Title}</div>
            <div className="text-[10px] text-amber-400">★★★★★</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, y: [0, 8, 0] }}
          transition={{ opacity: { delay: 1.2, duration: 0.4 }, scale: { delay: 1.2, duration: 0.4 }, y: { delay: 1.6, duration: 4.5, repeat: Infinity, ease: 'easeInOut' } }}
          className="absolute -right-5 bottom-16 hidden items-center gap-2 rounded-xl border border-line bg-elevated/95 px-3 py-2 shadow-xl backdrop-blur sm:flex"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/15 text-brand"><MessageSquare size={15} /></span>
          <div>
            <div className="text-[11px] font-bold text-fg">{preview.toast2Title}</div>
            <div className="text-[10px] text-muted">{preview.toast2Sub}</div>
          </div>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute -bottom-8 left-1/2 h-24 w-2/3 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
    </motion.div>
  );
}
