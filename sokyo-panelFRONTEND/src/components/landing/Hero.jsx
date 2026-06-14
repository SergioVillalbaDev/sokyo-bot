// Hero de la landing — layout asimétrico (texto + maqueta del producto).
import { motion } from 'framer-motion';
import { Plus, ArrowRight, Zap, Star, Lock, MessageSquare } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.08, ease: 'easeOut' } }),
};

export default function Hero({ onEnterDashboard }) {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* Fondo: rejilla sutil + un único halo (sin el glow recargado anterior) */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.25] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute -top-32 right-[-10%] h-[420px] w-[520px] rounded-full bg-brand/15 blur-[130px]" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
        {/* ---------- Columna izquierda: copy ---------- */}
        <div className="text-center lg:text-left">
          <motion.div
            variants={fadeUp} initial="hidden" animate="show"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-3.5 py-1.5 text-xs font-medium text-muted backdrop-blur"
          >
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" />
            Nuevo · Portal del cliente con login de Discord
          </motion.div>

          <motion.h1
            variants={fadeUp} custom={1} initial="hidden" animate="show"
            className="mt-6 text-5xl font-extrabold leading-[1.02] tracking-tight text-fg sm:text-6xl xl:text-7xl"
          >
            Tu mesa de ayuda,
            <br />
            <span className="text-gradient-brand">en piloto automático.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp} custom={2} initial="hidden" animate="show"
            className="mx-auto mt-6 max-w-xl text-lg text-muted lg:mx-0"
          >
            Sokyo transforma tu servidor de Discord en un service desk de verdad: tickets con
            prioridades, auditoría total y un panel en tiempo real. Menos caos, más respuestas.
          </motion.p>

          <motion.div
            variants={fadeUp} custom={3} initial="hidden" animate="show"
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start"
          >
            {/* // TODO: DESIGN TEAM — enlace de invitación real del bot */}
            <a
              href="https://discord.com/oauth2/authorize"
              target="_blank" rel="noreferrer"
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-7 py-3.5 text-base font-semibold text-on-brand glow-brand transition-transform hover:scale-[1.03] sm:w-auto"
            >
              <Plus size={18} /> Añadir a Discord
            </a>
            <button
              onClick={onEnterDashboard}
              className="group flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-card px-7 py-3.5 text-base font-semibold text-fg transition-colors hover:bg-elevated sm:w-auto"
            >
              Ver Panel en vivo
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </motion.div>

          {/* Mini fila de confianza */}
          <motion.div
            variants={fadeUp} custom={4} initial="hidden" animate="show"
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted lg:justify-start"
          >
            <span className="flex items-center gap-1.5"><Zap size={15} className="text-amber-400" /> Setup en 1 minuto</span>
            <span className="flex items-center gap-1.5"><Lock size={15} className="text-emerald-400" /> Sin tarjeta</span>
            <span className="flex items-center gap-1.5"><Star size={15} className="text-brand" /> Gratis para empezar</span>
          </motion.div>
        </div>

        {/* ---------- Columna derecha: maqueta del producto ---------- */}
        <ProductPreview />
      </div>
    </section>
  );
}

