// Acceso a la configuración de cada servidor + reglas del plan (gratis / Premium).
const ServidorConfig = require('../models/ServidorConfig.js');

const PREGUNTAS_POR_DEFECTO = [
    { etiqueta: 'Asunto del ticket', placeholder: 'Ej: No puedo acceder a mi cuenta', estilo: 'corto', requerida: true, max: 100 },
    { etiqueta: 'Describe tu problema detalladamente', placeholder: '', estilo: 'largo', requerida: true, max: 1000 }
];

const LIMITES = {
    gratis: { logs: 50, iaMes: Number(process.env.IA_LIMITE_GRATIS) || 30 },
    premium: { logs: 500, iaMes: Number(process.env.IA_LIMITE_PREMIUM) || 3000 }
};

// Devuelve el documento de configuración (lo crea si no existe) y migra el panel antiguo.
async function obtenerConfig(guildId) {
    let config = await ServidorConfig.findOne({ guildId });
    if (!config) {
        try {
            config = await ServidorConfig.create({ guildId });
        } catch (e) {
            // Carrera: otro evento lo acaba de crear
            config = await ServidorConfig.findOne({ guildId });
            if (!config) throw e;
        }
    }
    if (!config.paneles || config.paneles.length === 0) {
        config.paneles = [{
            nombre: 'Panel principal',
            titulo: config.mensajeSoporteTitulo,
            descripcion: config.mensajeSoporteDescripcion
        }];
        await config.save();
    }
    return config;
}

function esPremium(config) {
    if (!config || !config.esPremium) return false;
    return !config.premiumHasta || new Date(config.premiumHasta) > new Date();
}

function limitesDe(config) {
    return esPremium(config) ? LIMITES.premium : LIMITES.gratis;
}

function preguntasDe(motivo) {
    return motivo && motivo.preguntas && motivo.preguntas.length > 0 ? motivo.preguntas : PREGUNTAS_POR_DEFECTO;
}

function buscarMotivo(config, idONombre) {
    if (!config || !idONombre) return null;
    return config.motivos.find(m => String(m._id) === idONombre) ||
        config.motivos.find(m => m.nombre === idONombre) || null;
}

function buscarPanel(config, panelId) {
    if (!config || !config.paneles || config.paneles.length === 0) return null;
    if (!panelId) return config.paneles[0];
    return config.paneles.find(p => String(p._id) === panelId) || null;
}

function motivosDePanel(config, panel) {
    if (!panel || !panel.motivos || panel.motivos.length === 0) return config.motivos;
    const ids = new Set(panel.motivos.map(String));
    const lista = config.motivos.filter(m => ids.has(String(m._id)));
    return lista.length > 0 ? lista : config.motivos;
}

function nivelUrgencia(config, nombre) {
    return config.urgencias.find(u => u.nombre === nombre)?.nivel || 0;
}

function colorUrgencia(config, nombre) {
    return config.urgencias.find(u => u.nombre === nombre)?.color || '#3498db';
}

module.exports = {
    PREGUNTAS_POR_DEFECTO, LIMITES,
    obtenerConfig, esPremium, limitesDe, preguntasDe,
    buscarMotivo, buscarPanel, motivosDePanel, nivelUrgencia, colorUrgencia
};
