// Avisos flotantes: toast('Guardado', 'ok' | 'error' | 'nuevo' | 'info')
export const toast = (mensaje, tipo = 'info') => window.dispatchEvent(new CustomEvent('sokyo:toast', { detail: { mensaje, tipo, id: Math.random() } }));
