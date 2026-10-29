// Índice de ajustes para el buscador del panel (Ctrl + K): los textos de cada
// sección (etiquetas, títulos, botones) salen de los textos del panel
// (dashboard.<espacio>), y cada espacio se sabe a qué sección pertenece. Así
// buscar «prefijo», «XP por mensaje» o «canal de bienvenida» lleva al sitio exacto.
import i18n from '../i18n';
import { normalizar } from '../components/dashboard/navConfig';

// Espacio de textos → pestaña del panel.
const ESPACIOS = {
  music_v: 'musica', voztemporal_v: 'voz-temporal', roles_v: 'roles-gestion', micuenta_v: 'com-micuenta',
  miembros_v: 'mod-miembros', canales_v: 'config-canales', niveles_v: 'config-niveles', expr_v: 'config-expresiones',
  app_v: 'config-app', acceso_v: 'config-acceso', automod_v: 'mod-automod', verif_v: 'seg-verificacion',
  dobleBienv: 'seg-verificacion', bienvenida_v: 'prod-bienvenidas', reportes_v: 'mod-reportes', backup_v: 'seg-backup',
  autoresp_v: 'prod-autorespuestas', embeds_v: 'prod-embeds', embed_b: 'prod-embeds', anuncios_v: 'prod-anuncios',
  autorol_v: 'roles-autorol', paneles_v: 'roles-paneles', mod_v: 'mod-centro', tickets_set: 'tickets-config',
  incidents_v: 'tickets-config', behavior_v: 'tickets-config', rules_v: 'tickets-config', macros_v: 'tickets-config',
  texts_v: 'config-textos', commands_v: 'config-textos', logs_v: 'logs-todos', resumen_v: 'datos-resumen',
  analitica_v: 'datos-analitica', sorteos_v: 'com-sorteos', eventos_v: 'com-eventos', encuestas_v: 'com-encuestas',
  dinamicas_v: 'com-dinamicas', sugerencias_v: 'com-sugerencias', presentaciones_v: 'com-presentaciones',
  planes_v: 'cuenta-plan', diagnostico: 'config-diagnostico', cambios: 'config-cambios', crec_v: 'crec-invitaciones',
};
// Dentro de Crecimiento, cada subapartado va a su pestaña.
const CRECIMIENTO = { inv: 'crec-invitaciones', invitaciones: 'crec-invitaciones', bump: 'crec-bump', pagina: 'crec-pagina', directos: 'crec-directos' };

// Lo que parece una etiqueta (no un párrafo, ni un texto con huecos {{…}}).
const esEtiqueta = (s) => typeof s === 'string' && s.length >= 3 && s.length <= 70 && !s.includes('{{') && !/^https?:/.test(s);

let cache = { idioma: null, lista: [] };

function recorrer(obj, tab, out, vistos) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) recorrer(v, tab === 'crec-invitaciones' && CRECIMIENTO[k] ? CRECIMIENTO[k] : tab, out, vistos);
    else if (esEtiqueta(v)) {
      const texto = v.replace(/\s+/g, ' ').trim();
      const clave = `${tab}|${normalizar(texto)}`;
      if (!vistos.has(clave)) { vistos.add(clave); out.push({ tab, texto, n: normalizar(texto) }); }
    }
  }
}

export function indiceAjustes() {
  const idioma = i18n.language;
  if (cache.idioma === idioma && cache.lista.length) return cache.lista;
  const panel = i18n.getResourceBundle(idioma, 'translation')?.dashboard || {};
  const lista = [];
  const vistos = new Set();
  for (const [espacio, tab] of Object.entries(ESPACIOS)) recorrer(panel[espacio], tab, lista, vistos);
  // Lo que sale en muchas secciones («Guardar», «Activado»…) no ayuda a encontrar nada.
  const enCuantas = new Map();
  for (const a of lista) enCuantas.set(a.n, (enCuantas.get(a.n) || 0) + 1);
  cache = { idioma, lista: lista.filter((a) => enCuantas.get(a.n) < 4) };
  return cache.lista;
}

// Los ajustes que encajan con lo escrito (todas las palabras), los mejores primero.
export function buscarAjustes(q, puedeVer = () => true, max = 8) {
  const palabras = normalizar(q).split(/\s+/).filter((p) => p.length >= 2);
  if (!palabras.length || normalizar(q).length < 3) return [];
  const frase = palabras.join(' ');
  return indiceAjustes()
    .filter((a) => puedeVer(a.tab) && palabras.every((p) => a.n.includes(p)))
    .map((a) => ({ ...a, p: a.n.startsWith(frase) ? 3 : a.n.includes(frase) ? 2 : 1 }))
    .sort((a, b) => b.p - a.p || a.texto.length - b.texto.length)
    .slice(0, max);
}

// Al llegar a la sección, busca en la pantalla el texto del ajuste, lo lleva a
// la vista y lo resalta un momento. Espera a que la sección termine de cargar.
export function resaltarTexto(texto, { espera = 4000 } = {}) {
  const buscado = normalizar(texto);
  const inicio = Date.now();
  const intentar = () => {
    const raiz = document.querySelector('main') || document.body;
    const andador = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    let nodo;
    let mejor = null;
    while ((nodo = andador.nextNode())) {
      const n = normalizar(nodo.nodeValue);
      if (!n.includes(buscado)) continue;
      const el = nodo.parentElement;
      if (!el || el.closest('[aria-hidden="true"]') || !el.getClientRects().length) continue;
      mejor = el;
      if (n.trim() === buscado) break; // coincidencia exacta: esta
    }
    if (mejor) {
      // Se resalta el bloque que lo contiene (la fila del ajuste), no solo la palabra.
      const bloque = mejor.closest('label, li, [data-help], .rounded-2xl, .rounded-3xl, section') || mejor;
      bloque.scrollIntoView({ block: 'center', behavior: document.documentElement.classList.contains('sk-ligero') ? 'auto' : 'smooth' });
      bloque.classList.remove('sk-resaltado');
      void bloque.offsetWidth; // para que la animación vuelva a empezar
      bloque.classList.add('sk-resaltado');
      setTimeout(() => bloque.classList.remove('sk-resaltado'), 2600);
      return;
    }
    if (Date.now() - inicio < espera) setTimeout(intentar, 250);
  };
  setTimeout(intentar, 200);
}
