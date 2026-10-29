const mongoose = require('mongoose');

// Cumpleaños de cada persona (vale en todos los servidores con Sokyo): solo el día
// y el mes, sin el año. Se guarda con /cumple o en «Mi cuenta». Cada servidor con
// los cumpleaños activados felicita a sus miembros ese día (utils/cumpleanos.js).
const CumpleanosSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    dia: { type: Number, required: true, min: 1, max: 31 },
    mes: { type: Number, required: true, min: 1, max: 12 },
}, { timestamps: true });

CumpleanosSchema.index({ mes: 1, dia: 1 }); // «¿quién cumple hoy?»

module.exports = mongoose.model('Cumpleanos', CumpleanosSchema);
