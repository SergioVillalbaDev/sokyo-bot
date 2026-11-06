// ============================================================================
// Al cambiar el idioma del bot en un servidor (panel → Comandos y prefijo), los
// paneles fijos que ya están publicados en Discord se reescriben solos en el idioma
// nuevo (1.9.14): antes seguían en el de antes hasta volver a publicarlos uno a uno.
// Solo se EDITA lo que ya está; nunca se publica nada nuevo ni se mueve de canal.
// Los textos que el servidor ha escrito a mano no cambian (solo los de fábrica).
// ============================================================================
const ServidorConfig = require('../models/ServidorConfig.js');
const { editarOPublicar } = require('./panelMensaje.js');

// [nombre, (cfg) => { canalId, mensajeId }, (cfg, guild) => payload]
function paneles() {
    const comunidad = require('./comunidad.js');
    const v = (cfg) => cfg.verificacion || {};
    const e = (cfg) => cfg.embudoAB || {};
    const s = (cfg) => cfg.solicitudes || {};
    const voz = (cfg) => cfg.vozTemporal || {};
    return [
        ['presentaciones', (cfg) => ({ canalId: cfg.presentaciones && cfg.presentaciones.activo ? cfg.presentaciones.canalIntro : null, mensajeId: cfg.presentaciones && cfg.presentaciones.panelMensajeId }),
            (cfg, guild) => comunidad.contenidoPanelPresentacion(cfg, guild)],
        ['sugerencias', (cfg) => ({ canalId: cfg.sugerenciasModo === 'formulario' ? cfg.canalSugerencias : null, mensajeId: cfg.sugerenciasPanel && cfg.sugerenciasPanel.mensajeId }),
            (cfg, guild) => comunidad.contenidoPanelSugerencias(cfg, guild)],
        ['tickets', (cfg) => ({ canalId: cfg.panelTickets && cfg.panelTickets.canalId, mensajeId: cfg.panelTickets && cfg.panelTickets.mensajeId }),
            (cfg) => require('./panelTickets.js').contenidoPanelTickets(cfg)],
        ['cuenta', (cfg) => ({ canalId: cfg.panelCuenta && cfg.panelCuenta.canalId, mensajeId: cfg.panelCuenta && cfg.panelCuenta.mensajeId }),
            (cfg, guild) => require('./cuenta.js').panelCuenta(cfg, guild)],
        ['verificacion', (cfg) => ({ canalId: v(cfg).canalId, mensajeId: v(cfg).mensajeId }),
            (cfg, guild) => require('./verificacion.js').contenidoPanel(v(cfg), cfg, guild)],
        ['embudo', (cfg) => ({ canalId: e(cfg).canalId, mensajeId: e(cfg).mensajeId }),
            (cfg, guild) => require('./embudo.js').contenidoPanel(cfg.guildId, e(cfg), cfg, guild)],
        ['solicitudes', (cfg) => ({ canalId: s(cfg).canalId, mensajeId: s(cfg).panelMensajeId }),
            (cfg) => require('./solicitudes.js').mensajePanel(cfg)],
        ['vozTemporal', (cfg) => ({ canalId: voz(cfg).panelCanalId, mensajeId: voz(cfg).panelMensajeId }),
            (cfg) => require('./vozTemporal.js').construirPanel(voz(cfg), cfg)],
    ];
}

// Reescribe los paneles publicados del servidor. Devuelve los nombres de los que
// ha actualizado. Un fallo en uno (canal borrado, sin permisos…) no para el resto.
async function refrescarPanelesPublicados(client, guildId) {
    const doc = await ServidorConfig.findOne({ guildId });
    const guild = client && client.guilds && client.guilds.cache.get(guildId);
    if (!doc || !guild) return [];
    const cfg = doc.toObject();
    const hechos = [];
    for (const [nombre, donde, armar] of paneles()) {
        try {
            const { canalId, mensajeId } = donde(cfg);
            if (!canalId || !mensajeId) continue;
            const canal = guild.channels.cache.get(canalId);
            if (!canal || typeof canal.isTextBased !== 'function' || !canal.isTextBased()) continue;
            const { mensaje } = await editarOPublicar(canal, mensajeId, armar(cfg, guild), { soloEditar: true });
            if (mensaje) hechos.push(nombre);
        } catch (err) {
            console.error(`No se pudo actualizar el panel «${nombre}» de ${guildId}:`, err.message);
        }
    }
    return hechos;
}

// ¿Cambian estos ajustes ('presentaciones.panel.textoBoton'…) algún panel publicado?
// Lo usa «Deshacer» del historial: si no, el mensaje de Discord se quedaba como estaba.
const RAICES = ['idioma', 'colorEmbed', 'footerPersonalizado', 'textoBoton', 'mensajeSoporteTitulo', 'mensajeSoporteDescripcion',
    'presentaciones.panel', 'sugerenciasPanel', 'panelCuenta', 'verificacion', 'embudoAB', 'solicitudes', 'vozTemporal'];
const afectaPaneles = (claves) => (claves || []).some((k) => RAICES.some((r) => k === r || String(k).startsWith(`${r}.`)));

module.exports = { refrescarPanelesPublicados, afectaPaneles, _paneles: paneles };
