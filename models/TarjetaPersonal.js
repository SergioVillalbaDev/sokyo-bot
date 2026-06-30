const mongoose = require('mongoose');

// Personalización de la tarjeta de rango de un usuario (global, por userId).
// Se aplica al generar su tarjeta SOLO en servidores premium.
const TarjetaPersonalSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    colorAcento: { type: String, default: '#5865F2' },
    // 'color' = fondo sólido · 'degradado' = fondoColor→colorSecundario · 'imagen' = premium.
    fondoTipo: { type: String, enum: ['color', 'degradado', 'imagen'], default: 'color' },
    fondoColor: { type: String, default: '#1e2030' },
    colorSecundario: { type: String, default: '#9b59b6' }, // 2º color del degradado
    fondoImagen: { type: String, default: null }, // URL externa o /uploads (solo premium)
    preset: { type: String, default: null }, // id del diseño prediseñado elegido (premium)
    animado: { type: Boolean, default: false }, // diseño personalizado animado (GIF, solo premium)
}, { timestamps: true });

module.exports = mongoose.model('TarjetaPersonal', TarjetaPersonalSchema);
