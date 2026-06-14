// Tabla de precios Free vs Sokyo Pro.
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';

const tiers = [
  {
    name: 'Free',
    price: '0€',
    period: 'para siempre',
    desc: 'Perfecto para comunidades pequeñas que empiezan.',
    cta: 'Empezar gratis',
    highlighted: false,
    features: [
      'Sistema de tickets completo',
      'Panel web de gestión',
      'Hasta 50 registros de auditoría',
      'Comandos de utilidad',
      'Portal del cliente',
    ],
  },
  {
    name: 'Sokyo Pro',
    price: '5€',
    period: '/mes',
    desc: 'Para servidores que necesitan potencia y memoria.',
    cta: 'Subir a Pro',
    highlighted: true,
    features: [
      'Todo lo del plan Free',
      'Hasta 150 registros de auditoría',
      'Marca blanca avanzada',
      'Urgencias y categorías ilimitadas',
      'Estadísticas extendidas',
      'Soporte prioritario',
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          Precios <span className="text-gradient-brand">sin sorpresas</span>
        </h2>
        <p className="mt-4 text-lg text-muted">
          Empieza gratis. Sube a Pro cuando tu comunidad despegue.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
        {tiers.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className={`relative flex flex-col rounded-3xl border p-8 ${
              t.highlighted
                ? 'border-brand/50 bg-card shadow-2xl shadow-brand/20'
                : 'border-line bg-card/60'
            }`}
          >
            {t.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1 text-xs font-bold text-on-brand shadow-lg">
                  <Sparkles size={13} /> Recomendado
                </span>
              </div>
            )}
            <h3 className="text-lg font-bold text-fg">{t.name}</h3>
            <p className="mt-1 text-sm text-muted">{t.desc}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-5xl font-extrabold tracking-tight text-fg">{t.price}</span>
              <span className="text-sm text-muted">{t.period}</span>
            </div>

            <ul className="mt-7 flex flex-1 flex-col gap-3">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-fg/90">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      t.highlighted ? 'bg-gradient-brand text-on-brand' : 'bg-elevated text-brand'
                    }`}
                  >
                    <Check size={13} strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            {/* // TODO: DESIGN TEAM — enlaces de checkout/invitación reales */}
            <a
              href="https://discord.com/oauth2/authorize"
              target="_blank" rel="noreferrer"
              className={`mt-8 flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.02] ${
                t.highlighted
                  ? 'bg-gradient-brand text-on-brand glow-brand'
                  : 'border border-line bg-elevated text-fg'
              }`}
            >
              {t.cta}
            </a>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
