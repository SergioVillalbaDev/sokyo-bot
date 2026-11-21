// Datos de la mascota que necesita el panel (los mismos que utils/mascotaNucleo.js
// y utils/mascotaExtras.js del bot). Los textos van en dashboard.mascota_v.
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
export const PERSONALIDADES = {"glotona":{"emoji":"🍩"},"dormilona":{"emoji":"😴"},"juguetona":{"emoji":"🎾"},"valiente":{"emoji":"🦁","entrena":"fuerza"},"presumida":{"emoji":"💅"},"carinosa":{"emoji":"💞"},"lista":{"emoji":"🧠","entrena":"agilidad"},"tozuda":{"emoji":"🐏","entrena":"defensa"}};
export const STATS = {"fuerza":{"emoji":"⚔️"},"defensa":{"emoji":"🛡️"},"agilidad":{"emoji":"💨"}};
export const COMIDAS = {"filete":{"emoji":"🍖","svg":"1f356","precio":150,"efecto":{"hambre":25}},"fresas":{"emoji":"🍓","svg":"1f353","precio":120,"efecto":{"hambre":10,"alegria":12}},"tarta":{"emoji":"🍰","svg":"1f370","precio":300,"efecto":{"hambre":15,"alegria":30}},"medicina":{"emoji":"💊","svg":"1f48a","precio":250,"efecto":{"salud":35}},"batido":{"emoji":"⚡","svg":"26a1","precio":200,"efecto":{"energia":40}},"festin":{"emoji":"🍱","svg":"1f371","precio":700,"efecto":{"hambre":60,"alegria":20,"salud":15,"energia":20}}};
export const ACCESORIOS = {"chistera":{"emoji":"🎩","svg":"1f3a9","precio":800,"slot":"cabeza"},"gorra":{"emoji":"🧢","svg":"1f9e2","precio":500,"slot":"cabeza"},"birrete":{"emoji":"🎓","svg":"1f393","precio":900,"slot":"cabeza"},"flor":{"emoji":"🌸","svg":"1f338","precio":400,"slot":"cabeza"},"lazo":{"emoji":"🎀","svg":"1f380","precio":450,"slot":"cabeza"},"gafas":{"emoji":"🕶️","svg":"1f576","precio":700,"slot":"cara"},"auriculares":{"emoji":"🎧","svg":"1f3a7","precio":750,"slot":"cabeza"},"bufanda":{"emoji":"🧣","svg":"1f9e3","precio":600,"slot":"cuello"},"corona":{"emoji":"👑","svg":"1f451","precio":0,"slot":"cabeza","soloLogro":"leyenda"}};
export const HABITATS = {"prado":{"precio":0,"fondo":["#14532d","#1e293b"],"decor":["1f33c","1f343"]},"bosque":{"precio":1200,"fondo":["#052e16","#14532d"],"decor":["1f332","1f344"]},"volcan":{"precio":1500,"fondo":["#450a0a","#7c2d12"],"decor":["1f30b","1f525"]},"oceano":{"precio":1500,"fondo":["#082f49","#0c4a6e"],"decor":["1f30a","1f41a"]},"montana":{"precio":1500,"fondo":["#1e293b","#334155"],"decor":["1f3d4","2744"]},"noche":{"precio":1800,"fondo":["#020617","#1e1b4b"],"decor":["1f319","2b50"]},"playa":{"precio":1800,"fondo":["#0c4a6e","#a16207"],"decor":["1f334","2600"]},"castillo":{"precio":2500,"fondo":["#1e1b4b","#4c1d95"],"decor":["1f3f0","2728"]}};
export const POSICIONES = {"dragon":{"cabeza":{"x":0.3,"y":0.02},"cara":{"x":0.33,"y":0.21},"cuello":{"x":0.4,"y":0.52}},"zorro":{"cabeza":{"x":0.5,"y":-0.05},"cara":{"x":0.5,"y":0.45},"cuello":{"x":0.5,"y":0.8}},"golem":{"cabeza":{"x":0.5,"y":0.05},"cara":{"x":0.5,"y":0.45},"cuello":{"x":0.5,"y":0.8}},"fenix":{"cabeza":{"x":0.43,"y":0.27},"cara":{"x":0.43,"y":0.43},"cuello":{"x":0.47,"y":0.58}},"kraken":{"cabeza":{"x":0.5,"y":-0.04},"cara":{"x":0.5,"y":0.38},"cuello":{"x":0.5,"y":0.66}}};
export const TAM_ACCESORIO = {"cabeza":0.46,"cara":0.42,"cuello":0.38};
export const LOGROS = [{"id":"nivel10","emoji":"🔟"},{"id":"adulta","emoji":"⭐"},{"id":"leyenda","emoji":"👑"},{"id":"gourmet","emoji":"🍽️"},{"id":"mimada","emoji":"🤲"},{"id":"atleta","emoji":"🏋️"},{"id":"campeona","emoji":"🏆"},{"id":"imparable","emoji":"🔥"},{"id":"coqueta","emoji":"🎀"},{"id":"viajera","emoji":"🗺️"},{"id":"aventurera","emoji":"🧭"},{"id":"superviviente","emoji":"🌅"}];
export const ESPECIALES = ["dragon","zorro","golem","fenix","kraken"];
export const ENERGIA_ENTRENO = 15;
export const svgMascota = (id) => `/mascota/${id}.svg`;
