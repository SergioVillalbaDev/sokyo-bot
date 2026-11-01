// Aviso pequeño junto al botón «Guardar»: si los cambios se guardan solos y
// cuándo. Va con useAutoguardado (hooks/useAutoguardado.js).
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, CloudUpload, AlertTriangle } from 'lucide-react';

export default function EstadoAutoguardado({ estado }) {
  const { t } = useTranslation();
  if (estado === 'apagado') return null;
  const textos = {
    'al-dia': t('dashboard.autoguardado.alDia'),
    pendiente: t('dashboard.autoguardado.pendiente'),
    guardando: t('dashboard.autoguardado.guardando'),
    guardado: t('dashboard.autoguardado.guardado'),
    error: t('dashboard.autoguardado.error'),
    'sin-guardar': t('dashboard.autoguardado.sinGuardar'),
  };
  const Icono = estado === 'guardando' ? Loader2 : estado === 'guardado' ? CheckCircle2 : estado === 'error' ? AlertTriangle : CloudUpload;
  const color = estado === 'guardado' ? 'text-success' : estado === 'error' ? 'text-danger' : estado === 'sin-guardar' ? 'text-warning' : 'text-muted';
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 text-xs font-medium ${color}`}>
      <Icono size={14} className={estado === 'guardando' ? 'animate-spin' : ''} /> {textos[estado]}
    </span>
  );
}
