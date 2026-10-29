const mongoose = require('mongoose');

// Salón de la fama: un mensaje que ha llegado a las estrellas necesarias y su copia
// en el canal del salón (para actualizar el número de estrellas y no repetirla).
const SalonFamaSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    mensajeId: { type: String, required: true, unique: true }, // el mensaje original
    canalId: { type: String, required: true },
    autorId: { type: String, default: null },
    publicadoId: { type: String, default: null },             // la copia en el salón
    estrellas: { type: Number, default: 0 },
    fecha: { type: Date, default: Date.now },
});

SalonFamaSchema.index({ guildId: 1, fecha: -1 });

module.exports = mongoose.model('SalonFama', SalonFamaSchema);
