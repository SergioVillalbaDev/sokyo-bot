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

// Texto del footer de marca para un embed del sistema (o null si no procede).
function pieMarca(cfg) {
    const propio = (cfg && cfg.footerPersonalizado) ? String(cfg.footerPersonalizado).trim() : '';
    if (esPro(cfg)) return propio || null;            // de pago: su marca (o ninguna)
    if (!propio) return MARCA;                         // free sin footer: marca Sokyo
    return /sokyo/i.test(propio) ? propio : `${propio} · ${MARCA}`; // free con footer: garantiza la marca
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

module.exports = { pieMarca, aplicarPieMarca, lineaMarcaTexto, MARCA };
