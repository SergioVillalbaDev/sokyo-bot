// Utilidades (no componentes) de las pestañas de Crecimiento.

// "hace 5 min" / "en 2 h" en el idioma del panel.
export function relativo(fecha, idioma, ahora = Date.now()) {
  if (!fecha) return '';
  const seg = Math.round((new Date(fecha).getTime() - ahora) / 1000);
  const rtf = new Intl.RelativeTimeFormat(idioma || 'es', { numeric: 'auto' });
  const abs = Math.abs(seg);
  if (abs < 60) return rtf.format(seg, 'second');
  if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour');
  return rtf.format(Math.round(seg / 86400), 'day');
}
