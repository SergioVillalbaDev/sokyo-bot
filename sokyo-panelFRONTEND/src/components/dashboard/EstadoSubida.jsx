// Línea de estado de un campo de imagen (hooks/useSubidaImagen.js): «Preparando el
// GIF… 40 %», «Subiendo…», lo que se ha cambiado («GIF reducido de 14 MB a 6 MB…»)
// o el error en palabras normales.
import { useTranslation } from 'react-i18next';
import { Loader2, Info } from 'lucide-react';

export default function EstadoSubida({ sub, className = 'mt-1' }) {
  const { t } = useTranslation();
  if (sub.estado === 'preparando') {
    return <p role="status" className={`${className} flex items-center gap-1.5 text-xs text-muted`}><Loader2 size={13} className="animate-spin" /> {t('dashboard.imagen.preparando')}{sub.progreso > 0 ? ` ${sub.progreso} %` : ''}</p>;
  }
  if (sub.estado === 'subiendo') {
    return <p role="status" className={`${className} flex items-center gap-1.5 text-xs text-muted`}><Loader2 size={13} className="animate-spin" /> {t('dashboard.imagen.subiendo')}</p>;
  }
  if (sub.error) return <p role="alert" className={`${className} text-xs text-danger`}>{sub.error}</p>;
  if (sub.nota) return <p className={`${className} flex items-start gap-1.5 text-xs text-success`}><Info size={13} className="mt-0.5 shrink-0" /> {sub.nota}</p>;
  return null;
}
