const mongoose = require('mongoose');

// Oro que una persona ha gastado hoy en impulsar un servidor en la Liga (tope diario).
const ImpulsoLigaSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    dia: { type: String, required: true },   // 'YYYY-MM-DD'
    oro: { type: Number, default: 0 },
    creado: { type: Date, default: Date.now, expires: 3 * 24 * 3600 },
});

ImpulsoLigaSchema.index({ userId: 1, dia: 1 }, { unique: true });

module.exports = mongoose.model('ImpulsoLiga', ImpulsoLigaSchema);
