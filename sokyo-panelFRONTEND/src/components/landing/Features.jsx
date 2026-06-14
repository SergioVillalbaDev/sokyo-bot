// Sección de funciones — bento grid estilo Tremor/shadcn con mini-visuales.
import { motion } from 'framer-motion';
import { Ticket, ScrollText, ShieldCheck, SlidersHorizontal, Bot } from 'lucide-react';

const tile = 'group relative overflow-hidden rounded-3xl border border-line bg-card p-6 transition-colors hover:border-brand/40';

const enter = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.06 } }),
};

export default function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-brand">
          Capacidades
        </span>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          Todo el soporte, <span className="text-gradient-brand">en una superficie</span>
        </h2>
        <p className="mt-4 text-lg text-muted">
          Piezas que encajan: tickets, auditoría, personalización y un bot polivalente.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[minmax(0,1fr)]">
        {/* TICKETS — tile grande */}
        <motion.article
          variants={enter} custom={0} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
          className={`${tile} md:col-span-2 md:row-span-2`}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/15 text-brand"><Ticket size={22} /></div>
          <h3 className="mt-5 text-xl font-bold text-fg">Tickets avanzados</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
            Categorías, prioridades con SLA, asignación a staff, participantes y valoración CSAT
            al cerrar. Cada ticket es su propio canal privado en Discord.
          </p>

          {/* Mini visual: barras de prioridad */}
          <div className="mt-6 space-y-2.5">
            {[
              { l: 'Urgente', w: '92%', c: 'bg-red-400' },
              { l: 'Alta', w: '70%', c: 'bg-amber-400' },
              { l: 'Normal', w: '48%', c: 'bg-brand' },
              { l: 'Baja', w: '28%', c: 'bg-emerald-400' },
            ].map((b) => (
              <div key={b.l} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs text-muted">{b.l}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-elevated">
                  <motion.div
                    initial={{ width: 0 }} whileInView={{ width: b.w }} viewport={{ once: true }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    className={`h-full rounded-full ${b.c}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/20 opacity-0 blur-3xl transition-opacity group-hover:opacity-100" />
        </motion.article>

        {/* AUDITORÍA */}
        <motion.article
          variants={enter} custom={1} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
          className={tile}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400"><ScrollText size={22} /></div>
          <h3 className="mt-5 text-lg font-bold text-fg">Auditoría completa</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Entradas, salidas, mensajes editados y borrados. Timeline filtrable en tiempo real.
          </p>
          <div className="mt-4 space-y-1.5">
            {['#e74c3c', '#f1c40f', '#2ecc71'].map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
                <span className="h-2 rounded-full bg-elevated" style={{ width: `${70 - i * 14}%` }} />
              </div>
            ))}
          </div>
        </motion.article>

        {/* PORTAL */}
        <motion.article
          variants={enter} custom={2} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
          className={tile}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-400"><ShieldCheck size={22} /></div>
          <h3 className="mt-5 text-lg font-bold text-fg">Portal del cliente</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Tus usuarios entran con Discord y gestionan sus propios tickets de forma segura.
          </p>
        </motion.article>

        {/* MARCA BLANCA */}
        <motion.article
          variants={enter} custom={3} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
          className={tile}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-300/15 text-zinc-300"><SlidersHorizontal size={22} /></div>
          <h3 className="mt-5 text-lg font-bold text-fg">Marca blanca</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Personaliza textos, urgencias y categorías desde el panel. Sin tocar código.
          </p>
        </motion.article>

        {/* BOT POLIVALENTE — ancho doble */}
        <motion.article
          variants={enter} custom={4} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
          className={`${tile} md:col-span-2`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-400"><Bot size={22} /></div>
              <h3 className="mt-5 text-lg font-bold text-fg">Bot polivalente</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                Más allá del soporte: comandos de utilidad y diversión listos para usar.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {['!sokyo', '!user', '!dado', '!moneda'].map((c) => (
              <span key={c} className="rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-xs text-muted">{c}</span>
            ))}
          </div>
        </motion.article>
      </div>
    </section>
  );
}
