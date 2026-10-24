// Nombres de urgencia de fábrica traducidos solo para mostrarlos: se guardan en
// inglés porque son los identificadores que enlazan motivos, tickets y colores.
const CLAVES = { Urgent: 'urgent', High: 'high', Normal: 'normal', Low: 'low' };

export const nombrePrioridad = (t, nombre) => (CLAVES[nombre] ? t(`dashboard.priority.${CLAVES[nombre]}`) : nombre);
