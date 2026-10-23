const mongoose = require('mongoose');

// Dinámicas · Contador colaborativo. Un documento por canal de contador: guarda
// el número actual de la cuenta, quién contó el último (para no dejar contar dos
// veces seguidas) y el récord histórico alcanzado. La lógica vive en
// utils/dinamicas.js, disparada desde messageCreate.
const ContadorSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    canalId: { type: String, required: true },
    numeroActual: { type: Number, default: 0 },     // último número válido contado
    ultimoUserId: { type: String, default: null },  // quién contó el último (anti dos-seguidas)
    record: { type: Number, default: 0 },           // mayor cuenta alcanzada sin fallar
    recordFecha: { type: Date, default: null },
}, { timestamps: true });

ContadorSchema.index({ guildId: 1, canalId: 1 }, { unique: true });

module.exports = mongoose.model('Contador', ContadorSchema);
