// Constantes y helpers compartidos del sistema de moderación (usados por varias vistas).
import { AlertTriangle, VolumeX, LogOut, Hammer } from 'lucide-react';

// Las 4 acciones de Discord, con su icono y color por defecto.
export const ACCIONES = [
  { id: 'aviso', icon: AlertTriangle, color: '#f1c40f' },
  { id: 'timeout', icon: VolumeX, color: '#e67e22' },
  { id: 'expulsion', icon: LogOut, color: '#e74c3c' },
  { id: 'ban', icon: Hammer, color: '#992d22' },
];

export const accionMeta = (id) => ACCIONES.find((a) => a.id === id) || ACCIONES[0];

// minutos -> { valor, unidad } legible, y al revés.
export const aUnidad = (min) => {
  if (!min) return { valor: 0, unidad: 'min' };
  if (min % 1440 === 0) return { valor: min / 1440, unidad: 'dias' };
  if (min % 60 === 0) return { valor: min / 60, unidad: 'horas' };
  return { valor: min, unidad: 'min' };
};
export const aMinutos = (valor, unidad) => valor * (unidad === 'dias' ? 1440 : unidad === 'horas' ? 60 : 1);

// Texto corto de duración (necesita la función t de i18n para "permanente").
export function textoDuracion(min, t) {
  if (!min || min <= 0) return t('dashboard.mod_v.permanent');
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} d`;
}
