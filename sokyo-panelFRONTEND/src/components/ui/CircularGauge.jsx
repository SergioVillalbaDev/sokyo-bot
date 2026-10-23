// Indicador circular de progreso (gauge) animado.
import { motion } from 'framer-motion';

export function CircularGauge({ value = 0, size = 130, stroke = 11, color = 'var(--accent-color)', children }) {
  const v = Math.min(100, Math.max(0, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;
  const mid = size / 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={mid} cy={mid} r={r} fill="none" strokeWidth={stroke} stroke="var(--border-color)" />
        <motion.circle
          cx={mid} cy={mid} r={r} fill="none" strokeWidth={stroke} stroke={color} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
