// Datos de la mascota del servidor que necesita el panel (los mismos que
// utils/mascotaNucleo.js del bot). Los textos van en dashboard.mascota_v.
export const ESPECIES = {
  dragon: { svg: '1f409', color: '#22c55e', emoji: '🐉' },
  zorro: { svg: '1f98a', color: '#f97316', emoji: '🦊' },
  golem: { svg: '1faa8', color: '#a8a29e', emoji: '🪨' },
  fenix: { svg: '1f426-200d-1f525', color: '#ef4444', emoji: '🔥' },
  kraken: { svg: '1f419', color: '#a855f7', emoji: '🐙' },
};
export const FORMAS = {
  nocturna: { svg: '1f319', color: '#6366f1' },
  musical: { svg: '1f3b5', color: '#ec4899' },
  guerrera: { svg: '2694', color: '#ef4444' },
  social: { svg: '1f4ac', color: '#38bdf8' },
};
export const FASES = [
  { id: 'cria', desde: 1, emoji: '🍼' },
  { id: 'joven', desde: 5, emoji: '🌱' },
  { id: 'adulta', desde: 15, emoji: '⭐' },
  { id: 'legendaria', desde: 30, emoji: '👑' },
];
export const VENTAJAS = [
  { id: 'caricia', nivel: 3, emoji: '🤲' },
  { id: 'xp5', nivel: 5, emoji: '✨' },
  { id: 'bromas10', nivel: 10, emoji: '🃏' },
  { id: 'proteger', nivel: 15, emoji: '🛡️' },
  { id: 'xp10', nivel: 20, emoji: '🌟' },
  { id: 'bromas20', nivel: 25, emoji: '🎭' },
  { id: 'leyenda', nivel: 30, emoji: '👑' },
];
export const svgMascota = (id) => `/mascota/${id}.svg`;
