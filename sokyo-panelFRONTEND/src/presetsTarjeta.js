// Diseños prediseñados de la tarjeta de nivel (todos PREMIUM).
// El render real es ARTE por código en el bot (utils/cardStyles.js): nebulosas,
// estrellas, rejillas de neón, vetas doradas, ondas... que el tier gratis (un
// degradado de 2 colores) NO puede reproducir.
// - colorAcento/fondoColor/colorSecundario: respaldo para servidores NO premium.
// - swatch: CSS que aproxima el estilo en la miniatura del Portal.
// - animado: se renderiza como GIF en Discord.
export const PRESETS_TARJETA = [
  // --- 5 estáticos ---
  { id: 'atardecer', nombre: 'Atardecer', animado: false, colorAcento: '#ffd166', fondoColor: '#7b2d6b', colorSecundario: '#ffb86c', fondoTipo: 'degradado',
    swatch: 'radial-gradient(60% 50% at 50% 95%, rgba(255,228,150,.9), transparent 60%), linear-gradient(180deg,#2b1055,#7b2d6b 55%,#ff5e62 80%,#ffb86c)' },
  { id: 'oceano', nombre: 'Océano', animado: false, colorAcento: '#38bdf8', fondoColor: '#01497c', colorSecundario: '#012a4a', fondoTipo: 'degradado',
    swatch: 'radial-gradient(120% 80% at 50% 0%, #2a6f97, transparent 60%), linear-gradient(180deg,#013a63,#012a4a)' },
  { id: 'bosque', nombre: 'Bosque', animado: false, colorAcento: '#a7f432', fondoColor: '#0b3d2e', colorSecundario: '#05231a', fondoTipo: 'degradado',
    swatch: 'linear-gradient(120deg, rgba(160,255,120,.12), transparent 40%), linear-gradient(160deg,#0b3d2e,#05231a)' },
  { id: 'galaxia', nombre: 'Galaxia', animado: false, colorAcento: '#c8b6ff', fondoColor: '#160a2e', colorSecundario: '#08041a', fondoTipo: 'degradado',
    swatch: 'radial-gradient(60% 80% at 72% 30%, rgba(196,113,237,.7), transparent 60%), radial-gradient(50% 70% at 35% 80%, rgba(56,189,248,.5), transparent 60%), #160a2e' },
  { id: 'oro', nombre: 'Oro', animado: false, colorAcento: '#ffd700', fondoColor: '#1a1407', colorSecundario: '#000000', fondoTipo: 'degradado',
    swatch: 'repeating-linear-gradient(135deg, rgba(255,215,0,.14) 0 2px, transparent 2px 14px), linear-gradient(135deg,#1a1407,#000)' },
  // --- 5 animados (se renderizan como GIF en Discord) ---
  { id: 'aurora', nombre: 'Aurora', animado: true, colorAcento: '#00f5d4', fondoColor: '#071a3a', colorSecundario: '#04122b', fondoTipo: 'degradado',
    swatch: 'radial-gradient(60% 100% at 50% 60%, rgba(0,245,212,.6), transparent 70%), radial-gradient(60% 100% at 30% 50%, rgba(123,47,247,.5), transparent 70%), #04122b' },
  { id: 'destello', nombre: 'Destello', animado: true, colorAcento: '#ffd700', fondoColor: '#241a05', colorSecundario: '#000000', fondoTipo: 'degradado',
    swatch: 'radial-gradient(50% 120% at 15% 10%, rgba(255,240,170,.5), transparent 55%), repeating-linear-gradient(135deg, rgba(255,215,0,.12) 0 2px, transparent 2px 14px), linear-gradient(135deg,#241a05,#000)' },
  { id: 'neon', nombre: 'Neón', animado: true, colorAcento: '#ff006e', fondoColor: '#170425', colorSecundario: '#0a0118', fondoTipo: 'degradado',
    swatch: 'linear-gradient(0deg, rgba(0,234,255,.3), transparent 55%), radial-gradient(60% 60% at 50% 55%, rgba(255,0,110,.4), transparent 70%), linear-gradient(180deg,#170425,#0a0118)' },
  { id: 'cosmos', nombre: 'Cosmos', animado: true, colorAcento: '#8be9fd', fondoColor: '#0a0a2b', colorSecundario: '#05031f', fondoTipo: 'degradado',
    swatch: 'radial-gradient(50% 70% at 30% 40%, rgba(80,120,255,.6), transparent 65%), radial-gradient(50% 70% at 75% 60%, rgba(0,200,220,.5), transparent 65%), #06031f' },
  { id: 'marea', nombre: 'Marea', animado: true, colorAcento: '#48cae4', fondoColor: '#013a63', colorSecundario: '#012a4a', fondoTipo: 'degradado',
    swatch: 'linear-gradient(180deg, #013a63 40%, #0096c7 70%, #023e8a)' },
];
