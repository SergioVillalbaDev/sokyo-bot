// ============================================================================
// IDIOMA DEL BOT (Discord) — traducción ligera por servidor.
// ----------------------------------------------------------------------------
// El panel tiene su propio i18n (por navegador). Esto es distinto: es el
// idioma en el que el bot le habla a Discord en un servidor concreto, guardado
// en ServidorConfig.idioma ('en' | 'es', por defecto 'en').
//
// No usa claves ni diccionario central: cada string se envuelve en el sitio
// con t(idioma, es, en). Es mecánico y de bajo riesgo sobre una base que ya
// tenía todo el texto hardcodeado en inglés (sesión "inglés por defecto").
//
// `resolverIdioma(cfg)` da el idioma efectivo a partir de la config del
// servidor (o 'en' si no hay config todavía, p. ej. servidor recién añadido).
// ============================================================================
const DEFAULT_IDIOMA = 'en';
const IDIOMAS_VALIDOS = ['en', 'es'];

function resolverIdioma(cfg) {
    const v = cfg && cfg.idioma;
    return IDIOMAS_VALIDOS.includes(v) ? v : DEFAULT_IDIOMA;
}

// t(idioma, textoEspañol, textoIngles) → el texto que toque. `idioma` acepta
// tanto el string ('es'/'en') como el objeto de config completo (comodidad).
function t(idioma, es, en) {
    const lang = typeof idioma === 'object' ? resolverIdioma(idioma) : idioma;
    return lang === 'es' ? es : en;
}

module.exports = { t, resolverIdioma, DEFAULT_IDIOMA, IDIOMAS_VALIDOS };
