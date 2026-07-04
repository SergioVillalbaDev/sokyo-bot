const mongoose = require('mongoose');

// Historial de ofertas de empleo vistas por búsqueda de empleo (ver
// utils/busquedaEmpleo.js). El índice único {discordId, urlOferta} es lo que
// evita re-evaluar y regenerar el PDF de la misma oferta en cada barrido diario.
const OfertaEmpleoSchema = new mongoose.Schema({
    discordId: { type: String, required: true, index: true },
    portal: { type: String, enum: ['infojobs', 'jobtoday'], required: true },
    urlOferta: { type: String, required: true },

    titulo: { type: String, default: '' },
    empresa: { type: String, default: '' },
    ubicacion: { type: String, default: '' },

    puntuacion: { type: Number, default: null },
    motivo: { type: String, default: '' },
    estado: { type: String, enum: ['nueva', 'evaluada', 'descartada', 'adaptada', 'aplicada'], default: 'nueva' },
    rutaPDF: { type: String, default: null },
    rutaCarta: { type: String, default: null },
    rutaPreguntas: { type: String, default: null },
    rutaCapturaPreguntas: { type: String, default: null },

    fechaVista: { type: Date, default: Date.now },
    fechaAplicada: { type: Date, default: null },
});

OfertaEmpleoSchema.index({ discordId: 1, urlOferta: 1 }, { unique: true });

module.exports = mongoose.model('OfertaEmpleo', OfertaEmpleoSchema);
