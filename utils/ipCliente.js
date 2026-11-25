// IP de quien hace la petición, para los límites de peticiones (2.0.1). La web llega por Cloudflare
// (túnel en la Pi): sin esto, todas las peticiones parecían venir de la misma IP (la del túnel o la de
// Cloudflare) y los límites eran para TODOS juntos (30 inicios de sesión por minuto en total).
// Solo nos fiamos de CF-Connecting-IP si la conexión viene de la propia máquina o de una red privada
// (el túnel); desde fuera, esa cabecera la podría inventar cualquiera.
const { ipKeyGenerator } = require('express-rate-limit');

const PRIVADA = /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:(127|10|192\.168)\.|fc|fd)/i;

function ipCliente(req) {
    const directa = req.socket?.remoteAddress || req.ip || '';
    const cf = String(req.get?.('cf-connecting-ip') || '').trim();
    if (cf && PRIVADA.test(directa) && /^[0-9a-f:.]{3,45}$/i.test(cf)) return cf;
    return req.ip || directa;
}
const claveLimite = (req) => ipKeyGenerator(ipCliente(req));

module.exports = { ipCliente, claveLimite };
