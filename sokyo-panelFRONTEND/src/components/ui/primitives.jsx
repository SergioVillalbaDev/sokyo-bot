// ============================================================================
// Primitivas de UI reutilizables (estilo shadcn/Tremor) — Tailwind puro.
// Componentes pequeños y sin estado para mantener las vistas limpias.
// ============================================================================
import { Star } from 'lucide-react';
import { cn } from '../../lib/cn';

// Avatar circular con fallback automático a ui-avatars si no hay imagen.
export function Avatar({ src, name = '?', size = 32, className = '' }) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2c3e50&color=fff`;
  return (
    <img
      src={src || fallback}
      alt={name}
      width={size}
      height={size}
      onError={(e) => { e.currentTarget.src = fallback; }}
      style={{ width: size, height: size }}
      className={cn('rounded-full object-cover ring-1 ring-line shrink-0', className)}
    />
  );
}

// Valoración CSAT en estrellas (1–5). Sin puntuación => texto "Sin valorar".
export function Stars({ value = 0, size = 16 }) {
  if (!value) return <span className="text-xs text-muted italic">Sin valorar</span>;
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < value ? 'text-amber-400' : 'text-line'}
          fill={i < value ? 'currentColor' : 'none'}
        />
      ))}
    </div>
  );
}

// Etiqueta de estado/prioridad con color dinámico.
export function Badge({ children, color, className = '' }) {
  const style = color
    ? { backgroundColor: `${color}1a`, color, borderColor: `${color}55` }
    : undefined;
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        !color && 'border-line bg-elevated text-muted',
        className
      )}
    >
      {children}
    </span>
  );
}

// Tarjeta base con borde y superficie del tema.
export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={cn('rounded-2xl border border-line bg-card', className)}
      {...props}
    >
      {children}
    </div>
  );
}
