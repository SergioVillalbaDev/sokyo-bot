const mongoose = require('mongoose');

// Un voto por el bot en top.gg (1.10.0, utils/votos.js). Sirve para no premiar dos
// veces el mismo voto (top.gg reintenta los webhooks) y para /votar («vuelve en…»).
const VotoSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    fecha: { type: Date, default: Date.now },
    finde: { type: Boolean, default: false },   // top.gg cuenta doble los fines de semana
    oro: { type: Number, default: 0 },
});
VotoSchema.index({ fecha: -1 });

module.exports = mongoose.model('Voto', VotoSchema);
