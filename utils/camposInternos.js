// Campos de la configuración que lleva el propio bot (no son ajustes de nadie):
// el estado de los juegos, del bump o de la página pública, mensajes publicados…
// No se apuntan en el historial, no se deshacen, no se copian a otro servidor ni
// se pisan al importar. Los mismos que marca «(interno)» models/ServidorConfig.js.
const HOJAS_INTERNAS = new Set([
    'idx', 'lastDia', 'mensajeId', 'ganadorHoy', 'proxima', 'encontrada', 'encontradaPor', 'lastSemana',
    'ultimoGanador', 'anunciados', 'panelMensajeId', 'proximoBump', 'recordado', 'ultimoCanalId',
    'ultimoAvisoId', 'ultimoBumpPor', 'ultimoBumpFecha', 'visitas', 'invitacionCodigo',
    'resueltas', 'ultimoNumero',
]);
const RAICES_INTERNAS = new Set([
    '_id', '__v', 'guildId', 'createdAt', 'updatedAt', 'ultimaVersionAnunciada', 'autoAsignarIndex',
    'iaUsos', 'iaMesRef', 'esPremium', 'plan', 'premiumHasta', 'premiumCancelaAlFinal',
    'stripeCustomerId', 'stripeSubscriptionId', 'soporteCompradorId', 'trialUsado',
]);
// Rutas concretas: dónde está publicado el mensaje de «Mi cuenta» es del bot, pero
// cómo es (texto, embed, botones; 1.9.12) es un ajuste más (se deshace y se copia).
const RUTAS_INTERNAS = new Set([
    'panelCuenta.canalId', 'panelCuenta.fecha', 'panelTickets.canalId', 'panelTickets.fecha',
    // Mensajes con botón (1.9.14): si el bot cerró el canal y si quedó algo sin publicar.
    'sugerenciasPanel.bloqueado', 'sugerenciasPanel.pendiente', 'presentaciones.panelPendiente',
]);

// ruta = 'dinamicas.qotd.lastDia' (o una lista de partes)
function esInterno(ruta) {
    const partes = Array.isArray(ruta) ? ruta : String(ruta).split('.');
    return RAICES_INTERNAS.has(partes[0]) || HOJAS_INTERNAS.has(partes[partes.length - 1]) || RUTAS_INTERNAS.has(partes.join('.'));
}

const esObjeto = (v) => !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

// { a: { b: 1, c: [2] } } -> { 'a.b': 1, 'a.c': [2] } (las listas, enteras), sin lo interno.
function aplanar(obj, prefijo = '', out = {}) {
    for (const [k, v] of Object.entries(obj || {})) {
        const ruta = prefijo ? `${prefijo}.${k}` : k;
        if (esInterno(ruta)) continue;
        if (esObjeto(v) && Object.keys(v).length) aplanar(v, ruta, out);
        else out[ruta] = v;
    }
    return out;
}

// Valor de una ruta con puntos dentro de un objeto.
const leerRuta = (obj, ruta) => ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

module.exports = { esInterno, aplanar, leerRuta, esObjeto, HOJAS_INTERNAS, RAICES_INTERNAS };
