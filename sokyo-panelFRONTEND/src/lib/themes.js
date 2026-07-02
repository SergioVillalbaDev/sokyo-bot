// Catálogo de temas. `swatch` = [color de fondo, color de acento] para la
// previsualización en el selector. `premium: true` => bloqueado en plan Free.
export const THEMES = [
  // --- FREE ---
  { id: 'light', label: 'Claro', premium: false, swatch: ['#ffffff', '#111827'] },
  { id: 'dark', label: 'Oscuro', premium: false, swatch: ['#0b0c0e', '#fafafa'] },
  { id: 'lima', label: 'Aurora', premium: false, swatch: ['#07080f', '#9db4fa'] },
  // --- PREMIUM ---
  { id: 'lavanda', label: 'Lavanda', premium: true, swatch: ['#efeaf4', '#7c5cbf'] },
  { id: 'esmeralda', label: 'Esmeralda', premium: true, swatch: ['#06120d', '#34d399'] },
  { id: 'oceano', label: 'Océano', premium: true, swatch: ['#060c18', '#38bdf8'] },
  { id: 'atardecer', label: 'Atardecer', premium: true, swatch: ['#140a0c', '#fb7185'] },
  { id: 'synthwave', label: 'Synthwave', premium: true, swatch: ['#0a0712', '#e879f9'] },
  { id: 'cereza', label: 'Cereza', premium: true, swatch: ['#fdf2f5', '#e11d48'] },
  { id: 'ambar', label: 'Ámbar', premium: true, swatch: ['#120d06', '#f59e0b'] },
  { id: 'pizarra', label: 'Pizarra', premium: true, swatch: ['#0b1120', '#7dd3fc'] },
];

export const FREE_THEMES = THEMES.filter((t) => !t.premium);
export const PREMIUM_THEMES = THEMES.filter((t) => t.premium);
export const isValidTheme = (id) => THEMES.some((t) => t.id === id);
export const isPremiumTheme = (id) => PREMIUM_THEMES.some((t) => t.id === id);
