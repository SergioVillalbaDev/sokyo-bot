const mongoose = require('mongoose');

// Preset personalizado creado por un propietario del bot desde el panel: por COLOR
// o con una imagen/GIF de fondo (no arte por código), con el render normal.
const PresetPersonalizadoSchema = new mongoose.Schema({
    id: { type: String, required: true },
    nombre: { type: String, required: true },
    colorAcento: { type: String, default: '#5865F2' },
    fondoColor: { type: String, default: '#1e2030' },
    colorSecundario: { type: String, default: '#9b59b6' },
    fondoTipo: { type: String, enum: ['color', 'degradado', 'imagen'], default: 'degradado' },
    // Fondo con imagen o GIF (/uploads/… o https) y cómo se ajustó en el panel (mover,
    // ampliar, girar): { escala, x, y, giro, ancho, alto }. Ver utils/catalogoTarjetas.js.
    fondoImagen: { type: String, default: null },
    encuadre: { type: mongoose.Schema.Types.Mixed, default: null },
    premium: { type: Boolean, default: false }, // bloquea su selección a no-premium
    animado: { type: Boolean, default: false },  // se renderiza como GIF (solo en servidores premium)
}, { _id: false });

// Catálogo GLOBAL de presets de tarjeta (un único documento, clave 'global').
// `ocultos` = ids de presets de fábrica que el admin ha quitado del catálogo.
const CatalogoPresetsSchema = new mongoose.Schema({
    clave: { type: String, default: 'global', unique: true },
    ocultos: { type: [String], default: [] },
    personalizados: { type: [PresetPersonalizadoSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('CatalogoPresets', CatalogoPresetsSchema);