// Maqueta del panel construida en HTML (no es el splash de Discord: es producto).
function ProductPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.9, delay: 0.35, ease: 'easeOut' }}
      className="relative mx-auto w-full max-w-xl"
    >
      {/*
        // TODO: DESIGN TEAM — ANIMACIÓN/ILUSTRACIÓN DEL HERO
        ----------------------------------------------------------------
        Este contenedor #hero-svg-animation es el HUECO RESERVADO para la
        animación SVG / Lottie definitiva del equipo de diseño.

        CÓMO REEMPLAZARLO:
          1. Borrad TODO el contenido interno de este div (la maqueta de
             ventana de abajo es solo un placeholder funcional).
          2. Inyectad aquí vuestro SVG animado, <lottie-player> o vídeo.
          3. Mantenedlo dentro de este div para no romper el layout ni la
             animación de entrada de Framer Motion (que envuelve al padre).
          4. Proporción recomendada ~4:3 / 5:4.
      */}
      <div id="hero-svg-animation" className="relative">
        {/* Ventana de la app */}
        <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-black/50 ring-1 ring-white/5">
          {/* Barra de título */}
          <div className="flex items-center gap-2 border-b border-line bg-sidebar px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400/80" />
            <span className="h-3 w-3 rounded-full bg-amber-400/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
            <div className="ml-3 flex-1 rounded-md bg-bg px-3 py-1 text-center text-[11px] text-muted">
              panel.sokyo.bot / gestión
            </div>
          </div>

          {/* Cuerpo */}
          <div className="flex">
            {/* Rail lateral */}
            <div className="flex w-12 flex-col items-center gap-3 border-r border-line bg-sidebar py-4">
              <div className="h-7 w-7 rounded-lg bg-gradient-brand" />
              <div className="h-7 w-7 rounded-lg bg-brand/20" />
              <div className="h-7 w-7 rounded-lg bg-elevated" />
              <div className="h-7 w-7 rounded-lg bg-elevated" />
            </div>

            {/* Contenido */}
            <div className="flex-1 space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-28 rounded bg-fg/70" />
                <div className="h-6 w-16 rounded-full bg-elevated" />
              </div>

              {/* Tarjetas de ticket en miniatura */}
              {[
                { c: 'bg-red-400', n: 'Carlos', t: 'Error al pagar', p: 'Urgente', pc: 'text-red-400 bg-red-400/10' },
                { c: 'bg-amber-400', n: 'Lucía', t: 'Duda sobre roles', p: 'Alta', pc: 'text-amber-400 bg-amber-400/10' },
                { c: 'bg-emerald-400', n: 'Marco', t: 'Sugerencia', p: 'Baja', pc: 'text-emerald-400 bg-emerald-400/10' },
              ].map((row, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-line bg-bg">
                  <div className={`h-1 w-full ${row.c}`} />
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-elevated" />
                      <div>
                        <div className="text-xs font-semibold text-fg">{row.t}</div>
                        <div className="text-[10px] text-muted">{row.n}</div>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${row.pc}`}>{row.p}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toast flotante 1 — ticket cerrado con valoración */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
          transition={{ opacity: { delay: 1, duration: 0.4 }, scale: { delay: 1, duration: 0.4 }, y: { delay: 1.4, duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
          className="absolute -left-6 top-24 hidden items-center gap-2 rounded-xl border border-line bg-elevated/95 px-3 py-2 shadow-xl backdrop-blur sm:flex"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-400"><Star size={15} /></span>
          <div>
            <div className="text-[11px] font-bold text-fg">Ticket cerrado</div>
            <div className="text-[10px] text-amber-400">★★★★★</div>
          </div>
        </motion.div>

        {/* Toast flotante 2 — nuevo mensaje */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, y: [0, 8, 0] }}
          transition={{ opacity: { delay: 1.2, duration: 0.4 }, scale: { delay: 1.2, duration: 0.4 }, y: { delay: 1.6, duration: 4.5, repeat: Infinity, ease: 'easeInOut' } }}
          className="absolute -right-5 bottom-16 hidden items-center gap-2 rounded-xl border border-line bg-elevated/95 px-3 py-2 shadow-xl backdrop-blur sm:flex"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/15 text-brand"><MessageSquare size={15} /></span>
          <div>
            <div className="text-[11px] font-bold text-fg">+12 respuestas</div>
            <div className="text-[10px] text-muted">en la última hora</div>
          </div>
        </motion.div>
      </div>

      {/* Glow inferior suave */}
      <div className="pointer-events-none absolute -bottom-8 left-1/2 h-24 w-2/3 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
    </motion.div>
  );
}
