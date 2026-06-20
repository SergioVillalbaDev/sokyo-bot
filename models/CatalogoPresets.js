const mongoose = require('mongoose');

// Preset personalizado creado por un admin desde el panel. Son por COLOR
// (no arte por código), así que se aplican vía el render normal de colores.
const PresetPersonalizadoSchema = new mongoose.Schema({
    id: { type: String, required: true },
    nombre: { type: String, required: true },
    colorAcento: { type: String, default: '#5865F2' },
    fondoColor: { type: String, default: '#1e2030' },
    colorSecundario: { type: String, default: '#9b59b6' },
    fondoTipo: { type: String, enum: ['color', 'degradado'], default: 'degradado' },
    premium: { type: Boolean, default: false }, // bloquea su selección a no-premium
}, { _id: false });

// Catálogo GLOBAL de presets de tarjeta (un único documento, clave 'global').
// `ocultos` = ids de presets de fábrica que el admin ha quitado del catálogo.
const CatalogoPresetsSchema = new mongoose.Schema({
    clave: { type: String, default: 'global', unique: true },
    ocultos: { type: [String], default: [] },
    personalizados: { type: [PresetPersonalizadoSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('CatalogoPresets', CatalogoPresetsSchema);
