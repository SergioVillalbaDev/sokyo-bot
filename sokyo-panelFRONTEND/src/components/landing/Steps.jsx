// Sección "Cómo funciona" — 3 pasos con línea conectora.
import { motion } from 'framer-motion';
import { Plus, Wand2, Rocket } from 'lucide-react';

const steps = [
  { icon: Plus, title: 'Añade el bot', desc: 'Invita a Sokyo a tu servidor con un clic y activa los intents. Listo en segundos.' },
  { icon: Wand2, title: 'Configúralo', desc: 'Ajusta categorías, urgencias y textos desde el panel. Lanza el panel con !sokyo.' },
  { icon: Rocket, title: 'Da soporte', desc: 'Tu equipo gestiona tickets desde la web mientras tú ves todo lo que ocurre.' },
];

export default function Steps() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-emerald-400">
          En 3 pasos
        </span>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          De cero a operativo, <span className="text-gradient-brand">hoy mismo</span>
        </h2>
      </div>

      <div className="relative mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Línea conectora (solo desktop) */}
        <div className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-line md:block" />

        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: i * 0.12 }}
            className="relative text-center"
          >
            <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-card text-brand shadow-lg">
              <s.icon size={24} />
              <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-on-brand">
                {i + 1}
              </span>
            </div>
            <h3 className="mt-5 text-lg font-bold text-fg">{s.title}</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
