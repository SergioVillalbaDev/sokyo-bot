// Modal de upsell CONTEXTUAL. Salta cuando un servidor Free intenta abrir una
// función de pago (Pro). En vez de un error seco, explica qué desbloquea y lleva
// directo a la vista de planes. Es la palanca de conversión principal del panel.
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Check, X, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function UpgradeModal({ feature, onClose, onVerPlanes }) {
  const { t } = useTranslation();
  const abierto = !!feature;

  // Frase específica de la función que disparó el modal (con fallback genérico).
  const detalle = feature
    ? t(`dashboard.upgrade.features.${feature}`, { defaultValue: t('dashboard.upgrade.genericFeature') })
    : '';

  // Ventajas generales de Pro (lista). returnObjects -> array de strings.
  const bullets = t('dashboard.upgrade.bullets', { returnObjects: true });
  const listaBullets = Array.isArray(bullets) ? bullets : [];

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-brand/40 bg-card p-6 shadow-2xl"
          >
            {/* Resplandor de marca de fondo */}
            <div className="pointer-events-none absolute -top-20 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full bg-brand/25 blur-[90px]" />

            <button
              onClick={onClose}
              aria-label={t('dashboard.upgrade.close')}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-fg"
            >
              <X size={18} />
            </button>

            <div className="relative">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand text-on-brand shadow-lg">
                <Crown size={24} />
              </span>

              <h2 className="mt-4 text-xl font-extrabold tracking-tight text-fg">
                {t('dashboard.upgrade.title')}
              </h2>
              <p className="mt-1.5 text-sm text-muted">{detalle}</p>

              {listaBullets.length > 0 && (
                <ul className="mt-5 flex flex-col gap-2.5">
                  {listaBullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-fg/90">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-on-brand">
                        <Check size={13} strokeWidth={3} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={onVerPlanes}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-brand px-5 py-3 text-sm font-bold text-on-brand shadow-soft transition-transform hover:scale-[1.02]"
                >
                  <Sparkles size={16} /> {t('dashboard.upgrade.cta')}
                </button>
                <button
                  onClick={onClose}
                  className="rounded-2xl px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-fg"
                >
                  {t('dashboard.upgrade.later')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
