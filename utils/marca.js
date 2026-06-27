// ============================================================================
// MARCA BLANCA (white-label). Punto único que decide qué "marca" lleva un embed
// o texto del SISTEMA (panel de tickets, bienvenida, ticket creado, transcript).
//
//   · Free  -> se garantiza la firma "Powered by Sokyo" (palanca de venta nº1 +
//              bucle de adquisición: cada servidor gratis anuncia el bot).
//   · Pro / Agencia -> el footer que el servidor haya puesto (su marca), o nada.
//
// Así el cliente de pago siente de verdad que el bot es SUYO.
// ============================================================================
const { esPro } = require('./billing.js');

const MARCA = 'Powered by Sokyo';

// A partir de un footer ya existente, devuelve el footer final con la marca
// garantizada para Free (o null si no procede). Reutilizable: lo usan tanto los
// embeds del sistema como el Creador de Anuncios / auto-respuestas (donde el
// footer lo escribe el propio usuario en el embed).
//   · Free  -> garantiza "Powered by Sokyo" (lo añade si falta).
//   · Pro / Agencia -> respeta el footer que haya (su marca), o nada.
function garantizarMarca(footerActual, cfg) {
    const propio = String(footerActual || '').trim();
    if (esPro(cfg)) return propio || null;             // de pago: su marca (o ninguna)
    if (!propio) return MARCA;                          // free sin footer: marca Sokyo
    return /sokyo/i.test(propio) ? propio : `${propio} · ${MARCA}`; // free con footer: garantiza la marca
}

// Texto del footer de marca para un embed del SISTEMA (usa el footer del config).
function pieMarca(cfg) {
    return garantizarMarca(cfg && cfg.footerPersonalizado, cfg);
}

// Aplica el footer de marca a un EmbedBuilder (si procede). Devuelve el mismo embed.
function aplicarPieMarca(embed, cfg) {
    const txt = pieMarca(cfg);
    if (txt) embed.setFooter({ text: txt.slice(0, 2048) });
    return embed;
}

// Línea de marca para textos planos (p. ej. transcripts). '' si es de pago.
function lineaMarcaTexto(cfg) {
    return esPro(cfg) ? '' : `\n— ${MARCA}\n`;
}

module.exports = { garantizarMarca, pieMarca, aplicarPieMarca, lineaMarcaTexto, MARCA };
