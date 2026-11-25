const mongoose = require('mongoose');

// Cumpleaños de cada persona (vale en todos los servidores con Sokyo): solo el día
// y el mes, sin el año. Se guarda con /cumple o en «Mi cuenta». Cada servidor con
// los cumpleaños activados felicita a sus miembros ese día (utils/cumpleanos.js).
const CumpleanosSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    dia: { type: Number, default: null, min: 1, max: 31 },  // null = lo borró (el documento se queda por fijadoEn)
    mes: { type: Number, default: null, min: 1, max: 12 },
    // 2.0.0, contra trampas: cuándo se puso la fecha (cambiarla solo el primer día o pasados 180 días)
    // y cuándo dio regalo cada servidor (como mucho uno al año en cada uno).
    fijadoEn: { type: Date, default: null },
    premios: { type: Map, of: Date, default: {} },
}, { timestamps: true });

CumpleanosSchema.index({ mes: 1, dia: 1 }); // «¿quién cumple hoy?»

module.exports = mongoose.model('Cumpleanos', CumpleanosSchema);
